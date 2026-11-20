import { mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,dirname } from 'node:path';
import { execFileSync,spawnSync } from 'node:child_process';
const kind=process.argv[2]??'integration';
const root=process.cwd();const temp=mkdtempSync(join(tmpdir(),'scd-test-'));const source=join(temp,'source');
const run=(command,args,cwd=source,env=process.env)=>{
 console.log('Executando: '+command+' '+args.join(' '));
 const result=spawnSync('rtk',['proxy',command,...args],{cwd,env,encoding:'utf8',maxBuffer:16*1024*1024});
 const output=(result.stdout??'')+(result.stderr??'');appendFileSync(join(temp,'execution.log'),output);
 if(result.status!==0){console.error(output);throw new Error('Comando falhou; log: '+join(temp,'execution.log'));}
 console.log(output.split('\n').slice(-12).join('\n'));
};
const files=execFileSync('rtk',['proxy','git','ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
for(const file of new Set(files)){const target=join(source,file);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,file),target);}
run('npm',['ci']);run('npm',['run','setup']);
const project='scdtest'+Date.now();const port=process.env.TEST_PORT??'8082';
writeFileSync(join(source,'.env'),readFileSync(join(source,'.env'),'utf8').replace('COMPOSE_PROJECT_NAME=scd','COMPOSE_PROJECT_NAME='+project).replace('PORT=8080','PORT='+port));
const docker=process.platform==='win32'?'wsl':'docker';const prefix=process.platform==='win32'?['-u','root','--','docker']:[];
const env={...process.env,BASE_URL:'http://localhost:'+port,TEST_PRIVATE_KEY_PATH:join(source,'secrets/jwt-private.pem')};
try{
 run(docker,[...prefix,'compose','up','--build','-d','--wait','--wait-timeout','180']);
 run(docker,[...prefix,'compose','run','--rm','migrate']);
 if(kind==='e2e')run('npx',['playwright','test'],source,env);
 else {
  run('node',['--test','tests/integration.test.mjs'],source,env);
  run(docker,[...prefix,'compose','exec','-T','chat-1','node','--test','tests/persistence.test.mjs']);
  run(docker,[...prefix,'compose','exec','-T','chat-1','node','--test','tests/migrations.test.mjs']);
  run('node',['tests/restart.mjs','before'],source,env);
  run(docker,[...prefix,'compose','down']);
  run(docker,[...prefix,'compose','up','-d','--wait','--wait-timeout','180']);
  run('node',['tests/restart.mjs','after'],source,env);
  const config=readFileSync(join(source,'.env'),'utf8');
  writeFileSync(join(source,'.env'),config.replace('REGISTRATION_ENABLED=true','REGISTRATION_ENABLED=false'));
  run(docker,[...prefix,'compose','up','-d','--wait','--wait-timeout','180','auth-1','auth-2']);
  run('node',['tests/registration-disabled.mjs'],source,env);
  writeFileSync(join(source,'.env'),config);
 }
}finally{
 run(docker,[...prefix,'compose','down']);
 console.log('Snapshot e evidências: '+source+'; volume preservado: '+project+'_postgres-data');
}
