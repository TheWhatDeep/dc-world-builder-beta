// Phase 1 smoke test: migration, bootstrap, auth, world CRUD, per-user isolation, CSRF.
// Uses a throwaway temp DB so it never touches real data. Run: node --test test/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-test-'));
process.env.CODEX_DATA_DIR = tmp;
process.env.CODEX_DB = path.join(tmp, 'test.db');
process.env.CODEX_ASSETS_DIR = path.join(tmp, 'assets');
process.env.CODEX_REGISTRATION_MODE = 'closed';
process.env.CODEX_FRONTEND_DIR = tmp; // no index.html here, so static is skipped

const { migrate } = await import('../src/db/index.js');
const { buildApp } = await import('../src/server.js');

migrate();
let app;
const HDR = { 'x-codex-client': '1', 'content-type': 'application/json' };

before(async () => { app = await buildApp(); });
after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

function cookieFrom(res) {
  const sc = res.headers['set-cookie'];
  const raw = Array.isArray(sc) ? sc[0] : sc;
  return raw.split(';')[0];
}

test('config reports needsBootstrap before any users', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/auth/config' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.needsBootstrap, true);
  assert.equal(body.registrationMode, 'closed');
});

test('first register becomes admin; closed mode blocks the second', async () => {
  const r1 = await app.inject({ method: 'POST', url: '/api/auth/register', headers: HDR,
    payload: { email: 'admin@x.io', password: 'supersecret' } });
  assert.equal(r1.statusCode, 201);
  assert.equal(r1.json().user.role, 'admin');

  const r2 = await app.inject({ method: 'POST', url: '/api/auth/register', headers: HDR,
    payload: { email: 'second@x.io', password: 'supersecret' } });
  assert.equal(r2.statusCode, 403, 'closed registration blocks non-first users');
});

test('write without CSRF header is rejected', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'admin@x.io', password: 'supersecret' } });
  assert.equal(res.statusCode, 403);
});

test('login, world create/list/get/patch/delete, and isolation', async () => {
  // admin logs in
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: HDR,
    payload: { email: 'admin@x.io', password: 'supersecret' } });
  assert.equal(login.statusCode, 200);
  const adminCookie = cookieFrom(login);
  const A = { ...HDR, cookie: adminCookie };

  // unauthenticated list is 401
  const noauth = await app.inject({ method: 'GET', url: '/api/worlds' });
  assert.equal(noauth.statusCode, 401);

  // create a world (default eras seeded)
  const created = await app.inject({ method: 'POST', url: '/api/worlds', headers: A,
    payload: { name: 'Aetheria', tagline: 'a realm' } });
  assert.equal(created.statusCode, 201);
  const worldId = created.json().id;
  assert.ok(worldId);

  // list shows it with entity_count 0
  const list = await app.inject({ method: 'GET', url: '/api/worlds', headers: A });
  assert.equal(list.json().length, 1);
  assert.equal(list.json()[0].entity_count, 0);

  // patch
  const patched = await app.inject({ method: 'PATCH', url: `/api/worlds/${worldId}`, headers: A,
    payload: { name: 'Aetheria Prime' } });
  assert.equal(patched.json().name, 'Aetheria Prime');

  // a SECOND user (created by admin-as-bootstrap not possible in closed mode via API;
  // create directly to test isolation)
  const { createUser } = await import('../src/auth/routes.js');
  createUser({ email: 'bob@x.io', password: 'supersecret', role: 'user' });
  const bobLogin = await app.inject({ method: 'POST', url: '/api/auth/login', headers: HDR,
    payload: { email: 'bob@x.io', password: 'supersecret' } });
  const B = { ...HDR, cookie: cookieFrom(bobLogin) };

  // bob cannot see or touch admin's world
  assert.equal((await app.inject({ method: 'GET', url: '/api/worlds', headers: B })).json().length, 0);
  assert.equal((await app.inject({ method: 'GET', url: `/api/worlds/${worldId}`, headers: B })).statusCode, 404);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/worlds/${worldId}`, headers: B })).statusCode, 404);

  // admin can delete
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/worlds/${worldId}`, headers: A })).statusCode, 204);
});
