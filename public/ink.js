// Site-wide ink: marbled ink inside every [data-ink] glyph. One offscreen WebGL2 context renders each
// group of ink words into a small "mirror" canvas that lives inside the words' own container, so the ink
// scrolls, clips and fades natively with its text (no overlay lag). The HTML text stays real (transparent
// fill) and reappears whenever this module is absent or fails. Home page only; started by experience.js.
import {clamp, smooth, ramp, enterProgress, drainProgress, packAtlas, baseline} from './ink-math.js';
import {heroState} from './hero-state.js';

const queued = new Map();
let api = null, starting = null;
export function setActive(el, on){ if (api) api.setActive(el, on); else queued.set(el, on); }
export function initInk(){
 if (!starting) starting = start().then(instance => {
  api = instance;
  if (instance) for (const [el, on] of queued) instance.setActive(el, on);
  queued.clear();
 }).catch(() => { document.documentElement.classList.remove('ink-ready') });
 return starting;
}

const MAX_ITEMS = 64, DATA_W = 9;
const VS = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0., 1.); }`;
const VS_GRID = `#version 300 es
in vec2 aPos; uniform highp vec2 texelSize; out vec2 vUv, vL, vR, vT, vB;
void main(){ vUv = aPos * .5 + .5; vL = vUv - vec2(texelSize.x, 0.); vR = vUv + vec2(texelSize.x, 0.); vT = vUv + vec2(0., texelSize.y); vB = vUv - vec2(0., texelSize.y); gl_Position = vec4(aPos, 0., 1.); }`;
const GRID = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB; out vec4 o;
`;
const NOISE = `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
 return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = m * p; a *= .5; } return v; }
`;

/* fluid: v13 stable fluids with viscosity; the map holds marbling coordinates (rg) and painted coverage (b) */
const FS = {
 splat: GRID + `uniform sampler2D uTarget; uniform float aspectRatio, radius; uniform vec4 color; uniform vec2 point;
void main(){ vec2 p = vUv - point; p.x *= aspectRatio; o = texture(uTarget, vUv) + exp(-dot(p, p) / radius) * color; }`,
 advect: GRID + `uniform sampler2D uVelocity, uSource; uniform vec2 texelSize; uniform float dt, dissipation;
void main(){ vec2 c = vUv - dt * texture(uVelocity, vUv).xy * texelSize; o = texture(uSource, c) / (1. + dissipation * dt); }`,
 madv: GRID + `uniform sampler2D uVelocity, uSource; uniform vec2 texelSize; uniform float dt, dissipation;
void main(){ vec2 c = vUv - dt * texture(uVelocity, vUv).xy * texelSize; vec4 s = texture(uSource, c); o = vec4(s.rg, s.b / (1. + dissipation * dt), 0.); }`,
 mrel: GRID + `uniform sampler2D uMap; uniform float uRate, uInit;
void main(){ vec4 m = texture(uMap, vUv); o = vec4(mix(m.rg, vUv, max(uRate, uInit)), m.b * (1. - uInit), 0.); }`,
 div: GRID + `uniform sampler2D uVelocity;
void main(){ float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x, T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y; vec2 C = texture(uVelocity, vUv).xy;
 if (vL.x < 0.) L = -C.x; if (vR.x > 1.) R = -C.x; if (vT.y > 1.) T = -C.y; if (vB.y < 0.) B = -C.y;
 o = vec4(.5 * (R - L + T - B), 0., 0., 1.); }`,
 curl: GRID + `uniform sampler2D uVelocity;
void main(){ float L = texture(uVelocity, vL).y, R = texture(uVelocity, vR).y, T = texture(uVelocity, vT).x, B = texture(uVelocity, vB).x; o = vec4(.5 * (R - L - T + B), 0., 0., 1.); }`,
 vort: GRID + `uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
void main(){ float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;
 vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + .0001; f *= curl * C; f.y *= -1.;
 vec2 v = texture(uVelocity, vUv).xy + f * dt; o = vec4(clamp(v, -1000., 1000.), 0., 1.); }`,
 pres: GRID + `uniform sampler2D uPressure, uDivergence;
void main(){ float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
 o = vec4((L + R + B + T - texture(uDivergence, vUv).x) * .25, 0., 0., 1.); }`,
 grad: GRID + `uniform sampler2D uPressure, uVelocity;
void main(){ float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
 o = vec4(texture(uVelocity, vUv).xy - vec2(R - L, T - B), 0., 1.); }`,
 scale: GRID + `uniform sampler2D uTexture; uniform float value; void main(){ o = value * texture(uTexture, vUv); }`,
 visc: GRID + `uniform sampler2D uVelocity; uniform float uK;
void main(){ vec2 C = texture(uVelocity, vUv).xy, N = (texture(uVelocity, vL).xy + texture(uVelocity, vR).xy + texture(uVelocity, vT).xy + texture(uVelocity, vB).xy) * .25; o = vec4(mix(C, N, uK), 0., 1.); }`
};

/* display: per item, inverse-transform the pixel into its atlas cell, then mix base colour and marble
   by the Selected Work reveal front (public/sheets.js maths) */
const FS_INK = `#version 300 es
precision highp float; precision highp sampler2D;
uniform vec2 uRes, uOrigin; uniform float uTime, uTheme, uDpr, uScroll, uFluid, uToScreen, uHue, uUsePal; uniform vec3 uPal0, uPal1, uPal2, uPal3; uniform int uStart, uCount;
uniform sampler2D uAtlas, uMap, uData;
out vec4 o;
` + NOISE + `
vec3 marble(vec2 p, float t){
 vec2 q = vec2(fbm(p + vec2(0., t * .07)), fbm(p + vec2(5.2, 1.3) - vec2(t * .05, 0.)));
 vec2 r = vec2(fbm(p + 3.5 * q + vec2(1.7, 9.2) + t * .04), fbm(p + 3.5 * q + vec2(8.3, 2.8) - t * .03));
 float f = fbm(p + 3.5 * r);
 vec3 c0 = mix(vec3(.12, .10, .36), vec3(.24, .30, .90), uTheme);
 vec3 c1 = mix(vec3(.45, .50, 1.), vec3(.36, .42, .92), uTheme);
 vec3 c2 = mix(vec3(.74, .84, 1.), vec3(.42, .54, .94), uTheme);
 vec3 c3 = mix(vec3(.86, .58, .84), vec3(.80, .40, .74), uTheme);
 if (uUsePal > .5) { c0 = uPal0; c1 = uPal1; c2 = uPal2; c3 = uPal3; }
 vec3 c = mix(c0, c1, smoothstep(.28, .62, f));
 c = mix(c, c2, smoothstep(.50, .80, q.y) * .85);
 c = mix(c, c3, smoothstep(.52, .78, r.x) * .7);
 return mix(c, vec3(.99, .98, 1.), smoothstep(.70, .86, f) * .5 * (1. - uTheme)); // white highlights only on dark
}
float reveal(vec2 q, vec4 R, vec2 span){
 if (R.z >= .999) return 1.;
 if (R.z <= .001) return 0.;
 vec2 p = q / R.w, origin = R.xy / R.w;
 float grain = vnoise(p * 3.) * .17 + vnoise(p * 8.) * .065 + vnoise(p * 19.) * .018;
 float reach = length(span / R.w) + .3;
 return 1. - smoothstep(R.z * reach - .018, R.z * reach + .018, length(p - origin) + grain);
}
vec4 cell(int i, int k){ return texelFetch(uData, ivec2(k, i), 0); }
// Turns the marble palette's hue in YIQ, which keeps luma, so a page can ink in its own colour without the
// palette getting brighter (a plain RGB turn makes yellows and greens far lighter than the periwinkle).
vec3 hueRotate(vec3 c, float a){
 vec3 yiq = mat3(.299, .596, .211, .587, -.274, -.523, .114, -.322, .312) * c;
 float cs = cos(a), sn = -sin(a); // positive a turns red toward yellow, like CSS hue-rotate
 yiq.yz = vec2(yiq.y * cs - yiq.z * sn, yiq.y * sn + yiq.z * cs);
 return mat3(1., 1., 1., .956, -.272, -1.106, .621, -.647, 1.703) * yiq;
}
// On the light theme, ink never gets lighter than 3:1 against white (relative luminance .30).
vec3 legible(vec3 c){
 float L = dot(pow(max(c, 0.), vec3(2.2)), vec3(.2126, .7152, .0722));
 return mix(c, c * pow(min(1., .28 / max(L, 1e-4)), 1. / 2.2), uTheme);
}
void main(){
 vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
 vec2 screen = uOrigin + fc * uToScreen;
 vec4 acc = vec4(0.);
 bool have = false; vec4 m = vec4(0.); vec3 mk = vec3(0.);
 for (int k = 0; k < ${MAX_ITEMS}; k++){
  if (k >= uCount) break;
  int i = uStart + k;
  vec4 a = cell(i, 0), b = cell(i, 1), c = cell(i, 2), d = cell(i, 3);
  vec2 p = fc - a.xy - a.zw - b.xy;
  float cs = cos(b.z), sn = sin(b.z);
  vec2 q = vec2(cs * p.x + sn * p.y, -sn * p.x + cs * p.y) / c.xy + a.zw - c.zw;
  if (q.x < 0. || q.y < 0. || q.x > d.x || q.y > d.y) continue;
  vec4 uv = cell(i, 4);
  float cov = textureLod(uAtlas, mix(uv.xy, uv.zw, q / d.xy), 0.).r * b.w;
  if (cov < .003) continue;
  if (!have) {
   vec2 suv = clamp(vec2(screen.x / uRes.x, 1. - screen.y / uRes.y), 0., 1.);
   m = uFluid > .5 ? texture(uMap, suv) : vec4(suv, 0., 0.);
   mk = marble((vec2(m.r, 1. - m.g) * uRes + vec2(0., uScroll)) / (uDpr * 240.), uTime * .6);
   if (uHue != 0. && uUsePal < .5) mk = clamp(hueRotate(mk, uHue), 0., 1.);
   mk = legible(mk);
   have = true;
  }
  float ink = reveal(screen, cell(i, 6), cell(i, 7).xy);
  if (d.z > .5) ink *= smoothstep(.10, .45, m.b);
  vec3 col = mix(cell(i, 8).rgb, mk, ink);
  acc = vec4(col * cov, cov) + acc * (1. - cov);
 }
 o = acc;
}`;

async function start(){
 const root = document.documentElement;
 const elements = [...document.querySelectorAll('[data-ink]')];
 if (!elements.length) return null;
 const canvas = document.createElement('canvas');
 canvas.className = 'ink-canvas'; canvas.setAttribute('aria-hidden', 'true');
 const gl = canvas.getContext('webgl2', {alpha:true, premultipliedAlpha:true, antialias:false, depth:false, stencil:false});
 if (!gl) return null;
 const coarse = matchMedia('(pointer:coarse)').matches, reduce = matchMedia('(prefers-reduced-motion: reduce)');
 const fluidOK = !!gl.getExtension('EXT_color_buffer_float');
 const FL = {SIM:coarse ? 96 : 128, MAP:coarse ? 384 : 512, DD:.45, VD:1.6, PR:.8, IT:12, CURL:5, FORCE:2200, VISC:.45, VISC_IT:4};

 /* ---------- GL plumbing ---------- */
 function compile(type, src){
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
 }
 function program(fs, vs = VS_GRID){
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
  return {p, u};
 }
 function texParams(filter, mip){
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
 }
 function fbo(w, h){
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); texParams(gl.LINEAR, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  return {t, f, w, h};
 }
 const freeF = x => { if (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f) } };
 function dfbo(w, h){
  let a = fbo(w, h), b = fbo(w, h);
  return {w, h, get read(){ return a }, get write(){ return b }, swap(){ [a, b] = [b, a] }, free(){ freeF(a); freeF(b) }};
 }
 const tex = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); return unit };
 function blit(target){
  if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h) }
  else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H) }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
 }

 const P = {ink:program(FS_INK, VS)};
 if (fluidOK) for (const [k, fs] of Object.entries(FS)) P[k] = program(fs);
 const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
 const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
 gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
 gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
 const atlasTex = gl.createTexture(), dataTex = gl.createTexture();
 gl.bindTexture(gl.TEXTURE_2D, dataTex); texParams(gl.NEAREST, false);
 gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, DATA_W, MAX_ITEMS, 0, gl.RGBA, gl.FLOAT, null);
 const data = new Float32Array(DATA_W * MAX_ITEMS * 4);

 /* ---------- items ---------- */
 const items = elements.map(el => ({el, mode:el.dataset.ink, groupName:el.dataset.inkGroup || null, leave:el.hasAttribute('data-ink-leave'),
  origin:el.dataset.inkOrigin || null, mask:el.closest('.chapter-mask'), visible:false, row:0, rowTarget:0, progress:0, entry:null, cell:null, pivot:[0, 0], box:null}));
 const byEl = new Map(items.map(it => [it.el, it]));
 const groups = new Map();
 for (const it of items) { const name = it.groupName || it; if (!groups.has(name)) groups.set(name, []); groups.get(name).push(it) }
 for (const [, members] of groups) { const origin = members.find(m => m.origin)?.origin || 'left'; for (const m of members) { m.group = members; m.groupOrigin = origin } }
 const HOST = '.chapter-mask-inner,.reading-word,.name-mask,h1,h2,h3,h4,p,a,summary,li,figcaption,button';
 const panels = new Map();
 for (const it of items) {
  const host = it.el.closest(HOST) || it.el.parentElement;
  if (!panels.has(host)) panels.set(host, {host, items:[], canvas:null, ctx:null, w:1, h:1, x0:0, y0:0, scale:1, style:''});
  panels.get(host).items.push(it); it.panel = panels.get(host);
 }
 const restore = [];
 for (const panel of panels.values()) {
  if (getComputedStyle(panel.host).position === 'static') { restore.push(panel.host); panel.host.style.position = 'relative' }
  const mirror = document.createElement('canvas'); mirror.className = 'ink-mirror'; mirror.setAttribute('aria-hidden', 'true');
  panel.host.append(mirror); panel.canvas = mirror; panel.ctx = mirror.getContext('2d');
 }
 const teardown = () => { for (const panel of panels.values()) panel.canvas?.remove(); for (const host of restore) host.style.position = ''; root.classList.remove('ink-ready') };
 // A browser out of canvas memory hands back no 2D context: keep the plain text.
 if ([...panels.values()].some(panel => !panel.ctx)) { teardown(); return null }
 let letterOf = new Map();
 const refreshLetters = () => { letterOf = new Map(heroState.letters.map(l => [l.el, l])) };
 refreshLetters();

 let DPR = 1, W = 1, H = 1, atlasW = 1, atlasH = 1;
 function buildAtlas(){
  const measure = document.createElement('canvas').getContext('2d');
  const entries = new Map();
  for (const it of items) {
   const cs = getComputedStyle(it.el), size = parseFloat(cs.fontSize) || 16;
   const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0;
   const text = it.el.textContent, font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + size + 'px ' + cs.fontFamily;
   measure.font = font; measure.letterSpacing = ls + 'px';
   const m = measure.measureText(text);
   const A = m.fontBoundingBoxAscent ?? size * .9, D = m.fontBoundingBoxDescent ?? size * .25;
   const up = Math.max(A, m.actualBoundingBoxAscent), down = Math.max(D, m.actualBoundingBoxDescent);
   const left = Math.max(0, m.actualBoundingBoxLeft), right = Math.max(m.width, m.actualBoundingBoxRight), pad = Math.max(4, size * .08);
   const inline = cs.display === 'inline';
   const lineHeight = cs.lineHeight === 'normal' ? A + D : parseFloat(cs.lineHeight);
   const base = inline ? A : baseline(0, lineHeight, A, D);
   it.cell = {ox:-left - pad, oy:base - up - pad, cw:left + right + 2 * pad, ch:up + down + 2 * pad};
   const origin = cs.transformOrigin.split(' ').map(parseFloat);
   it.pivot = [origin[0] || 0, origin[1] || 0];
   const key = text + '|' + font + '|' + ls;
   if (!entries.has(key)) entries.set(key, {text, font:(k) => cs.fontStyle + ' ' + cs.fontWeight + ' ' + size * k + 'px ' + cs.fontFamily, ls, left, up, pad, cw:it.cell.cw, ch:it.cell.ch});
   it.entry = entries.get(key);
  }
  const list = [...entries.values()], maxTex = Math.min(coarse ? 4096 : 8192, gl.getParameter(gl.MAX_TEXTURE_SIZE));
  let k = DPR, packed;
  for (let attempt = 0; attempt < 4; attempt++) {
   packed = packAtlas(list.map(e => ({w:Math.ceil(e.cw * k) + 2, h:Math.ceil(e.ch * k) + 2})), maxTex);
   if (packed.height <= maxTex) break;
   k *= maxTex / packed.height * .98;
  }
  atlasW = Math.max(1, packed.width); atlasH = Math.max(1, packed.height);
  const atlas = document.createElement('canvas'); atlas.width = atlasW; atlas.height = atlasH;
  const ctx = atlas.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, atlasW, atlasH); ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  list.forEach((e, i) => {
   const {x, y} = packed[i];
   ctx.font = e.font(k); ctx.letterSpacing = e.ls * k + 'px';
   ctx.fillText(e.text, x + 1 + (e.left + e.pad) * k, y + 1 + (e.up + e.pad) * k);
   e.uv = [(x + 1) / atlasW, (y + 1) / atlasH, (x + 1 + e.cw * k) / atlasW, (y + 1 + e.ch * k) / atlasH];
  });
  gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, atlas); gl.generateMipmap(gl.TEXTURE_2D); texParams(gl.LINEAR, true);
 }

 /* ---------- fluid ---------- */
 let fl = null;
 const aspect = () => W / H;
 function resFor(r){ let a = aspect(); const wide = a >= 1; if (!wide) a = 1 / a; const mn = Math.round(r), mx = Math.round(r * a); return wide ? [mx, mn] : [mn, mx] }
 function mapRelax(rate, init){
  const u = P.mrel.u; gl.useProgram(P.mrel.p);
  gl.uniform2f(u.texelSize, 0, 0); gl.uniform1i(u.uMap, tex(1, fl.map.read.t)); gl.uniform1f(u.uRate, rate); gl.uniform1f(u.uInit, init);
  blit(fl.map.write); fl.map.swap();
 }
 function initFluid(){
  if (!fluidOK) return;
  if (fl) { fl.vel.free(); fl.map.free(); fl.pres.free(); freeF(fl.div); freeF(fl.curl) }
  const [sw, sh] = resFor(FL.SIM), [dw, dh] = resFor(FL.MAP);
  fl = {vel:dfbo(sw, sh), pres:dfbo(sw, sh), div:fbo(sw, sh), curl:fbo(sw, sh), map:dfbo(dw, dh), sw, sh};
  mapRelax(1, 1);
 }
 let stirredAt = -1e9, stirPageY = 0;
 function splat(x, y, dx, dy, amount){
  if (!fl) return;
  stirredAt = performance.now(); stirPageY = y + scrollY;
  const u = P.splat.u, a = aspect(); gl.useProgram(P.splat.p);
  gl.uniform2f(u.texelSize, 0, 0); gl.uniform1f(u.aspectRatio, a); gl.uniform2f(u.point, x / innerWidth, 1 - y / innerHeight);
  gl.uniform1f(u.radius, (coarse ? .0007 : .0013) * (a > 1 ? a : 1));
  gl.uniform1i(u.uTarget, tex(1, fl.vel.read.t)); gl.uniform4f(u.color, dx, dy, 0, 0); blit(fl.vel.write); fl.vel.swap();
  if (amount > 0) { gl.uniform1i(u.uTarget, tex(1, fl.map.read.t)); gl.uniform4f(u.color, 0, 0, amount, 0); blit(fl.map.write); fl.map.swap() }
 }
 function push(mx, my){
  let dx = mx / innerWidth, dy = -my / innerHeight; const a = aspect();
  if (a < 1) dx *= a; else dy /= a;
  return [dx * FL.FORCE, dy * FL.FORCE];
 }
 function fluidStep(dt, dyeLoss){
  const tx = 1 / fl.sw, ty = 1 / fl.sh, v = fl.vel;
  let u;
  gl.useProgram(P.curl.p); u = P.curl.u; gl.uniform2f(u.texelSize, tx, ty); gl.uniform1i(u.uVelocity, tex(1, v.read.t)); blit(fl.curl);
  gl.useProgram(P.vort.p); u = P.vort.u; gl.uniform2f(u.texelSize, tx, ty); gl.uniform1i(u.uVelocity, tex(1, v.read.t)); gl.uniform1i(u.uCurl, tex(2, fl.curl.t));
  gl.uniform1f(u.curl, FL.CURL); gl.uniform1f(u.dt, dt); blit(v.write); v.swap();
  gl.useProgram(P.div.p); u = P.div.u; gl.uniform2f(u.texelSize, tx, ty); gl.uniform1i(u.uVelocity, tex(1, v.read.t)); blit(fl.div);
  gl.useProgram(P.scale.p); u = P.scale.u; gl.uniform2f(u.texelSize, tx, ty); gl.uniform1i(u.uTexture, tex(1, fl.pres.read.t)); gl.uniform1f(u.value, FL.PR); blit(fl.pres.write); fl.pres.swap();
  gl.useProgram(P.pres.p); u = P.pres.u; gl.uniform2f(u.texelSize, tx, ty); gl.uniform1i(u.uDivergence, tex(2, fl.div.t));
  for (let i = 0; i < FL.IT; i++) { gl.uniform1i(u.uPressure, tex(1, fl.pres.read.t)); blit(fl.pres.write); fl.pres.swap() }
  gl.useProgram(P.grad.p); u = P.grad.u; gl.uniform2f(u.texelSize, tx, ty); gl.uniform1i(u.uPressure, tex(1, fl.pres.read.t)); gl.uniform1i(u.uVelocity, tex(2, v.read.t)); blit(v.write); v.swap();
  gl.useProgram(P.visc.p); u = P.visc.u; gl.uniform2f(u.texelSize, tx, ty); gl.uniform1f(u.uK, FL.VISC);
  for (let i = 0; i < FL.VISC_IT; i++) { gl.uniform1i(u.uVelocity, tex(1, v.read.t)); blit(v.write); v.swap() }
  gl.useProgram(P.advect.p); u = P.advect.u; gl.uniform2f(u.texelSize, tx, ty); gl.uniform1f(u.dt, dt);
  gl.uniform1i(u.uVelocity, tex(1, v.read.t)); gl.uniform1i(u.uSource, 1); gl.uniform1f(u.dissipation, FL.VD); blit(v.write); v.swap();
  gl.useProgram(P.madv.p); u = P.madv.u; gl.uniform2f(u.texelSize, tx, ty); gl.uniform1f(u.dt, dt);
  gl.uniform1i(u.uVelocity, tex(1, v.read.t)); gl.uniform1i(u.uSource, tex(2, fl.map.read.t)); gl.uniform1f(u.dissipation, FL.DD + dyeLoss); blit(fl.map.write); fl.map.swap();
 }

 /* ---------- geometry, reveal and drawing ---------- */
 let sized = '';
 function resize(){
  // Ink is text: render it at the screen's real density so its edges are as sharp as the type around it.
  const dpr = Math.min(devicePixelRatio || 1, coarse ? 2.5 : 3), key = innerWidth + 'x' + dpr;
  // A height-only change (a phone's URL bar showing or hiding) keeps the atlas, the fluid and the painted name.
  if (key === sized && Math.abs(innerHeight * dpr - H) < H * .25) { for (const panel of panels.values()) panel.style = ''; return }
  sized = key; DPR = dpr;
  W = Math.max(1, Math.round(innerWidth * DPR)); H = Math.max(1, Math.round(innerHeight * DPR));
  canvas.width = W; canvas.height = H;
  buildAtlas(); initFluid(); for (const panel of panels.values()) panel.style = '';
 }
 // Layout (transform-free) position inside the panel's host: the mirror inherits the host's transforms natively.
 function boxOf(it){
  let x = 0, y = 0, n = it.el;
  const host = it.panel.host;
  while (n && n !== host) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent }
  if (n !== host) { const r = it.el.getBoundingClientRect(), h = host.getBoundingClientRect(); x = r.left - h.left; y = r.top - h.top }
  return {x, y, w:it.el.offsetWidth, h:it.el.offsetHeight, letter:letterOf.get(it.el) || null};
 }
 const heroHeight = () => document.querySelector('.opening')?.offsetHeight || innerHeight;
 function progressOf(it, g, still){
  if (still) return 1;
  switch (it.mode) {
   case 'full': case 'paint': return it.leave ? drainProgress(scrollY, heroHeight()) : 1;
   case 'enter': return enterProgress(g.y0 / DPR, innerHeight);
   case 'term': { const host = it.el.closest('.reading-word') || it.el, v = parseFloat(host.style.getPropertyValue('--term-progress')); return smooth(ramp(Number.isNaN(v) ? 1 : v, .2, .9)) }
   case 'row': return smooth(it.row);
   default: return 1;
  }
 }
 const colorOf = el => (getComputedStyle(el).color.match(/[\d.]+/g) || [255, 255, 255]).slice(0, 3).map(v => v / 255);

 let drawnAt = 0, frame = 0, last = 0, frames = 0, T = 0, theme = root.dataset.theme === 'light' ? 1 : 0, scrollPrev = scrollY, lost = false, ready = false;
 const pointer = {x:0, y:0, has:false};
 // A page may set --ink-hue (degrees from the site's periwinkle) on <main> to ink in its own colour.
 const hue = (parseFloat(getComputedStyle(document.querySelector('main') || root).getPropertyValue('--ink-hue')) || 0) * Math.PI / 180;
 // A page may set --ink-pal (four colours, darkest to lightest) on <main> to ink in its own tones; read per theme.
 const palette = () => { const v = getComputedStyle(document.querySelector('main') || root).getPropertyValue('--ink-pal').trim().split(/\s+/).filter(c => /^#[0-9a-f]{6}$/i.test(c)); return v.length === 4 ? v.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255)) : null };
 let pal = palette(), palTheme = root.dataset.theme;
 const FLEX = 24;
 function layoutPanel(panel){
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, letters = false;
  for (const it of panel.items) {
   const b = it.box = boxOf(it), c = it.cell;
   if (!c) continue;
   letters = letters || !!b.letter;
   x0 = Math.min(x0, b.x + c.ox); y0 = Math.min(y0, b.y + c.oy); x1 = Math.max(x1, b.x + c.ox + c.cw); y1 = Math.max(y1, b.y + c.oy + c.ch);
  }
  const pad = letters ? FLEX : 2;
  x0 = Math.floor(x0 - pad); y0 = Math.floor(y0 - pad); x1 = Math.ceil(x1 + pad); y1 = Math.ceil(y1 + pad);
  const style = x0 + ',' + y0 + ',' + (x1 - x0) + ',' + (y1 - y0);
  if (style !== panel.style) {
   panel.style = style; panel.x0 = x0; panel.y0 = y0;
   Object.assign(panel.canvas.style, {left:x0 + 'px', top:y0 + 'px', width:(x1 - x0) + 'px', height:(y1 - y0) + 'px'});
   panel.scale = Math.min(DPR, W / Math.max(1, x1 - x0), H / Math.max(1, y1 - y0));
   panel.w = Math.max(1, Math.round((x1 - x0) * panel.scale)); panel.h = Math.max(1, Math.round((y1 - y0) * panel.scale));
   panel.canvas.width = panel.w; panel.canvas.height = panel.h;
  }
  panel.rect = panel.canvas.getBoundingClientRect();
 }
 // Ink that would otherwise appear all at once (full and paint) flows in from its group's origin over FLOW ms the first
 // time it is on screen; the glyphs start in their plain text colour, so the hand-over from HTML text is seamless.
 // Scroll-revealed ink (enter, term, row) already arrives on its own.
 const FLOW = 1100;
 const flowing = (visiblePanels, now) => visiblePanels.some(panel => panel.items.some(it => it.group.arrivedAt && now - it.group.arrivedAt < FLOW));
 function arrival(it, g, still){
  if (still || (it.mode !== 'full' && it.mode !== 'paint')) return 1;
  const group = it.group, now = performance.now();
  if (!group.arrivedAt && g.y1 > 0 && g.y0 < innerHeight * DPR) group.arrivedAt = now;
  return group.arrivedAt ? smooth(clamp((now - group.arrivedAt) / FLOW)) : 0;
 }
 function draw(visiblePanels, still){
  for (const panel of visiblePanels) layoutPanel(panel);
  // Reveal fronts are shared across a group's panels, so group geometry is kept in screen device px.
  const screenBox = it => { const p = it.panel, r = p.rect || p.canvas.getBoundingClientRect(), b = it.box || boxOf(it); return [(r.left + b.x - p.x0) * DPR, (r.top + b.y - p.y0) * DPR, b.w * DPR, b.h * DPR] };
  const groupBox = new Map();
  let row = 0;
  const calls = [];
  for (const panel of visiblePanels) {
   const start = row, k = panel.scale;
   for (const it of panel.items) {
    const box = it.box, c = it.cell, e = it.entry, letter = box && box.letter;
    if (!box || !c || !e || box.w === 0 || row >= MAX_ITEMS) continue;
    let g = groupBox.get(it.group);
    if (!g) {
     let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
     for (const m of it.group) { const [bx, by, bw, bh] = screenBox(m); x0 = Math.min(x0, bx); y0 = Math.min(y0, by); x1 = Math.max(x1, bx + bw); y1 = Math.max(y1, by + bh) }
     const o = it.groupOrigin;
     g = {x0, y0, x1, y1, ox:o === 'left' ? x0 : (x0 + x1) / 2, oy:o === 'bottom' ? y1 : o === 'left' ? y0 + (y1 - y0) * .55 : (y0 + y1) / 2};
     groupBox.set(it.group, g);
    }
    it.progress = Math.min(progressOf(it, g, still), arrival(it, g, still));
    data.set([(box.x - panel.x0) * k, (box.y - panel.y0) * k, it.pivot[0] * k, it.pivot[1] * k,
     (letter ? letter.x : 0) * k, (letter ? letter.y : 0) * k, letter ? letter.rot : 0, 1,
     letter ? letter.sx : 1, letter ? letter.sy : 1, c.ox * k, c.oy * k,
     c.cw * k, c.ch * k, it.mode === 'paint' ? 1 : 0, 0,
     e.uv[0], e.uv[1], e.uv[2], e.uv[3],
     0, 0, 0, 0,
     g.ox, g.oy, it.progress, Math.max(1, g.y1 - g.y0),
     g.x1 - g.x0, g.y1 - g.y0, 0, 0,
     ...colorOf(it.el), 0], row * DATA_W * 4);
    row++;
   }
   calls.push({panel, start, count:row - start});
  }
  for (const it of items) it.box = null;
  for (const panel of visiblePanels) panel.rect = undefined;
  gl.bindTexture(gl.TEXTURE_2D, dataTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, DATA_W, Math.max(1, row), gl.RGBA, gl.FLOAT, data, 0);
  const u = P.ink.u; gl.useProgram(P.ink.p);
  gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uTime, T); gl.uniform1f(u.uTheme, theme); gl.uniform1f(u.uDpr, DPR); gl.uniform1f(u.uScroll, scrollY * DPR); gl.uniform1f(u.uHue, hue);
  if (palTheme !== root.dataset.theme) { palTheme = root.dataset.theme; pal = palette() }
  gl.uniform1f(u.uUsePal, pal ? 1 : 0); if (pal) { gl.uniform3f(u.uPal0, ...pal[0]); gl.uniform3f(u.uPal1, ...pal[1]); gl.uniform3f(u.uPal2, ...pal[2]); gl.uniform3f(u.uPal3, ...pal[3]) }
  gl.uniform1f(u.uFluid, fl && !still ? 1 : 0);
  gl.uniform1i(u.uAtlas, tex(0, atlasTex)); gl.uniform1i(u.uData, tex(2, dataTex));
  if (fl) gl.uniform1i(u.uMap, tex(1, fl.map.read.t));
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.enable(gl.SCISSOR_TEST);
  for (const {panel, start, count} of calls) {
   const r = panel.canvas.getBoundingClientRect();
   gl.viewport(0, H - panel.h, panel.w, panel.h); gl.scissor(0, H - panel.h, panel.w, panel.h);
   gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
   gl.uniform1i(u.uStart, start); gl.uniform1i(u.uCount, count);
   gl.uniform2f(u.uOrigin, r.left * DPR, r.top * DPR); gl.uniform1f(u.uToScreen, DPR / panel.scale);
   gl.drawArrays(gl.TRIANGLES, 0, 3);
   panel.ctx.clearRect(0, 0, panel.w, panel.h);
   panel.ctx.drawImage(canvas, 0, 0, panel.w, panel.h, 0, 0, panel.w, panel.h);
  }
  gl.disable(gl.SCISSOR_TEST);
 }
 function wake(){ if (!frame && !lost && !document.hidden) frame = requestAnimationFrame(tick) }
 // The loop only runs while something changes: a scroll or resize (plus a short tail while the page's own
 // smoothing settles), a stir (the fluid lives 3.5s), the brush, a row easing in or out, a theme fade, or the
 // hero letters / Mind terms that other loops animate. Idle ink is a still image and costs nothing.
 let activeUntil = 0, pokedAt = 0, lastSig = NaN, brushTimer = 0;
 // The fluid lives 3.5s after a stir, but only while the place it was stirred is on screen.
 const stirring = now => now - stirredAt < 3500 && Math.abs(stirPageY - scrollY - innerHeight / 2) < innerHeight;
 function markReady(){ if (!ready) { ready = true; root.classList.add('ink-ready') } }
 function poke(){ pokedAt = performance.now(); activeUntil = pokedAt + 800; wake() }
 function signature(visible){
  let sig = 0;
  for (const panel of visible) for (const it of panel.items) {
   if (it.mode === 'term') sig += parseFloat((it.el.closest('.reading-word') || it.el).style.getPropertyValue('--term-progress')) || 0;
   const l = letterOf.get(it.el); if (l) sig += l.x * 3.1 + l.y * 1.7 + l.rot;
  }
  return sig;
 }
 function tick(now){
  frame = 0; if (lost) return;
  try { step(now) } catch { lost = true; cancelAnimationFrame(frame); frame = 0; clearTimeout(brushTimer); teardown() }
 }
 function step(now){
  const gap = now - last, real = last && gap < 250 ? gap : 16.7, dt = Math.min(real, 50); last = now;
  const still = reduce.matches || root.classList.contains('motion-paused');
  const targetTheme = root.dataset.theme === 'light' ? 1 : 0;
  theme += (targetTheme - theme) * (1 - Math.exp(-dt / 170)); if (Math.abs(targetTheme - theme) < .002) theme = targetTheme;
  const ds = scrollY - scrollPrev; scrollPrev = scrollY;
  let rowsMoving = false;
  for (const it of items) if (it.mode === 'row' && it.row !== it.rowTarget) {
   if (still) { it.row = it.rowTarget; continue }
   const step = real / (it.rowTarget > it.row ? 700 : 450);
   it.row = it.rowTarget > it.row ? Math.min(it.rowTarget, it.row + step) : Math.max(it.rowTarget, it.row - step); rowsMoving = true;
  }
  if (letterOf.size !== heroState.letters.length) refreshLetters();
  const visible = [...panels.values()].filter(panel => panel.items.some(it => it.visible));
  if (!visible.length) { if (observed) markReady(); return }
  moveBrush(now, dt, still);
  if (fl && !still) {
   if (pointer.has && pointer.moved && visible.some(panel => { const r = panel.canvas.getBoundingClientRect(); return pointer.x > r.left - 160 && pointer.x < r.right + 160 && pointer.y > r.top - 160 && pointer.y < r.bottom + 160 })) {
    const [vx, vy] = push(pointer.dx, pointer.dy);
    splat(pointer.x, pointer.y, vx, vy, scrollY < 4 ? Math.min(.6, .15 + Math.hypot(pointer.dx, pointer.dy) * .025) : 0);
   }
   pointer.moved = false;
   slosh(dt);
   const brush = heroState.brush;
   if (brush.on && brush.px !== undefined && scrollY < innerHeight) {
    const mx = brush.x - brush.px, my = brush.y - brush.py;
    if (Math.hypot(mx, my) > .3) { const [vx, vy] = push(mx, my); splat(brush.x, brush.y, vx, vy, scrollY < 4 ? .22 : 0) }
   }
   if (brush.on) { brush.px = brush.x; brush.py = brush.y }
   for (const s of pendingSplats.splice(0)) splat(...s);
   if (stirring(now)) {
    T += dt / 1000; // the marble only flows while the fluid is alive
    fluidStep(Math.min(dt / 1000, 1 / 60), Math.min(3, Math.abs(ds) * .15));
    mapRelax(1 - Math.exp(-dt / 1000 * .35), 0);
   }
  }
  const sig = signature(visible), changed = !(Math.abs(sig - lastSig) < 1e-3); lastSig = sig;
  // With motion off there is no settling tail: one fresh frame per change.
  const active = (still ? pokedAt > drawnAt : now < activeUntil) || (!still && stirring(now)) || rowsMoving || theme !== targetTheme || changed || (!still && ds !== 0) || (!still && flowing(visible, now));
  if (active) { draw(visible, still); drawnAt = now; frames++; markReady(); wake(); return }
  // Idle but on screen: the marble keeps drifting slowly by itself, at a low frame rate.
  if (!still) {
   const every = coarse ? 150 : 80;
   if (now - drawnAt > every) { T += Math.min(real, 200) / 1000 * .45; draw(visible, still); drawnAt = now; frames++; markReady() }
   clearTimeout(brushTimer); brushTimer = setTimeout(wake, every); return;
  }
  // Asleep. On a desktop whose cursor rests over the hero, come back when the auto-brush is due.
  clearTimeout(brushTimer);
  if (!still && !coarse && !heroState.brush.on && scrollY < heroHeight() * .6 && visible.some(panel => panel.items.some(it => letterOf.has(it.el))))
   brushTimer = setTimeout(wake, Math.max(60, pointerAt + 2650 - now));
 }
 const pendingSplats = [];
 /* auto-brush (phones, or an idle desktop cursor) and tilt slosh, as in the v13 prototype */
 let brushT = 0, pointerAt = -1e9;
 const tilt = {gx:0, gy:0, beta:0, gamma:0, rb:0, rg:0, live:false, shown:false, asked:false};
 function moveBrush(now, dt, still){
  const brush = heroState.brush, word = document.querySelector('.first-word');
  const on = !still && !!word && !document.hidden && scrollY < heroHeight() * .6 && now - pointerAt > (coarse ? 1600 : 2600);
  if (on !== brush.on) { brush.on = on; brush.px = undefined; if (on) dispatchEvent(new Event('portfolio-brush')) }
  if (!on) return;
  brushT += dt / 1000;
  const r = word.getBoundingClientRect(), capTop = r.top + r.height * .08, base = r.top + r.height * .9;
  brush.x = r.left + r.width * (.5 + .48 * Math.sin(brushT * .45));
  brush.y = capTop + (base - capTop) * (.5 + .46 * Math.sin(brushT * 1.1 + .6));
 }
 function slosh(dt){
  if (!tilt.live || scrollY > heroHeight()) return;
  const rest = 1 - Math.exp(-dt / 7000), ease = 1 - Math.exp(-dt / 140);
  tilt.rb += (tilt.beta - tilt.rb) * rest; tilt.rg += (tilt.gamma - tilt.rg) * rest;
  tilt.gx += (clamp((tilt.gamma - tilt.rg) / 20, -1, 1) - tilt.gx) * ease;
  tilt.gy += (clamp((tilt.beta - tilt.rb) / 20, -1, 1) - tilt.gy) * ease;
  if (Math.hypot(tilt.gx, tilt.gy) < .05) return;
  if (!tilt.shown && Math.hypot(tilt.gx, tilt.gy) > .25) { tilt.shown = true; document.querySelector('.tilt-hint')?.classList.add('gone') }
  const name = document.querySelector('.elastic-name')?.getBoundingClientRect(), gaur = document.querySelector('.last-word')?.getBoundingClientRect();
  if (!name || !gaur) return;
  const [vx, vy] = push(tilt.gx * 26, tilt.gy * 26);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) splat(name.left + name.width * (.18 + .32 * i), name.top + name.height * (.28 + .44 * j), vx, vy, 0);
  // Pouring up carries ink out of "Gaur." into "Aditya" (painted coverage rides the flow).
  const pour = scrollY < 4 && tilt.gy < -.15 ? .22 * Math.min(1, -tilt.gy) : 0;
  for (let i = 0; i < 4; i++) splat(gaur.left + gaur.width * (.12 + .26 * i), gaur.top + gaur.height * (pour ? .2 : .5), vx * 1.3, vy * 1.3, pour);
 }
 // A held phone reports a constant trickle of tiny tilts; only a real change while the hero is on screen
 // wakes the ink, since slosh only stirs the hero.
 addEventListener('deviceorientation', event => {
  if (event.gamma == null || event.beta == null) return;
  const moved = Math.abs(event.beta - tilt.beta) + Math.abs(event.gamma - tilt.gamma) > .4;
  if (!tilt.live) { tilt.rb = event.beta; tilt.rg = event.gamma }
  tilt.live = true; tilt.beta = event.beta; tilt.gamma = event.gamma;
  if (moved && scrollY < heroHeight()) poke();
 });
 // iOS asks for motion access only inside a user activation, which a touch's end (not its start) grants.
 // A refusal for lack of activation leaves the door open for the next tap; an answer either way closes it.
 const askTilt = () => {
  const request = globalThis.DeviceOrientationEvent?.requestPermission;
  if (tilt.asked || tilt.asking || typeof request !== 'function') return;
  tilt.asking = true;
  try { Promise.resolve(request.call(DeviceOrientationEvent)).then(() => { tilt.asked = true }, () => {}).finally(() => { tilt.asking = false }) } catch { tilt.asking = false }
 };
 if (coarse && globalThis.DeviceOrientationEvent) document.querySelector('.tilt-hint')?.removeAttribute('hidden');
 addEventListener('touchend', askTilt, {passive:true});
 addEventListener('click', askTilt);

 /* ---------- wiring ---------- */
 // Until the observer's first report, "nothing visible" only means "not measured yet".
 let observed = false;
 const io = new IntersectionObserver(entries => { observed = true; for (const entry of entries) { const it = byEl.get(entry.target); if (it) it.visible = entry.isIntersecting } poke() }, {rootMargin:'25% 0px'});
 items.forEach(it => io.observe(it.el));
 let resizeTimer = 0;
 addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(); poke() }, 150) }, {passive:true});
 addEventListener('scroll', poke, {passive:true});
 addEventListener('portfolio-motion', poke);
 document.fonts?.ready.then(() => { buildAtlas(); poke() });
 document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0 } else { last = 0; poke() } });
 new MutationObserver(poke).observe(root, {attributes:true, attributeFilter:['data-theme', 'class']});
 addEventListener('pointermove', event => {
  if (pointer.has) { pointer.dx = event.clientX - pointer.x; pointer.dy = event.clientY - pointer.y; pointer.moved = Math.hypot(pointer.dx, pointer.dy) > .3 && Math.hypot(pointer.dx, pointer.dy) < 300 }
  pointer.x = event.clientX; pointer.y = event.clientY; pointer.has = true; pointerAt = performance.now(); wake();
 }, {passive:true});
 canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; teardown() });

 resize();
 window.portfolioInk = {
  state:() => ({ready, fluid:!!fl, brushOn:heroState.brush.on, frames, items:items.map(it => ({text:it.el.textContent, progress:it.progress, visible:it.visible}))})
 };
 poke();
 return {
  setActive(el, on){ const it = byEl.get(el); if (it && it.mode === 'row') { it.rowTarget = on ? 1 : 0; wake() } },
  splat(x, y, dx, dy){ pendingSplats.push([x, y, dx, dy, 0]); wake() }
 };
}
