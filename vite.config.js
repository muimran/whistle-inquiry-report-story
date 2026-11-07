import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// The pages (article + one iframe page per interactive) load the build the
// same way the live site will: <link href="interactives.css"> and
// <script src="interactives.js">. In dev those two URLs are served from
// source so hot reload works; in a build they are real files in dist/.
const PAGES = ['index.html', 'embed', 'images'];

function devBundleAlias() {
	return {
		name: 'whistle-dev-bundle-alias',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const path = (req.url || '').split('?')[0];
				if (path.endsWith('/interactives.js')) {
					res.setHeader('Content-Type', 'text/javascript');
					res.end("import('/src/main.js');");
					return;
				}
				if (path.endsWith('/interactives.css')) {
					// In dev, Vite injects component CSS from JS.
					res.setHeader('Content-Type', 'text/css');
					res.end('');
					return;
				}
				next();
			});
		}
	};
}

const shortHash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8);

function copyPages() {
	return {
		name: 'whistle-copy-pages',
		apply: 'build',
		closeBundle() {
			for (const p of PAGES) {
				const from = resolve(p);
				if (existsSync(from)) cpSync(from, resolve('dist', p), { recursive: true });
			}

			// The site caches .js and .css files for 4 hours. Each build stamps the
			// pages' links with a version taken from the file's content
			// (interactives.js?v=1a2b3c4d), so readers get a new build at once.
			const v = {
				js: shortHash(resolve('dist/interactives.js')),
				css: shortHash(resolve('dist/interactives.css'))
			};
			const embedDir = resolve('dist/embed');
			const pages = [resolve('dist/index.html')];
			if (existsSync(embedDir)) {
				for (const f of readdirSync(embedDir)) if (f.endsWith('.html')) pages.push(resolve(embedDir, f));
			}
			for (const page of pages) {
				const html = readFileSync(page, 'utf8')
					.replace(/interactives\.js(?=["'])/g, `interactives.js?v=${v.js}`)
					.replace(/interactives\.css(?=["'])/g, `interactives.css?v=${v.css}`);
				writeFileSync(page, html);
			}
		}
	};
}

export default defineConfig({
	plugins: [svelte(), devBundleAlias(), copyPages()],
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		// One classic script + one stylesheet, stable names, no hashes:
		// easy to hand over and to reference from a CMS template.
		lib: {
			entry: 'src/main.js',
			name: 'WhistleInteractives',
			formats: ['iife'],
			fileName: () => 'interactives.js',
			cssFileName: 'interactives'
		},
		minify: true,
		sourcemap: false
	}
});
