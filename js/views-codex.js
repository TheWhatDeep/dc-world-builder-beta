/* ========== DASHBOARD ========== */
function viewDashboard(){
  const total = DB.entities.length;
  const byType = TYPE_KEYS.map(k=>({k,n:DB.entities.filter(e=>e.type===k).length})).filter(x=>x.n>0);
  const canon = DB.entities.filter(e=>e.canon==='canon').length;
  const recent = [...DB.entities].sort((a,b)=>(b._t||0)-(a._t||0)).slice(0,6);
  const issues = runChecks();
  return `
  <div class="view active">
    <div class="view-head">
      <div>
        <h1 class="view-title"><span class="dot"></span>${esc(DB.meta.name)}</h1>
        <div class="view-sub">${esc(DB.meta.tagline||'an unwritten realm')}</div>
      </div>
      <div class="view-actions">
        <button class="btn" data-tagline>${I.book} Set Tagline</button>
        <button class="btn amber" data-new>${I.plus} New Entity</button>
      </div>
    </div>
    <div class="stat-row">
      <div class="stat-card"><div class="sc-num">${total}</div><div class="sc-lab">Entities</div></div>
      <div class="stat-card"><div class="sc-num">${countRels()}</div><div class="sc-lab">Connections</div></div>
      <div class="stat-card"><div class="sc-num">${canon}</div><div class="sc-lab">Canon</div></div>
      <div class="stat-card"><div class="sc-num">${DB.calendar.eras.length}</div><div class="sc-lab">Eras</div></div>
      <div class="stat-card"><div class="sc-num" style="color:${issues.length?'var(--amber)':'var(--sage)'}">${issues.length}</div><div class="sc-lab">Lore Flags</div></div>
    </div>
    <div class="two-col" style="align-items:start">
      <div class="panel">
        <h3>${I.globe} The Census</h3>
        <div class="panel-sub">Composition of your world by category</div>
        ${byType.length? byType.map(x=>{
          const pct = Math.round(x.n/total*100);
          return `<div class="econ-row" style="cursor:pointer" data-gotype="${x.k}">
            <span style="width:96px;font-size:13px;color:${TYPES[x.k].color}">${TYPES[x.k].plural}</span>
            <div class="econ-bar"><div style="width:${pct}%;background:linear-gradient(90deg,${TYPES[x.k].color}88,${TYPES[x.k].color})"></div></div>
            <span class="econ-val">${x.n}</span>
          </div>`;
        }).join('') : `<p class="muted">No entities yet. Begin your world below.</p>`}
      </div>
      <div class="panel">
        <h3>${I.notes} Recently Touched</h3>
        <div class="panel-sub">Jump back into what you were shaping</div>
        ${recent.length? `<div class="rel-list">`+recent.map(e=>`
          <div class="rel-row" style="cursor:pointer" data-open="${e.id}">
            <span style="color:${TYPES[e.type].color};width:18px;height:18px;display:inline-flex">${I[TYPES[e.type].icon]}</span>
            <span class="rel-target">${esc(e.name)}</span>
            <span class="chip ${e.canon}">${e.canon}</span>
          </div>`).join('')+`</div>` : `<p class="muted">Nothing yet.</p>`}
      </div>
    </div>
    <div class="panel">
      <h3>${I.dice} Quick Forge</h3>
      <div class="panel-sub">Spark ideas — names, hooks, and prompts to seed your world</div>
      <div class="flex gap wrap">
        <button class="btn" data-spark="name">Generate Names</button>
        <button class="btn" data-spark="place">Place Names</button>
        <button class="btn" data-spark="hook">Plot Hook</button>
        <button class="btn" data-spark="faction">Faction Seed</button>
        <button class="btn" data-spark="prompt">Worldbuilding Prompt</button>
      </div>
      <div id="sparkOut" class="gen-out"></div>
    </div>
  </div>`;
}

/* ========== CODEX (entity browser) ========== */
function viewCodex(){
  const t = UI.filterType;
  const meta = TYPES[t] || {name:'All',plural:'All Entities',color:'#d9a441'};
  let list = DB.entities.filter(e=>t==='all'||e.type===t);
  if(UI.canonFilter!=='all') list=list.filter(e=>e.canon===UI.canonFilter);
  if(UI.search){ const q=UI.search.toLowerCase(); list=list.filter(e=>
    e.name.toLowerCase().includes(q) || (e.desc||'').toLowerCase().includes(q) ||
    (e.tags||[]).some(tg=>tg.toLowerCase().includes(q)) ||
    JSON.stringify(e.fields||{}).toLowerCase().includes(q)
  );}
  sortEntities(list);
  return `
  <div class="view active">
    <div class="view-head">
      <div>
        <h1 class="view-title"><span class="dot" style="background:${meta.color}"></span>${esc(meta.plural)}</h1>
        <div class="view-sub">${list.length} ${list.length===1?'entry':'entries'} in this register</div>
      </div>
      <div class="view-actions">
        <button class="btn amber" data-new="${t!=='all'?t:''}">${I.plus} New ${t!=='all'?esc(meta.name):'Entity'}</button>
      </div>
    </div>
    <div class="toolbar">
      <div class="search-box">${I.search}<input id="codexSearch" placeholder="Search names, descriptions, tags, fields…" value="${esc(UI.search)}"></div>
      <button class="filter-pill ${UI.canonFilter==='all'?'on':''}" data-canon="all">All</button>
      <button class="filter-pill ${UI.canonFilter==='canon'?'on':''}" data-canon="canon">● Canon</button>
      <button class="filter-pill ${UI.canonFilter==='draft'?'on':''}" data-canon="draft">● Draft</button>
      <button class="filter-pill ${UI.canonFilter==='speculative'?'on':''}" data-canon="speculative">● Speculative</button>
      <select id="codexSort" style="width:auto;margin-left:auto;flex:0 0 auto" title="Sort entries">
        <option value="name" ${UI.sort==='name'?'selected':''}>A–Z</option>
        <option value="recent" ${UI.sort==='recent'?'selected':''}>Recently edited</option>
        <option value="connected" ${UI.sort==='connected'?'selected':''}>Most connected</option>
        <option value="canon" ${UI.sort==='canon'?'selected':''}>By canon status</option>
      </select>
    </div>
    ${list.length? `<div class="card-grid">`+list.map(entCard).join('')+`</div>` : (UI.search? noMatch() : emptyState(meta))}
  </div>`;
}
function noMatch(){
  return `<div class="empty">${I.search}
    <div class="big">Nothing matches "${esc(UI.search)}"</div>
    <p class="muted">Try a different term, or clear the search to see everything.</p>
  </div>`;
}
function sortEntities(list){
  const s=UI.sort||'name';
  if(s==='name') list.sort((a,b)=>a.name.localeCompare(b.name));
  else if(s==='recent') list.sort((a,b)=>(b._t||0)-(a._t||0));
  else if(s==='connected') list.sort((a,b)=>((b.rels||[]).length)-((a.rels||[]).length)||a.name.localeCompare(b.name));
  else if(s==='canon'){ const order={canon:0,draft:1,speculative:2}; list.sort((a,b)=>(order[a.canon]-order[b.canon])||a.name.localeCompare(b.name)); }
  return list;
}
function entCard(e){
  const meta = TYPES[e.type];
  const rels = (e.rels||[]).length;
  return `<div class="ent-card" data-open="${e.id}" style="--type-color:${meta.color}">
    <div class="ec-top">
      <span class="ec-type">${esc(meta.name)}</span>
      <span class="chip ${e.canon}">${e.canon[0].toUpperCase()}</span>
    </div>
    <h3>${esc(e.name)}</h3>
    <div class="ec-desc">${esc(e.desc)||'<span class="muted">No description yet…</span>'}</div>
    <div class="ec-foot">
      ${(e.tags||[]).slice(0,3).map(t=>`<span class="chip">${esc(t)}</span>`).join('')}
      ${rels?`<span class="ec-rel">${I.link.replace('width="1.7"','width="1.4"')} ${rels}</span>`:''}
    </div>
  </div>`;
}
function emptyState(meta){
  return `<div class="empty">${I.book}
    <div class="big">No ${esc(meta.plural.toLowerCase())} yet</div>
    <p class="muted">Every world begins with a single name. Create your first entry to weave it into the web.</p>
    <button class="btn amber" style="margin-top:18px" data-new="${UI.filterType!=='all'?UI.filterType:''}">${I.plus} Create one</button>
  </div>`;
}
