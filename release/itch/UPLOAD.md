# Putting SCRATCH v1.0.0 on itch.io

Everything in this folder is ready. The only steps left need you, the account
owner, logged in to itch.io: creating the project page and choosing when to make
it public. Nothing here stores or needs your password or API key.

**Where the large files are:**
- **The web zip** (`SCRATCH-web-v1.0.0.zip`): rebuild it with `npm run release`.
- **The full-size screenshots and the trailer:** too large for git, so they are
  attached to the
  [v1.0.0 GitHub release](https://github.com/Bouwles/SCRATCH/releases/tag/v1.0.0).
  The web zip is there too.

## Shortest path (about 10 minutes, web only)

1. Open **https://itch.io/game/new** while logged in.
2. **Title:** `SCRATCH`. **Project URL:** anything free on your account, e.g. `scratch`.
3. **Kind of project:** HTML. **Release status:** Released. **Pricing:** your call.
4. **Uploads:**
   - Upload `SCRATCH-web-v1.0.0.zip` (from this folder).
   - Tick **"This file will be played in the browser"**.
5. **Embed options:**
   - Viewport 1280 × 720.
   - Fullscreen button on.
   - Mobile friendly off.
   - Automatically start off.
6. **Details:**
   - Fill in the description, genre, tags and so on from `PAGE.md` (copy and paste).
   - itch.io will ask whether generative AI was used. Only you can answer that; please answer truthfully.
7. **Images:**
   - Cover: `cover-630x500.png`.
   - Screenshots: everything in `screenshots/`, plus the two GIFs in `gifs/`.
8. **Visibility:** leave it on **Draft**, then **Save**.
9. **Test the draft:**
   - Use "View page" (drafts are visible to you only).
   - Click "Run game", press a key, and start a run.
   - Take a shot. Press Esc and switch to Classic, then come back.
   - Try the fullscreen button.
   - Reload the page and press CONTINUE RUN.
10. **Publish:** when the draft plays well, go to **Edit game**, set **Visibility: Public** and **Save**.

## Theme (optional, 2 minutes)

On the page itself, use **Edit theme** with the colours and banner listed at the
end of `PAGE.md`. Background images are in this folder.

## Trailer

itch.io only accepts a YouTube or Vimeo link. Upload `trailer/scratch-trailer.mp4`
to one of them, then paste the link into **Gameplay video or trailer**. Until you
do, leave that field empty.

## Later updates with butler (optional)

butler is itch.io's command-line uploader. It sends only the files that changed.

```bash
# once: install and log in (opens itch.io in your browser to approve)
curl -L -o butler.zip https://broth.itch.zone/butler/darwin-arm64/LATEST/archive/default
unzip butler.zip && chmod +x butler
./butler login

# each release, from the SCRATCH folder:
npm run release
./butler push dist YOUR-ITCH-USERNAME/YOUR-PROJECT-URL:html5 --userversion 1.0.0
```

- **First push only:** open the upload in **Edit game** and tick "This file will
  be played in the browser" once.
- **Credentials:** butler keeps its login in
  `~/Library/Application Support/itch/butler_creds`. That is outside this project.
  Never copy it into the repository.

## What was checked before release

All of these ran against the exact contents of `SCRATCH-web-v1.0.0.zip`:
- **Package:**
  - `index.html` is at the zip root.
  - Every path is relative.
  - There are no source maps and no debug hooks. The test hooks need `?debug`.
  - 39 files, 2.1 MB zipped.
- **Browsers:** Chrome, Firefox 156 and WebKit (Safari 26's engine) each played the same path:
  - start a run, choose a table, take a shot;
  - pause and switch to Classic;
  - play a Classic break;
  - switch back and continue the run.

  There were no console errors, and each ran at 60 fps.
- **A cross-site iframe, like itch.io's embed:**
  - Keyboard focus works after a click.
  - Saves persist across a reload.
  - The mouse wheel does not scroll the page.
  - Fullscreen works when allowed and explains itself when not.
- **Window sizes** from 960 × 540 to 1920 × 1080, and 1440 × 900 at 2× pixel density: no clipped UI.
