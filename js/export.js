/* ---- shared rich-document builder for HTML & PDF ---- */
function buildDocBody(scope){
  const ents=exportScope(scope); const c=DB.calendar;
  const anchor=id=>'ent-'+id;
  const link=id=>{const e=ent(id);return e&&ents.includes(e)?`<a href="#${anchor(id)}" class="xref">${esc(e.name)}</a>`:(e?esc(e.name):'<i>unknown</i>');};
  let h='';
  // overview
  h+=`<section class="doc-hero"><h1>${esc(DB.meta.name)}</h1>${DB.meta.tagline?`<p class="doc-tag">${esc(DB.meta.tagline)}</p>`:''}
    <p class="doc-meta">A compendium of ${ents.length} entries · ${scope} edition · ${new Date().toLocaleDateString()}</p></section>`;
  // contents
  const present=TYPE_KEYS.filter(k=>ents.some(e=>e.type===k));
  h+=`<nav class="doc-toc"><h2>Contents</h2><ul>`;
  present.forEach(k=>h+=`<li><a href="#sec-${k}">${TYPES[k].plural}</a> <span class="toc-n">${ents.filter(e=>e.type===k).length}</span></li>`);
  h+=`<li><a href="#sec-chrono">The Chronicle</a></li>`;
  if(DB.economy.length)h+=`<li><a href="#sec-econ">Economy</a></li>`;
  if(DB.notes&&scope!=='player')h+=`<li><a href="#sec-notes">Loremaster Notes</a></li>`;
  h+=`</ul></nav>`;
  // calendar
  h+=`<section class="doc-sec"><h2>The Reckoning of Time</h2>
    <p>This world counts its years in <strong>${esc(c.epoch)}</strong>, across a year of ${c.months.length} months (${c.daysPerMonth} days each): <em>${c.months.map(esc).join(', ')}</em>.</p>
    <div class="era-strip">${[...c.eras].sort((a,b)=>a.start-b.start).map(e=>`<div class="era-chip" style="border-color:${e.color}"><strong style="color:${e.color}">${esc(e.name)}</strong><span>${e.start}–${e.end} ${esc(c.epoch)}</span></div>`).join('')}</div></section>`;
  // entities
  present.forEach(k=>{
    h+=`<section class="doc-sec" id="sec-${k}"><h2 style="color:${TYPES[k].color}">${TYPES[k].plural}</h2>`;
    ents.filter(e=>e.type===k).forEach(e=>{
      h+=`<article class="doc-entry" id="${anchor(e.id)}">
        <h3>${esc(e.name)} <span class="doc-badge ${e.canon}">${e.canon}</span></h3>`;
      const sub=[];
      if(e.birth!=null) sub.push((k==='char'?'Born ':'Founded ')+e.birth+' '+c.epoch);
      if(e.death!=null) sub.push((k==='char'?'died ':'ended ')+e.death+' '+c.epoch);
      if(e.when!=null) sub.push(e.when+' '+c.epoch);
      if(sub.length) h+=`<p class="doc-sub">${sub.join(' · ')}</p>`;
      if(e.desc) h+=`<p>${esc(e.desc).replace(/\n/g,'<br>')}</p>`;
      const f=e.fields||{}; const fk=Object.keys(f).filter(key=>f[key]);
      if(fk.length) h+=`<dl class="doc-fields">${fk.map(key=>`<dt>${esc(key)}</dt><dd>${esc(f[key])}</dd>`).join('')}</dl>`;
      const rels=(e.rels||[]).filter(r=>ent(r.target));
      if(rels.length) h+=`<p class="doc-rels"><span class="rl">Relations</span> ${rels.map(r=>`<span class="rel-chip">${esc(r.type)} ${link(r.target)}</span>`).join(' ')}</p>`;
      if(e.lang&&e.lang.words.length) h+=`<table class="doc-lex"><tbody>${e.lang.words.map(w=>`<tr><td class="lx">${esc(w.word)}</td><td>${esc(w.gloss)}</td></tr>`).join('')}</tbody></table>`;
      if(e.tags&&e.tags.length) h+=`<p class="doc-tags">${e.tags.map(t=>`<span class="tg">${esc(t)}</span>`).join('')}</p>`;
      h+=`</article>`;
    });
    h+=`</section>`;
  });
  // chronicle
  let pts=[];
  ents.forEach(e=>{ if(e.type==='event'&&e.when!=null)pts.push({y:+e.when,t:e.name,d:e.desc});
    if(e.birth!=null)pts.push({y:+e.birth,t:e.name+(e.type==='char'?' is born':' founded'),d:''});
    if(e.death!=null)pts.push({y:+e.death,t:e.name+(e.type==='char'?' dies':' ends'),d:''}); });
  pts.sort((a,b)=>a.y-b.y);
  h+=`<section class="doc-sec" id="sec-chrono"><h2>The Chronicle</h2>`;
  if(pts.length){ h+=`<div class="doc-timeline">`+pts.map(p=>`<div class="dt-row"><span class="dt-year">${p.y} ${esc(c.epoch)}</span><span class="dt-dot"></span><div class="dt-body"><strong>${esc(p.t)}</strong>${p.d?`<br><span class="dt-desc">${esc(p.d.slice(0,180))}</span>`:''}</div></div>`).join('')+`</div>`; }
  else h+=`<p><em>No dated events recorded.</em></p>`;
  h+=`</section>`;
  // economy
  if(DB.economy.length){ h+=`<section class="doc-sec" id="sec-econ"><h2>Economy & Resources</h2><div class="econ-grid">`+DB.economy.map(r=>{
    const danger=(r.danger&&r.danger!=='None')?`<span class="econ-tag danger">${esc(r.danger)} danger</span>`:'';
    const val=r.value?`<div class="econ-val-line">${esc(r.value)}</div>`:'';
    const desc=r.description?`<div class="econ-desc">${esc(r.description)}</div>`:'';
    return `<div class="econ-item"><div class="econ-item-head"><strong>${esc(r.name)}</strong><span class="econ-tags"><span class="econ-tag">${esc(econRarity(r))}</span>${danger}</span></div>${val}${desc}</div>`;
  }).join('')+`</div></section>`; }
  // notes
  if(DB.notes&&scope!=='player'){ const linked=DB.notes.replace(/\[\[([^\]]+)\]\]/g,(m,name)=>{const e=DB.entities.find(x=>x.name.toLowerCase()===name.toLowerCase());return e&&ents.includes(e)?`<a href="#${anchor(e.id)}" class="xref">${esc(name)}</a>`:esc(name);});
    h+=`<section class="doc-sec" id="sec-notes"><h2>Loremaster Notes</h2><div class="doc-notes">${linked.replace(/\n/g,'<br>')}</div></section>`; }
  return h;
}
const DOC_CSS=`
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Spectral',Georgia,serif;background:#f5f0e6;color:#2a2419;line-height:1.7;padding:0}
.wrap{max-width:820px;margin:0 auto;padding:60px 48px 100px}
h1,h2,h3{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;line-height:1.15}
.doc-hero{text-align:center;padding:40px 0 50px;border-bottom:2px solid #c9a441;margin-bottom:10px}
.doc-hero h1{font-size:56px;color:#7a5a1a;letter-spacing:.01em}
.doc-tag{font-style:italic;font-size:20px;color:#9a8a6a;margin-top:10px}
.doc-meta{font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#b3a587;margin-top:18px;font-family:monospace}
.doc-toc{background:#ece4d2;border:1px solid #d8cbb0;border-radius:10px;padding:24px 30px;margin:30px 0 40px}
.doc-toc h2{font-size:22px;margin-bottom:14px;color:#7a5a1a}
.doc-toc ul{list-style:none;columns:2;column-gap:40px}
.doc-toc li{padding:4px 0;display:flex;justify-content:space-between;break-inside:avoid}
.doc-toc a{color:#9c6f23;text-decoration:none;border-bottom:1px dotted #c9a44166}
.toc-n{font-family:monospace;font-size:11px;color:#b3a587}
.doc-sec{margin:46px 0;page-break-inside:auto}
.doc-sec>h2{font-size:34px;border-bottom:1px solid #d8cbb0;padding-bottom:10px;margin-bottom:24px;color:#7a5a1a}
.doc-entry{margin-bottom:30px;padding-left:18px;border-left:3px solid #e0d5bd;break-inside:avoid}
.doc-entry h3{font-size:25px;color:#3a2f1a;display:flex;align-items:center;gap:12px}
.doc-badge{font-size:9px;font-family:monospace;letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border-radius:10px;font-weight:400}
.doc-badge.canon{background:#dde6cc;color:#5a7030}
.doc-badge.draft{background:#efe2c8;color:#9c7a30}
.doc-badge.speculative{background:#e8d8e2;color:#8a5a7a}
.doc-sub{font-style:italic;color:#9a8a6a;font-size:14px;margin:3px 0 10px;font-family:monospace}
.doc-entry p{margin:8px 0}
.doc-fields{margin:12px 0;display:grid;grid-template-columns:auto 1fr;gap:4px 16px;font-size:14px}
.doc-fields dt{font-weight:600;color:#7a5a1a;font-family:monospace;font-size:12px;text-transform:uppercase;letter-spacing:.05em;padding-top:2px}
.doc-fields dd{color:#3a2f1a}
.doc-rels{font-size:13px;margin-top:10px}
.rl{font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#b3a587;margin-right:6px}
.rel-chip{display:inline-block;background:#ece4d2;border:1px solid #ddd0b5;border-radius:20px;padding:2px 10px;margin:2px;font-size:12.5px}
.xref{color:#9c6f23;text-decoration:none;border-bottom:1px solid #c9a44166;font-weight:500}
.doc-lex{margin:12px 0;border-collapse:collapse;font-size:13.5px}
.doc-lex td{padding:3px 18px 3px 0}
.doc-lex .lx{font-style:italic;color:#9c6f23;font-weight:600}
.doc-tags{margin-top:10px}
.tg{display:inline-block;background:#e4dcc8;border-radius:4px;padding:1px 8px;margin:2px;font-size:11px;color:#7a6a4a;font-family:monospace}
.era-strip{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.era-chip{border:1px solid;border-left-width:4px;border-radius:6px;padding:8px 14px;background:#ece4d2}
.era-chip span{display:block;font-size:11px;color:#9a8a6a;font-family:monospace;margin-top:2px}
.doc-timeline{margin-top:16px}
.dt-row{display:flex;gap:14px;align-items:flex-start;margin-bottom:14px;break-inside:avoid}
.dt-year{font-family:monospace;font-size:12px;color:#9c6f23;width:90px;text-align:right;flex-shrink:0;padding-top:3px}
.dt-dot{width:11px;height:11px;border-radius:50%;background:#c9a441;border:2px solid #f5f0e6;flex-shrink:0;margin-top:4px}
.dt-body{flex:1}.dt-desc{color:#7a6a4a;font-size:14px}
.econ-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.econ-item{background:#ece4d2;border:1px solid #ddd0b5;border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;break-inside:avoid}
.econ-item-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.econ-tags{display:flex;gap:6px;flex-shrink:0}
.econ-tag{font-family:monospace;font-size:10px;text-transform:uppercase;color:#9a8a6a;white-space:nowrap}
.econ-tag.danger{color:#a8392f}
.econ-val-line{font-size:13px;color:#6b5d44;font-style:italic}
.econ-desc{font-size:13px;color:#5a4f3a;line-height:1.5}
.doc-notes{background:#ece4d2;border:1px solid #d8cbb0;border-radius:10px;padding:24px 28px;font-size:15px}
@media print{body{background:#fff}.wrap{padding:0 20px;max-width:100%}.doc-sec{page-break-inside:auto}.doc-entry,.dt-row{page-break-inside:avoid}.doc-toc{page-break-after:always}.doc-hero{page-break-after:avoid}}
`;
function exportHTML(scope){
  const body=buildDocBody(scope);
  const doc=`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(DB.meta.name)} — Codex</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Spectral:ital,wght@0,300;0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>${DOC_CSS}</style></head><body><div class="wrap">${body}
<footer style="margin-top:80px;text-align:center;font-family:monospace;font-size:11px;color:#b3a587;border-top:1px solid #d8cbb0;padding-top:24px">Forged in CODEX · The Worldwright's Archive</footer>
</div></body></html>`;
  download(slug(DB.meta.name)+'.html', doc, 'text/html');
  toast('Exported as standalone HTML');
}
function exportPDF(scope){
  const body=buildDocBody(scope);
  const w=window.open('','_blank');
  if(!w){ notify('Pop-up blocked — allow pop-ups for this page, or use HTML/TXT export instead.', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(DB.meta.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Spectral:ital,wght@0,300;0,400;0,600;1,400&display=swap" rel="stylesheet">
  <style>${DOC_CSS}</style></head><body><div class="wrap">${body}</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},600);}<\/script></body></html>`);
  w.document.close();
  toast('Opening print dialog — choose "Save as PDF"');
}
