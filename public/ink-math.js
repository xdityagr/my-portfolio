// Pure helpers shared by the ink renderer and the section choreography. No DOM.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ramp = (v, a, b) => clamp((v - a) / (b - a));
export const smooth = t => t * t * (3 - 2 * t);
export const enterProgress = (top, viewportH) => smooth(ramp(top, .88 * viewportH, .42 * viewportH));
export const drainProgress = (scrollY, heroH) => 1 - smooth(ramp(scrollY, .04 * heroH, .5 * heroH));
export function packAtlas(cells, maxW){
 const out = [];let x = 0, y = 0, row = 0, width = 0;
 for (const cell of cells){
  if (x > 0 && x + cell.w > maxW){ y += row; x = 0; row = 0 }
  out.push({x, y});x += cell.w;row = Math.max(row, cell.h);width = Math.max(width, x);
 }
 out.width = width;out.height = y + row;
 return out;
}
export const baseline = (top, lineHeight, ascent, descent) => top + (lineHeight - (ascent + descent)) / 2 + ascent;
