# The Whistle: inquiry report story (part 2)

The follow-up to [the 1 Nov story](https://www.thewhistle.news/coach-accused-of-harassment).
It's a plain HTML article with three interactives built in Svelte.

| What | Where |
| --- | --- |
| The whole page: the article in plain HTML (same markup and classes as part one), inside part one's site header and footer | `index.html` |
| Inquiry scrolly: সময় ছিল ১৫ কর্মদিবস, প্রতিবেদন এল ৮৩ দিনে | `src/interactives/inquiry/` |
| Four verdicts: চার অভিযোগ, চার রায় | `src/interactives/verdicts/` |
| Letter's journey: একটি চিঠির যাত্রা | `src/interactives/letter/` |
| Standalone page for each interactive (for iframes) | `embed/*.html` |
| Source draft | `The_Whistle_tadanta-protibedon_v3-edited.docx` |
| Text for the scrolly | `interactive timeline.docx` |
| Earlier 83-day timeline (replaced by the scrolly, no longer built) | `src/interactives/timeline/` |

## The scrolly

All its words, dates and sources are in `src/interactives/inquiry/content.js`, one block per step. The comments there explain each field. Two things to fill in later:
- `dates.ext1`: where the first extension (announced 2 December, +15 working days) ended. It's set to 21 December: The Whistle's own count, done the same way as the 30 November deadline, and marked approximate on the chart and in the note. Replace it if the real date turns up.
- `src` on 6 November and 21 December: these entries have no source yet.

## Versions and viewing

The project lives in a public GitHub repo: https://github.com/muimran/whistle-inquiry-report-story. Every change is kept as a version.

- **To view the page without installing anything:** download the repo (Code → Download ZIP), unzip it and open `dist/index.html` in a browser.
- **`dist/` is committed on purpose,** so the built page is always there to look at or hand over. After changing anything, run `npm run build` before committing, so `dist/` matches the source.
- **To share it:** send the repo link.
- **Live preview:** https://muimran.github.io/whistle-inquiry-report-story/ is rebuilt and published automatically on every push to `main` (`.github/workflows/pages.yml`, progress under the repo's Actions tab). The preview copy is marked `noindex`, which asks search engines not to list it.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, reloads on save
npm run build      # writes everything to dist/
npm run preview    # serves dist/ at http://localhost:4173
```

## Editing text

- **Article text:** edit `index.html` directly. No build is needed.
- **Words inside an interactive:** each one has a `content.js` holding all of its text, dates and numbers. Edit it, then run `npm run build`.

What to upload after a change: see [After it's live](#after-its-live).

## Publishing

`dist/` is a complete page. It's the same kind of built folder as the election story, which the web team uploaded to thewhistle.news/election_2026_leader_speech/.

```
dist/
  index.html          the whole page: site header and footer, share tags, analytics, the article
  interactives.js     all three interactives
  interactives.css    their styles (+ Noto Sans/Serif Bengali)
  embed/              one standalone page per interactive (only for the iframe route below)
  images/             hero image (currently a placeholder)
```

### Recommended: upload `dist/` as a folder

The web team uploads the folder as it is, for example to `thewhistle.news/[folder-name]/`, and links to it from the homepage.

Before the final build:
1. In `index.html`, replace `[folder-name]` (in `canonical`, `og:url` and `og:image`) with the folder's name on the site.
2. Put the hero image in `images/` (see [Hero image](#hero-image)).
3. Fill in `[প্রকাশের তারিখ]` and `[শিল্পীর নাম]`.
4. Delete the internal notes in the article: the headline options and the DRAFT NOTE. HTML comments go live as written (part one's are all in its page source), so anyone could read them.

Then run `npm run build`, zip `dist/` and send it.

The site header and footer are copied from part one's page (7 Nov 2026). If the site's menu changes before publication, copy the new one in. The analytics tags (the same ones part one uses) only load on thewhistle.news, so local previews aren't counted.

### After it's live

- **Article text:** edit `index.html` and upload it again. If someone edits the file on the server instead, make the same change here, or the next upload will undo it.
- **Words inside an interactive:** edit its `content.js`, run `npm run build`, then upload `interactives.js` (and `interactives.css` if styles changed) **together with** `index.html`. Each build stamps the page's links with a version taken from the file (`interactives.js?v=95324665`). Readers then get the new file at once, instead of a copy cached for 4 hours.

### Hero image

Part one's hero is a 1672 × 849 px illustration, credited "ইলাস্ট্রেশন: অর্ক". The same file is also the page's `og:image`, so it shows up on Facebook and WhatsApp shares.
For part two, put the final image in `images/`, then update three things in `index.html`:
1. the `<img src>` in the hero
2. the credit line under it, "ইলাস্ট্রেশন: [শিল্পীর নাম]"
3. the `og:image` tag in the `<head>`, with the image's full address: `https://www.thewhistle.news/[folder-name]/images/<file>`. Use a .jpg or .png, because Facebook doesn't show .svg.

### If the story has to go into the CMS instead

Hand over only the part of `index.html` between `ARTICLE START` and `ARTICLE END`. The site template already provides the header, footer and site styles; the share tags in the `<head>` go into the CMS's own fields.

#### Option A: the CMS allows `<script>`

1. Upload `interactives.js` and `interactives.css` next to the story.
2. Add these two lines to the story page's `<head>` (adjust the path):
   ```html
   <link rel="stylesheet" href="interactives.css">
   <script src="interactives.js" defer></script>
   ```
3. Paste the article (between `ARTICLE START` and `ARTICLE END` in `index.html`) into the page.
   Each `<div class="wi-embed" data-interactive="...">` turns into its interactive.

#### Option B: the CMS strips scripts, but allows iframes

1. Upload the whole `dist/` folder (the `embed/` pages need `interactives.js` and `interactives.css` one level up).
2. Replace each `<div class="wi-embed" data-interactive="...">…</div>` in the article with:
   ```html
   <iframe src="PATH/embed/inquiry.html" title="সময় ছিল ১৫ কর্মদিবস, প্রতিবেদন এল ৮৩ দিনে"
           style="display:block;width:100%;max-width:1040px;margin:40px auto;border:0;height:4000px"
           loading="lazy"></iframe>
   ```
   Starting heights: inquiry `4000px` (max-width 1040px), verdicts `1500px` (max-width 980px), letter `3400px` (max-width 1040px).
   Inside an iframe nothing can stay on screen, so the two scrollies show everything at once: the inquiry as a plain list, the letter with its note-sheet already filled in.
   On phones the content is taller and scrolls inside the frame.
3. Optional, if a small script *is* allowed: the embed pages report their real height. This snippet then sizes every iframe exactly:
   ```html
   <script>
   window.addEventListener('message', function (e) {
     if (!e.data || e.data.type !== 'whistle-embed-height') return;
     document.querySelectorAll('iframe').forEach(function (f) {
       if (f.contentWindow === e.source) f.style.height = e.data.height + 'px';
     });
   });
   </script>
   ```

## On phones

Each interactive has its own phone layout. The switch happens on screen width, so no extra setup is needed.

| Interactive | Desktop | Phone |
| --- | --- | --- |
| Inquiry (scrolly) | A small chart (day count, time band, deadline line) stays at the top while one card per step scrolls past. Each step grows the band and moves the deadline line. | The same. |
| Verdicts | All four flip cards at once in a compact 2 × 2 grid. The section pins to the screen on a full-width band (`--vd-band`) while the reader scrolls 70 % of a screen height (`HOLD` in `Verdicts.svelte`), with a thin bar along the bottom showing progress, then lets go. It pins only when the cards fit the screen height; on shorter screens it stays in the normal flow | Pinned the same way. The four allegations as small cards on one screen (number, title, then the verdict once seen); tapping one opens the full card on top, with the guess, the flip and \"পরের অভিযোগ →\"; ✕ closes it. |
| Letter (light scrolly) | The note-sheet stays on screen on the left and fills one row per step as the reader scrolls past the steps, shown in full on the right. Clicking a row scrolls to that step. | Only the note-sheet. It pins to the middle of the screen for about one screen of scrolling, and its rows fill in one by one as the reader scrolls, with the "no written record" count going up (on screens too short to pin it, the rows fill in on their own the first time it comes into view). Tapping a row opens that step's full text on top, with ← আগের / পরের → and ✕ to close (Escape or a tap outside also closes it). |

The site's menu bar becomes fixed at the top after scrolling: 58 px tall on phones and tablets, 76 px from 992 px wide up. The moment an interactive's top edge touches the bottom of the menu, the menu folds away in one smooth move (0.35 s). The interactive's chart, note-sheet or count line moves up to the top of the screen. The menu stays away until the whole interactive has left the screen, then slides back in slowly (0.5 s). This is the one place the interactives touch the site's page: `main.js` switches a class on `<html>`, and `base.css` hides the site's `.homePage-menu.sticky` while it's there. If the site renames those classes, the menu simply stays visible and everything still works. When the menu is showing, anything that stays on screen sits 72 px below the top (90 px on desktop), so the menu doesn't cover it. The embed pages set this to 12 px with `--wi-sticky-top`.

The site's CSS turns on smooth scrolling for the whole page. The interactives still jump without animation for readers who have reduced motion switched on.

## Notes

- Interactive styles are scoped under `.wi`, so they don't change the site's page. Class names were checked against the site's CSS (Bootstrap 5.0.1, `eMythMakers.css`, slick, animate.css, fancybox, Font Awesome).
- `index.html` loads the same site styles and scripts as part one (Bootstrap, jQuery, `eMythMakers.css` and `eMythMakers.js`), so the menu, search and back-to-top button behave as on the rest of the site.
