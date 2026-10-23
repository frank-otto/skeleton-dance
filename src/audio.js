// WebAudio for the embedded CC0 samples (window.SD_SOUNDS): recorded orchestra instruments (xylophone, solo violin,
// harp, pizzicato strings, contrabass, timpani, bass drum, cymbals, gong), real bone rattles, ground cracks and a
// ghost crowd. Pitched instruments use the nearest recorded note (small re-pitch). A generated room-reverb tail is
// processing only. Nothing is synthesized. Every played sound is logged (for tests and the video mix).
let ctx = null, master = null, dry = null, wet = null, conv = null, loopGain = null, musicBus = null, windSrc = null, bufs = {}, ready = false, muted = false;
export const log = [];
let clock = () => 0;
export function setClock(f) { clock = f; }
function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
export const INS = {
  xy: { G3: 55, C4: 60, G4: 67, C5: 72, G5: 79, C6: 84, G6: 91, C7: 96 },
  vn: { G3: 55, C4: 60, E4: 64, G4: 67, A4: 69, C5: 72, E5: 76, G5: 79, C6: 84 },
  pz: { G2: 43, B2: 47, D3: 50, Fs3: 54, A3: 57, C4: 60, E4: 64, G4: 67, B4: 71, D5: 74 },
  cb: { E1: 28, Fs1: 30, Gs1: 32, A1: 33, Cs2: 37, E2: 40, Gs2: 44 },
  hp: { D2: 38, D4: 62, F4: 65, A4: 69, D6: 86 },
  tp: { 2: 53.65, 4: 52.5 }
};
const SORTED = Object.fromEntries(Object.entries(INS).map(([k, v]) => [k, Object.entries(v).sort((a, b) => a[1] - b[1])]));
export function sampleFor(ins, m) { const L = SORTED[ins]; let best = L[0]; for (const e of L) if (Math.abs(e[1] - m) < Math.abs(best[1] - m)) best = e; return { n: ins + '_' + best[0], r: Math.pow(2, (m - best[1]) / 12) }; }
function makeIR(sec = 2.4) { // decaying noise tail for the graveyard reverb (processing only)
  const sr = ctx.sampleRate, n = Math.floor(sr * sec), ir = ctx.createBuffer(2, n, sr); let seed = 9;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() - lp) * (0.55 - .42 * t / sec); d[i] = lp * Math.exp(-t * 2.4) * (i < sr * .015 ? i / (sr * .015) : 1); } }
  return ir;
}
// iOS Safari: create/resume inside the tap, play a 1-sample silent buffer (unlocks output), ask for 'playback' (ignores the mute switch)
function kick(c) { try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {} }
export function audioState() { return ctx ? ctx.state : 'none'; }
export async function unlock() {
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
  if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); kick(ctx); if (ctx.state !== 'running') ctx.resume().catch(() => {}); master = ctx.createGain(); master.gain.value = muted ? 0 : .9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2; master.connect(comp); comp.connect(ctx.destination);
  dry = ctx.createGain(); dry.gain.value = 1; dry.connect(master);
  conv = ctx.createConvolver(); conv.buffer = makeIR(); wet = ctx.createGain(); wet.gain.value = .3; conv.connect(wet); wet.connect(master);
  loopGain = ctx.createGain(); loopGain.gain.value = .2; loopGain.connect(master);
  const src = window.SD_SOUNDS || {};
  await Promise.all(Object.keys(src).map(k => new Promise(res => { try { ctx.decodeAudioData(b64(src[k]), b => { bufs[k] = b; res(); }, () => res()); } catch (e) { res(); } })));
  ready = true; window.__sdAudioReady = Object.keys(bufs).length; startWind();
}
export function play(n, vol = 1, rate = 1, delay = 0, rev = .4, dur = 0, pan = 0) {
  delay = Math.max(0, delay); log.push({ n, t: clock() + delay, v: vol, r: rate, rv: rev, d: dur, p: pan });
  if (log.length > 6000) log.splice(0, 1000);
  if (!ready || !bufs[n]) return null;
  const s = ctx.createBufferSource(); s.buffer = bufs[n]; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g);
  let out = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
  out.connect(dry);
  if (rev > 0) { const sg = ctx.createGain(); sg.gain.value = rev; out.connect(sg); sg.connect(conv); }
  const t0 = ctx.currentTime + delay; s.start(t0);
  if (dur > 0) { g.gain.setValueAtTime(vol, t0 + dur); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur + .35); s.stop(t0 + dur + .4); }
  return s;
}
// pitched recorded instrument
export function note(ins, m, vol = .7, dur = 0, delay = 0, rev = .4, pan = 0) { const { n, r } = sampleFor(ins, m); return play(n, vol, r, delay, rev, dur, pan); }
const XYV = m => m < 62 ? 1.0 : m > 88 ? .8 : .9;
export function melody(ins, m, vol = .8, dur = .5, delay = 0) {
  if (ins === 'xy') { note('xy', m, vol * XYV(m) * .95, 0, delay, .38); if (vol > .5) play(Math.random() < .5 ? 'cl_1' : 'cl_2', vol * .12, 1 + (m - 72) / 90, delay, .2); }
  else if (ins === 'vn') note('vn', m, vol * .85, Math.max(.3, dur), delay, .55);
  else if (ins === 'hp') { note('hp', m, vol * .9, 0, delay, .7); note('hp', m - 24, vol * .45, 0, delay, .7); }
  else if (ins === 'tt') { if (m === 69) { note('vn', 69, vol * .6, Math.max(.3, dur), delay, .5); note('vn', 75, vol * .55, Math.max(.3, dur), delay, .5); } else if (m === 62) { note('vn', 62, vol * .6, Math.max(.3, dur), delay, .5); note('vn', 69, vol * .5, Math.max(.3, dur), delay, .5); } else note('vn', m, vol * .7, Math.max(.3, dur), delay, .5); }
  else if (ins === 'bone') { play(['bone_hit', 'logh', 'cl_1'][Math.floor(Math.random() * 3)], vol * .75, .95 + Math.random() * .1, delay, .3); play('logl', vol * .35, 1, delay, .25); }
}
function startWind() { if (windSrc || !bufs.wind) return; windSrc = ctx.createBufferSource(); windSrc.buffer = bufs.wind; windSrc.loop = true; windSrc.connect(loopGain); windSrc.start(); }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : .9; }
export function isMuted() { return muted; }
export function time() { return ctx ? ctx.currentTime : 0; }
const rr = a => a[Math.floor(Math.random() * a.length)];
export const sfx = {
  ui() { play('cl_1', .3, 1.3, 0, .15); },
  start() { play('stinger', .35, .8, 0, .5); play('whisper', .2, 1, .25, .6); },
  rise(pan = 0) { play('crumble', .5, .9 + Math.random() * .2, 0, .3, 0, pan); play('dirt', .35, 1, .05, .3, 0, pan); play(rr(['bones_rattle', 'bones3']), .45, .95 + Math.random() * .1, .35, .35, 0, pan); },
  crack() { play('crack', .6, .9, 0, .35); play('smash', .45, .8, .05, .4); play('sub', .45, 1, 0, .2); play('bd', .5, .8, 0, .3); },
  fog() { play('fwoosh', .4, .7, 0, .5); play('ghosts', .35, 1, .1, .6); },
  thunder() { play('thunder', .65, 1, 0, .2); play('crash', .25, .9, 0, .4); },
  miss() { play('bone_hit', .32, .8 + Math.random() * .1, 0, .3); play('whisper', .12, .9 + Math.random() * .2, 0, .5); },
  stumble() { play('bones2', .35, 1, 0, .3); },
  combo(k) { play('glissup', .3, 1, 0, .5); if (k >= 2) play('tri', .25, 1, .1, .5); },
  crowd(v = .5) { play('ghosts', v, 1, 0, .6); play('choir_swell', v * .8, 1, .2, .7); play('boo', v * .4, .9, .6, .6); },
  full() { play('gong', .45, 1, 0, .5); play('crash', .45, 1, 0, .4); play('choir_swell', .4, 1, .1, .7); },
  fail() { play('bones_fall', .7, 1, 0, .4); play('bones_fall', .5, .85, .25, .4); play('eerie', .4, 1, 0, .6); play('gong', .3, .7, 0, .5); },
  end(best) { play('howl', .25, 1, .4, .5); if (best) play('success', .45, 1, .6, .4); },
  owl() { play('owl', .2, .95, 0, .6); },
  kids() { play('laugh_kids', .4, 1, .2, .4); },
  rattle(v = .4, pan = 0) { play(rr(['bones_rattle', 'bones3', 'ratchet']), v, .9 + Math.random() * .2, 0, .35, 0, pan); },
  skull() { play('bone_hit', .4, 1.1, 0, .3); play('guiro', .25, 1, .05, .3); }
};
// accompaniment voices
export const band = {
  bass(m, v, delay) { note('cb', m, v, 0, delay, .3); },
  pizz(ms, v, delay) { ms.forEach((m, i) => note('pz', m, v * (1 - i * .1), 0, delay + i * .004, .35, (i - 1) * .25)); },
  timp(root, v, delay) { const k = ((root % 12) + 12) % 12; const tgt = k === 7 ? 55 : k === 2 ? 50 : k === 5 ? 53 : k === 0 ? 48 : 52; play(tgt >= 53 ? 'tp_2' : 'tp_4', v, Math.pow(2, (tgt - (tgt >= 53 ? 53.65 : 52.5)) / 12), delay, .35); },
  roll(v, delay) { play('tproll', v, 1, delay, .4); },
  bd(v, delay) { play('bd', v, 1, delay, .3); },
  crash(v, delay) { play('crash_mf', v, 1, delay, .4); },
  bone(v, delay, k) { play(k ? 'logh' : 'cl_2', v, .97 + Math.random() * .06, delay, .25); },
  harp(m, v, delay) { note('hp', m, v, 0, delay, .7); },
  snroll(v, delay) { play('snroll', v, 1, delay, .4); },
  cymcresc(v, delay) { play('cymcresc', v, 1, delay, .5); }
};
