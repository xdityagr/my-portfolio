
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from './build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
await build();
const data=JSON.parse(await fs.readFile(path.join(root,'src/projects.json'),'utf8'));
assert.equal(data.length,9);
assert.equal(new Set(data.map(p=>p.slug)).size,9);
const routes=['index.html','404.html','resume/index.html',...data.map(p=>'work/'+p.slug+'/index.html')];
let refs=0;
for(const route of routes){
 const html=await fs.readFile(path.join(dist,route),'utf8');
 assert.equal((html.match(/<h1[ >]/g)||[]).length,1,route+' must have exactly one h1');
 assert.ok(html.includes('id="main"'),route+' must have a skip target');
 assert.ok(html.includes('name="viewport"'),route+' needs viewport metadata');
 for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  assert.notEqual(url,'#','Empty destination in '+route);
  if(url.startsWith('https:')||url.startsWith('mailto:')){new URL(url.replaceAll('&amp;','&'));continue}
  let [file,anchor]=url.split('#');
  let target=file?path.resolve(dist,'.'+file):path.join(dist,route);
  if(file?.endsWith('/'))target=path.join(target,'index.html');
  const targetContents=await fs.readFile(target);
  if(anchor)assert.ok(targetContents.toString().includes('id="'+anchor+'"'),'Missing anchor '+url);
  refs++;
 }
}
const home=await fs.readFile(path.join(dist,'index.html'),'utf8');
const heroHeading=home.match(/<h1[\s\S]*?<\/h1>/)[0];
assert.equal((heroHeading.match(/data-ink="(paint|full)"/g)||[]).length,11,'hero name must have 11 ink letters');
assert.ok(!home.includes('hero-field'),'the light-theme gradient canvas is gone');
const mind=home.match(/<section id="mind"[\s\S]*?<\/section>/)[0];
assert.equal(new Set([...mind.matchAll(/data-ink="term" data-ink-group="([^"]+)"/g)].map(m=>m[1])).size,3,'three Mind terms are ink');
const enterGroups=[...new Set([...home.matchAll(/data-ink="enter" data-ink-group="([^"]+)"/g)].map(m=>m[1]))];
assert.deepEqual(enterGroups.filter(g=>!/^clip-\d+$/.test(g)).sort(),['anna','code','director','highlights','how','look','quote','rabbit','talk','toolkit','work'],'home heading accents are ink');
assert.ok(!/data-ink-group="(clip|tl)-/.test(home),'repeated accents (clipping results, timeline phrases) stay plain italics');
assert.ok(/data-ink="full" data-ink-group="winner"/.test(home),'the pressed headline inks "winner."');
// Case studies ink only the footer's "talk." (their titles are plain; the page behind them is inked); other pages carry no ink.
for(const route of routes.filter(r=>r!=='index.html')){
 const html=await fs.readFile(path.join(dist,route),'utf8'),inked=[...html.matchAll(/data-ink="([a-z]+)" data-ink-group="([^"]+)"/g)];
 if(route.startsWith('work'))assert.ok(inked.length>0&&inked.every(m=>m[1]==='enter'&&m[2]==='talk'),route+' inks only the footer talk');
 else assert.equal(inked.length,0,route+' must not carry ink');
}
assert.ok(/<ul class="board" role="list">/.test(home)&&/<ol class="ink-timeline" role="list">/.test(home),'styled lists keep role="list"');
// The light theme is periwinkle now: no mint left over, and nothing styles or scripts markup that was removed.
for(const file of (await fs.readdir(dist)).filter(f=>/\.(css|js)$/.test(f))){
 const text=(await fs.readFile(path.join(dist,file),'utf8')).toLowerCase();
 for(const hex of ['#829bc3','#88b6ae','#658e86','#98a4d8'])assert.ok(!text.includes(hex),file+' still uses '+hex);
 for(const dead of ['recognition-card','experience-book','tech-badge','hero-field','ledger-row','sih-feature','odometer'])assert.ok(!text.includes(dead),file+' still mentions '+dead);
}
for(const asset of ['display.ttf','editorial.ttf','star-chart.svg','social.png','resume-preview.png']){
 assert.ok((await fs.stat(path.join(dist,'assets',asset))).size>100,'Missing or empty asset '+asset);
}
assert.ok((await fs.readFile(path.join(dist,'assets/star-chart.svg'),'utf8')).trimEnd().endsWith('</svg>'));
console.log('PASS: '+routes.length+' HTML pages, '+refs+' local references, project records, anchors, and critical assets.');
