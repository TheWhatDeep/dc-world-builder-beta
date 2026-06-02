/* ========== INSPECTOR (entity editor) ========== */
function openEntity(id){
  UI.selected = id;
  const insp = $('#inspector');
  insp.classList.add('open');
  renderInspector();
}
function closeInspector(){ $('#inspector')?.classList.remove('open'); UI.selected=null; }

function renderInspector(){
  const e = ent(UI.selected); if(!e){ closeInspector(); return; }
  const meta = TYPES[e.type];
  const inner = $('#inspInner');
  // temporal label helper
  const isTemporal = ['char','creature','faction','culture'].includes(e.type);
  const isDated = e.type==='event';

  inner.innerHTML = `
  <div class="insp-head" style="border-bottom-color:${meta.color}55">
    <span style="color:${meta.color};width:20px;height:20px;display:inline-flex">${I[meta.icon]}</span>
    <strong style="font-family:var(--serif);font-size:15px">${esc(meta.name)}</strong>
    <button class="close" id="inspClose">${I.x}</button>
  </div>
  <div class="insp-body">
    <label>Name</label>
    <input id="f_name" value="${esc(e.name)}" placeholder="True name…">

    <label>Canon Status</label>
    <div class="pill-toggle" id="f_canon">
      <button data-c="canon" class="${e.canon==='canon'?'on':''}">Canon</button>
      <button data-c="draft" class="${e.canon==='draft'?'on':''}">Draft</button>
      <button data-c="speculative" class="${e.canon==='speculative'?'on':''}">Maybe</button>
    </div>

    <label>Description</label>
    <textarea id="f_desc" placeholder="Describe freely — link entities as @name. Tag anything later.">${esc(e.desc)}</textarea>
    <div style="font-size:10.5px;color:var(--ink-faint);margin-top:4px;font-family:var(--mono)">Tip: type <kbd>@</kbd> then a name in text to auto-suggest a link.</div>

    ${isTemporal?`
    <div class="two-col">
      <div><label>Born / Founded (year)</label><input id="f_birth" type="number" value="${e.birth??''}" placeholder="—"></div>
      <div><label>Died / Dissolved</label><input id="f_death" type="number" value="${e.death??''}" placeholder="—"></div>
    </div>`:''}
    ${isDated?`<label>Year occurred</label><input id="f_when" type="number" value="${e.when??''}" placeholder="—">`:''}
    ${e.type==='spell'?renderSpellSection(e):''}

    <div class="detail-section">
      <h4>${I.link} Relationships</h4>
      <div class="rel-list" id="relList">
        ${(e.rels||[]).map((r,i)=>{
          const tgt=ent(r.target);
          return `<div class="rel-row">
            <span class="rel-type">${esc(r.type)}</span>
            <span class="rel-target" data-open="${r.target}">${tgt?esc(tgt.name):'<i class="muted">missing</i>'}</span>
            <span class="rel-x" data-delrel="${i}">${I.x}</span>
          </div>`;
        }).join('') || '<p class="muted" style="font-size:12.5px">No links yet — bind this to the web below.</p>'}
      </div>
      <div class="flex gap" style="margin-top:9px">
        <select id="relType" style="flex:0 0 42%">${REL_TYPES.map(r=>`<option>${r}</option>`).join('')}</select>
        <select id="relTarget" style="flex:1">${relTargetOptions(e.id)}</select>
        <button class="btn sm amber" id="addRel">${I.plus}</button>
      </div>
      ${renderIncoming(e)}
    </div>

    <div class="detail-section">
      <h4>${I.notes} Custom Fields</h4>
      <div id="fieldList">${renderCustomFields(e)}</div>
      <div class="flex gap" style="margin-top:9px">
        <input id="newFieldKey" placeholder="Field name (e.g. Climate, Allegiance)" style="flex:1">
        <button class="btn sm" id="addField">${I.plus} Add</button>
      </div>
    </div>

    <div class="detail-section">
      <h4>Tags</h4>
      <div class="tag-input-wrap" id="tagWrap">
        ${(e.tags||[]).map((t,i)=>`<span class="tag">${esc(t)}<span class="x" data-deltag="${i}">×</span></span>`).join('')}
        <input id="tagInput" placeholder="add tag…">
      </div>
    </div>
    ${renderNoteBacklinks(e)}

    ${e.type==='language'?renderLangSection(e):''}
    ${(e.type==='place'||e.type==='char'||e.type==='event')?`
    <div class="detail-section">
      <h4>${I.map} Atlas Pin</h4>
      ${e.map?`<p style="font-size:12.5px;color:var(--ink-dim)">Pinned at ${Math.round(e.map.x)}%, ${Math.round(e.map.y)}% — <span class="inline-link" data-gomap>view on map</span></p>
        <button class="btn sm danger" data-unpin style="margin-top:8px">Remove pin</button>`
        :`<p class="muted" style="font-size:12.5px">Not placed. Open <span class="inline-link" data-gomap>Cartography</span> and click the map to pin.</p>`}
    </div>`:''}

    <div class="divider"></div>
    <div class="flex gap jcb aic">
      <div class="flex gap">
        <button class="btn sm danger" id="delEnt">${I.trash} Delete</button>
        <button class="btn sm" id="cloneEnt" title="Duplicate this entity">${I.copy} Clone</button>
      </div>
      <span style="font-size:10px;color:var(--ink-faint);font-family:var(--mono)">id ${e.id}</span>
    </div>
  </div>`;
  wireInspector(e);
}

/* incoming relationships — what points AT this entity (read-only, jump-to) */
function renderIncoming(e){
  const incoming=[];
  DB.entities.forEach(o=>{ if(o.id===e.id) return; (o.rels||[]).forEach(r=>{ if(r.target===e.id) incoming.push({from:o,type:r.type}); }); });
  if(!incoming.length) return '';
  return `<div style="margin-top:12px">
    <div style="font-size:10px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);margin-bottom:6px">Referenced by</div>
    <div class="rel-list">${incoming.map(r=>`<div class="rel-row" style="opacity:.85">
      <span class="rel-target" data-open="${r.from.id}">${esc(r.from.name)}</span>
      <span class="rel-type" style="min-width:auto;text-align:right;flex:1">${esc(r.type)} this</span>
    </div>`).join('')}</div>
  </div>`;
}

/* note backlinks — where this entity is [[referenced]] in the Free Codex */
function renderNoteBacklinks(e){
  if(!DB.notes) return '';
  const re=/\[\[([^\]]+)\]\]/g; let m, hit=false;
  while((m=re.exec(DB.notes))){ if(m[1].trim().toLowerCase()===e.name.toLowerCase()){ hit=true; break; } }
  if(!hit) return '';
  return `<div class="detail-section">
    <h4>${I.notes} In the Free Codex</h4>
    <p style="font-size:12.5px;color:var(--ink-dim)">This entity is referenced in your lore notes. <span class="inline-link" data-gonotes>Open the Free Codex →</span></p>
  </div>`;
}

function relTargetOptions(selfId){
  const groups = TYPE_KEYS.map(k=>{
    const items = DB.entities.filter(e=>e.type===k && e.id!==selfId);
    if(!items.length) return '';
    return `<optgroup label="${TYPES[k].plural}">`+items.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')+`</optgroup>`;
  }).join('');
  return `<option value="">— link to —</option>`+groups;
}
function renderCustomFields(e){
  const f = e.fields||{};
  const keys = Object.keys(f);
  if(!keys.length) return '<p class="muted" style="font-size:12.5px">No custom fields. Add traits like Race, Motive, Founding, Material…</p>';
  return keys.map(k=>`<div class="field-group" style="margin-bottom:8px">
    <label style="margin:6px 0 3px">${esc(k)} <span class="x" data-delfield="${esc(k)}" style="float:right;cursor:pointer;color:var(--ink-faint)">×</span></label>
    <input data-fieldkey="${esc(k)}" value="${esc(f[k])}">
  </div>`).join('');
}
function renderLangSection(e){
  const words = e.lang?.words||[];
  return `<div class="detail-section">
    <h4>${I.language} Lexicon</h4>
    <div class="lang-word-grid" id="lexGrid">
      ${words.map((w,i)=>`<div class="lang-word"><span class="lw-con">${esc(w.word)}</span><span class="lw-gloss">${esc(w.gloss)} <span class="x" data-delword="${i}" style="cursor:pointer;color:var(--ink-faint)">×</span></span></div>`).join('') || '<p class="muted" style="font-size:12px">No words coined yet.</p>'}
    </div>
    <div class="flex gap" style="margin-top:9px">
      <input id="lexWord" placeholder="word" style="flex:1">
      <input id="lexGloss" placeholder="meaning" style="flex:1">
      <button class="btn sm" id="addWord">${I.plus}</button>
    </div>
    <button class="btn sm" id="genLexicon" style="margin-top:8px">${I.dice} Generate 8 words from a phonology</button>
  </div>`;
}
/* spell-only fields. Creator is derived from the "created" relationship (the
   relationship is the source of truth — no separate creatorId is stored). */
function spellCreatorId(e){
  for(const c of DB.entities){
    if(c.type!=='char') continue;
    if((c.rels||[]).some(r=>r.type==='created' && r.target===e.id)) return c.id;
  }
  return '';
}
function renderSpellSection(e){
  const creatorId = spellCreatorId(e);
  const chars = DB.entities.filter(c=>c.type==='char');
  return `<div class="two-col">
    <div><label>Mana cost</label><input id="f_mana" type="number" value="${e.mana??''}" placeholder="—"></div>
    <div><label>Year created (optional)</label><input id="f_created" type="number" value="${e.created??''}" placeholder="—"></div>
  </div>
  <label>Creator</label>
  <select id="f_creator">
    <option value="">— unknown —</option>
    ${chars.map(c=>`<option value="${c.id}" ${c.id===creatorId?'selected':''}>${esc(c.name)}</option>`).join('')}
  </select>`;
}

function wireInspector(e){
  $('#inspClose').onclick = closeInspector;
  const save = (k,v)=>{ e[k]=v; e._t=Date.now(); };
  $('#f_name').oninput = ev=>{ save('name',ev.target.value); renderSidebarSoft(); };
  $('#f_name').onchange = ()=>{ if(UI.view==='codex'||UI.view==='dashboard') renderView(); };
  $('#f_desc').oninput = ev=>save('desc',ev.target.value);
  $$('#f_canon button').forEach(b=>b.onclick=()=>{ save('canon',b.dataset.c); renderInspector(); renderSidebarSoft(); if(UI.view==='codex')renderView(); });
  if($('#f_birth')) $('#f_birth').oninput=ev=>save('birth',ev.target.value===''?null:+ev.target.value);
  if($('#f_death')) $('#f_death').oninput=ev=>save('death',ev.target.value===''?null:+ev.target.value);
  if($('#f_when'))  $('#f_when').oninput =ev=>save('when', ev.target.value===''?null:+ev.target.value);

  // spell-only fields (mana, year created, creator)
  if($('#f_mana'))    $('#f_mana').oninput    = ev=>save('mana',    ev.target.value===''?null:+ev.target.value);
  if($('#f_created')) $('#f_created').oninput = ev=>save('created', ev.target.value===''?null:+ev.target.value);
  if($('#f_creator')) $('#f_creator').onchange = ev=>{
    const newId = ev.target.value;
    const oldId = spellCreatorId(e);
    if(newId===oldId) return;
    // sever the previous creator's "created" link (and its inverse on this spell)
    if(oldId){
      const oc = ent(oldId);
      if(oc){
        removeInverse(oc.id, {type:'created', target:e.id});
        oc.rels = (oc.rels||[]).filter(x=>!(x.type==='created' && x.target===e.id));
      }
    }
    // attach the new creator (mirrors the addRel pattern, with reciprocal)
    if(newId){
      const nc = ent(newId);
      if(nc){
        nc.rels = nc.rels||[];
        if(!nc.rels.some(x=>x.type==='created' && x.target===e.id)){
          nc.rels.push({type:'created', target:e.id});
          addInverse(nc.id, 'created', e.id);
        }
      }
    }
    e._t=Date.now();
    const nc = newId?ent(newId):null;
    notify(nc ? `${nc.name} is now credited as the creator of ${e.name||'this spell'}.`
              : `Creator cleared for ${e.name||'this spell'}.`, nc?'success':'info');
    renderInspector();
  };

  // relationships (bidirectional)
  $('#addRel').onclick = ()=>{
    const type=$('#relType').value, target=$('#relTarget').value;
    if(!guard(target, 'Choose an entity to link to first.', 'warn')) return;
    const tgt = ent(target);
    if(!guard(tgt, 'That entity no longer exists — try another.', 'error')) return;
    e.rels=e.rels||[];
    if(e.rels.some(r=>r.type===type && r.target===target))
      return notify(`${e.name} is already "${type}" ${tgt.name}.`, 'warn');
    e.rels.push({type,target});
    const madeInverse = addInverse(e.id, type, target);
    e._t=Date.now(); renderInspector();
    notify(madeInverse
      ? `Linked: ${e.name} "${type}" ${tgt.name} (and the reverse).`
      : `Linked: ${e.name} "${type}" ${tgt.name}.`, 'success');
  };
  $$('#relList [data-delrel]').forEach(x=>x.onclick=()=>{
    const i=+x.dataset.delrel; const r=e.rels[i]; const tgt=ent(r.target);
    removeInverse(e.id, r); e.rels.splice(i,1); renderInspector();
    notify(`Unlinked ${tgt?('"'+r.type+'" '+tgt.name):'relationship'}.`, 'info');
  });
  $$('#relList [data-open]').forEach(x=>x.onclick=()=>openEntity(x.dataset.open));

  // custom fields
  $('#addField').onclick = ()=>{
    const k=$('#newFieldKey').value.trim();
    if(!guard(k, 'Name the field before adding it (e.g. Climate, Allegiance).', 'warn')) return;
    e.fields=e.fields||{};
    if(k in e.fields) return notify(`"${k}" is already a field on ${e.name}.`, 'warn');
    e.fields[k]='';
    e._t=Date.now(); renderInspector();
    notify(`Added field "${k}".`, 'success');
    setTimeout(()=>{ const inp=$(`[data-fieldkey="${CSS.escape(k)}"]`); inp&&inp.focus(); },30);
  };
  $$('[data-fieldkey]').forEach(inp=>inp.oninput=()=>{ e.fields[inp.dataset.fieldkey]=inp.value; e._t=Date.now(); });
  $$('[data-delfield]').forEach(x=>x.onclick=()=>{ const k=x.dataset.delfield; delete e.fields[k]; renderInspector(); notify(`Removed field "${k}".`, 'info'); });

  // tags
  const tagAdd = v=>{
    v=v.trim();
    if(!guard(v, 'Type a tag, then press Enter.', 'warn')) return;
    e.tags=e.tags||[];
    if(e.tags.some(t=>t.toLowerCase()===v.toLowerCase())) return notify(`"${v}" is already a tag here.`, 'warn');
    e.tags.push(v); e._t=Date.now(); renderInspector();
    notify(`Tagged "${v}".`, 'success'); $('#tagInput').focus();
  };
  $('#tagInput').onkeydown = ev=>{ if(ev.key==='Enter'||ev.key===','){ ev.preventDefault(); tagAdd($('#tagInput').value); } };
  $$('[data-deltag]').forEach(x=>x.onclick=()=>{ const t=e.tags[+x.dataset.deltag]; e.tags.splice(+x.dataset.deltag,1); renderInspector(); notify(`Removed tag "${t}".`, 'info'); });

  // language
  if($('#addWord')) $('#addWord').onclick=()=>{
    const w=$('#lexWord').value.trim(), g=$('#lexGloss').value.trim();
    if(!guard(w, 'Enter the word itself before adding it.', 'warn')) return;
    if(!guard(g, 'Give the word a meaning so the lexicon stays useful.', 'warn')) return;
    e.lang=e.lang||{words:[]};
    if(e.lang.words.some(x=>x.word.toLowerCase()===w.toLowerCase())) return notify(`"${w}" is already in this lexicon.`, 'warn');
    e.lang.words.push({word:w,gloss:g}); renderInspector();
    notify(`Coined "${w}" — ${g}.`, 'success');
  };
  $$('[data-delword]').forEach(x=>x.onclick=()=>{ const w=e.lang.words[+x.dataset.delword]; e.lang.words.splice(+x.dataset.delword,1); renderInspector(); notify(`Removed "${w.word}".`, 'info'); });
  if($('#genLexicon')) $('#genLexicon').onclick=()=>{ genLexiconFor(e); };

  // map pin shortcuts
  $$('[data-gomap]').forEach(x=>x.onclick=()=>{ UI.view='map'; renderSidebar(); renderView(); });
  $$('[data-gonotes]').forEach(x=>x.onclick=()=>{ UI.view='notes'; closeInspector(); renderSidebar(); renderView(); });
  if($('[data-unpin]')) $('[data-unpin]').onclick=()=>{ delete e.map; renderInspector(); notify(`${e.name} removed from the map.`, 'info'); };

  if($('#cloneEnt')) $('#cloneEnt').onclick=()=>{
    const copy=JSON.parse(JSON.stringify(e));
    copy.id=uid(); copy.name=(e.name||'Unnamed')+' (copy)'; copy._t=Date.now();
    delete copy.map; // don't stack pins on top of each other
    DB.entities.push(copy);
    renderSidebar(); renderView(); openEntity(copy.id);
    notify(`Cloned "${e.name}" — relationships copied, map pin cleared.`, 'success');
  };

  $('#delEnt').onclick = ()=>{
    const links = countLinksTo(e.id);
    const warnTxt = links
      ? `Delete "${e.name}"? It's linked from ${links} other ${links===1?'entity':'entities'} — those links will be severed too.`
      : `Delete "${e.name}"? This can't be undone.`;
    if(!confirm(warnTxt)) return;
    const name=e.name; deleteEntity(e.id); closeInspector(); renderSidebar(); renderView();
    notify(`Deleted "${name}".`, 'info');
  };
}
function renderSidebarSoft(){ /* update counts without losing focus */ renderSidebar(); }
/* count how many OTHER entities point at this id (for delete warnings) */
function countLinksTo(id){ let n=0; DB.entities.forEach(e=>{ if(e.id!==id) (e.rels||[]).forEach(r=>{ if(r.target===id) n++; }); }); return n; }

/* relationship inverse mapping */
const INVERSE = {'parent of':'child of','child of':'parent of','allied with':'allied with','enemy of':'enemy of','sibling of':'sibling of','married to':'married to','member of':'contains','contains':'member of','located in':'contains','rules':'serves','serves':'rules','mentor of':'serves','created':'originates from'};
function addInverse(fromId, type, toId){
  const inv = INVERSE[type]; if(!inv) return false;
  const t = ent(toId); if(!t) return false; t.rels=t.rels||[];
  if(!t.rels.some(r=>r.type===inv && r.target===fromId)){ t.rels.push({type:inv, target:fromId}); return true; }
  return false;
}
function removeInverse(fromId, r){
  const inv = INVERSE[r.type]; if(!inv) return;
  const t=ent(r.target); if(!t||!t.rels) return;
  t.rels = t.rels.filter(x=>!(x.type===inv && x.target===fromId));
}
function deleteEntity(id){
  DB.entities = DB.entities.filter(e=>e.id!==id);
  DB.entities.forEach(e=>{ if(e.rels) e.rels=e.rels.filter(r=>r.target!==id); });
}
