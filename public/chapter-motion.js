// Scroll-bound masks share one demand-driven frame loop.
const root=document.documentElement,reduce=matchMedia('(prefers-reduced-motion:reduce)');
const clamp=n=>Math.max(0,Math.min(1,n));
const masked=[...document.querySelectorAll('.person-heading h2,.person-lead,.playground-head h3,.recognition-wall-head h3,.toolkit-heading h2,.play-card h4')];
for(const heading of masked){
 const lines=heading.innerHTML.split(/<br\s*\/?>/i);heading.replaceChildren();
 lines.forEach((html,i)=>{const mask=document.createElement('span'),inner=document.createElement('span');mask.className='chapter-mask';inner.className='chapter-mask-inner';inner.style.setProperty('--line-order',String(i));inner.innerHTML=html;mask.append(inner);heading.append(mask)});
 heading.dataset.chapterReveal='mask';
}
document.querySelectorAll('.person-letter>p:not(.person-lead):not(.person-age-note),.play-card>p:not(.play-hint),.person-facts').forEach(el=>{el.dataset.chapterReveal='copy'});
const items=[...document.querySelectorAll('[data-chapter-reveal]')].map(el=>({el,value:1,target:1})),lookup=new Map(items.map(item=>[item.el,item])),active=new Set();
let frame=0,dirty=true,last=0;
const paused=()=>reduce.matches||root.classList.contains('motion-paused');
function schedule(){dirty=true;if(!frame&&!document.hidden)frame=requestAnimationFrame(tick)}
function tick(now){
 frame=0;let moving=false;const gap=now-last,ease=1-Math.exp(-(last&&gap<250?gap:16.7)/105);last=now;
 for(const item of active){
  if(dirty){const rect=item.el.getBoundingClientRect();item.target=paused()?1:clamp((innerHeight*.95-rect.top)/(innerHeight*.37))}
  item.value=paused()?1:item.value+(item.target-item.value)*ease;
  if(Math.abs(item.value-item.target)<.001)item.value=item.target;else moving=true;
  item.el.style.setProperty('--chapter-reveal',item.value.toFixed(4));
 }
 dirty=false;if(moving)frame=requestAnimationFrame(tick);
}
if(items.length){
 for(const item of items){const rect=item.el.getBoundingClientRect();item.value=item.target=paused()?1:clamp((innerHeight*.95-rect.top)/(innerHeight*.37));item.el.style.setProperty('--chapter-reveal',String(item.value))}
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){const item=lookup.get(entry.target);if(entry.isIntersecting)active.add(item);else active.delete(item)}schedule()},{rootMargin:'200px'});
 items.forEach(item=>observer.observe(item.el));
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});addEventListener('portfolio-layout',schedule);addEventListener('portfolio-motion',()=>{if(paused())items.forEach(item=>{item.value=item.target=1;item.el.style.setProperty('--chapter-reveal','1')});schedule()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0}else schedule()});
 addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0});addEventListener('pageshow',schedule);
}

