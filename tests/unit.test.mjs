import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import { hashPassword, checkPassword, signToken, verifyToken } from '../services/auth/dist/security.js';
import { credentials } from '../services/auth/dist/validation.js';
import { sendInput, pagination, failureBody } from '../services/chat/dist/domain.js';
test('erros públicos distinguem dependência e falha interna sem expor detalhes',()=>{
 assert.equal(failureBody(Object.assign(new Error('credenciais secretas'),{code:'ECONNREFUSED'})).status,503);
 const failure=failureBody(new Error('SQL e dados internos'));assert.equal(failure.status,500);assert.equal(failure.error.message,'Falha inesperada.');
});
test('senhas: salt aleatório, verificação e ausência de normalização',async()=>{
 const a=await hashPassword('senha longa de teste');const b=await hashPassword('senha longa de teste');
 assert.notEqual(a.salt,b.salt);assert.notEqual(a.hash,b.hash);
 assert.equal(await checkPassword('senha longa de teste',a.salt,a.hash),true);
 assert.equal(await checkPassword('senha longa de teste ',a.salt,a.hash),false);
});
test('credenciais rejeitam campos extras e formatos inválidos',()=>{
 for(const body of [{username:'ABC',password:'abcdefghijkl'},{username:'ana',password:'curta'},{username:'ana',password:'abcdefghijkl',admin:true},null])assert.throws(()=>credentials(body));
 assert.equal(credentials({username:'ana',password:'abcdefghijkl'}).username,'ana');
});
test('mensagens preservam conteúdo Unicode e rejeitam adulteração',()=>{
 const input={conversationId:randomUUID(),clientMessageId:randomUUID(),content:'  Olá 🌎  '};assert.equal(sendInput(input).content,input.content);
 for(const content of ['','   ','x'.repeat(4001)])assert.throws(()=>sendInput({...input,content}));
 assert.throws(()=>sendInput({...input,senderId:randomUUID()}));assert.throws(()=>sendInput({...input,conversationId:'x'}));
 assert.throws(()=>pagination({after:'-1'},true));assert.throws(()=>pagination({limit:101}));
});
test('JWT valida assinatura, audiência, emissor e expiração',async()=>{
 const pair=await generateKeyPair('RS256');const other=await generateKeyPair('RS256');const id=randomUUID();
 assert.equal((await verifyToken(await signToken(id,pair.privateKey),pair.publicKey)).sub,id);
 await assert.rejects(()=>verifyToken('inválido',pair.publicKey));
 for(const claims of [{iss:'outro',aud:'scd-chat',exp:Math.floor(Date.now()/1000)+60},{iss:'scd-auth',aud:'outro',exp:Math.floor(Date.now()/1000)+60},{iss:'scd-auth',aud:'scd-chat',exp:1}]){
   const token=await new SignJWT(claims).setSubject(id).setIssuedAt().setProtectedHeader({alg:'RS256'}).sign(pair.privateKey);
   await assert.rejects(()=>verifyToken(token,pair.publicKey));
 }
 const token=await signToken(id,other.privateKey);await assert.rejects(()=>verifyToken(token,pair.publicKey));
});
