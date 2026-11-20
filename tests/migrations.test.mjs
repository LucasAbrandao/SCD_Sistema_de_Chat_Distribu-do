import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import pg from 'pg';
test('migrações repetidas/concorrentes, checksum e rollback',async()=>{
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 const file='services/auth/migrations/002_users.sql';const original=readFileSync(file,'utf8');
 const temporary='services/auth/migrations/999_test_fail.sql';
 const run=()=>spawnSync('node',['scripts/migrate.mjs'],{encoding:'utf8'});
 try{
  const before=await pool.query('SELECT version,checksum FROM auth.schema_migrations ORDER BY version');assert.equal(run().status,0);
  await Promise.all([0,1].map(()=>new Promise((resolve,reject)=>{const p=spawn('node',['scripts/migrate.mjs'],{stdio:'ignore'});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error('Migração concorrente falhou')));})));
  assert.deepEqual((await pool.query('SELECT version,checksum FROM auth.schema_migrations ORDER BY version')).rows,before.rows);
  writeFileSync(file,original+'\n-- alteração proibida\n');const mismatch=run();assert.notEqual(mismatch.status,0);assert.match(mismatch.stderr,/Migração alterada/);writeFileSync(file,original);
  writeFileSync(temporary,'CREATE TABLE auth.rollback_probe(id integer); SELECT * FROM auth.tabela_inexistente_de_teste;');assert.notEqual(run().status,0);
  assert.equal((await pool.query("SELECT to_regclass('auth.rollback_probe') AS table_name")).rows[0].table_name,null);
  assert.equal((await pool.query("SELECT version FROM auth.schema_migrations WHERE version='999_test_fail.sql'")).rowCount,0);
 }finally{writeFileSync(file,original);try{unlinkSync(temporary);}catch{}await pool.end();}
});
