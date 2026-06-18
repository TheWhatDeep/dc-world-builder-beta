/* ==========================================================
   NOTIFY & THEME
   Typed notifications (success / warn / error / info) and a
   guard() helper so blocked actions always explain themselves.
   Also: light/dark theme toggle, persisted in the world file.
   ========================================================== */

/* ---------- notification icons ---------- */
const NOTE_ICON = {
  success:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m8 12 3 3 5-6"/><circle cx="12" cy="12" r="9"/></svg>',
  warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>',
  error:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
};

/* Ensure a stacking container exists for notifications */
function noteHost(){
  let host = document.getElementById('noteStack');
  if(!host){
    host = document.createElement('div');
    host.id = 'noteStack';
    host.className = 'note-stack';
    document.body.appendChild(host);
  }
  return host;
}

/* Core notification. kind = success|warn|error|info. Returns false for convenience in guards. */
function notify(msg, kind='success', opts={}){
  const host = noteHost();
  const el = document.createElement('div');
  el.className = 'note note-' + kind;
  el.innerHTML = `<span class="note-ico">${NOTE_ICON[kind]||NOTE_ICON.info}</span>
    <span class="note-msg">${esc(msg)}</span>
    <button class="note-close" aria-label="dismiss">${typeof I!=='undefined'?I.x:'×'}</button>`;
  host.appendChild(el);
  // animate in
  requestAnimationFrame(()=>el.classList.add('in'));
  const ttl = opts.ttl ?? (kind==='error'?5200:kind==='warn'?4200:2600);
  const dismiss = ()=>{ el.classList.remove('in'); el.classList.add('out'); setTimeout(()=>el.remove(),320); };
  el._timer = setTimeout(dismiss, ttl);
  el.querySelector('.note-close').onclick = ()=>{ clearTimeout(el._timer); dismiss(); };
  // cap the stack at 4 — drop the oldest
  const all = [...host.children];
  if(all.length>4){ const old=all[0]; clearTimeout(old._timer); old.remove(); }
  return false;
}

/* Backwards-compatible toast(): keep old call sites working, route to success. */
function toast(msg){ return notify(msg, 'success'); }

/* guard(condition, message, kind) — if condition is falsy, notify and return false.
   Lets callers write:  if(!guard(name, 'Name a resource first', 'warn')) return; */
function guard(condition, message, kind='warn'){
  if(condition) return true;
  notify(message, kind);
  return false;
}

/* ---------- THEME ---------- */
const THEMES = ['dark','light'];
function applyTheme(theme){
  const t = THEMES.includes(theme) ? theme : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  if(typeof DB!=='undefined' && DB.meta) DB.meta.theme = t;
  // update any visible toggle label/icon
  const btn = document.getElementById('btnTheme');
  if(btn){
    btn.querySelector('.theme-label') && (btn.querySelector('.theme-label').textContent = t==='dark'?'Light':'Dark');
  }
}
function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur==='dark' ? 'light' : 'dark';
  applyTheme(next);
  if(typeof scheduleSave==='function') scheduleSave();
  notify(next==='light' ? 'Light mode — the scribe\'s daylight' : 'Dark mode — the midnight archive', 'info', {ttl:1800});
}
