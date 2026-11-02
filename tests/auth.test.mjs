import assert from 'node:assert/strict';
import { createHmac, scryptSync } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import test from 'node:test';
import { authorizePaie, authorizeRequest, getSession, issueToken } from '../netlify/functions/lib/auth.ts';
import login from '../netlify/functions/auth.mts';

const email = 'reader@example.com';
const password = 'test-reader-password';
const payrollEmail = 'paie@example.com';
const payrollPassword = 'test-payroll-password';
const env = new Map([
  ['PAYROLL_EMAIL', payrollEmail],
  ['PAYROLL_PASSWORD_HASH', `paie-salt:${scryptSync(payrollPassword, 'paie-salt', 64).toString('hex')}`],
  ['APP_SECRET', 'test-signing-secret'],
  ['APP_PASSWORD', 'test-admin-password'],
  ['READ_ONLY_EMAIL', email],
  ['READ_ONLY_PASSWORD_HASH', `test-salt:${scryptSync(password, 'test-salt', 64).toString('hex')}`],
]);
globalThis.Netlify = { env: { get: key => env.get(key) } };
const request = (method, token) => new Request('https://example.com/api/test', {
  method,
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});
const loginRequest = data => new Request('https://example.com/api/auth', {
  method: 'POST', body: JSON.stringify(data),
});

test('team login stays compatible; empty or missing credentials fail closed', async () => {
  const res = await login(loginRequest({ password: 'test-admin-password' }));
  assert.equal(res.status, 200);
  const { token } = await res.json();
  assert.equal(getSession(request('GET', token)).role, 'admin');
  for (const data of [{}, { password: '' }, { password: null }, { password: 123 }]) {
    assert.equal((await login(loginRequest(data))).status, 400);
  }
  env.delete('APP_PASSWORD');
  assert.equal((await login(loginRequest({ password: 'anything' }))).status, 401);
  env.set('APP_PASSWORD', 'test-admin-password');
});

test('guest login binds the configured email to a separate password and reader role', async () => {
  const res = await login(loginRequest({ email: ' READER@EXAMPLE.COM ', password }));
  assert.equal(res.status, 200);
  const { token } = await res.json();
  assert.equal(getSession(request('GET', token)).role, 'reader');
  for (const data of [
    { email, password: 'wrong' },
    { email: 'other@example.com', password },
    { email, password: 'test-admin-password' },
    { password },
  ]) assert.equal((await login(loginRequest(data))).status, 401);
  assert.equal(authorizeRequest(request('GET', token)), null);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(authorizeRequest(request(method, token)).status, 403);
  }
  env.delete('READ_ONLY_EMAIL');
  assert.equal(getSession(request('GET', token)), null);
  env.set('READ_ONLY_EMAIL', email);
});

test('tampered, expired, unknown-role and unsigned tokens are rejected; legacy admin sessions work', () => {
  const reader = issueToken(undefined, 'reader', email);
  const changed = btoa(JSON.stringify({ authenticated: true, exp: Date.now() + 10000, role: 'admin' }));
  assert.equal(getSession(request('GET', `${changed}.${reader.split('.')[1]}`)), null);
  assert.equal(getSession(request('GET', issueToken(-1))), null);
  assert.equal(getSession(request('GET', issueToken(undefined, 'unknown'))), null);
  assert.equal(getSession(request('GET', `${reader}.extra`)), null);
  assert.equal(authorizeRequest(request('GET')).status, 401);
  const payload = btoa(JSON.stringify({ authenticated: true, exp: Date.now() + 10000 }));
  const sig = createHmac('sha256', env.get('APP_SECRET')).update(payload).digest('base64url');
  assert.equal(getSession(request('GET', `${payload}.${sig}`)).role, 'admin');
  assert.equal(authorizeRequest(request('DELETE', `${payload}.${sig}`)), null);
});

test('every API endpoint rejects guest writes before touching the database, OCR or blobs', async () => {
  const token = issueToken(undefined, 'reader', email);
  const files = (await readdir(new URL('../netlify/functions/', import.meta.url)))
    .filter(file => file.endsWith('.mts') && file !== 'auth.mts');
  for (const file of files) {
    const { default: handler } = await import(`../netlify/functions/${file}`);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await handler(request(method, token));
      assert.equal(res.status, 403, `${file} ${method}`);
    }
    assert.equal((await handler(request('POST'))).status, 401, file);
  }
});

test('payroll is open to the payroll role, read-only for the accountant and closed to the team', async () => {
  const res = await login(loginRequest({ email: ' Paie@Example.com ', password: payrollPassword }));
  assert.equal(res.status, 200);
  const { token } = await res.json();
  assert.equal(getSession(request('GET', token)).role, 'paie');
  assert.equal((await login(loginRequest({ email: payrollEmail, password }))).status, 401);
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    assert.equal(authorizePaie(request(method, token)).denied, null, method);
    assert.equal(authorizeRequest(request(method, token)), null, method);
  }
  const reader = issueToken(undefined, 'reader', email);
  assert.equal(authorizePaie(request('GET', reader)).denied, null);
  assert.equal(authorizePaie(request('POST', reader)).denied.status, 403);
  const team = issueToken();
  assert.equal(authorizePaie(request('GET', team)).denied.status, 403);
  assert.equal(authorizePaie(request('GET')).denied.status, 401);
  const forged = issueToken(undefined, 'paie', 'autre@example.com');
  assert.equal(getSession(request('GET', forged)), null);
  env.delete('PAYROLL_EMAIL');
  assert.equal(getSession(request('GET', token)), null);
  env.set('PAYROLL_EMAIL', payrollEmail);
});

test('payroll endpoints reject the shared team session before touching storage', async () => {
  const team = issueToken();
  const files = (await readdir(new URL('../netlify/functions/', import.meta.url)))
    .filter(file => file.startsWith('paie') && file.endsWith('.mts'));
  assert.ok(files.length >= 6);
  for (const file of files) {
    const { default: handler } = await import(`../netlify/functions/${file}`);
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
      assert.equal((await handler(request(method, team))).status, 403, `${file} ${method}`);
    }
  }
});
