import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {account,request,connect,send} from './helpers.mjs';
const file='test-results/restart.json';
if(process.argv[2]==='before'){
 const [a,b]=await Promise.all([account(),account()]);
 const c=await request('/api/chat/conversations',{token:a.accessToken,body:{type:'private',participantIds:[a.id,b.id]},status:201});
 const socket=await connect(a.accessToken);
 try{
  const result=await send(socket,{conversationId:c.id,clientMessageId:randomUUID(),content:'Persistência após reinício completo'});assert.ok(result.ok);
  mkdirSync('test-results',{recursive:true});writeFileSync(file,JSON.stringify({username:a.username,password:a.password,conversation:c.id,message:result.message.id}),{mode:0o600});
 }finally{socket.close();}
}else{
 const data=JSON.parse(readFileSync(file,'utf8'));const login=await request('/api/auth/login',{body:{username:data.username,password:data.password}});
 const history=await request(`/api/chat/conversations/${data.conversation}/messages`,{token:login.accessToken});assert.equal(history.items[0].id,data.message);
}
console.log('OK: etapa de persistência '+process.argv[2]);
