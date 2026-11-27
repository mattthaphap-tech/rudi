# Rudi, Orang Dalam (short animasi vertikal 1080x1920)

Dibuat dari repo mromidev/claude-animated-shorts (template `bridge`, dunianya diganti kampung).
Suara: `public/rudi/voice.mp3` (88,1 dtk). Shot dipotong di timestamp SRT (`src/videos/rudi/cues.json`).

    npm install
    npm run studio                      # preview + scrub di browser (paling cepat untuk cek)
    node scripts/stills.mjs out/stills/a_ 40,200,300 0.5   # stills tertentu (set CHROME=... bila perlu)
    npm run stills                      # 22 stills, satu per shot
    npm run render                      # render penuh vertikal (JANGAN dijalankan sebelum stills pas)

Peta shot -> cue SRT ada di `src/videos/rudi/story.ts` (SHOTS + CAMS). Adegan per shot ada di `cast.ts` (stage()).
Belum diuji render di sandbox (tidak ada browser yang bisa jalan). Lulus: tsc, bundle Remotion, cek timeline.
