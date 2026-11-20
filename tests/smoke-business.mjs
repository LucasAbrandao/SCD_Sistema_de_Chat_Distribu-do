import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {base,account,request,connect,send} from './helpers.mjs';
const response=await fetch(base);assert.equal(response.status,200);assert.match(await response.text(),/Chat distribuído/);
for(const service of ['auth','chat']){
 const instances=new Set();for(let i=0;i<12;i++){const health=await request('/api/'+service+'/health');assert.equal(health.status,'ok');instances.add(health.instance);}assert.equal(instances.size,2);
}
const [a,b]=await Promise.all([account(),account()]);
const conversation=await request('/api/chat/conversations',{token:a.accessToken,body:{type:'private',participantIds:[a.id,b.id]},status:201});
const client=await connect(a.accessToken);
try{const result=await send(client,{conversationId:conversation.id,clientMessageId:randomUUID(),content:'Smoke: persistência e socket autenticado'});assert.ok(result.ok);const history=await request(`/api/chat/conversations/${conversation.id}/messages`,{token:b.accessToken});assert.equal(history.items[0].id,result.message.id);}finally{client.close();}
console.log('OK: interface, duas réplicas por serviço, cadastro/login, conversa, socket autenticado e histórico.');
