import {request} from './helpers.mjs';
await request('/api/auth/register',{body:{username:'cadastro_fechado',password:'senha ficticia longa'},status:403});
console.log('OK: cadastro desabilitado rejeitado com 403.');
