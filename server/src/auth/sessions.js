import { randomBytes, createHash } from 'node:crypto';
import { getDb } from '../db/index.js';
import { config } from '../config.js';
import { now } from '../util.js';

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

// Creates a session, returns the opaque token to store in the cookie.
export function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const ts = now();
  getDb()
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), userId, ts, ts + config.sessionTtlMs);
  return token;
}

// Returns the user row for a valid, unexpired session token, or null.
export function userForToken(token) {
  if (!token) return null;
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(token));
  if (!session) return null;
  if (session.expires_at < now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(session.token_hash);
    return null;
  }
  return db.prepare('SELECT id, email, role, settings FROM users WHERE id = ?').get(session.user_id) || null;
}

export function destroySession(token) {
  if (!token) return;
  getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}
