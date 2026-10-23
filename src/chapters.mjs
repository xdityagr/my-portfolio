import {escape,external,ink} from './components.mjs';
const chapter=(n,title)=>'<div class="chapter-label studio-label"><span>'+n+' / '+title+'</span><span>ADITYA GAUR — THE STORY SO FAR</span></div>';
const sourceLink=(href,label)=>external(href,label+' ↗','studio-link');
const awards=[
 {year:'2025',mark:'Winner',title:'MUJ HackForge',tag:'Manipal University Jaipur',copy:'Winner at MUJ HackForge 2025.'},
 {year:'MUJ',mark:'Top 3',title:'HackX 3.0',tag:'Winner · top-three finish',copy:'A top-three winning team at MUJ HackX 3.0.'},
 {year:'NATIONAL GRAND FINALE',mark:'Top 2',title:'Craft N Code',tag:'Rajasthan selection · IIIT Bhubaneswar',copy:'Selected among the top two teams from Rajasthan, advancing to the national grand finale of Craft N Code by IIIT Bhubaneswar.'},
 {year:'MUJ',mark:'Top 10',title:'HackX 4.0',tag:'Manipal University Jaipur',copy:'Selected among the top ten teams at MUJ HackX 4.0.'},
 {year:'2025',mark:'Top 7',title:'Udyamotsav',tag:'Investor pitch',copy:'Selected among the top seven for an investor pitch in Chandigarh, with a meeting at the Ministry of Education office.'},
 {year:'NATIONAL STAGE',mark:'MoE',title:'Anna Rakshak at Bharat Mandapam',tag:'Research into the room',copy:'Presented Anna Rakshak at the national level under the Ministry of Education, at Bharat Mandapam.'},
 {year:'2023',mark:'Winner',title:'Code Red 2.0 Codethon',tag:'₹20,000 prize',copy:'First place at the ACIC–VGU Foundation codethon. Another idea taken all the way from a problem to a working build.'},
 {year:'2022',mark:'3rd',title:'CodeRed Hackathon',tag:'2nd runner-up · ₹20,000 prize',copy:'An early hackathon milestone: building, testing, and presenting under the pressure of a deadline.'},
 {year:'2023',mark:'Runner-up',title:'Design Championship',tag:'Senior coding · North & East India',copy:'DiscoverQuotesDaily Bot. A coding project with a creative point of view.',href:'https://designchampionship.in/winner-region1',link:'View the official results'},
 {year:'NATIONAL RECOGNITION',mark:'Top 20',title:'IBM & 1M1B AI Youth Awards',tag:'Presented in Bengaluru',copy:'SHIELD: bringing AI and IoT together for women’s safety.'},
 {year:'2023',mark:'Top 500',title:'Youth Ideathon',tag:'Ideas with a purpose',copy:'Selected in the top 500 at Youth Ideathon 2023.'},
 {year:'REGIONAL WINNER',mark:'SHIELD',title:'CBSE Science Exhibition',tag:'AI meets the physical world',copy:'Facial recognition, RFID, and LoRa-based alerts, brought together in a women’s safety system.'},
 {year:'2024',mark:'Top 20',title:'Delhi Hackathon',tag:'Finalist',copy:'A top-20 finish, and another chance to turn an unfamiliar problem into something tangible.'}
];
// Deterministic per-index randomness for the clippings' tilt and cut.
const hash=(i,k)=>{const x=Math.sin(i*91.7+k*13.3)*43758.5453;return x-Math.floor(x)};
// A scissor cut, as polygon points in %: jittered edges, and every third clipping cut with pinking shears on top.
function clipCut(i){
 const pts=[],j=(k,a)=>+(hash(i,k)*a).toFixed(2);
 for(let x=0;x<=100;x+=4)pts.push([x,i%3===0?(x%8?1.6:0):j(x,1.4)]);
 for(let y=6;y<=94;y+=11)pts.push([100-j(y+200,1.2),y]);
 for(let x=100;x>=0;x-=5)pts.push([x,100-j(x+400,1.6)]);
 for(let y=94;y>=6;y-=11)pts.push([j(y+600,1.2),y]);
 return pts;
}
// An illustrative gas-sensor reading: a slow S-shaped rise with a little drift, as a Catmull-Rom spline in a
// 1000×300 box, and the point where it crosses the alert line.
function sensorReading(){
 const W=1000,base=300,alert=112;
 const pts=Array.from({length:21},(_,i)=>{const t=i/20,s=t*t*(3-2*t);return [t*W,base-16-250*s+8*Math.sin(i*.9)+4*Math.sin(i*2.3+1)]});
 let line='M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
 for(let i=0;i<pts.length-1;i++){const a=pts[i-1]||pts[i],b=pts[i],c=pts[i+1],e=pts[i+2]||c;
  line+='C'+(b[0]+(c[0]-a[0])/6).toFixed(1)+' '+(b[1]+(c[1]-a[1])/6).toFixed(1)+' '+(c[0]-(e[0]-b[0])/6).toFixed(1)+' '+(c[1]-(e[1]-b[1])/6).toFixed(1)+' '+c[0].toFixed(1)+' '+c[1].toFixed(1)}
 let cross=pts[pts.length-1];
 for(let i=1;i<pts.length;i++)if(pts[i][1]<=alert){const a=pts[i-1],b=pts[i],f=(a[1]-alert)/(a[1]-b[1]);cross=[a[0]+(b[0]-a[0])*f,alert];break}
 return {W,H:300,base,alert,line,area:line+'L'+W+' '+base+'L0 '+base+'Z',cross};
}
function readingFigure(){
 const r=sensorReading(),x=(r.cross[0]/r.W*100).toFixed(2)+'%',top=(r.alert/r.H*100).toFixed(2)+'%',at='left:'+x+';top:'+top;
 const grid=[200,400,600].map(ppm=>'<div class="grid" style="top:'+((1-ppm/800)*100).toFixed(2)+'%"><span>'+ppm+'</span></div>').join('');
 const svg='<svg viewBox="0 0 '+r.W+' '+r.H+'" preserveAspectRatio="none" aria-hidden="true"><defs>'+
  '<clipPath id="rd-under"><path d="'+r.area+'"/></clipPath><clipPath id="rd-past"><rect width="'+r.W+'" height="'+r.alert+'"/></clipPath><clipPath id="rd-before"><rect y="'+r.alert+'" width="'+r.W+'" height="'+(r.H-r.alert)+'"/></clipPath>'+
  '<linearGradient id="rd-inkline" x2="1"><stop offset="0" stop-color="var(--press-ink)"/><stop offset="1" stop-color="var(--press-violet)"/></linearGradient>'+
  '<linearGradient id="rd-fade" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient><mask id="rd-mask"><rect width="'+r.W+'" height="'+r.H+'" fill="url(#rd-fade)"/></mask></defs>'+
  '<g clip-path="url(#rd-under)" mask="url(#rd-mask)"><image class="marble" x="0" y="0" width="'+r.W+'" height="'+r.H+'" preserveAspectRatio="none" clip-path="url(#rd-before)" opacity=".22"/><image class="marble" x="0" y="0" width="'+r.W+'" height="'+r.H+'" preserveAspectRatio="none" clip-path="url(#rd-past)"/></g>'+
  '<line x1="0" x2="'+r.W+'" y1="'+r.base+'" y2="'+r.base+'" class="axis"/>'+
  '<path d="'+r.line+'" class="trace"/><path d="'+r.line+'" class="trace inked" stroke="url(#rd-inkline)" clip-path="url(#rd-past)"/></svg>';
 return '<figure class="reading" id="reading" data-cross="'+(r.cross[0]/r.W).toFixed(4)+'"><p class="figlabel"><span>Fig. 1 · NH₃ · CO₂ / ppm</span><span>Time →</span></p><div class="plot">'+grid+svg+
  '<div class="thr" style="top:'+top+'"><span>Alert</span></div><span class="leader" style="'+at+'" aria-hidden="true"></span><span class="dot" style="'+at+'" aria-hidden="true"></span><p class="note" style="'+at+'">Spoilage begins — <em>alert sent</em></p></div>'+
  '<figcaption>Fig. 1 — An illustrative gas-sensor reading. When it crosses the line, Anna Rakshak raises the alert.</figcaption></figure>';
}
// SIH as a front page: a pressed headline that soaks up ink, the interview as the pull quote, the build and its
// funding, and the reading. The highlights below are clippings cut from the same paper.
export function recognitionSection(){
 return '<section id="recognition" class="recognition-studio section-pad chapter-space" data-studio>'+chapter('03','BUILT. TESTED. RECOGNISED.')+
 '<div class="gazette"><div class="masthead"><p class="flag">The Build Gazette</p><span class="studio-eyebrow">Smart India Hackathon · 2024</span></div>'+
 '<div class="headline-wrap"><h2 class="headline blind" aria-hidden="true">National <em>winner.</em></h2><h2 class="headline inked">National <em>'+ink('winner.','winner','full')+'</em></h2></div>'+
 '<p class="deck">A small team. A real problem. A build that made it beyond the hackathon.</p>'+
 '<div class="v2" id="interview"><blockquote class="hugequote"><span class="qmark" aria-hidden="true">'+ink('“','quote')+'</span><span class="words">Interviewed by the AICTE Innovation <em>'+ink('Director.','director')+'</em></span><cite>On the Ministry of Education’s Innovation Cell channel — '+external('https://www.youtube.com/watch?v=EGvJWGLIl4E','watch ↗')+'</cite></blockquote>'+
 '<div class="v2-side"><p class="studio-eyebrow">The winning build</p><h3 class="big-h">Anna <em>'+ink('(अन्न)','anna')+'</em> Rakshak</h3><p class="lede">Detecting food-grain spoilage before it becomes waste. Multi-gas sensors, an ESP32, cloud dashboards, and real-time alerts—software connected to a problem you can hold in your hands.</p>'+
 '<div class="fund-box"><span class="label">Project funding</span><strong><span class="sr-only">₹75,000</span><span class="count" aria-hidden="true">₹75,000</span></strong><span>With patenting support from the Ministry of Education and AICTE.</span></div></div></div>'+
 readingFigure()+'</div>'+
 '<div class="recognition-wall-head"><h3>A few<br><em>'+ink('highlights.','highlights')+'</em></h3><p>Cut from a<br>much longer story.</p></div>'+
 '<ul class="board" role="list">'+awards.map((a,i)=>{const pts=clipCut(i);return '<li class="clip'+(/Winner|MoE|Top 2/.test(a.mark)?' big':'')+'" style="--r:'+((hash(i,1)-.5)*5.5).toFixed(1)+'deg"><div class="sheet"><div class="cut" style="clip-path:polygon('+pts.map(p=>p[0]+'% '+p[1]+'%').join(',')+')"><p class="dateline">'+escape(a.year)+'</p><h3><em>'+escape(a.mark)+'</em>'+escape(a.title)+'</h3><p class="body">'+escape(a.copy)+'</p><p class="tag">'+escape(a.tag)+'</p>'+(a.href?sourceLink(a.href,a.link):'')+'</div><svg class="edge" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="'+pts.map(p=>p[0]+','+p[1]).join(' ')+'"/></svg></div></li>'}).join('')+'</ul><p class="swipe-hint" aria-hidden="true"><i></i>Swipe</p></section>';
}
const experiences=[
 {id:'now',ink:'Pineyard.ai',date:'CURRENT CHAPTER',title:'Tech Lead · Pineyard.ai',copy:'Technical leadership, website design, and development for a voice AI startup.',detail:'Thinking across the product, the engineering, and the experience people actually use.'},
 {id:'making',ink:'day one.',date:'2022 — PRESENT',title:'Independent, from day one.',copy:'Freelance software developer, building full-stack applications, AI tools, and IoT interfaces for international clients.',detail:'From the first conversation to deployment and support. 15+ applications and tools delivered.'},
 {id:'learning',ink:'curiosity.',date:'2025 — 2029',title:'Computer Science, with curiosity.',copy:'B.Tech in Computer Science at Manipal University Jaipur.',detail:'Learning the foundations, then finding places to put them to work.'},
 {id:'before',ink:'Public School',date:'DELHI ROOTS',title:'Vikas Bharati Public School',copy:'CBSE Class XII · Delhi. Secretary of the STEAM Club and Reader’s Club.',detail:'Tech and literary events, design and documentary awards, and a documentary for author Paro Anand at our school’s Author’s Meet.'}
];
function knightBoard(){
 return '<div class="knight-board" aria-label="Knight movement board">'+Array.from({length:64},(_,i)=>'<button disabled type="button" class="knight-square '+((Math.floor(i/8)+i%8)%2?'square-dark':'')+'" data-square="'+i+'" aria-label="'+String.fromCharCode(97+i%8)+(8-Math.floor(i/8))+'"></button>').join('')+'<svg class="knight-routes" viewBox="0 0 8 8" fill="none" aria-hidden="true"><path/></svg><span class="knight-piece" aria-hidden="true">♘</span></div>';
}
function drumGrid(){
 const pattern={kick:[0,4],snare:[2,6],hat:[0,1,2,3,4,5,6,7]};
 return '<div class="beat-grid" aria-label="Eight-step drum sequencer">'+['kick','snare','hat'].map(name=>'<div class="beat-track"><span>'+({kick:'Kick',snare:'Snare',hat:'Hat'})[name]+'</span>'+Array.from({length:8},(_,i)=>'<button disabled type="button" data-step="'+i+'" data-track="'+name+'" aria-pressed="'+pattern[name].includes(i)+'" aria-label="'+name+' step '+(i+1)+'"></button>').join('')+'</div>').join('')+'</div>';
}
export function personSection(){
 return '<section id="about" class="person-studio section-pad chapter-space" data-studio>'+chapter('04','THE PERSON, TOO')+
 '<div class="person-pin"><div class="person-heading"><h2>Made of more than <em>'+ink('code.','code')+'</em></h2></div><div class="person-hold" aria-hidden="true"></div></div>'+
 '<div class="person-story"><div class="person-letter"><div class="person-locations"><span>Delhi roots.</span><svg class="route" viewBox="0 0 140 44" fill="none" aria-hidden="true"><path class="route-track" d="M6 34C46 40 84 6 134 10"/><path class="route-path" pathLength="1" d="M6 34C46 40 84 6 134 10"/><circle class="route-city" cx="6" cy="34" r="2"/><circle class="route-city" cx="134" cy="10" r="2"/><circle class="route-dot" cx="134" cy="10" r="4"/></svg><em>Jaipur chapter.</em></div><p class="person-age-note">19. Still curious.</p><p class="person-lead">I’m Aditya.<br>I like knowing <em>'+ink('how it works.','how')+'</em><br>And imagining how it could.</p><p>I’m a software engineer from Delhi, studying Computer Science at Manipal University Jaipur. I build AI applications, full-stack products, developer tools, and things that reach beyond a screen.</p><div class="person-facts"><div><strong><span class="sr-only">15+</span><span class="count" aria-hidden="true">15+</span></strong><span>Freelance apps<br>& tools delivered</span></div><div><strong><span class="sr-only">2021</span><span class="count" aria-hidden="true">2021</span></strong><span>Started building<br>independently</span></div></div></div>'+
 '<div class="person-timeline"><span class="studio-eyebrow">The story so far</span><ol class="ink-timeline" role="list">'+experiences.map(e=>'<li><span class="tl-node" aria-hidden="true"></span><div class="tl-body"><span class="tl-date">'+e.date+'</span><h3>'+e.title.replace(e.ink,'<em>'+e.ink+'</em>')+'</h3><p>'+e.copy+'</p><p class="tl-detail">'+e.detail+'</p></div></li>').join('')+'</ol></div></div>'+
 '<div class="playground" id="playground"><div class="playground-head"><p class="studio-eyebrow">When the editor is closed</p><h3>A different kind<br>of <em>thinking.</em></h3><p>A board. A beat. A blank page.<br>Pick a card. Turn it over. Play.</p></div><ul class="hand" role="list">'+
 '<li class="card" style="--rot:-5deg;--drop:22px;--z:1"><div class="card-inner"><button type="button" class="card-face card-front" aria-expanded="false" aria-controls="play-chess"><span class="card-corner">01 / Chess</span><span class="card-glyph" aria-hidden="true">♞</span><span class="card-title">A few moves <em>ahead.</em></span><span class="card-cue">Turn over ↻</span></button><article class="play-card chess-play card-face card-back" id="play-chess"><span class="play-number">01 / CHESS</span><h4>A few moves<br><em>ahead.</em></h4><p>Strategy, patience, and finding a better move. A small study in possibilities. Move the knight; watch its next paths unfold.</p><div class="play-visual knight-visual">'+knightBoard()+'</div><div class="play-tools" data-chess-tools hidden><span class="knight-count">Knight on d4</span><button type="button" data-chess-reset>Recenter ↺</button></div><p class="play-hint knight-status" role="status">Trace a possibility. Every move changes the next.</p><button type="button" class="card-close">↺ Turn back</button></article></div></li>'+
 '<li class="card" style="--rot:0deg;--drop:0px;--z:2"><div class="card-inner"><button type="button" class="card-face card-front" aria-expanded="false" aria-controls="play-rhythm"><span class="card-corner">02 / Rhythm</span><span class="card-glyph is-time" aria-hidden="true"><span>4</span><span>4</span></span><span class="card-title">Find your <em>pocket.</em></span><span class="card-cue">Turn over ↻</span></button><article class="play-card rhythm-play card-face card-back" id="play-rhythm" data-drum-kit><span class="play-number">02 / RHYTHM</span><h4>Find your<br><em>pocket.</em></h4><p>Drums, a wide-ranging music queue, and a good reason to step away from the keyboard.</p><div class="play-visual rhythm-visual"><div class="drum-pads"><button disabled type="button" class="drum-key kick-key" data-drum="kick" aria-label="Play kick drum">Kick<kbd>A</kbd></button><button disabled type="button" class="drum-key snare-key" data-drum="snare" aria-label="Play snare drum">Snare<kbd>S</kbd></button><button disabled type="button" class="drum-key hat-key" data-drum="hat" aria-label="Play hi-hat">Hi-hat<kbd>D</kbd></button></div><svg class="rhythm-wave" viewBox="0 0 300 55" fill="none" aria-hidden="true"><path d="M0 28h60q8-32 16 0t16 0 16 0 16 0 16 0 16 0 16 0 16 0h112"/></svg></div><details class="rhythm-editor"><summary>Shape the rhythm</summary>'+drumGrid()+'</details><div class="play-tools rhythm-controls" hidden><button class="groove-toggle" type="button" aria-pressed="false">Play the groove ▶</button><span>92 BPM</span></div><p class="play-hint rhythm-status" role="status">Tap a pad, or focus here and use A / S / D.</p><button type="button" class="card-close">↺ Turn back</button></article></div></li>'+
 '<li class="card" style="--rot:5deg;--drop:22px;--z:1"><div class="card-inner"><button type="button" class="card-face card-front" aria-expanded="false" aria-controls="play-poetry"><span class="card-corner">03 / Words &amp; shapes</span><span class="card-glyph" aria-hidden="true">¶</span><span class="card-title">Leave room for <em>wonder.</em></span><span class="card-cue">Turn over ↻</span></button><article class="play-card poetry-play card-face card-back" id="play-poetry"><span class="play-number">03 / WORDS & SHAPES</span><h4>Leave room<br>for <em>wonder.</em></h4><p>Poetry, graphic design, and the pleasure of finding the right words. Make a little line of your own.</p><div class="play-visual poetry-visual"><div class="word-canvas" aria-label="Your word composition"><p class="word-placeholder">A thought begins here.</p><div class="word-line" aria-live="polite"></div></div><div class="word-bank" aria-label="Words to compose with">'+['somewhere','between','a','thought','and','the','quiet','we','make','room','for','wonder','light','takes','shape'].map(word=>'<button disabled type="button" data-word="'+word+'">'+word+'</button>').join('')+'</div></div><div class="play-tools word-controls" hidden><span class="word-count">0 words</span><button type="button" data-word-reset>Fresh page ↺</button></div><p class="play-hint">Choose a word to add it. Tap it again on the page to let it go.</p><button type="button" class="card-close">↺ Turn back</button></article></div></li></ul><p class="swipe-hint hand-hint" aria-hidden="true"><i></i>Swipe</p></div></section>';
}
const toolkit=[
 {id:'intelligence',label:'01 / INTELLIGENCE',title:'From an idea<br>to <em>intelligence.</em>',copy:'Models, APIs, and systems that do something useful.',tools:[
 ['Python','Py','AI tools, data workflows, interpreters, and backend systems.','StarForge','starforge'],
 ['FastAPI','Fa','APIs that connect AI applications and full-stack products.','',''],
 ['LangChain','Lc','Orchestration for AI applications and conversational workflows.','',''],
 ['OpenCV','Cv','Computer vision and image-processing experiments.','','']]},
 {id:'interfaces',label:'02 / EXPERIENCE',title:'Built to work.<br>Shaped to <em>feel.</em>',copy:'The product and the interface, considered together.',tools:[
 ['React','Re','Interactive interfaces and full-stack web products.','',''],
 ['TypeScript','TS','Typed application code for products and interfaces.','',''],
 ['Figma','Fi','Visual direction, interface design, and prototyping.','Pineyard.ai','pineyard'],
 ['PySide','Qt','Desktop interfaces and tools built with Python.','Caret AI','caret']]},
 {id:'systems',label:'03 / FOUNDATIONS',title:'Under<br>the <em>surface.</em>',copy:'Languages, data, and the machinery underneath.',tools:[
 ['C / C++','C++','Low-level programming, systems thinking, and embedded applications.','',''],
 ['PostgreSQL','SQL','Relational data and application backends.','',''],
 ['Docker','Do','Consistent environments for building and shipping software.','',''],
 ['Git','Git','Version control across independent and collaborative projects.','','']]},
 {id:'hardware',label:'04 / THE PHYSICAL WORLD',title:'Beyond<br>the <em>screen.</em>',copy:'Sensors, signals, and software out in the world.',tools:[
 ['ESP32','32','Connected sensors and real-time monitoring for Anna Rakshak.','',''],
 ['Arduino','∞','Prototyping and building hardware experiments.','',''],
 ['RFID','RF','Identification and sensing in connected hardware systems.','',''],
 ['LoRa','Lo','Long-range communication and alerts in SHIELD.','','']]}
];
// A type specimen: each domain is a slow marquee of tool names (three copies so the loop never shows a seam;
// only the first copy is focusable and read). An sr-only list carries every tool and note.
function specimenSet(group,copy){
 return '<div class="specimen-set"'+(copy?' aria-hidden="true"':'')+'>'+group.tools.map(([name,,note,project,slug],i)=>'<button type="button" class="specimen-name'+(i%2?' is-serif':'')+'" data-note="'+escape(note)+'"'+(slug?' data-project="'+escape(project)+'" data-project-slug="'+slug+'"':'')+(copy?' tabindex="-1"':'')+'>'+escape(name)+'</button><span class="specimen-sep" aria-hidden="true">✳</span>').join('')+'</div>';
}
export function toolkitSection(){
 return '<section id="practice" class="toolkit-studio section-pad chapter-space" data-studio>'+chapter('05','THE THINGS I REACH FOR')+'<div class="toolkit-heading"><h2>My working <em>'+ink('toolkit.','toolkit')+'</em></h2><p>Tools I use to turn<br>curiosity into something real.</p></div>'+
 '<ul class="toolkit-list sr-only">'+toolkit.flatMap(group=>group.tools.map(([name,,note])=>'<li>'+escape(name)+': '+escape(note)+'</li>')).join('')+'</ul>'+
 '<div class="specimen">'+toolkit.map((group,r)=>'<div class="specimen-row'+(r%2?' is-reverse':'')+'" style="--dur:'+[38,46,42,50][r]+'s"><span class="specimen-label">'+group.label+'</span><div class="specimen-viewport"><div class="specimen-track">'+[0,1,2].map(copy=>specimenSet(group,copy)).join('')+'</div></div></div>').join('')+'</div>'+
 '<p class="specimen-caption" role="status">Hover a name, or pause on one, to see where it shows up.</p></section>';
}
