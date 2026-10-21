import { updateSheetGeometry } from './sheets.js';
const root=document.documentElement;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const finePointer=matchMedia('(hover:hover) and (pointer:fine)');
const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
const lerp=(a,b,t)=>a+(b-a)*t;
let userPaused=false;try{userPaused=localStorage.getItem('portfolio-motion')==='paused'}catch{}
let paused=userPaused||reduced.matches;
const motionButton=document.querySelector('[data-motion]');
const opening=document.querySelector('.opening');
const mind=document.querySelector('.mind-chapter');
const reading=[...document.querySelectorAll('.reading-word')];
const work=document.querySelector('.work-scroll');
const track=document.querySelector('.work-track');
const paper=document.querySelector('.resume-paper');
const resume=document.querySelector('.resume-section');
const contact=document.querySelector('.contact');
const letters=[...document.querySelectorAll('.elastic-letter')].map(el=>({el,cx:0,cy:0,x:0,y:0,vx:0,vy:0}));
const masks=[...document.querySelectorAll('.name-mask')];
const textMasks=[...document.querySelectorAll('.text-mask')].map(el=>({el,top:0}));
const barrelCards=[...document.querySelectorAll('.barrel-card')].map(el=>({el,left:0,width:0,top:0,height:0}));
let cursorClientX=-1000,cursorClientY=-1000,pointerInside=false;
let pointerX=0,pointerY=0,smoothX=0,smoothY=0;
let frame=0,lastTime=0,time=0,smoothScroll=scrollY,targetScroll=scrollY,workDistance=0,metrics={};
let forcePaint=true,hidden=document.hidden;
const revealSelectors='.selected-heading h2,.selected-heading>p,.award-stamp,.award-hero h2,.award-feature,.award-list>div,.profile-heading,.profile-intro,.timeline>div,.offscreen>.mono,.interest-grid>div,.club-note,.index-heading,.index-row,.index-after,.resume-copy,.contact-intro,.contact-details,.footer-bottom,.capability-list>div';
const reveals=[...document.querySelectorAll(revealSelectors)].map(el=>{el.classList.add('cinematic-element');return{el,top:0,height:0}});
const tiltElements=[...document.querySelectorAll('[data-depth]')].map(el=>({el,x:0,y:0,tx:0,ty:0,lx:50,ly:50}));
const graphics=[...document.querySelectorAll('.project-visual')];
function box(el){if(!el)return{top:0,height:0};const r=el.getBoundingClientRect();return{top:r.top+scrollY,height:r.height}}
function measure(){
 if(track&&work){workDistance=Math.max(0,track.scrollWidth-innerWidth);work.style.setProperty('--work-height',(innerHeight+workDistance)+'px')}
 metrics={opening:box(opening),mind:box(mind),work:box(work),resume:box(resume),contact:box(contact),max:Math.max(1,document.documentElement.scrollHeight-innerHeight)};
 for(const item of reveals){const r=box(item.el);item.top=r.top-(parseFloat(item.el.style.getPropertyValue('--enter-y'))||0);item.height=r.height}
 for(const item of letters){const r=item.el.getBoundingClientRect();item.cx=r.left+r.width/2-item.x;item.cy=r.top+scrollY+r.height/2-item.y}
 for(const item of textMasks)item.top=box(item.el).top;
 for(const item of barrelCards){item.left=item.el.offsetLeft;item.width=item.el.offsetWidth;const r=box(item.el);item.top=r.top;item.height=r.height}

 forcePaint=true;schedule();
}
function setMotion(){paused=userPaused||reduced.matches;root.classList.add('motion-ready');root.classList.toggle('motion-paused',paused);if(motionButton){motionButton.setAttribute('aria-pressed',String(paused));motionButton.textContent=paused?'Resume motion ▶':'Pause motion Ⅱ';motionButton.disabled=reduced.matches;motionButton.title=reduced.matches?'Reduced motion follows your device preference':''}smoothScroll=scrollY;measure();dispatchEvent(new Event('portfolio-motion'))}
function schedule(){if(!frame&&!hidden)frame=requestAnimationFrame(tick)}
function tick(now){
 frame=0;if(hidden)return;
 const dt=Math.min((now-lastTime)||16.7,40);lastTime=now;
 const ease=1-Math.exp(-dt/105);targetScroll=scrollY;
 smoothScroll=paused?targetScroll:lerp(smoothScroll,targetScroll,ease);
 if(Math.abs(smoothScroll-targetScroll)<.1)smoothScroll=targetScroll;
 smoothX=lerp(smoothX,pointerX,1-Math.exp(-dt/190));smoothY=lerp(smoothY,pointerY,1-Math.exp(-dt/190));

 const heroVisible=opening&&scrollY<metrics.opening.height+100;

 root.style.setProperty('--page-progress',String(clamp(smoothScroll/metrics.max)));
 root.style.setProperty('--ambient-x',(70+Math.sin(smoothScroll*.0003)*22)+'%');root.style.setProperty('--ambient-y',(25+Math.sin(smoothScroll*.0002)*35)+'%');root.style.setProperty('--pointer-x',String(smoothX));root.style.setProperty('--pointer-y',String(smoothY));
 if(!paused){
  if(opening)root.style.setProperty('--opening-progress',String(clamp(smoothScroll/metrics.opening.height)));
  if(mind){const p=clamp((smoothScroll-metrics.mind.top+innerHeight*.2)/Math.max(1,metrics.mind.height-innerHeight*.7));reading.forEach((el,i)=>{const a=clamp(p*(reading.length+3)-i);el.style.opacity=String(.12+a*.88);el.style.filter='blur('+((1-a)*5)+'px)';el.style.transform='translate3d(0,'+((1-a)*9)+'px,0)'})}
  masks.forEach((el,i)=>{const p=clamp(smoothScroll/Math.max(1,metrics.opening.height));el.style.setProperty('--name-shift',((i===0?-1:1)*p*innerWidth*.045)+'px')});
  for(const item of textMasks){const p=clamp((smoothScroll+innerHeight*.9-item.top)/(innerHeight*.45));item.el.style.setProperty('--mask-y',((1-p)*105)+'%');item.el.style.setProperty('--mask-blur',((1-p)*8)+'px')}

  if(work&&track&&innerWidth>900){const p=clamp((smoothScroll-metrics.work.top)/Math.max(1,metrics.work.height-innerHeight));track.style.setProperty('--work-x',(-workDistance*p)+'px');const position=document.querySelector('.work-position');if(position)position.textContent=String(Math.min(5,1+Math.floor(p*5))).padStart(2,'0')+' — 05'}

  for(const item of reveals){const p=clamp((smoothScroll+innerHeight*.93-item.top)/(innerHeight*.38));item.el.style.setProperty('--enter-y',((1-p)*55)+'px');item.el.style.setProperty('--enter-opacity',String(.13+p*.87));if(item.el.parentElement?.classList.contains('award-list'))item.el.style.setProperty('--line-progress',String(p))}
  if(paper){const p=clamp((smoothScroll+innerHeight-metrics.resume.top)/(metrics.resume.height+innerHeight));paper.style.setProperty('--paper-scroll',String(p))}
  if(contact)contact.style.setProperty('--footer-progress',String(clamp((smoothScroll+innerHeight-metrics.contact.top)/(metrics.contact.height+innerHeight))));
 }
 let tiltMoving=false;
 let lettersMoving=false;
 for(const item of letters){const dx=cursorClientX-item.cx,dy=cursorClientY-(item.cy-scrollY);const distance=Math.hypot(dx,dy);const influence=pointerInside&&!paused&&scrollY<20?Math.exp(-distance*distance/(innerWidth*.14)**2):0;const tx=clamp(dx*.1,-15,15)*influence,ty=clamp(dy*.12,-18,18)*influence;const step=Math.min(dt/16.67,2);item.vx=(item.vx+(tx-item.x)*.09*step)*Math.pow(.72,step);item.vy=(item.vy+(ty-item.y)*.09*step)*Math.pow(.72,step);item.x+=item.vx*step;item.y+=item.vy*step;item.el.style.transform=paused?'none':'translate3d('+item.x+'px,'+item.y+'px,0) rotate('+item.x*.17+'deg) scale('+(1+influence*.035)+','+(1+influence*.055)+')';if(Math.abs(item.x-tx)+Math.abs(item.y-ty)+Math.abs(item.vx)+Math.abs(item.vy)>.02)lettersMoving=true}

 for(const item of tiltElements){item.x=lerp(item.x,paused?0:item.tx,ease);item.y=lerp(item.y,paused?0:item.ty,ease);item.el.style.setProperty('--tilt-x',item.x+'deg');item.el.style.setProperty('--tilt-y',item.y+'deg');if(!paused&&(Math.abs(item.x-item.tx)+Math.abs(item.y-item.ty)>.02))tiltMoving=true}

 updateSheetGeometry();
 forcePaint=false;
 if(smoothScroll!==targetScroll||tiltMoving||lettersMoving||Math.abs(smoothX-pointerX)>.001||Math.abs(smoothY-pointerY)>.001)schedule();
}
opening?.addEventListener('pointermove',event=>{if(!finePointer.matches||paused)return;pointerInside=true;cursorClientX=event.clientX;cursorClientY=event.clientY;const r=opening.getBoundingClientRect();pointerX=clamp((event.clientX-r.left)/r.width*2-1,-1,1);pointerY=clamp((event.clientY-r.top)/r.height*2-1,-1,1);schedule()},{passive:true});
opening?.addEventListener('pointerleave',()=>{pointerInside=false;pointerX=0;pointerY=0;schedule()});
for(const item of tiltElements){item.el.addEventListener('pointermove',event=>{if(paused||!finePointer.matches)return;const r=item.el.getBoundingClientRect();const x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;item.tx=-y*5;item.ty=x*6;item.el.style.setProperty('--light-x',(x*100+50)+'%');item.el.style.setProperty('--light-y',(y*100+50)+'%');schedule()},{passive:true});item.el.addEventListener('pointerleave',()=>{item.tx=0;item.ty=0;schedule()})}
const graphicObserver='IntersectionObserver' in window?new IntersectionObserver(entries=>entries.forEach(entry=>{entry.target.dataset.visible=String(entry.isIntersecting);entry.target.style.setProperty('--art-progress',entry.isIntersecting?'1':'.2')}),{threshold:.2}):null;graphics.forEach(el=>graphicObserver?.observe(el));
motionButton?.addEventListener('click',()=>{userPaused=!userPaused;try{localStorage.setItem('portfolio-motion',userPaused?'paused':'playing')}catch{}setMotion()});
reduced.addEventListener('change',setMotion);
addEventListener('scroll',schedule,{passive:true});let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(measure,100)},{passive:true});
addEventListener('pageshow',()=>{hidden=false;graphics.forEach(el=>graphicObserver?.observe(el));measure()});document.fonts?.ready.then(measure);addEventListener('load',measure);document.querySelector('.last-word')?.addEventListener('animationend',measure,{once:true});
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(hidden){cancelAnimationFrame(frame);frame=0}else{lastTime=performance.now();measure()}});
track?.addEventListener('focusin',event=>{if(paused||innerWidth<=900)return;const card=event.target.closest('.work-card');if(!card)return;const i=[...track.children].indexOf(card);const target=metrics.work.top+Math.min(workDistance,i*(card.offsetWidth+innerWidth*.05));smoothScroll=target;window.scrollTo({top:target,behavior:'instant'});schedule()});
let audioContext;const pad=document.querySelector('.drum-pad');
pad?.addEventListener('click',async()=>{pad.classList.remove('hit');requestAnimationFrame(()=>pad.classList.add('hit'));setTimeout(()=>pad.classList.remove('hit'),140);const status=document.querySelector('.rhythm-status');try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){if(status)status.textContent='Audio is not supported in this browser.';return}audioContext??=new Audio();await audioContext.resume();const t=audioContext.currentTime;for(const offset of [0,.25,.5,.625]){const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.frequency.setValueAtTime(130,t+offset);osc.frequency.exponentialRampToValueAtTime(45,t+offset+.15);gain.gain.setValueAtTime(.22,t+offset);gain.gain.exponentialRampToValueAtTime(.001,t+offset+.22);osc.connect(gain).connect(audioContext.destination);osc.start(t+offset);osc.stop(t+offset+.23)}if(status)status.textContent='Playing a short drum beat.'}catch{if(status)status.textContent='Audio is unavailable in this browser.'}});
addEventListener('pagehide',()=>{hidden=true;cancelAnimationFrame(frame);frame=0;audioContext?.suspend();graphicObserver?.disconnect()});
setMotion();

const themeButton=document.querySelector('.theme-switch');
function syncTheme(){const light=root.dataset.theme==='light';if(themeButton){themeButton.setAttribute('aria-pressed',String(light));themeButton.setAttribute('aria-label',light?'Switch to dark theme':'Switch to light theme');themeButton.querySelector('[data-theme-label]').textContent=light?'Dark':'Light'}document.querySelector('meta[name="theme-color"]')?.setAttribute('content',light?'#fdfbff':'#000000')}
themeButton?.addEventListener('click',()=>{const light=root.dataset.theme!=='light';if(light)root.dataset.theme='light';else delete root.dataset.theme;try{localStorage.setItem('portfolio-theme',light?'light':'dark')}catch{}syncTheme()});syncTheme();
let introTimer;
function finishIntro(){clearTimeout(introTimer);root.classList.remove('intro-pending');}
function playIntro(){if(reduced.matches){finishIntro();return}if(!document.querySelector('.signature-intro')){location.href='/';return}root.classList.remove('intro-pending');void root.offsetWidth;root.classList.add('intro-pending');introTimer=setTimeout(finishIntro,3550)}
if(root.classList.contains('intro-pending'))introTimer=setTimeout(finishIntro,3550);
document.querySelector('.skip-intro')?.addEventListener('click',finishIntro);document.querySelector('.replay-intro')?.addEventListener('click',playIntro);
addEventListener('keydown',event=>{if(event.key==='Escape'||event.key==='Tab')finishIntro()});
reduced.addEventListener('change',()=>{if(reduced.matches)finishIntro()});
