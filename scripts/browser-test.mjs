
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const launch={headless:true};
if(process.env.PLAYWRIGHT_EXECUTABLE_PATH)launch.executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const browser=await chromium.launch(launch);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const projects=JSON.parse(await fs.readFile(path.join(root,'src/projects.json'),'utf8'));
await fs.mkdir(path.join(root,'.qa'),{recursive:true});
let checks=0;
const failures=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
 const page=await context.newPage();
 page.on('pageerror',e=>failures.push(e.message));
 page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)failures.push(r.status()+' '+r.url())});
 for(const width of [320,375,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  await page.goto(base);
  await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Homepage overflow at '+width);
  checks++;
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base);
 await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
 await page.screenshot({path:path.join(root,'.qa','desktop.png')});
 await page.getByRole('button',{name:'AI & products',exact:true}).click();
 assert.equal(await page.locator('.index-row:visible').count(),3);
 await page.getByRole('button',{name:'Systems',exact:true}).click();
 assert.equal(await page.locator('.index-row:visible').count(),2);
 await page.getByRole('button',{name:'Developer tools',exact:true}).click();
 assert.equal(await page.locator('.index-row:visible').count(),4);
 await page.getByRole('button',{name:'All',exact:true}).click();
 assert.equal(await page.locator('.index-row:visible').count(),9);
 checks+=4;
 await page.locator('[data-copy]').click();
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'gauraditya@outlook.in');checks++;
 await page.goto(base);
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.className),'skip');
 await page.keyboard.press('Enter');
 assert.ok(page.url().endsWith('#main'));checks++;
 await page.locator('.index-row').first().click();
 await page.waitForURL('**/work/pineyard/');
 await page.goBack();
 assert.ok(!page.url().includes('/work/'));checks++;
 for(const width of [375,1440]){
  await page.setViewportSize({width,height:900});
  for(const project of projects){
   const response=await page.goto(base+'/work/'+project.slug+'/');
   assert.equal(response.status(),200);
   assert.equal(await page.locator('h1').textContent(),project.name);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),project.slug+' overflows at '+width);
   if(project.slug==='starforge'){
    const image=page.locator('.star-chart');
    await image.evaluate(img=>{img.loading='eager';return img.decode()});
    assert.ok(await image.evaluate(img=>img.naturalWidth>0));
   }
   assert.equal(await page.locator('.next-project').count(),1);
   checks++;
  }
 }
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const mp=await mobile.newPage();await mp.goto(base);
 assert.equal(await mp.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);checks++;
 await mp.screenshot({path:path.join(root,'.qa','mobile.png')});
 await mp.getByRole('button',{name:'Systems',exact:true}).tap();
 assert.equal(await mp.locator('.index-row:visible').count(),2);checks++;
 await mp.locator('.index-row:visible').first().tap();await mp.waitForURL('**/work/credent/');
 await mp.screenshot({path:path.join(root,'.qa','case-mobile.png')});
 const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 const np=await nojs.newPage();await np.goto(base);
 assert.equal(await np.locator('.index-row:visible').count(),9);
 assert.equal(await np.locator('.work-card:visible').count(),5);
 assert.equal(await np.locator('.index-filters:visible').count(),0);checks+=3;
 await page.goto(base+'/resume/');
 assert.equal(await page.locator('.resume-document object').count(),0);
 await page.locator('.resume-full-preview').evaluate(img=>img.decode());
 assert.ok(await page.locator('.resume-full-preview').evaluate(img=>img.naturalWidth>=2300));
 const pdf=await context.request.get(base+'/resume.pdf');
 assert.equal(pdf.status(),200);assert.ok(pdf.headers()['content-type'].includes('application/pdf'));
 assert.ok((await pdf.body()).subarray(0,5).toString().startsWith('%PDF'));checks+=3;
 await mp.goto(base+'/resume/');assert.ok(await mp.locator('.resume-full-preview').isVisible());assert.ok(await mp.locator('a[download]').isVisible());checks+=2;
 await page.setViewportSize({width:1440,height:1000});await page.goto(base);
 await page.locator('.skip-intro').click();
 const mindTop=await page.locator('#mind').evaluate(el=>el.offsetTop);
 await page.evaluate(y=>window.scrollTo({top:y+800,behavior:'instant'}),mindTop);
 await page.waitForFunction(()=>parseFloat(document.querySelector('.reading-word').style.opacity)>.9);checks++;
 const workTop=await page.locator('.work-scroll').evaluate(el=>el.getBoundingClientRect().top+scrollY);
 await page.evaluate(y=>window.scrollTo({top:y+1500,behavior:'instant'}),workTop);
 await page.waitForFunction(()=>parseFloat(document.querySelector('.work-track').style.getPropertyValue('--work-x')) < -100);
 checks++;
 await page.locator('[data-motion]').click();assert.ok(await page.evaluate(()=>document.documentElement.classList.contains('motion-paused')));
 assert.equal(await page.locator('[data-motion]').getAttribute('aria-pressed'),'true');checks++;
 await page.locator('[data-motion]').click();assert.ok(await page.evaluate(()=>!document.documentElement.classList.contains('motion-paused')));checks++;
 await page.locator('.drum-pad').click();await page.waitForFunction(()=>document.querySelector('.rhythm-status').textContent.includes('Playing'));checks++;
 assert.equal(projects.find(p=>p.slug==='safeher').live,'https://try-safeher.vercel.app/');checks++;
 const nf=await np.goto(base+'/missing-page/');assert.equal(nf.status(),404);checks++;
 // Intro replays on refresh; skip is immediate and the signature is centered.
 await page.goto(base);assert.ok(await page.locator('.signature-intro').isVisible());await page.locator('.skip-intro').click();
 await page.reload();assert.ok(await page.locator('.signature-intro').isVisible());await page.keyboard.press('Escape');assert.ok(!await page.locator('.signature-intro').isVisible());checks+=3;
 // Hover every featured card from both artwork and caption, including re-entry.
 const galleryTop=await page.locator('.work-scroll').evaluate(el=>el.getBoundingClientRect().top+scrollY);
 const cards=page.locator('.work-card');
 for(let i=0;i<5;i++){
  const offset=await cards.nth(i).evaluate(el=>el.offsetLeft-document.querySelector('.work-card').offsetLeft);
  await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),galleryTop+offset);
  await page.waitForFunction(()=>new Promise(resolve=>{let n=0;function frame(){if(++n>=45)resolve(true);else requestAnimationFrame(frame)}requestAnimationFrame(frame)}));
  const card=cards.nth(i),art=card.locator('.work-image');
  const rect=await art.boundingBox();const cx=Math.min(1300,Math.max(100,rect.x+rect.width*.45));
  for(const y of [rect.y+rect.height*.4,rect.y+rect.height+36,rect.y+rect.height*.65]){
   await page.mouse.move(25,50);await page.waitForFunction(i=>!document.querySelectorAll('.work-card')[i].classList.contains('is-inked'),i);
   await page.mouse.move(cx,y);await page.waitForFunction(i=>document.querySelectorAll('.work-card')[i].classList.contains('is-inked'),i);
   await page.waitForFunction(i=>getComputedStyle(document.querySelectorAll('.case-badge')[i]).opacity==='1',i);checks++;
  }
  const transform=await card.locator('.sheet-slice').nth(5).evaluate(el=>el.style.transform);
  await page.mouse.move(cx+80,rect.y+rect.height*.2);
  await page.waitForFunction(({i,t})=>document.querySelectorAll('.work-card')[i].querySelectorAll('.sheet-slice')[5].style.transform!==t,{i,t:transform});checks++;
 }
 let downloads=0;page.on('download',()=>downloads++);await page.goto(base+'/resume/');await page.locator('.resume-full-preview').evaluate(img=>img.decode());assert.equal(downloads,0);checks++;
 await page.goto(base);await page.locator('.skip-intro').click();await page.locator('.theme-switch').click();
 assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.type-opening')).backgroundColor),'rgb(255, 255, 255)');
 await page.reload();await page.locator('.skip-intro').click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');checks+=2;
 assert.deepEqual(failures,[]);
 console.log('PASS: '+checks+' browser checks; responsive widths, all case studies, filters, clipboard, keyboard, history, reduced motion, touch, no-JS fallback, and 404.');
}finally{await browser.close()}
