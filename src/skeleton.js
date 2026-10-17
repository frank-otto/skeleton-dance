// Procedurally modelled, rigged 3D skeletons: one SkinnedMesh per skeleton (rigid skinning, 20 bones) built from
// lathe-turned long bones, a ribcage of elliptical ribs, vertebrae, pelvis, hand and foot bones and a skull with
// eye sockets, nasal cavity, teeth and a hinged jaw that clacks. All skeletons share one geometry + material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'jaw', 'clavL', 'armL', 'foreL', 'handL', 'clavR', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const PARENT = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head', clavL: 'chest', armL: 'clavL', foreL: 'armL', handL: 'foreL', clavR: 'chest', armR: 'clavR', foreR: 'armR', handR: 'foreR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR' };
// world bind positions (metres); the skeleton faces +z, its left side is +x
const BP = { hips: [0, .98, 0], spine: [0, 1.1, -.02], chest: [0, 1.28, -.02], neck: [0, 1.5, -.02], head: [0, 1.6, 0], jaw: [0, 1.625, .005],
  clavL: [.03, 1.46, .02], armL: [.19, 1.45, -.01], foreL: [.2, 1.16, -.01], handL: [.21, .9, 0], clavR: [-.03, 1.46, .02], armR: [-.19, 1.45, -.01], foreR: [-.2, 1.16, -.01], handR: [-.21, .9, 0],
  thighL: [.095, .95, 0], shinL: [.1, .52, .01], footL: [.1, .09, -.01], thighR: [-.095, .95, 0], shinR: [-.1, .52, .01], footR: [-.1, .09, -.01] };
const JI = Object.fromEntries(JOINTS.map((j, i) => [j, i]));
const V = (a) => new THREE.Vector3(...a);
const IVORY = new THREE.Color('#d9ccb0'), DARK = new THREE.Color('#0d0806');

function tag(g, bone, col, shade = 0) {
  g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), c = new Float32Array(n * 3);
  const p = g.attributes.position;
  for (let i = 0; i < n; i++) { si[i * 4] = JI[bone]; sw[i * 4] = 1;
    // slight per-vertex ageing: darker towards the ends and in crevices (fake AO)
    const k = col === DARK ? 1 : 1 - shade * (.5 + .5 * Math.sin(p.getX(i) * 91 + p.getY(i) * 57 + p.getZ(i) * 33)) - .06 * Math.max(0, Math.sin(p.getY(i) * 140));
    c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k * .985; c[i * 3 + 2] = col.b * k * .95; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
function orient(g, a, b) { const d = new THREE.Vector3().subVectors(b, a); const L = d.length(); g.scale(1, L, 1); _q.setFromUnitVectors(_up, d.normalize()); g.applyQuaternion(_q); g.translate(a.x, a.y, a.z); return g; }
// lathe-turned long bone from a to b: knobbly epiphyses, slender shaft
function longBone(a, b, r0, r1, rm, seg = 10) {
  const pr = [[0, 0], [r0 * .7, .01], [r0, .045], [r0 * .8, .1], [rm * 1.15, .2], [rm, .32], [rm, .68], [rm * 1.1, .8], [r1 * .8, .9], [r1, .955], [r1 * .7, .99], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y));
  return orient(new THREE.LatheGeometry(pr, seg), V(a), V(b));
}
function sph(c, s, seg = 10) { const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg * .7 | 0)); g.scale(...s); g.translate(...c); return g; }
function box(c, s, rx = 0, ry = 0, rz = 0) { const g = new THREE.BoxGeometry(...s); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(...c); return g; }
function cyl(a, b, r, seg = 6) { return orient(new THREE.CylinderGeometry(r, r, 1, seg).translate(0, .5, 0), V(a), V(b)); }

let SHARED = null;
export function skeletonGeometry() {
  if (SHARED) return SHARED;
  const parts = [], add = (g, bone, col = IVORY, sh = .08) => parts.push(tag(g, bone, col, sh));
  // ---- skull ----
  const H = BP.head[1];
  { const g = new THREE.SphereGeometry(1, 30, 22); const p = g.attributes.position; // cranium with a flatter face and cheek structure
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); x *= .093; y *= .105; z *= .118; if (y < 0) { x *= 1 - Math.min(.25, -y * 2.2); } if (z > 0 && y < .02) z *= .82; if (y < -.04) { y = -.04 + (y + .04) * .5; } p.setXYZ(i, x, y + H + .1, z - .01); }
    g.computeVertexNormals(); add(g, 'head'); }
  add(sph([0, H + .045, .05], [.072, .06, .07], 16), 'head'); // maxilla / cheekbones
  for (const s of [-1, 1]) { add(sph([s * .062, H + .06, .06], [.026, .02, .03], 8), 'head'); // zygomatic arch
    add(sph([s * .036, H + .088, .093], [.029, .027, .022], 12), 'head', DARK); // eye socket
    add(sph([s * .036, H + .118, .088], [.034, .01, .022], 8), 'head', IVORY, .1); } // brow ridge
  { const g = new THREE.ConeGeometry(.016, .032, 3); g.rotateZ(Math.PI); g.translate(0, H + .052, .108); add(g, 'head', DARK); } // nasal cavity
  for (let k = 0; k < 8; k++) { const a = (k - 3.5) / 3.5 * .9; add(box([Math.sin(a) * .042, H + .022, .05 + Math.cos(a) * .042], [.011, .016, .01], 0, a, 0), 'head', IVORY, .2); } // upper teeth
  // ---- jaw (hinged) ----
  { const g = new THREE.TorusGeometry(.044, .011, 6, 18, Math.PI * 1.15); g.rotateX(Math.PI / 2); g.rotateY(Math.PI / 2 + Math.PI * .075 * 0); g.scale(1, 1, 1.1); g.rotateY(-Math.PI / 2 - .27); g.translate(0, H + .0, .045); add(g, 'jaw'); }
  for (const s of [-1, 1]) add(box([s * .05, H + .02, .01], [.012, .045, .02], .3, 0, 0), 'jaw');
  add(sph([0, H - .004, .088], [.02, .012, .012], 8), 'jaw'); // chin
  for (let k = 0; k < 8; k++) { const a = (k - 3.5) / 3.5 * .85; add(box([Math.sin(a) * .039, H + .01, .05 + Math.cos(a) * .039], [.01, .014, .009], 0, a, 0), 'jaw', IVORY, .2); }
  // ---- spine: vertebrae from sacrum to skull ----
  for (let y = 1.0; y < 1.6; y += .034) { const bone = y < 1.1 ? 'hips' : y < 1.28 ? 'spine' : y < 1.5 ? 'chest' : 'neck'; const z = -.035 - Math.sin((y - 1) * 5) * .015 + (y > 1.48 ? (y - 1.48) * .3 : 0);
    const r = y > 1.48 ? .013 : .019; add(cyl([0, y, z], [0, y + .022, z], r, 8), bone); add(box([0, y + .011, z - .03], [.01, .012, .035], -.3, 0, 0), bone, IVORY, .15); if (y < 1.48) add(box([0, y + .012, z - .005], [.06, .008, .01]), bone, IVORY, .15); }
  // ---- ribcage ----
  for (let k = 0; k < 7; k++) { const y = 1.43 - k * .03, R = .07 + Math.sin((k + 1) / 8 * Math.PI) * .045 + k * .004, gap = .5 + k * .12;
    const g = new THREE.TorusGeometry(R, .0085, 5, 26, Math.PI * 2 - gap); g.rotateZ(Math.PI / 2 + gap / 2); g.rotateX(Math.PI / 2); g.scale(1.12, 1, .82); g.rotateX(-.32); g.translate(0, y, .0); add(g, 'chest', IVORY, .1); }
  add(box([0, 1.37, .085], [.026, .15, .012], -.2, 0, 0), 'chest'); // sternum
  for (const s of [-1, 1]) { add(longBone([s * .02, 1.45, .07], [s * .17, 1.47, -.005], .012, .014, .008, 6), s > 0 ? 'clavL' : 'clavR');
    const g = new THREE.CircleGeometry(.07, 3); g.scale(1, 1.3, 1); g.rotateY(s * .4); g.translate(s * .12, 1.39, -.085); add(g, 'chest', IVORY, .2); } // scapulae
  // ---- pelvis ----
  { const g = new THREE.TorusGeometry(.085, .024, 8, 22); g.rotateX(Math.PI / 2 - .45); g.scale(1.25, 1, .9); g.translate(0, .97, 0); add(g, 'hips'); }
  for (const s of [-1, 1]) add(sph([s * .1, 1.02, -.01], [.07, .07, .025], 12).rotateY(0), 'hips'); // iliac wings
  add(sph([0, .99, -.06], [.04, .06, .02], 8), 'hips'); // sacrum
  // ---- limbs ----
  for (const [s, L] of [[1, 'L'], [-1, 'R']]) {
    const A = BP['arm' + L], F = BP['fore' + L], W = BP['hand' + L], T = BP['thigh' + L], K = BP['shin' + L], An = BP['foot' + L];
    add(sph(A, [.03, .03, .03], 10), 'arm' + L); add(longBone(A, F, .026, .022, .012), 'arm' + L); // humerus
    add(longBone([F[0] - s * .012, F[1], F[2]], [W[0] - s * .012, W[1], W[2]], .014, .01, .0075, 6), 'fore' + L); // ulna
    add(longBone([F[0] + s * .01, F[1] - .01, F[2] + .006], [W[0] + s * .01, W[1], W[2] + .006], .011, .015, .008, 6), 'fore' + L); // radius
    // hand: carpals, metacarpals, phalanges (curled slightly)
    add(box([W[0], W[1] - .02, W[2]], [.02, .03, .045]), 'hand' + L);
    for (let f = 0; f < 4; f++) { const z = W[2] + (f - 1.5) * .014, x = W[0] + s * .002; let y = W[1] - .04;
      add(cyl([x, y, z], [x, y - .045, z + .002], .0045, 5), 'hand' + L); y -= .047; add(cyl([x, y, z], [x + s * .006, y - .03, z + .003], .004, 5), 'hand' + L); y -= .032; add(cyl([x + s * .006, y, z + .003], [x + s * .013, y - .02, z + .004], .0035, 5), 'hand' + L); }
    add(cyl([W[0], W[1] - .03, W[2] + .028], [W[0] + s * .004, W[1] - .07, W[2] + .045], .005, 5), 'hand' + L); // thumb
    // leg
    add(sph([T[0] + s * .005, T[1] - .01, T[2]], [.032, .032, .032], 10), 'thigh' + L); add(longBone([T[0] + s * .03, T[1] - .03, T[2]], [K[0], K[1] + .02, K[2]], .03, .032, .016), 'thigh' + L); // femur
    add(sph([K[0], K[1] + .01, K[2] + .035], [.018, .022, .01], 8), 'shin' + L); // patella
    add(longBone([K[0], K[1], K[2]], [An[0], An[1] + .02, An[2]], .03, .022, .014), 'shin' + L); // tibia
    add(longBone([K[0] + s * .03, K[1] - .02, K[2] - .01], [An[0] + s * .028, An[1] + .03, An[2] - .01], .012, .012, .006, 5), 'shin' + L); // fibula
    add(box([An[0], An[1] - .04, An[2] + .01], [.05, .04, .08]), 'foot' + L); // tarsals
    for (let t = 0; t < 5; t++) { const x = An[0] + (t - 2) * .013 * s * -1; add(cyl([x, An[1] - .06, An[2] + .045], [x, An[1] - .075, An[2] + .13 - Math.abs(t - 1) * .01], .0055, 5), 'foot' + L); }
  }
  SHARED = mergeGeometries(parts, false); SHARED.computeBoundingSphere();
  return SHARED;
}
let MAT = null;
export function boneMaterial() {
  if (MAT) return MAT;
  // subtle procedural pitting for the bone surface (bump), shared by every skeleton
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < .5 ? 0 : 255},${r() < .5 ? 0 : 255},${r() < .5 ? 0 : 255},.08)`; const x = r() * 256, y = r() * 256; g.fillRect(x, y, 1 + r() * 3, 1 + r() * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0, bumpMap: t, bumpScale: .6, emissive: '#2a2218', emissiveIntensity: .35 });
  return MAT;
}
const HATS = {};
function hatMats() { if (HATS.m) return HATS.m; HATS.m = { felt: new THREE.MeshStandardMaterial({ color: '#16121c', roughness: .7 }), band: new THREE.MeshStandardMaterial({ color: '#7a1a2a', roughness: .5 }), red: new THREE.MeshStandardMaterial({ color: '#8a1020', roughness: .45 }), rag: new THREE.MeshStandardMaterial({ color: '#3a2a4a', roughness: .9, side: THREE.DoubleSide }), gold: new THREE.MeshStandardMaterial({ color: '#8a6a2a', roughness: .35, metalness: .8 }) }; return HATS.m; }
let EYE_TEX = null;
function eyeTex() { if (EYE_TEX) return EYE_TEX; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); EYE_TEX = new THREE.CanvasTexture(c); return EYE_TEX; }

// Create one rigged skeleton. opts: { eye: color, hat: 'top'|'bowler'|'bandana'|'crown'|null, bow: bool, scale }
export function createSkeleton(scene, opts = {}) {
  const geo = skeletonGeometry(), mat = boneMaterial();
  const bones = JOINTS.map(j => { const b = new THREE.Bone(); b.name = j; return b; });
  const B = Object.fromEntries(JOINTS.map((j, i) => [j, bones[i]]));
  for (const j of JOINTS) { const p = V(BP[j]); if (PARENT[j]) { B[PARENT[j]].add(B[j]); p.sub(V(BP[PARENT[j]])); } B[j].position.copy(p); }
  const root = new THREE.Group(); root.add(B.hips);
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh); root.updateMatrixWorld(true);
  const sk = new THREE.Skeleton(bones); mesh.bind(sk);
  // glowing eyes (soft sprites deep in the sockets – kept below the bloom threshold)
  const eyes = []; const ec = new THREE.Color(opts.eye || '#7dff9a');
  for (const s of [-1, 1]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex(), color: ec, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(.05); sp.position.set(s * .036, .088, .094); B.head.add(sp); eyes.push(sp); }
  const M = hatMats();
  if (opts.hat === 'top') { const h = new THREE.Group(); const c1 = new THREE.Mesh(new THREE.CylinderGeometry(.085, .08, .17, 20), M.felt); c1.position.y = .085; const br = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .012, 24), M.felt); const bd = new THREE.Mesh(new THREE.CylinderGeometry(.082, .082, .035, 20), M.band); bd.position.y = .03; h.add(c1, br, bd); h.position.set(0, .19, -.01); h.rotation.set(-.12, 0, .1); h.traverse(o => { if (o.isMesh) o.castShadow = true; }); B.head.add(h); }
  if (opts.hat === 'bowler') { const h = new THREE.Group(); const d = new THREE.Mesh(new THREE.SphereGeometry(.09, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.felt); const br = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .01, 20), M.felt); h.add(d, br); h.position.set(0, .18, -.01); h.rotation.z = -.15; h.traverse(o => { if (o.isMesh) o.castShadow = true; }); B.head.add(h); }
  if (opts.hat === 'crown') { const h = new THREE.Mesh(new THREE.CylinderGeometry(.075, .07, .05, 8, 1, true), M.gold); h.position.set(0, .2, -.01); h.rotation.z = .12; B.head.add(h); }
  if (opts.hat === 'bandana') { const h = new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.3), M.red); h.scale.set(1, .8, 1.15); h.position.set(0, .13, -.01); B.head.add(h); }
  if (opts.bow) { const bw = new THREE.Group(); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(.028, .05, 4), M.red); w.rotation.z = s * Math.PI / 2; w.position.x = s * .025; bw.add(w); } const k = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 6), M.red); bw.add(k); bw.position.set(0, -.08, .03); B.neck.add(bw); }
  if (opts.scarf) { const sc = new THREE.Mesh(new THREE.TorusGeometry(.06, .02, 6, 16), M.rag); sc.rotation.x = Math.PI / 2; sc.position.set(0, -.04, 0); B.neck.add(sc); }
  scene.add(root);
  const S = { root, mesh, B, eyes, base: Object.fromEntries(JOINTS.map(j => [j, B[j].position.clone()])), headOff: new THREE.Vector3(), state: 'hidden', t: 0, slot: new THREE.Vector3(), pos: new THREE.Vector3(), yaw: 0, move: null, moveT: 0, moveD: .55, delay: 0, rise: 0, from: new THREE.Vector3(), eyeC: ec, glow: 0, seed: Math.random() * 10, collapse: 0, queue: [] };
  root.visible = false; return S;
}

// ---------------- poses ----------------
// A pose is a map joint -> [rx, ry, rz] (radians, added onto the bind pose) plus root offsets: y, x, z, ry, head lift.
const PI = Math.PI, sin = Math.sin, cos = Math.cos, smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const env = (p, a = .18, b = .22) => smooth(p / a) * smooth((1 - p) / b);
function blank() { const P = {}; for (const j of JOINTS) P[j] = [0, 0, 0]; P._y = 0; P._x = 0; P._z = 0; P._ry = 0; P._head = 0; P._jaw = 0; return P; }
function addP(P, Q, w) { if (!w) return P; for (const j of JOINTS) { P[j][0] += Q[j][0] * w; P[j][1] += Q[j][1] * w; P[j][2] += Q[j][2] * w; } for (const k of ['_y', '_x', '_z', '_ry', '_head', '_jaw']) P[k] += Q[k] * w; return P; }
const set = (P, j, x, y, z) => { P[j][0] += x; P[j][1] += y; P[j][2] += z; };
// arms: L side positive rz = outward; R side mirror
function arms(P, lOut, rOut, lFwd = 0, rFwd = 0, lElb = 0, rElb = 0) { set(P, 'armL', -lFwd, 0, lOut); set(P, 'armR', -rFwd, 0, -rOut); set(P, 'foreL', -lElb, 0, 0); set(P, 'foreR', -rElb, 0, 0); }
function legs(P, lLift, rLift, lKnee, rKnee) { set(P, 'thighL', -lLift, 0, 0); set(P, 'thighR', -rLift, 0, 0); set(P, 'shinL', lKnee, 0, 0); set(P, 'shinR', rKnee, 0, 0); set(P, 'footL', -lKnee * .3, 0, 0); set(P, 'footR', -rKnee * .3, 0, 0); }
// the base waltz groove: bounce on every beat, sway across the bar, loose arms, jaw clacking on the beat
export function idlePose(t, beat, bar, energy = 1, seed = 0) {
  const P = blank(); const b = beat % 1, br = (bar % 2) + (beat % 3) / 3;
  const bounce = Math.pow(Math.abs(sin(PI * b)), 1.5); const sway = sin(PI * br) * (bar % 2 ? -1 : 1);
  P._y = -.035 * bounce * energy; set(P, 'hips', 0, sway * .12 * energy, sway * .05 * energy); set(P, 'spine', .04, -sway * .06, -sway * .04 * energy); set(P, 'chest', .02 + bounce * .03, -sway * .05, 0);
  set(P, 'neck', 0, sway * .08, 0); set(P, 'head', -.05 + bounce * .1 * energy, sin(t * .7 + seed) * .12, sway * .1);
  arms(P, .14 + bounce * .06, .14 + bounce * .06, .15 + sway * .25 * energy, .15 - sway * .25 * energy, .5 + bounce * .3, .5 + bounce * .3);
  legs(P, .08 + Math.max(0, sway) * .15 * energy, .08 + Math.max(0, -sway) * .15 * energy, .16 + bounce * .2 + Math.max(0, sway) * .3 * energy, .16 + bounce * .2 + Math.max(0, -sway) * .3 * energy);
  P._jaw = .06 + .3 * Math.pow(Math.max(0, sin(PI * 2 * beat)), 6) * energy; return P;
}
const MOVES = {
  left(p) { const P = blank(), e = sin(PI * p); P._x = .28 * e; P._ry = .35 * e; set(P, 'hips', 0, 0, .12 * e); set(P, 'spine', 0, 0, .18 * e); arms(P, 2.3 * e, .6 * e, .2, .3 * e, .3, 1.4 * e); legs(P, 0, .4 * e, 0, .5 * e); set(P, 'thighR', 0, 0, -.3 * e); set(P, 'head', 0, .4 * e, .2 * e); P._jaw = .3 * e; return P; },
  right(p) { const P = blank(), e = sin(PI * p); P._x = -.28 * e; P._ry = -.35 * e; set(P, 'hips', 0, 0, -.12 * e); set(P, 'spine', 0, 0, -.18 * e); arms(P, .6 * e, 2.3 * e, .3 * e, .2, 1.4 * e, .3); legs(P, .4 * e, 0, .5 * e, 0); set(P, 'thighL', 0, 0, .3 * e); set(P, 'head', 0, -.4 * e, -.2 * e); P._jaw = .3 * e; return P; },
  up(p) { const P = blank(), e = sin(PI * p), crouch = Math.max(0, sin(PI * Math.min(1, p * 4))) * (p < .25 ? 1 : 0), air = p > .2 && p < .85 ? sin(PI * (p - .2) / .65) : 0; P._y = .42 * air - .12 * crouch; const pump = sin(p * PI * 6) * .25;
    arms(P, 2.6 * e + pump, 2.6 * e + pump, .2, .2, .9 * e, .9 * e); legs(P, .6 * air + .5 * crouch, .6 * air + .5 * crouch, 1.0 * air + .9 * crouch, 1.0 * air + .9 * crouch); set(P, 'head', -.35 * air, 0, 0); P._jaw = .5 * air; return P; },
  down(p) { const P = blank(), e = env(p, .15, .25), w = sin(p * PI * 6); P._y = -.3 * e; set(P, 'hips', 0, w * .35 * e, w * .2 * e); set(P, 'spine', .15 * e, -w * .2 * e, 0); legs(P, .9 * e, .9 * e, 1.6 * e, 1.6 * e); set(P, 'thighL', 0, 0, .35 * e); set(P, 'thighR', 0, 0, -.35 * e);
    arms(P, .5 * e, .5 * e, 1.1 * e, 1.1 * e, 1.2 * e + w * .3 * e, 1.2 * e - w * .3 * e); set(P, 'head', .2 * e, w * .2 * e, 0); P._jaw = .45 * e * (.5 + .5 * Math.abs(w)); return P; },
  spin(p) { const P = blank(), e = env(p, .1, .15); P._ry = PI * 2 * smooth(p); P._y = .08 * sin(PI * p); arms(P, 1.5 * e, 1.5 * e, 0, 0, .2, .2); legs(P, .5 * e, 0, .9 * e, .1); set(P, 'head', -.1, 0, .2 * e); P._jaw = .4 * e; return P; },
  claw(p) { // the zombie claw: arms up to one side with bent wrists, shoulder shrugs and a side shuffle
    const P = blank(), e = env(p, .12, .2), k = p < .5 ? 1 : -1, sh = Math.abs(sin(p * PI * 4)); P._x = .12 * k * e; P._ry = .25 * k * e;
    arms(P, (k > 0 ? 1.4 : .7) * e, (k > 0 ? .7 : 1.4) * e, 1.1 * e, 1.1 * e, 1.1 * e, 1.1 * e); set(P, 'handL', -.9 * e, 0, .3 * e); set(P, 'handR', -.9 * e, 0, -.3 * e); set(P, 'clavL', 0, 0, .25 * sh * e); set(P, 'clavR', 0, 0, -.25 * sh * e);
    set(P, 'head', .1 * e, .3 * k * e, .35 * k * e); set(P, 'spine', .12 * e, 0, -.1 * k * e); legs(P, .3 * sh * e, .3 * (1 - sh) * e, .5 * sh * e, .5 * (1 - sh) * e); P._jaw = .55 * e; return P; },
  skull(p) { const P = blank(), e = sin(PI * p); P._head = .38 * e; arms(P, .8 * e, .8 * e, 2.4 * smooth(p * 2) * (1 - smooth((p - .7) * 4)), 2.4 * smooth(p * 2) * (1 - smooth((p - .7) * 4)), .4, .4); set(P, 'head', -PI * 2 * smooth(p), 0, 0); P._jaw = .6 * e; legs(P, .2 * e, .2 * e, .4 * e, .4 * e); return P; },
  kick(p) { const P = blank(), e = env(p, .1, .15), side = p < .5, k = sin(PI * ((p * 2) % 1)); legs(P, side ? 1.7 * k * e : 0, side ? 0 : 1.7 * k * e, side ? .2 * (1 - k) : .2, side ? .2 : .2 * (1 - k)); arms(P, .9 * e, .9 * e, -.3 * e, -.3 * e, 1.9 * e, 1.9 * e); set(P, 'spine', -.12 * k * e, 0, 0); P._y = .03 * k; P._jaw = .35 * k; return P; },
  wave(p) { const P = blank(), e = env(p, .12, .2), w = sin(p * PI * 4); arms(P, (2.6 + w * .3) * e, (2.6 - w * .3) * e, 0, 0, .2, .2); set(P, 'foreL', 0, 0, w * .6 * e); set(P, 'foreR', 0, 0, w * .6 * e); set(P, 'hips', 0, 0, -w * .12 * e); set(P, 'spine', 0, 0, w * .12 * e); set(P, 'head', -.25 * e, 0, w * .15 * e); P._jaw = .3 * e; return P; },
  ribs(p) { // play the ribcage like a xylophone
    const P = blank(), e = env(p, .12, .18), q = smooth(p); arms(P, .25 * e, .35 * e, .9 * e, 1.2 * e, 1.6 * e, (1.9 - q * .6) * e); set(P, 'armR', 0, 0, .6 * e * (q - .3)); set(P, 'handR', -.6 * e, 0, 0); set(P, 'head', .45 * e, 0, .15 * e); set(P, 'spine', -.1 * e, 0, 0); P._jaw = (.3 + .3 * Math.abs(sin(p * PI * 6))) * e; return P; },
  bow(p) { const P = blank(), e = env(p, .2, .25); set(P, 'spine', .55 * e, 0, 0); set(P, 'chest', .35 * e, 0, 0); set(P, 'head', .3 * e, 0, 0); arms(P, .3 * e, 1.3 * e, .2 * e, 1.6 * e, .2, 1.4 * e); set(P, 'thighR', -.2 * e, 0, 0); P._jaw = .1; return P; },
  stumble(p) { const P = blank(), e = sin(PI * p); P._head = .22 * e; set(P, 'spine', -.3 * e, 0, .15 * e); arms(P, 1.2 * e, 1.6 * e, 0, .5 * e, .3, .6); legs(P, .4 * e, 0, .3 * e, 0); P._jaw = .6 * e; return P; }
};
export const MOVE_LIST = ['left', 'right', 'up', 'down', 'spin', 'claw', 'skull', 'kick', 'wave', 'ribs'];
export function movePose(name, p) { return (MOVES[name] || MOVES.left)(Math.max(0, Math.min(1, p))); }
// rising out of the grave (p 0..1): a hand bursts out, the skull follows, the body hauls itself up and steps out
export function risePose(p) {
  const P = blank(); const a = smooth(p / .35), b = smooth((p - .25) / .5), c = smooth((p - .7) / .3);
  P._y = -1.75 + 1.75 * (a * .45 + b * .55) ; set(P, 'spine', .5 * (1 - c), 0, 0); set(P, 'head', -.4 * (1 - b) + .2 * c, sin(p * 20) * .2 * (1 - c), 0);
  arms(P, .4 + .4 * (1 - c), .2 + .6 * (1 - c), 2.9 * (1 - c), 2.4 * (1 - b) + 1.0 * (b - c) * (b > c ? 1 : 0), .3, .6 * (1 - c));
  set(P, 'handL', -.6 * (1 - c) * (1 + sin(p * 30) * .3), 0, 0); legs(P, .9 * (b - c) * (b > c ? 1 : 0), .2 * (1 - c), 1.2 * (b - c) * (b > c ? 1 : 0), .3 * (1 - c)); P._jaw = .2 + .4 * Math.abs(sin(p * 25)) * (1 - c); return P;
}
export function walkPose(t) { const P = blank(), w = sin(t * 9); legs(P, .45 * Math.max(0, w), .45 * Math.max(0, -w), .7 * Math.max(0, w), .7 * Math.max(0, -w)); set(P, 'thighL', -w * .25, 0, 0); set(P, 'thighR', w * .25, 0, 0); arms(P, .12, .12, -w * .5, w * .5, .4, .4); P._y = -Math.abs(cos(t * 9)) * .04; set(P, 'head', -.05, 0, w * .08); P._jaw = .1 + .2 * Math.abs(w); return P; }
export function collapsePose(p) { const P = blank(), e = smooth(p); P._y = -.62 * e; set(P, 'spine', .9 * e, 0, .3 * e); set(P, 'chest', .4 * e, 0, 0); set(P, 'head', .7 * e, .5 * e, .6 * e); P._head = -.2 * e; arms(P, .9 * e, .4 * e, -.3 * e, .8 * e, .2, 1.2 * e); legs(P, 1.5 * e, 1.2 * e, 2.4 * e, 2.0 * e); set(P, 'thighL', 0, 0, .5 * e); P._jaw = .8 * e; return P; }
export { blank as blankPose, addP as addPose };

// apply a pose to a skeleton (positions its root in the world too)
const _e = new THREE.Euler();
export function applyPose(S, P, x, z, yaw, scale = 1, y0 = 0) {
  const B = S.B;
  for (const j of JOINTS) { const r = P[j]; B[j].rotation.set(r[0], r[1], r[2]); }
  B.jaw.rotation.x += P._jaw;
  B.head.position.copy(S.base.head); B.head.position.y += P._head;
  B.hips.position.copy(S.base.hips); B.hips.position.y += P._y; 
  S.root.position.set(x + P._x * cos(yaw), y0, z - P._x * sin(yaw)); S.root.rotation.y = yaw + P._ry; S.root.scale.setScalar(scale);
}
