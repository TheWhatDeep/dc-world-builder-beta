/* ==========================================================
   API CLIENT
   Thin wrapper over the CODEX backend. Cookie-based session
   (sent automatically, same-origin); every request carries the
   X-Codex-Client header the server's CSRF guard requires.
   ========================================================== */
const Session = { user: null, worldId: null };

const API = (function () {
  const BASE = '';
  const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Codex-Client': '1' };

  async function req(method, url, body) {
    const opts = { method, headers: { ...JSON_HEADERS }, credentials: 'same-origin' };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + url, opts);
    if (res.status === 204) return null;
    const text = await res.text();
    const data = text ? safeParse(text) : null;
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  function safeParse(t) { try { return JSON.parse(t); } catch { return null; } }

  return {
    // auth
    me: () => req('GET', '/api/auth/me'),
    authConfig: () => req('GET', '/api/auth/config'),
    register: (email, password) => req('POST', '/api/auth/register', { email, password }),
    login: (email, password) => req('POST', '/api/auth/login', { email, password }),
    logout: () => req('POST', '/api/auth/logout'),

    // worlds
    listWorlds: () => req('GET', '/api/worlds'),
    createWorld: (meta) => req('POST', '/api/worlds', meta),
    deleteWorld: (id) => req('DELETE', '/api/worlds/' + id),
    getContents: (id) => req('GET', '/api/worlds/' + id + '/contents'),
    putContents: (id, db) => req('PUT', '/api/worlds/' + id + '/contents', db),

    // assets (multipart — no JSON content-type)
    uploadAsset: async (worldId, file, { entityId, kind } = {}) => {
      const fd = new FormData();
      fd.append('file', file);
      const qs = new URLSearchParams();
      if (entityId) qs.set('entity_id', entityId);
      if (kind) qs.set('kind', kind);
      const res = await fetch(`/api/worlds/${worldId}/assets?${qs}`, {
        method: 'POST', headers: { 'X-Codex-Client': '1' }, credentials: 'same-origin', body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || 'Upload failed.');
      return data;
    },
  };
})();
