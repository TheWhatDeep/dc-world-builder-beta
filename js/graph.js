/* ========== CREATE ENTITY MODAL ========== */
function openCreateModal(presetType){
  const ov=$('#modalOverlay');
  if(presetType){ // skip type picker
    createEntity(presetType); return;
  }
  ov.innerHTML = `<div class="modal"><div class="modal-head"><h3>${I.plus} Forge a New Entity</h3><button class="close" data-mclose>${I.x}</button></div>
    <div class="modal-body">
      <p class="muted" style="margin-bottom:16px">What kind of thing are you adding to the world?</p>
      <div class="type-picker">
        ${TYPE_KEYS.map(k=>`<button class="type-opt" data-type="${k}" style="--to-color:${TYPES[k].color}">
          ${I[TYPES[k].icon]}<span class="tn">${TYPES[k].name}</span><span class="td">${TYPES[k].desc}</span>
        </button>`).join('')}
      </div>
    </div></div>`;
  ov.classList.add('open');
  $$('[data-type]',ov).forEach(b=>b.onclick=()=>{ closeModal(); createEntity(b.dataset.type); });
  $('[data-mclose]',ov).onclick=closeModal;
  ov.onclick=ev=>{ if(ev.target===ov) closeModal(); };
}
function createEntity(type){
  const e={ id:uid(), type, name:'', desc:'', canon:'draft', tags:[], fields:{}, rels:[], _t:Date.now() };
  if(type==='language') e.lang={words:[]};
  DB.entities.push(e);
  if(UI.view!=='codex'){ UI.view='codex'; UI.filterType=type; }
  else UI.filterType=type;
  renderSidebar(); renderView(); openEntity(e.id);
  notify(`New ${TYPES[type].name.toLowerCase()} created — name it on the right.`, 'success');
  setTimeout(()=>{ const n=$('#f_name'); n&&n.focus(); },60);
}
function closeModal(){ const ov=$('#modalOverlay'); ov.classList.remove('open'); ov.innerHTML=''; }

/* ========== GRAPH ========== */
function viewGraph(){
  return `<div class="view active">
    <div class="view-head">
      <div><h1 class="view-title"><span class="dot"></span>Relations Web</h1>
      <div class="view-sub">The living network — drag to explore, click a node to inspect</div></div>
      <div class="view-actions">
        <div class="pill-toggle" id="graphFilter">
          <button data-gf="all" class="${UI.graphView==='all'?'on':''}">All</button>
          ${TYPE_KEYS.slice(0,5).map(k=>`<button data-gf="${k}" class="${UI.graphView===k?'on':''}" style="color:${UI.graphView===k?'':TYPES[k].color}">${TYPES[k].name}s</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="graph-wrap">
      <svg id="graphSvg"></svg>
      <div class="graph-legend" id="graphLegend"></div>
      <div class="graph-controls">
        <button id="gZoomIn">+</button><button id="gZoomOut">−</button><button id="gReset" title="recenter" style="font-size:13px">⊙</button>
      </div>
      ${DB.entities.length<2?`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--ink-faint);text-align:center;padding:20px"><div style="font-family:var(--serif);font-size:22px;color:var(--ink-dim);margin-bottom:8px">The web is empty</div><p>Create entities and link them to see the network bloom.</p></div>`:''}
    </div>
  </div>`;
}

let graphState={scale:1,tx:0,ty:0,sim:null,nodes:[],links:[]};
function initGraph(){
  const svg=$('#graphSvg'); if(!svg) return;
  const filt = UI.graphView;
  let nodes = DB.entities.filter(e=>filt==='all'||e.type===filt).map(e=>({id:e.id,name:e.name,type:e.type,
    x:Math.random()*600+100, y:Math.random()*400+50, vx:0, vy:0,
    deg:(e.rels||[]).length}));
  const nodeIds=new Set(nodes.map(n=>n.id));
  let links=[];
  DB.entities.forEach(e=>{ (e.rels||[]).forEach(r=>{
    if(nodeIds.has(e.id)&&nodeIds.has(r.target)) links.push({source:e.id,target:r.target,type:r.type});
  });});
  // dedupe symmetric
  const seen=new Set(); links=links.filter(l=>{const k=[l.source,l.target].sort().join('|')+l.type;if(seen.has(k))return false;seen.add(k);return true;});
  graphState.nodes=nodes; graphState.links=links;

  // legend
  const present=[...new Set(nodes.map(n=>n.type))];
  $('#graphLegend').innerHTML = present.map(t=>`<div class="lg-row"><span class="lg-dot" style="background:${TYPES[t].color}"></span>${TYPES[t].plural}</div>`).join('')||'<span class="muted">—</span>';

  const W=svg.clientWidth, H=svg.clientHeight;
  nodes.forEach((n,i)=>{ n.x=W/2+Math.cos(i/nodes.length*6.28)*Math.min(W,H)*0.3; n.y=H/2+Math.sin(i/nodes.length*6.28)*Math.min(W,H)*0.3; });

  // simple force sim
  if(graphState.sim) cancelAnimationFrame(graphState.sim);
  let alpha=1;
  function tick(){
    alpha*=0.99;
    // repulsion
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j];let dx=a.x-b.x,dy=a.y-b.y,d=Math.sqrt(dx*dx+dy*dy)||1;
      const f=Math.min(2400/(d*d),4)*alpha; dx/=d;dy/=d; a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;
    }
    // spring
    links.forEach(l=>{const a=nodes.find(n=>n.id===l.source),b=nodes.find(n=>n.id===l.target);if(!a||!b)return;
      let dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1;const f=(d-120)*0.012*alpha;dx/=d;dy/=d;
      a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;});
    // center gravity
    nodes.forEach(n=>{n.vx+=(W/2-n.x)*0.0015*alpha;n.vy+=(H/2-n.y)*0.0015*alpha;
      n.x+=n.vx;n.y+=n.vy;n.vx*=0.82;n.vy*=0.82;});
    drawGraph();
    if(alpha>0.02) graphState.sim=requestAnimationFrame(tick);
  }
  tick();
  setupGraphPanZoom(svg);
}
function drawGraph(){
  const svg=$('#graphSvg'); if(!svg)return;
  const {nodes,links,scale,tx,ty}=graphState;
  let h=`<g transform="translate(${tx},${ty}) scale(${scale})">`;
  links.forEach(l=>{const a=nodes.find(n=>n.id===l.source),b=nodes.find(n=>n.id===l.target);if(!a||!b)return;
    h+=`<line class="graph-link ${l._hl?'hl':''}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;});
  nodes.forEach(n=>{const r=7+Math.min(n.deg*1.6,11);
    h+=`<g class="graph-node" data-node="${n.id}" transform="translate(${n.x},${n.y})">
      <circle r="${r}" fill="${TYPES[n.type].color}" stroke="var(--bg)" stroke-width="2"/>
      <text y="${r+13}">${esc(n.name.length>16?n.name.slice(0,15)+'…':n.name)}</text></g>`;});
  h+='</g>';
  svg.innerHTML=h;
  $$('.graph-node',svg).forEach(g=>{
    g.style.cursor='pointer';
    g.onclick=ev=>{ev.stopPropagation();openEntity(g.dataset.node);highlightNode(g.dataset.node);};
    g.onmouseenter=()=>highlightNode(g.dataset.node);
    g.onmouseleave=()=>{graphState.links.forEach(l=>l._hl=false);drawGraph();};
  });
}
function highlightNode(id){ graphState.links.forEach(l=>l._hl=(l.source===id||l.target===id)); drawGraph(); }
function setupGraphPanZoom(svg){
  let dragging=false,sx,sy;
  svg.onmousedown=ev=>{if(ev.target.closest('.graph-node'))return;dragging=true;sx=ev.clientX-graphState.tx;sy=ev.clientY-graphState.ty;};
  window.addEventListener('mousemove',gMove); window.addEventListener('mouseup',()=>dragging=false);
  function gMove(ev){if(!dragging)return;graphState.tx=ev.clientX-sx;graphState.ty=ev.clientY-sy;drawGraph();}
  svg.onwheel=ev=>{ev.preventDefault();const d=ev.deltaY<0?1.12:0.89;graphState.scale=Math.max(0.3,Math.min(3,graphState.scale*d));drawGraph();};
  $('#gZoomIn').onclick=()=>{graphState.scale=Math.min(3,graphState.scale*1.2);drawGraph();};
  $('#gZoomOut').onclick=()=>{graphState.scale=Math.max(0.3,graphState.scale*0.83);drawGraph();};
  $('#gReset').onclick=()=>{graphState.scale=1;graphState.tx=0;graphState.ty=0;drawGraph();};
}
