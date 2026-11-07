import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { createHmac } from 'node:crypto';
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
const adminSessionSecret = randomBytes(32).toString('hex');
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
      GYVORA_ADMIN_SESSION_SECRET: adminSessionSecret,
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

function adminToken() {
  const expires = Math.floor(Date.now() / 1000) + 300;
  const signature = createHmac('sha256', adminSessionSecret)
    .update(`gyvora-admin:${expires}`)
    .digest('base64url');
  return `${expires}.${signature}`;
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

test('administrator can edit, freeze, unfreeze, and ban a local client with notices', async () => {
  const headers = {
    authorization: `Bearer ${adminToken()}`,
    'content-type': 'application/json',
    origin: frontendOrigin,
  };
  const users = await fetch(`http://127.0.0.1:${port}/api/admin/users`, { headers });
  assert.equal(users.status, 200);
  const account = (await users.json()).users.find(user => user.id === registeredUserId);
  assert.equal(account.status, 'active');

  const edit = await fetch(`http://127.0.0.1:${port}/api/admin/users/${registeredUserId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name: 'Updated Client', phone, email: `updated-${email}` }),
  });
  assert.equal(edit.status, 200);

  const freeze = await fetch(`http://127.0.0.1:${port}/api/admin/users/${registeredUserId}/lifecycle`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'freeze', note: 'Fictional freeze reason', message: 'Please contact the gym.' }),
  });
  assert.equal(freeze.status, 200);
  assert.equal((await freeze.json()).status, 'frozen');
  const frozenLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: frontendOrigin },
    body: JSON.stringify({ contact: phone, password }),
  });
  assert.equal(frozenLogin.status, 403);
  const frozenError = (await frozenLogin.json()).error;
  assert.match(frozenError, /Fictional freeze reason/);
  assert.match(frozenError, /Please contact the gym/);

  const unfreeze = await fetch(`http://127.0.0.1:${port}/api/admin/users/${registeredUserId}/lifecycle`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'unfreeze', note: '', message: '' }),
  });
  assert.equal(unfreeze.status, 200);
  assert.equal((await unfreeze.json()).status, 'active');

  const remove = await fetch(`http://127.0.0.1:${port}/api/admin/users/${registeredUserId}/lifecycle`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'delete', note: 'Fictional ban reason', message: 'Your account is closed.' }),
  });
  assert.equal(remove.status, 200);
  assert.equal((await remove.json()).status, 'deleted');
  const bannedLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: frontendOrigin },
    body: JSON.stringify({ contact: phone, password }),
  });
  assert.equal(bannedLogin.status, 403);
  const bannedError = (await bannedLogin.json()).error;
  assert.match(bannedError, /Fictional ban reason/);
  assert.match(bannedError, /Your account is closed/);
});
