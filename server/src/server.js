import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { migrate } from './db/index.js';
import { attachUser, csrfGuard } from './auth/middleware.js';
import { authRoutes, bootstrapAdmin } from './auth/routes.js';
import { worldRoutes } from './worlds/routes.js';

export async function buildApp() {
  const app = Fastify({ logger: { level: process.env.CODEX_LOG_LEVEL || 'info' } });

  await app.register(cookie);

  // Tolerate empty JSON bodies (e.g. DELETE sent with a JSON content-type) instead of 400ing.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (!body || !body.trim()) return done(null, undefined);
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      err.statusCode = 400;
      done(err);
    }
  });

  // Attach req.user from the session cookie, and enforce CSRF on writes, for every request.
  app.addHook('preHandler', (req, reply, done) => {
    attachUser(req);
    done();
  });
  app.addHook('preHandler', csrfGuard);

  await app.register(authRoutes);
  await app.register(worldRoutes);

  // Serve the vanilla frontend so app + API share one origin.
  if (fs.existsSync(path.join(config.frontendDir, 'index.html'))) {
    await app.register(fastifyStatic, { root: config.frontendDir, index: ['index.html'] });
    // SPA-ish fallback: unknown non-API GETs return index.html.
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api')) {
        return reply.sendFile('index.html');
      }
      reply.code(404).send({ error: 'Not found.' });
    });
  }

  return app;
}

async function main() {
  migrate();
  const booted = bootstrapAdmin();
  const app = await buildApp();
  if (booted) app.log.info(`Bootstrapped admin user: ${booted.created}`);
  await app.listen({ port: config.port, host: config.host });
}

// Run only when executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
