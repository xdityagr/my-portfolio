
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const clock = document.querySelector('[data-clock]');
function updateClock() {
 if(clock) { clock.textContent = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())+' IST'; clock.dateTime=new Date().toISOString(); }
}
updateClock();
let clockInterval=setInterval(updateClock,60000);
document.addEventListener('visibilitychange',()=>{clearInterval(clockInterval);if(!document.hidden){updateClock();clockInterval=setInterval(updateClock,60000)}});
const filters = document.querySelector('.index-filters');
if(filters) {
 filters.hidden=false;
 filters.addEventListener('click',event=>{
  const button=event.target.closest('[data-filter]');
  if(!button)return;
  filters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  let count=0;
  document.querySelectorAll('.index-row').forEach(row=>{
   row.hidden=button.dataset.filter!=='All'&&row.dataset.category!==button.dataset.filter;
   if(!row.hidden)count++;
  });
  document.querySelector('.index-count').textContent=String(count).padStart(2,'0')+' PROJECTS';
 });
}
const copy = document.querySelector('[data-copy]');
if(copy && navigator.clipboard && window.isSecureContext) {
 copy.hidden=false;
 let copyTimeout;
 const copyMarkup=copy.innerHTML;
 copy.addEventListener('click',async()=>{
  try {
   await navigator.clipboard.writeText(copy.dataset.copy);
   copy.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';copy.setAttribute('aria-label','Email copied');copy.title='Email copied';
   document.querySelector('.copy-status').textContent='Email address copied to clipboard.';
   clearTimeout(copyTimeout);
   copyTimeout=setTimeout(()=>{copy.innerHTML=copyMarkup;copy.setAttribute('aria-label','Copy email address');copy.title='Copy email address'},2500);
  } catch {
   document.querySelector('.copy-status').textContent='Copy unavailable. Use the email link to get in touch.';
   copy.setAttribute('aria-label','Copy unavailable; use the email link');copy.title='Use the email link';
  }
 });
}
let observer;
function setupReveals() {
 observer?.disconnect();
 const elements=document.querySelectorAll('.reveal');
 if(motion.matches || !('IntersectionObserver' in window)) {
  elements.forEach(el=>el.classList.remove('is-observed'));return;
 }
 observer=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}});
 },{threshold:.06,rootMargin:'0px 0px -24px 0px'});
 elements.forEach(el=>{
  if(el.getBoundingClientRect().top>innerHeight){el.classList.add('is-observed');observer.observe(el)}
 });
}
setupReveals();
motion.addEventListener('change',setupReveals);
window.addEventListener('pagehide',()=>{observer?.disconnect();clearInterval(clockInterval)});
window.addEventListener('pageshow',event=>{if(event.persisted){setupReveals();updateClock();clearInterval(clockInterval);clockInterval=setInterval(updateClock,60000)}});
