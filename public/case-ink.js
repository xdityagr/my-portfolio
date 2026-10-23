// Case studies: the project's marbled ink fills the page behind the opening, where the background glow sits, in the
// project's own tones (--ink-pal on <main>), while the title stays plain. One WebGL2 canvas over the opening, drawn sharp
// (up to 1.5x density), flowing by itself and stirred faster by scrolling, at a modest frame rate and only while
// it is on screen; with motion off it is a still. Without WebGL2 the CSS glow stays.
const root=document.documentElement;
const FS=`#version 300 es
precision highp float;
uniform vec2 uRes,uSize;uniform float uTime,uTheme;uniform vec3 uPal0,uPal1,uPal2,uPal3;
out vec4 o;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*vnoise(p);p=m*p;a*=.5;}return v;}
float fbm3(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<3;i++){v+=a*vnoise(p);p=m*p;a*=.5;}return v;}
// The marbling: the site's double domain warp (f is the marble, q and r its two warp layers).
vec3 marble(vec2 p,float t){
 vec2 q=vec2(fbm(p+vec2(0.,t*.07)),fbm(p+vec2(5.2,1.3)-vec2(t*.05,0.)));
 vec2 r=vec2(fbm(p+3.5*q+vec2(1.7,9.2)+t*.04),fbm(p+3.5*q+vec2(8.3,2.8)-t*.03));
 return vec3(fbm(p+3.5*r),q.y,r.x);
}
// Soft clouds of ink where the glows were: ellipses whose edges are broken up by (cheap) noise.
float cloud(vec2 uv,vec2 c,vec2 r,float n){return smoothstep(1.,.15,length((uv-c)/r)+(n-.5)*.55);}
void main(){
 vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uRes*uSize,uv=px/uSize,p=px/240.;
 float n=fbm3(p*.7);
 float a=max(max(cloud(uv,vec2(.9,.12),vec2(.62,.36),n),cloud(uv,vec2(.1,.5),vec2(.42,.26),n)*.62),cloud(uv,vec2(.68,.86),vec2(.36,.2),n)*.4);
 if(a<.004){o=vec4(0.);return;}
 vec3 m=marble(p,uTime);float f=m.x;
 if(uTheme<.5){
  // Dark: luminous marbled ink with white highlights.
  vec3 c=mix(uPal0,uPal1,smoothstep(.28,.62,f));
  c=mix(c,uPal2,smoothstep(.50,.80,m.y)*.85);
  c=mix(c,uPal3,smoothstep(.52,.78,m.z)*.7);
  c=mix(c,vec3(.99,.98,1.),smoothstep(.70,.86,f)*.5);
  a*=.62;o=vec4(c*a,a);
 }else{
  // Light: marbled pigment on white paper. The mid and light inks only (the darkest reads as grey on white), and the
  // pigment's density follows the marbling, so the swirls show as stronger and fainter veins rather than a flat wash.
  vec3 c=mix(uPal1,uPal2,smoothstep(.3,.7,f));
  c=mix(c,uPal3,smoothstep(.5,.8,m.z)*.6);
  float density=smoothstep(.25,.85,f)*.75+smoothstep(.5,.8,m.y)*.25;
  a*=mix(.16,.56,density);o=vec4(c*a,a);
 }
}`;
export function initCaseInk(main){
 if(!main||main.querySelector('.case-ink'))return;
 const canvas=document.createElement('canvas');canvas.className='case-ink';canvas.setAttribute('aria-hidden','true');
 const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
 if(!gl)return;
 const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
 let program;
 try{program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,'#version 300 es\nin vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}'));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return}catch{return}
 gl.useProgram(program);
 gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 const pos=gl.getAttribLocation(program,'aPos');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
 const u=Object.fromEntries(['Res','Size','Time','Theme','Pal0','Pal1','Pal2','Pal3'].map(n=>[n,gl.getUniformLocation(program,'u'+n)]));
 main.prepend(canvas);main.classList.add('case-ink-ready');
 const still=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||root.classList.contains('motion-paused');
 const coarse=matchMedia('(pointer:coarse)').matches,every=coarse?66:50;
 let palette=null,visible=true,frame=0,drawn=0,t=Math.random()*20,stir=0,lastY=scrollY;
 // Scrolling stirs the ink: the distance scrolled speeds its flow for a moment.
 addEventListener('scroll',()=>{stir=Math.min(4,stir+Math.abs(scrollY-lastY)*.004);lastY=scrollY;wake()},{passive:true});
 const readPalette=()=>{const v=getComputedStyle(main).getPropertyValue('--ink-pal').trim().split(/\s+/).filter(c=>/^#[0-9a-f]{6}$/i.test(c));palette=v.length===4?v.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255)):null};
 const size=()=>{const w=canvas.clientWidth,h=canvas.clientHeight,k=Math.min(devicePixelRatio,1.5);canvas.width=Math.max(1,Math.round(w*k));canvas.height=Math.max(1,Math.round(h*k));gl.viewport(0,0,canvas.width,canvas.height)};
 const draw=()=>{
  if(!palette)return;
  gl.uniform2f(u.Res,canvas.width,canvas.height);gl.uniform2f(u.Size,canvas.clientWidth,canvas.clientHeight);gl.uniform1f(u.Time,t);gl.uniform1f(u.Theme,root.dataset.theme==='light'?1:0);
  palette.forEach((c,i)=>gl.uniform3fv(u['Pal'+i],c));
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
 };
 const tick=now=>{frame=0;if(!visible||document.hidden||still())return;if(now-drawn>=every){const dt=Math.min(now-drawn,250)/1000;t+=dt*(.9+stir);stir*=Math.exp(-dt*2.5);drawn=now;draw()}frame=requestAnimationFrame(tick)};
 const wake=()=>{if(!frame&&visible&&!document.hidden&&!still())frame=requestAnimationFrame(tick);else if(still())draw()};
 readPalette();size();draw();
 new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;wake()}).observe(canvas);
 new MutationObserver(()=>{readPalette();draw();wake()}).observe(root,{attributes:true,attributeFilter:['data-theme','class']});
 addEventListener('resize',()=>{size();draw()},{passive:true});
 document.addEventListener('visibilitychange',wake);
 wake();
}
