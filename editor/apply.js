#!/usr/bin/env node
// Writes the editors' changes back into the source files:
//   - index.html                     (article text)
//   - src/interactives/*/content.js  (interactive text)
//
// Run:  node editor/apply.js
//
// How it finds the changes: editor/applied.json is a copy of content.json as it
// was the last time the source and the editor matched. Every text that differs
// between applied.json and content.json is an edit. For each edit, the old text
// is looked up in the source and swapped for the new text. Matching is by the
// old text itself, never by position, so added or removed paragraphs can't send
// an edit to the wrong place.
//
// Edits whose old text can't be found exactly once are skipped and listed.
// The script prints a short summary (also written to editor/last-apply.txt).
// Exit code: 0 = ok (possibly nothing to do), 2 = some edits were skipped.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const read = (p) => readFileSync(join(root, p), 'utf8');
const content = JSON.parse(read('editor/content.json'));
if (!existsSync(join(here, 'applied.json'))) {
	console.log('No editor/applied.json yet: nothing to compare against. Run extract.js first.');
	process.exit(0);
}
const base = JSON.parse(read('editor/applied.json'));

const done = [];
const skipped = [];
const short = (s) => (s.length > 60 ? s.slice(0, 60) + '…' : s);

// ---- Article text (index.html) ----
// Only inside the article (the same text may also sit in the page's share tags).
const fullHtml = read('index.html');
const aStart = fullHtml.indexOf('<!-- ==================== ARTICLE START');
const aEnd = fullHtml.indexOf('<!-- ==================== ARTICLE END');
if (aStart === -1 || aEnd === -1) throw new Error('ARTICLE START / END markers missing in index.html');
let html = fullHtml.slice(aStart, aEnd);
const baseBody = new Map((base.body || []).map((b) => [b.id, b]));
for (const block of content.body || []) {
	const before = baseBody.get(block.id);
	if (!before || before.text === block.text) continue;
	block.text = tidyHtml(block.text);
	if (before.text === block.text) continue;
	const n = count(html, before.text);
	if (n === 1) {
		html = html.split(before.text).join(block.text);
		done.push(`article: "${short(block.text)}"`);
	} else {
		skipped.push(`article: "${short(before.text)}" (${n === 0 ? 'not found' : 'found ' + n + ' times'})`);
	}
}
writeFileSync(join(root, 'index.html'), fullHtml.slice(0, aStart) + html + fullHtml.slice(aEnd), 'utf8');

// ---- Interactive text (content.js) ----
for (const name of Object.keys(content.interactives || {})) {
	const path = `src/interactives/${name}/content.js`;
	if (!existsSync(join(root, path))) continue;
	let src = read(path);
	const pairs = [];
	diff(content.interactives[name], base.interactives?.[name], '', pairs);
	for (const [old, now, where] of pairs) {
		let hit = false;
		for (const q of ["'", '"', '`']) {
			const from = q + jsEscape(old, q) + q;
			const n = count(src, from);
			if (n === 1) {
				src = src.split(from).join(q + jsEscape(now, q) + q);
				done.push(`${name}${where}: "${short(now)}"`);
				hit = true;
				break;
			}
			if (n > 1) {
				// the same text in several places: change them all, they were identical
				src = src.split(from).join(q + jsEscape(now, q) + q);
				done.push(`${name}${where} (${n} places): "${short(now)}"`);
				hit = true;
				break;
			}
		}
		if (!hit) skipped.push(`${name}${where}: "${short(old)}" (not found)`);
	}
	writeFileSync(join(root, path), src, 'utf8');
}

const lines = [
	`${done.length} edit(s) applied`,
	...done.map((d) => '  ✓ ' + d),
	...(skipped.length ? [`${skipped.length} edit(s) skipped`, ...skipped.map((s) => '  ✕ ' + s)] : [])
];
writeFileSync(join(here, 'last-apply.txt'), lines.join('\n') + '\n', 'utf8');
console.log(lines.join('\n'));
process.exit(skipped.length ? 2 : 0);

// ---- helpers ----
const ENT = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
// Interactive text is shown exactly as written, so it must be plain text:
// drop every tag (pasted Word formatting, stray <br>) and tidy the spaces.
function plain(s) {
	return s
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<[^>]+>/g, '')
		.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENT[m])
		.replace(/\s+/g, ' ')
		.trim();
}
// Article text may keep simple tags (links, bold, italics); pasted formatting
// (Word's spans, classes, styles, nested paragraphs) is removed.
function tidyHtml(s) {
	return s
		.replace(/<\/?o:p[^>]*>/gi, '')
		.replace(/<\/?(span|font|div|p)\b[^>]*>/gi, '')
		.replace(/<br\s*\/?>\s*$/i, '')
		.replace(/\s(class|style|lang|dir)="[^"]*"/gi, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}
function count(hay, needle) {
	if (!needle) return 0;
	return hay.split(needle).length - 1;
}
// The text as it would be written inside a JS string with quote q.
function jsEscape(s, q) {
	let out = s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
	out = out.split(q).join('\\' + q);
	if (q === '`') out = out.replace(/\$\{/g, '\\${');
	return out;
}
// Collect [old, new, path] for every string that changed.
function diff(now, old, path, out) {
	if (typeof now === 'string') {
		if (typeof old !== 'string' || old === now) return;
		// keep a trailing space the original had (labels like 'সূত্র: ')
		const clean = plain(now) + (old.endsWith(' ') && !plain(now).endsWith(' ') ? ' ' : '');
		if (clean !== old) out.push([old, clean, path]);
		return;
	}
	if (!now || !old || typeof now !== 'object' || typeof old !== 'object') return;
	if (now.__fn || old.__fn) return; // functions are not editable
	for (const k of Object.keys(now)) diff(now[k], old[k], Array.isArray(now) ? `${path}[${k}]` : `${path}.${k}`, out);
}
