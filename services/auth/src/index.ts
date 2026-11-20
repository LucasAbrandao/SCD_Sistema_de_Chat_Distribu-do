import express from 'express';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
const app = express();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000, query_timeout: 2000 });
app.get('/health/live', (_req, res) => res.json({ status: 'ok', service: 'auth', instance: hostname() }));
app.get(['/health/ready', '/api/auth/health'], async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', service: 'auth', instance: hostname() }); }
  catch { res.status(503).json({ status: 'unavailable', service: 'auth' }); }
});
app.use((req, res) => res.status(req.path.startsWith('/api/auth/') || req.path === '/internal/users/resolve' ? 501 : 404).json({ error: { code: req.path.startsWith('/api/auth/') || req.path === '/internal/users/resolve' ? 'NOT_IMPLEMENTED' : 'NOT_FOUND', message: 'Recurso indisponível neste marco.', requestId: randomUUID() } }));
const server = app.listen(3000, '0.0.0.0');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { void pool.end().then(() => process.exit(0)); }));
