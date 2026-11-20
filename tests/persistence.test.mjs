import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool,createPrivate,persistMessage} from '../services/chat/dist/repository.js';
import {deliver} from '../services/chat/dist/delivery.js';
test('rollback antes de commit; publicação falha após commit e histórico permanece',async()=>{
 try{
  const a=randomUUID(),b=randomUUID();const {conversation}=await createPrivate([a,b]);
  const input={conversationId:conversation.id,clientMessageId:randomUUID(),content:'persistência transacional'};
  const connect=pool.connect.bind(pool);
  pool.connect=async()=>{
   pool.connect=connect;const client=await connect();const query=client.query.bind(client);
   client.query=(...args)=>{
    if(String(args[0]).startsWith('INSERT INTO chat.messages')){client.query=query;throw new Error('Falha de gravação injetada pelo teste');}
    return query(...args);
   };return client;
  };
  await assert.rejects(()=>persistMessage(a,input),/injetada/);
  assert.equal((await pool.query('SELECT position::text FROM chat.conversations WHERE id=$1',[conversation.id])).rows[0].position,'0');
  assert.equal((await pool.query('SELECT id FROM chat.messages WHERE conversation_id=$1',[conversation.id])).rowCount,0);
  let reported=false;
  const message=await deliver(()=>persistMessage(a,input),()=>{throw new Error('Publicação indisponível');},()=>{reported=true;});
  assert.ok(reported);assert.equal(message.position,'1');
  assert.equal((await pool.query('SELECT id FROM chat.messages WHERE conversation_id=$1',[conversation.id])).rows[0].id,message.id);
 }finally{await pool.end();}
});
