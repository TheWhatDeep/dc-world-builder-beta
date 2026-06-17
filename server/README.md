# CODEX Server

Backend for CODEX — a normalized relational store, accounts, and multi-user self-hosting.
The server owns the data (no more single world JSON blob) and also serves the vanilla frontend,
so the whole app runs from one origin.

> Status: **Phase 1 — foundation.** Auth, sessions, and world metadata CRUD are implemented.
> Entity/relationship/asset APIs, search, and the frontend data-layer rewrite land in later phases.

## Quick start (local)

```bash
cd server
npm install
npm run migrate        # create the SQLite schema
npm start              # serves API + frontend on http://localhost:8787
```

On first run with no users, the **first account you register becomes the administrator**.
Open `http://localhost:8787` (once the frontend is wired to the API in a later phase) or hit the
API directly.

## Quick start (Docker)

```bash
docker compose up --build
```

Data (the SQLite DB and uploaded image assets) persists in the `codex-data` volume. To create the
admin automatically, set `CODEX_ADMIN_EMAIL` / `CODEX_ADMIN_PASSWORD` in `docker-compose.yml`.

## Configuration

All via environment variables — see `.env.example`. Highlights:

| Variable | Default | Purpose |
|---|---|---|
| `CODEX_PORT` | `8787` | Listen port |
| `CODEX_DATA_DIR` | `./data` | Where the DB + assets live |
| `CODEX_REGISTRATION_MODE` | `closed` | `closed` (admin creates users) or `open` (anyone signs up) |
| `CODEX_ADMIN_EMAIL` / `CODEX_ADMIN_PASSWORD` | — | First-run admin bootstrap |
| `CODEX_SECURE_COOKIES` | `false` | Set `true` when serving over HTTPS |
| `CODEX_SESSION_TTL_MS` | 30 days | Session lifetime |

## Backups

A self-hosted backup is the **`/data` directory**: the SQLite database *and* the `assets/` image
files. Back up both together.

## Tests

```bash
npm test               # auth, world CRUD, per-user isolation, CSRF
```

## Security notes

- Passwords hashed with scrypt (Node built-in). Sessions are opaque tokens stored hashed;
  cookies are httpOnly + SameSite=Lax (+ Secure when `CODEX_SECURE_COOKIES=true`).
- State-changing requests require an `X-Codex-Client` header (CSRF defense for same-origin SPA).
- Run behind a TLS-terminating reverse proxy (e.g. Caddy/nginx) in production.
