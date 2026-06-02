/* ========== GENERATORS ========== */
const SYL=['ka','me','tor','vel','sha','un','dra','lo','ith','ar','en','os','ya','mi','thal','wen','gor','sil','ae','ru','nox','fae','dur','ix'];
const PLACE_PRE=['North','Old','High','Black','White','Grey','Far','Iron','Thorn','Mist','Salt','Storm','Sun','Moon','Frost','Ember'];
const PLACE_SUF=['haven','reach','fell','moor','vale','crest','watch','gate','hold','mere','wick','barrow','spire','ford','marsh','keep','hollow','run'];
const HOOKS=['A long-dead ruler\'s heir surfaces, bearing an unmistakable mark.','A river that has flowed for a thousand years suddenly runs dry.','Two rival factions both claim the same prophecy points to them.','An artifact thought destroyed is quietly being sold at market.','A border town stops answering messages; the last letter was a single word.','The old gods\' temples crack on the same night, in the same place.','A cartographer returns with a map of a coastline no one recognizes.','Children in three cities begin speaking a dead language in their sleep.','A debt comes due that an entire nation swore was forgiven.','The eldest member of an order vanishes, leaving their seat of power unlocked.','A creature long believed mythical is found dead — of old age.','Someone is impersonating a figure everyone watched die.'];
const PROMPTS=['What does this culture do with its dead, and why?','Who was the last person to hold absolute power here, and how did they lose it?','What everyday object would be priceless to an outsider?','What lie does this society tell its children?','Where do two of your factions secretly agree?','What did the previous age leave behind that no one understands?','Which law exists only because of one infamous event?','What\'s the most beautiful place no one is allowed to go?','What resource is running out that no one is talking about?','Whose name is forbidden, and what did they do?'];
const FACTIONS=['an order of mapmakers who guard the locations of forbidden places','a merchant league that has quietly bought every bridge in the realm','a sect that believes the world is a memory being slowly forgotten','exiled nobility plotting return under a false banner','a guild of those who can speak to the recently dead','keepers of a flame that must never, for any reason, go out'];
const rnd=a=>a[Math.floor(Math.random()*a.length)];
function genName(syls){ const s=(syls&&syls.length?syls:SYL); const n=2+Math.floor(Math.random()*2); let w='';for(let i=0;i<n;i++)w+=rnd(s); return w[0].toUpperCase()+w.slice(1); }
function genPlace(){ return (Math.random()<.5?rnd(PLACE_PRE)+' ':'')+genName(SYL).slice(0,4)+rnd(PLACE_SUF); }

function sparkOut(target, items){
  const el=$('#'+target); if(!el)return;
  el.innerHTML=items.map(w=>`<span class="go-word">${esc(w)}</span>`).join('');
  $$('.go-word',el).forEach(g=>g.onclick=()=>{ navigator.clipboard?.writeText(g.textContent); toast('Copied: '+g.textContent); });
}
function wireGenerators(){
  // dashboard quick forge
  $$('[data-spark]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.spark;
    if(k==='name') sparkOut('sparkOut',Array.from({length:6},()=>genName(SYL)));
    else if(k==='place') sparkOut('sparkOut',Array.from({length:6},genPlace));
    else if(k==='hook') sparkOut('sparkOut',[rnd(HOOKS)]);
    else if(k==='faction') sparkOut('sparkOut',['A faction: '+rnd(FACTIONS)]);
    else if(k==='prompt') sparkOut('sparkOut',[rnd(PROMPTS)]);
  });
  // systems generators
  if($('#rollNames')) $('#rollNames').onclick=()=>{ const syl=$('#phonoSyl').value.split(',').map(s=>s.trim()).filter(Boolean); sparkOut('nameOut',Array.from({length:6},()=>genName(syl))); };
  if($('#rollPlaces')) $('#rollPlaces').onclick=()=>sparkOut('placeOut',Array.from({length:6},genPlace));
  if($('#rollHooks')) $('#rollHooks').onclick=()=>sparkOut('hookOut',[rnd(HOOKS)]);
}
function genLexiconFor(e){
  const syl=['ka','sho','ven','ti','mar','lo','dun','ae','ith','ra',' no','sil','tha','wen','um',' or'];
  const meanings=['water','fire','sky','stone','blood','star','death','king','river','shadow','light','home','war','oath','gold','wind'];
  e.lang=e.lang||{words:[]};
  const used=new Set(e.lang.words.map(w=>w.gloss));
  const avail=meanings.filter(m=>!used.has(m)).slice(0,8);
  avail.forEach(m=>e.lang.words.push({word:genName(syl).toLowerCase(),gloss:m}));
  renderInspector(); toast('Coined '+avail.length+' words');
}

/* ========== VIEW WIRING (delegation) ========== */
function wireView(){
  const m=$('#main');
  // universal openers
  $$('[data-open]',m).forEach(el=>el.onclick=e=>{e.stopPropagation();openEntity(el.dataset.open);});
  $$('[data-new]',m).forEach(el=>el.onclick=()=>openCreateModal(el.dataset.new||null));
  $$('[data-gotype]',m).forEach(el=>el.onclick=()=>{UI.view='codex';UI.filterType=el.dataset.gotype;renderSidebar();renderView();});

  // dashboard
  if($('[data-tagline]')) $('[data-tagline]').onclick=()=>{ const t=prompt('A short tagline for your world:',DB.meta.tagline); if(t!=null){DB.meta.tagline=t;renderView(); notify('Tagline updated.', 'success');} };
  wireGenerators();

  // codex
  if($('#codexSearch')){ const s=$('#codexSearch'); s.oninput=()=>{UI.search=s.value;renderCodexGrid();}; }
  if($('#codexSort')){ $('#codexSort').onchange=(ev)=>{ UI.sort=ev.target.value; renderCodexGrid(); }; }
  $$('[data-canon]',m).forEach(b=>b.onclick=()=>{UI.canonFilter=b.dataset.canon;renderView();});

  // graph filter
  $$('#graphFilter [data-gf]',m).forEach(b=>b.onclick=()=>{UI.graphView=b.dataset.gf;renderView();});

  // timeline
  if($('[data-editcal]')) $('[data-editcal]').onclick=openCalendarModal;

  // systems econ — modal-based add/edit (click a row to edit, button to add)
  if($('#addEcon')) $('#addEcon').onclick=()=>openResourceModal();
  $$('[data-econ]',m).forEach(row=>row.onclick=()=>openResourceModal(row.dataset.econ));
}
// targeted re-render of codex grid to preserve search focus
function renderCodexGrid(){
  const t=UI.filterType;
  let list=DB.entities.filter(e=>t==='all'||e.type===t);
  if(UI.canonFilter!=='all') list=list.filter(e=>e.canon===UI.canonFilter);
  if(UI.search){const q=UI.search.toLowerCase();list=list.filter(e=>e.name.toLowerCase().includes(q)||(e.desc||'').toLowerCase().includes(q)||(e.tags||[]).some(tg=>tg.toLowerCase().includes(q))||JSON.stringify(e.fields||{}).toLowerCase().includes(q));}
  sortEntities(list);
  const grid=document.querySelector('.card-grid');
  if(grid){ grid.innerHTML=list.map(entCard).join(''); $$('[data-open]',grid).forEach(el=>el.onclick=e=>{e.stopPropagation();openEntity(el.dataset.open);}); }
  else renderView(); // grid not present (was empty state) — full re-render
}
