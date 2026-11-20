import express from 'express';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { importSPKI, jwtVerify } from 'jose';
import { Failure, ensure, uuid, sendInput, failureBody, pagination } from './domain.js';
import { pool, createPrivate, requireMember, persistMessage, messageColumns, conversationColumns } from './repository.js';
import { deliver } from './delivery.js';
const app = express();
const key = await importSPKI(await readFile(process.env.JWT_PUBLIC_KEY_FILE!, 'utf8'), 'RS256');
async function authenticate(token: unknown) {
  try {
    if (typeof token !== 'string') throw new Error();
    const {payload} = await jwtVerify(token, key, {algorithms: ['RS256'], issuer: process.env.JWT_ISSUER ?? 'scd-auth', audience: process.env.JWT_AUDIENCE ?? 'scd-chat', requiredClaims: ['sub','iat','exp']});
    if (!uuid(payload.sub) || typeof payload.exp !== 'number') throw new Error();
    return {id: payload.sub, exp: payload.exp};
  } catch { throw new Failure(401, 'UNAUTHENTICATED', 'Autenticação necessária.'); }
}
const pub = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 2000 } });
const sub = pub.duplicate();
for (const client of [pub, sub]) client.on('error', () => console.error('Redis indisponível'));
await Promise.all([pub.connect(), sub.connect()]);
const server = createServer(app);
const io = new Server(server, { transports: ['websocket'], maxHttpBufferSize: 65536 });
io.adapter(createAdapter(pub, sub));
io.use(async (socket, next) => {
  try { socket.data.identity = await authenticate(socket.handshake.auth?.token); next(); }
  catch (e) { const data = failureBody(e).error; next(Object.assign(new Error(data.message), {data})); }
});
io.on('connection', socket => {
  const {id, exp} = socket.data.identity as {id: string; exp: number};
  void socket.join('user:' + id);
  const expire = () => { socket.emit('auth:expired'); socket.disconnect(true); };
  const timer = setTimeout(expire, Math.max(0, exp * 1000 - Date.now()));
  socket.on('disconnect', () => clearTimeout(timer));
  socket.on('message:send', async (raw, ack) => {
    if (typeof ack !== 'function') return;
    try {
      if (Date.now() >= exp * 1000) { expire(); throw new Failure(401,'UNAUTHENTICATED','Sessão expirada.'); }
      const input = sendInput(raw);
      await requireMember(input.conversationId, id);
      const message = await deliver(() => persistMessage(id, input), result => {
        io.to(result.participants!.map(user => 'user:' + user)).emit('message:new', result.message);
      });
      ack({ok: true, message});
    } catch (e) { ack({ok: false, error: failureBody(e).error}); }
  });
});
app.use(express.json({limit: '16kb'}));
app.get('/health/live', (_req,res) => res.json({status:'ok',service:'chat',instance:hostname()}));
app.get(['/health/ready','/api/chat/health'], async (_req,res) => {
  try { await pool.query('SELECT 1'); if (!pub.isReady || !sub.isReady) throw new Error(); await pub.ping(); res.json({status:'ok',service:'chat',instance:hostname()}); }
  catch { res.status(503).json({status:'unavailable',service:'chat'}); }
});
app.use('/api/chat', async (req,res,next) => {
  try { res.locals.identity = await authenticate(req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]); next(); } catch(e) { next(e); }
});
app.post('/api/chat/conversations', async (req,res) => {
  const b = req.body;
  ensure(b && typeof b === 'object' && !Array.isArray(b) && Object.keys(b).every(k => ['type','name','participantIds'].includes(k)));
  ensure(b.type === 'private' || b.type === 'group');
  const ids = b.participantIds;
  ensure(Array.isArray(ids) && ids.every(uuid) && new Set(ids).size === ids.length && ids.includes(res.locals.identity.id));
  if (b.type === 'group') {
    ensure(ids.length >= 2 && ids.length <= 100 && typeof b.name === 'string' && b.name.trim().length > 0 && [...b.name.trim()].length <= 100);
    throw new Failure(501,'NOT_IMPLEMENTED','Grupos pertencem ao próximo marco.');
  }
  ensure(ids.length === 2 && b.name === undefined);
  let response: Response;
  try { response = await fetch(process.env.AUTH_INTERNAL_URL + '/internal/users/resolve', {method:'POST', headers:{'content-type':'application/json',authorization:req.headers.authorization!}, body:JSON.stringify({ids}), signal:AbortSignal.timeout(2000)}); }
  catch { throw new Failure(503,'DEPENDENCY_UNAVAILABLE','Auth indisponível.'); }
  if (!response.ok) throw new Failure(503,'DEPENDENCY_UNAVAILABLE','Auth indisponível.');
  const resolved = await response.json() as {missingIds:string[]};
  ensure(resolved.missingIds.length === 0, 'Participante inexistente.');
  const result = await createPrivate(ids);
  res.status(result.created ? 201 : 200).json(result.conversation);
});
app.get('/api/chat/conversations', async (req,res) => {
  const {limit,after} = pagination(req.query);
  const {rows} = await pool.query(`SELECT ${conversationColumns} FROM chat.conversations c JOIN chat.participants p ON p.conversation_id=c.id WHERE p.user_id=$1 AND ($2::uuid IS NULL OR c.id>$2) ORDER BY c.id LIMIT $3`, [res.locals.identity.id,after,limit+1]);
  res.json({items:rows.slice(0,limit),nextCursor:rows.length>limit ? rows[limit-1].id : null});
});
app.get('/api/chat/conversations/:id/messages', async (req,res) => {
  ensure(uuid(req.params.id));
  const {limit,after} = pagination(req.query,true);
  await requireMember(req.params.id,res.locals.identity.id);
  const {rows} = await pool.query(`SELECT ${messageColumns} FROM chat.messages WHERE conversation_id=$1 AND position>$2 ORDER BY chat.messages.position LIMIT $3`,[req.params.id,after,limit+1]);
  res.json({items:rows.slice(0,limit),nextCursor:rows.length>limit ? rows[limit-1].position : null});
});
app.use((_req,_res,next) => next(new Failure(404,'NOT_FOUND','Recurso inexistente.')));
app.use((error: unknown,_req:express.Request,res:express.Response,_next:express.NextFunction) => {
  const type = (error as {type?: string}).type;
  const f = failureBody(type === 'entity.parse.failed' || type === 'entity.too.large' ? new Failure(400,'VALIDATION_ERROR','JSON inválido ou corpo acima do limite.') : error);
  res.status(f.status).json({error:f.error});
});
server.listen(3000,'0.0.0.0');
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => io.close(() => { void Promise.all([pool.end(),pub.quit(),sub.quit()]).then(() => process.exit(0)); }));
