#!/usr/bin/env node
// Extracts all editable text from index.html and src/interactives/*/content.js
// into a single content.json that the editor page reads.
//
// Run:  node editor/extract.js
// Output: editor/content.json

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── 1. Body text from index.html ──────────────────────────────────────────────
// We extract the article region between ARTICLE START and ARTICLE END comments,
// then pull out every text-bearing element with a simple regex approach.
// Each block gets a stable ID like "body-0", "body-1", etc.

const html = readFileSync(join(root, 'index.html'), 'utf8');

const articleStart = html.indexOf('<!-- ==================== ARTICLE START');
const articleEnd = html.indexOf('<!-- ==================== ARTICLE END');
if (articleStart === -1 || articleEnd === -1) {
  console.error('Could not find ARTICLE START / ARTICLE END markers in index.html');
  process.exit(1);
}

const articleHtml = html.slice(articleStart, articleEnd);

// Split the article into sections (separated by wi-embed divs).
// Within each section, extract the hero block and story sections.
const bodyBlocks = [];

// Hero block
const heroTitle = matchOne(articleHtml, /<h2>(.*?)<\/h2>/s);
const heroSubtitle = matchOne(articleHtml, /<h3>(.*?)<\/h3>/s);
const heroLede = matchOne(articleHtml, /<div class="lead-Desc">\s*<p>(.*?)<\/p>/s);
const heroCredits = [...articleHtml.matchAll(/<div class="lead-Credit">\s*([\s\S]*?)<\/div>/g)]
  .flatMap(m => [...m[1].matchAll(/<p>(.*?)<\/p>/gs)].map(p => p[1]));

if (heroTitle) bodyBlocks.push({ id: 'hero-title', tag: 'h2', text: heroTitle, section: 'hero' });
if (heroSubtitle) bodyBlocks.push({ id: 'hero-subtitle', tag: 'h3', text: heroSubtitle, section: 'hero' });
if (heroLede) bodyBlocks.push({ id: 'hero-lede', tag: 'p', text: heroLede, section: 'hero' });
heroCredits.forEach((c, i) => {
  bodyBlocks.push({ id: `hero-credit-${i}`, tag: 'p', text: c, section: 'hero' });
});

// Story sections — everything inside <section class="story-section"> and
// <section class="investigation-container">
const sectionRe = /<section class="(?:story-section|investigation-container)">([\s\S]*?)<\/section>/g;
let sectionMatch;
let sectionIdx = 0;
while ((sectionMatch = sectionRe.exec(articleHtml)) !== null) {
  const sectionHtml = sectionMatch[1];
  // Extract headings and paragraphs in order
  const elementRe = /<(h2[^>]*|p[^>]*)>([\s\S]*?)<\/(?:h2|p)>/g;
  let elMatch;
  let blockIdx = 0;
  while ((elMatch = elementRe.exec(sectionHtml)) !== null) {
    const fullTag = elMatch[1];
    const tag = fullTag.startsWith('h2') ? 'h2' : 'p';
    const text = elMatch[2].trim();
    // Skip empty closing-quote markers
    if (text === '' || text.match(/^<p[^>]*>\s*<\/p>$/)) continue;
    bodyBlocks.push({
      id: `section-${sectionIdx}-${tag}-${blockIdx}`,
      tag,
      text,
      section: `section-${sectionIdx}`
    });
    blockIdx++;
  }
  sectionIdx++;
}

// Investigation heading (inside investigation-container)
const investigationHeading = matchOne(articleHtml, /<h2 class="investigation-heading">([\s\S]*?)<\/h2>/);
if (investigationHeading) {
  // Find which section it belongs to — it's already captured above, but add it explicitly if missed
  const existing = bodyBlocks.find(b => b.text === investigationHeading);
  if (!existing) {
    bodyBlocks.push({ id: 'investigation-heading', tag: 'h2', text: investigationHeading, section: 'investigation' });
  }
}

// ── 2. Interactive content from content.js files ──────────────────────────────

function extractInteractive(name) {
  const filePath = join(root, 'src', 'interactives', name, 'content.js');
  const src = readFileSync(filePath, 'utf8');
  return { name, src, path: `src/interactives/${name}/content.js` };
}

const interactives = {};
for (const name of ['inquiry', 'letter', 'verdicts']) {
  const { src, path } = extractInteractive(name);
  // We store the raw JS source. The editor will parse exported values.
  // For round-tripping, we store the content as structured data.
  interactives[name] = { path, src };
}

// Parse inquiry content
function parseInquiry(src) {
  const data = {};
  data.header = extractExport(src, 'header');
  data.phases = extractExport(src, 'phases');
  data.steps = extractExport(src, 'steps');
  data.note = extractExport(src, 'note');
  data.ui = extractExport(src, 'ui');
  data.dates = extractExport(src, 'dates');
  return data;
}

// Instead of complex JS parsing, we'll use dynamic import
async function loadContentModule(name) {
  const filePath = join(root, 'src', 'interactives', name, 'content.js');
  const mod = await import(filePath);
  return mod;
}

async function main() {
  const content = { body: bodyBlocks, interactives: {} };

  for (const name of ['inquiry', 'letter', 'verdicts']) {
    const mod = await loadContentModule(name);
    const data = {};
    for (const [key, value] of Object.entries(mod)) {
      // Skip functions — we only want data
      if (typeof value === 'function') continue;
      data[key] = serializeValue(value);
    }
    content.interactives[name] = data;
  }

  writeFileSync(join(__dirname, 'content.json'), JSON.stringify(content, null, 2), 'utf8');
  console.log(`Extracted ${bodyBlocks.length} body blocks and ${Object.keys(content.interactives).length} interactives → editor/content.json`);
}

// Recursively serialize, turning functions into their source strings
function serializeValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'function') return { __fn: val.toString() };
  if (Array.isArray(val)) return val.map(serializeValue);
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return val;
}

function matchOne(str, re) {
  const m = str.match(re);
  return m ? m[1].trim() : null;
}

main().catch(e => { console.error(e); process.exit(1); });
