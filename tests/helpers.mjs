import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';
export const base=process.env.BASE_URL??'http://localhost:8080';
export async function request(path,{token,body,method=body?'POST':'GET',status=200}={}){
 const response=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;
}
export async function account(){
 const username='u_'+randomUUID().replaceAll('-','').slice(0,20);const password='senha ficticia de teste';
 const user=await request('/api/auth/register',{body:{username,password},status:201});
 const login=await request('/api/auth/login',{body:{username,password}});return {...login,username,password,id:user.id};
}
export function connect(token){return new Promise((resolve,reject)=>{
 const client=io(base,{transports:['websocket'],auth:{token},reconnection:false,timeout:5000});
 client.once('connect',()=>resolve(client));client.once('connect_error',error=>{client.close();reject(error);});
});}
export function send(socket,input){return new Promise((resolve,reject)=>socket.timeout(5000).emit('message:send',input,(e,result)=>e?reject(e):resolve(result)));}
