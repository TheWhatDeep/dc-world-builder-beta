/* ========== MAP / CARTOGRAPHY ========== */
let mapState={placing:null};
function viewMap(){
  const pinned = DB.entities.filter(e=>e.map);
  return `<div class="view active">
    <div class="view-head">
      <div><h1 class="view-title"><span class="dot"></span>Cartography</h1>
      <div class="view-sub">${esc(DB.map.name)} — ${pinned.length} place${pinned.length===1?'':'s'} charted</div></div>
      <div class="view-actions">
        <button class="btn" data-mapname>Rename Map</button>
        <button class="btn" id="uploadMapBtn">${I.map} ${DB.map.image?'Replace':'Upload'} Map Image</button>
        ${DB.map.image?`<button class="btn danger" id="clearMap">Clear</button>`:''}
      </div>
    </div>
    <div class="map-tools" style="position:static;margin-bottom:12px;display:flex">
      <span class="muted" style="font-size:12.5px;align-self:center;margin-right:8px">Pin an entity:</span>
      <select id="pinSelect" style="width:auto;min-width:200px">
        <option value="">— choose a location/character/event —</option>
        ${DB.entities.filter(e=>['place','char','event'].includes(e.type)&&!e.map).map(e=>`<option value="${e.id}">${esc(TYPES[e.type].name)}: ${esc(e.name)}</option>`).join('')}
      </select>
      <button class="btn sm amber" id="startPin" style="margin-left:8px">Place on map →</button>
    </div>
    <div class="map-stage" id="mapStage">
      <div id="mapCanvas"></div>
      ${pinned.map(e=>mapPin(e)).join('')}
      ${!DB.map.image?`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--ink-faint);text-align:center;padding:30px;pointer-events:none">
        ${I.map}<div style="font-family:var(--serif);font-size:21px;color:var(--ink-dim);margin:12px 0 6px">No map image yet</div>
        <p>Upload a map of your world, then pin locations onto it.<br>Or pin onto the blank canvas to sketch spatial relationships.</p></div>`:''}
      <div class="map-hint" id="mapHint">${mapState.placing?`Click anywhere to place <b>${esc(ent(mapState.placing)?.name||'')}</b>`:'Drag pins to reposition · click a pin to inspect'}</div>
    </div>`+(DB.map.image?'':'')+`
  </div>`;
}
function mapPin(e){
  const c=TYPES[e.type].color;
  return `<div class="map-pin" data-pin="${e.id}" style="left:${e.map.x}%;top:${e.map.y}%">
    <svg viewBox="0 0 24 24" fill="${c}" stroke="var(--bg)" stroke-width="1"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5" fill="var(--bg)"/></svg>
    <span class="pin-label">${esc(e.name)}</span>
  </div>`;
}
function initMap(){
  const stage=$('#mapStage'),canvas=$('#mapCanvas'); if(!stage)return;
  if(DB.map.image){ canvas.style.background=`url(${DB.map.image}) center/contain no-repeat`; }
  else { canvas.style.background=`repeating-linear-gradient(45deg,#1a1610,#1a1610 18px,#1d1813 18px,#1d1813 36px)`; }

  $('#uploadMapBtn').onclick=()=>{ pickImage(data=>{ DB.map.image=data; renderView(); toast('Map uploaded'); }); };
  if($('#clearMap')) $('#clearMap').onclick=()=>{ DB.map.image=null; renderView(); };
  if($('[data-mapname]')) $('[data-mapname]').onclick=()=>{ const n=prompt('Map name:',DB.map.name); if(n){DB.map.name=n;renderView();} };

  $('#startPin').onclick=()=>{ const id=$('#pinSelect').value; if(!guard(id,'Choose a location, character, or event to place first.','warn'))return; mapState.placing=id; $('#mapHint').innerHTML=`Click anywhere to place <b>${esc(ent(id).name)}</b>`; stage.style.cursor='crosshair'; notify(`Click the map to place ${ent(id).name}.`, 'info', {ttl:2200}); };

  stage.onclick=ev=>{
    if(!mapState.placing) return;
    if(ev.target.closest('.map-pin')) return;
    const r=stage.getBoundingClientRect();
    const x=((ev.clientX-r.left)/r.width*100), y=((ev.clientY-r.top)/r.height*100);
    const e=ent(mapState.placing); e.map={x,y}; e._t=Date.now(); mapState.placing=null; stage.style.cursor=''; renderView(); toast('Pinned '+e.name);
  };
  // pins: click + drag
  $$('.map-pin',stage).forEach(pin=>{
    const id=pin.dataset.pin; let moved=false,dragging=false;
    pin.onmousedown=ev=>{ ev.stopPropagation(); dragging=true; moved=false; };
    const mv=ev=>{ if(!dragging)return; moved=true; const r=stage.getBoundingClientRect();
      let x=(ev.clientX-r.left)/r.width*100,y=(ev.clientY-r.top)/r.height*100;
      x=Math.max(0,Math.min(100,x));y=Math.max(0,Math.min(100,y));
      pin.style.left=x+'%';pin.style.top=y+'%'; ent(id).map={x,y}; };
    const up=()=>{ if(dragging){dragging=false; if(!moved) openEntity(id); ent(id)._t=Date.now();} };
    pin._mv=mv; pin._up=up;
    window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up);
  });
}
function pickImage(cb){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=()=>{ const f=inp.files[0]; if(!f)return; const rd=new FileReader(); rd.onload=()=>cb(rd.result); rd.readAsDataURL(f); };
  inp.click();
}

/* ========== LIVING SYSTEMS ========== */
function viewSystems(){
  const langs=DB.entities.filter(e=>e.type==='language');
  const chars=DB.entities.filter(e=>e.type==='char');
  return `<div class="view active">
    <div class="view-head">
      <div><h1 class="view-title"><span class="dot"></span>Living Systems</h1>
      <div class="view-sub">The deeper machinery — economy, bloodlines, tongues, and generators</div></div>
    </div>

    <div class="panel">
      <h3>${I.systems} Economy & Resources</h3>
      <div class="panel-sub">What's scarce, what's abundant, what's traded. Scarcity drives conflict and value.</div>
      <div id="econList">${DB.economy.length? DB.economy.map(econRow).join('') : '<p class="muted">No resources tracked. Add what your world trades and covets.</p>'}</div>
      <div class="flex gap mt wrap">
        <input id="econName" placeholder="Resource (e.g. Sunsteel, Spice, Fresh water)" style="flex:2;min-width:180px">
        <select id="econScarcity" style="flex:1;min-width:120px"><option value="90">Abundant</option><option value="60">Common</option><option value="35" selected>Scarce</option><option value="12">Rare</option><option value="4">Legendary</option></select>
        <button class="btn amber" id="addEcon">${I.plus} Add Resource</button>
      </div>
    </div>

    <div class="panel">
      <h3>${I.char} Genealogy</h3>
      <div class="panel-sub">Bloodlines traced from parent/child links between characters</div>
      ${buildGenealogy(chars)}
    </div>

    <div class="panel">
      <h3>${I.language} Languages & Lexicons</h3>
      <div class="panel-sub">Your invented tongues. Open any language to coin words or auto-generate from a phonology.</div>
      ${langs.length? langs.map(l=>`<div class="sys-card">
        <div class="sys-top"><span style="color:${TYPES.language.color};width:18px;height:18px;display:inline-flex">${I.language}</span><h4>${esc(l.name)}</h4><span class="chip">${(l.lang?.words||[]).length} words</span><button class="btn sm" style="margin-left:auto" data-open="${l.id}">Open lexicon</button></div>
        ${(l.lang?.words||[]).length?`<div class="lang-word-grid">${(l.lang.words.slice(0,8)).map(w=>`<div class="lang-word"><span class="lw-con">${esc(w.word)}</span><span class="lw-gloss">${esc(w.gloss)}</span></div>`).join('')}</div>`:''}
      </div>`).join('') : `<p class="muted">No languages yet. <span class="inline-link" data-new="language">Create one →</span></p>`}
    </div>

    <div class="panel">
      <h3>${I.dice} The Generators</h3>
      <div class="panel-sub">Procedural sparks. Click to roll; click any result to copy it.</div>
      <div class="three-col">
        <div>
          <label>Phonology-based names</label>
          <div class="flex gap"><input id="phonoSyl" placeholder="ka,me,tor,vel,sha,un,dra,lo" value="ka,me,tor,vel,sha,un,dra,lo,ith,ar"><button class="btn sm" id="rollNames">${I.dice}</button></div>
          <div id="nameOut" class="gen-out"></div>
        </div>
        <div>
          <label>Settlement names</label>
          <button class="btn sm" id="rollPlaces" style="width:100%">${I.dice} Roll places</button>
          <div id="placeOut" class="gen-out"></div>
        </div>
        <div>
          <label>Plot hooks & omens</label>
          <button class="btn sm" id="rollHooks" style="width:100%">${I.dice} Roll a hook</button>
          <div id="hookOut" class="gen-out"></div>
        </div>
      </div>
    </div>
  </div>`;
}
function econRow(r){
  return `<div class="econ-row" data-econ="${r.id}">
    <span style="width:150px;font-size:14px;color:var(--ink)">${esc(r.name)}</span>
    <div class="econ-bar"><div style="width:${r.scarcity}%"></div></div>
    <span class="econ-val">${r.scarcity>70?'plentiful':r.scarcity>45?'common':r.scarcity>25?'scarce':r.scarcity>8?'rare':'legendary'}</span>
    <span class="rel-x" data-delecon="${r.id}" style="cursor:pointer">${I.x}</span>
  </div>`;
}
function buildGenealogy(chars){
  if(chars.length<2) return '<p class="muted">Add characters and link them with "parent of" / "child of" to grow family trees.</p>';
  // find roots (no parent within set)
  const hasParent=new Set();
  chars.forEach(c=>(c.rels||[]).forEach(r=>{ if(r.type==='child of'&&ent(r.target)) hasParent.add(c.id); }));
  const roots=chars.filter(c=>!hasParent.has(c.id) && (c.rels||[]).some(r=>r.type==='parent of'));
  if(!roots.length) return '<p class="muted">No parent/child links yet. In any character, add a "parent of" relationship to begin a lineage.</p>';
  const seen=new Set();
  function node(c,depth){
    if(seen.has(c.id)) return `<div class="gen-node" style="padding-left:${depth*22}px">${'└─ '.repeat(depth>0?1:0)}<span class="gn-name" data-open="${c.id}">${esc(c.name)}</span> <span class="muted">(↑ shown above)</span></div>`;
    seen.add(c.id);
    let h=`<div class="gen-node" style="padding-left:${depth*22}px">${depth>0?'└─ ':''}<span class="gn-name" data-open="${c.id}">${esc(c.name)}</span>${c.birth!=null?` <span class="muted">b.${c.birth}</span>`:''}</div>`;
    const kids=(c.rels||[]).filter(r=>r.type==='parent of').map(r=>ent(r.target)).filter(Boolean);
    kids.forEach(k=>h+=node(k,depth+1));
    return h;
  }
  return `<div class="gen-tree">${roots.map(r=>node(r,0)).join('')}</div>`;
}

/* ========== NOTES / FREE CODEX ========== */
function viewNotes(){
  return `<div class="view active">
    <div class="view-head">
      <div><h1 class="view-title"><span class="dot"></span>Free Codex</h1>
      <div class="view-sub">Write freely. Type <kbd>[[name]]</kbd> to reference any entity — references stay live.</div></div>
      <div class="view-actions"><span class="muted" id="noteWords" style="font-size:12px;align-self:center"></span></div>
    </div>
    <div class="panel" style="padding:0">
      <textarea id="freeNotes" class="note-editor" spellcheck="true" placeholder="The history of the world begins here…&#10;&#10;Write loosely — myths, fragments, drafts. Drop [[entity names]] in double brackets to bind your prose to the codex. Everything here exports alongside your structured lore.">${esc(DB.notes)}</textarea>
    </div>
    <div class="panel">
      <h4 style="font-size:13px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);margin-bottom:12px">Referenced entities</h4>
      <div id="noteRefs" class="flex gap wrap"></div>
    </div>
  </div>`;
}
function initNotes(){
  const ta=$('#freeNotes'); if(!ta)return;
  const upd=()=>{ DB.notes=ta.value;
    const words=ta.value.trim()?ta.value.trim().split(/\s+/).length:0;
    $('#noteWords').textContent=words+' words';
    // live refs
    const refs=[...ta.value.matchAll(/\[\[([^\]]+)\]\]/g)].map(m=>m[1].trim());
    const uniq=[...new Set(refs)];
    $('#noteRefs').innerHTML = uniq.length? uniq.map(name=>{
      const e=DB.entities.find(x=>x.name.toLowerCase()===name.toLowerCase());
      return e?`<span class="chip" style="cursor:pointer;border-color:${TYPES[e.type].color}66;color:${TYPES[e.type].color}" data-open="${e.id}">${esc(name)}</span>`
              :`<span class="chip" style="border-style:dashed" title="No matching entity — create it?">${esc(name)} <span class="muted">?</span></span>`;
    }).join('') : '<span class="muted" style="font-size:12.5px">No [[references]] yet.</span>';
    $$('#noteRefs [data-open]').forEach(c=>c.onclick=()=>openEntity(c.dataset.open));
  };
  ta.oninput=upd; upd();
}
