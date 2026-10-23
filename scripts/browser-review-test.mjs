// Regression tests for the final review's findings: phone ink sleep, light-theme ink contrast, iOS tilt
// permission, loop errors, URL-bar resizes, toolkit keyboard focus, count-up announcements, small-text
// contrast, focus rings inside the clippings and the first ink frame.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const launch={headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist']};
if(process.env.PLAYWRIGHT_EXECUTABLE_PATH)launch.executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const browser=await chromium.launch(launch);
const failures=[];let checks=0;
const check=(ok,message)=>{checks++;if(!ok)failures.push(message)};
const settle=page=>page.waitForFunction(()=>!document.documentElement.classList.contains('intro-pending'),null,{timeout:15000});
const inkReady=page=>page.waitForFunction(()=>window.portfolioInk?.state().ready===true,null,{timeout:15000});
const into=(page,selector,at=.3)=>page.evaluate(([s,a])=>{const el=document.querySelector(s);scrollTo({top:el.getBoundingClientRect().top+scrollY-innerHeight*a,behavior:'instant'})},[selector,at]);
const light=t=>{try{localStorage.setItem('portfolio-theme',t)}catch{}};
// Share of opaque ink pixels in a mirror canvas whose contrast against white is below 3:1.
const paleShare=selector=>page=>page.evaluate(s=>{
 const lin=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
 let pale=0,all=0;
 for(const canvas of document.querySelectorAll(s)){
  const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  for(let i=0;i<data.length;i+=4){if(data[i+3]<230)continue;all++;const L=.2126*lin(data[i])+.7152*lin(data[i+1])+.0722*lin(data[i+2]);if(1.05/(L+.05)<3)pale++}
 }
 return all?pale/all:1;
},selector);
const ratio=(rgb)=>{const lin=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};const [r,g,b]=rgb.match(/\d+/g).map(Number);return 1.05/(.2126*lin(r)+.7152*lin(g)+.0722*lin(b)+.05)};
try{
 // C1: on a phone, orientation jitter away from the hero must not keep the ink loop drawing.
 {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();page.on('pageerror',e=>failures.push('C1: '+e.message));
  await page.goto(base);await settle(page);await inkReady(page);
  // Park where no live ink is on screen (the clippings' results are plain italics), so only tilt could wake the ink.
  await into(page,'.board .clip:nth-child(8)',.5);await page.waitForTimeout(1500);
  check(await page.evaluate(()=>window.portfolioInk.state().items.every(it=>!it.visible)),'C1: no live ink is in view');
  const before=await page.evaluate(()=>window.portfolioInk.state().frames);
  await page.evaluate(()=>new Promise(done=>{let n=0;const t=setInterval(()=>{dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:35+Math.random()*.6,gamma:Math.random()*.6}));if(++n>60){clearInterval(t);done()}},16)}));
  const drawn=await page.evaluate(()=>window.portfolioInk.state().frames)-before;
  check(drawn<=3,'C1: orientation jitter away from the hero drew '+drawn+' frames');
  await context.close();
 }
 // C2: light-theme ink keeps 3:1 against white on home accents and on hue-shifted case titles.
 for(const [route,selector,label] of [['/','.selected-heading canvas.ink-mirror','home "work."'],['/work/safeher/','.case-opening h1 canvas.ink-mirror','SafeHER title'],['/work/snippify/','.case-opening h1 canvas.ink-mirror','Snippify title']]){
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'light'});await context.addInitScript(light,'light');
  const page=await context.newPage();page.on('pageerror',e=>failures.push('C2: '+e.message));
  await page.goto(base+route);await settle(page);await inkReady(page);
  if(route==='/'){await into(page,'.selected-heading');}
  await page.waitForTimeout(1500);
  const share=await paleShare(selector)(page);
  check(share<.12,'C2: '+label+' has '+Math.round(share*100)+'% of ink pixels under 3:1 on white');
  await context.close();
 }
 // I1: the iOS motion permission is requested inside a real user activation (a tap's end), not pointerdown.
 {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await context.addInitScript(()=>{window.__perm=[];window.DeviceOrientationEvent.requestPermission=()=>{window.__perm.push(navigator.userActivation.isActive);return Promise.resolve('granted')}});
  const page=await context.newPage();
  await page.goto(base);await settle(page);await inkReady(page);
  await page.tap('.elastic-name');await page.waitForTimeout(300);
  const calls=await page.evaluate(()=>window.__perm);
  check(calls.length===1&&calls[0]===true,'I1: permission requests '+JSON.stringify(calls)+' (want one, with activation)');
  await context.close();
 }
 // I2: an error inside the ink loop falls back to plain text instead of leaving words transparent.
 {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await settle(page);await inkReady(page);
  await page.evaluate(()=>{CanvasRenderingContext2D.prototype.drawImage=()=>{throw new Error('canvas lost')}});
  await into(page,'.selected-heading');await page.waitForTimeout(800);
  check(await page.evaluate(()=>!document.documentElement.classList.contains('ink-ready')),'I2: ink-ready is dropped after a loop error');
  check(await page.evaluate(()=>getComputedStyle(document.querySelector('.selected-heading [data-ink]')).webkitTextFillColor!=='rgba(0, 0, 0, 0)'),'I2: ink words are readable text again');
  check(errors.length===0,'I2: the loop error is contained ('+errors.join('; ')+')');
  await context.close();
 }
 // I3: a height-only resize (a phone URL bar) keeps the atlas and the fluid. Only the ink's detached scratch
 // canvas is counted; the work cards upload their own textures as they load.
 {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await context.addInitScript(()=>{window.__widest=0;const track=()=>{window.__widest=Math.max(window.__widest,innerWidth);requestAnimationFrame(track)};requestAnimationFrame(track)});
  await context.addInitScript(()=>{window.__uploads=0;const original=WebGL2RenderingContext.prototype.texImage2D;WebGL2RenderingContext.prototype.texImage2D=function(...a){if(!this.canvas.isConnected)window.__uploads++;return original.apply(this,a)}});
  const page=await context.newPage();
  await page.goto(base);await settle(page);await inkReady(page);await page.waitForTimeout(600);
  const before=await page.evaluate(()=>window.__uploads);
  await page.setViewportSize({width:390,height:780});await page.waitForTimeout(400);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);
  const uploads=await page.evaluate(()=>window.__uploads)-before;
  check(uploads===0,'I3: height-only resizes re-uploaded '+uploads+' textures');
  // Starting ink must never widen a phone's layout (unsized mirror canvases are 300px wide by default).
  const widest=await page.evaluate(()=>window.__widest);
  check(widest<=390,'ink start widened the phone layout to '+widest+'px');
  await context.close();
 }
 // Sharp ink: on a 2× screen every ink canvas carries 2× pixels, so inked words are as crisp as the type around them.
 {
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
  const page=await context.newPage();
  await page.goto(base);await settle(page);await inkReady(page);await page.waitForTimeout(800);
  const ratios=await page.evaluate(()=>[...document.querySelectorAll('canvas.ink-mirror')].filter(c=>c.clientWidth>40).map(c=>c.width/c.clientWidth));
  check(ratios.length>0&&ratios.every(r=>r>1.95),'ink canvases are rendered below screen density ('+ratios.map(r=>r.toFixed(2)).join(',')+')');
  await context.close();
 }
 // I4, I5, I6, I7 and M1 on one desktop page.
 {
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'light'});await context.addInitScript(light,'light');
  await context.addInitScript(()=>{window.__readyFrames=null;new MutationObserver(()=>{if(window.__readyFrames===null&&document.documentElement.classList.contains('ink-ready'))window.__readyFrames=window.portfolioInk?window.portfolioInk.state().frames:0}).observe(document,{attributes:true,subtree:true,attributeFilter:['class']})});
  const page=await context.newPage();page.on('pageerror',e=>failures.push('desktop: '+e.message));
  await page.goto(base);await settle(page);await inkReady(page);
  // M1: ink only hides the real text once it has drawn something.
  check(await page.evaluate(()=>window.__readyFrames)>=1,'M1: ink-ready was set before the first ink frame');
  // I5: screen readers hear the real numbers, not the count-up's starting values.
  const facts=await page.locator('.person-facts').ariaSnapshot();
  check(facts.includes('15+')&&facts.includes('2021')&&!/\b0\+|\b2000\b/.test(facts),'I5: facts read as '+JSON.stringify(facts));
  // I6: light-theme text colours meet contrast on white.
  const colours=await page.evaluate(()=>{const caption=document.querySelector('.specimen-caption');const a=document.createElement('a');a.textContent='x';caption.append(a);const out={caption:getComputedStyle(a).color,proof:getComputedStyle(document.querySelector('.reading .thr span')).color,alert:getComputedStyle(document.querySelector('.fund-box .label')).color,mark:getComputedStyle(document.querySelector('.board .clip h3 em')).color};a.remove();return out});
  check(ratio(colours.caption)>=4.5,'I6: caption link '+colours.caption+' is '+ratio(colours.caption).toFixed(2)+':1');
  check(ratio(colours.proof)>=4.5,'I6: reading ALERT label '+colours.proof+' is '+ratio(colours.proof).toFixed(2)+':1');
  check(ratio(colours.alert)>=4.5,'I6: funding label '+colours.alert+' is '+ratio(colours.alert).toFixed(2)+':1');
  check(ratio(colours.mark)>=3,'I6: clipping mark '+colours.mark+' is '+ratio(colours.mark).toFixed(2)+':1');
  // I7: once the rows have wiped in, nothing clips their focus ring.
  // I7: links inside a scissor-cut clipping keep their focus ring inside the cut.
  check(await page.evaluate(()=>{const a=document.querySelector('.board .clip a');a.focus();const off=parseFloat(getComputedStyle(a).outlineOffset);a.blur();return off<=4}),'I7: clipping link focus ring would be cut off');
  // I4: keyboard focus on a drifting name brings it into view, on a forward and a reversed row.
  await into(page,'.specimen');await page.waitForTimeout(400);
  for(const row of [0,1]){
   await page.evaluate(r=>{const track=document.querySelectorAll('.specimen-track')[r];for(const a of track.getAnimations())a.currentTime=a.effect.getComputedTiming().duration*.5},row);
   const name=page.locator('.specimen-row').nth(row).locator('.specimen-set:first-child .specimen-name').first();
   await name.focus();await page.waitForTimeout(150);
   const seen=await name.evaluate(el=>{const r=el.getBoundingClientRect(),v=el.closest('.specimen-viewport').getBoundingClientRect();return r.left>=v.left-1&&r.right<=v.right+1});
   check(seen,'I4: focused name on row '+(row+1)+' is outside its row');
  }
  await context.close();
 }
}catch(error){failures.push(error.message)}
await browser.close();
if(failures.length){console.error('FAIL:\n'+failures.join('\n'));process.exit(1)}
console.log('PASS: '+checks+' review regression checks');
