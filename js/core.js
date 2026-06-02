/* ========== ICONS ========== */
const I = {
  char:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/></svg>',
  place:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  faction:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/><path d="M4 12h16"/></svg>',
  item:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-7.5L3 9l6-1z"/></svg>',
  event:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  creature:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 11c0-3 2-5 4-5 1 0 2 .5 2 1.5S8 9 8 9m12 2c0-3-2-5-4-5-1 0-2 .5-2 1.5S16 9 16 9M4 11c0 5 4 9 8 9s8-4 8-9M9 14c.5 1 2 1.5 3 1.5s2.5-.5 3-1.5"/></svg>',
  concept:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/></svg>',
  culture:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-5h6v5M9 13h.01M15 13h.01"/></svg>',
  language:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h16M9 3v2c0 5-2.5 9-6 11M5 9c0 3 3.5 6 8 7M13 21l4-9 4 9M14.5 17h5"/></svg>',
  spell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 3 L12.2 7.8 L17 10 L12.2 12.2 L10 17 L7.8 12.2 L3 10 L7.8 7.8 Z"/><path d="M18 14.5 L19 17 L21.5 18 L19 19 L18 21.5 L17 19 L14.5 18 L17 17 Z"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  export:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v12M7 8l5-5 5 5M5 21h14"/></svg>',
  save:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
  load:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-8l-2-3H4a1 1 0 0 0-1 1z"/></svg>',
  dash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  graph:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="17" r="2.5"/><path d="M8 7.5 10.5 15M15.5 8 13 15M8 6.5h7.5"/></svg>',
  timeline:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 12h18M6 12V8M12 12V6M18 12v-3M6 16v-2M12 18v-4M18 16v-2"/></svg>',
  map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>',
  checkBig:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m8 12 3 3 5-6"/><circle cx="12" cy="12" r="10"/></svg>',
  systems:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  notes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 3h11l4 4v14a0 0 0 0 1 0 0H5a0 0 0 0 1 0 0z" stroke-linejoin="round"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>',
  dice:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="16" cy="8" r="1.3" fill="currentColor"/><circle cx="8" cy="16" r="1.3" fill="currentColor"/><circle cx="16" cy="16" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 19V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2zM19 3v18"/></svg>',
  globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  filter:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z"/></svg>',
};

/* ========== ENTITY TYPE REGISTRY ========== */
const TYPES = {
  char:    {name:'Character', plural:'Characters', icon:'char',     color:'#d9a441', desc:'People, beings, individuals'},
  place:   {name:'Location',  plural:'Locations',  icon:'place',    color:'#bb6b3d', desc:'Cities, regions, sites'},
  faction: {name:'Faction',   plural:'Factions',   icon:'faction',  color:'#6b8a9a', desc:'Orders, nations, guilds'},
  item:    {name:'Artifact',  plural:'Artifacts',  icon:'item',     color:'#9a6b8a', desc:'Objects, relics, treasures'},
  event:   {name:'Event',     plural:'Events',     icon:'event',    color:'#c0584f', desc:'Battles, eras, happenings'},
  creature:{name:'Creature',  plural:'Bestiary',   icon:'creature', color:'#8a9a6b', desc:'Beasts, species, monsters'},
  culture: {name:'Culture',   plural:'Cultures',   icon:'culture',  color:'#c99a5a', desc:'Peoples, traditions'},
  language:{name:'Language',  plural:'Languages',  icon:'language', color:'#7a8aaa', desc:'Tongues, scripts, conlangs'},
  concept: {name:'Concept',   plural:'Concepts',   icon:'concept',  color:'#aa8acc', desc:'Magic, religion, ideas'},
  spell:   {name:'Spell',     plural:'Grimoire',   icon:'spell',    color:'#8a6bcc', desc:'Spells, incantations, magic effects'},
};
const TYPE_KEYS = Object.keys(TYPES);

/* relationship vocabulary (typed edges) */
const REL_TYPES = ['allied with','enemy of','member of','parent of','child of','sibling of','married to','rules','located in','contains','created','wields','worships','speaks','descends from','serves','betrayed','mentor of','originates from','associated with'];

/* ========== STATE ========== */
let DB = newWorld();
function newWorld(){
  return {
    meta:{ name:'Untitled World', tagline:'an unwritten realm', created:Date.now(), version:1 },
    calendar:{ epoch:'CE', months:['Frostmoon','Thawmoon','Seedmoon','Bloommoon','Sunheight','Highsun','Goldfall','Harvestmoon','Dimming','Frostfall','Deepwinter','Yearturn'], daysPerMonth:30, eras:[
      {id:'era1', name:'The First Age', start:0, end:500, color:'#6b8a9a'},
      {id:'era2', name:'The Sundering', start:500, end:520, color:'#c0584f'},
      {id:'era3', name:'The Long Peace', start:520, end:1200, color:'#8a9a6b'},
    ]},
    entities:[],      // {id,type,name,desc,canon,tags,fields:{},rels:[{type,target}],birth,death,when,map:{x,y},lang:{words:[]},mana,created}
    notes:'',         // freeform lore document
    map:{ image:null, name:'The Known World' },
    economy:[],       // {id,name,description,rarity,value,scarcity,danger} — scarcity kept for back-compat
    branches:[],      // saved alternate snapshots {id,name,date,data}
  };
}
let UI = { view:'dashboard', selected:null, filterType:'all', search:'', canonFilter:'all', graphView:'all', sort:'name' };

const uid = ()=> 'e'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = s => (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ent = id => DB.entities.find(e=>e.id===id);
/* toast() and notify() are defined in notify.js (loaded after core.js) */
