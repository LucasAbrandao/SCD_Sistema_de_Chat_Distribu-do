import React from 'react';
import { io, type Socket } from 'socket.io-client';
import type { User, Conversation, Message, LoginResult, Page, MessageAck, SendMessage } from '../../../packages/contracts/src/index';
type Session = LoginResult & { expiresAt: number };
type Pending = SendMessage & {state: string};
function restore(): Session | null {
  try { const value = JSON.parse(sessionStorage.getItem('scd-session') ?? 'null'); return value?.expiresAt > Date.now() && typeof value.accessToken === 'string' ? value : null; } catch { return null; }
}
export function Chat() {
  const [session,setSession] = React.useState<Session | null>(restore);
  const [mode,setMode] = React.useState<'login'|'register'>('login');
  const [error,setError] = React.useState('');
  const [busy,setBusy] = React.useState(false);
  const [conversations,setConversations] = React.useState<Conversation[]>([]);
  const [selected,setSelected] = React.useState<Conversation | null>(null);
  const [users,setUsers] = React.useState<User[]>([]);
  const [names,setNames] = React.useState<Record<string,string>>({});
  const [query,setQuery] = React.useState('');
  const [messages,setMessages] = React.useState<Message[]>([]);
  const [pending,setPending] = React.useState<Pending[]>([]);
  const [content,setContent] = React.useState('');
  const [connection,setConnection] = React.useState('Desconectado');
  const [loading,setLoading] = React.useState(false);
  const socket = React.useRef<Socket | null>(null);
  const generation = React.useRef(0);
  const active = React.useRef<string | null>(null);
  const syncNow = React.useRef<() => void>(() => {});
  function logout() {
    generation.current++; active.current = null;
    socket.current?.disconnect(); sessionStorage.removeItem('scd-session');
    setSession(null);setSelected(null);setMessages([]);setConversations([]);setPending([]);setUsers([]);setNames({});setError('');
  }
  async function api<T>(path: string, options: RequestInit = {}, auth = session): Promise<T> {
    const epoch = generation.current;
    const response = await fetch(path,{...options,headers:{'content-type':'application/json',...(auth ? {authorization:'Bearer '+auth.accessToken} : {}),...options.headers}});
    const body = await response.json();
    if (!response.ok) {
      if (response.status === 401 && auth && epoch === generation.current) logout();
      throw new Error(body.error?.message ?? 'Operação indisponível.');
    }
    return body;
  }
  function merge(incoming: Message[]) {
    setMessages(previous => [...new Map([...previous,...incoming].map(m => [m.id,m])).values()].sort((a,b) => BigInt(a.position)<BigInt(b.position) ? -1 : BigInt(a.position)>BigInt(b.position) ? 1 : 0));
    setPending(previous => previous.filter(p => !incoming.some(m => m.clientMessageId === p.clientMessageId && m.senderId === session?.user.id)));
  }
  React.useEffect(() => {
    if (!session) return;
    const epoch = ++generation.current;
    let stopped = false, listing = false;
    async function list() {
      if (listing) return; listing=true;
      try {
        let cursor: string | null = null; const items: Conversation[] = [];
        do { const page: Page<Conversation> = await api('/api/chat/conversations?limit=100'+(cursor ? '&after='+cursor : '')); items.push(...page.items);cursor=page.nextCursor; } while(cursor && !stopped);
        if (!stopped && epoch === generation.current) setConversations(items);
      } catch(e) { if (!stopped && epoch === generation.current) setError((e as Error).message); } finally {listing=false;}
    }
    const client = io({transports:['websocket'],auth:{token:session.accessToken}});
    socket.current=client;
    client.on('connect',() => {setConnection('Conectado');syncNow.current();void list();});
    client.on('disconnect',() => setConnection('Desconectado — reconectando…'));
    client.on('connect_error',(e: Error & {data?: {code?: string}}) => { setConnection('Conexão indisponível'); if (e.data?.code === 'UNAUTHENTICATED') logout(); });
    client.on('auth:expired',logout);
    client.on('message:new',(message: Message) => {if (!stopped && message.conversationId === active.current) {merge([message]);syncNow.current();}});
    const timer=setTimeout(logout,Math.max(0,session.expiresAt-Date.now()));
    const poll=setInterval(() => void list(),5000);
    const focus=() => {void list();syncNow.current();};
    window.addEventListener('focus',focus);void list();
    return () => {stopped=true;client.disconnect();clearTimeout(timer);clearInterval(poll);window.removeEventListener('focus',focus);};
  },[session]);
  React.useEffect(() => {
    active.current=selected?.id ?? null;setMessages([]);setContent('');
    if (!selected || !session) return;
    let stopped=false, running=false, cursor='0';
    const epoch=generation.current;
    async function synchronize() {
      if (running || stopped) return;running=true;setLoading(true);
      try {
        let more: string | null;
        do {
          const page: Page<Message> = await api(`/api/chat/conversations/${selected!.id}/messages?after=${cursor}&limit=100`);
          if (stopped || epoch!==generation.current) return;
          merge(page.items);
          if(page.items.length) cursor=page.items[page.items.length-1].position;
          more=page.nextCursor;
        } while(more && !stopped);
      } catch(e) {if(!stopped && epoch===generation.current)setError((e as Error).message);} finally {running=false;if(!stopped)setLoading(false);}
    }
    syncNow.current=() => void synchronize();void synchronize();
    const poll=setInterval(() => void synchronize(),5000);
    return () => {stopped=true;clearInterval(poll);syncNow.current=() => {};};
  },[selected?.id,session]);
  React.useEffect(() => {
    if(!session)return;
    let stopped=false;
    const timer=setTimeout(async () => {
      try {
        const page=await api<Page<User>>('/api/auth/users?limit=100&q='+encodeURIComponent(query));
        if(!stopped){setUsers(page.items.filter(u=>u.id!==session.user.id));setNames(previous=>({...previous,...Object.fromEntries(page.items.map(u=>[u.id,u.username]))}));}
      }catch(e){if(!stopped)setError((e as Error).message);}
    },250);
    return()=>{stopped=true;clearTimeout(timer);};
  },[query,session]);
  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');setBusy(true);
    const form=new FormData(event.currentTarget);const input={username:form.get('username'),password:form.get('password')};
    try {
      if(mode==='register')await api('/api/auth/register',{method:'POST',body:JSON.stringify(input)},null);
      const login=await api<LoginResult>('/api/auth/login',{method:'POST',body:JSON.stringify(input)},null);
      const next={...login,expiresAt:Date.now()+login.expiresIn*1000};sessionStorage.setItem('scd-session',JSON.stringify(next));setSession(next);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function start(user: User) {
    const epoch=generation.current;setError('');
    try {
      const conversation=await api<Conversation>('/api/chat/conversations',{method:'POST',body:JSON.stringify({type:'private',participantIds:[session!.user.id,user.id]})});
      if(epoch!==generation.current)return;
      setConversations(previous=>[conversation,...previous.filter(c=>c.id!==conversation.id)]);setSelected(conversation);
    }catch(e){if(epoch===generation.current)setError((e as Error).message);}
  }
  function transmit(input: SendMessage) {
    const epoch=generation.current;
    setPending(previous=>[...previous.filter(p=>p.clientMessageId!==input.clientMessageId),{...input,state:'Enviando…'}]);
    socket.current?.timeout(5000).emit('message:send',input,(timeout: Error | null,result: MessageAck) => {
      if(epoch!==generation.current)return;
      if(!timeout && result?.ok){if(active.current===input.conversationId)merge([result.message]);else setPending(previous=>previous.filter(p=>p.clientMessageId!==input.clientMessageId));}
      else setPending(previous=>previous.map(p=>p.clientMessageId===input.clientMessageId ? {...p,state:timeout ? 'Sem confirmação. Tente novamente.':result && !result.ok ? result.error.message:'Falha no envio.'}:p));
    });
  }
  const title=(c:Conversation)=>c.participantIds.filter(id=>id!==session?.user.id).map(id=>names[id] ?? id).join(', ');
  return <main className="app"><header><div><p>Sistemas Distribuídos · CEFET-MG</p><h1>Chat distribuído</h1></div>{session && <div><span>{session.user.username}</span> <button onClick={logout}>Sair</button></div>}</header>
    {error && <p role="alert">{error}</p>}
    {!session ? <section className="auth"><h2>{mode==='login'?'Entrar':'Criar conta'}</h2><form onSubmit={authenticate}>
      <label>Usuário<input name="username" required pattern="[a-z0-9_]{3,32}" minLength={3} maxLength={32} autoComplete="username" /></label>
      <label>Senha<input name="password" type="password" required minLength={12} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} /></label>
      <p>Usuário: letras minúsculas, números e _. Senha: 12 a 128 caracteres.</p><button disabled={busy}>{busy?'Aguarde…':mode==='login'?'Entrar':'Cadastrar e entrar'}</button>
    </form><button onClick={()=>{setMode(mode==='login'?'register':'login');setError('');}}>{mode==='login'?'Criar conta':'Já tenho conta'}</button></section> : <><p role="status">{connection}</p><div className={'workspace '+(selected?'has-selection':'')}>
      <aside><h2>Conversas</h2><label>Buscar usuário<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome do usuário" /></label><div className="results">{users.map(u=><button key={u.id} onClick={()=>void start(u)}>Conversar com {u.username}</button>)}</div>
      <nav aria-label="Conversas privadas">{conversations.map(c=><button key={c.id} aria-current={selected?.id===c.id?'true':undefined} onClick={()=>setSelected(c)}>{title(c)}</button>)}</nav>{!conversations.length && <p>Nenhuma conversa. Busque uma pessoa para começar.</p>}</aside>
      <section className="conversation">{selected ? <><button className="back" onClick={()=>setSelected(null)}>Voltar às conversas</button><h2>{title(selected)}</h2>{loading && <p role="status">Sincronizando histórico…</p>}
      <ol className="messages" aria-label="Mensagens">{messages.map(m=><li key={m.id} className={m.senderId===session.user.id?'own':''}><strong>{m.senderId===session.user.id?'Você':names[m.senderId]??'Participante'}</strong><p>{m.content}</p><small>{new Date(m.createdAt).toLocaleTimeString('pt-BR')} · Persistida</small></li>)}
      {pending.filter(p=>p.conversationId===selected.id).map(p=><li key={p.clientMessageId} className="own"><p>{p.content}</p><small>{p.state}</small>{p.state!=='Enviando…' && <button onClick={()=>transmit({conversationId:p.conversationId,clientMessageId:p.clientMessageId,content:p.content})}>Reenviar</button>}</li>)}</ol>
      <form className="composer" onSubmit={e=>{e.preventDefault();if(!content.trim())return;transmit({conversationId:selected.id,clientMessageId:crypto.randomUUID(),content});setContent('');}}><label>Mensagem<textarea value={content} onChange={e=>setContent(e.target.value)} maxLength={8000} required /></label><button disabled={!content.trim() || [...content].length>4000 || connection!=='Conectado'}>Enviar</button></form></> : <p>Selecione uma conversa ou procure um usuário.</p>}</section>
    </div></>}
  </main>;
}
