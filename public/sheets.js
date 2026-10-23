// One textured mesh per card: no duplicated artwork or per-frame CSS masks.
const root=document.documentElement;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const pointer=matchMedia('(hover:hover) and (pointer:fine)');
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const sheets=[];let raf=0,last=0;
const vertex=`#version 300 es
in vec2 aUV;
uniform vec2 uSize,uViewport,uOrigin,uCursor;
uniform float uFlex,uFlat,uPivotY,uPersp;
out vec2 vUV;out float vLift;
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
 float scale=uPersp/(uPersp-z);
 vec2 projected=vec2(bentX*scale+uViewport.x*.5,(uOrigin.y+aUV.y*uSize.y-uPivotY)*scale+uPivotY);
 vec2 local=(projected-uOrigin+uSize*.22)/(uSize*1.44);
 gl_Position=vec4(local.x*2.-1.,1.-local.y*2.,0.,1.);
 vLift=lift/210.;
}`;
// The colour pours in like ink running into water. When a card starts to ink, one small pass bakes a flow map: for
// each point, when the ink reaches it (a marbled, swirling distance from where the pointer came in, with a fresh swirl
// every pour) and the site's marbled ink colour there (the project's own tones, --ink-pal on the card). Each frame is
// then a threshold sweeping through that map, so the edge runs along the swirls in fingers with a thin marbled rim
// riding it, for three texture reads and no per-frame noise. Textures are mipmapped and sampled with a slight
// sharpening bias, so the type stays crisp through the bend; the mesh edges are antialiased over one pixel.
const fragment=`#version 300 es
precision highp float;
in vec2 vUV;in float vLift;
uniform sampler2D uNeutral,uColor,uFlow;
uniform float uProgress;
out vec4 o;
vec4 tex(sampler2D s,vec2 uv){return texture(s,uv,-.5);}
void main(){
 vec4 c;
 if(uProgress>=.999)c=tex(uColor,vUV);
 else if(uProgress<=.001)c=tex(uNeutral,vUV);
 else{
  vec4 flow=texture(uFlow,vUV);
  float ink=smoothstep(flow.a-.02,flow.a+.02,uProgress);
  if(ink<=0.)c=tex(uNeutral,vUV);
  else{
   float rim=ink*(1.-smoothstep(0.,.08,uProgress-flow.a));
   vec3 col=mix(tex(uColor,vUV).rgb,flow.rgb,rim*.65);
   c=vec4(ink>=1.?col:mix(tex(uNeutral,vUV).rgb,col,ink),1.);
  }
 }
 c.rgb*=1.-vLift*.045;
 vec2 edge=min(vUV,1.-vUV)/fwidth(vUV);
 o=c*clamp(min(edge.x,edge.y)+.5,0.,1.);
}`;
const bakeVertex=`#version 300 es
in vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}`;
const bakeFragment=`#version 300 es
precision highp float;
uniform vec2 uRes,uInk,uSize,uSeed;
uniform float uTheme;
uniform vec3 uPal0,uPal1,uPal2,uPal3;
out vec4 o;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*vnoise(p);p=m*p;a*=.5;}return v;}
vec3 marble(vec2 p){
 vec2 q=vec2(fbm(p),fbm(p+vec2(5.2,1.3)));
 vec2 r=vec2(fbm(p+3.5*q+vec2(1.7,9.2)),fbm(p+3.5*q+vec2(8.3,2.8)));
 float f=fbm(p+3.5*r);
 vec3 c=mix(uPal0,uPal1,smoothstep(.28,.62,f));
 c=mix(c,uPal2,smoothstep(.50,.80,q.y)*.85);
 c=mix(c,uPal3,smoothstep(.52,.78,r.x)*.7);
 return mix(c,vec3(.99,.98,1.),smoothstep(.70,.86,f)*.5*(1.-uTheme));
}
// The swirl that bends the ink's path; measured relative to the entry point, so the ink always starts under the pointer.
vec2 swirl(vec2 p){
 vec2 q=vec2(fbm(p*1.1+uSeed),fbm(p*1.1+uSeed.yx+vec2(5.2,1.3)))-.5;
 vec2 r=vec2(fbm(p*2.3+q*3.+vec2(1.7,9.2)),fbm(p*2.3+q*3.+vec2(8.3,2.8)))-.5;
 return q*.6+r*.25;
}
void main(){
 vec2 uv=gl_FragCoord.xy/uRes,aspect=vec2(uSize.x/uSize.y,1.),p=uv*aspect,origin=uInk*aspect;
 float d=length(p-origin+swirl(p)-swirl(origin));
 float reach=length(max(origin,aspect-origin))+.45;
 o=vec4(marble(uv*uSize/240.+uSeed),clamp(d/reach,0.,.985));
}`;
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function link(gl,vs,fs){const program=gl.createProgram();const v=shader(gl,gl.VERTEX_SHADER,vs),f=shader(gl,gl.FRAGMENT_SHADER,fs);gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));return program}
const locations=(gl,program,names)=>Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(program,'u'+n)]));
function createRenderer(s){
 const canvas=document.createElement('canvas');canvas.className='sheet-canvas';canvas.setAttribute('aria-hidden','true');
 const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,powerPreference:'low-power'});
 if(!gl){fallback(s);return;}
 // The flow-map pass: one triangle over a small framebuffer, with its own vertex array.
 const bake=link(gl,bakeVertex,bakeFragment),bakeU=locations(gl,bake,['Res','Ink','Size','Seed','Theme','Pal0','Pal1','Pal2','Pal3']);
 const bakeVao=gl.createVertexArray();gl.bindVertexArray(bakeVao);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(bake,'aPos');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);
 const program=link(gl,vertex,fragment);gl.useProgram(program);
 const vertices=[];const cols=48,rows=24;
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const l=x/cols,r=(x+1)/cols,t=y/rows,b=(y+1)/rows;vertices.push(l,t,r,t,l,b,l,b,r,t,r,b)}
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,'aUV');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
 const uniforms=locations(gl,program,['Size','Viewport','Origin','Cursor','Flex','Flat','PivotY','Persp','Progress','Neutral','Color','Flow']);
 const aniso=gl.getExtension('EXT_texture_filter_anisotropic');
 const textures=[0,1,2].map(i=>{const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,i<2?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);if(aniso&&i<2)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));return texture});
 ['Neutral','Color','Flow'].forEach((n,i)=>gl.uniform1i(uniforms[n],i));
 const framebuffer=gl.createFramebuffer();
 s.renderer={gl,canvas,uniforms,textures,count:vertices.length/2,program,bake,bakeU,bakeVao,framebuffer,flowSize:''};
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback(s);loadTextures(s)});
 s.link.insertBefore(canvas,s.link.querySelector('.case-badge'));
}
// Bakes the flow map for a new pour (400 px across; the field is smooth, so filtering fills in the rest).
function bakeFlow(s){
 const {gl,textures,program,bake,bakeU:u,bakeVao,framebuffer}=s.renderer;
 const fw=400,fh=Math.max(8,Math.round(400*s.h/Math.max(1,s.w))),size=fw+'x'+fh;
 gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,textures[2]);
 if(s.renderer.flowSize!==size){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,fw,fh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);s.renderer.flowSize=size}
 gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,textures[2],0);
 gl.viewport(0,0,fw,fh);gl.useProgram(bake);gl.bindVertexArray(bakeVao);
 gl.uniform2f(u.Res,fw,fh);gl.uniform2f(u.Ink,s.ix,s.iy);gl.uniform2f(u.Size,s.w,s.h);gl.uniform2f(u.Seed,Math.random()*40,Math.random()*40);gl.uniform1f(u.Theme,root.dataset.theme==='light'?1:0);s.pal.forEach((c,i)=>gl.uniform3fv(u['Pal'+i],c));
 gl.drawArrays(gl.TRIANGLES,0,3);
 gl.bindVertexArray(null);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(program);gl.viewport(0,0,s.renderer.canvas.width,s.renderer.canvas.height);
 s.flowed=true;
}
function fallback(s){
 s.ready=false;s.link.classList.remove('gpu-ready');s.renderer?.canvas.remove();
 const canvas=document.createElement('canvas');canvas.className='sheet-canvas';canvas.setAttribute('aria-hidden','true');
 const ctx=canvas.getContext('2d',{alpha:true});
 if(!ctx){s.renderer=null;return}
 const ink=document.createElement('canvas'),composite=document.createElement('canvas');
 s.renderer={canvas,ctx,ink,composite,type:'2d'};s.link.classList.add('sheet-fallback');s.link.insertBefore(canvas,s.link.querySelector('.case-badge'));s.variant=null;
}
function drawFallback(s,r,flat,progress){
 const {canvas,ctx,ink,composite}=s.renderer;
 const width=Math.round(s.w),height=Math.round(s.h),padX=width*.22,padY=height*.22;
 if(canvas.width!==Math.round(width*1.44)||canvas.height!==Math.round(height*1.44)){canvas.width=Math.round(width*1.44);canvas.height=Math.round(height*1.44)}
 if(composite.width!==width||composite.height!==height){composite.width=ink.width=width;composite.height=ink.height=height}
 const mix=composite.getContext('2d'),color=ink.getContext('2d');
 mix.clearRect(0,0,width,height);mix.drawImage(s.images[0],0,0,width,height);
 if(progress>0){
  color.clearRect(0,0,width,height);color.globalCompositeOperation='source-over';color.drawImage(s.images[1],0,0,width,height);
  if(progress<1){
   color.globalCompositeOperation='destination-in';color.beginPath();
   const reach=Math.hypot(width,height)*1.5*progress;
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

// The card's ink palette (--ink-pal, darkest to lightest), else the site's own periwinkle, per theme.
const SITE_INK=[[[.12,.10,.36],[.45,.50,1],[.74,.84,1],[.86,.58,.84]],[[.24,.30,.90],[.36,.42,.92],[.42,.54,.94],[.80,.40,.74]]];
function paletteOf(s,light){const v=getComputedStyle(s.link).getPropertyValue('--ink-pal').trim().split(/\s+/).filter(c=>/^#[0-9a-f]{6}$/i.test(c));return v.length===4?v.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255)):SITE_INK[light]}
// Bump when the card artwork is re-rendered, so browsers never keep showing a stale copy.
const ART_VERSION=3;
// Each card holds only the monochrome artwork for the current theme plus the colour artwork; a theme change swaps
// the monochrome one in.
async function loadTextures(s){
 const size=innerWidth<=900?'mobile-':'',variant=size+(root.dataset.theme==='light'?'light':'dark');if(!s.renderer||s.variant===variant)return;
 s.variant=variant;const token=++s.token;
 try{const images=await Promise.all([variant,size+'color'].map(async name=>{const image=new Image();image.src='/assets/cards/'+s.link.dataset.project+'-'+name+'.webp?v='+ART_VERSION;await image.decode();return image}));
 if(token!==s.token||!s.renderer)return;
 s.images=images;s.pal=paletteOf(s,root.dataset.theme==='light'?1:0);s.flowed=false;const {gl,textures}=s.renderer;
 if(gl)images.forEach((image,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.generateMipmap(gl.TEXTURE_2D)});
 s.ready=true;s.key='';s.link.classList.add('gpu-ready');schedule();
 }catch{s.ready=false;s.link.classList.remove('gpu-ready');s.renderer?.canvas.remove();s.renderer=null}
}
// A new pour starts where the pointer came in (the middle, without one) and gets a fresh flow map; ink that is still
// draining pours back along its old path.
function activate(s,on,event){
 if(on&&!s.target&&s.progress<.001){const r=s.link.getBoundingClientRect();s.ix=event?clamp((event.clientX-r.left)/r.width):.5;s.iy=event?clamp((event.clientY-r.top)/r.height):.5;s.flowed=false}
 s.target=on?1:0;s.card.classList.toggle('is-inked',on);schedule();
}
for(const link of document.querySelectorAll('.work-image')){
 const source=link.querySelector('.project-visual');if(!source)continue;
 const card=link.closest('.work-card');link.classList.add('flexible-sheet');
 const s={link,card,source,w:0,h:0,progress:0,target:0,hover:false,focus:false,ix:.5,iy:.5,px:.5,py:.5,sx:.5,sy:.5,flex:0,ready:false,flowed:false,token:0};sheets.push(s);
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
// The reveal runs at a steady pace and is eased for drawing, so the pour starts and settles gently.
const ease=p=>p*p*(3-2*p);
function draw(now){
 raf=0;const gap=now-last,dt=last&&gap<250?gap:16.7;last=now;let moving=false;
 // On desktop the pinned track turns on the barrel; on smaller screens the cards swipe sideways in a row that bends the
 // same way, with a perspective scaled to the screen and pivoting on each card's own middle (so scrolling the page
 // never warps them). With motion off the cards lie flat.
 const paused=reduced.matches||root.classList.contains('motion-paused');const flat=paused,row=!paused&&innerWidth<=900;
 const boxes=sheets.map(s=>s.link.getBoundingClientRect());
 for(const [i,s] of sheets.entries()){
  const r=boxes[i];if(r.bottom< -100||r.top>innerHeight+100||r.right< -250||r.left>innerWidth+250)continue;
  // Without a pointer, the card in the middle of the screen (and of its row) inks.
  if(!pointer.matches){const target=r.top<innerHeight*.75&&r.bottom>innerHeight*.25&&Math.abs((r.left+r.right)/2-innerWidth/2)<r.width*.3?1:0;if(s.target!==target)activate(s,!!target)}
  const follow=1-Math.exp(-dt/95);const flexTarget=s.hover&&!flat?1:0;
  for(const [a,b] of [['sx',s.px],['sy',s.py],['flex',flexTarget]]){s[a]=paused?b:s[a]+(b-s[a])*follow;if(Math.abs(b-s[a])<.001)s[a]=b;else moving=true}
  if(paused)s.progress=s.target;else{const step=dt/(s.target?1200:700);s.progress=clamp(s.progress+(s.target?step:-step))}
  if(s.progress!==s.target)moving=true;
  if(!s.ready)continue;
  // A flat card draws the same wherever it sits, so scrolling alone never redraws it.
  const key=[flat?0:r.left,flat||row?0:r.top,s.w,s.h,innerWidth,innerHeight,s.sx,s.sy,s.flex,s.progress,s.flowed,flat,s.variant].map(n=>typeof n==='number'?n.toFixed(3):n).join(',');if(s.key===key)continue;s.key=key;
  const progress=ease(s.progress);
  if(s.renderer.type==='2d'){drawFallback(s,r,flat,progress);continue;}
  const {gl,canvas,uniforms:u,count}=s.renderer;
  const dpr=Math.min(devicePixelRatio,3);const w=Math.round(s.w*1.44*dpr),h=Math.round(s.h*1.44*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}
  if(progress>0&&progress<1&&!s.flowed)bakeFlow(s);
  gl.uniform2f(u.Size,s.w,s.h);gl.uniform2f(u.Viewport,innerWidth,innerHeight);gl.uniform2f(u.Origin,r.left,r.top);gl.uniform2f(u.Cursor,s.sx,s.sy);
  gl.uniform1f(u.Flex,s.flex);gl.uniform1f(u.Flat,flat?1:0);gl.uniform1f(u.PivotY,row?r.top+s.h/2:innerHeight/2);gl.uniform1f(u.Persp,row?innerWidth*1.9:2200);gl.uniform1f(u.Progress,progress);
  gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,count);
 }
 if(moving)schedule();
}
const near=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const s=sheets.find(s=>s.link===entry.target);near.unobserve(entry.target);try{createRenderer(s);loadTextures(s)}catch{fallback(s);loadTextures(s)}}},{rootMargin:'600px'});
const observer=new ResizeObserver(measure);for(const s of sheets){near.observe(s.link);observer.observe(s.link)}
new MutationObserver(()=>{for(const s of sheets)if(s.renderer)loadTextures(s);schedule()}).observe(root,{attributes:true,attributeFilter:['data-theme','class']});
document.querySelector('.work-track')?.addEventListener('scroll',schedule,{passive:true});
addEventListener('resize',measure,{passive:true});addEventListener('pageshow',measure);document.fonts.ready.then(measure);reduced.addEventListener('change',measure);addEventListener('portfolio-motion',measure);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else measure()});measure();
