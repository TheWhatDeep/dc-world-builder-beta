// Bulk world-contents load/save — the frontend data layer's single read and single write.
//
// GET  returns the whole world in the client's in-memory `DB` shape (meta, calendar+eras,
//      notes, map, entities[], economy[], journal[], branches[]).
// PUT  reconciles that same shape back into the normalized store in one transaction.
//
// The per-entity API (entities.js) still exists for granular/search/mobile use; this endpoint
// exists because the vanilla client mutates a global `DB` in place with no per-change hooks, so
// a debounced "save the whole world" is far simpler and safer than instrumenting every edit.
//
// Entities are reconciled by client-authoritative id (upsert + delete-missing) rather than
// wiped and reinserted, so foreign-keyed assets (assets.entity_id) survive a save.
import { getDb } from '../db/index.js';
import { uid, now } from '../util.js';
import { requireAuth } from '../auth/middleware.js';
import { ownWorld } from './access.js';
import { fullEntity, writeSubResources, writeRels, columnsFromBody, ENTITY_TYPES } from './entities.js';

function toIntOrNull(v) {
  if (v == null || v === '') return null;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : null;
}

function safeJson(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

// ---- GET: serialize the world into the client DB shape ---------------------

function serializeContents(db, world) {
  const calendar = safeJson(world.calendar, {});
  calendar.eras = db
    .prepare('SELECT id, name, start, end, color FROM eras WHERE world_id = ? ORDER BY sort, rowid')
    .all(world.id)
    .map((e) => ({ id: e.id, name: e.name, start: e.start, end: e.end, color: e.color }));

  const entities = db
    .prepare('SELECT * FROM entities WHERE world_id = ? ORDER BY created_at, rowid')
    .all(world.id)
    .map((e) => fullEntity(db, e));

  const economy = db
    .prepare('SELECT id, name, description, rarity, value, danger FROM economy WHERE world_id = ? ORDER BY sort, rowid')
    .all(world.id);

  const journal = db
    .prepare('SELECT * FROM journal WHERE world_id = ? ORDER BY created_at, rowid')
    .all(world.id)
    .map((j) => ({ id: j.id, title: j.title, campaign: j.campaign, date: j.date, year: j.year, body: j.body, _t: j.created_at }));

  const branches = db
    .prepare('SELECT id, name, data, created_at FROM branches WHERE world_id = ? ORDER BY created_at, rowid')
    .all(world.id)
    .map((b) => ({ id: b.id, name: b.name, date: b.created_at, data: safeJson(b.data, {}) }));

  return {
    meta: { name: world.name, tagline: world.tagline, theme: world.theme, created: world.created_at, saved: world.updated_at },
    calendar,
    notes: world.notes,
    map: safeJson(world.map_data, {}),
    entities,
    economy,
    journal,
    branches,
  };
}

// ---- PUT: reconcile the client DB shape back into the store ----------------

function reconcileEntities(db, worldId, incoming) {
  const list = Array.isArray(incoming) ? incoming : [];
  const cols = `name, description, canon, birth, death, occurs, mana, created_year, map_x, map_y`;
  const insert = db.prepare(
    `INSERT INTO entities (id, world_id, type, ${cols}, created_at, updated_at)
     VALUES (@id, @world_id, @type, @name, @description, @canon, @birth, @death, @occurs,
       @mana, @created_year, @map_x, @map_y, @created_at, @updated_at)`
  );
  const update = db.prepare(
    `UPDATE entities SET name=@name, description=@description, canon=@canon, birth=@birth, death=@death,
       occurs=@occurs, mana=@mana, created_year=@created_year, map_x=@map_x, map_y=@map_y, updated_at=@updated_at
     WHERE id=@id AND world_id=@world_id`
  );
  const ownerOf = db.prepare('SELECT world_id FROM entities WHERE id = ?');

  const ts = now();
  const idMap = new Map(); // client id -> stored id (differ only on a cross-world id collision)
  const kept = new Set();

  // Pass 1: upsert columns + tags/fields/lexicon. Relationships are deferred so every
  // possible target exists before edges are written.
  for (const e of list) {
    if (!e || !ENTITY_TYPES.has(e.type)) continue; // skip malformed rows rather than failing the save
    let id = String(e.id || '') || uid('e_');
    const owner = ownerOf.get(id);
    if (owner && owner.world_id !== worldId) id = uid('e_'); // id belongs to another world: re-id
    idMap.set(String(e.id || id), id);
    kept.add(id);

    const c = columnsFromBody(e, null);
    if (owner && owner.world_id === worldId) {
      update.run({ ...c, id, world_id: worldId, updated_at: ts });
    } else {
      insert.run({ ...c, id, world_id: worldId, type: e.type, created_at: ts, updated_at: ts });
    }
    writeSubResources(db, id, e);
  }

  // Delete entities the client no longer has (cascades their rels, fields, tags, assets).
  const existing = db.prepare('SELECT id FROM entities WHERE world_id = ?').all(worldId);
  const del = db.prepare('DELETE FROM entities WHERE id = ? AND world_id = ?');
  for (const row of existing) {
    if (!kept.has(row.id)) del.run(row.id, worldId);
  }

  // Pass 2: write relationships now that all targets exist, remapping any re-ided targets.
  for (const e of list) {
    if (!e || !ENTITY_TYPES.has(e.type)) continue;
    const sourceId = idMap.get(String(e.id || ''));
    if (!sourceId) continue;
    const rels = Array.isArray(e.rels)
      ? e.rels.map((r) => ({ type: r?.type, target: idMap.get(String(r?.target)) || r?.target }))
      : [];
    writeRels(db, worldId, sourceId, rels);
  }
}

function replaceCollection(db, worldId, table, rows, build) {
  db.prepare(`DELETE FROM ${table} WHERE world_id = ?`).run(worldId);
  for (let i = 0; i < rows.length; i++) build(rows[i], i);
}

function reconcileWorld(db, worldId, body) {
  const calendar = body.calendar && typeof body.calendar === 'object' ? { ...body.calendar } : {};
  const eras = Array.isArray(calendar.eras) ? calendar.eras : [];
  delete calendar.eras; // eras live in their own table; keep the rest of the calendar as JSON

  const meta = body.meta || {};
  db.prepare(
    `UPDATE worlds SET name=@name, tagline=@tagline, theme=@theme, notes=@notes,
       calendar=@calendar, map_data=@map_data, updated_at=@updated_at WHERE id=@id`
  ).run({
    id: worldId,
    name: String(meta.name ?? 'Untitled World').slice(0, 200),
    tagline: String(meta.tagline ?? '').slice(0, 500),
    theme: String(meta.theme ?? 'dark'),
    notes: String(body.notes ?? ''),
    calendar: JSON.stringify(calendar),
    map_data: JSON.stringify(body.map ?? {}),
    updated_at: now(),
  });

  reconcileEntities(db, worldId, body.entities);

  const insEra = db.prepare('INSERT INTO eras (id, world_id, name, start, end, color, sort) VALUES (?, ?, ?, ?, ?, ?, ?)');
  replaceCollection(db, worldId, 'eras', eras, (er, i) =>
    insEra.run(String(er.id || uid('era_')), worldId, String(er.name || ''), toIntOrNull(er.start), toIntOrNull(er.end), String(er.color || '#6b8a9a'), i));

  const insEco = db.prepare('INSERT INTO economy (id, world_id, name, description, rarity, value, danger, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  replaceCollection(db, worldId, 'economy', Array.isArray(body.economy) ? body.economy : [], (r, i) =>
    insEco.run(String(r.id || uid('ec_')), worldId, String(r.name || ''), String(r.description || ''), String(r.rarity || ''), String(r.value || ''), String(r.danger || ''), i));

  const insJ = db.prepare('INSERT INTO journal (id, world_id, title, campaign, date, year, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  replaceCollection(db, worldId, 'journal', Array.isArray(body.journal) ? body.journal : [], (s) => {
    const ts = s._t || now();
    insJ.run(String(s.id || uid('j_')), worldId, String(s.title || ''), String(s.campaign || ''), String(s.date || ''), toIntOrNull(s.year), String(s.body || ''), ts, ts);
  });

  const insB = db.prepare('INSERT INTO branches (id, world_id, name, data, created_at) VALUES (?, ?, ?, ?, ?)');
  replaceCollection(db, worldId, 'branches', Array.isArray(body.branches) ? body.branches : [], (b) =>
    insB.run(String(b.id || uid('b_')), worldId, String(b.name || ''), JSON.stringify(b.data ?? {}), b.date || now()));
}

// ---- routes ---------------------------------------------------------------

export async function contentsRoutes(app) {
  app.addHook('preHandler', requireAuth);

  app.get('/api/worlds/:worldId/contents', async (req, reply) => {
    const w = getDb().prepare('SELECT * FROM worlds WHERE id = ? AND user_id = ?').get(req.params.worldId, req.user.id);
    if (!w) return reply.code(404).send({ error: 'World not found.' });
    return serializeContents(getDb(), w);
  });

  app.put('/api/worlds/:worldId/contents', async (req, reply) => {
    if (!ownWorld(req, reply)) return;
    const db = getDb();
    const body = req.body || {};
    db.transaction(() => reconcileWorld(db, req.params.worldId, body))();
    const w = db.prepare('SELECT * FROM worlds WHERE id = ?').get(req.params.worldId);
    return serializeContents(db, w);
  });
}
