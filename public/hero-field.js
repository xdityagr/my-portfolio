// Bounded contour / colour fields: motion happens inside their coordinates, never by
// translating the canvas. Grain stays anchored to physical screen pixels.
let canvas, gl, program, uniforms, frame=0, visible=true, lost=false;
let width=0, height=0, dirty=true, paused=false, light=false;
let targetX=0, targetY=0, x=0, y=0, clock=0, last=0, painted=0;
const vertex=`
attribute vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}
`;
const fragment=`
precision highp float;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float time;
uniform float light;
float bell(vec2 p,vec2 center,vec2 spread){
 vec2 d=(p-center)/spread;
 return exp(-dot(d,d)*2.);
}
void main(){
 vec2 uv=gl_FragCoord.xy/resolution;
 uv.y=1.-uv.y;
 vec2 p=uv;
 // A local, smooth lens follows the cursor. It bends the field rather than
 // dragging its boundaries; its influence dies away before reaching an edge.
 vec2 cursor=vec2(.5)+pointer*.5;
 vec2 d=p-cursor;
 float lens=exp(-dot(d,d)*7.);
 float boundary=sin(3.14159265*uv.x)*sin(3.14159265*uv.y);
 p+=vec2(-d.y,d.x)*lens*.09*boundary;
 p+=pointer*.012*lens*boundary;
 float t=time;
 float portrait=1.-smoothstep(.65,1.10,resolution.x/resolution.y);
 p.x+=sin(p.y*5.3-t*.48)*.038*boundary;
 p.y+=sin(p.x*4.2+t*.37)*.027*boundary;
 
 if(light<.5){
  // Sparse, softly lit contour lines. The pattern deforms in place instead of
  // shifting a texture, so its outer edges remain anchored to the black page.
  float a=p.x*4.5-t*.27;
  float b=p.x*8.+p.y*3.+t*.16;
  float contour=p.y+.18*sin(a)+.08*sin(b);
  float count=mix(24.,16.,portrait);
  float distance=abs(fract(contour*count)-.5);
  vec2 slope=vec2(.81*cos(a)+.64*cos(b),1.+.24*cos(b));
  float pixel=length(slope/resolution)*count;
  float line=1.-smoothstep(pixel*.28,pixel*1.15,distance);
  float focus=bell(uv,vec2(mix(.78,.58,portrait),.39),vec2(mix(.48,.80,portrait),.64));
  float edges=smoothstep(0.,.13,uv.x)*(1.-smoothstep(.91,1.,uv.x))*
              smoothstep(0.,.08,uv.y)*(1.-smoothstep(.73,1.,uv.y));
  float lighting=.68+.32*sin(p.x*3.4+p.y*2.-t*.13);
  gl_FragColor=vec4(vec3(line*focus*edges*lighting*.25),1.);
  return;
 }
 float spine=mix(.76,.58,portrait)+.14*sin(p.y*5.5-t*.42);
 float width=mix(.14,.34,portrait)+.035*sin(p.y*4.+t*.35);
 float fold=exp(-pow((p.x-spine)/width,2.)*1.25);
 float veil=fold*exp(-pow((p.y-(.40+.055*sin(t*.32)))/.38,2.));
 float echo=bell(p,vec2(.50+.09*sin(t*.31+.8),.48+.12*cos(t*.29)),vec2(mix(.24,.40,portrait),.32));
 float halo=bell(p,vec2(.77,.32),vec2(.44,.55));
 float cyan=bell(p,vec2(.72+.07*sin(t*.46),.22+.04*cos(t*.34)),vec2(.28,.24));
 float violet=bell(p,vec2(.74+.06*cos(t*.39),.51+.08*sin(t*.38)),vec2(.26,.28));
 float warm=bell(p,vec2(.64,.72),vec2(.24,.19));
 vec3 blue=mix(vec3(.04,.72,.43),vec3(.55,.60,1.),light);
 vec3 teal=mix(vec3(.28,.96,.70),vec3(.48,.80,.88),light);
 vec3 purple=mix(vec3(.03,.59,.44),vec3(.72,.60,.94),light);
 vec3 amber=mix(vec3(.65,.92,.34),vec3(.94,.78,.64),light);
 vec3 color=(blue*.45+teal*cyan+purple*violet+amber*warm*.38)/
            (.45+cyan+violet+warm*.38);
 float envelope=smoothstep(0.,.12,uv.x)*(1.-smoothstep(.93,1.,uv.x))*
                (1.-smoothstep(.72,1.,uv.y));
 float strength=(veil*.61+halo*.12+echo*.16)*envelope;
 vec3 base=mix(vec3(0.),vec3(1.),light);
 vec3 result=mix(base,color,strength*mix(.84,.47,light));
 // One physical-pixel grain, independent of the animated coordinates. The
 // low amplitude prevents crawling speckles and avoids enlarged noise tiles.
 float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)-.5;
 result+=grain*.011*smoothstep(0.,.12,strength);
 gl_FragColor=vec4(result,1.);
}
`;
function compile(type,source){
 const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null}
 return shader;
}
function setup(){
 gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
 if(!gl)return false;
 const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
 if(!vs||!fs)return false;
 program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
 gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))return false;
 gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 const position=gl.getAttribLocation(program,'position');
 gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 uniforms=Object.fromEntries(['resolution','pointer','time','light'].map(name=>[name,gl.getUniformLocation(program,name)]));
 canvas.style.background='';canvas.style.opacity='';lost=false;dirty=true;return true;
}
function fallback(){
 // Context loss / unsupported GPU keeps a quiet, fully contained still field.
 canvas.style.background=light
  ?'radial-gradient(ellipse at 77% 28%,#a5b5ff38,transparent 52%),radial-gradient(ellipse at 85% 50%,#c1a5ef25,transparent 38%)'
  :'radial-gradient(ellipse at 78% 38%,transparent,#000 70%),repeating-radial-gradient(ellipse at 105% -20%,#ffffff16 0 1px,transparent 2px 28px)';
}
function schedule(){if(!frame&&visible&&!document.hidden&&!lost&&program)frame=requestAnimationFrame(tick)}
function tick(now){
 frame=0;if(!visible||document.hidden||lost)return;
 const dt=last?Math.min(now-last,250):0;last=now;
 if(!paused){clock+=dt*.0018;const ease=1-Math.exp(-dt/650);x+=(targetX-x)*ease;y+=(targetY-y)*ease}
 else{x=0;y=0}
 // Thirty frames per second is sufficient for this slow field and leaves the
 // independent typography / project interaction renderers their full budget.
 if(dirty||now-painted>=1000/30){
  painted=now;dirty=false;
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}
  gl.viewport(0,0,width,height);gl.useProgram(program);
  gl.uniform2f(uniforms.resolution,width,height);
  gl.uniform2f(uniforms.pointer,x,y);gl.uniform1f(uniforms.time,clock);gl.uniform1f(uniforms.light,light?1:0);
  gl.drawArrays(gl.TRIANGLES,0,3);
 }
 if(!paused)schedule();
}
function init(){
 canvas=document.querySelector('.hero-field');if(!canvas)return;
 if(!setup())fallback();
 const resize=new ResizeObserver(()=>{
  const scale=Math.min(devicePixelRatio||1,1.25);
  width=Math.max(1,Math.round(canvas.clientWidth*scale));height=Math.max(1,Math.round(canvas.clientHeight*scale));
  dirty=true;schedule();
 });resize.observe(canvas);
 const observer=new IntersectionObserver(([entry])=>{
  visible=entry.isIntersecting;last=0;
  if(visible){dirty=true;schedule()}else{cancelAnimationFrame(frame);frame=0}
 });observer.observe(canvas);
 document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden){cancelAnimationFrame(frame);frame=0}else schedule()});
 addEventListener('portfolio-motion',()=>{
  paused=document.documentElement.classList.contains('motion-paused');dirty=true;schedule();
 });
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;fallback()});
 canvas.addEventListener('webglcontextrestored',()=>{if(setup())schedule();else fallback()});
}
export function drawHeroField(nextX,nextY,scroll,isPaused){
 if(!canvas)init();if(!canvas)return;
 const nextLight=document.documentElement.dataset.theme==='light';
 if(nextLight!==light||paused!==isPaused){light=nextLight;paused=isPaused;dirty=true;if(!program||lost)fallback()}
 targetX=nextX;targetY=nextY;
 if(!paused||dirty)schedule();
}
