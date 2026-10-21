
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {homePage,projectPage,notFound,resumePage} from '../src/pages.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist');
export async function build(){
 const projects=JSON.parse(await fs.readFile(path.join(root,'src/projects.json'),'utf8'));
 await fs.mkdir(out,{recursive:true});
 await fs.cp(path.join(root,'public'),out,{recursive:true});
 await fs.writeFile(path.join(out,'index.html'),homePage(projects));
 for(const [i,p] of projects.entries()){
  const dir=path.join(out,'work',p.slug);await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'index.html'),projectPage(p,projects[(i+1)%projects.length]));
 }
 await fs.mkdir(path.join(out,'resume'),{recursive:true});
 await fs.writeFile(path.join(out,'resume/index.html'),resumePage());
 await fs.writeFile(path.join(out,'404.html'),notFound());
 await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: https://adityagaur.dev/sitemap.xml\n');
 const urls=['/','/resume/',...projects.map(p=>'/work/'+p.slug+'/')];
 await fs.writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(url=>'<url><loc>https://adityagaur.dev'+url+'</loc></url>').join('')+'</urlset>');
 console.log('Built homepage, 9 case studies, résumé, 404 page, and sitemap.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
