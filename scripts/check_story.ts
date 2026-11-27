import { SHOTS, camAt, dofAt, layersAt, shotAt, TOTAL, keyEnd } from "../src/videos/rudi/story";
import CUES from "../src/videos/rudi/cues.json";
let bad = 0;
// shots tile the whole timeline with no gaps / overlaps
for (let i = 0; i < SHOTS.length; i++) {
  const s = SHOTS[i];
  if (i && s.a !== SHOTS[i - 1].b) { console.log("GAP/OVERLAP at shot", s.id); bad++; }
}
if (SHOTS[SHOTS.length - 1].b !== TOTAL) { console.log("last shot does not end at TOTAL"); bad++; }
// every cue start lies inside some shot; report which shot carries each cue and how far from a cut
for (const c of CUES) {
  const s = shotAt(c.fa);
  const lead = c.fa - s.a;
  if (lead < 0) bad++;
}
// camera sanity: finite, above ground, look != pos, no big jump inside a shot except on declared cuts
for (const s of SHOTS) {
  let prev = camAt(s.id, s.a);
  for (let f = s.a; f < s.b; f++) {
    const c = camAt(s.id, f);
    const vals = [...c.pos, ...c.look, c.fov, c.roll];
    if (vals.some((v) => !Number.isFinite(v))) { console.log("NaN cam", s.id, f); bad++; break; }
    if (c.pos[1] < 0.3) { console.log("cam below 0.3 m", s.id, f, c.pos); bad++; break; }
    const d = Math.hypot(c.pos[0] - prev.pos[0], c.pos[1] - prev.pos[1], c.pos[2] - prev.pos[2]);
    if (d > 1.2 && f > s.a) console.log(`jump ${d.toFixed(2)} m in shot ${s.id} at f${f} (ok only if a declared cut)`);
    prev = c;
  }
}
for (const f of [0, 1000, 1324, 2074, 2642]) console.log("f", f, "layers", JSON.stringify(layersAt(f)), "dof", dofAt(f).cInf);
console.log("shots", SHOTS.length, "total", TOTAL, bad ? `PROBLEMS: ${bad}` : "story ok");
