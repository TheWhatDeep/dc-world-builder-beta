// Phase 2 tests: entity CRUD + sub-resources, FTS search, relationships, and the image
// asset pipeline (upload -> compressed tiers -> serve -> delete). Throwaway temp DB.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-ent-'));
process.env.CODEX_DATA_DIR = tmp;
process.env.CODEX_DB = path.join(tmp, 'test.db');
process.env.CODEX_ASSETS_DIR = path.join(tmp, 'assets');
process.env.CODEX_REGISTRATION_MODE = 'closed';
process.env.CODEX_FRONTEND_DIR = tmp;

const { migrate } = await import('../src/db/index.js');
const { buildApp } = await import('../src/server.js');

migrate();
let app;
let A; // authed headers for the world owner
let worldId;

const HDR = { 'x-codex-client': '1', 'content-type': 'application/json' };

function cookieFrom(res) {
  const sc = res.headers['set-cookie'];
  return (Array.isArray(sc) ? sc[0] : sc).split(';')[0];
}

before(async () => {
  app = await buildApp();
  await app.inject({ method: 'POST', url: '/api/auth/register', headers: HDR,
    payload: { email: 'owner@x.io', password: 'supersecret' } });
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: HDR,
    payload: { email: 'owner@x.io', password: 'supersecret' } });
  A = { ...HDR, cookie: cookieFrom(login) };
  const w = await app.inject({ method: 'POST', url: '/api/worlds', headers: A, payload: { name: 'Aetheria' } });
  worldId = w.json().id;
});
after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const E = () => `/api/worlds/${worldId}/entities`;

test('create entity with tags, fields, and relationship; full shape round-trips', async () => {
  // target first, so the relationship has something to point at
  const tgt = await app.inject({ method: 'POST', url: E(), headers: A,
    payload: { type: 'faction', name: 'The Silver Order' } });
  assert.equal(tgt.statusCode, 201);
  const targetId = tgt.json().id;

  const res = await app.inject({ method: 'POST', url: E(), headers: A, payload: {
    type: 'char', name: 'Lyra Dawnward', desc: 'A wandering oathkeeper.', canon: 'canon',
    tags: ['protagonist', 'knight'],
    fields: { Title: 'Dawnward', Age: '34' },
    rels: [{ type: 'member of', target: targetId }],
    birth: 1180, death: 1240,
  } });
  assert.equal(res.statusCode, 201);
  const e = res.json();
  assert.equal(e.type, 'char');
  assert.equal(e.desc, 'A wandering oathkeeper.');
  assert.deepEqual(e.tags, ['knight', 'protagonist']); // tags returned sorted
  assert.equal(e.fields.Title, 'Dawnward');
  assert.equal(e.fields.Age, '34');
  assert.equal(e.rels.length, 1);
  assert.equal(e.rels[0].target, targetId);
  assert.equal(e.rels[0].type, 'member of');
  assert.equal(e.birth, 1180);

  // detail fetch matches
  const got = await app.inject({ method: 'GET', url: `${E()}/${e.id}`, headers: A });
  assert.equal(got.json().name, 'Lyra Dawnward');
});

test('relationship targets outside the world are dropped, not stored', async () => {
  const res = await app.inject({ method: 'POST', url: E(), headers: A, payload: {
    type: 'char', name: 'Orphan Edge', rels: [{ type: 'allied with', target: 'e_does_not_exist' }],
  } });
  assert.equal(res.json().rels.length, 0);
});

test('PATCH updates columns and replaces sub-resources', async () => {
  const created = await app.inject({ method: 'POST', url: E(), headers: A,
    payload: { type: 'place', name: 'Old Name', tags: ['a'] } });
  const id = created.json().id;
  const patched = await app.inject({ method: 'PATCH', url: `${E()}/${id}`, headers: A,
    payload: { name: 'New Name', tags: ['b', 'c'] } });
  assert.equal(patched.json().name, 'New Name');
  assert.deepEqual(patched.json().tags, ['b', 'c']);
});

test('language entity carries a lexicon', async () => {
  const res = await app.inject({ method: 'POST', url: E(), headers: A, payload: {
    type: 'language', name: 'Old Sylvan',
    lang: { words: [{ word: 'aelin', gloss: 'star' }, { word: 'thar', gloss: 'river' }] },
  } });
  const e = res.json();
  assert.equal(e.lang.words.length, 2);
  assert.equal(e.lang.words[0].word, 'aelin');
});

test('list is paginated and type-filterable', async () => {
  const all = await app.inject({ method: 'GET', url: `${E()}?limit=2`, headers: A });
  const body = all.json();
  assert.ok(body.total >= 4);
  assert.equal(body.items.length, 2);
  assert.equal(body.limit, 2);

  const chars = await app.inject({ method: 'GET', url: `${E()}?type=char`, headers: A });
  assert.ok(chars.json().items.every((i) => i.type === 'char'));
});

test('full-text search matches name and description, ranked', async () => {
  const res = await app.inject({ method: 'GET', url: `${E()}?q=oathkeeper`, headers: A });
  const body = res.json();
  assert.equal(body.total, 1);
  assert.equal(body.items[0].name, 'Lyra Dawnward');

  // prefix matching
  const prefix = await app.inject({ method: 'GET', url: `${E()}?q=daw`, headers: A });
  assert.ok(prefix.json().total >= 1);

  // garbage query yields no rows, not a 500
  const junk = await app.inject({ method: 'GET', url: `${E()}?q=${encodeURIComponent('"*(')}`, headers: A });
  assert.equal(junk.statusCode, 200);
  assert.equal(junk.json().total, 0);
});

test('relationships endpoint returns world edges', async () => {
  const res = await app.inject({ method: 'GET', url: `/api/worlds/${worldId}/relationships`, headers: A });
  const edges = res.json();
  assert.ok(edges.length >= 1);
  assert.ok(edges[0].source && edges[0].target && edges[0].type);
});

test('image upload produces tiers, serves them, and deletes', async () => {
  const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .png().toBuffer();

  const boundary = '----codexboundary';
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="art.png"\r\nContent-Type: image/png\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const payload = Buffer.concat([Buffer.from(head), png, Buffer.from(tail)]);

  const up = await app.inject({
    method: 'POST', url: `/api/worlds/${worldId}/assets`,
    headers: { 'x-codex-client': '1', cookie: A.cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload,
  });
  assert.equal(up.statusCode, 201);
  const asset = up.json();
  assert.equal(asset.mime, 'image/webp');
  assert.equal(asset.orig_mime, 'image/png');
  assert.equal(asset.width, 1200);
  assert.equal(asset.height, 800);

  // each tier serves real bytes; thumb should be smaller than display
  const thumb = await app.inject({ method: 'GET', url: `/api/assets/${asset.id}?size=thumb`, headers: { cookie: A.cookie } });
  const display = await app.inject({ method: 'GET', url: `/api/assets/${asset.id}?size=display`, headers: { cookie: A.cookie } });
  const original = await app.inject({ method: 'GET', url: `/api/assets/${asset.id}?size=original`, headers: { cookie: A.cookie } });
  assert.equal(thumb.statusCode, 200);
  assert.equal(thumb.headers['content-type'], 'image/webp');
  assert.equal(original.headers['content-type'], 'image/png');
  assert.ok(thumb.rawPayload.length < display.rawPayload.length, 'thumb is smaller than display');

  // delete removes the row and the files
  const del = await app.inject({ method: 'DELETE', url: `/api/assets/${asset.id}`, headers: { 'x-codex-client': '1', cookie: A.cookie } });
  assert.equal(del.statusCode, 204);
  const gone = await app.inject({ method: 'GET', url: `/api/assets/${asset.id}?size=thumb`, headers: { cookie: A.cookie } });
  assert.equal(gone.statusCode, 404);
});

test('non-image upload is rejected', async () => {
  const boundary = '----codextext';
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="notes.txt"\r\nContent-Type: text/plain\r\n\r\n`;
  const payload = Buffer.concat([Buffer.from(head), Buffer.from('hello'), Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const res = await app.inject({
    method: 'POST', url: `/api/worlds/${worldId}/assets`,
    headers: { 'x-codex-client': '1', cookie: A.cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload,
  });
  assert.equal(res.statusCode, 415);
});

test('another user cannot read or write this world\'s entities', async () => {
  const { createUser } = await import('../src/auth/routes.js');
  createUser({ email: 'intruder@x.io', password: 'supersecret', role: 'user' });
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: HDR,
    payload: { email: 'intruder@x.io', password: 'supersecret' } });
  const B = { ...HDR, cookie: cookieFrom(login) };

  assert.equal((await app.inject({ method: 'GET', url: E(), headers: B })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: E(), headers: B, payload: { type: 'char', name: 'x' } })).statusCode, 404);
});
