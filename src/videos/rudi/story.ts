// "Rudi, Orang Dalam": a 88 s vertical short (1080x1920, 30 fps). Shots are cut on the SRT cue timestamps
// (cues.json, converted from Rudi-Orang-Dalam.srt: frame = round(seconds x 30)), the voice is public/rudi/voice.mp3.
// Camera grammar follows SKILL.md: hard cuts on big jumps, smootherstep glides, every hold creeps in, no hand-held float.
import CUES from "./cues.json";
export const FPS = 30;
export const TOTAL = 2643; // 88.11 s of voice
export const D0 = 0; // ground level (build.ts house() default y)
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const cueFrames = (n: number): [number, number] => [CUES[n - 1].fa, CUES[n - 1].fb];

// ---------------- staging (metres; ground y = 0) ----------------
// The road runs along x (z -3..3). Rudi's house is on the north side (centre 0, -9, front at z = -5), the neighbour's
// house to its left, houses of the south side face it. Anyone in the yard stands at z -4.2..-2; the queue lines the road.
export const RUDI_HOUSE: V3 = [0, 0, -9];
export const BENCH: V3 = [-2.4, 0, -4.0];
export const RUDI_P: V3 = [0, 0, -3.6];
export const NEIGH_P: V3 = [2.4, 0, -3.0];
export const YOUNG_P: V3 = [3.8, 0, -2.3];
export const BOSS_P: V3 = [2.5, 0, -2.7];
export const CAR_P: V3 = [9, 0, 1.6];
export const QUEUE0 = 3.6; // x of the head of the queue
export const QUEUE_DX = 0.95;

// ---------------- shots (one per cue group; a/b = frames) ----------------
export type Light = "day" | "golden";
export type Scene = "intro" | "tell" | "ask" | "deal" | "lazy" | "pass" | "buzz" | "queue" | "pay" | "pale" | "money" | "car" | "boss" | "ask2" | "sweat"
  | "cond" | "think" | "week" | "promo" | "bye" | "stunned" | "end";
export type ShotDef = { id: number; a: number; b: number; light: Light; scene: Scene; tau: (t: number) => number };
const S = (id: number, a: number, b: number, light: Light, scene: Scene): ShotDef => ({ id, a, b, light, scene, tau: (t) => t });
export const SHOTS: ShotDef[] = [
  S(1, 0, 164, "day", "intro"), // cue 1
  S(2, 164, 314, "day", "tell"), // cues 2-3
  S(3, 314, 443, "day", "ask"), // cues 4-5
  S(4, 443, 643, "day", "deal"), // cues 6-7
  S(5, 643, 703, "day", "lazy"), // cue 8
  S(6, 703, 796, "day", "pass"), // cue 9
  S(7, 796, 920, "day", "buzz"), // cue 10
  S(8, 920, 1028, "day", "queue"), // cue 11
  S(9, 1028, 1147, "day", "pay"), // cue 12
  S(10, 1147, 1216, "day", "pale"), // cue 13
  S(11, 1216, 1324, "day", "money"), // cue 14
  S(12, 1324, 1420, "golden", "car"), // cue 15 (evening)
  S(13, 1420, 1526, "golden", "boss"), // cue 16
  S(14, 1526, 1656, "golden", "ask2"), // cues 17-18
  S(15, 1656, 1796, "golden", "sweat"), // cue 19
  S(16, 1796, 1993, "golden", "cond"), // cues 20-21
  S(17, 1993, 2074, "golden", "think"), // cues 22-23
  S(18, 2074, 2224, "day", "week"), // cues 24-25
  S(19, 2224, 2394, "day", "promo"), // cues 26-27
  S(20, 2394, 2484, "day", "bye"), // cue 28
  S(21, 2484, 2560, "day", "stunned"), // cue 29
  S(22, 2560, TOTAL, "day", "end"), // cue 30
];
/** crossfades (frames) at time changes: day -> evening (shot 12), evening -> next week (shot 18) */
export const XFADE: Record<number, number> = { 12: 8, 18: 8 };
export const FLASH_AT = -1000; // no flash in this short
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
export const T = (f: number) => f / FPS;
/** push-in factor since f0 (0.15-0.35 %/f); `punch` raises it for the first n frames on a punch word */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 30) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** key: frame, camera position, look point, options */
type KO = { fov?: number; roll?: number; dur?: number; cut?: boolean; rate?: number; punch?: number };
const K = (f: number, pos: V3, look: V3, o: KO = {}): Key => ({
  f, dur: o.dur, cut: o.cut,
  s: (ff) => dolly(pos, look, pushK(ff, f, o.rate ?? 0.002, o.punch ?? 0), { fov: o.fov ?? 40, roll: o.roll ?? 0 }),
});
// per-shot subject points (eye height ~1.6)
const EYE_RUDI: V3 = [0, 1.6, -3.6], EYE_BOSS: V3 = [BOSS_P[0], 1.65, BOSS_P[2]], EYE_BENCH: V3 = [BENCH[0], 1.1, BENCH[2]];
const TWO: V3 = [1.2, 1.15, -3.2]; // between Rudi and the neighbour / the boss
const CAMS: Record<number, Key[]> = {
  1: [K(0, [-34, 6.5, 1.5], [0, 2.4, -6], { fov: 44, rate: 0.0025 }), K(72, [0.8, 1.35, -0.4], EYE_BENCH, { fov: 38, cut: true })],
  2: [K(164, [1.2, 1.5, 3.9], TWO, { fov: 50 }), K(236, [0.9, 1.55, -0.2], EYE_RUDI, { fov: 34, dur: 22, rate: 0.003, punch: 0.006 })],
  3: [K(314, [4.4, 1.5, 3.6], [3.1, 1.2, -2.7], { fov: 40 }), K(362, [3.6, 1.55, 0.2], [3.1, 1.45, -2.6], { fov: 34, dur: 20 })],
  4: [K(443, [1.5, 1.5, 2.9], TWO, { fov: 50 }), K(540, [1.2, 1.35, -0.9], [1.2, 1.25, -3.1], { fov: 34, cut: true, rate: 0.003 }), K(606, [1.2, 1.5, 3.2], TWO, { fov: 50, cut: true })],
  5: [K(643, [-4.6, 1.2, -0.9], EYE_BENCH, { fov: 38, roll: -0.04 })],
  6: [K(703, [5.8, 1.4, 1.6], [YOUNG_P[0], 1.2, YOUNG_P[2]], { fov: 38, punch: 0.005 })],
  7: [K(796, [-14, 5.5, 2.4], [3, 1.2, -3.5], { fov: 46 }), K(860, [-1.5, 1.6, 2.4], [2.4, 1.3, -3.2], { fov: 40, cut: true })],
  8: [K(920, [-3.5, 4.8, 5.5], [17, 0.8, -1.6], { fov: 44, rate: 0.0025 }), K(975, [1.6, 1.0, 1.4], [14, 1.1, -1.6], { fov: 42, cut: true })],
  9: [K(1028, [8.5, 1.5, 3.5], [10, 1.3, -1.8], { fov: 40 }), K(1090, [5.6, 1.5, 1.2], [8.2, 1.4, -1.6], { fov: 38, cut: true })],
  10: [K(1147, [0.6, 1.62, -0.6], EYE_RUDI, { fov: 32, rate: 0.003, punch: 0.006 })],
  11: [K(1216, [-0.9, 1.3, 0.3], [0, 0.95, -3.6], { fov: 40 }), K(1270, [1.8, 2.4, -0.2], [0, 0.6, -3.7], { fov: 40, dur: 28 })],
  12: [K(1324, [1.0, 1.4, 5.2], [9, 1.1, 1.6], { fov: 55 })],
  13: [K(1420, [-2.5, 1.5, 2.6], [6, 1.3, -0.6], { fov: 62 })],
  14: [K(1526, [1.2, 1.5, 3.9], TWO, { fov: 50 }), K(1615, [4.6, 1.6, 0.9], EYE_BOSS, { fov: 34, cut: true })],
  15: [K(1656, [0.6, 1.62, -0.6], EYE_RUDI, { fov: 32, rate: 0.003 })],
  16: [K(1796, [0.9, 1.55, -0.4], EYE_RUDI, { fov: 34 }), K(1882, [1.0, 1.6, 2.6], [1.0, 1.8, -3.3], { fov: 58, cut: true, roll: 0.03, punch: 0.003 })],
  17: [K(1993, [4.6, 1.6, 0.9], EYE_BOSS, { fov: 34 }), K(2040, [4.1, 1.62, 0.5], EYE_BOSS, { fov: 30, dur: 14, rate: 0.004 })],
  18: [K(2074, [3.8, 1.6, 3.8], [3.0, 1.5, -1.2], { fov: 38 }), K(2146, [6, 2.6, 5.5], [12, 1.0, -1.6], { fov: 42, cut: true })],
  19: [K(2224, [1.2, 1.5, 3.9], TWO, { fov: 50 }), K(2291, [0.7, 1.6, 0.6], [0.7, 1.55, -3.0], { fov: 40, cut: true, rate: 0.003 })],
  20: [K(2394, [-2, 1.4, 2.6], [12, 1.1, 1.0], { fov: 50 })],
  21: [K(2484, [0.6, 1.62, -0.6], EYE_RUDI, { fov: 32, rate: 0.003 })],
  22: [K(2560, [0.7, 1.6, -0.5], EYE_RUDI, { fov: 33, rate: 0.003 }), K(2600, [10, 7.5, 10], [0, 1.6, -5], { fov: 44, dur: 43 })],
};
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};
export const kickAt = (_t: number) => 0;
export const camAt = (id: number, f: number): Cam => run(CAMS[id], f);

// ---------------- lens: depth of field (cInf = blur radius in px at 1080 for infinity; 0 = sharp) ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const at = (p: V3) => () => p;
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: 72, cInf: 12, focus: at(EYE_BENCH) },
  { f: 164, cInf: 8, focus: at(TWO) },
  { f: 236, dur: 22, cInf: 13, focus: at(EYE_RUDI) },
  { f: 314, cInf: 10, focus: at([3.1, 1.5, -2.7]) },
  { f: 443, cInf: 9, focus: at(TWO) },
  { f: 540, cInf: 13, focus: at([1.2, 1.25, -3.1]) },
  { f: 606, cInf: 9, focus: at(TWO) },
  { f: 643, cInf: 12, focus: at(EYE_BENCH) },
  { f: 703, cInf: 12, focus: at([YOUNG_P[0], 1.6, YOUNG_P[2]]) },
  { f: 796, cInf: 0 },
  { f: 860, cInf: 9, focus: at([2.4, 1.5, -3.2]) },
  { f: 920, cInf: 0 },
  { f: 975, cInf: 6, focus: at([14, 1.2, -1.6]) },
  { f: 1028, cInf: 10, focus: at([10, 1.5, -1.8]) },
  { f: 1147, cInf: 14, focus: at(EYE_RUDI) },
  { f: 1216, cInf: 10, focus: at([0, 1.0, -3.6]) },
  { f: 1324, cInf: 5, focus: at([9, 1.0, 1.6]) },
  { f: 1420, cInf: 5, focus: at([5, 1.5, -0.4]) },
  { f: 1526, cInf: 8, focus: at(TWO) },
  { f: 1615, cInf: 13, focus: at(EYE_BOSS) },
  { f: 1656, cInf: 14, focus: at(EYE_RUDI) },
  { f: 1796, cInf: 11, focus: at(EYE_RUDI) },
  { f: 1882, cInf: 6, focus: at([1.0, 1.6, -3.4]) },
  { f: 1993, cInf: 13, focus: at(EYE_BOSS) },
  { f: 2074, cInf: 8, focus: at([3.0, 1.5, -1.2]) },
  { f: 2146, cInf: 0 },
  { f: 2224, cInf: 8, focus: at(TWO) },
  { f: 2291, cInf: 13, focus: at([0.7, 1.55, -3.0]) },
  { f: 2394, cInf: 4, focus: at([14, 1.0, 1.0]) },
  { f: 2484, cInf: 14, focus: at(EYE_RUDI) },
  { f: 2560, cInf: 12, focus: at(EYE_RUDI) },
  { f: 2600, dur: 43, cInf: 0 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
