import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {Failure} from './validation.js';
export const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:2000,query_timeout:2000});
export async function insertUser(username:string,hash:string,salt:string){
  try {
    return (await pool.query('INSERT INTO auth.users(id,username,password_hash,password_salt) VALUES($1,$2,$3,$4) RETURNING id,username',[randomUUID(),username,hash,salt])).rows[0];
  }catch(error){if((error as {code?:string}).code==='23505')throw new Failure(409,'CONFLICT','Nome de usuário já utilizado.');throw error;}
}
export async function findCredentials(username:string){
  return (await pool.query('SELECT * FROM auth.users WHERE username=$1',[username])).rows[0];
}
export async function searchUsers(q:string,after:unknown,limit:number){
  const {rows}=await pool.query('SELECT id,username FROM auth.users WHERE starts_with(username,$1) AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[q,after,limit+1]);
  return {items:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1].id:null};
}
export async function resolveUsers(ids:string[]){
  const {rows}=await pool.query('SELECT id,username FROM auth.users WHERE id=ANY($1::uuid[])',[ids]);
  return {users:rows,missingIds:ids.filter(id=>!rows.some(u=>u.id===id))};
}
