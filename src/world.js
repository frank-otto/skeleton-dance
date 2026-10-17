// Moonlit graveyard: a cracked flagstone dance floor in the middle, a half ring of graves (each one a skeleton's
// spawn point), a columned crypt, gnarled dead trees, an iron fence, lanterns, a huge moon behind drifting clouds,
// layered ground fog, wisps, and stage lights that sweep on the beat. Emissive parts stay below the bloom threshold.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const QUALITY = {
  low: { dpr: 1, shadows: false, bloom: .7, parts: .45, fog: 3 },
  mid: { dpr: 1.25, shadows: true, shadowSize: 1024, bloom: 1, parts: .75, fog: 5 },
  high: { dpr: 1.6, shadows: true, shadowSize: 2048, bloom: 1, parts: 1, fog: 6 },
  ultra: { dpr: 2, shadows: true, shadowSize: 2048, bloom: 1, parts: 1.35, fog: 7 }
};
export function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, srgb = true, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } t.anisotropy = 8; return t; };
export function softTexture() { const [c, g] = cv(128, 128); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
function smokeTexture(seed = 5) { const [c, g] = cv(256, 256); const r = rnd(seed); for (let i = 0; i < 30; i++) { const x = 128 + (r() - .5) * 120, y = 128 + (r() - .5) * 120, s = 30 + r() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); } return new THREE.CanvasTexture(c); }
// value noise helper for textures
function noise2(seed) { const r = rnd(seed), N = 64, v = new Float32Array(N * N); for (let i = 0; i < N * N; i++) v[i] = r();
  const f = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = t => t * t * (3 - 2 * t); const a = v[((yi & 63) * N) + (xi & 63)], b = v[((yi & 63) * N) + ((xi + 1) & 63)], c = v[(((yi + 1) & 63) * N) + (xi & 63)], d = v[(((yi + 1) & 63) * N) + ((xi + 1) & 63)]; return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf); };
  return (x, y) => f(x, y) * .5 + f(x * 2.1, y * 2.1) * .3 + f(x * 4.3, y * 4.3) * .2; }
// height canvas -> normal map canvas
function normalFrom(hc, strength = 2) { const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data; const [c, g] = cv(w, h); const im = g.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength; const l = Math.hypot(dx, dy, 1); const i = (y * w + x) * 4; im.data[i] = (-dx / l * .5 + .5) * 255; im.data[i + 1] = (dy / l * .5 + .5) * 255; im.data[i + 2] = (1 / l * .5 + .5) * 255; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); return c; }
function groundTextures(seed) { // mossy soil with grass tufts
  const S = 512, [c, g] = cv(S, S), [hc, hg] = cv(S, S), n = noise2(seed), r = rnd(seed + 1); const im = g.createImageData(S, S), hm = hg.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = n(x / 32, y / 32), m = n(x / 90 + 7, y / 90 + 3); const i = (y * S + x) * 4; const grass = m > .5;
    im.data[i] = grass ? 22 + v * 22 : 40 + v * 30; im.data[i + 1] = grass ? 34 + v * 30 : 30 + v * 22; im.data[i + 2] = grass ? 26 + v * 16 : 28 + v * 18; im.data[i + 3] = 255; const hh = v * 200; hm.data[i] = hm.data[i + 1] = hm.data[i + 2] = hh; hm.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); hg.putImageData(hm, 0, 0);
  for (let k = 0; k < 2600; k++) { const x = r() * S, y = r() * S, L = 3 + r() * 9; g.strokeStyle = `rgba(${40 + r() * 30},${60 + r() * 40},${40 + r() * 20},${.35 + r() * .4})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 4, y - L); g.stroke(); hg.strokeStyle = 'rgba(255,255,255,.4)'; hg.beginPath(); hg.moveTo(x, y); hg.lineTo(x, y - L); hg.stroke(); }
  return { map: tex(c, true, [14, 14]), normal: tex(normalFrom(hc, 3), false, [14, 14]) };
}
function flagTextures(seed) { // circular flagstone plaza: radial rings of worn stones, moss in the joints, a sun/moon inlay
  const S = 1024, [c, g] = cv(S, S), [hc, hg] = cv(S, S), [rc, rg] = cv(S, S), r = rnd(seed), n = noise2(seed + 3);
  g.fillStyle = '#1c1a1e'; g.fillRect(0, 0, S, S); hg.fillStyle = '#000'; hg.fillRect(0, 0, S, S); rg.fillStyle = '#fff'; rg.fillRect(0, 0, S, S);
  const cx = S / 2; const rings = [[0, 70, 1], [74, 170, 8], [174, 290, 14], [294, 400, 20], [404, 508, 26]];
  for (const [r0, r1, k] of rings) for (let i = 0; i < k; i++) { const a0 = i / k * Math.PI * 2 + (r0 ? r() * .05 : 0), a1 = (i + 1) / k * Math.PI * 2 - .012 * (r0 ? 1 : 0); const l = 30 + r() * 18, hue = 250 + r() * 30;
    g.fillStyle = `hsl(${hue},${6 + r() * 6}%,${l * .62}%)`; g.beginPath(); if (!r0) g.arc(cx, cx, r1, 0, 7); else { g.arc(cx, cx, r1 - 3, a0, a1); g.arc(cx, cx, r0 + 3, a1, a0, true); } g.closePath(); g.fill();
    hg.fillStyle = `rgb(${150 + r() * 80},0,0)`; hg.beginPath(); if (!r0) hg.arc(cx, cx, r1, 0, 7); else { hg.arc(cx, cx, r1 - 4, a0, a1); hg.arc(cx, cx, r0 + 4, a1, a0, true); } hg.closePath(); hg.fill();
    rg.fillStyle = `rgb(${120 + r() * 70},0,0)`; rg.beginPath(); if (!r0) rg.arc(cx, cx, r1, 0, 7); else { rg.arc(cx, cx, r1 - 3, a0, a1); rg.arc(cx, cx, r0 + 3, a1, a0, true); } rg.closePath(); rg.fill(); }
  // grime and moss
  const im = g.getImageData(0, 0, S, S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, v = n(x / 40, y / 40); im.data[i] *= .75 + v * .45; im.data[i + 1] *= .78 + v * .5; im.data[i + 2] *= .75 + v * .4; } g.putImageData(im, 0, 0);
  for (let k = 0; k < 900; k++) { const a = r() * 6.28, rr = 70 + r() * 440; g.fillStyle = `rgba(40,${60 + r() * 30},30,${.15 + r() * .25})`; g.beginPath(); g.arc(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr, 2 + r() * 7, 0, 7); g.fill(); }
  // inlay: crescent moon and a ring of runes, worn
  g.strokeStyle = 'rgba(150,140,120,.55)'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cx, 160, 0, 7); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(cx, cx, 145, 0, 7); g.stroke();
  g.fillStyle = 'rgba(160,150,125,.45)'; g.beginPath(); g.arc(cx, cx, 52, 0, 7); g.fill(); g.fillStyle = '#16141a'; g.beginPath(); g.arc(cx + 20, cx - 8, 46, 0, 7); g.fill();
  g.font = '700 26px serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(160,150,125,.5)'; const RU = '☽✦☾✧♄♃☿♁'; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.save(); g.translate(cx + Math.cos(a) * 153, cx + Math.sin(a) * 153 + 9); g.rotate(a + Math.PI / 2); g.fillText(RU[i % 8], 0, 0); g.restore(); }
  // cracks
  g.strokeStyle = 'rgba(0,0,0,.6)'; hg.strokeStyle = '#000'; for (let k = 0; k < 40; k++) { let x = r() * S, y = r() * S; g.lineWidth = hg.lineWidth = 1 + r() * 1.5; g.beginPath(); hg.beginPath(); g.moveTo(x, y); hg.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - .5) * 50; y += (r() - .5) * 50; g.lineTo(x, y); hg.lineTo(x, y); } g.stroke(); hg.stroke(); }
  return { map: tex(c), normal: tex(normalFrom(hc, 6), false), rough: tex(rc, false) };
}
function stoneTex(seed, tone = '#4a4650') { const S = 512, [c, g] = cv(S, S), [hc, hg] = cv(S, S), n = noise2(seed), r = rnd(seed); const base = new THREE.Color(tone); const im = g.createImageData(S, S), hm = hg.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = n(x / 24, y / 24), m = n(x / 70 + 5, y / 70); const i = (y * S + x) * 4; const moss = Math.max(0, m - .58) * 3; im.data[i] = (base.r * (0.7 + v * .5) * (1 - moss) + .12 * moss) * 255; im.data[i + 1] = (base.g * (0.7 + v * .5) * (1 - moss) + .2 * moss) * 255; im.data[i + 2] = (base.b * (0.7 + v * .5) * (1 - moss) + .1 * moss) * 255; im.data[i + 3] = 255; hm.data[i] = hm.data[i + 1] = hm.data[i + 2] = v * 255; hm.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); hg.putImageData(hm, 0, 0); for (let k = 0; k < 30; k++) { let x = r() * S, y = r() * S; g.strokeStyle = 'rgba(0,0,0,.45)'; hg.strokeStyle = '#000'; g.lineWidth = hg.lineWidth = 1.2; g.beginPath(); hg.beginPath(); g.moveTo(x, y); hg.moveTo(x, y); for (let s = 0; s < 5; s++) { x += (r() - .5) * 30; y += r() * 25; g.lineTo(x, y); hg.lineTo(x, y); } g.stroke(); hg.stroke(); }
  return { map: tex(c), normal: tex(normalFrom(hc, 4), false) }; }
function barkTex(seed) { const [c, g] = cv(256, 512), r = rnd(seed); g.fillStyle = '#1a1412'; g.fillRect(0, 0, 256, 512); for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(${r() < .5 ? '0,0,0' : '70,58,50'},${.3 + r() * .4})`; g.lineWidth = 1 + r() * 3; g.beginPath(); let x = r() * 256, y = 0; g.moveTo(x, y); while (y < 512) { y += 20 + r() * 30; x += (r() - .5) * 8; g.lineTo(x, y); } g.stroke(); } return tex(c, true, [2, 2]); }
function crackTexture(seed) { const [c, g] = cv(512, 512), r = rnd(seed); g.lineCap = 'round';
  const branch = (x, y, a, L, w, d) => { if (d > 5 || w < .6) return; let px = x, py = y; for (let s = 0; s < 6; s++) { const nx = px + Math.cos(a) * L / 6, ny = py + Math.sin(a) * L / 6; g.lineWidth = w; g.strokeStyle = 'rgba(255,190,90,1)'; g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke(); px = nx; py = ny; a += (r() - .5) * .6; if (r() < .25) branch(px, py, a + (r() < .5 ? -1 : 1) * (.5 + r() * .7), L * .55, w * .6, d + 1); } };
  for (let k = 0; k < 9; k++) branch(256, 256, k / 9 * Math.PI * 2 + r() * .3, 150 + r() * 80, 7, 0);
  const t = new THREE.CanvasTexture(c); return t; }
function moonTexture() { const [c, g] = cv(512, 512); const r = rnd(42), n = noise2(77); const im = g.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) { const dx = x - 256, dy = y - 256, d = Math.hypot(dx, dy) / 200; const i = (y * 512 + x) * 4; if (d < 1) { const v = n(x / 40, y / 40), limb = Math.sqrt(1 - d * d); const l = (.62 + v * .3) * (.55 + .45 * limb); im.data[i] = 225 * l; im.data[i + 1] = 228 * l; im.data[i + 2] = 236 * l; im.data[i + 3] = 255; }
    else { const h = Math.max(0, 1 - (d - 1) / 1.5); im.data[i] = 150; im.data[i + 1] = 160; im.data[i + 2] = 210; im.data[i + 3] = 255 * h * h * .35; } }
  g.putImageData(im, 0, 0); for (let k = 0; k < 18; k++) { const a = r() * 6.28, rr = r() * 170, s = 6 + r() * 26; g.fillStyle = `rgba(60,62,80,${.12 + r() * .15})`; g.beginPath(); g.arc(256 + Math.cos(a) * rr, 256 + Math.sin(a) * rr, s, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function cloudTexture(seed) { const [c, g] = cv(512, 256), r = rnd(seed); for (let i = 0; i < 60; i++) { const x = 60 + r() * 392, y = 90 + r() * 90 - Math.abs(x - 256) * .1, s = 30 + r() * 70; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256); } return new THREE.CanvasTexture(c); }

export const FLOOR_R = 4.3;
export function createWorld(renderer, q, seed = 9) {
  const W = { scene: new THREE.Scene(), soft: softTexture(), smokeTex: smokeTexture(), t: 0, colliders: [], graves: [], lanterns: [], fogs: [], clouds: [], cracks: [], wisps: null, flash: 0, react: 0, beat: 0 };
  const S = W.scene; S.background = new THREE.Color('#06070f'); S.fog = new THREE.FogExp2('#0b0d1a', .032);
  const r = rnd(seed);
  // sky dome with a vertical gradient + stars
  { const [c, g] = cv(1024, 512); const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#04050c'); gr.addColorStop(.55, '#0c1028'); gr.addColorStop(.8, '#1a1838'); gr.addColorStop(1, '#141226'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 900; i++) { const y = r() * 330, a = r() * r() * .9; g.fillStyle = `rgba(220,225,255,${a})`; g.fillRect(r() * 1024, y, r() < .1 ? 2 : 1, r() < .1 ? 2 : 1); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false })); sky.position.y = -8; S.add(sky); W.sky = sky; }
  // moon + halo
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: moonTexture(), transparent: true, fog: false, depthWrite: false, color: '#c9cde0' })); m.position.set(6, 15, -48); m.lookAt(0, 2, 8); S.add(m); W.moonDisc = m; }
  for (let i = 0; i < 6; i++) { const cl = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), new THREE.MeshBasicMaterial({ map: cloudTexture(seed + i), transparent: true, opacity: .4, fog: false, depthWrite: false, color: '#5a5f80' })); cl.position.set(-30 + i * 12 + r() * 6, 11 + r() * 8, -44 + r() * 4); cl.lookAt(0, 4, 10); S.add(cl); W.clouds.push({ m: cl, sp: .25 + r() * .3, x0: cl.position.x }); }
  // ground
  const gt = groundTextures(seed); const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ map: gt.map, normalMap: gt.normal, normalScale: new THREE.Vector2(.8, .8), roughness: .95, color: '#9aa0a0' })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);
  // dance floor (raised plaza with a rim)
  const ft = flagTextures(seed + 2); const floorM = new THREE.MeshStandardMaterial({ map: ft.map, normalMap: ft.normal, normalScale: new THREE.Vector2(1.2, 1.2), roughnessMap: ft.rough, roughness: .85, metalness: 0, color: '#b8b4c0' });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(FLOOR_R, FLOOR_R + .08, .1, 72), [new THREE.MeshStandardMaterial({ color: '#2a2830', roughness: .9 }), floorM, floorM]); floor.position.y = .05; floor.receiveShadow = true; S.add(floor);
  { const g = new THREE.CircleGeometry(FLOOR_R, 72); g.rotateX(-Math.PI / 2); g.translate(0, .101, 0); const top = new THREE.Mesh(g, floorM); top.receiveShadow = true; S.add(top); }
  const st = stoneTex(seed + 5); const stoneM = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normal, roughness: .9, color: '#a8a4b0' });
  const st2 = stoneTex(seed + 6, '#55505a'); const stoneM2 = new THREE.MeshStandardMaterial({ map: st2.map, normalMap: st2.normal, roughness: .92, color: '#9a96a2' });
  { // rim stones around the plaza
    const parts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; const g = new THREE.BoxGeometry(.62, .16 + r() * .05, .32); g.rotateY(-a); g.translate(Math.sin(a) * (FLOOR_R + .12), .08, Math.cos(a) * (FLOOR_R + .12)); parts.push(g); }
    const m = new THREE.Mesh(mergeGeometries(parts), stoneM); m.receiveShadow = true; m.castShadow = true; S.add(m); }
  // graves: half ring behind the floor (angles measured from +z, the camera side)
  W.graveDirt = new THREE.MeshStandardMaterial({ color: '#2e241c', roughness: 1, normalMap: gt.normal });
  const N = 12; for (let i = 0; i < N; i++) {
    const a = THREE.MathUtils.degToRad(78 + (i + .5) / N * 204), R = 6.3 + (i % 2) * .7; const x = Math.sin(a) * R, z = Math.cos(a) * R; const face = Math.atan2(-x, -z);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; S.add(g);
    const kind = i % 4, h = .9 + r() * .45, w = .55 + r() * .2; let stone;
    if (kind === 0) { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); sh.lineTo(w / 2, 0); stone = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .14, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 2 }), i % 3 ? stoneM : stoneM2); stone.position.z = -.07; }
    else if (kind === 1) { const cr = new THREE.Group(); const v = new THREE.Mesh(new THREE.BoxGeometry(.16, h * 1.15, .14), stoneM2); v.position.y = h * .575; const hb = new THREE.Mesh(new THREE.BoxGeometry(.6, .15, .14), stoneM2); hb.position.y = h * .85; cr.add(v, hb); stone = cr; }
    else if (kind === 2) { stone = new THREE.Mesh(new THREE.BoxGeometry(w, h * .8, .18), stoneM); stone.position.y = h * .4; }
    else { const ob = new THREE.Mesh(new THREE.CylinderGeometry(.08, .2, h * 1.4, 4), stoneM2); ob.position.y = h * .7; ob.rotation.y = Math.PI / 4; stone = ob; }
    stone.rotation.z = (r() - .5) * .16; stone.rotation.x = (r() - .5) * .1; stone.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(stone);
    // earth mound in front of the stone (the skeleton digs out of it)
    const mg = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); mg.scale(.42, .14, .85); const mound = new THREE.Mesh(mg, W.graveDirt); mound.position.set(0, 0, 1.0); mound.receiveShadow = true; g.add(mound);
    const wpos = new THREE.Vector3(x, 0, z), spawn = new THREE.Vector3(0, 0, 1.0).applyAxisAngle(new THREE.Vector3(0, 1, 0), face).add(wpos);
    W.graves.push({ g, stone, mound, pos: wpos, spawn, face, used: false, crack: 0 }); W.colliders.push({ p: wpos.clone().setY(.6), r: .6 });
  }
  // crypt / mausoleum on the far side
  { const g = new THREE.Group(); g.position.set(0, 0, -12.5); S.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(6, 3.6, 3.4), stoneM); body.position.y = 1.8; g.add(body);
    const ped = new THREE.Shape(); ped.moveTo(-3.6, 0); ped.lineTo(3.6, 0); ped.lineTo(0, 1.4); ped.closePath(); const pm = new THREE.Mesh(new THREE.ExtrudeGeometry(ped, { depth: 4, bevelEnabled: false }), stoneM2); pm.position.set(0, 3.9, -2); g.add(pm);
    const ent = new THREE.Mesh(new THREE.BoxGeometry(7.2, .3, 4.2), stoneM2); ent.position.y = 3.75; g.add(ent);
    for (let k = 0; k < 3; k++) { const step = new THREE.Mesh(new THREE.BoxGeometry(4.4 - k * .5, .18, .5), stoneM2); step.position.set(0, .09 + k * .18, 2.35 - k * .35); g.add(step); }
    for (const sx of [-2.6, -1.5, 1.5, 2.6]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(.2, .24, 3.4, 14), stoneM); col.position.set(sx, 1.9, 1.95); const cap = new THREE.Mesh(new THREE.BoxGeometry(.6, .2, .6), stoneM2); cap.position.set(sx, 3.6, 1.95); const bs = new THREE.Mesh(new THREE.BoxGeometry(.6, .2, .6), stoneM2); bs.position.set(sx, .55, 1.95); g.add(col, cap, bs); }
    const doorM = new THREE.MeshStandardMaterial({ color: '#1a1820', roughness: .5, metalness: .7, emissive: '#2a5a3a', emissiveIntensity: .0 }); W.doorM = doorM;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), doorM); door.position.set(0, 1.25, 1.72); g.add(door);
    const barsM = new THREE.MeshStandardMaterial({ color: '#2a2a30', roughness: .4, metalness: .9 }); for (let k = -3; k <= 3; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 2.4, 6), barsM); b.position.set(k * .22, 1.25, 1.76); g.add(b); }
    const skull = new THREE.Mesh(new THREE.SphereGeometry(.28, 16, 12), stoneM2); skull.scale.set(1, 1.05, .5); skull.position.set(0, 4.35, 2.05); g.add(skull);
    // ghost-green glow behind the barred door + a cold fill so the facade reads against the sky
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), new THREE.MeshBasicMaterial({ color: '#2c6a48', transparent: true, opacity: .55 })); gl.position.set(0, 1.25, 1.7); g.add(gl); W.doorGlow = gl;
    const dl = new THREE.PointLight('#5affa0', 3, 6, 1.6); dl.position.set(0, 1.4, 3.0); g.add(dl); W.doorL = dl;
    const fill = new THREE.PointLight('#8aa4ff', 10, 11, 1.4); fill.position.set(0, 4.5, 6.5); g.add(fill);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); W.colliders.push({ p: new THREE.Vector3(0, 2, -12.5), r: 4.2 }); }
  // dead trees (procedural branching tubes)
  const barkM = new THREE.MeshStandardMaterial({ map: barkTex(seed), roughness: .95, color: '#7a6a62' });
  const tree = (x, z, h, sd) => { const rr = rnd(sd), parts = [];
    const grow = (p, dir, L, rad, d) => { const pts = [p.clone()]; let q = p.clone(), dd = dir.clone(); for (let s = 0; s < 4; s++) { dd.add(new THREE.Vector3((rr() - .5) * .5, (rr() - .3) * .25, (rr() - .5) * .5)).normalize(); q = q.clone().addScaledVector(dd, L / 4); pts.push(q); }
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, rad, 6, false)); if (d < 4) { const n = 2 + (rr() < .4 ? 1 : 0); for (let k = 0; k < n; k++) { const nd = dd.clone().add(new THREE.Vector3((rr() - .5) * 1.6, rr() * .5, (rr() - .5) * 1.6)).normalize(); grow(q, nd, L * (.6 + rr() * .15), rad * .62, d + 1); } } };
    grow(new THREE.Vector3(0, -.2, 0), new THREE.Vector3(0, 1, 0), h * .5, .22 * h / 5, 0);
    const m = new THREE.Mesh(mergeGeometries(parts), barkM); m.position.set(x, 0, z); m.castShadow = true; m.rotation.y = rr() * 6; S.add(m); W.colliders.push({ p: new THREE.Vector3(x, 1.5, z), r: 1.2 }); };
  tree(-9.5, -4.5, 6.5, 3); tree(10.5, -3.5, 7.5, 8); tree(-12.5, 3.5, 5.5, 11); tree(13, 4.5, 5, 21); tree(-6, -15, 8, 31); tree(8, -16, 7, 41);
  // iron fence ring far behind
  { const parts = []; const barsM = new THREE.MeshStandardMaterial({ color: '#16161c', roughness: .45, metalness: .85 });
    for (let i = 0; i < 120; i++) { const a = THREE.MathUtils.degToRad(70 + i / 120 * 220), R = 10; const x = Math.sin(a) * R, z = Math.cos(a) * R; const b = new THREE.CylinderGeometry(.018, .018, 1.4, 5); b.translate(x, .7, z); parts.push(b); const tip = new THREE.ConeGeometry(.04, .12, 4); tip.translate(x, 1.46, z); parts.push(tip); }
    for (const y of [.25, 1.2]) { const ring = new THREE.TorusGeometry(10, .02, 4, 140, THREE.MathUtils.degToRad(220)); ring.rotateX(Math.PI / 2); ring.rotateY(THREE.MathUtils.degToRad(-20) - Math.PI / 2 + Math.PI); ring.translate(0, y, 0); parts.push(ring); }
    const m = new THREE.Mesh(mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g)), barsM); m.castShadow = true; S.add(m); }
  // lanterns on posts (warm flickering point lights)
  const postM = new THREE.MeshStandardMaterial({ color: '#141418', roughness: .5, metalness: .8 }); const glassM = new THREE.MeshStandardMaterial({ color: '#ffb060', emissive: '#ff9a40', emissiveIntensity: .8, roughness: .3, transparent: true, opacity: .9 });
  for (const [x, z] of [[-4.9, -2.6], [4.9, -2.6], [-3.2, -4.6], [3.2, -4.6]]) { const g = new THREE.Group(); g.position.set(x, 0, z); S.add(g);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, 2.2, 8), postM); post.position.y = 1.1; const cage = new THREE.Mesh(new THREE.CylinderGeometry(.12, .09, .26, 6), glassM); cage.position.y = 2.32; const roof = new THREE.Mesh(new THREE.ConeGeometry(.16, .16, 6), postM); roof.position.y = 2.53; g.add(post, cage, roof); post.castShadow = true;
    const L = new THREE.PointLight('#ff9a50', 2.2, 7, 1.8); L.position.set(x, 2.3, z); S.add(L); W.lanterns.push({ L, ph: r() * 9, glass: cage }); W.colliders.push({ p: new THREE.Vector3(x, 1.2, z), r: .35 }); }
  // ground fog: layered noise sheets drifting slowly
  const fogTex = (() => { const [c, g] = cv(512, 512), rr = rnd(seed + 9); for (let i = 0; i < 90; i++) { const x = rr() * 512, y = rr() * 512, s = 40 + rr() * 110; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { g.save(); g.translate(ox, oy); g.fillRect(x - s, y - s, s * 2, s * 2); g.restore(); } } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  W.fogMat = []; for (let i = 0; i < (q.fog || 5); i++) { const t = fogTex.clone(); t.needsUpdate = true; t.repeat.set(2, 2); const m = new THREE.MeshBasicMaterial({ map: t, color: '#5a6090', transparent: true, opacity: .1, depthWrite: false, fog: true }); const p = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), m); p.rotation.x = -Math.PI / 2; p.position.y = .13 + i * .085; p.renderOrder = 2; S.add(p); W.fogs.push({ m, t, sp: (.006 + i * .003) * (i % 2 ? -1 : 1), base: (.12 - i * .011) * 5 / (q.fog || 5) }); W.fogMat.push(m); }
  // wisps / fireflies
  { const n = Math.round(160 * (q.parts || 1)); const p = new Float32Array(n * 3); W.wispData = []; for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, R = 5 + r() * 9; p[i * 3] = Math.sin(a) * R; p[i * 3 + 1] = .3 + r() * 3; p[i * 3 + 2] = Math.cos(a) * R - 2; W.wispData.push({ a, R, y: p[i * 3 + 1], ph: r() * 9, sp: .05 + r() * .1 }); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); W.wisps = new THREE.Points(g, new THREE.PointsMaterial({ map: W.soft, color: '#9affb0', size: .12, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); S.add(W.wisps); }
  // ground cracks (decals that tear open on big moments)
  const ctex = crackTexture(seed + 4); for (let i = 0; i < 3; i++) { const m = new THREE.MeshBasicMaterial({ map: ctex, color: '#ff7a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 }); const d = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); d.rotation.x = -Math.PI / 2; d.rotation.z = i * 2.1; d.position.set([0, -2.2, 2.3][i], .106 + i * .001, [1.2, -1.5, -1.3][i]); d.scale.setScalar(.01); S.add(d); W.cracks.push({ d, m, k: 0, size: [3.6, 2.8, 2.8][i] }); }
  // lightning bolt ribbons
  W.boltMat = new THREE.MeshBasicMaterial({ color: '#b8c8ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }); W.bolt = new THREE.Group(); S.add(W.bolt);
  // lights
  W.hemi = new THREE.HemisphereLight('#4a5a9a', '#14100c', .5); S.add(W.hemi);
  W.moon = new THREE.DirectionalLight('#a8b6ff', 1.7); W.moon.position.set(4, 11, -9); W.moon.target.position.set(0, 0, 0); S.add(W.moon, W.moon.target);
  const sc = W.moon.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 30; W.moon.shadow.bias = -.0005; W.moon.shadow.normalBias = .03;
  W.key = new THREE.SpotLight('#ffe2c0', 22, 20, .5, .65, 1.4); W.key.position.set(.5, 6, 8); W.key.target.position.set(0, .8, -.5); S.add(W.key, W.key.target);
  W.stage = []; for (const [x, col] of [[-5, '#9a6aff'], [5, '#4adfb0']]) { const L = new THREE.SpotLight(col, 30, 18, .32, .55, 1.3); L.position.set(x, 7, 3); L.target.position.set(0, 0, -.5); S.add(L, L.target); W.stage.push(L); }
  return W;
}
const _v = new THREE.Vector3();
export function updateWorld(W, t, dt, beat) {
  W.t = t; W.flash = Math.max(0, W.flash - dt * 2.4); const fl = W.flash > 0 ? W.flash * (.55 + .45 * Math.abs(Math.sin(t * 47))) : 0;
  for (const L of W.lanterns) { const k = 1 + Math.sin(t * 8 + L.ph) * .08 + Math.sin(t * 21 + L.ph * 2) * .05; L.L.intensity = 2.2 * k * (1 + W.react * .4); }
  W.hemi.intensity = .62 + fl * 1.1; if (W.doorL) W.doorL.intensity = 3 + Math.sin(t * 1.3) * .8 + (W.energy || 0) * 2; W.moon.intensity = 1.7 + fl * 3; W.moonDisc.material.color.setScalar(.78 + fl * .12);
  for (const c of W.clouds) { c.m.position.x = c.x0 + Math.sin(t * .01 * c.sp * 10) * 4 + t * c.sp * .2 % 1; c.m.material.color.setRGB(.2 + fl * .5, .22 + fl * .5, .32 + fl * .5); }
  for (const f of W.fogs) { f.t.offset.x = t * f.sp; f.t.offset.y = t * f.sp * .6; f.m.opacity = f.base * (1 + W.fogBurst * 1.8); }
  W.fogBurst = Math.max(0, (W.fogBurst || 0) - dt * .25);
  const ph = beat % 1, pulse = Math.pow(1 - ph, 3); W.beat = beat;
  W.stage.forEach((L, i) => { const a = t * .5 + i * Math.PI; L.target.position.set(Math.sin(a) * 2.2, 0, -.6 + Math.cos(a * .7) * 1.5); L.intensity = (24 + pulse * 18 * (W.energy || .3)) * (1 + W.react * .3); });
  W.doorM.emissiveIntensity = .15 + W.react * .4;
  const p = W.wisps.geometry.attributes.position; for (let i = 0; i < W.wispData.length; i++) { const d = W.wispData[i]; d.a += dt * d.sp * .2; p.setXYZ(i, Math.sin(d.a) * d.R, d.y + Math.sin(t * .8 + d.ph) * .3, Math.cos(d.a) * d.R - 2); } p.needsUpdate = true; W.wisps.material.opacity = .45 + .2 * Math.sin(t * 1.3);
  for (const c of W.cracks) { if (c.k > 0) { c.k = Math.min(1, c.k + dt * 1.6); c.life -= dt; } const open = c.k > 0 ? 1 - Math.pow(1 - c.k, 3) : 0; c.d.scale.setScalar(.01 + open * c.size); c.m.opacity = open * (c.life > 0 ? .42 + pulse * .18 : Math.max(0, .42 + c.life * .14)); if (c.life < -3) { c.k = 0; c.m.opacity = 0; } }
  W.boltMat.opacity = Math.max(0, W.boltMat.opacity - dt * 4);
  W.react = Math.max(0, W.react - dt * 1.4);
}
export function openCrack(W, i = 0) { const c = W.cracks[i % W.cracks.length]; c.k = .001; c.life = 6; }
export function lightning(W, rng = Math.random) {
  W.flash = 1; while (W.bolt.children.length) { const o = W.bolt.children.pop(); o.geometry.dispose(); }
  const x0 = (rng() - .5) * 26, z0 = -30 - rng() * 8; let p = new THREE.Vector3(x0, 26, z0); const pts = [p.clone()];
  while (p.y > 1) { p = p.clone().add(new THREE.Vector3((rng() - .5) * 2.8, -1.6 - rng() * 1.6, (rng() - .5) * 1)); pts.push(p); }
  const mk = (pts, w) => { const pos = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; pos.push(a.x - w, a.y, a.z, a.x + w, a.y, a.z, b.x + w, b.y, b.z, a.x - w, a.y, a.z, b.x + w, b.y, b.z, b.x - w, b.y, b.z); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return new THREE.Mesh(g, W.boltMat); };
  W.bolt.add(mk(pts, .13)); for (let k = 0; k < 3; k++) { const s = 2 + Math.floor(rng() * (pts.length - 4)); let q = pts[s].clone(); const br = [q.clone()]; for (let j = 0; j < 4; j++) { q = q.clone().add(new THREE.Vector3((rng() - .5) * 3, -1.2 - rng(), 0)); br.push(q); } W.bolt.add(mk(br, .06)); }
  W.boltMat.opacity = .85;
}
