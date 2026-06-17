// Centralized config from environment variables (12-factor).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..');

function bool(v, def = false) {
  if (v == null) return def;
  return /^(1|true|yes|on)$/i.test(String(v).trim());
}

export const config = {
  port: parseInt(process.env.CODEX_PORT || '8787', 10),
  host: process.env.CODEX_HOST || '0.0.0.0',

  // Where the SQLite file and uploaded assets live. Defaults to ./data inside server/.
  dataDir: process.env.CODEX_DATA_DIR || path.join(serverRoot, 'data'),
  get dbPath() {
    return process.env.CODEX_DB || path.join(this.dataDir, 'codex.db');
  },
  get assetsDir() {
    return process.env.CODEX_ASSETS_DIR || path.join(this.dataDir, 'assets');
  },

  // Frontend served by the backend so app + API share one origin.
  frontendDir: process.env.CODEX_FRONTEND_DIR || repoRoot,

  // Sessions
  sessionCookie: 'codex_session',
  sessionTtlMs: parseInt(process.env.CODEX_SESSION_TTL_MS || String(30 * 24 * 60 * 60 * 1000), 10),
  secureCookies: bool(process.env.CODEX_SECURE_COOKIES, false),

  // Registration: 'closed' (admin creates users), 'open' (anyone can sign up).
  registrationMode: (process.env.CODEX_REGISTRATION_MODE || 'closed').toLowerCase(),

  // First-run admin bootstrap (optional; great for docker compose).
  adminEmail: process.env.CODEX_ADMIN_EMAIL || '',
  adminPassword: process.env.CODEX_ADMIN_PASSWORD || '',

  // Limits
  maxAssetBytes: parseInt(process.env.CODEX_MAX_ASSET_BYTES || String(25 * 1024 * 1024), 10),
  imageMaxDim: parseInt(process.env.CODEX_IMAGE_MAX_DIM || '2048', 10),
  thumbDim: parseInt(process.env.CODEX_THUMB_DIM || '320', 10),
};
