/* ==========================================================
   DATA LAYER — server-backed (online-only).
   The world lives on the server. We hydrate the in-memory DB
   from /contents on open, and autosave the whole DB back on a
   debounce after any change. A .codex.json file download remains
   available as an offline backup (saveWorld, via Export).
   ========================================================== */
function download(filename, text, mime='text/plain'){
  const blob = new Blob([text],{type:mime});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function slug(s){ return (s||'world').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'world'; }

/* ---- raw backup download (kept for portability / Export modal) ---- */
function saveWorld(){
  DB.meta.saved=Date.now();
  download(slug(DB.meta.name)+'.codex.json', JSON.stringify(DB,null,2), 'application/json');
  toast('Backup downloaded — keep the .codex.json file safe');
}

/* ---- open a world from the server into the in-memory DB ---- */
async function openWorldContents(worldId){
  const contents = await API.getContents(worldId);
  DB = Object.assign(newWorld(), contents);
  Session.worldId = worldId;
  _lastSavedJson = serializeDB();            // freshly loaded == already saved
  UI = { view:'dashboard', selected:null, filterType:'all', search:'',
         canonFilter:'all', graphView:'all', sort:'name',
         journalCampaign:'all', selectedJournal:null };
  applyTheme(DB.meta.theme || 'dark');
  if(typeof hideSplash==='function') hideSplash();
  render();
  attachAutosave();
  setSaveStatus('saved');
}

/* ---- create a new (or demo, or imported) world on the server ---- */
async function createServerWorld(name){
  const meta = await API.createWorld({ name: (name && name.trim()) || 'Untitled World' });
  await openWorldContents(meta.id);
  notify(`Created "${DB.meta.name}".`, 'success');
}
async function createDemoWorld(){
  const demo = seedDemo();
  const meta = await API.createWorld({ name: demo.meta.name || 'Aetheria (Demo)' });
  Session.worldId = meta.id;
  DB = demo;
  await API.putContents(meta.id, DB);
  await openWorldContents(meta.id);
  notify(`Exploring "${DB.meta.name}". Edits save automatically.`, 'info', {ttl:4000});
}

/* ---- import a .codex.json file as a new server world ---- */
function loadWorld(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
  inp.onchange=()=>{ const f=inp.files[0]; if(!f)return; const rd=new FileReader();
    rd.onload=async()=>{ try{ const data=JSON.parse(rd.result);
      if(!data.entities) throw new Error('This file isn\'t a CODEX world (no entities found).');
      const meta = await API.createWorld({ name: (data.meta&&data.meta.name)||'Imported World' });
      Session.worldId = meta.id;
      DB = Object.assign(newWorld(), data);
      await API.putContents(meta.id, DB);
      await openWorldContents(meta.id);
      notify(`Imported "${DB.meta.name}" — ${DB.entities.length} entities.`, 'success');
    }catch(err){ notify('Could not import that file: '+err.message, 'error'); } };
    rd.onerror=()=>notify('Could not read that file — it may be corrupted.', 'error');
    rd.readAsText(f); };
  inp.click();
}

/* ---- return to the world picker (flush first) ---- */
async function returnToPicker(){
  await flushSave();
  Session.worldId = null;
  _lastSavedJson = null;
  showSplash();
}

/* ========== AUTOSAVE ========== */
let _lastSavedJson = null;
let _saveTimer = null;
let _saving = false;
let _dirtyWhileSaving = false;
let _autosaveWired = false;

function serializeDB(){ return JSON.stringify(DB); }

// Update the small topbar status pill, if present.
function setSaveStatus(state){
  const el = document.getElementById('saveStatus');
  if(!el) return;
  const map = { saving:['Saving…','saving'], saved:['Saved','saved'], error:['Save failed','error'], dirty:['Unsaved…','dirty'] };
  const [text, cls] = map[state] || ['', ''];
  el.textContent = text;
  el.className = 'save-status ' + cls;
}

function scheduleSave(){
  if(!Session.worldId) return;
  // Navigation re-renders fire this too; only react when the world actually changed.
  if(serializeDB() === _lastSavedJson) return;
  setSaveStatus('dirty');
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(()=>flushSave(), 1100);
}

// Push the whole DB if it changed since the last successful save.
async function flushSave(showToast){
  if(!Session.worldId) return;
  clearTimeout(_saveTimer);
  const payload = serializeDB();
  if(payload === _lastSavedJson){ setSaveStatus('saved'); if(showToast) toast('Already up to date'); return; }
  if(_saving){ _dirtyWhileSaving = true; return; }
  _saving = true; setSaveStatus('saving');
  try{
    DB.meta.saved = Date.now();
    await API.putContents(Session.worldId, JSON.parse(payload));
    _lastSavedJson = payload;
    setSaveStatus('saved');
    if(showToast) toast('Saved');
  }catch(err){
    setSaveStatus('error');
    notify('Save failed: '+err.message+' (your changes are still here — retrying).', 'error');
    scheduleSave(); // back off and retry
  }finally{
    _saving = false;
    if(_dirtyWhileSaving){ _dirtyWhileSaving = false; scheduleSave(); }
  }
}

// Manual Save button: flush immediately and confirm.
function saveNow(){ flushSave(true); }

// Best-effort flush during tab close (keepalive lets the request outlive the page).
function flushBeacon(){
  if(!Session.worldId) return;
  const payload = serializeDB();
  if(payload === _lastSavedJson) return;
  try{
    fetch('/api/worlds/'+Session.worldId+'/contents', {
      method:'PUT', credentials:'same-origin', keepalive:true,
      headers:{ 'Content-Type':'application/json', 'X-Codex-Client':'1' }, body:payload,
    });
  }catch(e){ /* nothing more we can do on unload */ }
}

// Wrap the central render functions so every mutation (which always re-renders) schedules a
// save. The JSON-equality check in flushSave makes navigation-only renders a no-op. The
// capture-phase input/change listeners catch live field typing.
function attachAutosave(){
  if(_autosaveWired) return;
  _autosaveWired = true;
  ['renderView','renderInspector','renderSidebar'].forEach(name=>{
    const orig = window[name];
    if(typeof orig !== 'function') return;
    window[name] = function(){ const r = orig.apply(this, arguments); scheduleSave(); return r; };
  });
  document.addEventListener('input', scheduleSave, true);
  document.addEventListener('change', scheduleSave, true);
  window.addEventListener('beforeunload', flushBeacon);
}

/* ========== BRANCHES (alternate timelines / what-if) ========== */
function openBranchModal(){
  const ov=$('#modalOverlay');
  ov.innerHTML=`<div class="modal"><div class="modal-head"><h3>${I.graph} Timeline Branches</h3><button class="close" data-mclose>${I.x}</button></div>
  <div class="modal-body">
    <p class="muted" style="margin-bottom:14px">Branch off to explore alternate histories without losing your canon. Snapshots are stored inside this world file.</p>
    <button class="btn amber" id="newBranch" style="width:100%;justify-content:center">${I.plus} Snapshot current world as a branch</button>
    <div class="divider"></div>
    <label>Saved branches</label>
    <div id="branchList">${
      (DB.branches||[]).length? DB.branches.map((b,i)=>`<div class="rel-row" style="margin-bottom:6px">
        <span class="rel-target" style="flex:1">${esc(b.name)}</span>
        <span class="muted" style="font-size:11px">${new Date(b.date).toLocaleDateString()} · ${b.data.entities.length} ent.</span>
        <button class="btn sm" data-restore="${i}">Restore</button>
        <span class="rel-x" data-delbranch="${i}" style="cursor:pointer">${I.x}</span>
      </div>`).join('') : '<p class="muted" style="font-size:12.5px">No branches yet.</p>'
    }</div>
  </div></div>`;
  ov.classList.add('open');
  $('[data-mclose]',ov).onclick=closeModal; ov.onclick=ev=>{if(ev.target===ov)closeModal();};
  $('#newBranch',ov).onclick=()=>{ const name=prompt('Name this branch (e.g. "What if the King had lived"):','Branch '+((DB.branches||[]).length+1)); if(!name)return;
    DB.branches=DB.branches||[]; const snap=JSON.parse(JSON.stringify(DB)); delete snap.branches;
    DB.branches.push({id:uid(),name,date:Date.now(),data:snap}); openBranchModal(); toast('Branch saved'); };
  $$('[data-restore]',ov).forEach(b=>b.onclick=()=>{ if(!confirm('Restore this branch? Current state will be replaced (snapshot it first if unsure).'))return;
    const br=DB.branches[+b.dataset.restore]; const keepBranches=DB.branches; DB=Object.assign(newWorld(),JSON.parse(JSON.stringify(br.data))); DB.branches=keepBranches; closeModal(); render(); toast('Restored: '+br.name); });
  $$('[data-delbranch]',ov).forEach(x=>x.onclick=()=>{ DB.branches.splice(+x.dataset.delbranch,1); openBranchModal(); });
}

/* ========== EXPORT ========== */
function openExportModal(){
  const ov=$('#modalOverlay');
  ov.innerHTML=`<div class="modal"><div class="modal-head"><h3>${I.export} Export Your World</h3><button class="close" data-mclose>${I.x}</button></div>
  <div class="modal-body">
    <p class="muted" style="margin-bottom:16px">Your world is yours. Take it anywhere.</p>
    <label>Scope</label>
    <div class="pill-toggle" id="expScope" style="width:100%;display:flex">
      <button data-scope="all" class="on" style="flex:1">Everything</button>
      <button data-scope="canon" style="flex:1">Canon only</button>
      <button data-scope="player" style="flex:1">Player-facing</button>
    </div>
    <div style="font-size:11px;color:var(--ink-faint);margin-top:6px;font-family:var(--mono)" id="scopeNote">All entities, drafts, notes, systems.</div>
    <label style="margin-top:18px">Format</label>
    <div class="three-col" style="margin-top:6px">
      <button class="type-opt" data-fmt="pdf"><span style="font-family:var(--serif);font-size:22px;color:var(--crimson)">PDF</span><span class="td">Printable codex<br>(via print dialog)</span></button>
      <button class="type-opt" data-fmt="html"><span style="font-family:var(--serif);font-size:22px;color:var(--amber)">HTML</span><span class="td">Standalone<br>browsable wiki</span></button>
      <button class="type-opt" data-fmt="txt"><span style="font-family:var(--serif);font-size:22px;color:var(--sage)">TXT</span><span class="td">Plain text<br>portable lore</span></button>
    </div>
    <div class="divider"></div>
    <button class="btn" id="expJson" style="width:100%;justify-content:center">${I.save} Or download raw data (.codex.json) for backup</button>
  </div></div>`;
  ov.classList.add('open');
  let scope='all';
  $$('[data-scope]',ov).forEach(b=>b.onclick=()=>{ $$('[data-scope]',ov).forEach(x=>x.classList.remove('on')); b.classList.add('on'); scope=b.dataset.scope;
    $('#scopeNote',ov).textContent={all:'All entities, drafts, notes, systems.',canon:'Only canon-status entities and established lore.','player':'Canon entities, hiding GM/author secrets & speculative material.'}[scope]; });
  $$('[data-fmt]',ov).forEach(b=>b.onclick=()=>{ closeModal(); doExport(b.dataset.fmt, scope); });
  $('#expJson',ov).onclick=()=>{ closeModal(); saveWorld(); };
  $('[data-mclose]',ov).onclick=closeModal; ov.onclick=ev=>{if(ev.target===ov)closeModal();};
}

function exportScope(scope){
  let ents=[...DB.entities];
  if(scope==='canon') ents=ents.filter(e=>e.canon==='canon');
  if(scope==='player') ents=ents.filter(e=>e.canon!=='speculative');
  ents.sort((a,b)=>a.type<b.type?-1:a.type>b.type?1:a.name.localeCompare(b.name));
  return ents;
}
function relText(e){
  return (e.rels||[]).map(r=>{const t=ent(r.target);return t?`${r.type} ${t.name}`:null;}).filter(Boolean);
}

/* ---- TXT ---- */
function doExport(fmt, scope){
  if(fmt==='txt') return exportTXT(scope);
  if(fmt==='html') return exportHTML(scope);
  if(fmt==='pdf') return exportPDF(scope);
}
function exportTXT(scope){
  const ents=exportScope(scope); const c=DB.calendar;
  let out=[];
  out.push('═'.repeat(60));
  out.push('  '+DB.meta.name.toUpperCase());
  if(DB.meta.tagline) out.push('  '+DB.meta.tagline);
  out.push('  Compendium · '+new Date().toLocaleDateString()+' · '+scope+' edition');
  out.push('═'.repeat(60),'');
  // calendar
  out.push('CALENDAR & ERAS','-'.repeat(40));
  out.push(`Reckoning: ${c.epoch} · ${c.months.length} months · ${c.daysPerMonth} days/month`);
  out.push('Months: '+c.months.join(', '));
  c.eras.forEach(e=>out.push(`  • ${e.name} (${e.start}–${e.end} ${c.epoch})`));
  out.push('');
  // entities by type
  TYPE_KEYS.forEach(k=>{
    const items=ents.filter(e=>e.type===k); if(!items.length)return;
    out.push('','█ '+TYPES[k].plural.toUpperCase(),'═'.repeat(40));
    items.forEach(e=>{
      out.push('','▶ '+e.name+'   ['+e.canon+']');
      if(e.birth!=null||e.death!=null) out.push('  Span: '+(e.birth??'?')+' – '+(e.death??'present')+' '+c.epoch);
      if(e.when!=null) out.push('  Year: '+e.when+' '+c.epoch);
      if(e.desc) out.push('  '+e.desc.replace(/\n/g,'\n  '));
      const f=e.fields||{}; Object.keys(f).forEach(key=>{if(f[key])out.push('  · '+key+': '+f[key]);});
      const rels=relText(e); if(rels.length) out.push('  Relations: '+rels.join('; '));
      if(e.tags&&e.tags.length) out.push('  Tags: '+e.tags.join(', '));
      if(e.lang&&e.lang.words.length) out.push('  Lexicon: '+e.lang.words.map(w=>w.word+'='+w.gloss).join(', '));
      if(e.map) out.push('  Map: '+Math.round(e.map.x)+'%, '+Math.round(e.map.y)+'%');
    });
  });
  // economy
  if(DB.economy.length){ out.push('','█ ECONOMY & RESOURCES','═'.repeat(40)); DB.economy.forEach(r=>{
    const bits=[econRarity(r)];
    if(r.danger&&r.danger!=='None') bits.push(r.danger+' danger');
    if(r.value) bits.push(r.value);
    out.push('  • '+r.name+' — '+bits.join(' · '));
    if(r.description) out.push('      '+r.description.replace(/\n/g,'\n      '));
  }); }
  // campaign journal (player-facing)
  if(DB.journal.length){ out.push('','█ CAMPAIGN JOURNAL','═'.repeat(40)); [...DB.journal].sort((a,b)=>(a._t||0)-(b._t||0)).forEach(s=>{
    const bits=[]; if(s.date)bits.push(s.date); if(s.year!=null&&s.year!=='')bits.push(s.year+' '+c.epoch);
    out.push('','▶ '+(s.title||'Untitled session')+(s.campaign?'   ['+s.campaign+']':''));
    if(bits.length) out.push('  '+bits.join(' · '));
    if(s.body) out.push('  '+s.body.replace(/\[\[([^\]]+)\]\]/g,'$1').replace(/\n/g,'\n  '));
  }); }
  // notes
  if(DB.notes && scope!=='player'){ out.push('','█ LOREMASTER NOTES','═'.repeat(40),DB.notes); }
  download(slug(DB.meta.name)+'.txt', out.join('\n'));
  toast('Exported as TXT');
}
