import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
// Headless Chromium only offers WebGL through SwiftShader when asked to.
const launch={headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist']};
if(process.env.PLAYWRIGHT_EXECUTABLE_PATH)launch.executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const browser=await chromium.launch(launch);
const failures=[];let checks=0;
const settle=page=>page.waitForFunction(()=>!document.documentElement.classList.contains('intro-pending'));
const inkReady=page=>page.waitForFunction(()=>window.portfolioInk?.state().ready===true,null,{timeout:15000});
try{
 // inkCore
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();
 page.on('pageerror',e=>failures.push('home: '+e.message));
 await page.goto(base);await settle(page);await inkReady(page);
 assert.ok(await page.evaluate(()=>document.documentElement.classList.contains('ink-ready')),'html.ink-ready');
 assert.ok(await page.evaluate(()=>window.portfolioInk.state().items.length)>=11,'at least 11 ink items');checks+=2;

 await page.setViewportSize({width:900,height:900});await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>window.portfolioInk.state().items[0].visible),true,'hero item stays visible after resize');checks++;
 await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(300);

 await page.waitForTimeout(500);
 // Park in the widest stretch of page with no ink anywhere near the viewport.
 await page.evaluate(()=>{const tops=[...document.querySelectorAll('[data-ink]')].map(el=>el.getBoundingClientRect().top+scrollY).sort((a,b)=>a-b);let best=0,at=0;for(let i=1;i<tops.length;i++)if(tops[i]-tops[i-1]>best){best=tops[i]-tops[i-1];at=(tops[i]+tops[i-1])/2}scrollTo({top:at-innerHeight/2,behavior:'instant'})});
 const asleep=await page.waitForFunction(()=>window.portfolioInk.state().items.every(item=>!item.visible),null,{timeout:4000}).then(()=>true,()=>false);
 await page.waitForTimeout(300);
 if(asleep){
  const before=await page.evaluate(()=>window.portfolioInk.state().frames);
  await page.waitForTimeout(1000);
  const after=await page.evaluate(()=>window.portfolioInk.state().frames);
  assert.ok(after-before<=2,'ink loop sleeps when nothing is visible ('+(after-before)+' frames)');checks++;
 }else failures.push('could not find a scroll position with no visible ink items: '+await page.evaluate(()=>{const els=[...document.querySelectorAll('[data-ink]')];return scrollY+' '+window.portfolioInk.state().items.flatMap((it,i)=>it.visible?[(els[i].dataset.inkGroup||els[i].textContent)+'@'+Math.round(els[i].getBoundingClientRect().top)]:[]).join(',')}));

 const caseStudy=await context.newPage();
 caseStudy.on('pageerror',e=>failures.push('case: '+e.message));
 await caseStudy.goto(base+'/work/pineyard/');await caseStudy.waitForTimeout(800);
 await inkReady(caseStudy);
 assert.deepEqual(await caseStudy.evaluate(()=>[...new Set(window.portfolioInk.state().items.map(it=>it.text))]),['talk.'],'case study inks only the footer talk; its title is plain');
 assert.ok(await caseStudy.evaluate(()=>document.querySelector('.case-opening h1 canvas.ink-mirror')===null&&document.querySelector('main.case-study>canvas.case-ink')!==null),'the title is plain and the page behind it is inked');checks+=2;
 await context.close();

 // fallback: no WebGL2 at all
 const nogl=await browser.newContext({viewport:{width:1440,height:900}});
 await nogl.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return type==='webgl2'?null:original.call(this,type,...rest)}});
 const np=await nogl.newPage();
 np.on('pageerror',e=>failures.push('nogl: '+e.message));
 await np.goto(base);await settle(np);await np.waitForTimeout(1200);
 assert.equal(await np.evaluate(()=>document.documentElement.classList.contains('ink-ready')),false,'no ink-ready without WebGL2');
 assert.notEqual(await np.evaluate(()=>getComputedStyle(document.querySelector('[data-ink]')).webkitTextFillColor),'rgba(0, 0, 0, 0)','ink text stays visible without WebGL2');checks+=2;
 await nogl.close();
 console.log('PASS: inkCore');

 // hero: centring, light-theme name colour, kept letter flex, phone brush
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const ctx=await browser.newContext({viewport});const hp=await ctx.newPage();
  await hp.goto(base);await settle(hp);
  const gaps=await hp.evaluate(()=>{const top=document.querySelector('.hero-top').getBoundingClientRect().bottom,foot=document.querySelector('.hero-foot').getBoundingClientRect().top;const name=document.querySelector('.elastic-name').getBoundingClientRect();return [name.top-top,foot-name.bottom]});
  assert.ok(Math.abs(gaps[0]-gaps[1])<Math.max(...gaps)*.15,'hero name is vertically centred at '+viewport.width+' ('+gaps.map(Math.round)+')');checks++;
  await ctx.close();
 }
 const lightNoGl=await browser.newContext({viewport:{width:1440,height:900}});
 await lightNoGl.addInitScript(()=>{localStorage.setItem('portfolio-theme','light');const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return type==='webgl2'?null:original.call(this,type,...rest)}});
 const lp=await lightNoGl.newPage();await lp.goto(base);await settle(lp);
 assert.equal(await lp.evaluate(()=>getComputedStyle(document.querySelector('.first-word .elastic-letter')).color),'rgb(21, 18, 27)','light theme "Aditya" is near-black');checks++;
 await lightNoGl.close();
 const flex=await browser.newContext({viewport:{width:1440,height:900}});const fp=await flex.newPage();
 await fp.goto(base);await settle(fp);await inkReady(fp);
 const target=await fp.evaluate(()=>{const el=document.querySelectorAll('.last-word .elastic-letter')[1].getBoundingClientRect();return [el.left+el.width/2,el.top+el.height/2]});
 await fp.mouse.move(target[0]-60,target[1]);await fp.mouse.move(target[0],target[1],{steps:6});await fp.waitForTimeout(400);
 assert.notEqual(await fp.evaluate(()=>document.querySelectorAll('.last-word .elastic-letter')[1].style.transform||'none'),'none','letters still flex under the cursor');checks++;
 await flex.close();
 const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await phone.addInitScript(()=>{window.DeviceOrientationEvent=window.DeviceOrientationEvent||function(){};window.DeviceOrientationEvent.requestPermission=()=>Promise.reject(new Error('denied'))});
 const pp=await phone.newPage();pp.on('pageerror',e=>failures.push('phone: '+e.message));
 await pp.goto(base);await settle(pp);await inkReady(pp);
 await pp.tap('.elastic-name');await pp.waitForTimeout(2400);
 assert.equal(await pp.evaluate(()=>window.portfolioInk.state().brushOn),true,'auto-brush runs on phones without orientation permission');checks++;
 await phone.close();
 const calm=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});const cp=await calm.newPage();
 cp.on('pageerror',e=>failures.push('reduced: '+e.message));
 await cp.goto(base);await settle(cp);await inkReady(cp);await cp.waitForTimeout(400);
 const still0=await cp.evaluate(()=>window.portfolioInk.state().frames);await cp.waitForTimeout(1000);
 assert.ok(await cp.evaluate(()=>window.portfolioInk.state().frames)-still0<=2,'reduced motion draws static ink');
 assert.equal(await cp.evaluate(()=>window.portfolioInk.state().brushOn),false,'no auto-brush under reduced motion');checks+=2;
 await calm.close();
 console.log('PASS: ink hero');

 // Mind terms fill with ink as the reading reaches them; the old bar behind "what if" is gone
 const mctx=await browser.newContext({viewport:{width:1440,height:900}});const mp=await mctx.newPage();
 mp.on('pageerror',e=>failures.push('mind: '+e.message));
 await mp.goto(base);await settle(mp);await inkReady(mp);
 const terms=()=>mp.evaluate(()=>window.portfolioInk.state().items.filter((item,i)=>document.querySelectorAll('[data-ink]')[i].dataset.ink==='term').map(item=>item.progress));
 assert.ok((await terms()).every(p=>p<.05),'Mind terms start empty');
 await mp.evaluate(()=>{const mind=document.querySelector('#mind');scrollTo({top:mind.getBoundingClientRect().bottom+scrollY-innerHeight,behavior:'instant'})});
 await mp.waitForTimeout(900);
 const filled=await terms();
 assert.ok(filled.length>=3&&filled.every(p=>p>.95),'Mind terms are full by the end of the section ('+filled.map(p=>p.toFixed(2))+')');
 assert.ok(await mp.evaluate(()=>{const q=document.querySelector('.term-question');return !q||getComputedStyle(q,'::before').content==='none'}),'no bar behind "what if"');checks+=3;
 await mctx.close();
 console.log('PASS: mind ink');

 // heading accents flood in as they reach the upper viewport, and stay clipped to their line masks
 const actx=await browser.newContext({viewport:{width:1440,height:900}});const ap=await actx.newPage();
 ap.on('pageerror',e=>failures.push('accents: '+e.message));
 await ap.goto(base);await settle(ap);await inkReady(ap);
 const groupProgress=name=>ap.evaluate(name=>{const els=[...document.querySelectorAll('[data-ink]')],state=window.portfolioInk.state().items;return els.flatMap((el,i)=>el.dataset.inkGroup===name?[state[i].progress]:[])},name);
 for(const name of ['work','director','highlights','code','how','toolkit','rabbit','look','talk']){
  await ap.evaluate(name=>{const el=document.querySelector('[data-ink-group="'+name+'"]');scrollTo({top:el.getBoundingClientRect().top+scrollY-innerHeight*1.02,behavior:'instant'})},name);
  await ap.waitForTimeout(500);
  assert.ok((await groupProgress(name)).every(p=>p<.05),name+' is empty just below the fold');
  await ap.evaluate(name=>{const el=document.querySelector('[data-ink-group="'+name+'"]');scrollTo({top:el.getBoundingClientRect().top+scrollY-innerHeight*.3,behavior:'instant'})},name);
  await ap.waitForTimeout(700);
  const values=await groupProgress(name);
  assert.ok(values.length&&values.every(p=>p>.95),name+' is full at 30% from the top ('+values.map(p=>p.toFixed(2))+')');checks+=2;
 }
 // ink lives in mirror canvases inside each word's own container, so masks clip it natively
 assert.ok(await ap.evaluate(()=>[...document.querySelectorAll('.chapter-mask [data-ink]')].every(el=>{const mask=el.closest('.chapter-mask');return [...mask.querySelectorAll('canvas.ink-mirror')].length>0})),'masked ink is drawn inside its mask');
 assert.equal(await ap.evaluate(()=>[...document.querySelectorAll('canvas.ink-mirror')].filter(c=>getComputedStyle(c).position!=='absolute').length),0,'mirrors are positioned in their hosts');checks+=2;
 await actx.close();
 console.log('PASS: heading accents');

 if(failures.length)throw new Error(failures.join('\n'));
 console.log('PASS: '+checks+' ink browser checks');
}finally{await browser.close()}
