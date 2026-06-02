/* ========== TIMELINE / CHRONICLE ========== */
function viewTimeline(){
  // gather dated things: events (when), births/deaths/foundings/dissolutions
  let pts=[];
  DB.entities.forEach(e=>{
    if(e.type==='event' && e.when!=null) pts.push({year:+e.when,title:e.name,desc:e.desc,id:e.id,kind:'event'});
    if(e.birth!=null) pts.push({year:+e.birth,title:e.name+(e.type==='char'?' is born':' is founded'),desc:e.desc,id:e.id,kind:'birth',type:e.type});
    if(e.death!=null) pts.push({year:+e.death,title:e.name+(e.type==='char'?' dies':' dissolves'),desc:'',id:e.id,kind:'death',type:e.type});
  });
  pts.sort((a,b)=>a.year-b.year);
  const eras=[...DB.calendar.eras].sort((a,b)=>a.start-b.start);

  let body='';
  if(!pts.length){
    body=`<div class="empty">${I.timeline}<div class="big">No dated events yet</div><p class="muted">Add a year to any Event, or birth/founding years to characters & factions, and they'll thread onto the chronicle.</p></div>`;
  } else {
    // group by era
    const grouped = eras.map(era=>({era, items:pts.filter(p=>p.year>=era.start&&p.year<era.end)}));
    const orphans = pts.filter(p=>!eras.some(e=>p.year>=e.start&&p.year<e.end));
    body=`<div class="tl-wrap"><div class="tl-axis">`;
    grouped.forEach(g=>{
      body+=`<div class="era-band"><div class="era-head"><div class="era-bar" style="color:${g.era.color}">${esc(g.era.name)}<div class="era-years">${g.era.start}–${g.era.end} ${esc(DB.calendar.epoch)}</div></div></div>`;
      if(!g.items.length) body+=`<div class="tl-event"><div class="tl-date"></div><div class="tl-node" style="background:${g.era.color}"></div><div class="tl-card" style="opacity:.5"><p class="muted">— quiet years —</p></div></div>`;
      g.items.forEach(p=>body+=tlEvent(p,g.era.color));
      body+='</div>';
    });
    if(orphans.length){
      body+=`<div class="era-band"><div class="era-head"><div class="era-bar">Unbound<div class="era-years">outside known eras</div></div></div>`;
      orphans.forEach(p=>body+=tlEvent(p,'#7d7259')); body+='</div>';
    }
    body+=`</div></div>`;
  }

  return `<div class="view active">
    <div class="view-head">
      <div><h1 class="view-title"><span class="dot"></span>The Chronicle</h1>
      <div class="view-sub">Time as your world remembers it — ${esc(DB.calendar.epoch)} reckoning, ${DB.calendar.months.length} months/year</div></div>
      <div class="view-actions">
        <button class="btn" data-editcal>${I.timeline} Edit Calendar & Eras</button>
        <button class="btn amber" data-new="event">${I.plus} New Event</button>
      </div>
    </div>
    ${body}
  </div>`;
}
function tlEvent(p,color){
  const tags = p.kind==='birth'?'<span class="chip canon">born</span>':p.kind==='death'?'<span class="chip speculative">ended</span>':'<span class="chip draft">event</span>';
  return `<div class="tl-event">
    <div class="tl-date">${p.year} ${esc(DB.calendar.epoch)}</div>
    <div class="tl-node" style="background:${color}"></div>
    <div class="tl-card" data-open="${p.id}">
      <h4>${esc(p.title)}</h4>
      ${p.desc?`<p>${esc(p.desc.slice(0,140))}${p.desc.length>140?'…':''}</p>`:''}
      <div class="tl-tags">${tags}</div>
    </div>
  </div>`;
}

/* calendar editor */
function openCalendarModal(){
  const c=DB.calendar; const ov=$('#modalOverlay');
  ov.innerHTML=`<div class="modal wide"><div class="modal-head"><h3>${I.timeline} Calendar & Eras</h3><button class="close" data-mclose>${I.x}</button></div>
  <div class="modal-body">
    <div class="two-col">
      <div><label>Epoch suffix (e.g. CE, AC, PA)</label><input id="calEpoch" value="${esc(c.epoch)}"></div>
      <div><label>Days per month</label><input id="calDays" type="number" value="${c.daysPerMonth}"></div>
    </div>
    <label>Month names (comma-separated)</label>
    <textarea id="calMonths" rows="2">${esc(c.months.join(', '))}</textarea>
    <div class="divider"></div>
    <label>Eras / Ages</label>
    <div id="eraEdit">${c.eras.map((e,i)=>eraRow(e,i)).join('')}</div>
    <button class="btn sm" id="addEra" style="margin-top:10px">${I.plus} Add era</button>
  </div>
  <div class="modal-foot"><button class="btn" data-mclose>Cancel</button><button class="btn amber" id="saveCal">Save Calendar</button></div></div>`;
  ov.classList.add('open');
  const wire=()=>{ $$('[data-delera]',ov).forEach(x=>x.onclick=()=>{ const nm=c.eras[+x.dataset.delera]?.name; c.eras.splice(+x.dataset.delera,1);refreshEra(); notify(`Removed era "${nm||''}".`, 'info'); }); };
  function refreshEra(){ $('#eraEdit',ov).innerHTML=c.eras.map((e,i)=>eraRow(e,i)).join(''); wire(); }
  $('#addEra',ov).onclick=()=>{ c.eras.push({id:uid(),name:'New Age',start:0,end:100,color:'#6b8a9a'}); refreshEra(); notify('Era added — set its years and name.', 'success'); };
  wire();
  $$('[data-mclose]',ov).forEach(b=>b.onclick=closeModal);
  $('#saveCal',ov).onclick=()=>{
    const months=$('#calMonths').value.split(',').map(s=>s.trim()).filter(Boolean);
    if(!guard(months.length, 'A calendar needs at least one month name.', 'warn')) return;
    const days=+$('#calDays').value;
    if(!guard(days>0, 'Days per month must be a positive number.', 'warn')) return;
    // validate eras
    const bad=[];
    $$('#eraEdit .era-row-edit',ov).forEach((row,i)=>{
      const s=+row.querySelector('[data-es]').value, en=+row.querySelector('[data-ee]').value;
      if(en<s) bad.push(row.querySelector('[data-en]').value||('era '+(i+1)));
    });
    if(bad.length) return notify(`Era "${bad[0]}" ends before it begins — fix its years.`, 'error');
    c.epoch=$('#calEpoch').value||'CE'; c.daysPerMonth=days||30; c.months=months;
    $$('#eraEdit .era-row-edit',ov).forEach((row,i)=>{
      c.eras[i].name=row.querySelector('[data-en]').value;
      c.eras[i].start=+row.querySelector('[data-es]').value;
      c.eras[i].end=+row.querySelector('[data-ee]').value;
      c.eras[i].color=row.querySelector('[data-ec]').value;
    });
    closeModal(); renderView(); notify('Calendar updated.', 'success');
  };
  ov.onclick=ev=>{if(ev.target===ov)closeModal();};
}
function eraRow(e,i){
  return `<div class="era-row-edit flex gap aic" style="margin-bottom:8px">
    <input data-en value="${esc(e.name)}" style="flex:2" placeholder="Era name">
    <input data-es type="number" value="${e.start}" style="flex:1" placeholder="start">
    <input data-ee type="number" value="${e.end}" style="flex:1" placeholder="end">
    <input data-ec type="color" value="${e.color}" style="width:42px;padding:2px;flex:0 0 42px">
    <span class="rel-x" data-delera="${i}" style="cursor:pointer">${I.x}</span>
  </div>`;
}

/* ========== CONSISTENCY / LOREMASTER ========== */
function runChecks(){
  const issues=[]; const E=DB.entities;
  // 1. death before birth
  E.forEach(e=>{ if(e.birth!=null&&e.death!=null&&+e.death<+e.birth)
    issues.push({sev:'error',title:'Impossible lifespan',desc:`${e.name} dies (${e.death}) before being born/founded (${e.birth}).`,refs:[e.id]});});
  // 2. event references entity active outside lifespan
  E.filter(e=>e.type==='event'&&e.when!=null).forEach(ev=>{
    (ev.rels||[]).forEach(r=>{ const t=ent(r.target); if(!t)return;
      if(t.birth!=null && +ev.when < +t.birth) issues.push({sev:'warn',title:'Anachronism',desc:`Event "${ev.name}" (${ev.when}) links to ${t.name}, which doesn't exist until ${t.birth}.`,refs:[ev.id,t.id]});
      if(t.death!=null && +ev.when > +t.death) issues.push({sev:'warn',title:'Posthumous involvement',desc:`Event "${ev.name}" (${ev.when}) links to ${t.name}, gone since ${t.death}.`,refs:[ev.id,t.id]});
    });
  });
  // 3. broken links
  E.forEach(e=>(e.rels||[]).forEach(r=>{ if(!ent(r.target)) issues.push({sev:'error',title:'Dangling link',desc:`${e.name} "${r.type}" points to a deleted entity.`,refs:[e.id]});}));
  // 4. orphans (no links, no tags)
  E.forEach(e=>{ if((!e.rels||!e.rels.length)&&(!e.tags||!e.tags.length)&&E.length>3) issues.push({sev:'info',title:'Untethered entity',desc:`${e.name} has no relationships or tags — it floats unconnected to the world.`,refs:[e.id]});});
  // 5. empty descriptions on canon
  E.forEach(e=>{ if(e.canon==='canon'&&!(e.desc||'').trim()) issues.push({sev:'info',title:'Canon without lore',desc:`${e.name} is marked canon but has no description.`,refs:[e.id]});});
  // 6. era overlaps
  const eras=[...DB.calendar.eras].sort((a,b)=>a.start-b.start);
  for(let i=1;i<eras.length;i++) if(eras[i].start<eras[i-1].end)
    issues.push({sev:'warn',title:'Overlapping eras',desc:`"${eras[i-1].name}" (ends ${eras[i-1].end}) overlaps "${eras[i].name}" (starts ${eras[i].start}).`,refs:[]});
  // 7. reciprocal mismatch (A parent of B but B not child of A)
  E.forEach(e=>(e.rels||[]).forEach(r=>{
    const inv=INVERSE[r.type]; if(!inv)return; const t=ent(r.target); if(!t)return;
    if(!(t.rels||[]).some(x=>x.type===inv&&x.target===e.id))
      issues.push({sev:'info',title:'One-sided relation',desc:`${e.name} is "${r.type}" ${t.name}, but the reverse ("${inv}") isn't recorded.`,refs:[e.id,t.id]});
  }));
  return issues;
}
function viewConsistency(){
  const issues=runChecks();
  const counts={error:issues.filter(i=>i.sev==='error').length,warn:issues.filter(i=>i.sev==='warn').length,info:issues.filter(i=>i.sev==='info').length};
  let body;
  if(!issues.length){
    body=`<div class="check-clean">${I.checkBig}<div class="big" style="font-family:var(--serif);font-size:23px;color:var(--sage)">The lore holds together</div><p class="muted">No contradictions found. Your world is internally consistent.</p></div>`;
  } else {
    body=issues.map(i=>`<div class="issue-card ${i.sev}">
      <div class="sev"></div>
      <div class="ic-body">
        <div class="ic-title">${esc(i.title)}</div>
        <div class="ic-desc">${esc(i.desc)}</div>
        ${i.refs.length?`<div class="ic-refs">${i.refs.map(id=>{const e=ent(id);return e?`<span class="ic-ref" data-open="${id}">${esc(e.name)}</span>`:'';}).join('')}</div>`:''}
      </div></div>`).join('');
  }
  return `<div class="view active">
    <div class="view-head">
      <div><h1 class="view-title"><span class="dot"></span>The Loremaster</h1>
      <div class="view-sub">Soft consistency checks — warnings, never walls. Break your rules deliberately.</div></div>
    </div>
    <div class="stat-row" style="grid-template-columns:repeat(3,1fr);max-width:480px">
      <div class="stat-card"><div class="sc-num" style="color:var(--crimson)">${counts.error}</div><div class="sc-lab">Contradictions</div></div>
      <div class="stat-card"><div class="sc-num" style="color:var(--amber)">${counts.warn}</div><div class="sc-lab">Warnings</div></div>
      <div class="stat-card"><div class="sc-num" style="color:var(--slate)">${counts.info}</div><div class="sc-lab">Suggestions</div></div>
    </div>
    ${body}
  </div>`;
}
