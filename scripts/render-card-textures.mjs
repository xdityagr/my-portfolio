// Rebuild the GPU textures from the same HTML illustrations used on case-study pages.
// Run against the local preview after changing illustration styles or content. Textures are square-cornered (a
// rounded corner would be filled with the screenshot's white backdrop) and dense enough to stay sharp at 2x / 3x.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {visual} from '../src/components.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const base=process.env.TEST_BASE_URL||'http://localhost:3001';
const projects=JSON.parse(await fs.readFile(new URL('../src/projects.json',import.meta.url)));
const out=new URL('../public/assets/cards/',import.meta.url);await fs.mkdir(out,{recursive:true});
try{for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:{width:mobile?390:1440,height:1000},deviceScaleFactor:mobile?3:2});
 const page=await context.newPage();
 await page.goto(base);
 for(const slug of ['pineyard','starforge','credent','safeher','fusion'])for(const mode of ['dark','light','color']){
  const p=projects.find(p=>p.slug===slug);
  await page.setContent('<html '+(mode==='light'?'data-theme="light"':'')+'><head><link rel="stylesheet" href="'+base+'/styles.css"><link rel="stylesheet" href="'+base+'/experience.css"></head><body><a class="work-image" data-project="'+slug+'"><div class="sheet-'+(mode==='color'?'color':'neutral')+'">'+visual(p)+'</div></a></body></html>');
  await page.addStyleTag({content:'body{margin:0!important;background:transparent}body::after{display:none}.work-image,.project-visual{border-radius:0!important}.work-image{width:'+ (mobile?350:1000)+'px!important;border:0!important;transform:none!important;overflow:hidden!important}.sheet-color{clip-path:none!important}.project-visual{max-height:none!important}.project-visual,.project-visual *{animation:none!important;transition:none!important}.visual-cta{display:none!important}'});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode()}))});
  const png=await page.locator('.work-image').screenshot({animations:'disabled'});
  const data=await page.evaluate(async b64=>{const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);return c.toDataURL('image/webp',.9).split(',')[1]},png.toString('base64'));
  await fs.writeFile(new URL(slug+'-'+(mobile?'mobile-':'')+mode+'.webp',out),Buffer.from(data,'base64'));
 }
 await context.close();
}}finally{await browser.close()}
console.log('Rendered 30 card textures from the original project illustrations.');
