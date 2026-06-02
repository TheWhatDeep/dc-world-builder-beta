/* ========== MAP / CARTOGRAPHY ========== */
/* entity types that can be charted, and the carousel filter buttons */
const MAP_PINNABLE = ['place','char','event','faction','spell'];
const MAP_FILTERS = [['all','All'],['place','Places'],['char','Characters'],['event','Events'],['faction','Factions'],['spell','Spells']];
let mapState={filter:'all'};
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
    <div class="map-stage" id="mapStage">
      <div id="mapCanvas"></div>
      ${pinned.map(e=>mapPin(e)).join('')}
      ${!DB.map.image?`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--ink-faint);text-align:center;padding:30px;pointer-events:none">
        ${I.map}<div style="font-family:var(--serif);font-size:21px;color:var(--ink-dim);margin:12px 0 6px">No map image yet</div>
        <p>Upload a map of your world, then drag entities from the tray below onto it.<br>Or drop them on the blank canvas to sketch spatial relationships.</p></div>`:''}
      <div class="map-hint" id="mapHint">Drag an entity from the tray onto the map · drag a pin to move it · click a pin to inspect</div>
    </div>
    ${mapCarousel()}
  </div>`;
}
/* the bottom tray: type-filter pills + a horizontal strip of draggable entity chips */
function mapCarousel(){
  return `<div class="map-carousel" id="mapCarousel">
    <div class="map-carousel-filters">
      ${MAP_FILTERS.map(([k,label])=>`<button class="map-filter-pill ${mapState.filter===k?'on':''}" data-mapfilter="${k}">${esc(label)}</button>`).join('')}
    </div>
    <div class="map-carousel-track" id="carouselTrack">${mapChips()}</div>
  </div>`;
}
function mapChips(){
  const f=mapState.filter;
  const list=DB.entities.filter(e=>MAP_PINNABLE.includes(e.type) && (f==='all'||e.type===f));
  if(!list.length) return `<div class="map-carousel-empty">Nothing to chart yet — create some ${f==='all'?'places, characters, events, factions, or spells':TYPES[f].plural.toLowerCase()} first.</div>`;
  return list.map(e=>`<div class="map-chip${e.map?' pinned':''}" draggable="true" data-chip="${e.id}" title="${e.map?'Already on the map — drag to move it':'Drag onto the map to place it'}">
    <span class="mc-ico" style="color:${TYPES[e.type].color}">${I[TYPES[e.type].icon]}</span>
    <span class="mc-name">${esc(e.name)}</span>
    ${e.map?`<span class="mc-badge">${I.check}</span>`:''}
  </div>`).join('');
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

  // drop target: dragging an entity chip onto the stage pins it — or moves it if already pinned.
  // The dragged id travels via dataTransfer, not a module variable.
  stage.addEventListener('dragover', ev=>{ ev.preventDefault(); ev.dataTransfer.dropEffect='copy'; stage.classList.add('drag-over'); });
  stage.addEventListener('dragleave', ev=>{ if(!stage.contains(ev.relatedTarget)) stage.classList.remove('drag-over'); });
  stage.addEventListener('drop', ev=>{
    ev.preventDefault(); stage.classList.remove('drag-over');
    const id=ev.dataTransfer.getData('text/plain'); const e=ent(id); if(!e) return;
    const r=stage.getBoundingClientRect();
    let x=(ev.clientX-r.left)/r.width*100, y=(ev.clientY-r.top)/r.height*100;
    x=Math.max(0,Math.min(100,x)); y=Math.max(0,Math.min(100,y));
    const wasPinned=!!e.map;
    e.map={x,y}; e._t=Date.now(); renderView();
    notify(wasPinned?`Moved ${e.name} on the map.`:`Pinned ${e.name} to the map.`, 'success');
  });

  // carousel: draggable chips + type-filter pills
  wireMapChips();
  $$('[data-mapfilter]').forEach(b=>b.onclick=()=>{ mapState.filter=b.dataset.mapfilter; renderMapCarousel(); });

  // pins: mouse-drag to reposition, click to inspect (existing behavior, preserved)
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
/* (re)wire the carousel chips to the HTML5 drag API */
function wireMapChips(){
  const stage=$('#mapStage');
  $$('#carouselTrack .map-chip').forEach(chip=>{
    chip.addEventListener('dragstart', ev=>{ ev.dataTransfer.setData('text/plain', chip.dataset.chip); ev.dataTransfer.effectAllowed='copyMove'; chip.classList.add('dragging'); });
    chip.addEventListener('dragend', ()=>{ chip.classList.remove('dragging'); stage&&stage.classList.remove('drag-over'); });
  });
}
/* swap carousel contents when a filter pill is clicked (no full re-render) */
function renderMapCarousel(){
  const track=$('#carouselTrack'); if(!track) return;
  $$('[data-mapfilter]').forEach(b=>b.classList.toggle('on', b.dataset.mapfilter===mapState.filter));
  track.innerHTML=mapChips();
  wireMapChips();
}
function pickImage(cb){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=()=>{ const f=inp.files[0]; if(!f)return; const rd=new FileReader(); rd.onload=()=>cb(rd.result); rd.readAsDataURL(f); };
  inp.click();
}

/* ========== LIVING SYSTEMS ========== */
/* resource vocabulary + back-compat helpers (reused by exporters) */
const RARITY = [
  {name:'Abundant',  scarcity:90},
  {name:'Common',    scarcity:60},
  {name:'Scarce',    scarcity:35},
  {name:'Rare',      scarcity:12},
  {name:'Legendary', scarcity:4},
];
const DANGER = ['None','Mild','Significant','Severe','Catastrophic'];
function scarcityFromRarity(name){ const b=RARITY.find(r=>r.name===name); return b?b.scarcity:35; }
function rarityFromScarcity(s){ s=+s; if(s>70)return'Abundant'; if(s>45)return'Common'; if(s>25)return'Scarce'; if(s>8)return'Rare'; return'Legendary'; }
/* an older saved world only has {name,scarcity} — derive the new fields on read */
function econRarity(r){ return r.rarity || rarityFromScarcity(r.scarcity!=null?r.scarcity:35); }
function econScarcity(r){ return r.scarcity!=null ? r.scarcity : scarcityFromRarity(econRarity(r)); }

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
      <div class="flex gap mt">
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
  const rarity=econRarity(r), scar=econScarcity(r);
  const dgr=(r.danger&&r.danger!=='None')
    ? `<span class="econ-danger d-${esc(r.danger.toLowerCase())}">${esc(r.danger)}</span>` : '';
  return `<div class="econ-row" data-econ="${r.id}" style="cursor:pointer"${r.description?` title="${esc(r.description)}"`:''}>
    <span style="width:150px;font-size:14px;color:var(--ink);flex-shrink:0">${esc(r.name)}</span>
    <div class="econ-bar"><div style="width:${scar}%"></div></div>
    ${dgr}
    <span class="econ-val">${esc(rarity)}</span>
  </div>`;
}

/* Add / edit a resource. No id = add mode; an id opens edit mode (pre-filled,
   Save updates, plus a Delete). Mirrors openCalendarModal's modal pattern. */
function openResourceModal(id){
  const editing=!!id;
  const r=editing ? DB.economy.find(x=>x.id===id) : null;
  if(editing && !r) return notify('That resource is no longer tracked.', 'error');
  const rarity0=editing ? econRarity(r) : 'Scarce';
  const scar0=editing ? econScarcity(r) : scarcityFromRarity(rarity0);
  const danger0=(r && r.danger) || 'None';
  const ov=$('#modalOverlay');
  ov.innerHTML=`<div class="modal"><div class="modal-head"><h3>${I.systems} ${editing?'Edit Resource':'Add Resource'}</h3><button class="close" data-mclose>${I.x}</button></div>
    <div class="modal-body">
      <label>Name</label>
      <input id="resName" value="${esc(r?r.name:'')}" placeholder="Sunsteel, Spice, Fresh water…" autocomplete="off">
      <label>Description</label>
      <textarea id="resDesc" placeholder="What is it, and why does it matter?">${esc(r?(r.description||''):'')}</textarea>
      <div class="two-col">
        <div><label>Rarity</label><select id="resRarity">${RARITY.map(b=>`<option value="${b.name}" ${b.name===rarity0?'selected':''}>${b.name}</option>`).join('')}</select></div>
        <div><label>Abundance (0–100)</label><input id="resScar" type="number" min="0" max="100" value="${scar0}" placeholder="—"></div>
      </div>
      <div class="two-col">
        <div><label>Value / price</label><input id="resValue" value="${esc(r?(r.value||''):'')}" placeholder="3 gold pieces, priceless…" autocomplete="off"></div>
        <div><label>Danger level</label><select id="resDanger">${DANGER.map(d=>`<option value="${d}" ${d===danger0?'selected':''}>${d}</option>`).join('')}</select></div>
      </div>
    </div>
    <div class="modal-foot">
      ${editing?`<button class="btn danger" id="resDelete" style="margin-right:auto">${I.trash} Delete</button>`:''}
      <button class="btn" data-mclose>Cancel</button>
      <button class="btn amber" id="resSave">${editing?'Save Changes':'Add Resource'}</button>
    </div></div>`;
  ov.classList.add('open');

  // abundance auto-follows rarity until the user sets it (and never clobbers an existing value)
  let scarTouched = editing && r.scarcity!=null;
  $('#resScar',ov).oninput=()=>{ scarTouched=true; };
  $('#resRarity',ov).onchange=()=>{ if(!scarTouched) $('#resScar',ov).value=scarcityFromRarity($('#resRarity',ov).value); };

  $$('[data-mclose]',ov).forEach(b=>b.onclick=closeModal);
  ov.onclick=ev=>{ if(ev.target===ov) closeModal(); };

  $('#resSave',ov).onclick=()=>{
    const name=$('#resName',ov).value.trim();
    if(!guard(name, 'Name the resource before saving it.', 'warn')) return;
    const dupe=DB.economy.some(x=>x.name.toLowerCase()===name.toLowerCase() && x.id!==(r?r.id:null));
    if(!guard(!dupe, `"${name}" is already tracked.`, 'warn')) return;
    const rarity=$('#resRarity',ov).value;
    const raw=$('#resScar',ov).value;
    const scarcity = raw==='' ? scarcityFromRarity(rarity) : Math.max(0, Math.min(100, Math.round(+raw)||0));
    const data={ name, description:$('#resDesc',ov).value.trim(), rarity, value:$('#resValue',ov).value.trim(), scarcity, danger:$('#resDanger',ov).value };
    if(editing) Object.assign(r, data);
    else DB.economy.push(Object.assign({id:uid()}, data));
    closeModal(); renderView();
    notify(editing?`Updated "${name}".`:`Added "${name}" to the economy.`, 'success');
  };

  if($('#resDelete',ov)) $('#resDelete',ov).onclick=()=>{
    if(!confirm(`Delete resource "${r.name}"? This can't be undone.`)) return;
    const nm=r.name; DB.economy=DB.economy.filter(x=>x.id!==r.id);
    closeModal(); renderView(); notify(`Removed "${nm}".`, 'info');
  };

  setTimeout(()=>{ const n=$('#resName',ov); n&&n.focus(); }, 40);
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
