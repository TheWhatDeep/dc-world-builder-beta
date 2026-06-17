// Image asset API: upload (with server-side compression to display + thumbnail tiers),
// authenticated serving of any tier, and deletion. Originals are preserved on disk for
// export fidelity; clients fetch the small tiers for grids/lists (esp. on mobile/cellular).
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/index.js';
import { config } from '../config.js';
import { uid, now } from '../util.js';
import { requireAuth } from '../auth/middleware.js';
import { ownWorld } from '../worlds/access.js';
import { processImage } from './images.js';

const SIZES = { thumb: 'thumb_path', display: 'display_path', original: 'file_path' };

// Client-facing view of an asset row. Imported by the entity serializer too.
export function assetView(a) {
  return {
    id: a.id,
    entity_id: a.entity_id || null,
    kind: a.kind,
    mime: a.mime,
    orig_mime: a.orig_mime,
    width: a.width,
    height: a.height,
    size: a.size,
    created_at: a.created_at,
    url: `/api/assets/${a.id}?size=display`,
    thumb_url: `/api/assets/${a.id}?size=thumb`,
    original_url: `/api/assets/${a.id}?size=original`,
  };
}

function worldDir(worldId) {
  const dir = path.join(config.assetsDir, worldId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function assetRoutes(app) {
  app.addHook('preHandler', requireAuth);

  // Upload an image. Metadata (entity_id, kind) via query params so multipart field
  // ordering never matters. Produces display + thumb webp; stores the original as-is.
  app.post('/api/worlds/:worldId/assets', async (req, reply) => {
    if (!ownWorld(req, reply)) return;
    const db = getDb();
    const { worldId } = req.params;

    const entityId = req.query.entity_id || null;
    if (entityId) {
      const owned = db.prepare('SELECT 1 FROM entities WHERE id = ? AND world_id = ?').get(entityId, worldId);
      if (!owned) return reply.code(400).send({ error: 'entity_id does not belong to this world.' });
    }
    const kind = req.query.kind === 'map' ? 'map' : 'image';

    const part = await req.file();
    if (!part) return reply.code(400).send({ error: 'No file uploaded.' });
    if (!part.mimetype?.startsWith('image/')) {
      return reply.code(415).send({ error: 'Only image uploads are supported.' });
    }

    let buf;
    try {
      buf = await part.toBuffer();
    } catch {
      // @fastify/multipart throws when the file exceeds the configured limit.
      return reply.code(413).send({ error: `Image exceeds the ${Math.round(config.maxAssetBytes / 1048576)}MB limit.` });
    }
    if (part.file.truncated) {
      return reply.code(413).send({ error: `Image exceeds the ${Math.round(config.maxAssetBytes / 1048576)}MB limit.` });
    }

    let processed;
    try {
      processed = await processImage(buf, { maxDim: config.imageMaxDim, thumbDim: config.thumbDim });
    } catch (err) {
      return reply.code(err.statusCode || 415).send({ error: 'Unsupported or corrupt image.' });
    }

    const id = uid('a_');
    const dir = worldDir(worldId);
    const rel = (suffix) => path.join(worldId, `${id}.${suffix}`);
    const origExt = (part.mimetype.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
    const paths = {
      file: rel(`orig.${origExt}`),
      display: rel('display.webp'),
      thumb: rel('thumb.webp'),
    };

    await Promise.all([
      fs.promises.writeFile(path.join(config.assetsDir, paths.file), buf),
      fs.promises.writeFile(path.join(config.assetsDir, paths.display), processed.display),
      fs.promises.writeFile(path.join(config.assetsDir, paths.thumb), processed.thumb),
    ]);

    const row = {
      id,
      world_id: worldId,
      entity_id: entityId,
      kind,
      file_path: paths.file,
      display_path: paths.display,
      thumb_path: paths.thumb,
      mime: 'image/webp',
      orig_mime: part.mimetype,
      size: buf.length,
      width: processed.width,
      height: processed.height,
      created_at: now(),
    };
    db.prepare(
      `INSERT INTO assets (id, world_id, entity_id, kind, file_path, display_path, thumb_path,
         mime, orig_mime, size, width, height, created_at)
       VALUES (@id, @world_id, @entity_id, @kind, @file_path, @display_path, @thumb_path,
         @mime, @orig_mime, @size, @width, @height, @created_at)`
    ).run(row);

    return reply.code(201).send(assetView(row));
  });

  // Serve a tier of an asset, but only to its owner. `size` = thumb | display | original.
  app.get('/api/assets/:id', async (req, reply) => {
    const a = getDb()
      .prepare(
        `SELECT a.* FROM assets a JOIN worlds w ON w.id = a.world_id
         WHERE a.id = ? AND w.user_id = ?`
      )
      .get(req.params.id, req.user.id);
    if (!a) return reply.code(404).send({ error: 'Asset not found.' });

    const col = SIZES[req.query.size] || 'display_path';
    const relPath = a[col] || a.display_path || a.file_path;
    const abs = path.join(config.assetsDir, relPath);
    if (!fs.existsSync(abs)) return reply.code(404).send({ error: 'Asset file missing.' });

    const mime = col === 'file_path' ? a.orig_mime : 'image/webp';
    // Asset bytes for a given id+size never change, so they're safe to cache hard (privately).
    reply.header('Cache-Control', 'private, max-age=31536000, immutable');
    reply.type(mime);
    return reply.send(fs.createReadStream(abs));
  });

  app.delete('/api/assets/:id', async (req, reply) => {
    const db = getDb();
    const a = db
      .prepare(
        `SELECT a.* FROM assets a JOIN worlds w ON w.id = a.world_id
         WHERE a.id = ? AND w.user_id = ?`
      )
      .get(req.params.id, req.user.id);
    if (!a) return reply.code(404).send({ error: 'Asset not found.' });

    for (const rel of [a.file_path, a.display_path, a.thumb_path]) {
      if (!rel) continue;
      fs.promises.unlink(path.join(config.assetsDir, rel)).catch(() => {});
    }
    db.prepare('DELETE FROM assets WHERE id = ?').run(a.id);
    return reply.code(204).send();
  });
}
