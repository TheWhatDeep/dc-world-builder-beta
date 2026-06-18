/* ==========================================================
   SPLASH — auth gate + world picker
   The front door. Before any world renders, the visitor must
   sign in; then they pick (or create) a server-stored world.
   This is an OVERLAY, not a renderView() view.
   ========================================================== */

/* ---------- overlay lifecycle ---------- */
function showSplash(){
  let ov = document.getElementById('splashOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.className='splash';
    ov.id='splashOverlay';
    ov.innerHTML=`<div class="splash-inner">
      <div class="splash-title">CODEX</div>
      <div class="splash-sub">THE WORLDWRIGHT'S ARCHIVE</div>
      <div class="splash-rule"></div>
      <div class="splash-tag">Build the world. Keep the lore.</div>
      <div id="splashChoices"></div>
    </div>`;
    document.body.appendChild(ov);
  } else {
    ov.classList.remove('closing');
  }
  renderSplashBody();
}
function hideSplash(){
  const ov=document.getElementById('splashOverlay');
  if(!ov) return;
  ov.classList.add('closing');
  setTimeout(()=>ov.remove(), 350);
}

/* ---------- decide: auth screen or world picker ---------- */
async function renderSplashBody(){
  const c=document.getElementById('splashChoices');
  if(!c) return;
  c.innerHTML=`<div class="splash-loading">…</div>`;
  if(!Session.user){
    try{ const me = await API.me(); Session.user = me.user; }
    catch(e){ return renderAuth(c); }
  }
  renderPicker(c);
}

/* ---------- auth ---------- */
async function renderAuth(c){
  let cfg = { registrationMode:'closed', needsBootstrap:false };
  try{ cfg = await API.authConfig(); }catch(e){}
  const canRegister = cfg.needsBootstrap || cfg.registrationMode==='open';
  const firstRun = cfg.needsBootstrap;
  c.innerHTML=`<div class="auth-box">
    <div class="auth-msg">${firstRun
      ? 'Create the first account — it becomes the administrator.'
      : 'Sign in to your archive.'}</div>
    <input id="authEmail" type="email" placeholder="you@example.com" autocomplete="username" spellcheck="false">
    <input id="authPass" type="password" placeholder="Password" autocomplete="current-password">
    <div class="auth-actions">
      <button class="btn amber" id="authPrimary">${firstRun?'Create admin':'Sign in'}</button>
      ${canRegister && !firstRun ? `<button class="btn" id="authToggle">Register</button>` : ''}
    </div>
    <div class="auth-err" id="authErr"></div>
  </div>`;
  let mode = firstRun ? 'register' : 'login';
  const email=document.getElementById('authEmail');
  const pass=document.getElementById('authPass');
  const err=document.getElementById('authErr');
  const primary=document.getElementById('authPrimary');
  const toggle=document.getElementById('authToggle');
  const submit=async()=>{
    err.textContent='';
    const e=email.value.trim(), p=pass.value;
    if(!e || !p){ err.textContent='Email and password are required.'; return; }
    primary.disabled=true;
    try{
      const res = mode==='register' ? await API.register(e,p) : await API.login(e,p);
      Session.user = res.user;
      renderPicker(c);
    }catch(ex){ err.textContent = ex.message; primary.disabled=false; }
  };
  primary.onclick=submit;
  pass.onkeydown=ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); submit(); } };
  if(toggle) toggle.onclick=()=>{
    mode = mode==='login' ? 'register' : 'login';
    primary.textContent = mode==='register' ? 'Create account' : 'Sign in';
    toggle.textContent  = mode==='register' ? 'Back to sign in' : 'Register';
    err.textContent='';
  };
  setTimeout(()=>email.focus(), 30);
}

/* ---------- world picker ---------- */
async function renderPicker(c){
  c.innerHTML=`<div class="splash-loading">Loading your worlds…</div>`;
  let worlds=[];
  try{ worlds = await API.listWorlds(); }
  catch(e){ c.innerHTML=`<div class="auth-err">Could not load worlds: ${esc(e.message)}</div>`; return; }

  const list = worlds.length ? `<div class="world-list">${worlds.map(w=>`
    <div class="world-row" data-open="${w.id}">
      <div class="world-row-main">
        <span class="world-row-name">${esc(w.name)}</span>
        <span class="world-row-meta">${w.entity_count} entities · ${w.tagline?esc(w.tagline):'—'}</span>
      </div>
      <span class="world-row-del" data-del="${w.id}" title="Delete world">${I.trash}</span>
    </div>`).join('')}</div>`
    : `<div class="world-empty">No worlds yet — create one to begin.</div>`;

  c.innerHTML=`<div class="picker">
    <div class="picker-head">
      <span class="picker-who">${esc(Session.user.email)}</span>
      <button class="btn sm" id="btnLogout">Sign out</button>
    </div>
    ${list}
    <div class="splash-cards picker-cards">
      <button class="splash-card" data-splash="new">
        <span class="splash-card-ico">${I.plus}</span>
        <span class="splash-card-title">New World</span>
        <span class="splash-card-desc">Begin from a blank slate</span>
      </button>
      <button class="splash-card" data-splash="import">
        <span class="splash-card-ico">${I.load}</span>
        <span class="splash-card-title">Import File</span>
        <span class="splash-card-desc">Upload a .codex.json</span>
      </button>
      <button class="splash-card" data-splash="demo">
        <span class="splash-card-ico">${I.book}</span>
        <span class="splash-card-title">Explore Demo</span>
        <span class="splash-card-desc">Tour Aetheria, the seed world</span>
      </button>
    </div>
  </div>`;

  c.querySelectorAll('[data-open]').forEach(el=>el.onclick=ev=>{
    if(ev.target.closest('[data-del]')) return;
    guardOpen(()=>openWorldContents(el.dataset.open));
  });
  c.querySelectorAll('[data-del]').forEach(el=>el.onclick=async ev=>{
    ev.stopPropagation();
    const w = worlds.find(x=>x.id===el.dataset.del);
    if(!confirm(`Delete "${w?w.name:'this world'}"? This cannot be undone.`)) return;
    try{ await API.deleteWorld(el.dataset.del); renderPicker(c); }
    catch(ex){ notify('Could not delete: '+ex.message,'error'); }
  });
  c.querySelector('[data-splash="new"]').onclick=splashNew;
  c.querySelector('[data-splash="import"]').onclick=()=>loadWorld();
  c.querySelector('[data-splash="demo"]').onclick=()=>guardOpen(createDemoWorld);
  document.getElementById('btnLogout').onclick=async()=>{
    try{ await API.logout(); }catch(e){}
    Session.user=null; Session.worldId=null;
    renderSplashBody();
  };
}

// Wrap an async open/create action with basic error surfacing.
async function guardOpen(fn){
  try{ await fn(); }
  catch(ex){ notify('Could not open world: '+ex.message,'error'); }
}

/* ---------- New World: inline naming panel ---------- */
function splashNew(){
  const c=document.getElementById('splashChoices');
  if(!c) return;
  c.innerHTML=`<div class="splash-name">
    <label class="splash-name-q">What shall this world be called?</label>
    <input id="splashWorldName" type="text" placeholder="Untitled World" spellcheck="false" autocomplete="off">
    <div class="splash-name-actions">
      <button class="btn amber" id="splashBegin">${I.plus} Begin</button>
      <button class="btn" id="splashBack">Back</button>
    </div>
  </div>`;
  const inp=document.getElementById('splashWorldName');
  const go=()=>guardOpen(()=>createServerWorld(inp.value));
  document.getElementById('splashBegin').onclick=go;
  document.getElementById('splashBack').onclick=()=>renderSplashBody();
  inp.onkeydown=ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); go(); } };
  setTimeout(()=>inp.focus(), 30);
}
