// Is the page inside an iframe that grows with its content (an embed sized to
// fit, like the README's iframe option)? Then nothing can stay on screen while
// the reader scrolls, so the interactives show their plain fallback.
//
// A frame no taller than the screen (a phone simulator, or an embed with a
// fixed height that scrolls inside) scrolls on its own, so the interactives
// behave there exactly as on a normal page.
export function inFlatFrame() {
	if (typeof window === 'undefined' || window.self === window.top) return false;
	return window.innerHeight > (window.screen?.height || 1000);
}
