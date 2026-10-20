import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createWorld, updateWorld, openCrack, lightning, QUALITY, FLOOR_R } from './world.js';
import { createSkeleton, idlePose, movePose, risePose, walkPose, collapsePose, applyPose, addPose, MOVE_LIST } from './skeleton.js';
import { createFX, sparks, puff, updateFX } from './fx.js';
import { SONGS, SONG_ORDER, parseSong } from './songs.js';
import * as A from './audio.js';
import { T } from './i18n.js';

const URL_TXT = '@Frank_AI_Lab';
const $ = id => document.getElementById(id);
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
let seed = (window.__sdSeed || (Date.now() & 0xffffff)) >>> 0;
function rng() { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const DIFF = {
  easy: { lanes: 4, fall: 2.3, tempo: .9, gap: 1, win: [.07, .13, .19], drain: .06, mult: 1, gain: .03 },
  medium: { lanes: 4, fall: 1.9, tempo: 1, gap: .75, win: [.055, .1, .15], drain: .085, mult: 1.2, gain: .025 },
  hard: { lanes: 4, fall: 1.55, tempo: 1.06, gap: .5, win: [.045, .085, .13], drain: .11, mult: 1.5, gain: .02 },
  kids: { lanes: 3, fall: 2.8, tempo: .82, gap: 1.5, win: [.11, .2, .32], drain: 0, mult: 1, gain: .04 }
};
const LANE_KEYS = { 4: [['ArrowLeft', 'KeyD', 'Digit1'], ['ArrowDown', 'KeyF', 'Digit2'], ['ArrowUp', 'KeyJ', 'Digit3'], ['ArrowRight', 'KeyK', 'Digit4']],
  3: [['ArrowLeft', 'KeyD', 'KeyF', 'Digit1'], ['ArrowUp', 'ArrowDown', 'Space', 'Digit2'], ['ArrowRight', 'KeyJ', 'KeyK', 'Digit3']] };
const LANE_DIR = { 4: ['left', 'down', 'up', 'right'], 3: ['left', 'up', 'right'] };
const DIR_COL = { left: '#c79bff', down: '#5fd3ff', up: '#7dffb4', right: '#ffb65e' };
const MOVE_EMO = { left: '⬅️', right: '➡️', up: '⬆️', down: '⬇️', spin: '🌀', claw: '🧟', skull: '💀', kick: '🦵', wave: '👋', ribs: '🦴' };
const SIG = ['spin', 'skull', 'kick', 'wave', 'ribs', 'claw'];
const S = {
  state: 'menu', mode: 'play', lang: ls.get('sd-lang', 'en'), diff: ls.get('sd-diff', 'medium'), kids: ls.get('sd-kids', '0') === '1', song: ls.get('sd-song', 'midnight'), q: ls.get('sd-q', ''), qUser: !!ls.get('sd-q', ''),
  score: 0, gt: 0, combo: 0, maxCombo: 0, hits: 0, judged: 0, accSum: 0, perfect: 0, groove: 1, songT: 0, newBest: false, best: 0, shake: 0, failed: false, finale: 0, crewN: 0, pel: 0, pressed: 0,
  name: ls.get('sd-name', 'Player') || 'Player', routine: [], formation: 'wedge', performing: false, energy: .3, swoop: 0, sigI: 0
};
if (!DIFF[S.diff] || S.diff === 'kids') S.diff = 'medium';
if (!SONGS[S.song]) S.song = 'midnight';
if (!QUALITY[S.q]) { S.q = 'mid'; S.qUser = false; }
const dkey = () => S.kids ? 'kids' : S.diff, D = () => DIFF[dkey()], bestKey = () => `sd-best-${S.song}-${dkey()}`;
A.setClock(() => S.gt);
const t = k => T[S.lang][k] || T.en[k] || k;
const songTitle = id => S.lang === 'de' ? SONGS[id].titleDe : SONGS[id].title;

// ---------------- renderer / scene ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__sdPDB }); // PDB only for deterministic frame capture
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const W = createWorld(renderer, QUALITY[S.q], 9); const scene = W.scene;
const camera = new THREE.PerspectiveCamera(45, 1, .1, 120);
const F = createFX(scene, W.soft, W.smokeTex);
let composer, bloom;
function buildComposer() {
  if (composer) composer.dispose();
  composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .32 * QUALITY[S.q].bloom, .4, .88); composer.addPass(bloom); composer.addPass(new OutputPass());
}
function applyQuality(qn, user) {
  S.q = qn; if (user) { S.qUser = true; ls.set('sd-q', qn); }
  const q = QUALITY[qn]; renderer.shadowMap.enabled = q.shadows; W.moon.castShadow = q.shadows;
  if (q.shadows) { W.moon.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (W.moon.shadow.map) { W.moon.shadow.map.dispose(); W.moon.shadow.map = null; } }
  W.fogs.forEach((f, i) => f.m.visible = i < (q.fog || 5)); W.wisps.visible = q.parts > .5;
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  buildComposer(); resize(); $('btnQ').textContent = '⚙ ' + t('q_' + qn);
}
let VW = 1, VH = 1;
const portrait = () => VW / VH < .85;
function resize() {
  VW = window.innerWidth; VH = window.innerHeight; const dpr = Math.min(window.devicePixelRatio || 1, QUALITY[S.q].dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false); if (composer) { composer.setPixelRatio(dpr); composer.setSize(VW, VH); }
  camera.aspect = VW / VH; camera.fov = portrait() ? 62 : 45; camera.updateProjectionMatrix();
  const lc = $('lanes'), d2 = Math.min(2, window.devicePixelRatio || 1); lc.width = VW * d2; lc.height = VH * d2; lc.style.width = VW + 'px'; lc.style.height = VH + 'px'; LG.dpr = d2; layout();
}

// ---------------- skeleton crew ----------------
const lead = createSkeleton(scene, { eye: '#ffb04a', hat: 'top', bow: true });
const LOOKS = [{ eye: '#7dff9a', hat: 'bowler' }, { eye: '#6ae8ff' }, { eye: '#b58cff', hat: 'bandana' }, { eye: '#7dff9a', scarf: true }, { eye: '#ff8a6a', hat: 'crown' }, { eye: '#6ae8ff', bow: true },
  { eye: '#7dff9a' }, { eye: '#b58cff', hat: 'bowler' }, { eye: '#6ae8ff', scarf: true }, { eye: '#7dff9a', hat: 'bandana' }, { eye: '#ff8a6a' }, { eye: '#b58cff', bow: true }];
const crew = LOOKS.map((o, i) => { const s = createSkeleton(scene, o); s.idx = i; return s; });
const ALL = [lead, ...crew];
const FORMS = {
  wedge: () => [[0, 1.35], [-1.15, .2], [1.15, .2], [-2.15, -.95], [-.72, -.95], [.72, -.95], [2.15, -.95], [-2.95, -2.05], [-1.77, -2.05], [-.59, -2.05], [.59, -2.05], [1.77, -2.05], [2.95, -2.05]],
  line: () => [[0, 1.35], ...[-.6, -1.8, 1.8, .6, -3, 3].map(x => [x, -.15]), ...[-.6, .6, -1.8, 1.8, -3, 3].map(x => [x, -1.45])],
  circle: () => [[0, -.35], ...Array.from({ length: 12 }, (_, i) => { const a = (i + .5) / 12 * Math.PI * 2 + Math.PI; return [Math.sin(a) * 2.95, Math.cos(a) * 2.6 - .35]; })]
};
function assignSlots() { const f = FORMS[S.formation](); ALL.forEach((s, i) => s.slot.set(f[i][0], 0, f[i][1])); }
// pair crew members with graves (closest spawn first, so they walk the shortest way)
{ assignSlots(); const free = W.graves.slice(); const order = crew.slice().sort((a, b) => Math.abs(b.slot.x) - Math.abs(a.slot.x));
  for (const s of order) { let bi = 0, bd = 1e9; free.forEach((g, i) => { const d = g.spawn.distanceTo(s.slot); if (d < bd) { bd = d; bi = i; } }); s.grave = free.splice(bi, 1)[0]; } }
function hideAll() { for (const s of ALL) { s.state = 'hidden'; s.root.visible = false; s.move = null; s.prev = null; s.collapse = 0; } S.crewN = 0; }
function placeDancing(s) { s.state = 'dance'; s.root.visible = true; s.pos.copy(s.slot); s.yaw = 0; }
function riseOne(s, fast = false) {
  if (s.state !== 'hidden') return; s.state = 'rising'; s.t = 0; s.riseD = fast ? 1.3 : 2.4; s.root.visible = true;
  if (s === lead) { s.from.copy(s.slot); s.face = 0; } else { s.from.copy(s.grave.spawn); s.face = Math.atan2(-s.from.x, -s.from.z); s.grave.crack = 1; }
  s.pos.copy(s.from); const pan = clamp(s.from.x / 7, -.8, .8); A.sfx.rise(pan);
  puff(F, s.from.clone().setY(.2), fast ? 3 : 5, '#5a4a3a', .7); sparks(F, s.from.clone().setY(.15), 26, { colors: ['#4a3a2a', '#6a5a48', '#2a2018'], speed: 2.2, up: 2.4, life: 1.1, grav: 6, size: .07 });
  if (s !== lead) S.crewN++;
}
function raiseCrew(n, fast = false) { let k = 0; for (const s of crew) { if (k >= n) break; if (s.state === 'hidden') { setTimer((fast ? .12 : .35) * k, () => riseOne(s, fast)); k++; } } return k; }
function doMove(name, dur = .55, who = 'all', ripple = .045) {
  const list = who === 'lead' ? [lead] : who === 'crew' ? crew : ALL;
  for (const s of list) { if (s.state !== 'dance') continue; const row = s === lead ? 0 : Math.round(Math.max(0, 1.35 - s.slot.z) / 1.1) + Math.abs(s.slot.x) * .15; const at = S.gt + (s === lead ? 0 : ripple * (1 + row));
    if (s.move) { const p = (S.gt - s.moveT) / s.moveD; if (p > 0 && p < 1) s.prev = { name: s.move, p, t: S.gt }; }
    s.move = name; s.moveT = at; s.moveD = dur; }
}
function stumble(s) { if (s.state !== 'dance') return; s.move = 'stumble'; s.moveT = S.gt; s.moveD = .55; s.prev = null; }
const _P = new THREE.Vector3();
function updateSkeleton(s, dt, beat, bar) {
  if (s.state === 'hidden') return;
  let P, x = s.pos.x, z = s.pos.z, yaw = s.yaw;
  if (s.state === 'rising') { s.t += dt; const p = clamp(s.t / s.riseD, 0, 1); P = risePose(p); yaw = s.face;
    if (Math.random() < dt * 12 * (1 - p)) sparks(F, s.from.clone().setY(.12), 2, { colors: ['#4a3a2a', '#6a5a48'], speed: 1.2, up: 1.6, life: .7, grav: 6, size: .05 });
    if (p >= 1) { if (s === lead) { s.state = 'dance'; s.pos.copy(s.slot); s.yaw = 0; } else { s.state = 'walk'; s.t = 0; s.walkD = Math.max(.9, s.from.distanceTo(s.slot) / 2.4); A.sfx.rattle(.22, clamp(x / 7, -.8, .8)); } } }
  else if (s.state === 'walk') { s.t += dt; const p = clamp(s.t / s.walkD, 0, 1), e = smooth(p); s.pos.lerpVectors(s.from, s.slot, e); x = s.pos.x; z = s.pos.z;
    const dir = Math.atan2(s.slot.x - s.from.x, s.slot.z - s.from.z); yaw = p < .8 ? dir : lerpAngle(dir, 0, smooth((p - .8) / .2)); s.yaw = yaw; P = walkPose(S.gt + s.seed);
    if (p >= 1) { s.state = 'dance'; s.yaw = 0; } }
  else { // dance / collapsed
    if (s.state === 'dance' && s.pos.distanceToSquared(s.slot) > 1e-4) { s.pos.lerp(s.slot, 1 - Math.exp(-dt * 3)); x = s.pos.x; z = s.pos.z; }
    P = idlePose(S.gt, beat, bar, S.energy * (s === lead ? 1.15 : 1), s.seed);
    if (s.prev) { const w = 1 - (S.gt - s.prev.t) / .14; if (w > 0) addPose(P, movePose(s.prev.name, s.prev.p), w); else s.prev = null; }
    if (s.move) { const p = (S.gt - s.moveT) / s.moveD; if (p >= 1) s.move = null; else if (p > 0) addPose(P, movePose(s.move, p), 1); }
    if (s.collapse > 0) { s.collapse = Math.min(1, s.collapse + dt * 1.6); const c = s.collapse; for (const k in P) if (Array.isArray(P[k])) P[k] = P[k].map(v => v * (1 - c)); else P[k] *= (1 - c); addPose(P, collapsePose(c), 1); }
    yaw = s.yaw;
  }
  const rr = Math.hypot(x, z); applyPose(s, P, x, z, yaw, 1, .1 * smooth((FLOOR_R + .3 - rr) / .3));
  // eyes flare with the crew's energy, gently
  const g = .7 + .25 * S.energy + .3 * (s.glow || 0); s.glow = Math.max(0, (s.glow || 0) - dt * 3); for (const e of s.eyes) { e.material.opacity = clamp(g, 0, 1) * (s.collapse > .5 ? .2 : 1); e.scale.setScalar(.045 + .02 * (s.glow || 0)); }
}
function lerpAngle(a, b, k) { let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * k; }

// ---------------- note highway (2D overlay, never bloomed) ----------------
const LG = { ctx: $('lanes').getContext('2d'), dpr: 1, x0: 0, lw: 80, top: 0, hit: 0, n: 4 };
function layout() { const n = D().lanes; LG.n = n; const pt = portrait();
  LG.side = !pt && VW >= 820; LG.lw = pt ? Math.min(VW * (n === 3 ? .25 : .2), 100) : Math.min(n === 3 ? 104 : 86, VW * .085 + 18);
  LG.x0 = (LG.side ? VW * .76 : VW / 2) - LG.lw * n / 2; LG.hit = VH - (pt ? Math.max(110, VH * .13) : Math.max(92, VH * .13)); LG.top = pt ? VH * .5 : VH * .26; }
const laneX = i => LG.x0 + (i + .5) * LG.lw;
function arrowPath(g, s) { // chunky arrow pointing up, centred
  g.beginPath(); g.moveTo(0, -s); g.lineTo(s * .92, -s * .04); g.lineTo(s * .4, -s * .04); g.lineTo(s * .4, s * .82); g.quadraticCurveTo(0, s * 1.02, -s * .4, s * .82); g.lineTo(-s * .4, -s * .04); g.lineTo(-s * .92, -s * .04); g.closePath(); }
const ROT = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
function drawArrow(g, x, y, dir, s, fill, alpha, outline = true) {
  g.save(); g.translate(x, y); g.rotate(ROT[dir]); g.globalAlpha = alpha; arrowPath(g, s);
  if (fill) { const gr = g.createLinearGradient(0, -s, 0, s); gr.addColorStop(0, '#fff8ea'); gr.addColorStop(.35, fill); gr.addColorStop(1, shade(fill, .55)); g.fillStyle = gr; g.fill(); g.lineWidth = Math.max(2.5, s * .13); g.strokeStyle = 'rgba(16,8,30,.92)'; g.stroke(); g.lineWidth = Math.max(1, s * .05); g.strokeStyle = 'rgba(255,255,255,.65)'; arrowPath(g, s * .78); g.stroke(); }
  else { g.lineWidth = Math.max(3, s * .14); g.strokeStyle = 'rgba(16,8,30,.75)'; g.stroke(); g.lineWidth = Math.max(2, s * .08); g.strokeStyle = outline; g.stroke(); }
  g.restore(); }
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }
const laneFlash = [0, 0, 0, 0];
function drawLanes() {
  const g = LG.ctx, d = LG.dpr; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, VW, VH);
  if (S.state !== 'play' || S.finale) return;
  const n = LG.n, dirs = LANE_DIR[n], s = LG.lw * .34, fall = D().fall;
  // lane backdrop
  const gr = g.createLinearGradient(0, LG.top - 40, 0, VH); gr.addColorStop(0, 'rgba(8,6,20,0)'); gr.addColorStop(.25, 'rgba(8,6,20,.26)'); gr.addColorStop(1, 'rgba(8,6,20,.48)'); g.fillStyle = gr; g.fillRect(LG.x0 - 8, LG.top - 40, LG.lw * n + 16, VH - LG.top + 40);
  for (let i = 0; i < n; i++) { const x = laneX(i), col = DIR_COL[dirs[i]]; laneFlash[i] = Math.max(0, laneFlash[i] - 1 / 30 * 4);
    if (laneFlash[i] > 0) { const lg = g.createLinearGradient(0, LG.hit, 0, LG.top); lg.addColorStop(0, hexA(col, .22 * laneFlash[i])); lg.addColorStop(1, hexA(col, 0)); g.fillStyle = lg; g.fillRect(x - LG.lw / 2 + 3, LG.top, LG.lw - 6, LG.hit - LG.top + s); }
    if (i) { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x - LG.lw / 2 - .5, LG.top, 1, VH - LG.top); } }
  // beat lines
  const spb = 60 / (song.bpm * D().tempo); for (let b = Math.ceil(S.songT / spb); b * spb < S.songT + fall; b++) { if (b < 0) continue; const y = LG.hit - (b * spb - S.songT) / fall * (LG.hit - LG.top); g.fillStyle = b % 3 === 0 ? 'rgba(220,210,255,.2)' : 'rgba(220,210,255,.07)'; g.fillRect(LG.x0, y - (b % 3 ? .5 : 1), LG.lw * n, b % 3 ? 1 : 2); }
  // receptors
  for (let i = 0; i < n; i++) { const f = laneFlash[i]; drawArrow(g, laneX(i), LG.hit, dirs[i], s * (1 + f * .18), null, .95, f > .05 ? DIR_COL[dirs[i]] : 'rgba(235,228,210,.75)'); }
  // falling arrows
  for (const nt of chart) { if (nt.hit || nt.missed) continue; const dtn = nt.t - S.songT; if (dtn > fall + .1) break; const k = dtn / fall, y = LG.hit - k * (LG.hit - LG.top);
    const a = clamp((1 - k) * 5, 0, 1) * (dtn < -D().win[1] ? .5 : 1); const dir = dirs[nt.lane]; drawArrow(g, laneX(nt.lane), y, dir, s * (1 - Math.max(0, k) * .12), DIR_COL[dir], a); }
}
function hexA(hex, a) { const c = new THREE.Color(hex); return `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`; }

// ---------------- song / chart / music ----------------
let song = null, chart = [], mus = [], musI = 0, spb = .43;
function buildChart() {
  song = parseSong(S.song); const d = D(); spb = 60 / (song.bpm * d.tempo); const n = d.lanes;
  chart = []; mus = []; musI = 0; let last = -99;
  // lanes from the melody contour: rank each pitch within its section
  const secP = {}; for (const e of song.mel) (secP[e.sec] = secP[e.sec] || new Set()).add(e.m);
  const rank = {}; for (const k in secP) rank[k] = [...secP[k]].sort((a, b) => a - b);
  let prevLane = -1, run = 0;
  for (const e of song.mel) {
    const tt = e.beat * spb, dur = e.dur * spb;
    const lastSec = e.sec === song.sections.length - 1;
    const onBeat = Math.abs(e.beat - Math.round(e.beat)) < .01;
    const want = e.beat - last >= d.gap - 1e-6 && (d.gap < 1 || onBeat) && !(lastSec && e.bar === song.bars - 1);
    if (want) { let lane; if (e.lane >= 0) lane = Math.min(n - 1, Math.round(e.lane / 3 * (n - 1)));
      else { const R = rank[e.sec]; lane = R.length <= 1 ? 0 : Math.min(n - 1, Math.floor(R.indexOf(e.m) / R.length * n)); }
      if (lane === prevLane) { run++; if (run >= (S.kids || S.diff === 'easy' ? 2 : 3)) { lane = (lane + 1 + (e.bar % 2)) % n; run = 0; } } else run = 0;
      prevLane = lane; chart.push({ t: tt, lane, m: e.m, ins: e.ins, dur, hit: false, missed: false }); last = e.beat; }
    else mus.push({ t: tt, f: dl => A.melody(e.ins, e.m, lastSec ? .8 : .5, dur, dl) });
  }
  scheduleBand(song, mus, spb, 1);
  mus.sort((a, b) => a.t - b.t); song.len2 = song.beats * spb;
}
// waltz accompaniment from the chord track
function scheduleBand(sg, out, spb, vol, offset = 0) {
  const act = sg.act, secStart = {}; sg.acc.forEach(a => { if (secStart[a.sec] === undefined) secStart[a.sec] = a.bar; });
  const last = sg.sections.length - 1;
  for (const a of sg.acc) {
    const t0 = offset + a.beat * spb, rel = a.bar - secStart[a.sec], ins = a.ins, finalBar = a.bar === sg.bars - 1;
    const bassV = (ins === 'tt' ? .45 : .6) * vol, pzV = (ins === 'tt' ? .12 : act === 1 ? .2 : .24) * vol;
    out.push({ t: t0, f: dl => A.band.bass(a.bass + (a.bass < 30 ? 12 : 0), bassV, dl) });
    if (!finalBar) { for (const b of [1, 2]) out.push({ t: t0 + b * spb, f: dl => A.band.pizz(a.ch, pzV, dl) }); }
    if (act >= 2 && ins !== 'tt' && !finalBar) for (const b of [1, 2]) out.push({ t: t0 + b * spb, f: dl => A.band.bone(.15 * vol, dl, b === 2) });
    if (act === 3 && !finalBar) { out.push({ t: t0, f: dl => A.band.bd(.32 * vol, dl) }); out.push({ t: t0 + 2.5 * spb, f: dl => A.band.bone(.09 * vol, dl, 1) }); }
    if (rel % 4 === 0 && ins !== 'bone') out.push({ t: t0, f: dl => A.band.timp(a.bass, (.36 + act * .05) * vol, dl) });
    if (rel === 0 && a.sec >= 2 && act >= 2) out.push({ t: t0, f: dl => A.band.crash(.22 * vol, dl) });
    if (a.sec === last - 1 && a.bar === secStart[last] - 2 && act >= 2) out.push({ t: t0, f: dl => A.band.snroll(.3 * vol, dl) });
    if (a.sec === last && rel === 0) out.push({ t: t0, f: dl => { A.band.roll(.4 * vol, dl); A.band.crash(.35 * vol, dl); } });
    if (finalBar) out.push({ t: t0, f: dl => { A.band.timp(31, .55 * vol, dl); A.band.pizz(a.ch.map(m => m + 12), .3 * vol, dl); A.band.bass(a.bass + 12, .6 * vol, dl); A.play('gong', .3 * vol, 1, dl, .5); A.play('crash', .3 * vol, 1, dl, .4); } });
    if (ins === 'hp' && rel === 0) out.push({ t: t0, f: dl => A.play('tproll', .18 * vol, .8, dl, .5) });
  }
}
function runMusic(list, idx, now, la = .06) { while (idx < list.length && list[idx].t <= now + la) { const e = list[idx++]; e.f(Math.max(0, e.t - now)); } return idx; }

// ---------------- game flow ----------------
const timers = []; function setTimer(dt, f) { timers.push({ t: S.gt + dt, f }); }
function resetRun() {
  S.score = 0; S.combo = 0; S.maxCombo = 0; S.hits = 0; S.judged = 0; S.accSum = 0; S.perfect = 0; S.groove = 1; S.newBest = false; S.failed = false; S.finale = 0; S.pel = 0; S.pressed = 0; S.energy = .3; S.sigI = 0; S.swoop = 0;
  S.best = +ls.get(bestKey(), 0); timers.length = 0; W.cracks.forEach(c => { c.k = 0; c.m.opacity = 0; }); W.fogBurst = 0; W.graves.forEach(g => { g.crack = 0; g.mound.scale.set(1, 1, 1); });
}
function start(mode) {
  A.unlock(); S.mode = mode || 'play'; resetRun(); hideAll(); S.formation = S.mode === 'build' ? (ls.get('sd-form', 'wedge')) : 'wedge'; if (!FORMS[S.formation]) S.formation = 'wedge'; assignSlots();
  if (S.mode === 'build') { S.state = 'build'; loop.reset(); S.performing = false; S.bar0 = -1; raiseCrew(12, true); riseOne(lead, true); S.energy = .7; renderBuilder(); }
  else { S.state = 'play'; buildChart(); layout(); S.songT = -(D().fall + 1.6); setTimer(.25, () => { riseOne(lead); openCrack(W, 0); }); if (S.kids) A.sfx.kids(); }
  A.sfx.start(); show(null); hud();
}
function judge(dt) { const w = D().win; const a = Math.abs(dt); return a <= w[0] ? 0 : a <= w[1] ? 1 : a <= w[2] ? 2 : 3; }
const JW = [1, .7, .4, 0], JP = [300, 200, 100, 0], JK = ['perfect', 'great', 'good', 'miss'], JC = ['#fff2a8', '#b8ffcf', '#a8d8ff', '#ffb0b0'];
function lanePress(i) {
  if (S.state !== 'play' || S.finale || i < 0 || i >= D().lanes) return; laneFlash[i] = 1; S.pressed++;
  let best = null, bd = 9; for (const n of chart) { if (n.hit || n.missed || n.lane !== i) continue; const d = S.songT - n.t; if (Math.abs(d) < Math.abs(bd)) { bd = d; best = n; } if (n.t > S.songT + 1) break; }
  if (best && Math.abs(bd) <= D().win[2]) hitNote(best, judge(bd));
  else { A.play('cl_2', .12, .8, 0, .2); }
}
function hitNote(n, j) {
  n.hit = true; S.lastJ = JK[j]; A.melody(n.ins, n.m, j === 0 ? .9 : j === 1 ? .8 : .68, n.dur);
  S.judged++; S.hits++; S.accSum += JW[j]; if (j === 0) S.perfect++;
  S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo); const cm = 1 + Math.min(S.combo, 40) / 20;
  S.score += Math.round(JP[j] * cm * D().mult * (1 + S.crewN * .02)); S.groove = Math.min(1, S.groove + D().gain);
  const dir = LANE_DIR[D().lanes][n.lane]; const sig = S.combo >= 12 && S.combo % 12 === 0;
  const mv = sig ? SIG[S.sigI++ % SIG.length] : dir;
  if (!lead.move || (S.gt - lead.moveT) / lead.moveD > .38 || sig) doMove(mv, sig ? 1.15 : .5, 'all');
  lead.glow = 1; const at = lead.pos.clone().setY(.15);
  sparks(F, at, j === 0 ? 18 : 10, { colors: [DIR_COL[dir], '#ffffff'], speed: 1.6, up: 1.4, life: .6, grav: 3, size: .09 });
  W.react = Math.min(1, W.react + (j === 0 ? .3 : .18));
  popText(t(JK[j]), JC[j], j === 0 ? 1.05 : .9, n.lane);
  comboEvents();
}
function missNote(n) {
  n.missed = true; S.lastJ = 'miss'; S.judged++; if (S.kids) { A.melody(n.ins, n.m, .4, n.dur); S.accSum += .25; return; }
  A.sfx.miss(); if (S.combo >= 10) A.sfx.stumble(); S.combo = 0;
  popText(t('miss'), JC[3], .8, n.lane); stumble(lead); if (S.crewN && rng() < .5) { const c = crew.filter(s => s.state === 'dance'); if (c.length) stumble(c[Math.floor(rng() * c.length)]); }
  S.groove = Math.max(0, S.groove - D().drain); S.shake = Math.max(S.shake, .2); $('hGrooveBox').classList.remove('bad'); void $('hGrooveBox').offsetWidth; $('hGrooveBox').classList.add('bad');
  if (S.groove <= 0 && D().drain > 0 && !S.failed) fail();
}
function fail() { S.failed = true; toast(t('failed')); A.sfx.fail(); for (const s of ALL) if (s.state !== 'hidden') { s.state = 'dance'; s.move = null; s.collapse = .001; } setTimer(2.2, () => end()); }
const CREW_AT = [[4, 2], [10, 2], [16, 2], [24, 3], [32, 3]];
function comboEvents() {
  const c = S.kids ? S.hits : S.combo;
  for (const [k, n] of CREW_AT) if (c === k && S.crewN < crew.length) { const before = S.crewN; raiseCrew(n); banner(t(before === 0 ? 'rise' : 'rise2'));
    if (k === 16) { openCrack(W, 1); A.sfx.crack(); W.fogBurst = 1; A.sfx.fog(); S.shake = .5; S.swoop = 1; }
    if (k === 24) { lightning(W, rng); A.sfx.thunder(); S.shake = .4; banner(t('storm')); }
    if (k === 32) { setTimer(1.2, () => { openCrack(W, 2); lightning(W, rng); A.sfx.full(); A.sfx.thunder(); banner(t('full')); S.swoop = 1.3; doMove('claw', 1.6, 'all'); }); } }
  if (S.combo === 20 || (S.combo > 20 && S.combo % 25 === 0)) { A.sfx.combo(S.combo >= 50 ? 2 : 1); }
  if (S.combo === 50 || S.combo === 75 || S.combo === 100) { lightning(W, rng); A.sfx.thunder(); A.sfx.crowd(.4); S.swoop = 1; }
}
function finale() { // the whole crew rises, forms up and strikes the Thriller-style claw routine
  S.finale = S.gt; const left = crew.filter(s => s.state === 'hidden').length; raiseCrew(12, true); banner(t('finale'));
  openCrack(W, 0); openCrack(W, 1); openCrack(W, 2); setTimer(.15, () => { lightning(W, rng); A.sfx.thunder(); }); W.fogBurst = 1.2; A.sfx.fog(); A.sfx.crowd(.55); S.swoop = 1.6;
  const d0 = left ? 2.6 : .5; setTimer(d0, () => doMove('claw', 1.7, 'all')); setTimer(d0 + 1.8, () => doMove('claw', 1.7, 'all')); setTimer(d0 + 3.6, () => { doMove('bow', 1.6, 'all'); A.sfx.crowd(.45); });
  setTimer(d0 + 4.9, () => end());
}
function end() {
  if (S.state === 'end') return; const prev = S.state; S.state = 'end';
  if (S.mode === 'play') { const acc = S.judged ? S.accSum / S.judged : 0; S.acc = acc;
    if (S.score > S.best) { S.best = S.score; S.newBest = S.score > 0; ls.set(bestKey(), S.score); }
    let grade = S.failed ? 'D' : acc >= .95 ? 'S' : acc >= .85 ? 'A' : acc >= .7 ? 'B' : acc >= .5 ? 'C' : 'D'; if (S.kids && 'CD'.includes(grade)) grade = 'B'; S.grade = grade;
    A.sfx.end(S.newBest);
    $('eTitle').textContent = S.failed ? t('failed') : S.kids ? t('kidsOver') : t('over'); $('eScore').textContent = S.score; $('eGrade').textContent = grade; $('eGrade').dataset.g = grade;
    $('eBest').textContent = S.newBest ? t('newBest') : `${t('best')}: ${S.best}`;
    $('eStats').textContent = `${songTitle(S.song)} · ${Math.round(acc * 100)}% · ${S.maxCombo} ${t('maxCombo')} · 💀 ${S.crewN + 1}/13`;
  } else { S.grade = ''; $('eTitle').textContent = t('buildOver'); $('eScore').textContent = S.routine.map(m => MOVE_EMO[m]).join('') || '💀'; $('eGrade').textContent = ''; $('eBest').textContent = ''; $('eStats').textContent = `${t('routine')}: ${S.routine.length} ${t('notes')} · ${t('f_' + S.formation)}`; S.performing = false; }
  $('eScore').classList.toggle('emo', S.mode === 'build'); $('eName').value = S.name; show('end');
}
function toMenu() { S.state = 'menu'; S.mode = 'play'; timers.length = 0; hideAll(); S.formation = 'wedge'; assignSlots(); for (const s of [lead, crew[0], crew[1], crew[3], crew[4], crew[5], crew[6]]) placeDancing(s); S.crewN = 6; S.energy = .6; show('menu'); loop.reset(); }

// ---------------- looping music for menu + Dance Builder ----------------
const loop = { sg: null, ev: [], i: 0, t: 0, len: 0, spb: 0, bar: -1,
  reset() { const base = parseSong('midnight'); const keep = new Set([2, 3, 4]); const bars0 = base.mel.find(e => e.sec === 2).bar; const sg = { ...base, act: 2, bpm: 144, sections: base.sections, acc: base.acc.filter(a => keep.has(a.sec)).map(a => ({ ...a, bar: a.bar - bars0, beat: a.beat - bars0 * 3 })), bars: 40 };
    this.spb = 60 / 144; this.ev = []; for (const e of base.mel) if (keep.has(e.sec)) { const b = e.beat - bars0 * 3; this.ev.push({ t: b * this.spb, f: dl => A.melody(e.ins, e.m, .55 * this.vol, e.dur * this.spb, dl) }); }
    scheduleBand({ ...sg, bars: 1e6, sections: [{}, {}, {}, {}, {}, {}] }, this.ev, this.spb, 1, 0); this.ev.forEach(e => { const f = e.f; e.f = dl => { if (this.vol > .02) f(dl); }; });
    this.ev.sort((a, b) => a.t - b.t); this.len = 40 * 3 * this.spb; this.t = -.3; this.i = 0; this.bar = -1; },
  vol: 1,
  step(dt) { this.t += dt; if (this.t >= this.len) { this.t -= this.len; this.i = 0; } this.i = runMusic(this.ev, this.i, this.t); const bar = Math.floor(this.t / (3 * this.spb)); const nb = bar !== this.bar; this.bar = bar; return nb; },
  beat() { return Math.max(0, this.t) / this.spb; }
};

// ---------------- UI ----------------
function show(id) { for (const s of ['menu', 'end']) $(s).classList.toggle('show', s === id); $('build').classList.toggle('show', S.state === 'build'); document.body.dataset.state = S.state; document.body.dataset.mode = S.mode; document.body.classList.toggle('kids', S.kids); }
function hud() {
  $('hScore').textContent = S.score; $('hCombo').textContent = S.combo; $('hAcc').textContent = S.judged ? Math.round(S.accSum / S.judged * 100) + '%' : '–';
  $('hGroove').style.width = Math.round(S.groove * 100) + '%'; $('hGrooveBox').classList.toggle('low', S.groove < .3); $('hCrew').textContent = (S.crewN + (lead.state !== 'hidden' ? 1 : 0)) + '/13';
  $('hProg').style.width = (S.state === 'play' && song ? clamp(S.songT / song.len2, 0, 1) * 100 : 0) + '%';
}
function applyLang() {
  document.documentElement.lang = S.lang; document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t));
  $('h3').textContent = S.kids ? t('h3k') : t('h3'); $('btnLang').textContent = S.lang === 'en' ? 'DE' : 'EN';
  $('btnKids').classList.toggle('on', S.kids); $('btnKids').setAttribute('aria-pressed', S.kids);
  document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('on', b.dataset.d === S.diff)); $('diff').style.display = S.kids ? 'none' : '';
  document.querySelectorAll('#songs button').forEach(b => { const id = b.dataset.s; b.classList.toggle('on', id === S.song); b.querySelector('b').textContent = songTitle(id); const best = +ls.get(`sd-best-${id}-${dkey()}`, 0); b.querySelector('small').textContent = t('a' + SONGS[id].act) + (best ? ` · 🏆 ${best}` : ''); });
  $('btnSound').classList.toggle('on', !A.isMuted()); $('btnSound').textContent = A.isMuted() ? '🔇' : '🔊'; $('btnQ').textContent = '⚙ ' + t('q_' + S.q); renderBuilder(); hud();
}
function popText(txt, col, big = 1, lane = -1) {
  if (lane >= 0) { const o = $('pops').querySelector('.pop.j'); if (o) o.remove(); }
  const el = document.createElement('div'); el.className = 'pop' + (lane >= 0 ? ' j' : ''); el.textContent = txt;
  const x = lane >= 0 ? LG.x0 + LG.lw * LG.n / 2 : VW / 2, y = lane >= 0 ? LG.hit - LG.lw * 1.05 : VH * .3;
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.color = col; el.style.fontSize = (26 * big * (VW < 600 ? .78 : 1)) + 'px'; $('pops').appendChild(el); setTimeout(() => el.remove(), 1100);
}
function banner(s) { (window.__banners = window.__banners || []).push(s); const el = $('banner'); el.textContent = s; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
function toast(s) { const el = $('toast'); el.textContent = s; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); }
// Dance Builder panel
function renderBuilder() {
  const pal = $('bPal'); if (!pal.children.length) MOVE_LIST.forEach((m, i) => { const b = document.createElement('button'); b.dataset.m = m; b.innerHTML = `<span>${MOVE_EMO[m]}</span><small></small>`; b.onclick = () => addMove(m); pal.appendChild(b); });
  pal.querySelectorAll('button').forEach(b => b.querySelector('small').textContent = t('m_' + b.dataset.m));
  const sl = $('bSlots'); sl.innerHTML = ''; for (let i = 0; i < 8; i++) { const d = document.createElement('div'); d.className = 'slot' + (S.routine[i] ? ' full' : '') + (S.performing && S.routine.length && i === S.slotI ? ' now' : ''); d.textContent = S.routine[i] ? MOVE_EMO[S.routine[i]] : ''; d.onclick = () => { if (S.routine[i]) { S.routine.splice(i, 1); A.sfx.ui(); renderBuilder(); } }; sl.appendChild(d); }
  $('bPlay').textContent = S.performing ? t('bStop') : t('bPlay'); $('bForm').textContent = `${t('bForm')}: ${t('f_' + S.formation)}`;
}
function addMove(m) { if (S.state !== 'build') return; A.unlock(); if (S.routine.length < 8) S.routine.push(m); A.sfx.ui(); if (!S.performing) doMove(m, 1.1, 'all', .05); renderBuilder(); }
function perform(on) { if (on && !S.routine.length) { toast(t('bEmpty')); return; } S.performing = on; S.slotI = -1; S.passes = 0; renderBuilder(); }
function randomRoutine() { S.routine = Array.from({ length: 8 }, () => MOVE_LIST[Math.floor(rng() * MOVE_LIST.length)]); A.sfx.rattle(.3); renderBuilder(); }
function cycleForm() { const o = ['wedge', 'line', 'circle']; S.formation = o[(o.indexOf(S.formation) + 1) % 3]; ls.set('sd-form', S.formation); assignSlots(); A.sfx.rattle(.25); renderBuilder(); }
function builderBar() { if (!S.performing || !S.routine.length) return; S.slotI = (S.slotI + 1) % S.routine.length; doMove(S.routine[S.slotI], loop.spb * 3 * .94, 'all', .05);
  if (S.slotI === S.routine.length - 1) { S.passes++; const k = S.passes % 3; setTimer(loop.spb * 3, () => { if (S.state !== 'build') return; if (k === 1) { lightning(W, rng); A.sfx.thunder(); } else if (k === 2) { W.fogBurst = 1; A.sfx.fog(); } else { openCrack(W, S.passes % 3); A.sfx.crack(); } A.sfx.crowd(.3); S.swoop = 1; }); }
  renderBuilder(); }

// ---------------- input ----------------
let isTouch = false;
function laneAt(x, y) { if (y < LG.top - 60) return -1; const i = Math.floor((x - LG.x0) / LG.lw); if (i >= 0 && i < LG.n) return i; if (portrait() || isTouch) return clamp(i, 0, LG.n - 1); return -1; }
canvas.addEventListener('pointerdown', e => { A.unlock(); isTouch = e.pointerType === 'touch'; e.preventDefault(); if (S.state === 'play') { const i = laneAt(e.clientX, e.clientY); if (i >= 0) lanePress(i); } });
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return; if (e.repeat) return; A.unlock();
  if (e.code === 'Enter' && S.state === 'menu') { start('play'); return; }
  if (e.code === 'Escape') { if (S.state === 'play') { if (!S.finale) end(); return; } if (S.state === 'build') { end(); return; } }
  if (S.state === 'play') { const ks = LANE_KEYS[D().lanes]; const i = ks.findIndex(k => k.includes(e.code)); if (i >= 0) { e.preventDefault(); lanePress(i); } }
  else if (S.state === 'build') { const d = /^Digit(\d)$/.exec(e.code); if (d) { const k = (+d[1] + 9) % 10; addMove(MOVE_LIST[k]); } else if (e.code === 'Backspace') { S.routine.pop(); renderBuilder(); } else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); perform(!S.performing); }
    else { const m = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.code]; if (m) { e.preventDefault(); addMove(m); } } }
});
$('btnPlay').onclick = () => start('play'); $('btnBuild').onclick = () => start('build');
$('btnAgain').onclick = () => start(S.mode); $('btnMenu').onclick = () => { A.sfx.ui(); toMenu(); }; $('btnQuit').onclick = () => { if (S.state === 'play' && !S.finale) end(); else if (S.state === 'build') end(); };
$('btnCard').onclick = () => saveCard(false); $('btnShare').onclick = () => saveCard(true);
$('btnLang').onclick = () => { S.lang = S.lang === 'en' ? 'de' : 'en'; ls.set('sd-lang', S.lang); applyLang(); A.sfx.ui(); };
document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { S.diff = b.dataset.d; ls.set('sd-diff', S.diff); applyLang(); A.unlock(); A.sfx.ui(); });
document.querySelectorAll('#songs button').forEach(b => b.onclick = () => { S.song = b.dataset.s; ls.set('sd-song', S.song); applyLang(); A.unlock(); A.sfx.ui(); doMove(['spin', 'kick', 'claw'][SONGS[S.song].act - 1], 1.1); });
$('btnKids').onclick = () => { S.kids = !S.kids; ls.set('sd-kids', S.kids ? '1' : '0'); applyLang(); A.unlock(); A.sfx.ui(); };
$('btnSound').onclick = () => { A.unlock(); A.setMuted(!A.isMuted()); applyLang(); };
$('btnQ').onclick = () => { const o = ['low', 'mid', 'high', 'ultra']; applyQuality(o[(o.indexOf(S.q) + 1) % 4], true); };
$('bPlay').onclick = () => { A.unlock(); perform(!S.performing); }; $('bClear').onclick = () => { S.routine = []; perform(false); }; $('bRandom').onclick = () => { A.unlock(); randomRoutine(); }; $('bForm').onclick = cycleForm; $('bDone').onclick = () => end();
$('eName').addEventListener('keydown', e => e.stopPropagation());
window.addEventListener('resize', resize);
document.addEventListener('pointerdown', () => A.unlock(), { once: true });

// ---------------- share card ----------------
async function saveCard(share) {
  S.name = ($('eName').value || '').trim() || 'Player'; ls.set('sd-name', S.name);
  try { await document.fonts.load('700 40px Fredoka'); } catch (e) {}
  const CW = 1080, CH = 1350;
  renderer.setPixelRatio(1); renderer.setSize(CW, CH, false); composer.setPixelRatio(1); composer.setSize(CW, CH); bloom.strength = .26;
  const old = { a: camera.aspect, f: camera.fov, p: camera.position.clone(), q: camera.quaternion.clone() };
  camera.clearViewOffset(); camera.aspect = CW / CH; camera.fov = 50; camera.updateProjectionMatrix(); camera.position.set(1.2, 2.0, 7.4); camera.lookAt(0, 1.05, -.6); composer.render();
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const k = c.getContext('2d'); k.drawImage(renderer.domElement, 0, 0, CW, CH);
  camera.aspect = old.a; camera.fov = old.f; camera.position.copy(old.p); camera.quaternion.copy(old.q); resize();
  const gr = k.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, 'rgba(6,6,18,.88)'); gr.addColorStop(.27, 'rgba(6,6,18,.05)'); gr.addColorStop(.74, 'rgba(6,6,18,.1)'); gr.addColorStop(1, 'rgba(6,6,18,.92)'); k.fillStyle = gr; k.fillRect(0, 0, CW, CH);
  const Fo = (w, s) => `${w} ${s}px Fredoka, "Arial Rounded MT Bold", sans-serif`; k.textAlign = 'center'; k.lineJoin = 'round';
  const txt = (s, x, y, fill, stroke = 'rgba(10,8,26,.85)', lw = 8) => { k.strokeStyle = stroke; k.lineWidth = lw; k.strokeText(s, x, y); k.fillStyle = fill; k.fillText(s, x, y); };
  k.font = Fo(700, 92); txt('💀 Skeleton Dance', CW / 2, 125, '#efe6d2', 'rgba(26,12,50,.9)', 10);
  k.font = Fo(500, 44); txt(S.name.slice(0, 18), CW / 2, 200, '#ffffff');
  if (S.mode === 'build') { k.font = Fo(700, 70); txt(S.routine.map(m => MOVE_EMO[m]).join(' ') || '💀', CW / 2, 292, '#fff0c8'); k.font = Fo(500, 34); txt(`${t('bTitle')} · ${t('f_' + S.formation)}`, CW / 2, 348, '#e8dcff'); }
  else { k.font = Fo(700, 72); txt(`${S.score}${S.grade ? '  ·  ' + S.grade : ''}`, CW / 2, 290, '#fff0c8');
    k.font = Fo(500, 34); txt(`${songTitle(S.song)} · ${S.kids ? t('kids') : t('d_' + S.diff)} · 💀 ${S.crewN + 1}/13${S.newBest ? ' · ' + t('newBest') : ''}`, CW / 2, 345, '#e8dcff'); }
  k.font = Fo(600, 48); txt(t('cardTag'), CW / 2, 1230, '#ffd27a');
  k.font = Fo(400, 32); txt(t('cardPlay') + ' · ' + URL_TXT, CW / 2, 1290, 'rgba(255,255,255,.92)');
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); window.__sdCard = { w: c.width, h: c.height };
  const file = new File([blob], 'skeleton-dance.png', { type: 'image/png' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `Skeleton Dance — ${t('cardTag')} ${URL_TXT}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'skeleton-dance.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast(t('saved'));
}

// ---------------- simulation ----------------
const camPos = new THREE.Vector3(0, 2.6, 9.5), look = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _l = new THREE.Vector3();
let owlT = 25, menuMoveI = 0;
function playStep(dt) {
  S.songT += dt; const d = D();
  musI = runMusic(mus, musI, S.songT);
  for (const n of chart) { if (n.hit || n.missed) continue; const dtn = n.t - S.songT; if (dtn > 0) break; if (dtn < -d.win[2]) missNote(n); }
  if (!S.finale && !S.failed && S.songT > song.len2 + .1) finale();
  const beat = S.songT / spb; return beat;
}
function keepClear(p) { // camera never enters props (graves, trees, crypt, lanterns) or the ground
  for (const c of W.colliders) { _v.subVectors(p, c.p); _v.y *= .5; const dd = _v.length(), m = c.r + .9; if (dd < m) p.addScaledVector(_v.normalize(), m - dd); }
  p.y = Math.max(p.y, .7); return p; }
function step(dt) {
  dt = Math.max(0, Math.min(dt || 0, 1 / 20)); S.gt += dt; S.pel += dt; // rAF stamps can precede performance.now(): never step backwards
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i].t <= S.gt) { const f = timers[i].f; timers.splice(i, 1); f(); }
  const st = S.state; let beat = 0, bar = 0;
  if (st === 'play') { beat = Math.max(0, playStep(dt)); bar = Math.floor(beat / 3); S.energy = lerp(S.energy, clamp(.35 + S.combo / 40 + S.crewN / 24, .3, 1.1), dt * 1.5); }
  else { loop.vol = st === 'build' ? .9 : st === 'menu' ? .55 : .35; const nb = loop.step(dt); beat = loop.beat(); bar = Math.floor(beat / 3);
    if (nb && st === 'build') builderBar(); if (nb && st === 'menu' && bar % 2 === 0) { doMove(['left', 'right', 'up', 'down', 'spin', 'claw', 'kick', 'wave'][menuMoveI++ % 8], loop.spb * 3 * .9, 'all', .06); } }
  for (const s of ALL) updateSkeleton(s, dt, beat, bar);
  // graves crumble while their skeleton digs out
  for (const g of W.graves) { if (g.crack > 0) { g.crack = Math.max(0, g.crack - dt * .35); g.mound.scale.set(1 + (1 - g.crack) * .25, 1 - (1 - g.crack) * .45, 1); } }
  // camera: cinematic arc in front of the crew (never behind the graves), swoops on big moments
  const pt = portrait(); S.swoop = Math.max(0, S.swoop - dt * .45); const sw = smooth(Math.min(1, S.swoop));
  if (st === 'play' || st === 'build') { const az = Math.sin(S.gt * .11) * .38 + Math.sin(S.gt * .043) * .12; const R = (pt ? 9.8 : 8.2) - S.crewN * .02 - sw * 2.0; const h = (pt ? 3.2 : 2.6) - sw * .8;
    _v.set(Math.sin(az) * R, h + Math.sin(S.gt * .2) * .12, Math.cos(az) * R + .4); _l.set(Math.sin(az) * -.6, pt ? .9 : .75 + sw * .3, -.6);
    if (S.finale) { const a = .35 * Math.sin((S.gt - S.finale) * .25); _v.set(Math.sin(a) * (pt ? 11.5 : 9.4), pt ? 3.2 : 2.6, Math.cos(a) * (pt ? 11.5 : 9.4)); _l.set(0, pt ? .7 : 1.0, -.8); }
    if (st === 'build') { _l.y = pt ? .2 : .75; if (!pt) _v.y += .2; } }
  else if (st === 'menu') { const a = Math.sin(S.gt * .07) * .6; const R = pt ? 12 : 9.6; _v.set(Math.sin(a) * R, pt ? 3.4 : 2.5 + Math.sin(S.gt * .1) * .2, Math.cos(a) * R); _l.set(0, pt ? .8 : 1.0, -1.0); }
  else { const a = .45 + Math.sin(S.gt * .07) * .2; const R = pt ? 11.5 : 9.0; _v.set(Math.sin(a) * R, pt ? 3.0 : 2.4, Math.cos(a) * R); _l.set(0, pt ? .8 : 1.0, -1); }
  // frame the crew beside the note highway / panels by shifting the projection window (no look-at skew)
  const land = !pt && VW >= 820; const vx = st === 'play' || st === 'build' ? (land && st === 'play' ? .15 : 0) : st === 'menu' ? (land ? -.17 : 0) : (land ? .18 : 0);
  const vy = pt ? (st === 'play' ? .1 : st === 'build' ? .14 : .2) : st === 'build' ? .1 : 0; const kv = 1 - Math.exp(-dt * 2.5); S.vx = lerp(S.vx || 0, vx, kv); S.vy = lerp(S.vy || 0, vy, kv);
  camera.setViewOffset(VW, VH, S.vx * VW, S.vy * VH, VW, VH);
  const k = 1 - Math.exp(-dt * 1.8); camPos.lerp(_v, k); look.lerp(_l, k); keepClear(camPos); camera.position.copy(camPos);
  if (window.__sdCam) { const o = window.__sdCam; camPos.set(...o.p); look.set(...o.l); camera.position.copy(camPos); if (o.fov) { camera.fov = o.fov; camera.updateProjectionMatrix(); S.fovO = 1; } } // scripted camera (video opening only)
  else if (S.fovO) { const f0 = portrait() ? 62 : 45; camera.fov = lerp(camera.fov, f0, 1 - Math.exp(-dt * 2.5)); if (Math.abs(camera.fov - f0) < .05) { camera.fov = f0; S.fovO = 0; } camera.updateProjectionMatrix(); }
  if (S.shake > .01) camera.position.lerp(look, Math.min(.08, S.shake * .05)); // impact = smooth scale punch toward the crew, never a jittery screen shake
  camera.lookAt(look); camera.updateMatrixWorld(); S.shake *= Math.exp(-dt * 6);
  W.energy = S.energy; updateWorld(W, S.gt, dt, beat);
  bloom.strength = (S.state === 'menu' || S.state === 'end' ? .2 : .32) * QUALITY[S.q].bloom;
  updateFX(F, dt, VH * renderer.getPixelRatio() * .5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  owlT -= dt; if (owlT < 0) { owlT = 30 + rng() * 25; if (st !== 'end') A.sfx.owl(); }
  if ((st === 'play' || st === 'build') && Math.floor(S.gt * 10) !== S._h) { S._h = Math.floor(S.gt * 10); hud(); }
  const hk = S.kids ? 'hintK' : isTouch ? 'hintT' : 'hint'; $('hint').textContent = t(hk); $('hint').classList.toggle('show', st === 'play' && S.songT < (chart[0] ? chart[0].t + .2 : 0) && S.pel > .3 && S.hits < 2);
}
function render() { composer.render(); drawLanes(); }
const fps = { n: 0, acc: 0, frames: 0, bad: 0, since: 0 };
function fpsTick(dt) { // auto quality: ignores the first seconds, long frames (tab switches, shader compiles) and needs 4 bad seconds in a row
  if (document.hidden) return; fps.since += dt; if (fps.since < 6 || dt > .25) return; fps.acc += dt; fps.frames++;
  if (fps.acc >= 1) { const f = fps.frames / fps.acc; fps.acc = 0; fps.frames = 0; fps.n++; fps.bad = f < 32 ? fps.bad + 1 : 0; fps.last = f;
    if (!S.qUser && !window.__sdNoAutoQ && fps.bad >= 4 && S.q !== 'low') { const o = ['low', 'mid', 'high', 'ultra']; const nq = o[o.indexOf(S.q) - 1]; applyQuality(nq); toast(`${t('autoQ')} ${t('q_' + nq)} (${Math.round(f)} fps)`); fps.bad = 0; fps.since = 0; } } }

applyQuality(S.q); applyLang(); toMenu();
try { renderer.compile(scene, camera); } catch (e) {}
for (let i = 0; i < 60; i++) step(1 / 30);
let last = performance.now();
function frameLoop(now) { const dt = Math.max(0, (now - last) / 1000); last = Math.max(last, now); if (!window.__sdManual) { step(dt); render(); fpsTick(dt); } else render(); requestAnimationFrame(frameLoop); }
requestAnimationFrame(frameLoop);
const laneScreen = i => ({ x: laneX(i), y: LG.hit });
window.__sd = { S, start, end, step: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); render(); }, stepq: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); }, log: A.log, quality: q => q ? applyQuality(q, true) : S.q, renderer,
  chart: () => chart.map(n => ({ t: n.t, lane: n.lane, m: n.m, hit: n.hit, missed: n.missed })), press: lanePress, lanes: () => D().lanes, laneScreen, next: () => chart.find(n => !n.hit && !n.missed),
  crew: () => ALL.map(s => ({ st: s.state, x: +s.root.position.x.toFixed(2), y: +s.B.hips.position.y.toFixed(2), z: +s.root.position.z.toFixed(2), mv: s.move, vis: s.root.visible })), lead: () => ({ st: lead.state, mv: lead.move, jaw: lead.B.jaw.rotation.x }),
  cam: () => ({ p: camera.position.toArray(), near: camera.near }), camClear: () => Math.min(...W.colliders.map(c => { _v.subVectors(camera.position, c.p); _v.y *= .5; return _v.length() - c.r; })),
  bolt: (x = .65) => { const q = [x, .3]; let i = 0; lightning(W, () => i < q.length ? q[i++] : rng()); A.sfx.thunder(); }, crack: i => { openCrack(W, i); A.sfx.crack(); W.fogBurst = 1; }, play: A.play, sfx: A.sfx, leadSlot: () => lead.slot.toArray(),
  songs: SONG_ORDER, diff: () => S.diff, addMove, perform, cycleForm, randomRoutine, world: W, fps, layout: () => ({ ...LG, ctx: undefined }), finaleAt: () => S.finale, songLen: () => song && song.len2, _dbg: { scene, camera, composer, bloom, F } };
document.body.classList.add('ready');
