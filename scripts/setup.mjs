import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes, generateKeyPairSync } from 'node:crypto';
if (!existsSync('.env')) writeFileSync('.env', readFileSync('.env.example', 'utf8').replace('POSTGRES_PASSWORD=', `POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}`));
mkdirSync('secrets', { recursive: true });
if (!existsSync('secrets/jwt-private.pem') && !existsSync('secrets/jwt-public.pem')) {
  const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  writeFileSync('secrets/jwt-private.pem', keys.privateKey, { mode: 0o600 });
  writeFileSync('secrets/jwt-public.pem', keys.publicKey);
}
if (!existsSync('secrets/jwt-private.pem') || !existsSync('secrets/jwt-public.pem')) throw new Error('Par de chaves incompleto: restaurar o arquivo ausente.');
console.log('Configuração local pronta; arquivos existentes preservados.');
