import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
const base = process.env.BASE_URL ?? 'http://localhost:8080';
const page = await fetch(base);
assert.equal(page.status, 200);
assert.match(await page.text(), /Chat distribuído/);
for (const service of ['auth', 'chat']) {
  const instances = new Set();
  for (let i = 0; i < 12; i++) {
    const response = await fetch(`${base}/api/${service}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, service);
    instances.add(body.instance);
  }
  assert.equal(instances.size, 2, `Esperadas duas réplicas de ${service}`);
}
for (const path of ['/api/auth/login', '/api/chat/conversations']) {
  const response = await fetch(base + path, { method: 'POST' });
  assert.equal(response.status, 501);
  assert.equal((await response.json()).error.code, 'NOT_IMPLEMENTED');
}
await new Promise((resolve, reject) => {
  const socket = io(base, { transports: ['websocket'], reconnection: false, timeout: 5000 });
  const timer = setTimeout(() => { socket.close(); reject(new Error('Timeout do socket')); }, 7000);
  socket.on('connect', () => { clearTimeout(timer); socket.close(); reject(new Error('Socket não deveria aceitar identidade')); });
  socket.on('connect_error', error => { clearTimeout(timer); socket.close(); try { assert.equal(error.data?.code, 'NOT_IMPLEMENTED'); resolve(); } catch (e) { reject(e); } });
});
console.log('OK: interface, healthchecks, duas réplicas por serviço, HTTP 501 e handshake Socket.IO pelo Traefik.');
