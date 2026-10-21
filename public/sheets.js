// One textured mesh per card: no duplicated artwork or per-frame CSS masks.
const root=document.documentElement;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const pointer=matchMedia('(hover:hover) and (pointer:fine)');
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const sheets=[];let raf=0,last=0;
const vertex=`attribute vec2 aUV;
uniform vec2 uSize,uViewport,uOrigin,uCursor;
uniform float uFlex,uFlat;
varying vec2 vUV;varying float vLift;
void main(){
 vUV=aUV;
 float radius=uViewport.x*1.35;
 float x=uOrigin.x+aUV.x*uSize.x-uViewport.x*.5;
 float theta=clamp(x/radius,-.85,.85);
 vec2 d=aUV-uCursor;
 float bell=exp(-d.x*d.x*8.-d.y*d.y*5.);
 float lift=bell*uFlex*210.;
 float z=(radius*(1.-cos(theta))+lift)*(1.-uFlat);
 float bentX=mix(radius*sin(theta),x,uFlat);
 float scale=2200./(2200.-z);
 vec2 projected=vec2(bentX*scale+uViewport.x*.5,(uOrigin.y+aUV.y*uSize.y-uViewport.y*.5)*scale+uViewport.y*.5);
 vec2 local=(projected-uOrigin+uSize*.22)/(uSize*1.44);
 gl_Position=vec4(local.x*2.-1.,1.-local.y*2.,0.,1.);
 vLift=lift/210.;
}`;
const fragment=`precision highp float;
varying vec2 vUV;varying float vLift;
uniform sampler2D uDark,uLight,uColor;
uniform vec2 uInk,uSize;
uniform float uProgress,uTheme;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
 vec4 neutral=mix(texture2D(uDark,vUV),texture2D(uLight,vUV),uTheme);
 float ink=0.;
 if(uProgress>=.999){ink=1.;}else if(uProgress>0.){
  vec2 p=vUV*vec2(uSize.x/uSize.y,1.);
  vec2 origin=uInk*vec2(uSize.x/uSize.y,1.);
  float grain=noise(p*7.)*.17+noise(p*19.)*.065+noise(p*43.)*.018;
  float distance=length(p-origin)+grain;
  float reach=length(vec2(uSize.x/uSize.y,1.))+.3;
  ink=1.-smoothstep(uProgress*reach-.018,uProgress*reach+.018,distance);
 }
 vec4 color=mix(neutral,texture2D(uColor,vUV),ink);
 color.rgb*=1.-vLift*.045;
 gl_FragColor=color;
}`;
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function createRenderer(s){
 const canvas=document.createElement('canvas');canvas.className='sheet-canvas';canvas.setAttribute('aria-hidden','true');
 const gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,powerPreference:'low-power'});
 if(!gl){fallback(s);return;}
 const program=gl.createProgram();const vs=shader(gl,gl.VERTEX_SHADER,vertex),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const vertices=[];const cols=48,rows=24;
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const l=x/cols,r=(x+1)/cols,t=y/rows,b=(y+1)/rows;vertices.push(l,t,r,t,l,b,l,b,r,t,r,b)}
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,'aUV');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
 const uniforms={};for(const n of ['Size','Viewport','Origin','Cursor','Flex','Flat','Ink','Progress','Theme','Dark','Light','Color'])uniforms[n]=gl.getUniformLocation(program,'u'+n);
 const textures=[0,1,2].map(i=>{const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return texture});
 ['Dark','Light','Color'].forEach((n,i)=>gl.uniform1i(uniforms[n],i));
 s.renderer={gl,canvas,uniforms,textures,count:vertices.length/2};
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback(s);loadTextures(s)});
 s.link.insertBefore(canvas,s.link.querySelector('.case-badge'));
}
function fallback(s){
 s.ready=false;s.link.classList.remove('gpu-ready');s.renderer?.canvas.remove();
 const canvas=document.createElement('canvas');canvas.className='sheet-canvas';canvas.setAttribute('aria-hidden','true');
 const ctx=canvas.getContext('2d',{alpha:true});
 if(!ctx){s.renderer=null;return}
 const ink=document.createElement('canvas'),composite=document.createElement('canvas');
 s.renderer={canvas,ctx,ink,composite,type:'2d'};s.link.classList.add('sheet-fallback');s.link.insertBefore(canvas,s.link.querySelector('.case-badge'));s.variant=null;
}
function drawFallback(s,r,flat,light){
 const {canvas,ctx,ink,composite}=s.renderer;
 const width=Math.round(s.w),height=Math.round(s.h),padX=width*.22,padY=height*.22;
 if(canvas.width!==Math.round(width*1.44)||canvas.height!==Math.round(height*1.44)){canvas.width=Math.round(width*1.44);canvas.height=Math.round(height*1.44)}
 if(composite.width!==width||composite.height!==height){composite.width=ink.width=width;composite.height=ink.height=height}
 const mix=composite.getContext('2d'),color=ink.getContext('2d');
 mix.clearRect(0,0,width,height);mix.drawImage(s.images[light?1:0],0,0,width,height);
 if(s.progress>0){
  color.clearRect(0,0,width,height);color.globalCompositeOperation='source-over';color.drawImage(s.images[2],0,0,width,height);
  if(s.progress<1){
   color.globalCompositeOperation='destination-in';color.beginPath();
   const reach=Math.hypot(width,height)*1.5*s.progress;
   for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;const rr=reach*(1+.13*Math.sin(a*3+1)+.085*Math.sin(a*7)+.035*Math.cos(a*17));const x=s.ix*width+Math.cos(a)*rr,y=s.iy*height+Math.sin(a)*rr;if(i)color.lineTo(x,y);else color.moveTo(x,y)}color.closePath();color.fill();color.globalCompositeOperation='source-over';
  }
  mix.drawImage(ink,0,0);
 }
 ctx.clearRect(0,0,canvas.width,canvas.height);
 const radius=innerWidth*1.35,columns=flat?1:40,unit=width/columns;
 for(let i=0;i<columns;i++){
  const u=(i+.5)/columns,x=r.left+u*width-innerWidth*.5,theta=flat?0:clamp(x/radius,-.85,.85);
  const bell=Math.exp(-((u-s.sx)**2)*8);const z=flat?0:radius*(1-Math.cos(theta))+bell*s.flex*210;
  const scale=2200/(2200-z),bentX=flat?x:radius*Math.sin(theta);
  const left=bentX*scale+innerWidth*.5-r.left+padX-unit*.5*scale;
  const top=(r.top-innerHeight*.5)*scale+innerHeight*.5-r.top+padY;
  ctx.drawImage(composite,i*unit,0,unit,height,left,top,unit*scale+1,height*scale);
 }
}

async function loadTextures(s){
 const variant=innerWidth<=900?'mobile-':'';if(!s.renderer||s.variant===variant)return;
 s.variant=variant;const token=++s.token;
 try{const images=await Promise.all(['dark','light','color'].map(async mode=>{const image=new Image();image.src='/assets/cards/'+s.link.dataset.project+'-'+variant+mode+'.webp';await image.decode();return image}));
 if(token!==s.token||!s.renderer)return;
 s.images=images;const {gl,textures}=s.renderer;
 if(gl)images.forEach((image,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image)});
 s.ready=true;s.key='';s.link.classList.add('gpu-ready');schedule();
 }catch{s.ready=false;s.link.classList.remove('gpu-ready');s.renderer?.canvas.remove();s.renderer=null}
}
function activate(s,on,event){
 if(on&&!s.target){const r=s.link.getBoundingClientRect();s.ix=event?clamp((event.clientX-r.left)/r.width):.5;s.iy=event?clamp((event.clientY-r.top)/r.height):.5}
 s.target=on?1:0;s.card.classList.toggle('is-inked',on);schedule();
}
for(const link of document.querySelectorAll('.work-image')){
 const source=link.querySelector('.project-visual');if(!source)continue;
 const card=link.closest('.work-card');link.classList.add('flexible-sheet');
 const s={link,card,source,w:0,h:0,progress:0,target:0,hover:false,focus:false,ix:.5,iy:.5,px:.5,py:.5,sx:.5,sy:.5,flex:0,ready:false,token:0};sheets.push(s);
 card.addEventListener('pointerenter',event=>{if(pointer.matches){s.hover=true;activate(s,true,event)}});
 card.addEventListener('pointermove',event=>{if(!pointer.matches)return;const r=link.getBoundingClientRect();s.px=clamp((event.clientX-r.left)/r.width);s.py=clamp((event.clientY-r.top)/r.height);if(!s.hover){s.hover=true;activate(s,true,event)}schedule()},{passive:true});
 card.addEventListener('pointerleave',()=>{s.hover=false;s.px=.5;s.py=.5;activate(s,s.focus)});
 card.addEventListener('focusin',()=>{s.focus=true;activate(s,true)});
 card.addEventListener('focusout',event=>{if(!card.contains(event.relatedTarget)){s.focus=false;activate(s,s.hover)}});
}
function measure(){for(const s of sheets){s.w=s.link.offsetWidth;s.h=s.link.offsetHeight;s.key='';if(s.renderer)loadTextures(s)}schedule()}
// The page's scroll animator only invalidates; this is the sole owner of card drawing.
export function updateSheetGeometry(){schedule()}
function schedule(){if(!raf&&!document.hidden)raf=requestAnimationFrame(draw)}
function draw(now){
 raf=0;const dt=Math.min(now-last||16.7,40);last=now;let moving=false;
 const paused=reduced.matches||root.classList.contains('motion-paused');const flat=paused||innerWidth<=900;const light=root.dataset.theme==='light'?1:0;
 const boxes=sheets.map(s=>s.link.getBoundingClientRect());
 for(const [i,s] of sheets.entries()){
  const r=boxes[i];if(r.bottom< -100||r.top>innerHeight+100||r.right< -250||r.left>innerWidth+250)continue;
  if(!pointer.matches){const target=r.top<innerHeight*.7&&r.bottom>innerHeight*.3?1:0;if(s.target!==target)activate(s,!!target)}
  const ease=1-Math.exp(-dt/95);const flexTarget=s.hover&&!flat?1:0;
  for(const [a,b] of [['sx',s.px],['sy',s.py],['flex',flexTarget]]){s[a]=paused?b:s[a]+(b-s[a])*ease;if(Math.abs(b-s[a])<.001)s[a]=b;else moving=true}
  if(paused)s.progress=s.target;else{const step=dt/(s.target?540:320);s.progress=clamp(s.progress+(s.target?step:-step))}
  if(s.progress!==s.target)moving=true;
  if(!s.ready)continue;
  const key=[r.left,r.top,s.w,s.h,innerWidth,innerHeight,s.sx,s.sy,s.flex,s.progress,s.ix,s.iy,flat,light].map(n=>typeof n==='number'?n.toFixed(3):n).join(',');if(s.key===key)continue;s.key=key;
  if(s.renderer.type==='2d'){drawFallback(s,r,flat,light);continue;}
  const {gl,canvas,uniforms:u,count}=s.renderer;
  const dpr=Math.min(devicePixelRatio,1.5);const w=Math.round(s.w*1.44*dpr),h=Math.round(s.h*1.44*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}
  gl.uniform2f(u.Size,s.w,s.h);gl.uniform2f(u.Viewport,innerWidth,innerHeight);gl.uniform2f(u.Origin,r.left,r.top);gl.uniform2f(u.Cursor,s.sx,s.sy);gl.uniform2f(u.Ink,s.ix,s.iy);
  gl.uniform1f(u.Flex,s.flex);gl.uniform1f(u.Flat,flat?1:0);gl.uniform1f(u.Progress,s.progress);gl.uniform1f(u.Theme,light);
  gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,count);
 }
 if(moving)schedule();
}
const near=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const s=sheets.find(s=>s.link===entry.target);near.unobserve(entry.target);try{createRenderer(s);loadTextures(s)}catch{fallback(s);loadTextures(s)}}},{rootMargin:'600px'});
const observer=new ResizeObserver(measure);for(const s of sheets){near.observe(s.link);observer.observe(s.link)}
new MutationObserver(schedule).observe(root,{attributes:true,attributeFilter:['data-theme','class']});
addEventListener('resize',measure,{passive:true});addEventListener('pageshow',measure);document.fonts.ready.then(measure);reduced.addEventListener('change',measure);addEventListener('portfolio-motion',measure);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else measure()});measure();
