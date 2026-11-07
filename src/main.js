// Finds every <div data-interactive="..."> on the page and draws that
// interactive into it. The same file works on the article page and on the
// standalone iframe pages in /embed.
import './styles/base.css';
import { mount } from 'svelte';
import { inFlatFrame } from './lib/frame.js';
import Inquiry from './interactives/inquiry/Inquiry.svelte';
import Verdicts from './interactives/verdicts/Verdicts.svelte';
import Letter from './interactives/letter/Letter.svelte';

const REGISTRY = {
	inquiry: Inquiry,
	verdicts: Verdicts,
	letter: Letter
};

function init() {
	document.querySelectorAll('[data-interactive]').forEach((target) => {
		if (target.dataset.wiMounted) return;
		const Component = REGISTRY[target.dataset.interactive];
		if (!Component) return;
		target.dataset.wiMounted = '1';
		target.textContent = ''; // remove the no-JS fallback text
		mount(Component, { target });
	});

	// Not in an embed that grows with its content (see lib/frame.js)
	if (!inFlatFrame()) hideMenuOverInteractives();

	// Inside an iframe: tell the parent page how tall we are, so a page that
	// listens (optional snippet in README) can size the iframe exactly.
	if (window.parent !== window) {
		let last = 0;
		const send = () => {
			const h = Math.ceil(document.documentElement.scrollHeight);
			if (h === last) return;
			last = h;
			window.parent.postMessage({ type: 'whistle-embed-height', id: location.pathname, height: h }, '*');
		};
		new ResizeObserver(send).observe(document.documentElement);
		send();
	}
}

// The site's menu bar is fixed to the top of the screen once the reader scrolls.
// The moment an interactive's top edge touches the menu's bottom edge, the menu
// folds away in one smooth move. It stays away until the whole interactive has
// left the screen, then slides back in slowly. (The animation itself is CSS in
// base.css; this only switches a class on <html>.) If the page has no such menu
// (e.g. the embed pages), nothing happens.
function hideMenuOverInteractives() {
	const menu = document.querySelector('.homePage-menu');
	const targets = [...document.querySelectorAll('[data-wi-mounted]')];
	const hero = document.querySelector('.lead-big-img');
	if (!menu || (!targets.length && !hero)) return;
	const html = document.documentElement;
	html.classList.add('wi-menu-watch');
	const update = () => {
		const h = menu.offsetHeight;
		const hide = targets.some((el) => {
			const r = el.getBoundingClientRect();
			return r.top <= h && r.bottom > 0;
		});
		html.classList.toggle('wi-menu-hidden', hide);
		// Like part one: the fixed menu stays away while the hero image is on screen,
		// and slides in once the hero has scrolled off.
		const overHero = !!hero && hero.getBoundingClientRect().bottom > 0;
		html.classList.toggle('wi-menu-hero', overHero);
		// From the first hide on, the site's own fade-in animation on the menu is
		// switched off: otherwise it replays each time the menu comes back (a flicker).
		if (hide || overHero) html.classList.add('wi-menu-tamed');
	};
	window.addEventListener('scroll', update, { passive: true });
	window.addEventListener('resize', update);
	update();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
