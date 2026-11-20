import express from 'express';
import pg from 'pg';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
const app = express();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000, query_timeout: 2000 });
const pub = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 2000 } });
const sub = pub.duplicate();
for (const client of [pub, sub]) client.on('error', () => console.error('Redis indisponível'));
await Promise.all([pub.connect(), sub.connect()]);
const server = createServer(app);
const io = new Server(server, { transports: ['websocket'], maxHttpBufferSize: 16384 });
io.adapter(createAdapter(pub, sub));
// Nenhuma identidade é aceita até o marco de autenticação.
io.use((_socket, next) => { const error = new Error('Autenticação ainda não implementada.'); Object.assign(error, { data: { code: 'NOT_IMPLEMENTED', requestId: randomUUID() } }); next(error); });
app.get('/health/live', (_req, res) => res.json({ status: 'ok', service: 'chat', instance: hostname() }));
app.get(['/health/ready', '/api/chat/health'], async (_req, res) => {
  try { await pool.query('SELECT 1'); if (!pub.isReady || !sub.isReady) throw new Error(); await pub.ping(); res.json({ status: 'ok', service: 'chat', instance: hostname() }); }
  catch { res.status(503).json({ status: 'unavailable', service: 'chat' }); }
});
app.use((req, res) => res.status(req.path.startsWith('/api/chat/') ? 501 : 404).json({ error: { code: req.path.startsWith('/api/chat/') ? 'NOT_IMPLEMENTED' : 'NOT_FOUND', message: 'Recurso indisponível neste marco.', requestId: randomUUID() } }));
server.listen(3000, '0.0.0.0');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { io.close(() => { void Promise.all([pool.end(), pub.quit(), sub.quit()]).then(() => process.exit(0)); }); });
