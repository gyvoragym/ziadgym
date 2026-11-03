import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const serverRoot = fileURLToPath(new URL('..', import.meta.url));
const serverEntry = join(serverRoot, 'dist', 'server.js');
const directory = mkdtempSync(join(tmpdir(), 'gyvora-api-test-'));
const databasePath = join(directory, 'gyvora.sqlite');
const frontendOrigin = 'https://frontend.example.test';
const sessionSecret = randomBytes(32).toString('hex');
let port;
let api;
let stderr = '';

async function findAvailablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a test port.');
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function startApi() {
  stderr = '';
  api = spawn(process.execPath, [serverEntry], {
    cwd: serverRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      DATABASE_PATH: databasePath,
      SESSION_SECRET: sessionSecret,
      FRONTEND_ORIGIN: frontendOrigin,
      COOKIE_SAME_SITE: 'none',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  api.stderr.setEncoding('utf8');
  api.stderr.on('data', chunk => { stderr += chunk; });

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (api.exitCode !== null) throw new Error(`API exited during startup: ${stderr}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error(`API did not become healthy: ${stderr}`);
}

async function stopApi() {
  if (!api || api.exitCode !== null) return;
  const exited = once(api, 'exit');
  api.kill();
  await exited;
}

let sessionCookie;
let registeredUserId;
const phone = `010${String(Date.now()).slice(-8)}`;
const password = 'integration-test-password';
const email = `test-${randomUUID()}@example.test`;

before(async () => {
  port = await findAvailablePort();
  await startApi();
});

after(async () => {
  await stopApi();
  rmSync(directory, { recursive: true, force: true });
});

test('health endpoint and credentialed CORS use the configured frontend origin', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
    headers: { origin: frontendOrigin },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get('access-control-allow-origin'), frontendOrigin);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
});

test('registration, login, persistent session, and logout work across an API restart', async () => {
  const registration = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: frontendOrigin },
    body: JSON.stringify({
      fullName: 'Integration Test User',
      phone,
      email,
      password,
      accountType: 'individual',
    }),
  });
  assert.equal(registration.status, 201);
  registeredUserId = (await registration.json()).user.id;

  const invalidLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: frontendOrigin },
    body: JSON.stringify({ contact: phone, password: 'incorrect-password' }),
  });
  assert.equal(invalidLogin.status, 401);

  const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: frontendOrigin },
    body: JSON.stringify({ contact: phone, password }),
  });
  assert.equal(login.status, 200);
  sessionCookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(sessionCookie);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(login.headers.get('set-cookie'), /Secure/i);
  assert.match(login.headers.get('set-cookie'), /SameSite=None/i);

  await stopApi();
  await startApi();

  const session = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: { cookie: sessionCookie, origin: frontendOrigin },
  });
  assert.equal(session.status, 200);
  assert.equal((await session.json()).user.id, registeredUserId);

  const emailLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: frontendOrigin },
    body: JSON.stringify({ contact: email, password }),
  });
  assert.equal(emailLogin.status, 200);
  const emailSessionCookie = emailLogin.headers.get('set-cookie')?.split(';')[0];
  assert.ok(emailSessionCookie);

  const logout = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
    method: 'POST',
    headers: { cookie: sessionCookie, origin: frontendOrigin },
  });
  assert.equal(logout.status, 200);
  const emailLogout = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
    method: 'POST',
    headers: { cookie: emailSessionCookie, origin: frontendOrigin },
  });
  assert.equal(emailLogout.status, 200);

  const expiredSession = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: { cookie: sessionCookie, origin: frontendOrigin },
  });
  assert.equal(expiredSession.status, 401);
});
