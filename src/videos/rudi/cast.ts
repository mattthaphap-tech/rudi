// Cast of "Rudi, Orang Dalam" as lit flat sprites in the 3D kampung. Pool / Actor / Fx / light helpers are the template's
// (canvas pool, cardShade, contact blobs, NOINK layer); the stage() at the bottom is ours: who stands where, per scene.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxStars, fxPuff, fxCloud, fxShadow, fxContact, KID, Outfit, Expr, FrontOpts, SideOpts } from "./toon";
import { FPS, V3, SHOTS, Scene, QUEUE0, QUEUE_DX, RUDI_P, NEIGH_P, YOUNG_P, BOSS_P, CAR_P, BENCH, smooth, clamp01, cueFrames } from "./story";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";
import { fxCash, fxCar, fxBoard, fxTick, fxSweat, fxSpark, fxBubble, RUDI, NEIGH, YOUNG, BOSS, villager } from "./props";


// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const vOf = (i: number) => (i * 7 + (i >> 2)) % 4;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- crowd by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };

// ---------------- staging helpers ----------------
const cue = (n: number): [number, number] => { const [a, b] = cueFrames(n); return [a / FPS, b / FPS]; };
const LEAD_S = 2 / FPS; // reactions land 2 f before the word
const inCue = (t: number, n: number) => { const [a, b] = cue(n); return t >= a - LEAD_S && t < b; };
const afterCue = (t: number, n: number) => t >= cue(n)[0] - LEAD_S;
type Cast = { out: Stage; cam: CamInfo; t: number };
const put = (c: Cast, i: number, o: Outfit, okey: string, p: V3, fo: FrontOpts, scale = 1) => {
  const who: Who = { i, o, okey };
  c.out.places.push(person(c.cam, who, p[0], p[1], p[2], { side: false, mirror: false }, { blink: lidAt(c.t, i), ...fo }, {}, scale));
  blob(c.out, p[0], p[1], p[2], scale);
};
const card = (c: Cast, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, extra: Partial<FxPlace> = {}) =>
  c.out.fx.push({ key, cw, ch, draw, x, y, z, w, h, ...extra });
const cash = (c: Cast, x: number, y: number, z: number, s = 0.5, rot = 0) => card(c, "cash", 320, 200, fxCash, x, y, z, s, s * 0.625, { rot });
const tick = (c: Cast, x: number, y: number, z: number, s = 0.5) => card(c, "tick", 300, 300, fxTick, x, y, z, s, s);
const sweat = (c: Cast, x: number, y: number, z: number, n = 3) => {
  for (let k = 0; k < n; k++) {
    const u = ((c.t * 0.9 + k / n) % 1);
    card(c, "sweat", 120, 180, fxSweat, x + (k - 1) * 0.22 + 0.2 * u * (k % 2 ? 1 : -1), y - u * 0.55 + 0.1, z + 0.05, 0.16, 0.24, { soft: false });
  }
};
const car = (c: Cast, x: number, mirror = true) => card(c, "car", 900, 400, fxCar, x, 0.95 + 0.02, CAR_P[2], mirror ? -4.4 : 4.4, 1.95);
/** facing: the speaker looks toward the other person (+1 = screen right, camera looks toward -z) */
const hello = (c: Cast, i: number, o: Outfit, okey: string, p: V3, expr: Expr, facing: -1 | 0 | 1 = 0, extra: Partial<FrontOpts> = {}) =>
  put(c, i, o, okey, p, { mode: "stand", expr, facing, ...extra });
const wiggle = (t: number, k = 6) => Math.sin(t * k) * 0.5;

const villagersBg = (c: Cast, spots: V3[], exprs: Expr[], base = 300) =>
  spots.forEach((p, i) => hello(c, base + i, villager(i), `v${i % 8}`, p, exprs[i % exprs.length], i % 2 ? 1 : -1));
const queue = (c: Cast, n: number, withCash: number, exprs: Expr[], cheer = false) => {
  for (let i = 0; i < n; i++) {
    const p: V3 = [QUEUE0 + i * QUEUE_DX, 0, -1.55 + ((i * 7) % 5) * 0.12];
    if (i % 5 === 3) { // a child beside the parent
      put(c, 500 + i, KID, "kid", [p[0] + 0.55, 0, p[2] + 0.35], { mode: "stand", expr: exprs[(i + 1) % exprs.length], wave: cheer ? wiggle(c.t, 8 + i % 3) * 30 : undefined }, 0.72);
    }
    hello(c, 400 + i, villager(i), `v${i % 8}`, p, exprs[i % exprs.length], -1, cheer ? { wave: wiggle(c.t + i, 8) * 30 } : {});
    if (i < withCash) cash(c, p[0] - 0.42, 0.95, p[2] + 0.1, 0.34, -0.25);
  }
};

/** who stands where in each scene of the story (t = seconds); every expression change lands 2 f before its word */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  const c: Cast = { out, cam, t };
  const R = RUDI_P, N = NEIGH_P, Y = YOUNG_P, B = BOSS_P;
  const sc: Scene = s.scene;
  switch (sc) {
    case "intro": // cue 1: jobless graduate on the bench; a few neighbours go about their day
      put(c, 1, RUDI, "rudi", BENCH, { mode: "sit", expr: t < 2.6 ? "neutral" : "dazed" });
      villagersBg(c, [[14, 0, 1.6], [-9, 0, 3.4], [7, 0, 5.4], [-15, 0, -3.2], [20, 0, -1.8]], ["smile", "neutral", "smile_closed"]);
      break;
    case "tell": // cues 2-3
      hello(c, 1, RUDI, "rudi", R, inCue(t, 3) ? "laugh" : "grin", 1, { wave: inCue(t, 3) ? wiggle(t, 7) * 24 : undefined });
      hello(c, 2, NEIGH, "neigh", N, afterCue(t, 3) ? "shock" : "smile_closed", -1);
      if (afterCue(t, 3)) card(c, "spark", 200, 200, fxSpark, R[0] + 0.55, 2.1 + 0.05 * wiggle(t, 5), R[2], 0.3, 0.3);
      break;
    case "ask": // cues 4-5
      hello(c, 1, RUDI, "rudi", R, "grin", 1);
      hello(c, 2, NEIGH, "neigh", N, afterCue(t, 5) ? "nervous" : "smile", 0);
      hello(c, 3, YOUNG, "young", Y, afterCue(t, 5) ? "smile" : "neutral", -1);
      break;
    case "deal": // cues 6-7: "bisa diatur", then the money changes hands
      hello(c, 1, RUDI, "rudi", R, "grin", 1, { wave: afterCue(t, 6) && !afterCue(t, 7) ? wiggle(t, 7) * 26 : undefined });
      hello(c, 2, NEIGH, "neigh", N, afterCue(t, 7) ? "smile" : "nervous", -1);
      if (afterCue(t, 7)) { const k = smooth((t - cue(7)[0]) / 1.4); cash(c, N[0] + (R[0] + 0.5 - N[0]) * k, 1.3, N[2] + 0.35, 0.55, -0.15); }
      break;
    case "lazy": // cue 8: he does nothing
      put(c, 1, RUDI, "rudi", BENCH, { mode: "sit", expr: "smile_closed" });
      cash(c, BENCH[0] + 0.9, 0.4, BENCH[2] + 0.5, 0.45, 0.3);
      break;
    case "pass": // cue 9: she passes on her own merit
      hello(c, 3, YOUNG, "young", Y, "grin", 0);
      hello(c, 2, NEIGH, "neigh", [N[0] - 0.6, 0, N[2] + 0.1], "laugh", 1);
      tick(c, Y[0], 2.65 + 0.05 * wiggle(t, 6), Y[2], 0.62);
      if (t < cue(9)[0] + 0.7) card(c, "burst", 500, 500, (p) => fxBurst(p, 0.5), Y[0], 1.6, Y[2] + 0.1, 1.8, 1.8, { soft: true });
      break;
    case "buzz": // cue 10: the whole village is excited
      hello(c, 1, RUDI, "rudi", R, "grin", 0, { wave: wiggle(t, 6) * 22 });
      villagersBg(c, [[-3, 0, -2.2], [1.8, 0, -2.0], [4.6, 0, -2.3], [-6, 0, -1.6], [6.8, 0, -1.4], [-1.2, 0, 1.4], [3.1, 0, 1.6], [8.2, 0, 1.2]], ["laugh", "grin", "smile"], 320);
      card(c, "spark", 200, 200, fxSpark, R[0] - 0.55, 2.0, R[2], 0.3, 0.3);
      break;
    case "queue": // cue 11: forty people in line
      queue(c, 40, 0, ["smile", "neutral", "smile_closed", "nervous"]);
      hello(c, 1, RUDI, "rudi", R, afterCue(t, 11) && t > cue(11)[0] + 1.6 ? "shock" : "grin", 1);
      break;
    case "pay": // cue 12: everybody pays Rp5 juta
      queue(c, 40, 14, ["smile", "grin", "smile_closed"]);
      hello(c, 1, RUDI, "rudi", R, "shock", 1);
      break;
    case "pale": // cue 13
      hello(c, 1, RUDI, "rudi", R, "shock", 0, { wave: undefined });
      sweat(c, R[0] + 0.28, 1.85, R[2], 3);
      break;
    case "money": // cue 14: money in, nobody to call
      put(c, 1, RUDI, "rudi", [R[0], 0, R[2]], { mode: "sit", expr: afterCue(t, 14) ? "dazed" : "nervous" });
      for (let k = 0; k < 9; k++) cash(c, R[0] - 0.9 + (k % 5) * 0.45 + (k > 4 ? 0.2 : 0), 0.16 + 0.19 * (k > 4 ? 1 : 0), R[2] + 0.5 - (k % 3) * 0.12, 0.62, (k - 4) * 0.08);
      sweat(c, R[0] + 0.28, 1.2, R[2], 2);
      break;
    case "car": { // cue 15 (evening): a car stops in front of the house
      const k = smooth((t - cue(15)[0]) / 2.6);
      car(c, 22 + (CAR_P[0] - 22) * k);
      break;
    }
    case "boss": // cue 16: a man in a suit steps out
      car(c, CAR_P[0]);
      { const k = smooth((t - cue(16)[0]) / 2.8); hello(c, 7, BOSS, "boss", [3.6 + 3.6 * (1 - k), 0, B[2] + 2.6 + (-0.5 - (B[2] + 2.6)) * 0 - 2.6 * k], "neutral", -1); }
      break;
    case "ask2": // cues 17-18
      hello(c, 7, BOSS, "boss", B, "smile_closed", -1, { wave: inCue(t, 18) ? wiggle(t, 5) * 16 : undefined });
      hello(c, 1, RUDI, "rudi", R, "nervous", 1);
      break;
    case "sweat": // cue 19: Rudi sweats
      hello(c, 7, BOSS, "boss", B, "neutral", -1);
      hello(c, 1, RUDI, "rudi", R, afterCue(t, 19) && t > cue(19)[0] + 1.9 ? "stern" : "nervous", 1);
      sweat(c, R[0] + 0.28, 1.85, R[2], 3);
      break;
    case "cond": // cues 20-21: the condition
      hello(c, 7, BOSS, "boss", B, "neutral", -1);
      hello(c, 1, RUDI, "rudi", R, afterCue(t, 21) ? "grin" : "stern", 1, { wave: afterCue(t, 21) ? wiggle(t, 6) * 18 : undefined });
      if (afterCue(t, 21)) {
        card(c, "bubble", 300, 220, fxBubble, R[0] + 0.3, 2.72, R[2] - 0.05, 1.5, 1.1, { soft: false });
        card(c, "board", 600, 520, fxBoard, R[0] + 0.3, 2.72, R[2] - 0.04, 0.95, 0.82);
      }
      break;
    case "think": // cues 22-23: the boss thinks, then "Gampang"
      hello(c, 7, BOSS, "boss", B, afterCue(t, 23) ? "grin" : "neutral", -1);
      hello(c, 1, RUDI, "rudi", R, "shock", 1);
      break;
    case "week": // cues 24-25 (a week later, daylight): the results are out, all forty pass
      card(c, "board", 600, 520, fxBoard, 3.4, 1.12, -1.3, 2.5, 2.17);
      villagersBg(c, [[1.4, 0, -0.5], [2.4, 0, -0.1], [4.4, 0, -0.3], [5.4, 0, -0.8], [0.4, 0, -0.9], [6.4, 0, -0.2]], ["laugh", "grin", "smile"], 340);
      queue(c, afterCue(t, 25) ? 34 : 26, 0, ["laugh", "grin", "smile", "laugh"], true);
      if (afterCue(t, 25)) tick(c, 3.4, 2.7, -1.35, 0.7);
      break;
    case "promo": // cues 26-27: the boss is promoted, shakes Rudi's hand and whispers
      hello(c, 7, BOSS, "boss", afterCue(t, 27) ? [B[0] - 1.1, 0, B[2] - 0.2] : B, afterCue(t, 27) ? "smile_closed" : "grin", -1);
      hello(c, 1, RUDI, "rudi", R, afterCue(t, 27) ? "dazed" : "relief", 1);
      if (afterCue(t, 27)) card(c, "spark", 200, 200, fxSpark, B[0] - 0.7, 2.15, B[2] - 0.2, 0.25, 0.25);
      break;
    case "bye": { // cue 28: he leaves for the head office
      const k = smooth((t - cue(28)[0] - 1.0) / 2.6);
      car(c, CAR_P[0] + 22 * k, false);
      hello(c, 1, RUDI, "rudi", R, "dazed", 1);
      break;
    }
    case "stunned": // cue 29
      hello(c, 1, RUDI, "rudi", R, "dazed", 0, { blink: undefined });
      break;
    case "end": // cue 30: he really has an insider now
      hello(c, 1, RUDI, "rudi", R, t > cue(30)[0] + 0.4 ? "grin" : "dazed", 0, { wave: t > cue(30)[0] + 1.2 ? wiggle(t, 6) * 24 : undefined });
      if (t > cue(30)[0] + 0.4) card(c, "spark", 200, 200, fxSpark, R[0] + 0.6, 2.1, R[2], 0.35, 0.35);
      break;
  }
  return out;
};
export { FPS };
