import { getDb } from '../db/index.js';

// Confirms the :worldId path param names a world owned by the caller.
// Sends 404 (never leaking existence of other users' worlds) and returns null otherwise.
export function ownWorld(req, reply) {
  const w = getDb()
    .prepare('SELECT id FROM worlds WHERE id = ? AND user_id = ?')
    .get(req.params.worldId, req.user.id);
  if (!w) {
    reply.code(404).send({ error: 'World not found.' });
    return null;
  }
  return w;
}
