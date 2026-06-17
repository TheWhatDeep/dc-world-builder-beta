import { getDb } from '../db/index.js';
import { config } from '../config.js';
import { uid, now } from '../util.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { createSession, destroySession } from './sessions.js';
import { requireAuth } from './middleware.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function userCount() {
  return getDb().prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

function publicUser(u) {
  return { id: u.id, email: u.email, role: u.role, settings: safeJson(u.settings) };
}

function safeJson(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}

function setSessionCookie(reply, token) {
  reply.setCookie(config.sessionCookie, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: Math.floor(config.sessionTtlMs / 1000),
  });
}

// Creates a user row. role defaults to 'user'. Returns the row.
export function createUser({ email, password, role = 'user' }) {
  const db = getDb();
  const ts = now();
  const u = {
    id: uid('u_'),
    email: email.toLowerCase().trim(),
    password_hash: hashPassword(password),
    role,
    settings: '{}',
    created_at: ts,
    updated_at: ts,
  };
  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, settings, created_at, updated_at)
     VALUES (@id, @email, @password_hash, @role, @settings, @created_at, @updated_at)`
  ).run(u);
  return u;
}

export async function authRoutes(app) {
  // Tells the frontend how to render the auth screen.
  app.get('/api/auth/config', async () => ({
    registrationMode: config.registrationMode,
    needsBootstrap: userCount() === 0,
  }));

  app.post('/api/auth/register', async (req, reply) => {
    const { email, password } = req.body || {};
    if (!EMAIL_RE.test(email || '')) return reply.code(400).send({ error: 'A valid email is required.' });
    if (!password || String(password).length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters.' });
    }
    const db = getDb();
    const isFirstUser = userCount() === 0;
    // First user always becomes admin (bootstrap). Otherwise honor registration mode.
    if (!isFirstUser && config.registrationMode !== 'open') {
      return reply.code(403).send({ error: 'Registration is closed. Ask an administrator for an account.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) return reply.code(409).send({ error: 'That email is already registered.' });

    const user = createUser({ email, password, role: isFirstUser ? 'admin' : 'user' });
    const token = createSession(user.id);
    setSessionCookie(reply, token);
    return reply.code(201).send({ user: publicUser(user) });
  });

  app.post('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body || {};
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase().trim());
    // Generic error to avoid user enumeration.
    if (!user || !verifyPassword(password || '', user.password_hash)) {
      return reply.code(401).send({ error: 'Invalid email or password.' });
    }
    const token = createSession(user.id);
    setSessionCookie(reply, token);
    return { user: publicUser(user) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    destroySession(req.cookies?.[config.sessionCookie]);
    reply.clearCookie(config.sessionCookie, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/api/auth/me', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'Not authenticated.' });
    return { user: req.user.settings ? { ...req.user, settings: safeJson(req.user.settings) } : req.user };
  });

  // Settings modal persistence.
  app.put('/api/me/settings', { preHandler: requireAuth }, async (req, reply) => {
    const settings = req.body?.settings;
    if (settings == null || typeof settings !== 'object') {
      return reply.code(400).send({ error: 'settings object required.' });
    }
    getDb()
      .prepare('UPDATE users SET settings = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(settings), now(), req.user.id);
    return { settings };
  });
}

// First-run admin bootstrap from env vars (for docker compose).
export function bootstrapAdmin() {
  if (userCount() > 0) return;
  if (config.adminEmail && config.adminPassword) {
    createUser({ email: config.adminEmail, password: config.adminPassword, role: 'admin' });
    return { created: config.adminEmail };
  }
  return null;
}
