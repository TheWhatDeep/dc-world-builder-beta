import { getDb } from '../db/index.js';
import { uid, now } from '../util.js';
import { requireAuth } from '../auth/middleware.js';

const DEFAULT_CALENDAR = {
  epoch: 'CE',
  months: ['Frostmoon', 'Thawmoon', 'Seedmoon', 'Bloommoon', 'Sunheight', 'Highsun',
    'Goldfall', 'Harvestmoon', 'Dimming', 'Frostfall', 'Deepwinter', 'Yearturn'],
  daysPerMonth: 30,
};

const DEFAULT_ERAS = [
  { name: 'The First Age', start: 0, end: 500, color: '#6b8a9a' },
  { name: 'The Sundering', start: 500, end: 520, color: '#c0584f' },
  { name: 'The Long Peace', start: 520, end: 1200, color: '#8a9a6b' },
];

function worldRow(w) {
  return {
    id: w.id,
    name: w.name,
    tagline: w.tagline,
    calendar: JSON.parse(w.calendar || '{}'),
    notes: w.notes,
    theme: w.theme,
    created_at: w.created_at,
    updated_at: w.updated_at,
  };
}

// Loads a world owned by the user, or sends 404 and returns null.
export function loadOwnedWorld(req, reply) {
  const w = getDb().prepare('SELECT * FROM worlds WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!w) {
    reply.code(404).send({ error: 'World not found.' });
    return null;
  }
  return w;
}

export async function worldRoutes(app) {
  app.addHook('preHandler', requireAuth);

  // List metadata for the world-picker (cheap; no entity data).
  app.get('/api/worlds', async (req) => {
    const rows = getDb()
      .prepare(`SELECT w.*, (SELECT COUNT(*) FROM entities e WHERE e.world_id = w.id) AS entity_count
                FROM worlds w WHERE w.user_id = ? ORDER BY w.updated_at DESC`)
      .all(req.user.id);
    return rows.map((w) => ({ ...worldRow(w), entity_count: w.entity_count }));
  });

  app.post('/api/worlds', async (req, reply) => {
    const db = getDb();
    const ts = now();
    const body = req.body || {};
    const w = {
      id: uid('w_'),
      user_id: req.user.id,
      name: (body.name || 'Untitled World').slice(0, 200),
      tagline: (body.tagline || 'an unwritten realm').slice(0, 500),
      calendar: JSON.stringify(body.calendar || DEFAULT_CALENDAR),
      notes: '',
      theme: body.theme || 'dark',
      created_at: ts,
      updated_at: ts,
    };
    const insertWorld = db.prepare(
      `INSERT INTO worlds (id, user_id, name, tagline, calendar, notes, theme, created_at, updated_at)
       VALUES (@id, @user_id, @name, @tagline, @calendar, @notes, @theme, @created_at, @updated_at)`
    );
    const insertEra = db.prepare(
      'INSERT INTO eras (id, world_id, name, start, end, color, sort) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    db.transaction(() => {
      insertWorld.run(w);
      DEFAULT_ERAS.forEach((era, i) => insertEra.run(uid('era_'), w.id, era.name, era.start, era.end, era.color, i));
    })();
    return reply.code(201).send(worldRow(w));
  });

  app.get('/api/worlds/:id', async (req, reply) => {
    const w = loadOwnedWorld(req, reply);
    if (!w) return;
    return worldRow(w);
  });

  app.patch('/api/worlds/:id', async (req, reply) => {
    const w = loadOwnedWorld(req, reply);
    if (!w) return;
    const body = req.body || {};
    const fields = {
      name: body.name != null ? String(body.name).slice(0, 200) : w.name,
      tagline: body.tagline != null ? String(body.tagline).slice(0, 500) : w.tagline,
      calendar: body.calendar != null ? JSON.stringify(body.calendar) : w.calendar,
      notes: body.notes != null ? String(body.notes) : w.notes,
      theme: body.theme != null ? String(body.theme) : w.theme,
    };
    getDb()
      .prepare('UPDATE worlds SET name=@name, tagline=@tagline, calendar=@calendar, notes=@notes, theme=@theme, updated_at=@updated_at WHERE id=@id')
      .run({ ...fields, updated_at: now(), id: w.id });
    return worldRow({ ...w, ...fields });
  });

  app.delete('/api/worlds/:id', async (req, reply) => {
    const w = loadOwnedWorld(req, reply);
    if (!w) return;
    getDb().prepare('DELETE FROM worlds WHERE id = ?').run(w.id);
    return reply.code(204).send();
  });
}
