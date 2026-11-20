import express from 'express';
import { randomUUID, createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { importPKCS8, importSPKI } from 'jose';
import { hashPassword, checkPassword, signToken, verifyToken } from './security.js';
import { Failure, ensure, credentials, pagination, uuid } from './validation.js';
import {pool,insertUser,findCredentials,searchUsers,resolveUsers} from './repository.js';
const app = express();
const pem = await readFile(process.env.JWT_PRIVATE_KEY_FILE!, 'utf8');
const privateKey = await importPKCS8(pem, 'RS256');
const publicKey = await importSPKI(createPublicKey(pem).export({ type: 'spki', format: 'pem' }).toString(), 'RS256');
app.use(express.json({ limit: '16kb' }));
app.get('/health/live', (_req, res) => res.json({ status: 'ok', service: 'auth', instance: hostname() }));
app.get(['/health/ready', '/api/auth/health'], async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', service: 'auth', instance: hostname() }); }
  catch { res.status(503).json({ status: 'unavailable', service: 'auth' }); }
});
app.post('/api/auth/register', async (req, res) => {
  if (process.env.REGISTRATION_ENABLED !== 'true') throw new Failure(403, 'FORBIDDEN', 'Cadastro desabilitado.');
  const {username, password} = credentials(req.body);
  const secret = await hashPassword(password);
  res.status(201).json(await insertUser(username,secret.hash,secret.salt));
});
app.post('/api/auth/login', async (req, res) => {
  const {username, password} = credentials(req.body);
  const user = await findCredentials(username);
  // scrypt também é executado para usuários inexistentes.
  const valid = await checkPassword(password, user?.password_salt ?? '00000000000000000000000000000000', user?.password_hash ?? '00'.repeat(64));
  if (!user || !valid) throw new Failure(401, 'UNAUTHENTICATED', 'Credenciais incorretas.');
  res.json({ accessToken: await signToken(user.id, privateKey), tokenType: 'Bearer', expiresIn: 3600, user: {id: user.id, username: user.username} });
});
app.use(async (req, res, next) => {
  if (!['/api/auth/users', '/internal/users/resolve'].includes(req.path)) return next();
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new Error();
    const payload = await verifyToken(token, publicKey);
    if (!uuid(payload.sub)) throw new Error();
    res.locals.userId = payload.sub;
    next();
  } catch { next(new Failure(401, 'UNAUTHENTICATED', 'Autenticação necessária.')); }
});
app.get('/api/auth/users', async (req, res) => {
  ensure(Object.keys(req.query).every(k => ['q','limit','after'].includes(k)));
  const {limit, after} = pagination(req.query);
  const q = req.query.q ?? '';
  ensure(typeof q === 'string' && /^[a-z0-9_]{0,32}$/.test(q));
  res.json(await searchUsers(q,after,limit));
});
app.post('/internal/users/resolve', async (req, res) => {
  ensure(req.body && Object.keys(req.body).length === 1 && Array.isArray(req.body.ids));
  const ids = req.body.ids;
  ensure(ids.length >= 1 && ids.length <= 100 && ids.every(uuid) && new Set(ids).size === ids.length);
  res.json(await resolveUsers(ids));
});
app.use((_req, _res, next) => next(new Failure(404, 'NOT_FOUND', 'Recurso inexistente.')));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const e = error as {type?: string; code?: string; message?: string};
  const dependency = /^(08|53|57|ECONN|ETIMEDOUT|ENOTFOUND)/.test(e.code ?? '') || /timeout|connection terminated/i.test(e.message ?? '');
  const failure = error instanceof Failure ? error : e.type === 'entity.parse.failed' || e.type === 'entity.too.large' ? new Failure(400, 'VALIDATION_ERROR', 'JSON inválido ou corpo acima do limite.') : dependency ? new Failure(503, 'DEPENDENCY_UNAVAILABLE', 'Serviço temporariamente indisponível.') : new Failure(500, 'INTERNAL_ERROR', 'Falha inesperada.');
  res.status(failure.status).json({error: {code: failure.code, message: failure.message, requestId: randomUUID()}});
});
const server = app.listen(3000, '0.0.0.0');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { void pool.end().then(() => process.exit(0)); }));
