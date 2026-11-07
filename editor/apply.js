#!/usr/bin/env node
// Reads editor/content.json and writes changes back into:
//   - index.html          (body text)
//   - src/interactives/*/content.js  (interactive text)
//
// Run:  node editor/apply.js
//
// The script matches each body block by its current text (not by line number),
// so it survives re-ordering and small structural edits. For interactives, it
// re-generates the content.js files from the JSON using the original files as
// templates, replacing only the string values while keeping the JS structure.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const content = JSON.parse(readFileSync(join(__dirname, 'content.json'), 'utf8'));

// ── 1. Apply body text to index.html ──────────────────────────────────────────

let html = readFileSync(join(root, 'index.html'), 'utf8');

// We need to find the original text for each block and replace it.
// The extract script stored the inner HTML of each element. We search for that
// exact string in the HTML and replace it with the (possibly edited) version.

// Load the *original* content.json to get the before-text for diffing.
// If there's no original, we use the current text as-is (first run).
let originalContent;
try {
  // We compare against what's currently in the HTML, which is what extract.js produced.
  // So we re-extract to get the "before" state.
  originalContent = null; // will be handled below
} catch (e) {
  originalContent = null;
}

// Strategy: for each body block that changed, find its original text in the HTML
// and replace it. We need the *previous* extraction to know what to search for.
// Since extract.js always runs before apply.js (the GitHub Action does extract on push,
// and the editor saves to content.json), we compare the current HTML against what
// we want it to be.

// Re-extract from the current HTML to get the "before" state
const beforeContent = await extractBody(html);

let bodyChanges = 0;
for (const block of content.body) {
  const before = beforeContent.find(b => b.id === block.id);
  if (!before) continue;
  if (before.text === block.text) continue;

  // Replace in HTML — find the exact original text and swap it
  const escaped = escapeForRegex(before.text);
  const re = new RegExp(escaped, 'g');
  const matches = html.match(re);
  if (matches && matches.length === 1) {
    html = html.replace(re, block.text);
    bodyChanges++;
  } else if (matches && matches.length > 1) {
    // Ambiguous — wrap in tag context to disambiguate
    const tagRe = new RegExp(`(<${block.tag}[^>]*>)\\s*${escaped}\\s*(</)`, 'g');
    let replaced = false;
    html = html.replace(tagRe, (match, open, closeStart) => {
      if (replaced) return match;
      replaced = true;
      bodyChanges++;
      return `${open}${block.text}${closeStart}`;
    });
  } else {
    console.warn(`⚠ Could not find body block "${block.id}" in HTML — skipped`);
  }
}

writeFileSync(join(root, 'index.html'), html, 'utf8');
console.log(`Applied ${bodyChanges} body text change(s) to index.html`);

// ── 2. Apply interactive text to content.js files ─────────────────────────────

for (const name of ['inquiry', 'letter', 'verdicts']) {
  const data = content.interactives[name];
  if (!data) continue;

  const filePath = join(root, 'src', 'interactives', name, 'content.js');
  let src = readFileSync(filePath, 'utf8');
  let changes = 0;

  // Walk the JSON data and find string values that differ from what's in the file.
  // For each changed string, find it in the source and replace it.
  const originalMod = await import(filePath);

  function applyChanges(edited, original, path = '') {
    if (edited === null || edited === undefined) return;
    if (typeof edited === 'string' && typeof original === 'string' && edited !== original) {
      // Replace this string in the source file
      const escapedOrig = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match inside quotes (single or backtick)
      const patterns = [
        new RegExp(`'${escapedOrig}'`, 'g'),
        new RegExp(`"${escapedOrig}"`, 'g'),
        new RegExp(`\`${escapedOrig}\``, 'g'),
      ];
      let found = false;
      for (const re of patterns) {
        const m = src.match(re);
        if (m && m.length >= 1) {
          const quote = src[src.indexOf(m[0])];
          src = src.replace(m[0], `${quote}${edited}${quote}`);
          changes++;
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn(`⚠ Could not find string at ${path} in ${name}/content.js`);
      }
    } else if (Array.isArray(edited) && Array.isArray(original)) {
      for (let i = 0; i < edited.length; i++) {
        applyChanges(edited[i], original[i], `${path}[${i}]`);
      }
    } else if (typeof edited === 'object' && typeof original === 'object' && edited && original) {
      // Skip function placeholders
      if (edited.__fn) return;
      for (const key of Object.keys(edited)) {
        if (key === '__fn') continue;
        const origVal = original[key];
        if (typeof origVal === 'function') continue;
        applyChanges(edited[key], origVal, `${path}.${key}`);
      }
    }
  }

  const originalData = {};
  for (const [key, value] of Object.entries(originalMod)) {
    if (typeof value === 'function') continue;
    originalData[key] = value;
  }

  applyChanges(data, originalData);

  writeFileSync(filePath, src, 'utf8');
  console.log(`Applied ${changes} change(s) to ${name}/content.js`);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function extractBody(htmlStr) {
  const blocks = [];
  const articleStartIdx = htmlStr.indexOf('<!-- ==================== ARTICLE START');
  const articleEndIdx = htmlStr.indexOf('<!-- ==================== ARTICLE END');
  if (articleStartIdx === -1 || articleEndIdx === -1) return blocks;
  const articleHtml = htmlStr.slice(articleStartIdx, articleEndIdx);

  const heroTitle = matchOne(articleHtml, /<h2>(.*?)<\/h2>/s);
  const heroSubtitle = matchOne(articleHtml, /<h3>(.*?)<\/h3>/s);
  const heroLede = matchOne(articleHtml, /<div class="lead-Desc">\s*<p>(.*?)<\/p>/s);
  const heroCredits = [...articleHtml.matchAll(/<div class="lead-Credit">\s*([\s\S]*?)<\/div>/g)]
    .flatMap(m => [...m[1].matchAll(/<p>(.*?)<\/p>/gs)].map(p => p[1]));

  if (heroTitle) blocks.push({ id: 'hero-title', tag: 'h2', text: heroTitle });
  if (heroSubtitle) blocks.push({ id: 'hero-subtitle', tag: 'h3', text: heroSubtitle });
  if (heroLede) blocks.push({ id: 'hero-lede', tag: 'p', text: heroLede });
  heroCredits.forEach((c, i) => blocks.push({ id: `hero-credit-${i}`, tag: 'p', text: c }));

  const sectionRe = /<section class="(?:story-section|investigation-container)">([\s\S]*?)<\/section>/g;
  let sectionMatch;
  let sectionIdx = 0;
  while ((sectionMatch = sectionRe.exec(articleHtml)) !== null) {
    const sectionHtml = sectionMatch[1];
    const elementRe = /<(h2[^>]*|p[^>]*)>([\s\S]*?)<\/(?:h2|p)>/g;
    let elMatch;
    let blockIdx = 0;
    while ((elMatch = elementRe.exec(sectionHtml)) !== null) {
      const fullTag = elMatch[1];
      const tag = fullTag.startsWith('h2') ? 'h2' : 'p';
      const text = elMatch[2].trim();
      if (text === '') continue;
      blocks.push({ id: `section-${sectionIdx}-${tag}-${blockIdx}`, tag, text });
      blockIdx++;
    }
    sectionIdx++;
  }
  return blocks;
}

function matchOne(str, re) {
  const m = str.match(re);
  return m ? m[1].trim() : null;
}
