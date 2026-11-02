# Weekly store assets

Everything for the Chrome Web Store submission. See `store-listing.md` for the text to paste.

> **BLOCKER before submission: host `privacy-policy.html` at a public URL.** The listing still holds the placeholder `https://[host this file publicly]/privacy-policy.html`, and the store will not accept it.
> 1. Publish the file on any static host. With GitHub Pages: add it to a public repo (root or `docs/`), then Settings, Pages, deploy from that branch. The URL is `https://<user>.github.io/<repo>/privacy-policy.html`.
> 2. Open the URL in a private window. It must load, say version 3.0.0 and show the right "Last updated" date.
> 3. Replace the placeholder in `store-listing.md` (Basics table) and paste the URL in the dashboard's Privacy tab.

| File | Size | Purpose |
|---|---|---|
| `icon-128.png` | 128x128 (RGBA, 96x96 art + padding) | Store icon, copied from `icons/128.png` |
| `screenshot-1-report.png` | 1280x800 | Week report: tickets with their merge requests grouped into the drafted update (Done first, then tracked work). Always the first screenshot |
| `screenshot-2-panel.png` | 1280x800 | Side panel, Today tab, beside its caption |
| `screenshot-3-calendar.png` | 1280x800 | Calendar with Friday's day sheet open |
| `screenshot-4-notes-dark.png` | 1280x800 | Notes in the app, dark. Stats is no longer shown (it is not the core job) |
| `promo-small-440x280.png` | 440x280 | Small promo tile |
| `promo-marquee-1400x560.png` | 1400x560 | Marquee promo tile |
| `store-listing.md` | | Name, descriptions, permission justifications, data-usage answers, reviewer instructions |
| `privacy-policy.html` | | Standalone policy. Host at a public URL (contact: srewoo@gmail.com, dated 2 November 2026) |
| `generate.mjs` | | Regenerates all PNGs. Needs Chromium. Run it again after any UI change |
| `demo-data.mjs` | | The fictional engineer/PM week (tickets, MRs, notes) in the screenshots; anonymize is on for the report shot |

All images are 24-bit PNG with no alpha (except the icon, which needs transparency). The UI in them is the real built extension seeded with fictional data.

## Regenerate

Needs Node 22+, Playwright, a Chromium binary, and `ffmpeg` on PATH.

```sh
cd .. && npm run build
cd store-assets
PLAYWRIGHT_PATH=/path/to/node_modules \
CHROMIUM_PATH=/path/to/Chromium \
EXT_DIR=../dist/weekly \
node generate.mjs
```

The pages' clock is set to the most recent Friday at 16:20, and the tasks, notes and tracked week are dated from it, so the pictures show the same kind of week whenever they are made. The private note is sealed by the extension's own PIN code (demo PIN `2580`) and left locked. Screenshots 4 and 5 use the dark theme (`theme: 'dark'` in settings), not an emulated colour scheme.

Optional: `OUT_DIR` (default: this folder), `SCRATCH` (temp dir; default is a new one under the OS temp dir). The script copies the extension to the scratch dir and loads that copy; it never writes to the source tree.

Edit `demo-data.mjs` (tasks and notes) or the `WEEK` table in `generate.mjs` (tracked time) to change the fictional data. `npm test` checks that the demo data is what Weekly would store and that every image has the size the store wants.

## Update notes for Daybook and ForgetMeNot users

Kept out of the Weekly listing so it leads with the product. Use it in the farewell updates and support mail: Daybook and ForgetMeNot are now part of Weekly. In Daybook, open Settings, then Export under Your data. In ForgetMeNot, open Settings, then Export under Backup. In Weekly, open Settings, then Import a backup under Your data and choose the file. Weekly shows what the file holds before anything changes and asks you to confirm before Replace. Private ForgetMeNot notes ask for the PIN they were locked with.
