/* ========== SHELL RENDER ========== */
const NAV = [
  {sec:'Atlas', items:[
    {id:'dashboard', label:'Overview', icon:'dash'},
    {id:'graph', label:'Relations Web', icon:'graph'},
    {id:'timeline', label:'Chronicle', icon:'timeline'},
    {id:'map', label:'Cartography', icon:'map'},
    {id:'journal', label:'Campaign Journal', icon:'book'},
  ]},
  {sec:'Codex', items:'TYPES'},   // expands to entity types
  {sec:'Forge', items:[
    {id:'systems', label:'Living Systems', icon:'systems'},
    {id:'consistency', label:'Loremaster', icon:'check'},
    {id:'notes', label:'Free Codex', icon:'notes'},
  ]},
];

function render(){
  const app = $('#app');
  app.innerHTML = `
  <div class="topbar">
    <div class="brand"><span class="glyph">CODEX</span><span class="sub">Worldwright's Archive</span></div>
    <input class="world-name-field" id="worldName" value="${esc(DB.meta.name)}" spellcheck="false">
    <div class="topbar-spacer"></div>
    <button class="tb-btn icon-only" id="btnTheme" title="Toggle light / dark">${I.sun}${I.moon}</button>
    <button class="tb-btn" id="btnBranch" title="Save alternate timeline branch">${I.graph}<span>Branches</span></button>
    <button class="tb-btn" id="btnSave">${I.save}<span>Save</span></button>
    <button class="tb-btn" id="btnLoad">${I.load}<span>Open</span></button>
    <button class="tb-btn primary" id="btnExport">${I.export}<span>Export</span></button>
  </div>
  <div class="body-row">
    <nav class="sidebar" id="sidebar"></nav>
    <main class="main" id="main"></main>
    <aside class="inspector" id="inspector"><div class="insp-inner" id="inspInner"></div></aside>
  </div>`;
  renderSidebar();
  renderView();
  wireShell();
}

function renderSidebar(){
  const counts = {};
  TYPE_KEYS.forEach(k=>counts[k]=DB.entities.filter(e=>e.type===k).length);
  let h='';
  for(const block of NAV){
    h+=`<div class="nav-section"><div class="nav-label">${block.sec}</div>`;
    let items = block.items;
    if(items==='TYPES'){
      items = TYPE_KEYS.map(k=>({id:'type:'+k, label:TYPES[k].plural, icon:TYPES[k].icon, count:counts[k], color:TYPES[k].color}));
    }
    for(const it of items){
      const active = (UI.view===it.id) || (UI.view==='codex' && UI.filterType===(it.id.split(':')[1]));
      const isType = it.id.startsWith('type:');
      h+=`<div class="nav-item ${active?'active':''}" data-nav="${it.id}" ${it.color?`style="--type-c:${it.color}"`:''}>
        <span class="ico" ${it.color?`style="color:${it.color}"`:''}>${I[it.icon]}</span>
        <span>${esc(it.label)}</span>
        ${it.count!==undefined?`<span class="count">${it.count}</span>`:''}
      </div>`;
    }
    h+='</div>';
  }
  // total
  h+=`<div style="margin-top:auto;padding:16px 18px;border-top:1px solid var(--line-soft)">
    <div style="font-family:var(--mono);font-size:10px;color:var(--ink-faint);line-height:1.7">
      ${DB.entities.length} entities<br>${DB.entities.filter(e=>e.canon==='canon').length} canon · ${countRels()} links
    </div></div>`;
  $('#sidebar').innerHTML=h;
  $$('#sidebar .nav-item').forEach(el=>el.onclick=()=>{
    const t=el.dataset.nav;
    if(t.startsWith('type:')){ UI.view='codex'; UI.filterType=t.split(':')[1]; UI.search=''; }
    else { UI.view=t; }
    closeInspector(); renderSidebar(); renderView();
  });
}
function countRels(){ let n=0; DB.entities.forEach(e=>n+=(e.rels||[]).length); return n; }

function renderView(){
  const m = $('#main');
  const v = UI.view;
  if(v==='dashboard') m.innerHTML=viewDashboard();
  else if(v==='codex') m.innerHTML=viewCodex();
  else if(v==='graph') m.innerHTML=viewGraph();
  else if(v==='timeline') m.innerHTML=viewTimeline();
  else if(v==='map') m.innerHTML=viewMap();
  else if(v==='journal') m.innerHTML=viewJournal();
  else if(v==='systems') m.innerHTML=viewSystems();
  else if(v==='consistency') m.innerHTML=viewConsistency();
  else if(v==='notes') m.innerHTML=viewNotes();
  // post-render hooks
  if(v==='graph') initGraph();
  if(v==='map') initMap();
  if(v==='notes') initNotes();
  wireView();
}

/* ========== SHELL WIRING ========== */
function wireShell(){
  $('#worldName').onchange = e=>{ const v=e.target.value.trim()||'Untitled World'; DB.meta.name=v; e.target.value=v; notify('World renamed.', 'success', {ttl:1500}); };
  $('#btnSave').onclick = saveWorld;
  $('#btnLoad').onclick = loadWorld;
  $('#btnExport').onclick = openExportModal;
  $('#btnBranch').onclick = openBranchModal;
  $('#btnTheme').onclick = toggleTheme;
}
