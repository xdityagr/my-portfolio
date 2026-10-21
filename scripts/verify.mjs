
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
for(const asset of ['display.ttf','editorial.ttf','star-chart.svg','social.png','resume-preview.png']){
 assert.ok((await fs.stat(path.join(dist,'assets',asset))).size>100,'Missing or empty asset '+asset);
}
assert.ok((await fs.readFile(path.join(dist,'assets/star-chart.svg'),'utf8')).trimEnd().endsWith('</svg>'));
console.log('PASS: '+routes.length+' HTML pages, '+refs+' local references, project records, anchors, and critical assets.');
