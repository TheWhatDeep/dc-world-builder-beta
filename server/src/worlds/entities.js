// Entity, relationship, and search API for a single world.
// The relational store (entities + entity_fields + entity_tags + relationships + lexicon)
// is serialized back into the shape the frontend already uses, so the client data-layer
// rewrite is a swap of storage, not of model:
//   { id, type, name, desc, canon, tags:[], fields:{}, rels:[{type,target}],
//     birth, death, when, map:{x,y}, lang:{words:[{word,gloss}]}, mana, created, assets:[] }
import { getDb } from '../db/index.js';
import { uid, now } from '../util.js';
import { requireAuth } from '../auth/middleware.js';
import { ownWorld } from './access.js';
import { assetView } from '../assets/routes.js';

const ENTITY_TYPES = new Set([
  'char', 'place', 'faction', 'item', 'event', 'creature', 'culture', 'language', 'concept', 'spell',
]);
const CANON = new Set(['canon', 'draft', 'speculative']);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// ---- serialization --------------------------------------------------------

function num(v) {
  return v == null ? null : Number(v);
}

// A lightweight row for list/search/grid views — intentionally omits the heavy
// per-entity sub-resources (fields, rels, lexicon) so list payloads stay bounded.
function summarize(e, tagsByEntity) {
  return {
    id: e.id,
    type: e.type,
    name: e.name,
    desc: e.description,
    canon: e.canon,
    tags: tagsByEntity?.get(e.id) || [],
    birth: num(e.birth),
    death: num(e.death),
    when: num(e.occurs),
    updated: e.updated_at,
  };
}

// The full entity, including every sub-resource. Used for the detail/inspector view.
function fullEntity(db, e) {
  const tags = db.prepare('SELECT tag FROM entity_tags WHERE entity_id = ? ORDER BY tag').all(e.id).map((r) => r.tag);

  const fieldRows = db.prepare('SELECT key, value FROM entity_fields WHERE entity_id = ? ORDER BY sort, rowid').all(e.id);
  const fields = {};
  for (const f of fieldRows) fields[f.key] = f.value;

  const rels = db
    .prepare('SELECT type, target_id FROM relationships WHERE source_id = ? ORDER BY rowid')
    .all(e.id)
    .map((r) => ({ type: r.type, target: r.target_id }));

  const words = db
    .prepare('SELECT word, gloss FROM lexicon WHERE entity_id = ? ORDER BY sort, rowid')
    .all(e.id)
    .map((r) => ({ word: r.word, gloss: r.gloss }));

  const assets = db
    .prepare('SELECT * FROM assets WHERE entity_id = ? ORDER BY created_at')
    .all(e.id)
    .map(assetView);

  const out = {
    id: e.id,
    type: e.type,
    name: e.name,
    desc: e.description,
    canon: e.canon,
    tags,
    fields,
    rels,
    birth: num(e.birth),
    death: num(e.death),
    when: num(e.occurs),
    mana: num(e.mana),
    created: num(e.created_year),
    map: e.map_x == null && e.map_y == null ? null : { x: num(e.map_x), y: num(e.map_y) },
    created_at: e.created_at,
    updated_at: e.updated_at,
    assets,
  };
  if (e.type === 'language') out.lang = { words };
  return out;
}

// ---- write helpers --------------------------------------------------------

// Maps the frontend entity shape onto the entities table columns.
function columnsFromBody(body, existing) {
  const pick = (key, fallback) => (body[key] !== undefined ? body[key] : fallback);
  const map = body.map !== undefined ? body.map : undefined;
  return {
    name: String(pick('name', existing?.name ?? '')).slice(0, 300),
    description: String(pick('desc', existing?.description ?? '')),
    canon: CANON.has(body.canon) ? body.canon : (existing?.canon ?? 'canon'),
    birth: toIntOrNull(pick('birth', existing?.birth)),
    death: toIntOrNull(pick('death', existing?.death)),
    occurs: toIntOrNull(pick('when', existing?.occurs)),
    mana: toIntOrNull(pick('mana', existing?.mana)),
    created_year: toIntOrNull(pick('created', existing?.created_year)),
    map_x: map === undefined ? (existing?.map_x ?? null) : (map?.x == null ? null : Number(map.x)),
    map_y: map === undefined ? (existing?.map_y ?? null) : (map?.y == null ? null : Number(map.y)),
  };
}

function toIntOrNull(v) {
  if (v == null || v === '') return null;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : null;
}

// Replaces the tag/field/lexicon/relationship sub-resources for an entity. Each is only
// touched when its key is present in the body, so PATCH can update columns alone.
function writeSubResources(db, worldId, entityId, body) {
  if (Array.isArray(body.tags)) {
    db.prepare('DELETE FROM entity_tags WHERE entity_id = ?').run(entityId);
    const ins = db.prepare('INSERT OR IGNORE INTO entity_tags (entity_id, tag) VALUES (?, ?)');
    for (const t of body.tags) {
      const tag = String(t).trim();
      if (tag) ins.run(entityId, tag.slice(0, 80));
    }
  }

  if (body.fields !== undefined && body.fields && typeof body.fields === 'object') {
    db.prepare('DELETE FROM entity_fields WHERE entity_id = ?').run(entityId);
    const ins = db.prepare('INSERT INTO entity_fields (id, entity_id, key, value, sort) VALUES (?, ?, ?, ?, ?)');
    Object.entries(body.fields).forEach(([key, value], i) => {
      if (String(key).trim()) ins.run(uid('f_'), entityId, String(key).slice(0, 120), String(value ?? ''), i);
    });
  }

  // Languages carry a lexicon; accept either `lang.words` or a bare `words` array.
  const words = Array.isArray(body.lang?.words) ? body.lang.words : (Array.isArray(body.words) ? body.words : null);
  if (words) {
    db.prepare('DELETE FROM lexicon WHERE entity_id = ?').run(entityId);
    const ins = db.prepare('INSERT INTO lexicon (id, entity_id, word, gloss, sort) VALUES (?, ?, ?, ?, ?)');
    words.forEach((w, i) => ins.run(uid('lx_'), entityId, String(w.word ?? '').slice(0, 200), String(w.gloss ?? ''), i));
  }

  // Outgoing relationships live on the source entity in the frontend model, so saving an
  // entity replaces its outgoing edges. Targets must resolve to entities in the same world.
  if (Array.isArray(body.rels)) {
    db.prepare('DELETE FROM relationships WHERE source_id = ?').run(entityId);
    const valid = db.prepare('SELECT 1 FROM entities WHERE id = ? AND world_id = ?');
    const ins = db.prepare(
      'INSERT INTO relationships (id, world_id, source_id, target_id, type) VALUES (?, ?, ?, ?, ?)'
    );
    for (const r of body.rels) {
      const target = r?.target;
      const type = String(r?.type ?? '').trim();
      if (!target || !type) continue;
      if (!valid.get(target, worldId)) continue; // silently drop dangling targets
      ins.run(uid('r_'), worldId, entityId, target, type.slice(0, 80));
    }
  }
}

// ---- FTS search -----------------------------------------------------------

// Turns free user text into a safe fts5 prefix query: each alphanumeric token becomes a
// quoted prefix term, AND-ed together. Returns null when there's nothing searchable.
function ftsQuery(q) {
  const terms = String(q || '').toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!terms || !terms.length) return null;
  return terms.map((t) => `"${t}"*`).join(' ');
}

function clampLimit(v) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

const SORTS = {
  name: 'e.name COLLATE NOCASE ASC',
  name_desc: 'e.name COLLATE NOCASE DESC',
  recent: 'e.updated_at DESC',
  oldest: 'e.created_at ASC',
  birth: 'e.birth ASC',
};

// ---- routes ---------------------------------------------------------------

export async function entityRoutes(app) {
  app.addHook('preHandler', requireAuth);

  // List / search entities. `q` triggers full-text search (ranked); otherwise rows are
  // filtered + sorted. Always paginated so a large world never ships in one response.
  app.get('/api/worlds/:worldId/entities', async (req, reply) => {
    if (!ownWorld(req, reply)) return;
    const db = getDb();
    const { worldId } = req.params;
    const { q, type, canon, sort } = req.query;
    const limit = clampLimit(req.query.limit);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const filters = [];
    const args = [];
    if (type && ENTITY_TYPES.has(type)) { filters.push('e.type = ?'); args.push(type); }
    if (canon && CANON.has(canon)) { filters.push('e.canon = ?'); args.push(canon); }

    const match = ftsQuery(q);
    let rows;
    let total;

    if (q != null && q !== '') {
      if (!match) return { total: 0, limit, offset, items: [] };
      const where = ['entities_fts MATCH ?', 'e.world_id = ?', ...filters];
      const whereSql = where.join(' AND ');
      const from = 'FROM entities_fts JOIN entities e ON e.rowid = entities_fts.rowid';
      total = db.prepare(`SELECT COUNT(*) AS n ${from} WHERE ${whereSql}`).get(match, worldId, ...args).n;
      rows = db
        .prepare(`SELECT e.* ${from} WHERE ${whereSql} ORDER BY entities_fts.rank LIMIT ? OFFSET ?`)
        .all(match, worldId, ...args, limit, offset);
    } else {
      const where = ['e.world_id = ?', ...filters];
      const whereSql = where.join(' AND ');
      total = db.prepare(`SELECT COUNT(*) AS n FROM entities e WHERE ${whereSql}`).get(worldId, ...args).n;
      const order = SORTS[sort] || SORTS.name;
      rows = db
        .prepare(`SELECT e.* FROM entities e WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
        .all(worldId, ...args, limit, offset);
    }

    const tagsByEntity = loadTags(db, rows.map((r) => r.id));
    return { total, limit, offset, items: rows.map((e) => summarize(e, tagsByEntity)) };
  });

  app.get('/api/worlds/:worldId/entities/:id', async (req, reply) => {
    if (!ownWorld(req, reply)) return;
    const db = getDb();
    const e = db.prepare('SELECT * FROM entities WHERE id = ? AND world_id = ?').get(req.params.id, req.params.worldId);
    if (!e) return reply.code(404).send({ error: 'Entity not found.' });
    return fullEntity(db, e);
  });

  app.post('/api/worlds/:worldId/entities', async (req, reply) => {
    if (!ownWorld(req, reply)) return;
    const body = req.body || {};
    if (!ENTITY_TYPES.has(body.type)) {
      return reply.code(400).send({ error: 'A valid entity `type` is required.' });
    }
    const db = getDb();
    const id = uid('e_');
    const ts = now();
    const cols = columnsFromBody(body, null);
    const insert = db.prepare(
      `INSERT INTO entities (id, world_id, type, name, description, canon, birth, death, occurs,
         mana, created_year, map_x, map_y, created_at, updated_at)
       VALUES (@id, @world_id, @type, @name, @description, @canon, @birth, @death, @occurs,
         @mana, @created_year, @map_x, @map_y, @created_at, @updated_at)`
    );
    db.transaction(() => {
      insert.run({ id, world_id: req.params.worldId, type: body.type, ...cols, created_at: ts, updated_at: ts });
      writeSubResources(db, req.params.worldId, id, body);
    })();
    const e = db.prepare('SELECT * FROM entities WHERE id = ?').get(id);
    return reply.code(201).send(fullEntity(db, e));
  });

  app.patch('/api/worlds/:worldId/entities/:id', async (req, reply) => {
    if (!ownWorld(req, reply)) return;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM entities WHERE id = ? AND world_id = ?').get(req.params.id, req.params.worldId);
    if (!existing) return reply.code(404).send({ error: 'Entity not found.' });
    const body = req.body || {};
    const cols = columnsFromBody(body, existing);
    db.transaction(() => {
      db.prepare(
        `UPDATE entities SET name=@name, description=@description, canon=@canon, birth=@birth, death=@death,
           occurs=@occurs, mana=@mana, created_year=@created_year, map_x=@map_x, map_y=@map_y, updated_at=@updated_at
         WHERE id=@id`
      ).run({ ...cols, updated_at: now(), id: existing.id });
      writeSubResources(db, req.params.worldId, existing.id, body);
    })();
    const e = db.prepare('SELECT * FROM entities WHERE id = ?').get(existing.id);
    return fullEntity(db, e);
  });

  app.delete('/api/worlds/:worldId/entities/:id', async (req, reply) => {
    if (!ownWorld(req, reply)) return;
    const db = getDb();
    const info = db.prepare('DELETE FROM entities WHERE id = ? AND world_id = ?').run(req.params.id, req.params.worldId);
    if (!info.changes) return reply.code(404).send({ error: 'Entity not found.' });
    return reply.code(204).send();
  });

  // All relationship edges in a world — the graph view's single read.
  app.get('/api/worlds/:worldId/relationships', async (req, reply) => {
    if (!ownWorld(req, reply)) return;
    const rows = getDb()
      .prepare('SELECT id, source_id, target_id, type FROM relationships WHERE world_id = ? ORDER BY rowid')
      .all(req.params.worldId);
    return rows.map((r) => ({ id: r.id, source: r.source_id, target: r.target_id, type: r.type }));
  });
}

// Batch-loads tags for a set of entity ids into a Map<id, string[]> (avoids N+1 in lists).
function loadTags(db, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT entity_id, tag FROM entity_tags WHERE entity_id IN (${placeholders}) ORDER BY tag`).all(...ids);
  for (const r of rows) {
    if (!map.has(r.entity_id)) map.set(r.entity_id, []);
    map.get(r.entity_id).push(r.tag);
  }
  return map;
}
