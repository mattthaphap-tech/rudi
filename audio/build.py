# Sound for "Rudi, Orang Dalam": the supplied voice (gain only) + an original synthesized score ducked under speech
# + synthesized SFX locked to the picture's frames. Everything is generated here (no samples). Mix rule from SKILL.md:
# music +3 dB (bed about -10 LU under the voice), SFX -6 dB, voice unchanged. Output: ../public/rudi/mix.wav (48 kHz stereo,
# exact length of the voice) + cues.md. Run: python3 build.py
import os, json, time, sys
import numpy as np
from scipy import ndimage, signal
from dsp import *
import instruments as I
import sfx_gen as G

HERE = os.path.dirname(os.path.abspath(__file__))
CUES = json.load(open(os.path.join(HERE, "..", "src", "videos", "rudi", "cues.json"), encoding="utf-8"))
cue = lambda n: (CUES[n - 1]["a"], CUES[n - 1]["b"])
fr = lambda f: f / 30.0
voice, _sr = read_wav(os.path.join(HERE, "voice.wav"))
N = voice.shape[1]; DUR = N / SR
V = st(voice[0])
log = lambda *a: print(f"[{time.strftime('%H:%M:%S')}]", *a, flush=True)
EVENTS = []

# picture times (frames of story.ts / 30)
SHOT_T = [0, 164, 314, 443, 643, 703, 796, 920, 1028, 1147, 1216, 1324, 1420, 1526, 1656, 1796, 1993, 2074, 2224, 2394, 2484, 2560, 2643]
S = lambda i: fr(SHOT_T[i - 1])           # start of shot i (1-based)
T_NIGHT0, T_DAY2 = S(12), S(18)           # evening starts / next week starts
m2f = I.m2f

def lvl_peak(y, db):
    y = np.asarray(y, float); return y / max(1e-9, np.abs(y).max()) * dbg(db)
def lvl_rms(y, db):
    y = np.asarray(y, float); return y / max(1e-9, np.sqrt(np.mean(y ** 2))) * dbg(db)

# ================================================================ SFX
sfx = np.zeros((2, N))        # short accents (chimes, pops, drops, thuds): stay on top of speech
sfx_bg = np.zeros((2, N))     # crowds, cheers, car, steps, beds, whooshes: ducked under speech like the music
BG_WORDS = ("crowd", "murmur", "buzz", "cheer", "car ", "footstep", "bed", "whoosh", "payment", "queue")
def sx(name, t, y, db=-12.0, p=0.0, rms=False):
    y = lvl_rms(y, db) if rms else lvl_peak(y, db)
    y = pan(y, p) if np.asarray(y).ndim == 1 else y
    place(sfx_bg if any(w in name for w in BG_WORDS) else sfx, y, t); EVENTS.append((t, name, db))

def rustle(r, dur=0.4):
    n = ns(dur); t = np.arange(n) / SR
    x = bp(colored(n, r, 0.2), 1800, 7500, 1)
    am = np.abs(smooth_noise(n, r, 55)) ** 0.8
    return fades(x * am * np.exp(-t / (dur * 0.55)), 0.004, 0.05)
def cash_hand(r):          # bundle of notes slapped into a hand: rustle + soft thump
    y = rustle(r, 0.5); t = np.arange(len(y)) / SR
    y[: ns(0.05)] += 0  # keep
    th = np.where(t > 0.30, np.exp(-(t - 0.30) / 0.05) * np.sin(TAU * 120 * (t - 0.30)), 0) * 0.35
    return y + th
def chime(r, notes=(76, 79, 84), gap=0.085, vel=0.6):
    out = np.zeros(ns(len(notes) * gap + 1.8))
    for k, m in enumerate(notes):
        g = I.glock(m2f(m + 12), vel * (0.8 + 0.2 * k / max(1, len(notes) - 1)), r, 1.6)
        out[ns(k * gap): ns(k * gap) + len(g)] += g[: len(out) - ns(k * gap)]
    return out
def sparkle(r):
    out = np.zeros(ns(1.6))
    for k, m in enumerate([88, 91, 95, 100]):
        g = I.musicbox(m2f(m), 0.45, r, 1.0); o = ns(0.05 * k)
        out[o: o + len(g)] += g[: len(out) - o]
    return out
def drop(r, f0=1300.0):
    t = np.arange(ns(0.3)) / SR
    f = f0 + 1100 * (1 - np.exp(-t / 0.025)); ph = np.cumsum(f) / SR * TAU
    return np.sin(ph) * np.exp(-t / 0.045) * (1 - np.exp(-t / 0.0015)) + 0.15 * np.sin(2 * ph) * np.exp(-t / 0.02)
def pop(r):
    t = np.arange(ns(0.18)) / SR; f = 700 * np.exp(-t / 0.05) + 250
    return np.sin(np.cumsum(f) / SR * TAU) * np.exp(-t / 0.035) + 0.3 * colored(len(t), r, 0.3) * np.exp(-t / 0.004)
def thunk(r, f=85.0):      # car door / heavy soft thud
    n = ns(0.5); t = np.arange(n) / SR
    body = np.sin(TAU * f * t * (1 + 0.5 * np.exp(-t / 0.03))) * np.exp(-t / 0.11)
    clack = lp(colored(n, r, 0.1), 1500, 1) * np.exp(-t / 0.012) * 0.9
    return body + clack
def squeak(r, f=1150.0, dur=0.38):
    n = ns(dur); t = np.arange(n) / SR
    x = reson(colored(n, r, 0.2), f, 18) + reson(colored(n, r, 0.2), f * 1.5, 14) * 0.5
    return x * (np.exp(-t / 0.18)) * (1 + 0.4 * np.sin(TAU * 9 * t))
def crowd(dur, r, voices, cheer_hits=0, base_db=-20.0):
    n = ns(dur); out = np.zeros((2, n))
    for v in range(voices):
        kind = r.uniform()
        base, scale = ((r.uniform(95, 140), r.uniform(0.95, 1.05)) if kind < 0.45 else
                       (r.uniform(175, 235), r.uniform(1.12, 1.2)) if kind < 0.85 else (r.uniform(260, 330), r.uniform(1.25, 1.35)))
        y = lp(G.babble(dur, r, base, scale, r.uniform(3.6, 4.8), r.uniform(0.55, 0.8), fmax=3400), r.uniform(2200, 3600), 1)
        out += pan(y * r.uniform(0.3, 1.0), r.uniform(-0.85, 0.85))
    for k in range(cheer_hits):
        h = G.hurrah(r, r.uniform(110, 300), r.uniform(1.0, 1.3), r.uniform() < 0.25)
        place(out, pan(lp(h, 3200, 1) * 0.5, r.uniform(-0.8, 0.8)), r.uniform(0.2, dur * 0.8))
    return fades(lvl_rms(out, base_db), 0.5, 0.7)
def cheer(dur, r):
    n = ns(dur); t = np.arange(n) / SR; out = np.zeros((2, n))
    for v in range(28):
        kid = v % 6 == 5
        base = r.uniform(270, 340) if kid else (r.uniform(105, 160) if v % 2 else r.uniform(180, 250))
        for rep in range(1 + int(r.uniform() < 0.4)):
            h = G.hurrah(r, base * r.uniform(0.97, 1.05), 1.3 if kid else (1.0 if v % 2 else 1.15), kid)
            place(out, pan(lp(h, 4000, 1) * r.uniform(0.35, 1.0), r.uniform(-0.9, 0.9)), r.uniform(0.2, 1.2) + rep * r.uniform(0.75, 1.0))
    env = np.interp(t, [0, 0.4, 1.0, dur * 0.55, dur], [0.0, 0.5, 1.0, 0.7, 0.0])
    out += G.applause(dur, r, 40, env) * 0.9
    return fades(out, 0.05, 0.6)
def engine(dur, f0, r, rough=0.04):
    """car engine: firing harmonics with slow pitch curve f0 (array, Hz) + low rumble + gravel crunch"""
    n = ns(dur); f0 = np.broadcast_to(np.asarray(f0, float), (n,)) if np.ndim(f0) == 0 else np.interp(np.arange(n), np.linspace(0, n - 1, len(f0)), f0)
    wob = 1 + rough * smooth_noise(n, r, 14)
    ph = np.cumsum(f0 * wob) / SR * TAU
    y = sum(np.sin(k * ph + 0.7 * k) / k ** 1.15 for k in range(1, 12))
    y += 0.5 * lp(colored(n, r, 1.0), 180, 2)
    return y
def car_pass(dur, r, approach, idle_gain=0.5):
    """arriving car: pitch settles, level rises while the filter opens; gravel under the tyres, ends in idle"""
    n = ns(dur); t = np.arange(n) / SR; u = np.clip(t / approach, 0, 1)
    f0 = 52 + 22 * (1 - u) ** 2; eng = engine(dur, f0, r)
    near = lp(eng, 1600, 2); far = lp(eng, 380, 2)
    x = far * (1 - u) + near * u
    gain = np.where(t < approach, 0.04 + 0.96 * (u ** 1.6), idle_gain + (1 - idle_gain) * np.exp(-(t - approach) / 0.5))
    grav = bp(colored(n, r, 0.4), 500, 4200, 1) * (np.abs(smooth_noise(n, r, 38)) ** 1.2) * np.where(t < approach, u ** 1.8, 0) * 0.8
    return (x * 0.55 + grav * 0.5) * gain
def car_away(dur, r, start=0.55):
    """starter crank, engine catches, drives off and fades into the distance"""
    n = ns(dur); t = np.arange(n) / SR
    crank = np.where(t < start, 1.0, 0.0) * np.sin(TAU * 38 * t) * (0.5 + 0.5 * np.sin(TAU * 7 * t)) * 0.6
    u = np.clip((t - start) / 2.4, 0, 1)
    f0 = np.where(t < start, 25, 45 + 30 * u ** 0.7); eng = engine(dur, f0, r)
    dist = np.exp(-np.maximum(t - start - 0.5, 0) / 1.5)
    x = (lp(eng, 700, 2) * (1 - u) + lp(eng, 220, 2) * u) * np.where(t < start, 0.0, 1.0)
    grav = bp(colored(n, r, 0.4), 500, 3500, 1) * (np.abs(smooth_noise(n, r, 38)) ** 1.2) * np.where(t > start + 0.4, 1, 0) * 0.5
    y = (x * 0.6 + grav * 0.4 * dist) * dist + crank
    return fades(y, 0.01, 0.4)

# ---- beds: day (breeze + sparrows), evening (breeze + crickets + blackbird)
def bed_day(dur, r):
    n = ns(dur); x = G.breeze(dur, r, 0.6, 0.15, 800) * 0.5
    x += pan(G.bird_chirps(dur, r, 0.35, "sparrow") * 0.12, -0.4) + pan(G.bird_chirps(dur, r, 0.25, "sparrow") * 0.08, 0.5)
    return fades(lvl_rms(x, -40.0), 0.8, 0.8)
def bed_eve(dur, r):
    n = ns(dur); x = G.breeze(dur, r, 0.7, 0.1, 650) * 0.5
    x += widen(G.crickets(dur, r, 3) * 0.02, r, 9, 1.0)
    x += pan(G.bird_chirps(dur, r, 0.2, "blackbird") * 0.05, -0.5)
    return fades(lvl_rms(x, -39.0), 0.8, 0.8)

def build_sfx():
    r = rng(2026)
    # ---- beds
    place(sfx_bg, bed_day(T_NIGHT0 + 0.3, r), 0.0)
    place(sfx_bg, bed_eve(T_DAY2 - T_NIGHT0 + 0.6, r), T_NIGHT0 - 0.3)
    place(sfx_bg, bed_day(DUR - T_DAY2 + 0.3, r), T_DAY2 - 0.3)
    EVENTS.append((0.0, "bed: day birds+breeze (0 - 44.4 s)", -40)); EVENTS.append((T_NIGHT0 - 0.3, "bed: evening crickets+breeze", -39)); EVENTS.append((T_DAY2 - 0.3, "bed: day (to end)", -40))
    # ---- hook / tell (cues 1-3)
    sx("spark twinkle (neighbour impressed)", cue(3)[0] + 0.25, sparkle(r), -22, 0.4)
    sx("'ooh' neighbour", cue(3)[0] + 0.5, lp(G.whoa(r), 2600, 1), -24, 0.5)
    # ---- belief + deal (cues 4-7)
    sx("'hm?' neighbour believes", cue(4)[0] + 0.05, lp(G.whoa(r), 2600, 1), -28, 0.4)
    sx("cash rustle: bundle out", cue(7)[0] + 0.1, cash_hand(r), -20, 0.0)
    sx("cash handed over", cue(7)[0] + 1.1, cash_hand(r), -19, 0.1)
    sx("coin clink", cue(7)[0] + 1.55, G.clink(r, 3100, 0.12), -22, 0.2)
    # ---- she passes (cue 9)
    sx("tick chime (passed)", cue(9)[0] - 0.02, chime(r, (72, 76, 79, 84), 0.085, 0.7), -23, 0.0)
    sx("'yay' young", cue(9)[0] + 0.28, lp(G.hurrah(r, 255, 1.3, False), 3600, 1), -27, -0.2)
    sx("burst sparkle", cue(9)[0] + 0.05, sparkle(r), -29, 0.3)
    # ---- village buzz, queue, payment (shots 7-9)
    sx("village buzz (crowd)", S(7) - 0.2, crowd(S(8) - S(7) + 0.6, r, 10, 5, -22), -22, 0.0, rms=False)
    sx("queue murmur", S(8) - 0.2, crowd(S(9) - S(8) + 0.6, r, 16, 2, -21), -21, 0.0)
    sx("payment murmur", S(9) - 0.2, crowd(S(10) - S(9) + 0.6, r, 14, 0, -23), -23, 0.0)
    for k, tt_ in enumerate([S(9) + 0.3, S(9) + 0.85, S(9) + 1.5, S(9) + 2.0, S(9) + 2.7, S(9) + 3.2]):
        sx("cash rustle (queue pays)", tt_, rustle(r, 0.35), -27 - (k % 2) * 2, (-0.6 + 0.25 * k) % 1.6 - 0.8)
    for tt_ in [S(9) + 1.2, S(9) + 2.4]:
        sx("coin clink", tt_, G.clink(r, r.uniform(2700, 3400), 0.12), -26, r.uniform(-0.6, 0.6))
    # ---- Rudi goes pale (shot 10), money in (shot 11)
    sx("low hit: Rudi pale", S(10), I.timpani(62, 0.7, r, 1.8), -19, 0.0)
    sx("sweat drop", S(10) + 0.55, drop(r), -26, 0.2)
    sx("sweat drop", S(10) + 1.45, drop(r, 1100), -27, -0.2)
    sx("heavy cash drop", S(11) + 0.2, thunk(r, 70) + 0.6 * rustle(r, 0.5)[: ns(0.5)], -18, 0.0)
    # ---- evening: car arrives, door, boss walks (shots 12-13)
    sx("whoosh: to evening", T_NIGHD := T_NIGHT0 - 0.28, G.whoosh(0.55, r, 0.25, 250, 1800, 0.8, 0.3, 0.2), -20, 0.0)
    sx("car arrives (engine+gravel)", T_NIGHT0 - 0.2, car_pass(3.9, r, 2.6), -14, 0.5)
    sx("brake squeak", T_NIGHT0 + 2.45, squeak(r), -26, 0.3)
    sx("door thunk", S(13) + 0.55, thunk(r), -15, 0.35)
    for k in range(6):
        sx("boss footstep", S(13) + 1.05 + 0.46 * k, G.stroll_step(r, 0.3), -22, 0.5 - 0.2 * k)
    # ---- tension: sweat shots (15-16)
    for k, tt_ in enumerate([S(15) + 0.7, S(15) + 1.9, S(15) + 3.1]):
        sx("sweat drop", tt_, drop(r, 1000 + 100 * k), -24, 0.15 * (k - 1))
    sx("gulp", S(15) + 1.1, lp(G.oof(r, "oh"), 900, 1) * 0.5, -26, 0.0)
    sx("pop: thought bubble", fr(1882) - 0.02, pop(r), -17, 0.0)
    sx("chime: 40 passes", fr(1882) + 0.04, chime(r, (79, 84), 0.1, 0.5), -24, 0.0)
    # ---- 'Gampang' + back to daylight
    sx("sparkle: Gampang", cue(23)[0] - 0.02, sparkle(r), -26, 0.0)
    sx("whoosh: a week later", T_DAY2 - 0.3, G.whoosh(0.6, r, 0.22, 400, 3000, 0.8, 0.3, 0.2), -20, 0.0)
    # ---- results + cheer (shot 18)
    sx("chime: results board", T_DAY2 + 0.15, chime(r, (72, 76, 79, 84, 88), 0.07, 0.6), -20, 0.0)
    sx("crowd cheer", fr(2146) - 0.1, cheer(4.2, r), -17, 0.0)
    sx("crowd cheer (second)", cue(25)[0] + 0.1, cheer(3.6, r), -20, 0.0)
    # ---- promotion, handshake, whisper (shot 19)
    sx("handshake clasp", fr(2291) - 0.3, thunk(r, 140) * 0.5 + 0.5 * rustle(r, 0.25)[: ns(0.5)].mean() * 0, -26, 0.0)
    sx("sparkle: whisper", cue(27)[0] + 0.1, sparkle(r), -28, 0.2)
    # ---- boss leaves (shot 20), Rudi stunned (21), the end (22)
    sx("car leaves (start, drive-off)", cue(28)[0] + 0.55, car_away(4.0, r, 0.55), -16, 0.3)
    sx("dazed swirl", S(21) + 0.2, np.concatenate([I.glock(m2f(m + 12), 0.4, r, 0.35)[: ns(0.16)] for m in (91, 89, 87, 85, 83, 81)]) , -24, 0.0)
    sx("final twinkle", cue(30)[0] + 0.4, sparkle(r), -26, 0.0)

# ================================================================ SCORE
M = np.zeros((2, N))
CH = {"C": (48, (60, 64, 67)), "Am": (45, (57, 60, 64)), "F": (41, (57, 60, 65)), "G": (43, (55, 59, 62)),
      "Dm": (50, (57, 62, 65)), "E": (40, (56, 59, 64)), "Em": (40, (59, 62, 67))}
MEL = {"C": [76, 79, 81, 79, 76, 74, 72, None], "Am": [72, 76, 81, 79, 76, None, 72, None], "F": [77, 81, 79, 77, 76, 74, 72, None],
       "G": [74, 79, 83, 81, 79, 74, 71, None], "Dm": [74, 77, 81, 77, 74, None, 69, None], "E": [71, 76, 80, 76, 71, None, 68, None]}
BPM = 104.0; BEAT = 60 / BPM; BAR = 4 * BEAT; EIGHTH = BEAT / 2

def section(t0, t1, bars, mode, r, fin=0.3, fout=0.5, density=1.0):
    """render a section on its own grid (downbeat at t0) into the music stem; mode picks the arrangement"""
    L = ns(t1 - t0 + 2.5); buf = np.zeros((2, L)); k = 0
    t = 0.0
    while t < t1 - t0 and k < 200:
        name = bars[k % len(bars)]; root, tri = CH[name]
        prog = t / max(1e-9, (t1 - t0))
        if mode in ("day", "week"):
            vel = 0.5 + 0.25 * min(1, prog * 3) if mode == "day" else 0.75
            full = (t > 10.5) if mode == "day" else True
            # bass: root on 1, fifth on 3
            if full or k >= 2:
                place(buf, pan(I.pluck(m2f(root), vel * 0.9, r, 0.55, 0.25), -0.1), t, 0.9)
                place(buf, pan(I.pluck(m2f(root + 7), vel * 0.7, r, 0.45, 0.25), -0.1), t + 2 * BEAT, 0.7)
            # strummed ukulele-ish upbeats
            for j in (1, 3, 5, 7):
                for q, m in enumerate(tri):
                    place(buf, pan(I.pluck(m2f(m), vel * 0.45, r, 0.4, 0.6), 0.25), t + j * EIGHTH + q * 0.012, 0.55)
            # vibes melody (sparse at first)
            mel = MEL[name]
            for j, m in enumerate(mel):
                if m is None or (not full and j % 2): continue
                place(buf, pan(I.vibes(m2f(m), vel * 0.8, r, 0.9), 0.3), t + j * EIGHTH, 0.7 * (1.0 if full else 0.8))
            if mode == "week":
                for j in range(8): place(buf, pan(I.triangle(0.3 + 0.1 * (j % 2), r, 0.5), 0.5), t + j * EIGHTH + (EIGHTH / 2 if j % 2 else 0), 0.35)
                if k % 2 == 0: place(buf, I.glock(m2f(CH[name][1][2] + 24), 0.35, r, 1.0), t, 0.5)
            if (mode == "day" and t > 20) or mode == "week":
                for j in (1, 3): place(buf, pan(I.brush(0.5, r, 0.3), 0.2), t + j * BEAT, 0.7)
            k += 1; t += BAR
        elif mode == "tension":       # slow, sparse, minor: pad + low plucks + a few vibes notes, 2 bars per chord
            dur2 = 2 * BAR
            place(buf, I.pad([m2f(m) for m in tri], dur2 + 0.8, 0.5, r, 0.9, 1.2, 800.0), t, 0.65)
            place(buf, pan(I.pluck(m2f(root - 12 if root > 44 else root), 0.8, r, 1.2, 0.2), 0.0), t, 0.9)
            place(buf, pan(I.pluck(m2f(root - 5), 0.6, r, 1.0, 0.2), 0.0), t + 3 * BEAT, 0.7)
            for j, m in enumerate(MEL[name][:6]):
                if m is not None and j in (0, 3, 5): place(buf, pan(I.vibes(m2f(m - 12), 0.45, r, 1.4, trem=4.0), 0.3 * (1 if j % 2 else -1)), t + (1 + 2 * j) * BEAT, 0.5)
            k += 1; t += dur2
        elif mode == "bye":           # mellow: vibes + pad, one chord per bar
            place(buf, I.pad([m2f(m) for m in tri], BAR + 1.0, 0.4, r, 0.6, 1.0, 900.0), t, 0.6)
            place(buf, pan(I.pluck(m2f(root), 0.6, r, 0.9, 0.2), -0.1), t, 0.7)
            for j, m in enumerate(MEL[name]):
                if m is not None and j in (0, 2, 4, 6): place(buf, pan(I.vibes(m2f(m), 0.45, r, 1.2), 0.3), t + j * EIGHTH * 1.0, 0.55)
            k += 1; t += BAR
        else: raise ValueError(mode)
    sl = buf[:, : ns(t1 - t0)]
    return fades(sl, fin, fout)

def build_music():
    r = rng(7)
    secs = []   # (name, t0, t1, audio)
    def add(name, t0, t1, mode, bars, **kw):
        a = section(t0, t1, bars, mode, r, **kw); secs.append((name, t0, t1, a)); log("music section", name, round(t0, 2), round(t1, 2))
    add("day", 0.0, S(10), "day", ["C", "Am", "F", "G"], fin=0.6)
    add("pale", S(10), T_NIGHT0, "tension", ["Am", "E"], fin=0.15, fout=0.35)
    add("night", T_NIGHT0, cue(23)[0] - 0.12, "tension", ["Am", "F", "Dm", "E"], fin=0.35, fout=0.12)
    # the turn: a hush, then a bright C pad under "Gampang" -> a week later
    L = ns(T_DAY2 - (cue(23)[0] - 0.05) + 0.3)
    pad_c = I.pad([m2f(60), m2f(64), m2f(67), m2f(72)], T_DAY2 - cue(23)[0] + 1.0, 0.5, r, 0.7, 1.0, 1100.0)
    secs.append(("turn", cue(23)[0] - 0.05, T_DAY2, fades(pad_c[:, : ns(T_DAY2 - cue(23)[0] + 0.05)], 0.5, 0.1)))
    run = np.zeros(ns(1.6))
    for q, m in enumerate([84, 88, 91, 96]):
        g = I.glock(m2f(m), 0.6, r, 1.2); o = ns(0.07 * q); run[o: o + len(g)] += g[: len(run) - o]
    secs.append(("turn-run", cue(23)[0] - 0.05, T_DAY2, run[: ns(T_DAY2 - cue(23)[0])] * 0.8))
    add("week", T_DAY2, S(20), "week", ["C", "G", "Am", "F"], fin=0.05, fout=0.3)
    add("bye", S(20), S(22) - 1.0, "bye", ["F", "G", "Am", "G"], fin=0.4, fout=0.5)
    # the end: C pad + music box, final chord on the grin
    end0 = S(22) - 1.0
    L = ns(DUR - end0); e = np.zeros((2, L))
    place(e, I.pad([m2f(m) for m in (48, 60, 64, 67, 72)], DUR - end0 + 0.5, 0.55, r, 0.8, 1.0, 1000.0), 0.0, 0.8)
    for j, m in enumerate([79, 84, 88, 84, 91]): place(e, pan(I.musicbox(m2f(m), 0.55, r, 1.4), 0.3), 0.4 + 0.45 * j, 0.7)
    tg = cue(30)[0] + 0.35 - end0
    for m in (72, 76, 79, 84): place(e, I.glock(m2f(m + 12), 0.5, r, 2.0), tg, 0.5)
    secs.append(("end", end0, DUR, fades(e, 0.5, 0.9)))
    return secs

# ================================================================ mix
def speech_spans():
    sp = []
    for c in CUES:
        s, e = c["a"], c["b"]
        if sp and s - sp[-1][1] < 0.3: sp[-1][1] = max(sp[-1][1], e)
        else: sp.append([s, e])
    return sp
def duck_db(spans, depth=-4.5, pre=0.08, post=0.12, att=0.07, rel=0.45):
    ctrl = 1000; nc = int(DUR * ctrl) + 2; va = np.zeros(nc)
    for s, e in spans: va[max(0, int((s - pre) * ctrl)): int((e + post) * ctrl)] = 1.0
    ka, kr = 1 - np.exp(-1 / (att * ctrl)), 1 - np.exp(-1 / (rel * ctrl)); env = np.zeros(nc); e_ = 0.0
    for i in range(nc):
        tg = va[i]; e_ += (tg - e_) * (ka if tg > e_ else kr); env[i] = e_
    return np.interp(np.arange(N) / SR, np.arange(nc) / ctrl, depth * env)
def limiter(x, ceil_db=-1.2, look=0.003, rel=0.08):
    c = dbg(ceil_db); n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12)); La = max(1, ns(look))
    g1 = ndimage.minimum_filter1d(gr, 2 * La + 1, mode="nearest"); g2 = g1.copy(); idx = np.flatnonzero(g1 < 1.0)
    if len(idx):
        kr = 1 - np.exp(-1 / (rel * SR)); gap = ns(rel * 8); brk = np.flatnonzero(np.diff(idx) > gap)
        starts = np.concatenate([[idx[0]], idx[brk + 1]]); ends = np.concatenate([idx[brk], [idx[-1]]])
        for a, b_ in zip(starts, ends):
            e = min(n, b_ + gap); seg = g1[a:e]; out = np.empty(len(seg)); g = 1.0
            for k in range(len(seg)): g = min(seg[k], g + (1 - g) * kr); out[k] = g
            g2[a:e] = out
    g3 = np.minimum(ndimage.uniform_filter1d(g2, 2 * La + 1, mode="nearest"), 1.0)
    return x * g3[None, :], g3

MUSIC_TARGET = {"day": -10.0, "pale": -12.0, "night": -12.5, "turn": -9.0, "turn-run": -9.0, "week": -9.5, "bye": -11.0, "end": -10.0}

if __name__ == "__main__":
    t_start = time.time()
    log("voice", round(DUR, 3), "s, LUFS", round(integrated(V), 1))
    build_sfx(); log("sfx done", len(EVENTS), "events")
    secs = build_music(); log("music done")
    duck = dbg(duck_db(speech_spans()))
    music = np.zeros((2, N)); Lv_all = integrated(V)
    for name, t0, t1, a in secs:
        seg = np.zeros((2, N)); place(seg, a, t0)
        i0, i1 = ns(t0), min(N, ns(t1) + ns(0.01))
        d = seg * duck[None, :]
        Lm, Lv = integrated(d[:, i0:i1]), integrated(V[:, i0:i1])
        if not np.isfinite(Lv): Lv = Lv_all
        g = dbg((Lv + MUSIC_TARGET[name] - Lm) if np.isfinite(Lm) else -20.0)
        music += d * g
        log(f"music {name:9s} {t0:6.2f}-{t1:6.2f}s  gain {20*np.log10(g):+.1f} dB  (voice {Lv:.1f}, target {MUSIC_TARGET[name]} LU)")
    # SFX: events peak to ~ voice LUFS - 6 dB at the loudest moments (momentary), beds stay far under
    sfx = sfx + sfx_bg * dbg(duck_db(speech_spans(), depth=-7.0))[None, :]
    mmax = momentary_max(sfx); s_gain = dbg(-1.4)   # fixed (no auto-normalise): per-event levels above already sit about 6 dB under the voice
    log("sfx momentary max", round(mmax, 1), "LUFS -> gain", round(20 * np.log10(s_gain), 1), "dB")
    sfx_g = sfx * s_gain
    mix = V + music + sfx_g
    Lmix = integrated(mix); mix *= dbg(-15.0 - Lmix)
    mix, gr = limiter(mix)
    mix = fades(mix, 0.01, 0.35)
    out = os.path.join(HERE, "..", "public", "rudi", "mix.wav")
    write_wav(out, mix, bits=16)
    # ---- report
    L = integrated(mix); tp = true_peak(mix)
    spans = speech_spans(); v_on = []; b_on = []
    Vm = V * dbg(-15.0 - Lmix) ; Bm = (music + sfx_g) * dbg(-15.0 - Lmix)
    Mv, Mb = momentary(Vm), momentary(Bm); tc = np.arange(len(Mv)) * 0.01 + 0.2
    sp = np.zeros(len(tc), bool)
    for s, e in spans: sp |= (tc >= s + 0.1) & (tc <= e - 0.1)
    k = sp & np.isfinite(Mb) & (Mb > -70) & (Mv > integrated(Vm) - 8)
    med = float(np.median(Mv[k] - Mb[k])); p10 = float(np.percentile(Mv[k] - Mb[k], 10))
    lines = ["# Rudi: sound cues (times in s, from the picture frames / 30 and the SRT)", "",
             f"- length {mix.shape[1]/SR:.3f} s (voice {DUR:.3f} s), integrated {L:.1f} LUFS, true peak {tp:.2f} dBTP, max limiter reduction {20*np.log10(gr.min()):.2f} dB",
             f"- voice vs music+sfx while speaking: median {med:.1f} LU, 10th percentile {p10:.1f} LU", "", "## SFX events (t, name, level dBFS before the stem gain)"]
    for t_, nme, db in sorted(EVENTS): lines.append(f"- {t_:7.2f}  {nme}  ({db:+.0f})")
    lines += ["", "## Music sections"] + [f"- {n}: {a:.2f} - {b:.2f} s, target {MUSIC_TARGET[n]} LU under the voice" for n, a, b, _ in secs]
    open(os.path.join(HERE, "cues.md"), "w").write("\n".join(lines) + "\n")
    log(f"DONE {mix.shape[1]/SR:.3f}s  {L:.1f} LUFS  TP {tp:.2f} dBTP  voice-vs-bed median {med:.1f} LU p10 {p10:.1f} LU  in {time.time()-t_start:.0f}s")
