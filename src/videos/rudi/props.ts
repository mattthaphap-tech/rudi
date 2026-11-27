// Props for "Rudi, Orang Dalam" drawn with the toon.ts Pen (ink outline, flat fills, no text anywhere).
import { Pen, INK, Outfit, SKINS } from "./toon";
type P2 = [number, number];
const rr = (x0: number, y0: number, x1: number, y1: number, r = 12): P2[] => {
  const pts: P2[] = [];
  for (const [cx, cy, a0] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]] as const)
    for (let i = 0; i <= 4; i++) { const a = ((a0 + i * 22.5) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
};

/** a bundle of banknotes with a paper band, on a 320 x 200 canvas */
export const fxCash = (p: Pen) => {
  p.ol = 7;
  p.poly(rr(46, 40, 290, 150, 8), "#4f9a5e");
  p.poly(rr(30, 56, 274, 166, 8), "#6fb872");
  p.poly(rr(16, 72, 260, 182, 8), "#8fd08a");
  p.ell(138, 127, 34, 34, "#6fb872", 5);
  p.poly(rr(118, 66, 158, 190, 4), "#e9d36b", 6);
  p.line([[34, 96], [94, 96]], "#4f9a5e", 5, false); p.line([[184, 160], [240, 160]], "#4f9a5e", 5, false);
};
/** car in side view on a 900 x 400 canvas: dark blue body, light windows, black wheels (feet on y = 380) */
export const fxCar = (p: Pen) => {
  p.ol = 10;
  p.poly([[210, 180], [290, 82], [590, 82], [690, 180]], "#2c3a5a");
  p.poly([[240, 172], [304, 98], [430, 98], [430, 172]], "#a9d1ee", 6);
  p.poly([[446, 172], [446, 98], [580, 98], [654, 172]], "#a9d1ee", 6);
  p.poly(rr(30, 168, 870, 316, 44), "#34466e");
  p.poly(rr(30, 252, 870, 316, 30), "#27324f", 0);
  p.ell(838, 214, 20, 14, "#ffe9a0", 6); p.ell(62, 214, 16, 12, "#e04a45", 6);
  p.ell(210, 322, 64, 64, "#1d1d22", 8); p.ell(210, 322, 26, 26, "#bfc3c8", 4);
  p.ell(690, 322, 64, 64, "#1d1d22", 8); p.ell(690, 322, 26, 26, "#bfc3c8", 4);
};
/** result board on two posts, 600 x 520: 5 rows x 8 green ticks = 40 names passed (no text) */
export const fxBoard = (p: Pen) => {
  p.ol = 8;
  p.poly(rr(70, 330, 100, 515, 4), "#8a6a46"); p.poly(rr(500, 330, 530, 515, 4), "#8a6a46");
  p.poly(rr(20, 20, 580, 350, 14), "#f6f1e0");
  p.line([[40, 50], [560, 50]], "#d9cfb4", 4, false);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) {
    const x = 52 + c * 63, y = 92 + r * 52;
    p.stroke([[x, y], [x + 12, y + 14], [x + 34, y - 14]], 8, "#2f9d57");
  }
};
/** big green tick in a round badge on a 300 x 300 canvas */
export const fxTick = (p: Pen) => {
  p.ol = 9;
  p.ell(150, 150, 118, 118, "#3fae65");
  p.stroke([[88, 156], [132, 202], [214, 100]], 26, "#ffffff");
};
/** sweat drop on a 120 x 180 canvas */
export const fxSweat = (p: Pen) => {
  p.ol = 6;
  p.poly([[60, 14], [96, 98], [100, 128], [80, 160], [40, 160], [20, 128], [24, 98]], "#9ad8ff");
  p.ell(46, 124, 8, 14, "#e8f7ff", 0);
};
/** small sparkle for "he thinks he is great": 4-point star on a 200 x 200 canvas */
export const fxSpark = (p: Pen) => {
  p.ol = 5;
  p.poly([[100, 8], [122, 78], [192, 100], [122, 122], [100, 192], [78, 122], [8, 100], [78, 78]], "#ffe27a");
};
/** speech puff (empty bubble, no text) on a 300 x 220 canvas */
export const fxBubble = (p: Pen) => {
  p.ol = 7;
  p.poly(rr(12, 12, 288, 160, 56), "#ffffff");
  p.poly([[70, 156], [58, 206], [112, 158]], "#ffffff", 7);
  p.ell(150, 86, 98, 40, "#ffffff", 0);
};

// ---------------- our cast (modern kampung, no hats from the 1831 template) ----------------
export const RUDI: Outfit = { jacket: "#f4f1e8", pants: "#2f3f66", boots: "#5a4636", hat: "hair", hair: "#1d1512", skin: SKINS[1] };
export const NEIGH: Outfit = { jacket: "#9a6b34", pants: "#4a4038", boots: "#4a3426", hat: "cap", cap: "#17171c", skin: SKINS[2], moustache: "#3a2a20", build: "stout" };
export const YOUNG: Outfit = { jacket: "#e8607f", pants: "#3b4a6b", boots: "#f4f1ea", hat: "hair", hair: "#2a1b18", skin: SKINS[3] };
export const BOSS: Outfit = { jacket: "#23262f", pants: "#23262f", boots: INK, hat: "hair", hair: "#8e8e94", skin: SKINS[0], build: "stout", moustache: "#55555a", buttons: "#d9dde0" };
const SHIRTS = ["#4f86c6", "#c9573e", "#5d9a54", "#d6a73d", "#8a6bc2", "#2f8a8f", "#c25a7a", "#7a8a96"];
export const villager = (v: number): Outfit => {
  const o: Outfit = { jacket: SHIRTS[v % 8], pants: ["#3b3f52", "#5a4a3a", "#2f3a4a"][v % 3], boots: "#4a3426", skin: SKINS[(v * 3 + 1) % 4] };
  const m = v % 4;
  return m === 0 ? { ...o, hat: "cap", cap: "#17171c" } : { ...o, hat: "hair", hair: ["#1d1512", "#3a2a20", "#6b5a4a", "#2a2a30"][m] };
};
