# SCRATCH — Attributions and rights audit

SCRATCH v1.0.0 was created by **Paul Nercessian**.

This file lists everything in the shipped game that was not written for it, and
how each piece may be redistributed. Full licence texts ship inside the web
build in the `licenses/` folder (source: `public/licenses/`).

## Third-party code and fonts in the build

| What | Used for | Licence | Copyright |
| --- | --- | --- | --- |
| [three.js](https://threejs.org) 0.186 | 3D rendering | MIT | © 2010–2026 three.js authors |
| [Vite](https://vite.dev) 8 | build tool; its small module-preload helper is bundled | MIT | © 2019–present VoidZero Inc. and Vite contributors |
| Press Start 2P (via [Fontsource](https://fontsource.org)) | roguelite UI | SIL OFL 1.1, Reserved Font Name "Press Start 2P" | © 2012 The Press Start 2P Project Authors |
| Dela Gothic One (via Fontsource) | roguelite headings | SIL OFL 1.1 | © 2020 The Dela Gothic Project Authors |
| DotGothic16 (via Fontsource) | roguelite subtitles, Japanese text | SIL OFL 1.1 | © 2020 The DotGothic16 Project Authors |
| Chakra Petch (via Fontsource) | roguelite UI in Modern graphics | SIL OFL 1.1 | © 2018 The Chakra Petch Project Authors |
| Inter (via Fontsource) | Classic mode UI | SIL OFL 1.1 | © 2016 The Inter Project Authors |
| Cormorant Garamond (via Fontsource) | Classic mode titles | SIL OFL 1.1 | © 2015 The Cormorant Project Authors |

The font files ship exactly as Fontsource publishes them: they are not modified
or renamed, and none is sold on its own. Only the Latin subsets are included,
plus DotGothic16's Japanese subset.

## Made for SCRATCH (no third-party rights)

- **Music and sound effects:** every note and every sound is synthesised live
  by the game's own WebAudio code (`src/audio/Audio.js`). No samples,
  recordings or music files are used.
- **Textures, the club, the lounge, balls, cues and icons:** all generated in
  code at runtime (`src/render/textures.js`, `src/ui/art.js`,
  `src/classic/Lounge.js`, `src/world/`). There are no image files in the project.
- **The favicon:** an inline SVG in `index.html`.
- **The store page images, GIFs and trailer** in `release/itch/`: screenshots
  and recordings of the game itself (picture and sound). The cover, banner and
  icon are composed from those screenshots and the game's fonts.

## Development-only tools (not shipped)

These were used to test and record the game. None of their code is in the game or its zip:
- **Testing:** puppeteer-core (Apache-2.0) for automated playtests in Chrome and
  Firefox, and Playwright (Apache-2.0) for WebKit tests.
- **Capture:** ffmpeg (via the ffmpeg-static package) turned in-game captures
  into the trailer and GIFs.

The trailer and GIFs contain only footage and sound recorded from SCRATCH itself.
Their title cards use the game's own fonts.

## Audit notes

- Checked on 2026-09-23. The source contains no image, audio, model or font
  files other than the Fontsource packages listed above (`node_modules/@fontsource/*`).
- Nothing in the game uses real brands, trademarks or likenesses.
  "The House", "The Dealer" and the other bosses are fictional.
