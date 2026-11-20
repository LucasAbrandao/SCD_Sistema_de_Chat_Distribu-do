import {test,expect} from '@playwright/test';
test('duas sessões: cadastro, conversa, histórico, offline, saída e celular',async({browser},testInfo)=>{
 const a=await browser.newContext({viewport:{width:1440,height:900}});const b=await browser.newContext({viewport:{width:1440,height:900}});
 const pa=await a.newPage(),pb=await b.newPage();const errors:string[]=[];
 for(const p of [pa,pb])p.on('pageerror',e=>errors.push(e.message));
 const suffix=Date.now().toString();const alice='alice_'+suffix,bob='bob_'+suffix;
 try{
  for(const [p,name] of [[pa,alice],[pb,bob]] as const){await p.goto('/');await p.getByRole('button',{name:'Criar conta',exact:true}).click();await p.getByLabel('Usuário',{exact:true}).fill(name);await p.getByLabel('Senha',{exact:true}).fill('senha ficticia longa');await p.getByRole('button',{name:'Cadastrar e entrar'}).click();await expect(p.getByRole('button',{name:'Sair',exact:true})).toBeVisible();}
  await pa.getByLabel('Buscar usuário').fill(bob);await pa.getByRole('button',{name:'Conversar com '+bob,exact:true}).click();
  await pa.getByLabel('Mensagem',{exact:true}).fill('Olá Bob pelo navegador');await pa.getByRole('button',{name:'Enviar',exact:true}).click();
  await pb.getByRole('navigation',{name:'Conversas privadas'}).getByRole('button').first().click();await expect(pb.getByText('Olá Bob pelo navegador',{exact:true})).toBeVisible();
  await pb.getByLabel('Mensagem',{exact:true}).fill('Olá Alice');await pb.getByRole('button',{name:'Enviar',exact:true}).click();await expect(pa.getByText('Olá Alice',{exact:true})).toBeVisible();
  await pa.reload();await expect(pa.getByRole('button',{name:'Sair',exact:true})).toBeVisible();await pa.getByRole('navigation',{name:'Conversas privadas'}).getByRole('button').first().click();await expect(pa.getByText('Olá Alice',{exact:true})).toBeVisible();
  await b.setOffline(true);await pa.getByLabel('Mensagem',{exact:true}).fill('Recuperada após offline');await pa.getByRole('button',{name:'Enviar',exact:true}).click();await b.setOffline(false);await expect(pb.getByText('Recuperada após offline',{exact:true})).toBeVisible({timeout:15000});await expect(pb.getByText('Recuperada após offline',{exact:true})).toHaveCount(1);
  await pa.screenshot({path:testInfo.outputPath('desktop.png'),fullPage:true});await pa.setViewportSize({width:390,height:844});await expect(pa.getByRole('button',{name:'Voltar às conversas'})).toBeVisible();expect(await pa.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await pa.screenshot({path:testInfo.outputPath('mobile.png'),fullPage:true});
  await pa.getByRole('button',{name:'Sair',exact:true}).click();await expect(pa.getByRole('heading',{name:'Entrar',exact:true})).toBeVisible();expect(errors).toEqual([]);
 }finally{await a.close();await b.close();}
});
