// Danse macabre, Op. 40 – Camille Saint-Saëns (1874, public domain). Our own arrangement in three acts for
// recorded CC0 instruments: xylophone (the "rattling bones"), solo violin (tuned with the devil's tritone A–E♭),
// harp (midnight strikes), pizzicato strings, timpani and bone percussion.
// Bar notation: 'Note:beats' tokens; 'r' = rest; 'TT' = violin tritone A4+E♭5, 'FF' = open fifth D4+A4.
// Chords drive the waltz accompaniment (bass on 1, pizzicato chord on 2 and 3).
const T1 = [ // first waltz theme (bars 41–48 of the score)
  ['Gm', 'G5:1 G5:.5 Bb5:.5 G5:.5 A5:.5'], ['Gm', 'Bb5:1 A5:.5 Bb5:.5 G5:.5 Bb5:.5'], ['Gm', 'A5:.5 G5:.5 G5:.5 Bb5:.5 G5:.5 A5:.5'], ['Gm', 'Bb5:1 A5:.5 Bb5:.5 G5:.5 Bb5:.5'],
  ['Fm', 'Ab5:1 Ab5:.5 C6:.5 Ab5:.5 Bb5:.5'], ['Fm', 'C6:1 Bb5:.5 C6:.5 Ab5:.5 C6:.5'], ['Fm', 'Bb5:.5 Ab5:.5 Ab5:.5 C6:.5 Ab5:.5 Bb5:.5'], ['Fm', 'C6:1 Ab5:.5 C6:.5 Bb5:.5 Ab5:.5']
];
const oct = (bars, k) => bars.map(([c, m]) => [c, m.split(' ').map(t => { const [n, d] = t.split(':'); if (n === 'r' || n.length < 2) return t; return n.slice(0, -1) + (+n.slice(-1) + k) + ':' + d; }).join(' ')]);
const T2 = [ // second theme: the violin's chromatic descent (bars 50–65)
  ['G', 'G4:3'], ['G7', 'F4:3'], ['C', 'E4:3'], ['Cm', 'Eb4:3'], ['Gm', 'D4:1 E4:1 G4:1'], ['A7', 'F#4:1 E4:1 D4:1'], ['A7', 'E4:3'], ['D', 'F#4:2 D4:1'],
  ['G', 'G4:3'], ['G7', 'F4:3'], ['C', 'E4:3'], ['Cm', 'Eb4:3'], ['Gm', 'D4:1 G4:1 Bb4:1'], ['D', 'A4:1 F#4:2'], ['A7', 'F#4:2 E4:1'], ['D', 'D4:3']
];
const T1D = [ // the waltz in D with the answer in C minor (bars 65–80)
  ['D', 'D5:1 D5:.5 F#5:.5 D5:.5 E5:.5'], ['D', 'F#5:1 E5:.5 F#5:.5 D5:.5 F#5:.5'], ['D', 'E5:.5 D5:.5 D5:.5 F#5:.5 D5:.5 E5:.5'], ['D', 'F#5:1 E5:.5 F#5:.5 D5:.5 F#5:.5'],
  ['Cm', 'G5:1 G4:.5 Bb4:.5 G4:.5 A4:.5'], ['Cm', 'Bb4:1 G4:.5 G4:.5 Eb4:.5 F4:.5'], ['Cm', 'G4:1 G4:.5 Eb4:.5 Eb4:.5 D4:.5'], ['Cm', 'Eb4:1 G4:.5 Eb4:.5 Eb4:.5 Eb4:.5']
];
const CLIMAX = [ // the full orchestra takes the waltz up high (bars 85–100)
  ['Gm', 'G6:1 D6:.5 Bb5:.5 D6:.5 A5:.5'], ['Gm', 'Bb5:1 D6:.5 Bb5:.5 D6:.5 Bb5:.5'], ['Gm', 'A5:.5 G5:.5 D6:.5 Bb5:.5 D6:.5 A5:.5'], ['Gm', 'Bb5:1 D6:.5 Bb5:.5 D6:.5 Bb5:.5'],
  ['Fm', 'Ab5:1 Eb6:.5 C6:.5 Eb6:.5 Bb5:.5'], ['Fm', 'C6:1 Eb6:.5 C6:.5 Eb6:.5 C6:.5'], ['Fm', 'Bb5:.5 Ab5:.5 Eb6:.5 C6:.5 Eb6:.5 Bb5:.5'], ['Fm', 'C6:1 Eb6:.5 C6:.5 Eb6:.5 Ab5:.5']
];
const FUGUE = [ // the fugue subject in the low strings (bars 138–144)
  ['G', 'G4:.5 G4:.5 G4:1 G4:1'], ['G7', 'F4:.5 F4:.5 F4:1 F4:1'], ['C', 'E4:.5 E4:.5 E4:1 E4:1'], ['Cm', 'Eb4:.5 Eb4:.5 Eb4:1 Eb4:1'],
  ['Gm', 'D4:.5 D4:.5 E4:.5 E4:.5 G4:.5 G4:.5'], ['A7', 'F#4:.5 F#4:.5 E4:.5 E4:.5 D4:.5 D4:.5'], ['A7', 'E4:.5 E4:.5 A4:1 A4:1'], ['D', 'F#4:1 D4:1 D4:1']
];
const MIDNIGHT = Array.from({ length: 6 }, () => ['N', 'D4:3']); // the clock strikes midnight (harp)
const TRITONE = [['D', 'TT:3'], ['D', 'FF:3'], ['D', 'TT:2 TT:1'], ['D', 'FF:2 FF:1'], ['D', 'TT:.5 TT:.5 TT:1 FF:1'], ['D', 'TT:.5 TT:.5 TT:1 FF:1'], ['D', 'TT:1 FF:1 TT:1'], ['D7', 'FF:1 TT:1 D5:1']];
const BONES = Array.from({ length: 4 }, (_, i) => [i < 2 ? 'Gm' : 'D', 'C:1 C:1 C:1']); // skeletons knock the beat (bone clacks)
const FINAL = [['Gm', 'G5:3'], ['Gm', 'G4:3']];

export const SONGS = {
  midnight: { title: 'Midnight Strikes', titleDe: 'Mitternacht schlägt', act: 1, bpm: 138, sections: [
    { ins: 'hp', bars: MIDNIGHT, lanes: [0, 3, 1, 2, 0, 3] }, { ins: 'tt', bars: TRITONE }, { ins: 'xy', bars: oct(T1, -1) }, { ins: 'xy', bars: T1 }, { ins: 'vn', bars: T2 }, { ins: 'xy', bars: FINAL, end: true }] },
  waltz: { title: 'The Bone Waltz', titleDe: 'Der Knochenwalzer', act: 2, bpm: 150, sections: [
    { ins: 'bone', bars: BONES, lanes: [0, 3, 0, 3, 1, 2, 1, 2, 0, 1, 2, 3] }, { ins: 'xy', bars: T1D }, { ins: 'xy', bars: oct(T1D.slice(0, 4), 0).concat(oct(T1D.slice(4), 1)) }, { ins: 'vn', bars: T2 }, { ins: 'xy', bars: T1 }, { ins: 'xy', bars: FINAL, end: true }] },
  frenzy: { title: 'Graveyard Frenzy', titleDe: 'Friedhofs-Raserei', act: 3, bpm: 162, sections: [
    { ins: 'tt', bars: TRITONE.slice(4) }, { ins: 'xy', bars: CLIMAX }, { ins: 'xy', bars: oct(CLIMAX, 1).slice(0, 4).concat(CLIMAX.slice(4)) }, { ins: 'vn', bars: FUGUE }, { ins: 'xy', bars: T1D }, { ins: 'xy', bars: CLIMAX }, { ins: 'xy', bars: FINAL, end: true }] }
};
export const SONG_ORDER = ['midnight', 'waltz', 'frenzy'];
const NN = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(n) { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); if (!m) return null; return 12 * (+m[3] + 1) + NN[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); }
const CH = { // chord -> [bass root midi, pizzicato chord tones]
  Gm: [31, [55, 58, 62]], G: [31, [55, 59, 62]], G7: [31, [53, 59, 62]], Fm: [29, [53, 56, 60]], C: [36, [55, 60, 64]], Cm: [36, [55, 60, 63]], D: [38, [54, 57, 62]], D7: [38, [54, 60, 62]], A7: [33, [55, 61, 64]], N: null
};
// Flatten a song into timed events (in beats): melody notes (playable) + accompaniment.
export function parseSong(id) {
  const s = SONGS[id]; const mel = [], acc = []; let bar = 0;
  for (const sec of s.sections) {
    let li = 0;
    for (const [ch, str] of sec.bars) {
      let b = 0;
      for (const tok of str.trim().split(/\s+/)) {
        const [n, d] = tok.split(':'); const dur = +d;
        if (n !== 'r') mel.push({ beat: bar * 3 + b, dur, n, m: n === 'TT' ? 69 : n === 'FF' ? 62 : n === 'C' ? 0 : midi(n), ins: sec.ins, lane: sec.lanes ? sec.lanes[li++ % sec.lanes.length] : -1, bar, sec: s.sections.indexOf(sec) });
        b += dur;
      }
      const c = CH[ch]; if (c) acc.push({ beat: bar * 3, bar, bass: c[0], ch: c[1], name: ch, sec: s.sections.indexOf(sec), ins: sec.ins });
      bar++;
    }
  }
  return { ...s, id, mel, acc, bars: bar, beats: bar * 3 };
}
