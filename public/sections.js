// Home-page section choreography: scroll-linked progress variables, one-shot entrances, the SIH front page and its
// clippings, the toolkit scrollers, and the edge bands. Started by experience.js on the home page.
import {clamp, enterProgress} from './ink-math.js';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)'), coarse = matchMedia('(pointer: coarse)');
const still = () => reduce.matches || root.classList.contains('motion-paused');
const entered = el => enterProgress(el.getBoundingClientRect().top, innerHeight);
const scrubs = [], scrollers = [];
let frame = 0;

function update(){
 frame = 0;
 for (const fn of scrollers) fn(still());
 for (const item of scrubs) if (item.visible) {
  const value = still() ? 1 : Math.round(item.progress(item.el) * 1000) / 1000;
  item.el.style.setProperty(item.prop, String(value));
  item.apply?.(value);
 }
}
const schedule = () => { if (!frame) frame = requestAnimationFrame(update) };

const scrubIO = new IntersectionObserver(entries => {
 for (const entry of entries) { const item = scrubs.find(s => s.el === entry.target); if (item) item.visible = entry.isIntersecting }
 schedule();
}, {rootMargin:'20% 0px'});

// Writes progress (0..1) to a CSS variable on el while it is near the viewport (1 when motion is off), then
// hands the value to apply() for anything CSS cannot do alone.
function scrub(el, prop, progress = entered, apply){
 if (!el) return;
 scrubs.push({el, prop, progress, apply, visible:false});
 scrubIO.observe(el);
}

// ---------- shared images ----------
// Value noise and fbm for the two still images the page needs (the live ink is WebGL; these only need a still).
const noise = seed => {
 const p = new Uint8Array(512), a = [...Array(256).keys()];
 let r = seed * 9301 + 49297;
 for (let i = 255; i > 0; i--) { r = (r * 9301 + 49297) % 233280; const j = Math.floor(r / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
 for (let i = 0; i < 512; i++) p[i] = a[i & 255];
 const v = (x, y) => p[p[x & 255] + (y & 255)] / 255, f = t => t * t * (3 - 2 * t);
 return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = f(x - xi), w = f(y - yi), a0 = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1); return a0 + (b - a0) * u + (c - a0) * w + (a0 - b - c + d) * u * w };
};
const fbm = (n, x, y) => { let s = 0, a = .5, f = 1, t = 0; for (let i = 0; i < 4; i++) { s += a * n(x * f, y * f); t += a; a *= .5; f *= 2.03 } return s / t };
const image = (w, h, pixel) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pixel(x, y, img.data, (y * w + x) * 4); ctx.putImageData(img, 0, 0); return cv.toDataURL() };
// The grainy ink front (the Selected Work reveal's layered grain) as a wide mask: opaque, a ragged front in the
// middle third, then clear. CSS slides it across to soak ink into the pressed headline and into Fig. 1.
function inkEdge(){
 const n = noise(9);
 root.style.setProperty('--ink-edge', 'url(' + image(1200, 150, (x, y, d, o) => {
  const px = x / 150, py = y / 150, g = n(px * 3, py * 3) * .17 + n(px * 8, py * 8) * .065 + n(px * 19, py * 19) * .018;
  d[o + 3] = 255 * (1 - clamp((x / 1200 + (g - .125) * .42 - .5 + .012) / .024));
 }) + ')');
}
// The site's marble (the same domain-warped field and palettes as the ink shader), as a still image.
function marble(light){
 const n = noise(11), sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
 const c0 = light ? [.24, .30, .90] : [.12, .10, .36], c1 = light ? [.36, .42, .92] : [.45, .50, 1], c2 = light ? [.42, .54, .94] : [.74, .84, 1], c3 = light ? [.80, .40, .74] : [.86, .58, .84];
 return image(320, 120, (x, y, d, o) => {
  const px = x / 320 * 4.2, py = y / 120 * 1.6, qx = fbm(n, px, py), qy = fbm(n, px + 5.2, py + 1.3);
  const rx = fbm(n, px + 3.5 * qx + 1.7, py + 3.5 * qy + 9.2), ry = fbm(n, px + 3.5 * qx + 8.3, py + 3.5 * qy + 2.8), f = fbm(n, px + 3.5 * rx, py + 3.5 * ry);
  let c = mix(c0, c1, sm(.28, .62, f)); c = mix(c, c2, sm(.5, .8, qy) * .85); c = mix(c, c3, sm(.52, .78, rx) * .7);
  if (!light) c = mix(c, [.99, .98, 1], sm(.7, .86, f) * .5);
  d[o] = c[0] * 255; d[o + 1] = c[1] * 255; d[o + 2] = c[2] * 255; d[o + 3] = 255;
 });
}

// ---------- SIH: the front page ----------
// The headline soaks up ink as it rises up the screen (fully inked with motion off).
function press(wrap){
 if (!wrap) return;
 wrap.style.setProperty('--p', still() ? '1' : '0');
 scrub(wrap, '--p', el => { const r = el.getBoundingClientRect(); return clamp((innerHeight * .82 - r.top) / (innerHeight * .5)) });
}
// The interview: words rise into place, the quote mark sits on a deeper layer, the build column's rules draw and
// the funding counts up.
function interview(box){
 if (!box) return;
 const words = box.querySelector('.words'), quote = box.querySelector('.hugequote');
 let k = 0;
 const out = document.createDocumentFragment();
 for (const node of [...words.childNodes]) {
  for (const piece of node.nodeType === 3 ? node.textContent.split(/(\s+)/) : [node]) {
   if (typeof piece === 'string' && !piece.trim()) { if (piece) out.append(piece); continue }
   const w = document.createElement('span'), inner = document.createElement('span');
   w.className = 'w'; w.style.setProperty('--k', k++); inner.append(piece); w.append(inner); out.append(w);
  }
 }
 words.replaceChildren(out);
 const fund = box.querySelector('.fund-box .count');
 if (still()) return;
 box.classList.add('armed');
 new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); box.classList.add('in') } }, {threshold:.25}).observe(box);
 new IntersectionObserver(([e], o) => { if (!e.isIntersecting) return; o.disconnect(); setTimeout(() => rupees(fund, 75000, 1600), 500) }, {threshold:.6}).observe(fund);
 scrollers.push(off => {
  if (off) { quote.style.removeProperty('--depth'); return }
  const q = quote.getBoundingClientRect();
  if (q.bottom < -innerHeight || q.top > innerHeight * 2) return;
  quote.style.setProperty('--depth', clamp((q.top + q.height / 2 - innerHeight / 2) / innerHeight, -1, 1).toFixed(4));
 });
}
function rupees(el, to, ms){
 const t0 = performance.now();
 const step = now => { const t = clamp((now - t0) / ms), e = 1 - Math.pow(1 - t, 3); el.textContent = '₹' + Math.round(to * e).toLocaleString('en-IN'); if (t < 1) requestAnimationFrame(step) };
 el.textContent = '₹0'; requestAnimationFrame(step);
}
// Fig. 1: the marble fill is painted per theme; the drawing soaks in on arrival and the alert marker appears as the
// ink front passes the crossing.
function reading(fig){
 if (!fig) return;
 const paint = () => { const url = marble(root.dataset.theme === 'light'); fig.querySelectorAll('image.marble').forEach(img => img.setAttribute('href', url)) };
 paint();
 new MutationObserver(paint).observe(root, {attributes:true, attributeFilter:['data-theme']});
 if (still()) { fig.classList.add('alerted'); return }
 fig.classList.add('armed');
 const cross = +fig.dataset.cross || .6;
 new IntersectionObserver(([e], o) => { if (!e.isIntersecting) return; o.disconnect(); fig.classList.add('drawn'); setTimeout(() => fig.classList.add('alerted'), 2400 * Math.min(.92, cross * .86 + .08)) }, {threshold:.45}).observe(fig);
}
// Clippings fall in as they reach the reader (those arriving together land left to right, a beat apart) and, under
// a fine pointer, turn toward the cursor and lift, with the light following the pointer across the paper.
function clippings(board){
 if (!board || still()) return;
 const clips = [...board.children];
 board.classList.add('armed');
 const io = new IntersectionObserver(entries => {
  const arriving = entries.filter(e => e.isIntersecting).map(e => e.target).sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.top - rb.top || ra.left - rb.left });
  arriving.forEach((clip, k) => { clip.style.setProperty('--delay', (k * .1).toFixed(2) + 's'); clip.classList.add('in'); io.unobserve(clip) });
 }, {rootMargin:'0px 0px -10% 0px'});
 clips.forEach(clip => io.observe(clip));
 if (!fine.matches) return;
 for (const clip of clips) {
  let settle = 0;
  clip.addEventListener('pointermove', e => {
   const r = clip.getBoundingClientRect(), x = clamp((e.clientX - r.left) / r.width), y = clamp((e.clientY - r.top) / r.height);
   clearTimeout(settle); clip.classList.remove('settling'); clip.classList.add('lifted');
   clip.style.setProperty('--ty', ((x - .5) * 16).toFixed(2) + 'deg'); clip.style.setProperty('--tx', ((.5 - y) * 12).toFixed(2) + 'deg'); clip.style.setProperty('--tz', '40px');
   clip.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); clip.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  });
  clip.addEventListener('pointerleave', () => {
   clip.classList.remove('lifted'); clip.classList.add('settling'); for (const v of ['--tx', '--ty', '--tz']) clip.style.removeProperty(v);
   settle = setTimeout(() => clip.classList.remove('settling'), 400);
  });
 }
}

// ---------- edge bands ----------
// The page rolls over a barrel at the top and bottom of the screen. Each edge band warps only what lies behind it
// (backdrop-filter with an SVG displacement map); the page itself is never transformed. From the band's inner edge the
// page bends away with a turn that grows as (s/H)², so the curvature eases in from zero (no crease where the bend
// starts) and steepens toward the edge: rows bunch up, and their depth narrows them slightly toward the middle in
// perspective. The band shows exactly its own strip of page, so nothing is sampled from off screen; past the barrel's
// horizon it is solid page colour, and its shading follows the turn (and stands in alone where the warp is
// unsupported). Bands are short on phones and come in once the page moves, so the opening screen stays clean.
function edges(){
 const sides = ['top', 'bottom'];
 const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
 svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
 svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
 svg.innerHTML = '<defs>' + sides.map(side => '<filter id="drum-' + side + '" x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feImage result="map" x="0" y="0" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G"/></filter>').join('') + '</defs>';
 document.body.append(svg);
 const bands = sides.map(side => {
  const band = document.createElement('div');
  band.className = 'edge-band ' + side; band.setAttribute('aria-hidden', 'true');
  document.body.append(band);
  return {top:side === 'top', band, image:svg.querySelector('#drum-' + side + ' feImage'), map:svg.querySelector('#drum-' + side + ' feDisplacementMap')};
 });
 const narrow = matchMedia('(max-width: 700px)');
 // How a band H px deep bends: for each row t out from the bend, how much further along the page it reaches (dy), how
 // much it narrows about the middle (k, with perspective distance P), and the shading stops measured from the screen edge.
 const TURN = 1.3;
 const profile = (H, P) => {
  const n = H * 8, ds = H / n, march = [{s:0, y:0, z:0}];
  for (let i = 1, y = 0, z = 0; i <= n; i++) { const ph = TURN * (((i - .5) * ds) / H) ** 2; y += Math.cos(ph) * ds; z += Math.sin(ph) * ds; march.push({s:i * ds, y, z}) }
  const drum = march[n].y, rows = [];
  for (let t = 0, j = 0; t < H; t++) {
   const c = t + .5;
   if (c > drum) { rows.push({dy:0, k:0, ph:TURN}); continue }
   while (march[j + 1].y < c) j++;
   const a = march[j], b = march[j + 1], f = (c - a.y) / (b.y - a.y || 1), at = a.s + (b.s - a.s) * f;
   rows.push({dy:at - c, k:(a.z + (b.z - a.z) * f) / P, ph:TURN * (at / H) ** 2});
  }
  // The further the surface has turned from the viewer, the more page colour covers it; over the outer part of the
  // drum that eases all the way into solid (with no slope where it meets it), so even bright artwork never shows a cut.
  const shade = t => {
   const turned = Math.pow((1 - Math.cos(rows[Math.min(H - 1, Math.round(t))].ph)) / (1 - Math.cos(TURN)), .65);
   const x = clamp((t / drum - .55) / .45), roll = x * x * (3 - 2 * x);
   return 1 - (1 - turned) * (1 - roll);
  };
  const stops = ['var(--bg) 0px', 'var(--bg) ' + (H - drum).toFixed(1) + 'px'];
  for (const f of [.99, .97, .94, .9, .85, .8, .72, .62, .5, .4, .28, .14, 0]) stops.push('color-mix(in srgb,var(--bg) ' + (shade(drum * f) * 100).toFixed(1) + '%,transparent) ' + (H - drum * f).toFixed(1) + 'px');
  return {H, rows, stops:stops.join(',')};
 };
 const shape = () => {
  const W = innerWidth, V = innerHeight;
  const {H, rows, stops} = profile(Math.round(V * (narrow.matches ? .18 : .22)), V * 3);
  const scale = Math.ceil(Math.max(...rows.map(r => Math.max(r.dy, r.k * W / 2))) * 2 + 4);
  for (const b of bands) {
   // The map is 64 px across (the narrowing is linear there, so it stretches cleanly) by H px deep; the top band's
   // first row is at the screen edge, the bottom band's at the bend.
   const cv = document.createElement('canvas'); cv.width = 64; cv.height = H;
   const ctx = cv.getContext('2d'), img = ctx.createImageData(64, H);
   for (let y = 0; y < H; y++) for (let x = 0; x < 64; x++) {
    const r = rows[b.top ? H - 1 - y : y], i = (y * 64 + x) * 4;
    img.data[i] = Math.round(clamp(.5 + ((x + .5) / 64 - .5) * W * r.k / scale) * 255); img.data[i + 1] = Math.round(clamp(.5 + (b.top ? -r.dy : r.dy) / scale) * 255); img.data[i + 3] = 255;
   }
   ctx.putImageData(img, 0, 0);
   b.image.setAttribute('href', cv.toDataURL()); b.image.setAttribute('width', W); b.image.setAttribute('height', H);
   b.map.setAttribute('scale', scale);
   b.band.style.setProperty('--edge-h', H + 'px'); b.band.style.setProperty('--edge-fade', stops);
  }
 };
 shape();
 let timer = 0;
 addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(shape, 150) }, {passive:true});
 scrollers.push(() => root.classList.toggle('scrolled', scrollY > innerHeight * .08));
 schedule();
}

// Counts each number up from 0 (years from 2000) once it is on screen. The animated copy is aria-hidden;
// screen readers read the sr-only final value beside it.
function countUp(els){
 if (!els.length || still()) return;
 const parts = els.map(el => { const [, digits, suffix] = el.textContent.match(/^(\d+)(.*)$/) || []; return digits && {el, to:+digits, from:+digits >= 1900 ? 2000 : 0, suffix} }).filter(Boolean);
 for (const p of parts) p.el.textContent = p.from + p.suffix;
 const io = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  io.disconnect();
  const start = performance.now();
  const step = now => {
   const t = Math.min(1, (now - start) / 1200), e = 1 - Math.pow(1 - t, 3);
   for (const p of parts) p.el.textContent = Math.round(p.from + (p.to - p.from) * e) + p.suffix;
   if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
 }, {threshold:.6});
 io.observe(els[0].closest('.person-facts'));
}

// Story timeline: --tl is how far the reading line (62% down the screen) has travelled through the list;
// each entry it passes fills its node and fades its text up.
function timeline(list){
 if (!list) return;
 const entries = [...list.children];
 if (!still()) list.classList.add('is-armed');
 const reach = (li, on) => { if (li.classList.contains('is-reached') !== on) li.classList.toggle('is-reached', on) };
 scrub(list, '--tl', el => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, (innerHeight * .62 - r.top) / r.height)) },
  value => { const h = list.offsetHeight; for (const li of entries) reach(li, value * h >= li.offsetTop + 12) });
}

// Toolkit specimen: each row is a real horizontal scroller (swipe, trackpad, or drag with the mouse) that drifts on its
// own, rows 2 and 4 the other way, and pauses while you handle it. Three copies of each row keep the loop seamless:
// once the row rests, the view is moved back into the middle copy. The hovered/focused name (or on touch, the name
// drifting through the centre) becomes active and the caption shows its note and related project.
function specimen(box, caption){
 if (!box || !caption) return;
 let current = null, timer = 0;
 const show = name => {
  if (!name || name === current) return;
  current?.classList.remove('is-active'); current = name; name.classList.add('is-active');
  const title = document.createElement('strong'); title.textContent = name.textContent;
  caption.replaceChildren(title, ': ' + name.dataset.note);
  if (name.dataset.projectSlug) { const link = document.createElement('a'); link.href = '/work/' + name.dataset.projectSlug + '/'; link.textContent = name.dataset.project + ' ↗'; caption.append(' Related: ', link) }
 };
 box.addEventListener('pointerover', event => { if (event.pointerType === 'mouse') show(event.target.closest('.specimen-name')) });
 box.addEventListener('focusin', event => show(event.target.closest('.specimen-name')));
 const rows = [...box.querySelectorAll('.specimen-row')].map(row => ({row, vp:row.querySelector('.specimen-viewport'), set:row.querySelector('.specimen-set'), dir:row.classList.contains('is-reverse') ? -1 : 1, held:false, quietAt:0, pos:0, own:false, drag:null, dragged:false}));
 const width = r => r.set.offsetWidth;
 const place = r => { r.vp.scrollLeft = r.pos = width(r) };
 const settle = r => { const w = width(r), x = r.vp.scrollLeft; if (x < w * .5 || x > w * 1.5) { r.own = true; r.vp.scrollLeft = r.pos = x + (x < w * .5 ? w : -w) } };
 for (const r of rows) {
  place(r);
  const hold = () => { r.held = true }, free = () => { r.held = false; r.quietAt = performance.now() };
  r.vp.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hold() });
  r.vp.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !r.drag) free() });
  r.vp.addEventListener('touchstart', hold, {passive:true});
  r.vp.addEventListener('touchend', free, {passive:true});
  r.vp.addEventListener('focusin', hold);
  r.vp.addEventListener('focusout', free);
  r.vp.addEventListener('scroll', () => { if (!r.own) r.quietAt = performance.now(); r.own = false; r.pos = r.vp.scrollLeft }, {passive:true});
  // Mouse drag, with a little momentum on release; a drag never counts as a click on a name.
  r.vp.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0) return; r.drag = {x:e.clientX, left:r.vp.scrollLeft, v:0, t:performance.now()}; r.dragged = false; r.vp.setPointerCapture(e.pointerId) });
  r.vp.addEventListener('pointermove', e => {
   if (!r.drag) return;
   const dx = e.clientX - r.drag.x, now = performance.now();
   if (Math.abs(dx) > 4) { r.dragged = true; r.vp.classList.add('dragging') }
   const next = r.drag.left - dx; r.drag.v = (next - r.vp.scrollLeft) / Math.max(1, now - r.drag.t); r.drag.t = now; r.vp.scrollLeft = next;
  });
  r.vp.addEventListener('pointerup', e => {
   if (!r.drag) return;
   let v = r.drag.v * 16; r.drag = null; r.vp.classList.remove('dragging');
   const glide = () => { if (Math.abs(v) < .3) { r.quietAt = performance.now(); return } r.vp.scrollLeft += v; v *= .94; requestAnimationFrame(glide) };
   glide(); if (!r.vp.matches(':hover')) free();
  });
  r.vp.addEventListener('click', e => { if (r.dragged) { e.preventDefault(); e.stopPropagation(); r.dragged = false } }, true);
 }
 let frame = 0, last = 0, visible = false, pageScrolledAt = 0;
 addEventListener('scroll', () => { pageScrolledAt = performance.now() }, {passive:true});
 const tick = now => {
  frame = 0;
  const dt = last ? Math.min(now - last, 60) : 16; last = now;
  for (const r of rows) {
   // Rows hold still while the page itself is scrolling, so the two never compete for the frame.
   const quiet = !r.held && !r.drag && now - r.quietAt > 1400 && now - pageScrolledAt > 250;
   if (quiet && !still()) { r.pos += r.dir * width(r) / (parseFloat(getComputedStyle(r.row).getPropertyValue('--dur')) || 40) * dt / 1000; r.own = true; r.vp.scrollLeft = r.pos }
   if (!r.drag && !r.held && now - r.quietAt > 250) settle(r);
  }
  if (visible) frame = requestAnimationFrame(tick); else last = 0;
 };
 new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible && !frame) frame = requestAnimationFrame(tick) }).observe(box);
 document.fonts?.ready.then(() => rows.forEach(place));
 const centred = () => {
  if (still()) return;
  const mid = innerHeight / 2;
  const row = rows.map(r => r.row).reduce((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(rb.top + rb.height / 2 - mid) < Math.abs(ra.top + ra.height / 2 - mid) ? b : a });
  let best = null, gap = Infinity;
  for (const name of row.querySelectorAll('.specimen-name')) { const r = name.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - innerWidth / 2); if (d < gap) { gap = d; best = name } }
  show(best);
 };
 new IntersectionObserver(([entry]) => {
  clearInterval(timer); timer = 0;
  if (entry.isIntersecting && !fine.matches) timer = setInterval(centred, 400);
 }).observe(box);
}

export function initSections(){
 inkEdge();
 press(document.querySelector('.headline-wrap'));
 interview(document.getElementById('interview'));
 reading(document.getElementById('reading'));
 clippings(document.querySelector('.board'));
 const route = document.querySelector('.person-locations');
 const path = route?.querySelector('.route-path'), dot = route?.querySelector('.route-dot');
 if (path && dot) scrub(route, '--route', entered, value => { const at = path.getPointAtLength(value * path.getTotalLength()); dot.setAttribute('cx', at.x.toFixed(1)); dot.setAttribute('cy', at.y.toFixed(1)) });
 countUp([...document.querySelectorAll('.person-facts .count')]);
 timeline(document.querySelector('.ink-timeline'));
 specimen(document.querySelector('.specimen'), document.querySelector('.specimen-caption'));
 edges();

 addEventListener('scroll', schedule, {passive:true});
 addEventListener('resize', schedule, {passive:true});
 addEventListener('portfolio-motion', schedule);
 reduce.addEventListener?.('change', schedule);
 schedule();
}
