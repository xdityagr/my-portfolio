
import {watch} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {serve} from './serve.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let building=false,again=false,timer;
async function rebuild(){
 if(building){again=true;return}building=true;
 await new Promise(resolve=>{const child=spawn(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'inherit',windowsHide:true});child.on('error',e=>{console.error(e);resolve()});child.on('exit',resolve)});
 building=false;if(again){again=false;await rebuild()}
}
await rebuild();
const server=serve();
const watchers=['src','public'].map(dir=>watch(path.join(root,dir),{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(rebuild,100)}));
process.on('SIGINT',()=>{watchers.forEach(w=>w.close());server.close();process.exit()});
