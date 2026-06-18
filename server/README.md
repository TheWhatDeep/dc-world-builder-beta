# CODEX Server

Backend for CODEX — a normalized relational store, accounts, and multi-user self-hosting.
The server owns the data (no more single world JSON blob) and also serves the vanilla frontend,
so the whole app runs from one origin.

> Status: **Phase 3 — server-backed client.** Auth, sessions, world CRUD (Phase 1), the
> entity / relationship / search API and image pipeline (Phase 2), and the bulk world
> load/save endpoint the vanilla frontend now runs on (Phase 3). The app is online-only:
> the server owns the data; the client autosaves the whole world on a debounce.

## API overview

All `/api` routes require an authenticated session cookie; writes also require the
`X-Codex-Client` header (CSRF defense). Worlds and their contents are scoped to the owner.

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/api/worlds`, `/api/worlds/:id` | World metadata CRUD (Phase 1) |
| `GET` | `/api/worlds/:worldId/entities` | List/search entities — `?q=` (full-text), `?type=`, `?canon=`, `?sort=`, `?limit=`/`?offset=`. Always paginated. |
| `GET` | `/api/worlds/:worldId/entities/:id` | Full entity (fields, tags, rels, lexicon, assets) |
| `POST/PATCH/DELETE` | `/api/worlds/:worldId/entities/:id` | Entity create/update/delete |
| `GET` | `/api/worlds/:worldId/relationships` | All relationship edges (graph view) |
| `GET` | `/api/worlds/:worldId/contents` | Whole world in the client `DB` shape (frontend load) |
| `PUT` | `/api/worlds/:worldId/contents` | Reconcile the whole world from the client `DB` (frontend save) |
| `POST` | `/api/worlds/:worldId/assets?entity_id=&kind=` | Upload an image (multipart `file`) |
| `GET` | `/api/assets/:id?size=thumb\|display\|original` | Serve an image tier (owner only) |
| `DELETE` | `/api/assets/:id` | Delete an asset and its files |

### Entity shape

The API serializes the relational store back into the shape the vanilla client already
uses, so the data-layer swap is storage-only, not a model change:

```jsonc
{
  "id": "e_…", "type": "char", "name": "…", "desc": "…", "canon": "canon",
  "tags": ["…"], "fields": { "Title": "…" }, "rels": [{ "type": "member of", "target": "e_…" }],
  "birth": 1180, "death": 1240, "when": null, "mana": null, "created": null,
  "map": { "x": 12.5, "y": 40.0 }, "lang": { "words": [{ "word": "…", "gloss": "…" }] },
  "assets": [{ "id": "a_…", "url": "…", "thumb_url": "…", "original_url": "…" }]
}
```

### Image pipeline

Each upload yields three tiers so clients (especially mobile/cellular) fetch only what they
need: the **original** bytes (preserved for export fidelity), a **display** webp bounded to
`CODEX_IMAGE_MAX_DIM`, and a **thumbnail** webp bounded to `CODEX_THUMB_DIM`. Uploads over
`CODEX_MAX_ASSET_BYTES` are rejected (413); non-images are rejected (415).

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
npm test               # auth, CRUD, isolation, CSRF, entities, search, images, contents round-trip
```

## Security notes

- Passwords hashed with scrypt (Node built-in). Sessions are opaque tokens stored hashed;
  cookies are httpOnly + SameSite=Lax (+ Secure when `CODEX_SECURE_COOKIES=true`).
- State-changing requests require an `X-Codex-Client` header (CSRF defense for same-origin SPA).
- Run behind a TLS-terminating reverse proxy (e.g. Caddy/nginx) in production.
