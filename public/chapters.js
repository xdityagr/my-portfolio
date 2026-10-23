import './chapter-motion.js';
// Small, independent interactions for the story chapters. No autoplay audio.
const root=document.documentElement;
const announceLayout=()=>dispatchEvent(new Event('portfolio-layout'));

// Knight movement: legal L-shaped moves, visited squares, and keyboard travel.
function initKnight(){const board=document.querySelector('.knight-board');
if(board){
 const squares=[...board.querySelectorAll('[data-square]')],counter=document.querySelector('.knight-count'),status=document.querySelector('.knight-status');
 const path=board.querySelector('.knight-routes path');let current=35,previous=null;
 const coordinate=i=>String.fromCharCode(97+i%8)+(8-Math.floor(i/8));
 const canMove=i=>{const dx=Math.abs(i%8-current%8),dy=Math.abs(Math.floor(i/8)-Math.floor(current/8));return dx*dy===2};
 function trace(from,to){
  if(from===null||to===null){path.setAttribute('d','');return}
  const x=from%8+.5,y=Math.floor(from/8)+.5,tx=to%8+.5,ty=Math.floor(to/8)+.5;
  const horizontal=Math.abs(tx-x)===2;
  path.setAttribute('d','M'+x+' '+y+'L'+(horizontal?tx:x)+' '+(horizontal?y:ty)+'L'+tx+' '+ty);
 }
 function render(){
  squares.forEach((square,i)=>{const legal=canMove(i);square.disabled=false;square.tabIndex=i===current?0:-1;square.classList.toggle('legal',legal);square.classList.remove('visited');square.setAttribute('aria-label',coordinate(i)+(i===current?', knight':legal?', available move':''));if(i===current)square.setAttribute('aria-current','true');else square.removeAttribute('aria-current')});
  board.style.setProperty('--knight-file',String(current%8));board.style.setProperty('--knight-rank',String(Math.floor(current/8)));
  counter.textContent=previous===null?'Knight on '+coordinate(current):coordinate(previous)+' → '+coordinate(current);
  trace(previous,current);
 }
 document.querySelector('[data-chess-tools]').hidden=false;
 board.addEventListener('pointerover',event=>{const square=event.target.closest('[data-square]');if(square&&canMove(Number(square.dataset.square)))trace(current,Number(square.dataset.square))});
 board.addEventListener('pointerleave',()=>trace(previous,current));
 board.addEventListener('focusin',event=>{const square=event.target.closest('[data-square]');if(square&&canMove(Number(square.dataset.square)))trace(current,Number(square.dataset.square))});
 board.addEventListener('click',event=>{
  const square=event.target.closest('[data-square]');if(!square)return;const next=Number(square.dataset.square);
  if(!canMove(next)){status.textContent='An L-shaped move opens the next possibilities.';return}
  previous=current;current=next;render();squares[current].focus({preventScroll:true});status.textContent=coordinate(previous)+' to '+coordinate(current)+'. A new set of possibilities.';
 });
 board.addEventListener('keydown',event=>{
  const square=event.target.closest('[data-square]');if(!square)return;
  const i=Number(square.dataset.square),col=i%8,row=Math.floor(i/8);
  const next=event.key==='ArrowRight'?row*8+Math.min(7,col+1):event.key==='ArrowLeft'?row*8+Math.max(0,col-1):event.key==='ArrowDown'?Math.min(7,row+1)*8+col:event.key==='ArrowUp'?Math.max(0,row-1)*8+col:-1;
  if(next<0)return;event.preventDefault();squares.forEach((el,j)=>el.tabIndex=j===next?0:-1);squares[next].focus({preventScroll:true});
 });
 document.querySelector('[data-chess-reset]').addEventListener('click',()=>{current=35;previous=null;render();status.textContent='Back to d4. A fresh point of view.'});render();
}
}

// A small drum kit: a pitched kick, filtered-noise snare, and crisp hi-hat.
// All sound starts after a deliberate pad / play action and stops offscreen.
function initDrums(){const kit=document.querySelector('[data-drum-kit]');
if(kit){
 const pads=[...kit.querySelectorAll('[data-drum]')],steps=[...kit.querySelectorAll('[data-track]')];
 const toggle=kit.querySelector('.groove-toggle'),status=kit.querySelector('.rhythm-status');
 let audio,master,noise,playing=false,starting=false,kitVisible=true,scheduler=0,nextTime=0,nextStep=0;
 const sources=new Set(),timers=new Set(),hitTimers=new Map();
 const later=(fn,delay)=>{const id=setTimeout(()=>{timers.delete(id);fn()},delay);timers.add(id)};
 async function readyAudio(){
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)throw new Error('unsupported');
  if(!audio){
   audio=new Audio();
   const compressor=audio.createDynamicsCompressor();
   compressor.threshold.value=-18;compressor.knee.value=18;compressor.ratio.value=3;compressor.attack.value=.003;compressor.release.value=.16;
   master=audio.createGain();master.gain.value=.45;master.connect(compressor);compressor.connect(audio.destination);
   noise=audio.createBuffer(1,audio.sampleRate,audio.sampleRate);
   const values=noise.getChannelData(0);for(let i=0;i<values.length;i++)values[i]=Math.random()*2-1;
  }
  if(audio.state==='suspended')await audio.resume();
 }
 function envelope(peak,time,length){
  const gain=audio.createGain();gain.gain.setValueAtTime(.0001,time);
  gain.gain.exponentialRampToValueAtTime(peak,time+.003);
  gain.gain.exponentialRampToValueAtTime(.0001,time+length);
  gain.connect(master);return gain;
 }
 function start(source,gain,time,length,filter){
  if(filter){source.connect(filter);filter.connect(gain)}else source.connect(gain);
  sources.add(source);source.onended=()=>{sources.delete(source);source.disconnect();filter?.disconnect();gain.disconnect()};
  source.start(time);source.stop(time+length+.02);
 }
 function noiseHit(time,peak,length,frequency,type='highpass'){
  const source=audio.createBufferSource();source.buffer=noise;
  const filter=audio.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=.7;
  start(source,envelope(peak,time,length),time,length,filter);
 }
 function sound(name,time){
  if(name==='kick'){
   const oscillator=audio.createOscillator();oscillator.type='sine';
   oscillator.frequency.setValueAtTime(155,time);oscillator.frequency.exponentialRampToValueAtTime(48,time+.11);
   start(oscillator,envelope(.9,time,.36),time,.4);noiseHit(time,.06,.015,1800);
  }else if(name==='snare'){
   noiseHit(time,.38,.17,1400,'bandpass');
   const body=audio.createOscillator();body.type='triangle';body.frequency.setValueAtTime(180,time);body.frequency.exponentialRampToValueAtTime(110,time+.07);
   start(body,envelope(.18,time,.09),time,.12);
  }else noiseHit(time,.19,.055,7000);
 }
 function flash(name){
  const pad=pads.find(p=>p.dataset.drum===name);if(!pad)return;
  clearTimeout(hitTimers.get(name));pad.classList.add('is-hit');
  hitTimers.set(name,setTimeout(()=>pad.classList.remove('is-hit'),100));
 }
 async function hit(name){
  try{await readyAudio();sound(name,audio.currentTime);flash(name);status.textContent=({kick:'Kick',snare:'Snare',hat:'Hi-hat'})[name]+'. Make it your own.'}
  catch{status.textContent='Audio is unavailable in this browser. You can still build a pattern.'}
 }
 function stop(message='Groove paused. Your pattern stays here.'){
  playing=false;clearInterval(scheduler);scheduler=0;
  for(const id of timers)clearTimeout(id);timers.clear();
  for(const source of sources){try{source.stop()}catch{}}
  steps.forEach(step=>step.classList.remove('is-step'));pads.forEach(pad=>pad.classList.remove('is-hit'));
  toggle.setAttribute('aria-pressed','false');toggle.textContent='Play the groove ▶';status.textContent=message;
 }
 function scheduleBeats(){
  while(playing&&nextTime<audio.currentTime+.1){
   const beat=nextStep,when=nextTime;
   const active=steps.filter(cell=>Number(cell.dataset.step)===beat&&cell.getAttribute('aria-pressed')==='true');
   active.forEach(cell=>sound(cell.dataset.track,when));
   later(()=>{steps.forEach(cell=>cell.classList.toggle('is-step',Number(cell.dataset.step)===beat));active.forEach(cell=>flash(cell.dataset.track))},Math.max(0,(when-audio.currentTime)*1000));
   nextTime+=60/92/2;nextStep=(nextStep+1)%8;
  }
 }
 pads.forEach(pad=>{pad.disabled=false;pad.addEventListener('click',()=>hit(pad.dataset.drum))});
 steps.forEach(cell=>{cell.disabled=false;cell.addEventListener('click',()=>cell.setAttribute('aria-pressed',String(cell.getAttribute('aria-pressed')!=='true')))});
 kit.querySelector('.rhythm-controls').hidden=false;
 kit.querySelector('.rhythm-editor')?.addEventListener('toggle',announceLayout);
 toggle.addEventListener('click',async()=>{
  if(playing){stop();return}if(starting)return;starting=true;
  try{await readyAudio();if(document.hidden||!kitVisible)return;playing=true;nextStep=0;nextTime=audio.currentTime+.04;toggle.setAttribute('aria-pressed','true');toggle.textContent='Pause the groove Ⅱ';status.textContent='Playing your eight-step groove. Change any step as it plays.';scheduleBeats();scheduler=setInterval(scheduleBeats,25)}
  catch{status.textContent='Audio is unavailable in this browser. You can still build a pattern.'}
  finally{starting=false}
 });
 kit.addEventListener('keydown',event=>{const name=({a:'kick',s:'snare',d:'hat'})[event.key.toLowerCase()];if(!name||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;event.preventDefault();hit(name)});
 const kitObserver=new IntersectionObserver(([entry])=>{kitVisible=entry.isIntersecting;if(!kitVisible&&playing){stop('Groove paused while you explore the page.');audio?.suspend()}},{threshold:.05});
 kitObserver.observe(kit);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(playing)stop();audio?.suspend()}});
 addEventListener('pagehide',()=>{if(playing)stop();audio?.suspend()});
}
}

// A magnetic-word canvas. These are visitor compositions, not attributed poems.
function initWords(){const bank=document.querySelector('.word-bank');
if(bank){
 const words=[...bank.querySelectorAll('[data-word]')],line=document.querySelector('.word-line');
 const placeholder=document.querySelector('.word-placeholder'),count=document.querySelector('.word-count');
 const update=()=>{placeholder.hidden=line.children.length>0;count.textContent=line.children.length+' '+(line.children.length===1?'word':'words')};
 words.forEach((button,i)=>{
  button.disabled=false;
  button.addEventListener('click',()=>{
   const word=document.createElement('button');word.type='button';word.textContent=button.dataset.word;word.dataset.origin=String(i);
   word.setAttribute('aria-label','Remove '+button.dataset.word);button.disabled=true;
   word.addEventListener('click',()=>{words[i].disabled=false;word.remove();update()});
   line.append(word);update();
  });
 });
 document.querySelector('.word-controls').hidden=false;
 document.querySelector('[data-word-reset]').addEventListener('click',()=>{line.replaceChildren();words.forEach(button=>button.disabled=false);update()});
}
}

// The playground is a hand of three cards. Turning one over (a 3D flip) puts its toy face up; the toys start the first
// time any card turns. The face-down side is inert, so keyboard and screen readers only meet the side that is up.
const hand=document.querySelector('.hand');
let playStarted=false;
function startPlayground(){if(playStarted)return;playStarted=true;initKnight();initDrums();initWords()}
if(!hand)startPlayground();
else{
 hand.classList.add('hand-ready');
 for(const card of hand.children){
  const front=card.querySelector('.card-front'),back=card.querySelector('.card-back'),close=card.querySelector('.card-close');
  back.inert=true;
  const turn=up=>{
   card.classList.toggle('flipped',up);front.setAttribute('aria-expanded',String(up));back.inert=!up;front.inert=up;
   // The face that is up sets the card's height on phones; it changes over when the card is edge-on.
   clearTimeout(card.swap);card.swap=setTimeout(()=>card.classList.toggle('show-back',up),matchMedia('(prefers-reduced-motion: reduce)').matches?0:450);
   hand.classList.toggle('has-flipped',!!hand.querySelector('.card.flipped'));
   if(up){startPlayground();setTimeout(()=>close.focus({preventScroll:true}),450)}else front.focus({preventScroll:true});
   announceLayout();
  };
  front.addEventListener('click',()=>turn(true));
  close.addEventListener('click',()=>turn(false));
 }
}

// Scroll changes only decoration. All story text stays fully readable.
const scenes=[...document.querySelectorAll('[data-studio]')],active=new Set();
let sceneFrame=0;
function paintScenes(){
 sceneFrame=0;const paused=root.classList.contains('motion-paused');
 for(const scene of active){
  const rect=scene.getBoundingClientRect();
  const progress=paused ? .5 : Math.max(0,Math.min(1,(innerHeight-rect.top)/(rect.height+innerHeight)));
  scene.style.setProperty('--chapter-progress',progress.toFixed(4));
  for(const panel of scene.querySelectorAll('.chapter-depth')){const b=panel.getBoundingClientRect();if(b.bottom>0&&b.top<innerHeight)panel.style.setProperty('--scroll-tilt',(paused?0:Math.max(-3,Math.min(3,(b.top+b.height*.5-innerHeight*.5)/innerHeight*6)))+'deg')} 
 }
}
function scheduleScenes(){if(!sceneFrame&&!document.hidden)sceneFrame=requestAnimationFrame(paintScenes)}
if(scenes.length){
 const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting)active.add(entry.target);else active.delete(entry.target)});scheduleScenes()});
 scenes.forEach(scene=>observer.observe(scene));
 addEventListener('scroll',scheduleScenes,{passive:true});addEventListener('resize',scheduleScenes,{passive:true});
 addEventListener('portfolio-motion',scheduleScenes);addEventListener('portfolio-layout',scheduleScenes);
 addEventListener('pagehide',()=>{cancelAnimationFrame(sceneFrame);sceneFrame=0});
 addEventListener('pageshow',scheduleScenes);
}
