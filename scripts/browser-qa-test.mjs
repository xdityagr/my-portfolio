import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const launch={headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist']};
if(process.env.PLAYWRIGHT_EXECUTABLE_PATH)launch.executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const pages=['/','/work/pineyard/','/resume/','/404.html'];
const sizes=[[390,844],[768,1024],[1440,900]];
const browser=await chromium.launch(launch);
const failures=[];let checks=0;
// Elements that stick out past the right edge without an ancestor that clips them.
const overflowing=()=>{
 const out=[];
 for(const el of document.body.querySelectorAll('*')){
  const r=el.getBoundingClientRect();if(r.width===0||r.right<=innerWidth+1)continue;
  let clipped=false;for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){const o=getComputedStyle(p);if(/(hidden|clip|auto|scroll)/.test(o.overflowX)){clipped=true;break}}
  if(!clipped)out.push((el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).join('.'):el.tagName.toLowerCase())+' right='+Math.round(r.right));
 }
 return out.slice(0,5);
};
try{
 for(const theme of ['dark','light'])for(const [width,height] of sizes){
  const context=await browser.newContext({viewport:{width,height},colorScheme:theme,hasTouch:width<700,isMobile:width<700});
  await context.addInitScript(t=>{try{localStorage.setItem('portfolio-theme',t)}catch{}},theme);
  for(const route of pages){
   const page=await context.newPage();const tag=theme+' '+width+' '+route+': ';
   page.on('pageerror',e=>failures.push(tag+'page error '+e.message));
   page.on('response',r=>{if(r.status()>=400&&!(route==='/404.html'&&r.url().endsWith('/404.html')))failures.push(tag+r.status()+' '+r.url())});
   await page.goto(base+route);
   await page.waitForFunction(()=>!document.documentElement.classList.contains('intro-pending'),null,{timeout:15000}).catch(()=>{});
   // Walk down the page so every section lays out and runs its entrance.
   const total=await page.evaluate(()=>document.documentElement.scrollHeight);
   for(let y=0;y<total;y+=Math.round(height*.8)){await page.evaluate(top=>scrollTo({top,behavior:'instant'}),y);await page.waitForTimeout(120)}
   await page.waitForTimeout(400);
   const wide=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   if(wide>1)failures.push(tag+'page scrolls sideways by '+wide+'px: '+(await page.evaluate(overflowing)).join(', '));
   const sticking=await page.evaluate(overflowing);
   if(sticking.length)failures.push(tag+'content past the right edge: '+sticking.join(', '));
   checks+=2;
   await page.close();
  }
  await context.close();
 }
}catch(error){failures.push(error.message)}
await browser.close();
if(failures.length){console.error('FAIL:\n'+failures.join('\n'));process.exit(1)}
console.log('PASS: '+checks+' responsive QA checks (4 pages × 3 widths × 2 themes: no errors, no failed requests, nothing past the edge)');
