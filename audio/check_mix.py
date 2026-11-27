import numpy as np, sys, json
sys.path.insert(0, '.')
from dsp import *
mix, _ = read_wav('../public/rudi/mix.wav'); v, _ = read_wav('voice.wav')
V = st(v[0]); N = min(mix.shape[1], V.shape[1])
gg = float((mix[:, :N] * V[:, :N]).sum() / (V[:, :N] ** 2).sum()); bed = mix[:, :N] - gg * V[:, :N]
Mv = momentary(gg * V[:, :N]); Mb = momentary(bed); tc = np.arange(len(Mv)) * 0.01 + 0.2
Lv = integrated(gg * V[:, :N])
cues = json.load(open('../src/videos/rudi/cues.json'))
sp = np.zeros(len(tc), bool)
for c in cues: sp |= (tc >= c['a'] + 0.15) & (tc <= c['b'] - 0.15)
d = Mv - Mb; ok = sp & np.isfinite(d) & (Mv > Lv - 5)
print('speech windows', ok.sum(), 'median', round(float(np.median(d[ok])), 1), 'p10', round(float(np.percentile(d[ok], 10)), 1), 'min', round(float(d[ok].min()), 1))
bad = ok & (d < 5); ts = tc[bad]; spans = []
for t in ts:
    if spans and t - spans[-1][1] < 0.25: spans[-1][1] = t
    else: spans.append([t, t])
for a, b in spans: print(f'  clash {a:6.2f}-{b:6.2f}s  min {d[(tc >= a) & (tc <= b)].min():.1f} LU')
print('bed-only loudness at silence (e.g. 39.5-40.0):', round(float(np.nanmedian(Mb[(tc > 40.5) & (tc < 41.5)])), 1))
x = mix[:, :N]; print('peak', round(float(20 * np.log10(np.abs(x).max())), 2), 'dBFS; dc', float(np.abs(x.mean(1)).max()))
