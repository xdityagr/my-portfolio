import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const launch={headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist']};
if(process.env.PLAYWRIGHT_EXECUTABLE_PATH)launch.executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const browser=await chromium.launch(launch);
const failures=[];let checks=0;
const settle=page=>page.waitForFunction(()=>!document.documentElement.classList.contains('intro-pending'));
const into=(page,selector)=>page.evaluate(s=>{const el=document.querySelector(s);scrollTo({top:el.getBoundingClientRect().top+scrollY-innerHeight*.3,behavior:'instant'})},selector);
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();
 page.on('pageerror',e=>failures.push('home: '+e.message));
 await page.goto(base);await settle(page);

 // SIH: the front page
 assert.equal((await page.locator('.gazette .flag').textContent()).trim(),'The Build Gazette');
 assert.equal(await page.locator('.headline.blind[aria-hidden="true"]').count(),1,'one decorative pressed headline');
 assert.equal(await page.locator('.hugequote').count(),1,'the interview is the pull quote');
 await page.waitForFunction(()=>window.portfolioInk?.state().ready===true,null,{timeout:15000});
 await into(page,'.fund-box',.5);await page.waitForFunction(()=>document.querySelector('.fund-box .count').textContent.trim()==='₹75,000',null,{timeout:8000}).catch(()=>{});
 assert.equal((await page.locator('.fund-box .count').textContent()).trim(),'₹75,000','funding counts up to the real value');
 assert.equal((await page.locator('.fund-box .sr-only').textContent()).trim(),'₹75,000','screen readers get the real value');
 await into(page,'.reading',.35);await page.waitForTimeout(3400);
 assert.ok(await page.locator('.reading').evaluate(el=>el.classList.contains('alerted')),'the reading raises its alert');
 assert.ok(await page.locator('.reading image').evaluateAll(els=>els.length===2&&els.every(e=>(e.getAttribute('href')||'').startsWith('data:image'))),'the reading is filled with marble');checks+=7;

 // Highlights: clippings
 assert.equal(await page.locator('.board .clip').count(),13,'13 clippings');
 assert.equal((await page.locator('.board .clip').filter({hasText:'Design Championship'}).locator('h3 em').textContent()).trim(),'Runner-up');
 await into(page,'.board',.25);await page.waitForTimeout(1800);
 const landed=page.locator('.board .clip').first();
 assert.ok(await landed.evaluate(el=>el.classList.contains('in')&&getComputedStyle(el).opacity==='1'),'the first clipping has landed');
 const box=await landed.boundingBox();await page.mouse.move(box.x+box.width*.85,box.y+box.height*.2);await page.waitForTimeout(600);
 assert.ok(await landed.evaluate(el=>el.classList.contains('lifted')&&/matrix3d/.test(getComputedStyle(el.querySelector('.sheet')).transform)),'a hovered clipping tilts toward the cursor in 3D');
 await page.mouse.move(5,5);checks+=4;

 // Edge bands: fixed fades at the top and bottom of the screen, in once the page moves; content is never transformed.
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(700);
 await page.waitForFunction(()=>[...document.querySelectorAll('.edge-band')].every(b=>getComputedStyle(b).opacity==='0'),null,{timeout:3000}).catch(()=>{});
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.edge-band')].map(b=>getComputedStyle(b).opacity).join()),'0,0','no bands on the opening screen');
 await into(page,'.deck',.5);await page.waitForFunction(()=>[...document.querySelectorAll('.edge-band')].every(b=>+getComputedStyle(b).opacity>.9),null,{timeout:3000}).catch(()=>{});
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.edge-band')].every(b=>{const cs=getComputedStyle(b);return cs.position==='fixed'&&cs.pointerEvents==='none'&&+cs.opacity>.9})),'top and bottom bands fade the page edges once it moves');
 // The drum lives in the bands only: content is never squashed or tilted (entrances may still slide it).
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.deck,.hugequote,.board .clip,.index-row')].every(el=>{const t=getComputedStyle(el).transform;return t==='none'||/^matrix\(1, 0, 0, 1, /.test(t)})),'content itself is never squashed or tilted');checks+=3;

 // Person
 assert.equal(await page.locator('.ink-timeline > li').count(),4,'4 timeline entries');
 assert.equal(await page.locator('.hand .card').count(),3,'the playground is a hand of three cards');
 assert.equal(await page.locator('.hand .card-back[inert]').count(),3,'every toy starts face down');
 await into(page,'.person-facts');await page.waitForTimeout(1800);
 assert.deepEqual(await page.locator('.person-facts .count').allInnerTexts(),['15+','2021'],'facts count up to their values');
 await page.locator('.hand .card-front').first().click();await page.waitForTimeout(1200);
 assert.ok(await page.locator('.hand .card').first().evaluate(el=>el.classList.contains('flipped')),'turning a card over flips it');
 assert.equal(await page.locator('.hand .card-back[inert]').count(),2,'its toy is face up and reachable');checks+=6;

 // Toolkit specimen
 assert.equal(await page.locator('ul.toolkit-list.sr-only > li').count(),16,'16 tools in the accessible list');
 await into(page,'.specimen');await page.waitForTimeout(600);
 // Rewind the first row so its first copy of Python is on screen, then hover it like a visitor would.
 const py=await page.evaluate(()=>{for(const a of document.querySelector('.specimen-track').getAnimations())a.currentTime=0;const r=[...document.querySelectorAll('.specimen-name')].filter(b=>b.textContent.trim()==='Python').map(b=>b.getBoundingClientRect()).find(r=>r.left>0&&r.right<innerWidth);return r&&{x:r.left+r.width/2,y:r.top+r.height/2}});
 assert.ok(py,'a Python name is on screen');
 await page.mouse.move(py.x,py.y);await page.waitForTimeout(250);
 assert.ok((await page.locator('.specimen-caption').textContent()).includes('AI tools, data workflows'),'caption shows the tool note');
 assert.equal(await page.locator('.specimen-caption a').getAttribute('href'),'/work/starforge/','caption links the related project');checks+=4;

 const noJs=await browser.newContext({viewport:{width:1440,height:900},javaScriptEnabled:false});
 const plain=await noJs.newPage();await plain.goto(base);
 assert.equal(await plain.locator('.board .clip:visible').count(),13,'no-JS: 13 clippings visible');
 assert.equal(await plain.locator('.ink-timeline > li:visible').count(),4,'no-JS: 4 timeline entries visible');
 assert.equal(await plain.locator('.specimen-set:first-child .specimen-name:visible').count(),16,'no-JS: 16 tool names visible');checks+=3;
 await noJs.close();

 const reduced=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 const still=await reduced.newPage();
 still.on('pageerror',e=>failures.push('reduced: '+e.message));
 await still.goto(base);await settle(still);await still.waitForTimeout(300);
 assert.equal(await still.evaluate(()=>document.querySelector('.headline-wrap').style.getPropertyValue('--p')),'1','reduced motion: the headline is fully inked');
 assert.ok(await still.evaluate(()=>[...document.querySelectorAll('.board .clip')].every(el=>getComputedStyle(el).opacity==='1')),'reduced motion: clippings are already in place');checks+=1;
 assert.ok(await still.evaluate(()=>{const t=[...document.querySelectorAll('.specimen-track')];return t.length===4&&t.every(el=>{const cs=getComputedStyle(el);return cs.animationName==='none'||cs.animationPlayState==='paused'})}),'reduced motion: specimen rows are still');checks+=2;
 await reduced.close();
 await context.close();
}catch(error){failures.push(error.message)}
await browser.close();
if(failures.length){console.error('FAIL:\n'+failures.join('\n'));process.exit(1)}
console.log('PASS: '+checks+' section browser checks');
