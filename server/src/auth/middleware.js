import { userForToken } from './sessions.js';
import { config } from '../config.js';

// Reads the session cookie and attaches req.user (or null). Registered as a global hook.
export function attachUser(req) {
  const token = req.cookies?.[config.sessionCookie];
  req.user = userForToken(token) || null;
}

// preHandler: require an authenticated user.
export function requireAuth(req, reply, done) {
  if (!req.user) {
    reply.code(401).send({ error: 'Authentication required.' });
    return;
  }
  done();
}

// preHandler: require an admin user.
export function requireAdmin(req, reply, done) {
  if (!req.user) return reply.code(401).send({ error: 'Authentication required.' });
  if (req.user.role !== 'admin') return reply.code(403).send({ error: 'Administrator only.' });
  done();
}

// CSRF defense for cookie-based auth: state-changing requests must carry a custom header
// (browsers won't send it cross-origin without a CORS preflight we don't grant).
export function csrfGuard(req, reply, done) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return done();
  if (req.headers['x-codex-client'] == null) {
    reply.code(403).send({ error: 'Missing client header.' });
    return;
  }
  done();
}
