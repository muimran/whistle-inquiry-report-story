# Editor workflow

A click-to-edit replica of the article where non-technical editors can change any text and save it back to GitHub.

## How it works

1. **Editor page** — live at `https://muimran.github.io/whistle-inquiry-report-story/editor/`. Each text block is click-to-edit. Changes are saved to `editor/content.json` on GitHub via a Personal Access Token.

2. **Editor → source, automatic** — every save triggers the GitHub Action `editor-sync.yml`:
   - `editor/apply.js` writes the edits into `index.html` and the `content.js` files. An edit is any text that differs between `content.json` and `applied.json` (the last state where editor and source matched). Each edit is found by its old text, never by position, so added or removed paragraphs can't send it to the wrong place. Apostrophes, quotes and `$` are written safely.
   - The page is built. If an edit would break it, that run's edits are dropped, the editor text is reset, and the run shows a red ✕ (GitHub emails the repo owner). Nothing broken is ever published.
   - An edit whose old text can't be found exactly once (because the same paragraph was also changed in the code, say) is skipped, listed in the run summary, and the run shows a red ✕.
   - `extract.js` refreshes `content.json` and `applied.json`, and everything is committed with a message listing the changed texts. The preview then republishes.

3. **Source → editor, automatic** — the same Action runs when `index.html` or a `content.js` file is changed in code, so the editor always shows the latest text. Unapplied editor edits are applied first, never overwritten.

**This is all background work.** Nothing reaches thewhistle.news: the live page changes only when the website team uploads a `dist/` folder.

### Undoing an edit

Every save is its own commit ("Editor: N edit(s) applied …"). To undo one, revert that commit:
```
git pull
git revert <commit>
git push
```
The sync then puts the old text back into the editor too.

### Editors: if saving fails

After a save, the Action updates `content.json` on GitHub within a minute or two. An editor who keeps the page open and saves again may get a conflict error: reload the page and redo that last change.

### Stopping it when editing is finished

1. GitHub → **Actions** → **Editor sync** → the **…** menu (top right) → **Disable workflow**.
2. Revoke the editors' tokens at https://github.com/settings/personal-access-tokens.
3. Optional: remove the "Include editor page" step from `.github/workflows/pages.yml` so the editor page is no longer published.

To restart later, enable the workflow again.

## Files

| File | Purpose |
|------|---------|
| `editor/index.html` | The editor page (deployed to GitHub Pages) |
| `editor/content.json` | All editable text extracted from source files (editors save here) |
| `editor/applied.json` | Baseline: `content.json` as it was when editor and source last matched |
| `editor/extract.js` | Extracts text from `index.html` + `content.js` files → `content.json` |
| `editor/apply.js` | Writes editor edits (content.json vs applied.json) into the source files |
| `.github/workflows/editor-sync.yml` | Applies edits, checks the build, syncs, commits (both directions) |
| `.github/workflows/pages.yml` | Deploys site + editor to GitHub Pages (also after each editor sync) |

## Editor setup

The editor needs a GitHub PAT with **Contents: Read and write** on the repo. Create one at https://github.com/settings/personal-access-tokens/new, select **Only select repositories** → `whistle-inquiry-report-story`, set **Contents** to **Read and write**. Paste the token into the editor page — it's stored in the browser.
