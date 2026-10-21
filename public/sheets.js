// One shared cylindrical surface. Scroll owns geometry; hover owns the ink.
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const pointer=matchMedia('(hover:hover) and (pointer:fine)');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sheets=[];let raf=0,last=0;
for(const link of document.querySelectorAll('.work-image')){
 const source=link.querySelector('.project-visual');if(!source)continue;
 const card=link.closest('.work-card'),template=source.outerHTML;
 source.classList.add('sheet-source');source.setAttribute('aria-hidden','true');link.classList.add('flexible-sheet');
 const surface=document.createElement('div');surface.className='sheet-surface';surface.setAttribute('aria-hidden','true');
 const count=innerWidth>900?12:1,slices=[];
 for(let i=0;i<count;i++){const slice=document.createElement('div');slice.className='sheet-slice';slice.innerHTML='<div class="sheet-art sheet-neutral">'+template+'</div><div class="sheet-art sheet-color">'+template+'</div><div class="sheet-shade"></div>';surface.append(slice);slices.push(slice)}
 link.insertBefore(surface,link.querySelector('.case-badge'));
 const s={link,card,slices,w:0,h:0,progress:0,target:0,hover:false,focus:false,x:0,y:0,px:0,py:0,sx:0,sy:0,flex:0};sheets.push(s);
 function activate(on,event){if(on&&!s.target){const r=link.getBoundingClientRect();s.x=event?clamp(event.clientX-r.left,0,s.w):s.w*.5;s.y=event?clamp(event.clientY-r.top,0,s.h):s.h*.5} s.target=on?1:0;card.classList.toggle('is-inked',on);schedule()}
 card.addEventListener('pointerenter',event=>{if(pointer.matches){s.hover=true;activate(true,event)}});
 card.addEventListener('pointermove',event=>{if(!pointer.matches)return;const r=link.getBoundingClientRect();s.px=clamp((event.clientX-r.left)/s.w*2-1,-1,1);s.py=clamp((event.clientY-r.top)/s.h*2-1,-1,1);if(!s.hover){s.hover=true;activate(true,event)}schedule()},{passive:true});
 card.addEventListener('pointerleave',()=>{s.hover=false;s.px=0;s.py=0;activate(s.focus)});
 card.addEventListener('focusin',()=>{s.focus=true;activate(true)});
 card.addEventListener('focusout',event=>{if(!card.contains(event.relatedTarget)){s.focus=false;activate(s.hover)}});
}
function measure(){for(const s of sheets){s.w=s.link.offsetWidth;s.h=s.link.offsetHeight;const unit=s.w/s.slices.length;s.slices.forEach((slice,i)=>{slice.style.left=i*unit+'px';slice.style.width=unit+1.8+'px';for(const art of slice.querySelectorAll('.sheet-art')){art.style.width=s.w+'px';art.style.left=-i*unit+'px'}});s.x=s.w*.5;s.y=s.h*.5}updateSheetGeometry();schedule()}
export function updateSheetGeometry(){
 const flat=reduced.matches||document.documentElement.classList.contains('motion-paused')||innerWidth<=900;
 const radius=innerWidth*1.35;
 const boxes=sheets.map(s=>s.link.getBoundingClientRect());
 for(const [index,s] of sheets.entries()){const r=boxes[index];if(r.bottom<0||r.top>innerHeight||r.right< -200||r.left>innerWidth+200)continue;
 s.slices.forEach((slice,i)=>{const u=(i+.5)/s.slices.length;const px=r.left+u*s.w-innerWidth*.5;const theta=flat?0:clamp(px/radius,-.8,.8);const dx=flat?0:radius*Math.sin(theta)-px;const delta=u-(s.sx*.32+.5);const bell=Math.exp(-delta*delta/ .14);const lift=flat?0:bell*s.flex*25;const slope=flat?0:-2*delta/.14*bell*s.flex*25/s.w;const z=radius*(1-Math.cos(theta))+lift;const ry=-theta*180/Math.PI-Math.atan(slope)*180/Math.PI;const rx=flat?0:-s.sy*s.flex*2;slice.style.transform='translate3d('+dx.toFixed(2)+'px,0,'+z.toFixed(2)+'px) rotateY('+ry.toFixed(2)+'deg) rotateX('+rx.toFixed(2)+'deg)'});
 if(!pointer.matches){const on=r.top<innerHeight*.7&&r.bottom>innerHeight*.3;const target=on?1:0;if(s.target!==target){s.target=target;s.card.classList.toggle('is-inked',on);schedule()}}
 }
}
function inkPath(s){
 if(s.progress>.995)return 'inset(0)';if(s.progress<.001)return 'inset(50%)';
 // Uneven capillary front: broad lobes, small feathered edges, satellite droplets.
 const reach=Math.hypot(Math.max(s.x,s.w-s.x),Math.max(s.y,s.h-s.y))*1.45;
 const radius=s.progress*reach;let path='';
 for(let i=0;i<=96;i++){const a=i/96*Math.PI*2;const noise=1+.12*Math.sin(a*3+1.4)+.085*Math.cos(a*7-.8)+.045*Math.sin(a*13+2)+.022*Math.cos(a*23);const rr=radius*noise;path+=(i?' L':'M')+(s.x+Math.cos(a)*rr).toFixed(1)+' '+(s.y+Math.sin(a)*rr*.91).toFixed(1)}path+=' Z';
 for(let i=0;i<7;i++){const a=i*2.399+1,rr=radius*(1.13+.06*Math.sin(i*4));const size=Math.max(0,Math.min(9,radius*.035))*(.5+.5*Math.sin(i+2)**2);const x=s.x+Math.cos(a)*rr,y=s.y+Math.sin(a)*rr*.91;path+=' M'+(x-size).toFixed(1)+' '+y.toFixed(1)+' a'+size.toFixed(1)+' '+(size*.7).toFixed(1)+' 0 1 0 '+(size*2).toFixed(1)+' 0 a'+size.toFixed(1)+' '+(size*.7).toFixed(1)+' 0 1 0 '+(-size*2).toFixed(1)+' 0 Z'}
 return 'path("'+path+'")';
}
function schedule(){if(!raf&&!document.hidden)raf=requestAnimationFrame(draw)}
function draw(now){raf=0;const dt=Math.min(now-last||16,40);last=now;let moving=false;
 for(const s of sheets){const ease=1-Math.exp(-dt/115);const flexTarget=s.hover&&!reduced.matches?1:0;s.sx+=(s.px-s.sx)*ease;s.sy+=(s.py-s.sy)*ease;s.flex+=(flexTarget-s.flex)*ease;if(Math.abs(s.px-s.sx)+Math.abs(s.py-s.sy)+Math.abs(s.flex-flexTarget)>.001)moving=true;if(Math.abs(s.progress-s.target)<.001){s.progress=s.target}else{const paused=reduced.matches||document.documentElement.classList.contains('motion-paused');s.progress=paused?s.target:s.progress+(s.target-s.progress)*(1-Math.exp(-dt/(s.target?155:105)));moving=true}const clip=inkPath(s);if(clip!==s.clip){s.clip=clip;s.link.style.setProperty('--ink-clip',clip)}}
 updateSheetGeometry();
 if(moving)schedule();
}
const observer=new ResizeObserver(measure);for(const s of sheets)observer.observe(s.link);
addEventListener('resize',measure,{passive:true});addEventListener('pageshow',measure);document.fonts.ready.then(measure);reduced.addEventListener('change',measure);addEventListener('portfolio-motion',measure);document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else measure()});measure();
