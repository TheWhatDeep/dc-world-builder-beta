/* ==========================================================
   SPLASH / LANDING
   The front door. On every page load the user must choose how to
   begin — New World, Open Existing, or Explore Demo — before any
   world renders. This is an OVERLAY, not a renderView() view.
   ========================================================== */

let _guardAttached = false;

/* ---------- overlay lifecycle ---------- */
function showSplash(){
  if(document.getElementById('splashOverlay')) return;        // never double-insert
  const ov=document.createElement('div');
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
  splashCards();
}
function hideSplash(){
  const ov=document.getElementById('splashOverlay');
  if(!ov) return;
  ov.classList.add('closing');
  setTimeout(()=>ov.remove(), 350);
}

/* ---------- the three-card chooser ---------- */
function splashCards(){
  const c=document.getElementById('splashChoices');
  if(!c) return;
  c.innerHTML=`<div class="splash-cards">
    <button class="splash-card" data-splash="new">
      <span class="splash-card-ico">${I.plus}</span>
      <span class="splash-card-title">New World</span>
      <span class="splash-card-desc">Begin from a blank slate</span>
    </button>
    <button class="splash-card" data-splash="open">
      <span class="splash-card-ico">${I.load}</span>
      <span class="splash-card-title">Open Existing</span>
      <span class="splash-card-desc">Load a saved .codex.json</span>
    </button>
    <button class="splash-card" data-splash="demo">
      <span class="splash-card-ico">${I.book}</span>
      <span class="splash-card-title">Explore Demo</span>
      <span class="splash-card-desc">Tour Aetheria, the seed world</span>
    </button>
  </div>`;
  c.querySelector('[data-splash="new"]').onclick=splashNew;
  c.querySelector('[data-splash="open"]').onclick=splashOpen;
  c.querySelector('[data-splash="demo"]').onclick=splashDemo;
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
  const go=()=>splashCreate(inp.value);
  document.getElementById('splashBegin').onclick=go;
  document.getElementById('splashBack').onclick=splashCards;
  inp.onkeydown=ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); go(); } };
  setTimeout(()=>inp.focus(), 30);
}
function splashCreate(name){
  DB = newWorld();
  DB.meta.name = (name && name.trim()) || 'Untitled World';
  UI = { view:'dashboard', selected:null, filterType:'all', search:'',
         canonFilter:'all', graphView:'all', sort:'name',
         journalCampaign:'all', selectedJournal:null };
  applyTheme(DB.meta.theme || (document.documentElement.getAttribute('data-theme')||'dark'));
  hideSplash();
  render();
  attachUnloadGuard();
  notify(`Created "${DB.meta.name}". Save often.`, 'success');
}

/* ---------- Open Existing: mirrors loadWorld(), plus hide+guard ---------- */
function splashOpen(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
  inp.onchange=()=>{ const f=inp.files[0]; if(!f) return; const rd=new FileReader();
    rd.onload=()=>{ try{ const data=JSON.parse(rd.result);
      if(!data.entities) throw new Error('This file isn\'t a CODEX world (no entities found).');
      DB=Object.assign(newWorld(),data); UI={view:'dashboard',selected:null,filterType:'all',search:'',canonFilter:'all',graphView:'all'};
      applyTheme(DB.meta.theme||'dark');
      hideSplash();
      render();
      attachUnloadGuard();
      notify(`Loaded "${DB.meta.name}" — ${DB.entities.length} entities.`, 'success');
    }catch(err){ notify('Could not open that file: '+err.message, 'error'); } };
    rd.onerror=()=>notify('Could not read that file — it may be corrupted.', 'error');
    rd.readAsText(f); };
  inp.click();
}

/* ---------- Explore Demo: load the seeded Aetheria ---------- */
function splashDemo(){
  DB = seedDemo();
  applyTheme(DB.meta.theme || (document.documentElement.getAttribute('data-theme')||'dark'));
  hideSplash();
  render();
  attachUnloadGuard();
  notify(`Exploring "${DB.meta.name}". Feel free to edit and save your own version.`, 'info', {ttl:4000});
}

/* ---------- unsaved-work guard (native "Leave site?" prompt) ---------- */
function attachUnloadGuard(){
  if(_guardAttached) return;
  _guardAttached = true;
  window.addEventListener('beforeunload', function(e){
    e.preventDefault();
    e.returnValue = '';
  });
}
