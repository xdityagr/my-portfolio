
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const mime={'.pdf':'application/pdf','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.json':'application/json','.xml':'application/xml','.txt':'text/plain'};
export function serve(port=Number(process.env.PORT)||3000){
 const server=http.createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   let file=path.resolve(root,'.'+pathname);
   if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
   const stat=await fs.stat(file).catch(()=>null);
   if(stat?.isDirectory())file=path.join(file,'index.html');
   const body=await fs.readFile(file).catch(()=>null);
   res.setHeader('X-Content-Type-Options','nosniff');
   res.setHeader('Cache-Control','no-store');
   if(!body){res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(await fs.readFile(path.join(root,'404.html')));return}
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(400).end('Bad request')}
 });
 server.listen(port,'0.0.0.0',()=>console.log('Portfolio preview: http://localhost:'+port));
 return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))serve();
