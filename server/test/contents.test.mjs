// Phase 3 tests: bulk world-contents load/save round-trip, entity reconcile (upsert +
// delete-missing), relationship remap, and the guarantee that an uploaded asset survives a
// full-world save (because entities are upserted by id, not wiped and reinserted).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-contents-'));
process.env.CODEX_DATA_DIR = tmp;
process.env.CODEX_DB = path.join(tmp, 'test.db');
process.env.CODEX_ASSETS_DIR = path.join(tmp, 'assets');
process.env.CODEX_REGISTRATION_MODE = 'closed';
process.env.CODEX_FRONTEND_DIR = tmp;

const { migrate } = await import('../src/db/index.js');
const { buildApp } = await import('../src/server.js');

migrate();
let app, A, worldId;
const HDR = { 'x-codex-client': '1', 'content-type': 'application/json' };
const cookieFrom = (res) => (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'][0] : res.headers['set-cookie']).split(';')[0];

before(async () => {
  app = await buildApp();
  await app.inject({ method: 'POST', url: '/api/auth/register', headers: HDR, payload: { email: 'a@x.io', password: 'supersecret' } });
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: HDR, payload: { email: 'a@x.io', password: 'supersecret' } });
  A = { ...HDR, cookie: cookieFrom(login) };
  worldId = (await app.inject({ method: 'POST', url: '/api/worlds', headers: A, payload: { name: 'Aetheria' } })).json().id;
});
after(async () => { await app.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const C = () => `/api/worlds/${worldId}/contents`;

// A representative client DB payload (client-authoritative ids like the vanilla app emits).
const WORLD = {
  meta: { name: 'Aetheria Prime', tagline: 'a realm reforged', theme: 'light' },
  calendar: {
    epoch: 'AE', months: ['One', 'Two'], daysPerMonth: 28,
    eras: [{ id: 'era1', name: 'Dawn', start: 0, end: 100, color: '#abc' }],
  },
  notes: 'The loremaster notes.',
  map: { name: 'The Known World', image: 'data:image/png;base64,AAAA', gen: { seed: 7 } },
  entities: [
    { id: 'e_king', type: 'char', name: 'King Aldric', desc: 'The last king.', canon: 'canon',
      tags: ['royalty'], fields: { House: 'Dawnward' }, rels: [{ type: 'rules', target: 'e_realm' }], birth: 1100, death: 1180 },
    { id: 'e_realm', type: 'place', name: 'The Reach', desc: 'A northern land.', canon: 'canon' },
    { id: 'e_tongue', type: 'language', name: 'Old Sylvan', lang: { words: [{ word: 'aelin', gloss: 'star' }] } },
  ],
  economy: [{ id: 'ec1', name: 'Starsteel', description: 'rare ore', rarity: 'rare', value: '500g', danger: 'None' }],
  journal: [{ id: 'j1', title: 'Session 1', campaign: 'Main', date: 'Day 1', year: 1180, body: 'They met [[King Aldric]].', _t: 123 }],
  branches: [{ id: 'b1', name: 'What if', date: 456, data: { entities: [] } }],
};

test('PUT then GET round-trips the full world shape', async () => {
  const put = await app.inject({ method: 'PUT', url: C(), headers: A, payload: WORLD });
  assert.equal(put.statusCode, 200);

  const got = (await app.inject({ method: 'GET', url: C(), headers: A })).json();
  assert.equal(got.meta.name, 'Aetheria Prime');
  assert.equal(got.meta.theme, 'light');
  assert.equal(got.notes, 'The loremaster notes.');
  assert.equal(got.calendar.epoch, 'AE');
  assert.deepEqual(got.calendar.months, ['One', 'Two']);
  assert.equal(got.calendar.eras.length, 1);
  assert.equal(got.calendar.eras[0].name, 'Dawn');
  assert.equal(got.map.image, 'data:image/png;base64,AAAA');
  assert.equal(got.map.gen.seed, 7);

  assert.equal(got.entities.length, 3);
  const king = got.entities.find((e) => e.id === 'e_king');
  assert.equal(king.name, 'King Aldric');
  assert.deepEqual(king.tags, ['royalty']);
  assert.equal(king.fields.House, 'Dawnward');
  assert.equal(king.rels.length, 1);
  assert.equal(king.rels[0].target, 'e_realm'); // client id preserved end-to-end

  const tongue = got.entities.find((e) => e.id === 'e_tongue');
  assert.equal(tongue.lang.words[0].word, 'aelin');

  assert.equal(got.economy[0].name, 'Starsteel');
  assert.equal(got.journal[0].title, 'Session 1');
  assert.equal(got.journal[0]._t, 123);
  assert.equal(got.branches[0].name, 'What if');
  assert.equal(got.branches[0].date, 456);
});

test('a second save reconciles: adds, edits, and deletes entities', async () => {
  const next = JSON.parse(JSON.stringify(WORLD));
  next.entities = next.entities.filter((e) => e.id !== 'e_realm'); // delete The Reach
  next.entities.find((e) => e.id === 'e_king').name = 'King Aldric II'; // edit
  next.entities.push({ id: 'e_heir', type: 'char', name: 'Prince Cael' }); // add
  // king's rel now points at a deleted entity -> should be dropped on save
  await app.inject({ method: 'PUT', url: C(), headers: A, payload: next });

  const got = (await app.inject({ method: 'GET', url: C(), headers: A })).json();
  const ids = got.entities.map((e) => e.id).sort();
  assert.deepEqual(ids, ['e_heir', 'e_king', 'e_tongue']);
  assert.equal(got.entities.find((e) => e.id === 'e_king').name, 'King Aldric II');
  assert.equal(got.entities.find((e) => e.id === 'e_king').rels.length, 0, 'dangling rel dropped');
});

test('an uploaded asset survives a full-world save', async () => {
  // re-seed a clean world state with the realm present
  await app.inject({ method: 'PUT', url: C(), headers: A, payload: WORLD });

  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
  const boundary = '----b';
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="p.png"\r\nContent-Type: image/png\r\n\r\n`),
    png, Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const up = await app.inject({
    method: 'POST', url: `/api/worlds/${worldId}/assets?entity_id=e_king`,
    headers: { 'x-codex-client': '1', cookie: A.cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload,
  });
  assert.equal(up.statusCode, 201);
  const assetId = up.json().id;

  // a normal save (which upserts e_king rather than recreating it) must not orphan the asset
  await app.inject({ method: 'PUT', url: C(), headers: A, payload: WORLD });

  const still = await app.inject({ method: 'GET', url: `/api/assets/${assetId}?size=thumb`, headers: { cookie: A.cookie } });
  assert.equal(still.statusCode, 200, 'asset bytes still served after save');

  const got = (await app.inject({ method: 'GET', url: C(), headers: A })).json();
  assert.equal(got.entities.find((e) => e.id === 'e_king').assets.length, 1, 'asset still linked to entity');
});
