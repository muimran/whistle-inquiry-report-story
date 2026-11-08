<script>
	// Four flip cards: allegation + reply on the front; the reader guesses,
	// the card turns to the committee's verdict, reasoning and open question.
	// Desktop: all four cards at once in a compact 2 × 2 grid that fits one
	// screen; the section pins to the screen for a stretch of scrolling, on a
	// band of its own colour, then lets go. Phones: one card at a time, swiped
	// sideways, in the normal flow of the page.
	import { tick, untrack } from 'svelte';
	import { bn, prefersReducedMotion } from '../../lib/bn.js';
	import { inFlatFrame } from '../../lib/frame.js';
	import * as C from './content.js';

	let cards = $state(C.cases.map(() => ({ open: false, guess: null })));
	const frontEls = [];
	const backEls = [];
	const caseEls = [];
	const tileEls = [];
	let active = $state(0); // the card last opened (outlined in the score bar on phones)
	let sheet = $state(-1); // phones: the card open on top of the four small ones
	const PHONE = typeof matchMedia !== 'undefined' ? matchMedia('(max-width: 640px)') : { matches: false };

	// Phones: open card i on top. Desktop: bring it into view.
	async function showCase(i, focusFront = false) {
		if (i < 0 || i >= C.cases.length) return;
		active = i;
		if (PHONE.matches) {
			sheet = i;
			await tick();
			frontEls[i]?.querySelector('.seg button')?.focus({ preventScroll: true });
			return;
		}
		caseEls[i]?.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth', block: 'nearest' });
		if (focusFront) frontEls[i]?.querySelector('.seg button')?.focus({ preventScroll: true });
	}
	function closeSheet() {
		const i = sheet;
		sheet = -1;
		tileEls[i]?.focus({ preventScroll: true });
	}
	function onKey(e) {
		if (e.key === 'Escape' && sheet >= 0) closeSheet();
	}

	const seen = $derived(cards.filter((s) => s.open).length);
	const guessed = $derived(cards.filter((s) => s.open && s.guess).length);
	const match = $derived(cards.filter((s, i) => s.open && s.guess && s.guess === C.cases[i].v).length);
	const allOpen = $derived(seen === C.cases.length);

	const tallyText = $derived.by(() => {
		if (!seen) return C.ui.tallyNone;
		if (!allOpen)
			return C.ui.tallySome(bn(seen), bn(C.cases.length - seen)) + (guessed ? C.ui.tallySomeMatch(bn(match)) : '');
		return C.ui.tallyAll + (guessed ? C.ui.tallyAllMatch(bn(guessed), bn(match)) : '');
	});

	async function setOpen(i, open, focus) {
		cards[i].open = open;
		if (focus) {
			await tick();
			(open ? backEls[i] : frontEls[i])?.querySelector(open ? '.back-btn' : '.seg button')?.focus({ preventScroll: true });
		}
	}
	function choose(i, guess) {
		cards[i].guess = guess;
		setOpen(i, true, true);
	}
	function toggleAll() {
		const open = !allOpen;
		cards.forEach((_, i) => setOpen(i, open, false));
	}

	// ---- Pinning (desktop) ----
	// The band stays on screen while the reader scrolls HOLD % of a screen
	// height, with a thin bar showing how far through that stretch they are.
	// Only when the cards fit the screen height; never on phones or in an iframe.
	const HOLD = 70;
	const BAND_PAD = 20; // px above and below the cards on the band
	const inFrame = inFlatFrame();
	let trackEl = $state();
	let frameEl = $state();
	let pin = $state(false);
	let progress = $state(0);

	function onPageScroll() {
		if (!pin || !trackEl) return;
		const span = trackEl.offsetHeight - window.innerHeight;
		progress = span > 0 ? Math.min(1, Math.max(0, -trackEl.getBoundingClientRect().top / span)) : 0;
	}
	function measure() {
		if (!frameEl) return;
		pin = frameEl.offsetHeight + 2 * BAND_PAD <= window.innerHeight;
		onPageScroll();
	}
	$effect(() => {
		if (inFrame || !frameEl) return;
		// untrack: the effect must not re-run because measure() reads and sets `pin`
		untrack(measure);
		document.fonts?.ready.then(measure);
		const ro = new ResizeObserver(measure);
		ro.observe(frameEl);
		window.addEventListener('resize', measure);
		window.addEventListener('scroll', onPageScroll, { passive: true });
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', measure);
			window.removeEventListener('scroll', onPageScroll);
		};
	});
</script>

<svelte:window onkeydown={onKey} />

<div class="wi vd-wrap" class:pin>
	<div class="track" bind:this={trackEl} style:height={pin ? `calc(100vh + ${HOLD}vh)` : null}>
	<div class="stage">
	<div class="wi wi-frame vd" bind:this={frameEl}>
	<header>
		<div class="wi-kicker">{C.header.kicker}</div>
		<h2 class="wi-title">{C.header.title}</h2>
		<p class="wi-lede">{C.header.lede}</p>
	</header>

	<div class="tally" aria-live="polite">
		<div class="pips">
			{#each C.cases as c, i}
				<button
					type="button"
					class="pipbtn"
					class:here={i === active}
					aria-label="{C.ui.allegation} {bn(c.n)}: {c.title}"
					onclick={() => showCase(i)}><i class="pip {cards[i].open ? c.v : ''}"></i></button
				>
			{/each}
		</div>
		<div class="txt">{tallyText}</div>
		<button type="button" onclick={toggleAll}>{allOpen ? C.ui.flipAll : C.ui.showAll}</button>
	</div>

	<!-- Phones: the four allegations as small cards; tapping one opens it on top -->
	<div class="tiles">
		{#each C.cases as c, i (c.n)}
			<button type="button" class="tile" bind:this={tileEls[i]} onclick={() => showCase(i)}>
				<span class="t-num">{C.ui.allegation} {bn(c.n)}</span>
				<span class="t-title">{c.title}</span>
				{#if cards[i].open}
					<span class="t-verdict {c.v}">{c.stamp}</span>
				{:else}
					<span class="t-open">{C.ui.tileOpen}</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<section class="grid" class:sheet={sheet >= 0} onclick={(e) => e.target === e.currentTarget && closeSheet()}>
		<button type="button" class="sheet-close" onclick={closeSheet}>✕ {C.ui.close}</button>
		{#each C.cases as c, i (c.n)}
			<article class="case" class:open={cards[i].open} class:current={i === sheet} bind:this={caseEls[i]}>
				<div class="flipper">
					<div class="face front" inert={cards[i].open} bind:this={frontEls[i]}>
						<div class="body">
							<p class="meta"><b>{C.ui.allegation} {bn(c.n)}</b> · {c.when}</p>
							<h3>{c.title}</h3>
							<p class="who">{c.who}</p>
							<p class="voice her"><span class="tag">{C.ui.claimLabel}</span>{c.claim}</p>
							<p class="voice him"><span class="tag">{C.ui.replyLabel}</span>{c.reply}</p>
						</div>
						<div class="ask">
							<p>{C.ui.ask}</p>
							<div class="seg" role="group" aria-label={C.ui.ask}>
								<button type="button" class="vp" onclick={() => choose(i, 'p')}>{C.ui.proven}</button>
								<button type="button" class="vn" onclick={() => choose(i, 'n')}>{C.ui.notProven}</button>
							</div>
						</div>
					</div>

					<div class="face back" inert={!cards[i].open} bind:this={backEls[i]}>
						<div class="verdict {c.v}">
							<div class="vtext">
								<b>{c.stamp}</b>
								<small>{c.sub}</small>
							</div>
						</div>
						<div class="body">
							<h4 class="decision">{C.ui.decision}</h4>
							<ul class="why">
								{#each c.why as w, k (k)}<li>{w}</li>{/each}
							</ul>
							<p class="quote">{c.quote}</p>
						</div>
						<div class="backbar">
							{#if cards[i].guess}
								<p class="yours">
									{C.ui.yours}
									<b>{cards[i].guess === 'p' ? C.ui.proven : C.ui.notProven}</b> ·
									{cards[i].guess === c.v ? C.ui.matched : C.ui.notMatched}
								</p>
							{/if}
							<button type="button" class="back-btn" aria-label={C.ui.back} onclick={() => setOpen(i, false, true)}
								>{C.ui.backShort}</button
							>
							{#if i < C.cases.length - 1}
								<button type="button" class="wi-primary next" onclick={() => showCase(i + 1, true)}
									>{C.ui.nextCase}</button
								>
							{/if}
						</div>
					</div>
				</div>
			</article>
		{/each}
	</section>
	</div>
	{#if pin}
		<div class="progress" aria-hidden="true"><i style:transform="scaleX({progress})"></i></div>
	{/if}
	</div>
	</div>

	<p class="wi-note">{C.note}</p>
</div>

<style>
	.vd-wrap {
		--vd-band: #f6f6f6; /* very light neutral grey */
		/* the cards use red plus neutral blacks and greys only */
		--vd-ink: #1c1c1c;
		--vd-grey: #5e5e5e;
		--vd-soft: #8a8a8a;
		--vd-line: #e4e4e4;
		--vd-wash: #efefef;
	}
	.vd-wrap > .wi-note {
		margin-top: 14px;
	}
	/* Pinned (desktop): a full-width band that fills the screen and stays put */
	.vd-wrap.pin .stage {
		position: sticky;
		top: 0;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100vw;
		margin-left: calc(50% - 50vw);
		padding: 20px 16px;
		background: var(--vd-band);
	}
	.vd-wrap.pin .stage > .vd {
		width: 100%;
		max-width: 980px;
	}
	.progress {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 3px;
		background: rgba(17, 17, 17, 0.08);
	}
	.progress i {
		display: block;
		height: 100%;
		background: var(--wi-ink);
		transform-origin: left center;
	}
	/* No grey panel, like the other two graphics, and tighter gaps. */
	.wi.wi.wi-frame.vd {
		--wi-pad: 0px;
		background: transparent;
		border: 0;
		border-radius: 0;
		padding: 0;
		gap: 14px;
	}
	.tally {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 18px;
		background: var(--wi-card);
		border: 1px solid var(--wi-line);
		border-radius: 4px;
		padding: 12px 16px;
		font-size: 15px;
	}
	.pips {
		display: flex;
		gap: 6px;
	}
	.wi.wi .pipbtn {
		padding: 8px 0;
		border: 0;
		border-radius: 2px;
		background: none;
		min-width: 0;
		line-height: 0;
	}
	.pip {
		display: block;
		width: 30px;
		height: 8px;
		border-radius: 2px;
		background: var(--wi-line);
	}
	.pip.p {
		background: var(--wi-red);
	}
	.pip.n {
		background: #4a4a4a;
	}
	.tally .txt {
		flex: 1 1 220px;
		min-width: 0;
	}

	/* ---------- the cards ---------- */
	/* desktop: 2 × 2, compact enough that the whole graphic fits one screen */
	.grid {
		position: relative;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	.case {
		perspective: 1600px;
		scroll-margin-top: var(--wi-top-offset);
	}
	.next,
	.tiles,
	.sheet-close {
		display: none;
	}
	.flipper {
		display: grid;
		height: 100%;
		transition: transform 0.7s cubic-bezier(0.3, 0.7, 0.2, 1);
		transform-style: preserve-3d;
	}
	.case.open .flipper {
		transform: rotateY(180deg);
	}
	.face {
		grid-area: 1 / 1;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
		background: var(--wi-card);
		border: 1px solid var(--vd-line);
		border-radius: 10px;
		box-shadow:
			0 1px 2px rgba(17, 17, 17, 0.04),
			0 10px 20px -14px rgba(17, 17, 17, 0.22);
	}
	.back {
		transform: rotateY(180deg);
	}
	@media (prefers-reduced-motion: reduce) {
		.flipper,
		.case.open .flipper,
		.back {
			transform: none;
		}
		.case .back,
		.case.open .front {
			visibility: hidden;
		}
		.case.open .back {
			visibility: visible;
		}
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 16px 10px;
	}

	/* front: who and what, then the two sides in their own words */
	.wi.wi .meta {
		font-size: 12px;
		color: var(--vd-grey);
	}
	.wi.wi .meta b {
		color: var(--wi-red);
		font-weight: 700;
	}
	.wi.wi h3 {
		font-family: var(--wi-serif);
		font-weight: 700;
		font-size: 19px;
		line-height: 1.3;
		color: var(--wi-ink);
		text-wrap: balance;
		margin-top: -2px;
	}
	.wi.wi .who {
		font-size: 12.5px;
		line-height: 1.45;
		color: var(--vd-grey);
		margin-bottom: 3px;
	}
	.wi.wi .voice {
		font-family: var(--wi-serif);
		font-size: 14px;
		line-height: 1.55;
		color: var(--wi-body);
	}
	/* the two sides as chat bubbles: Jahanara on the left, the accused on the right */
	.wi.wi .voice.her,
	.wi.wi .voice.him {
		max-width: 90%;
		padding: 5px 11px 6px;
		border-radius: 14px;
		font-size: 13.5px;
		line-height: 1.5;
	}
	.wi.wi .voice.her {
		align-self: flex-start;
		background: var(--wi-red-soft);
		border-bottom-left-radius: 4px;
	}
	.wi.wi .voice.him {
		align-self: flex-end;
		background: var(--vd-wash);
		border-bottom-right-radius: 4px;
	}
	.voice .tag {
		display: block;
		margin: 0 0 1px;
		font-size: 11px;
	}
	.tag {
		margin-right: 6px;
		font-family: var(--wi-sans);
		font-size: 11.5px;
		font-weight: 700;
		vertical-align: 1px;
	}
	.her .tag {
		color: var(--wi-red);
	}
	.him .tag {
		color: var(--vd-ink);
	}

	/* the question along the bottom of the front */
	.ask {
		margin-top: auto;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 16px 9px;
		border-top: 1px solid var(--vd-line);
	}
	.wi.wi .ask p {
		flex: 1 1 auto;
		font-size: 13px;
		font-weight: 600;
		color: var(--vd-ink);
	}
	.seg {
		flex: none;
		display: inline-flex;
		border: 1px solid var(--vd-line);
		border-radius: 999px;
		overflow: hidden;
		background: var(--wi-card);
	}
	.wi.wi .seg button {
		border: 0;
		border-radius: 0;
		background: none;
		padding: 5px 13px;
		font-size: 13px;
		white-space: nowrap;
	}
	.wi.wi .seg button + button {
		border-left: 1px solid var(--vd-line);
	}
	.wi.wi .seg .vp {
		color: var(--wi-red);
	}
	.wi.wi .seg .vn {
		color: var(--vd-ink);
	}
	.wi.wi .seg .vp:hover {
		background: var(--wi-red-soft);
	}
	.wi.wi .seg .vn:hover {
		background: var(--vd-wash);
	}
	.wi.wi .link {
		flex: none;
		border: 0;
		background: none;
		padding: 5px 2px;
		font-size: 12.5px;
		color: var(--vd-soft);
		text-decoration: none;
		text-underline-offset: 3px;
		white-space: nowrap;
	}
	.wi.wi .link:hover {
		color: var(--vd-ink);
		text-decoration: underline;
	}

	/* back: the verdict across the top in its colour, then the reasons */
	.verdict {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		padding: 11px 16px 10px;
	}
	.verdict.p {
		background: var(--wi-red-soft);
		color: var(--wi-red);
	}
	.verdict.n {
		background: var(--vd-wash);
		color: var(--vd-ink);
	}
	.vtext {
		min-width: 0;
	}
	.vtext b {
		display: inline-block;
		font-family: var(--wi-serif);
		font-weight: 700;
		font-size: 21px;
		line-height: 1.25;
		margin-right: 8px;
	}
	.vtext small {
		font-size: 12px;
	}
	.case.open .vtext b {
		animation: pop 0.45s 0.55s both;
	}
	@keyframes pop {
		0% {
			transform: scale(1.35);
			opacity: 0;
		}
		70% {
			transform: scale(0.97);
			opacity: 1;
		}
		100% {
			transform: scale(1);
		}
	}
		/* bottom bar of the back: your guess on the left, "ফিরুন" in the corner where
	   the proven / not proven choice was, so the pointer barely has to move */
	.backbar {
		margin-top: auto;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px 12px;
		border-top: 1px solid var(--vd-line);
	}
	.wi.wi .back-btn {
		flex: none;
		margin-left: auto;
		padding: 5px 14px;
		font-size: 13px;
		border-radius: 999px;
		border-color: var(--vd-line);
		background: var(--wi-card);
		color: var(--vd-ink);
	}
	.wi.wi .back-btn:hover {
		background: var(--vd-wash);
	}
	.wi.wi .yours {
		flex: 1 1 auto;
		min-width: 0;
		font-size: 12.5px;
		color: var(--vd-grey);
	}
	.wi.wi .yours b {
		color: var(--vd-ink);
	}
	.wi.wi .why {
		display: grid;
		gap: 3px;
		font-size: 13.5px;
		line-height: 1.5;
	}
	.wi.wi .why li {
		position: relative;
		padding-left: 14px;
	}
	.wi.wi .why li::before {
		content: '';
		position: absolute;
		left: 2px;
		top: 0.68em;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--vd-soft);
	}
	.wi.wi .quote {
		font-family: var(--wi-serif);
		font-style: italic;
		font-size: 13.5px;
		line-height: 1.5;
		color: var(--vd-ink);
	}
	.wi.wi .decision {
		font-size: 16px;
		font-weight: 700;
		line-height: 1.2;
		margin-top: -3px;
		color: var(--vd-ink);
	}

	/* Desktop: a little tighter so the whole graphic fits one screen */
	@media (min-width: 641px) {
		.wi.wi .wi-lede,
		.wi.wi .wi-note {
			max-width: none;
		}
		.tally {
			padding: 8px 14px;
		}
		.wi.wi .wi-title {
			font-size: 27px;
			margin-bottom: 4px;
		}
		.body {
			padding-top: 9px;
		}
	}

	/* ---------- Phones: four small cards on one screen; tap to open one ---------- */
	@media (max-width: 640px) {
		.tiles {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 10px;
		}
		.wi.wi .tile {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 6px;
			min-height: 128px;
			padding: 12px;
			text-align: left;
			background: var(--wi-card);
			border: 1px solid var(--vd-line);
			border-radius: 10px;
			box-shadow: 0 6px 14px -12px rgba(17, 17, 17, 0.3);
		}
		.t-num {
			font-size: 11.5px;
			font-weight: 700;
			color: var(--wi-red);
		}
		.t-title {
			font-family: var(--wi-serif);
			font-size: 15px;
			font-weight: 700;
			line-height: 1.35;
			color: var(--vd-ink);
		}
		.t-open {
			margin-top: auto;
			font-size: 12px;
			color: var(--vd-grey);
		}
		.t-verdict {
			margin-top: auto;
			padding: 2px 10px;
			border-radius: 999px;
			font-size: 12px;
			font-weight: 700;
		}
		.t-verdict.p {
			background: var(--wi-red-soft);
			color: var(--wi-red);
		}
		.t-verdict.n {
			background: var(--vd-wash);
			color: var(--vd-ink);
		}

		/* the full card, open on top of everything */
		.grid {
			display: none;
		}
		.grid.sheet {
			display: flex;
			position: fixed;
			inset: 0;
			z-index: 10000001;
			align-items: center;
			justify-content: center;
			padding: 60px 14px 24px;
			overflow-y: auto;
			overscroll-behavior: contain;
			background: rgba(17, 17, 17, 0.55);
		}
		.grid.sheet .case {
			display: none;
			width: 100%;
			max-width: 440px;
			margin: auto 0;
		}
		.grid.sheet .case.current {
			display: block;
		}
		.wi.wi .grid.sheet .sheet-close {
			display: block;
			position: fixed;
			top: 14px;
			right: 14px;
			padding: 6px 14px;
			border-radius: 999px;
			border: 0;
			background: var(--wi-card);
			font-size: 13px;
			color: var(--vd-ink);
		}
		.wi.wi .pipbtn.here .pip {
			box-shadow:
				0 0 0 2px var(--wi-card),
				0 0 0 3.5px var(--wi-ink);
		}
		/* narrow cards: the question on its own line above the buttons */
		.ask {
			flex-wrap: wrap;
			row-gap: 6px;
		}
		.wi.wi .ask p {
			flex-basis: 100%;
		}
		/* score bar: pips + "show all" on one line, the sentence under it */
		.tally {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			gap: 4px 12px;
			padding: 8px 12px 10px;
			font-size: 14px;
		}
		.tally .txt {
			grid-column: 1 / -1;
			grid-row: 2;
		}
		.wi.wi .tally > button {
			justify-self: end;
			padding: 5px 10px;
			font-size: 13px;
		}
		.backbar {
			flex-wrap: wrap;
			row-gap: 6px;
		}
		.wi.wi .backbar .yours {
			flex-basis: 100%;
		}
		.next {
			display: inline-block;
		}
	}
</style>
