/* ========== SEED DEMO WORLD ========== */
function seedDemo(){
  const w=newWorld();
  w.meta={name:'Aetheria',tagline:'a realm where memory is currency and the dead still vote',created:Date.now(),version:1};
  w.map.name='The Sundered Continent';
  const mk=(o)=>{const e=Object.assign({id:uid(),canon:'canon',tags:[],fields:{},rels:[],_t:Date.now()},o);w.entities.push(e);return e;};

  const veil = mk({type:'place',name:'Veilmarch',desc:'A border city built atop the ruins of three older cities, where the streets remember footsteps long after the walkers are gone. Its archivists are its true rulers.',birth:340,fields:{Climate:'Cold, perpetual fog',Population:'~80,000'},map:{x:34,y:42},tags:['capital','haunted']});
  const ember = mk({type:'place',name:'Emberhold',desc:'A volcanic fortress-city, sole source of sunsteel. Whoever holds Emberhold holds the means to forge the only weapons that can wound the Hollow.',birth:120,fields:{Climate:'Arid, ashfall',Export:'Sunsteel'},map:{x:68,y:61},tags:['fortress','industrial']});

  const archive = mk({type:'faction',name:'The Pale Archive',desc:'An order of memory-keepers who can read and rewrite the recollections of the recently dead. They claim no political power yet decide every succession.',birth:300,tags:['secretive','powerful']});
  const league = mk({type:'faction',name:'The Bridgewright League',desc:'A merchant consortium that, over two centuries, quietly purchased every bridge, ford, and mountain pass on the continent.',birth:510,tags:['merchant','wealthy']});

  const sera = mk({type:'char',name:'Seraphine Vael',desc:'The youngest Archivist ever raised to the Pale Seat. Said to remember her own death in a life she has not yet lived.',birth:498,fields:{Title:'First Archivist',Allegiance:'The Pale Archive'},map:{x:35,y:40},tags:['protagonist']});
  const kael = mk({type:'char',name:'Kaelen Dross',desc:'Warlord of Emberhold, last of the Dross line. Forged his crown from sunsteel and dares the dead to take it.',birth:472,death:521,fields:{Title:'Ashen King'},tags:['ruler','warrior']});
  const mira = mk({type:'char',name:'Mirae Dross',desc:'Kaelen\'s daughter and heir, raised among the forges. She doubts the old wars.',birth:501,fields:{Title:'Heir of Emberhold'},tags:['heir']});

  const hollow = mk({type:'creature',name:'The Hollow',desc:'Beings of unmade memory — what remains when a person is utterly forgotten. They hunger for the remembered and can only be wounded by sunsteel.',canon:'canon',tags:['antagonist','myth']});
  const sunsteel = mk({type:'item',name:'Sunsteel',desc:'A radiant alloy forged only in Emberhold\'s volcanic heart. The single substance that can harm the Hollow. Its recipe is a state secret.',tags:['material','rare']});
  const crown = mk({type:'item',name:'The Ashen Crown',desc:'Kaelen Dross\'s crown, forged of raw sunsteel. Legend says it slowly burns the memories of whoever wears it.',birth:500,canon:'draft',tags:['regalia']});

  const oldTongue = mk({type:'language',name:'Old Veil',desc:'The dead language of the first city beneath Veilmarch. The Archive speaks it to the deceased.',lang:{words:[{word:'morr',gloss:'memory'},{word:'thal',gloss:'death'},{word:'veska',gloss:'to remember'},{word:'un-morr',gloss:'the forgotten'},{word:'seth',gloss:'oath'}]},tags:['dead language']});

  const sundering = mk({type:'event',name:'The Sundering',desc:'The cataclysm that split the continent and first loosed the Hollow upon the world. Half of all written records were lost — or eaten.',when:500,canon:'canon',tags:['cataclysm']});
  const pact = mk({type:'event',name:'The Bridgewright Pact',desc:'The treaty by which the League gained control of all passage between cities, in exchange for funding the sunsteel forges.',when:515,tags:['treaty']});
  const battle = mk({type:'event',name:'The Last March on Veilmarch',desc:'Kaelen Dross marched the sunsteel host to defend Veilmarch against a Hollow tide. He did not return.',when:521,tags:['battle']});

  const magic = mk({type:'concept',name:'Mnemurgy',desc:'The art of shaping memory — reading it, trading it, stealing it, erasing it. The foundation of the Archive\'s power and the continent\'s strange economy.',tags:['magic-system']});
  const culture = mk({type:'culture',name:'The Veilborn',desc:'Those born in the fog-cities, who hold that nothing is truly gone while one person still remembers it. They keep their dead present in daily counsel.',tags:['people']});

  const recall = mk({type:'spell',name:'Mnemurgic Recall',desc:'An incantation that draws a single buried memory to the surface — one\'s own or, at far greater risk, another\'s. It is the Pale Archive\'s first lesson and its most quietly feared.',mana:3,created:516,tags:['mnemurgy','incantation']});

  // relationships
  const R=(a,t,b)=>{a.rels.push({type:t,target:b.id}); const inv=INVERSE[t]; if(inv)b.rels.push({type:inv,target:a.id});};
  R(sera,'member of',archive); R(sera,'speaks',oldTongue); R(sera,'located in',veil);
  R(kael,'rules',ember); R(kael,'wields',crown); R(kael,'parent of',mira); R(mira,'located in',ember);
  R(archive,'located in',veil); R(archive,'worships',magic);
  R(crown,'created',sunsteel); R(ember,'contains',sunsteel);
  R(hollow,'enemy of',culture); R(sunsteel,'associated with',hollow);
  R(battle,'associated with',kael); R(battle,'located in',veil);
  R(sundering,'associated with',hollow); R(pact,'associated with',league);
  R(league,'associated with',ember); R(culture,'speaks',oldTongue);
  R(veil,'associated with',magic); R(mira,'child of',kael);
  R(sera,'created',recall); R(recall,'associated with',magic);

  w.economy=[
    {id:uid(),name:'Sunsteel',description:'A radiant alloy forged only in Emberhold\'s volcanic heart — the one substance that can wound the Hollow. Its recipe is a guarded state secret.',rarity:'Legendary',value:'A king\'s ransom by the ingot',scarcity:6,danger:'Significant'},
    {id:uid(),name:'Bottled Memory',description:'Recollections drawn from the living or the dead and sealed in glass, traded openly in Veilmarch. The Archive sets the going rate.',rarity:'Rare',value:'10–500 marks, by vintage',scarcity:24,danger:'Severe'},
    {id:uid(),name:'Fogwheat',description:'A pale grain that thrives in the perpetual mist of the fog-cities. The staple loaf of the Veilborn.',rarity:'Common',value:'A few coppers a bushel',scarcity:62,danger:'None'},
    {id:uid(),name:'Bridge-tolls',description:'Not a good but a stranglehold: the Bridgewright League taxes every crossing, ford, and pass on the continent.',rarity:'Common',value:'Set by the League, never negotiable',scarcity:45,danger:'Mild'},
    {id:uid(),name:'Forgotten Names',description:'The true names of those wholly forgotten — raw material of the Hollow, and the most forbidden thing one can trade.',rarity:'Legendary',value:'Priceless, and damning to hold',scarcity:3,danger:'Catastrophic'},
  ];
  w.notes='The central tension of [[Aetheria]] is simple: in a world ruled by [[Mnemurgy]], to be remembered is to have power, and to be forgotten is to cease — to become one of [[The Hollow]].\n\nThe [[Pale Archive]] sits at the center of every web. They do not rule openly, yet [[Seraphine Vael]] decides who is remembered as a rightful heir and who is quietly let slip. When [[Kaelen Dross]] fell at [[The Last March on Veilmarch]], it was the Archive — not the League — who chose how he would be remembered, and therefore whether [[Mirae Dross]] would inherit at all.\n\nOPEN THREADS:\n- Does Seraphine truly remember a future life, or is it an Archive fabrication?\n- The recipe for [[Sunsteel]] — who outside Emberhold knows it?\n- The [[Bridgewright League]] funded the forges. What do they want in return that hasn\'t come due yet?';
  w.journal=[
    {id:uid(),title:'The Pale Seat',campaign:'The Sundering Saga',date:'2024-01-12',year:521,_t:Date.now(),body:'The session opened in the fog-streets of [[Veilmarch]], where the party sought an audience with [[Seraphine Vael]]. She received them in the lowest vault of [[The Pale Archive]], walled in by the bottled memories of the dead.\n\nSeraphine let slip that the rite of succession is not law but [[Mnemurgy]]: whoever the Archive chooses to remember as the rightful heir becomes so. The line of [[Kaelen Dross]], the party realized, hangs by a single thread of recollection.\n\nThey left with more questions than answers — and a warning that some memories, once recalled, cannot be put back.'},
    {id:uid(),title:'Ash on the Wind',campaign:'The Sundering Saga',date:'2024-01-26',year:521,_t:Date.now()+1,body:'Word reached the party of armies massing at [[Emberhold]]. [[Kaelen Dross]] had emptied his forges, marching every blade of [[Sunsteel]] toward the fog to meet a rising tide of [[The Hollow]].\n\nWhat followed would be remembered as [[The Last March on Veilmarch]]. The party held the rear of the column as the Ashen King rode ahead into the mist — and did not ride back.\n\nIn the silence after, [[Mirae Dross]] stood to inherit a throne of ash, and the question of who would remember her as heir loomed larger than any army.'},
  ];
  return w;
}
