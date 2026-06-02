/* ==========================================================
   CAMPAIGN JOURNAL
   Session logs with [[entity]] references. Clicking a card opens
   a read-only preview; the preview's Edit button (and "+ New
   Session") open the editor. Sessions live in DB.journal.
   ========================================================== */

/* ---------- helpers ---------- */
/* unique entities referenced via [[name]] in a body, in first-seen order */
function journalRefs(text){
  const seen=new Set(), out=[];
  [...(text||'').matchAll(/\[\[([^\]]+)\]\]/g)].forEach(m=>{
    const e=DB.entities.find(x=>x.name.toLowerCase()===m[1].trim().toLowerCase());
    if(e && !seen.has(e.id)){ seen.add(e.id); out.push(e); }
  });
  return out;
}
/* render a body: escape text, turn [[name]] into clickable chips (dashed if no match), keep line breaks */
function renderJournalBody(text){
  if(!text || !text.trim()) return '<p class="muted">No log written yet.</p>';
  let out='', last=0; const re=/\[\[([^\]]+)\]\]/g; let m;
  while((m=re.exec(text))){
    out += esc(text.slice(last, m.index));
    const name=m[1].trim();
    const e=DB.entities.find(x=>x.name.toLowerCase()===name.toLowerCase());
    out += e
      ? `<span class="jl-ref" data-open="${e.id}" style="border-color:${TYPES[e.type].color}66;color:${TYPES[e.type].color}">${esc(name)}</span>`
      : `<span class="jl-ref jl-ref-missing" title="No matching entity">${esc(name)}</span>`;
    last = m.index + m[0].length;
  }
  out += esc(text.slice(last));
  return out.replace(/\n/g,'<br>');
}
/* "521 CE" + real date, joined */
function journalDateBits(s){
  const bits=[];
  if(s.date) bits.push(esc(s.date));
  if(s.year!=null && s.year!=='') bits.push(`${esc(String(s.year))} ${esc(DB.calendar.epoch)}`);
  return bits;
}

/* ---------- view ---------- */
function viewJournal(){
  const sessions=[...DB.journal].sort((a,b)=>(b._t||0)-(a._t||0));
  return `<div class="view active">
    <div class="view-head">
      <div><h1 class="view-title"><span class="dot"></span>Campaign Journal</h1>
      <div class="view-sub">Session logs and play notes — ${DB.journal.length} ${DB.journal.length===1?'entry':'entries'}</div></div>
      <div class="view-actions">
        <button class="btn amber" data-newsession>${I.plus} New Session</button>
      </div>
    </div>
    ${DB.journal.length
      ? `<div class="journal-grid">`+sessions.map(journalCard).join('')+`</div>`
      : `<div class="empty">${I.book}
          <div class="big">No sessions logged yet</div>
          <p class="muted">Keep a running journal of your campaign. Reference any entity with <kbd>[[name]]</kbd> — links stay live.</p>
          <button class="btn amber" style="margin-top:18px" data-newsession>${I.plus} Write the first session</button>
        </div>`}
  </div>`;
}

function journalCard(s){
  const refs=journalRefs(s.body);
  const dateBits=journalDateBits(s);
  const plain = (s.body||'').replace(/\[\[([^\]]+)\]\]/g,'$1').replace(/\s+/g,' ').trim();
  return `<div class="journal-card" data-session="${s.id}">
    <div class="jc-top">
      ${s.campaign?`<span class="jc-campaign">${esc(s.campaign)}</span>`:`<span class="jc-campaign muted">No campaign</span>`}
      ${dateBits.length?`<span class="jc-date">${dateBits.join(' · ')}</span>`:''}
    </div>
    <h3 class="jc-title">${esc(s.title)||'<span class="muted">Untitled session</span>'}</h3>
    ${plain?`<div class="jc-snippet">${esc(plain.slice(0,160))}${plain.length>160?'…':''}</div>`:`<div class="jc-snippet muted">No log written yet…</div>`}
    ${refs.length?`<div class="jc-refs">${refs.slice(0,6).map(e=>`<span class="jc-ref-dot" style="background:${TYPES[e.type].color}" title="${esc(e.name)}"></span>`).join('')}<span class="jc-ref-n">${refs.length} ${refs.length===1?'reference':'references'}</span></div>`:''}
  </div>`;
}

/* ---------- read-only preview ---------- */
function openSessionPreview(id){
  const s=DB.journal.find(x=>x.id===id);
  if(!s) return notify('That session is no longer in the journal.', 'error');
  const refs=journalRefs(s.body);
  const dateBits=journalDateBits(s);
  const ov=$('#modalOverlay');
  ov.innerHTML=`<div class="modal wide jp-modal"><div class="modal-head"><h3>${I.book} Session Log</h3><button class="close" data-mclose>${I.x}</button></div>
    <div class="modal-body jp-body">
      <div class="jp-head">
        ${s.campaign?`<div class="jp-campaign">${esc(s.campaign)}</div>`:''}
        <h2 class="jp-title">${esc(s.title)||'<span class="muted">Untitled session</span>'}</h2>
        ${dateBits.length?`<div class="jp-date">${dateBits.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</div>`:''}
      </div>
      <div class="jp-text">${renderJournalBody(s.body)}</div>
      ${refs.length?`<div class="jp-refs"><div class="jp-refs-label">Entities referenced</div>
        <div class="jp-refs-list">${refs.map(e=>`<span class="jl-ref" data-open="${e.id}" style="border-color:${TYPES[e.type].color}66;color:${TYPES[e.type].color}"><span class="jl-ico">${I[TYPES[e.type].icon]}</span>${esc(e.name)}</span>`).join('')}</div></div>`:''}
    </div>
    <div class="modal-foot">
      <button class="btn" data-mclose>Close</button>
      <button class="btn amber" id="jpEdit">${I.edit} Edit</button>
    </div></div>`;
  ov.classList.add('open');
  $$('[data-mclose]',ov).forEach(b=>b.onclick=closeModal);
  ov.onclick=ev=>{ if(ev.target===ov) closeModal(); };
  $('#jpEdit',ov).onclick=()=>openSessionEditor(id);   // swaps modal content to the editor
  // entity chips → close preview, open that entity's inspector
  $$('[data-open]',ov).forEach(el=>el.onclick=()=>{ const eid=el.dataset.open; closeModal(); openEntity(eid); });
}

/* ---------- editor ---------- */
function openSessionEditor(id){
  const editing=!!id;
  const s=editing ? DB.journal.find(x=>x.id===id) : null;
  if(editing && !s) return notify('That session is no longer in the journal.', 'error');
  const cur=s || {title:'',campaign:'',date:'',year:null,body:''};
  const ov=$('#modalOverlay');
  ov.innerHTML=`<div class="modal wide"><div class="modal-head"><h3>${I.book} ${editing?'Edit Session':'New Session'}</h3><button class="close" data-mclose>${I.x}</button></div>
    <div class="modal-body">
      <label>Title</label>
      <input id="seTitle" value="${esc(cur.title)}" placeholder="The Pale Seat, Session 12…" autocomplete="off">
      <label>Campaign</label>
      <input id="seCampaign" value="${esc(cur.campaign||'')}" placeholder="The Sundering Saga" autocomplete="off">
      <div class="two-col">
        <div><label>Date played</label><input id="seDate" value="${esc(cur.date||'')}" placeholder="2024-03-15" autocomplete="off"></div>
        <div><label>In-world year</label><input id="seYear" type="number" value="${cur.year??''}" placeholder="—"></div>
      </div>
      <label>Session log</label>
      <textarea id="seBody" class="se-body" placeholder="What happened this session? Reference any entity with [[name]] — it becomes a clickable link in the preview.">${esc(cur.body||'')}</textarea>
    </div>
    <div class="modal-foot">
      ${editing?`<button class="btn danger" id="seDelete" style="margin-right:auto">${I.trash} Delete</button>`:''}
      <button class="btn" data-mclose>Cancel</button>
      <button class="btn amber" id="seSave">${editing?'Save Changes':'Add Session'}</button>
    </div></div>`;
  ov.classList.add('open');
  $$('[data-mclose]',ov).forEach(b=>b.onclick=closeModal);
  ov.onclick=ev=>{ if(ev.target===ov) closeModal(); };

  $('#seSave',ov).onclick=()=>{
    const title=$('#seTitle',ov).value.trim();
    if(!guard(title, 'Give the session a title before saving.', 'warn')) return;
    const yRaw=$('#seYear',ov).value;
    const data={ title, campaign:$('#seCampaign',ov).value.trim(), date:$('#seDate',ov).value.trim(), year: yRaw===''?null:+yRaw, body:$('#seBody',ov).value };
    if(editing){ Object.assign(s, data); s._t=Date.now(); }
    else DB.journal.push(Object.assign({id:uid(), _t:Date.now()}, data));
    closeModal(); renderView();
    notify(editing?`Updated "${title}".`:`Session "${title}" added to the journal.`, 'success');
  };
  if($('#seDelete',ov)) $('#seDelete',ov).onclick=()=>{
    if(!confirm(`Delete session "${s.title}"? This can't be undone.`)) return;
    const t=s.title; DB.journal=DB.journal.filter(x=>x.id!==s.id);
    closeModal(); renderView(); notify(`Deleted "${t}".`, 'info');
  };
  setTimeout(()=>{ const n=$('#seTitle',ov); n&&n.focus(); }, 40);
}
