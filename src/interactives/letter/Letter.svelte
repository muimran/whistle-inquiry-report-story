<script>
	// The 2021 letter's path, stop by stop. A light scrolly: every stop is shown
	// in full, and scrolling past a stop fills its row in an office "note-sheet"
	// and updates the count of steps with no written record.
	//   Desktop: stops on the left, the note-sheet stays on screen on the right.
	//   Phones:  only the note-sheet. It pins to the screen for a stretch of
	//            scrolling and its rows fill in one by one as the reader scrolls
	//            (on screens too short to pin it, they fill in on a timer the first
	//            time it comes into view). Tapping a row opens that step's full
	//            text on top (with previous / next).
	//   Inside an iframe (nothing can stay on screen): everything shown filled in.
	import { untrack, tick } from 'svelte';
	import { bn, prefersReducedMotion } from '../../lib/bn.js';
	import { inFlatFrame } from '../../lib/frame.js';
	import * as C from './content.js';

	const TOTAL = C.stops.length;
	const inFrame = inFlatFrame();

	const PHONE_Q = '(max-width: 820px)';
	let phone = $state(typeof matchMedia !== 'undefined' && matchMedia(PHONE_Q).matches);
	let active = $state(inFrame ? TOTAL - 1 : 0);
	let fresh = $state(-1);
	let revealed = $state(inFrame ? TOTAL : 0); // phones: rows filled in so far
	let open = $state(-1); // phones: the step open on top
	let sheetEl = $state();
	let holdEl = $state();
	let closeBtn = $state();
	// phones: pin the sheet while the reader scrolls one extra screen height
	const HOLD = 1.0; // extra scrolling, in screen heights
	const FILL_BY = 0.8; // all rows are filled 80% of the way through
	let pinPhone = $state(false);
	let sheetH = $state(0);
	let viewH = $state(0);
	let pinTop = $state(0); // set on load / resize only, so the sheet never shifts while pinned
	let lastW = 0;
	const stopEls = [];
	const rowEls = [];

	// last filled row of the note-sheet: by scroll on desktop, by the fill on phones
	const filledUpTo = $derived(inFrame ? TOTAL - 1 : phone ? revealed - 1 : active);
	const missing = $derived(C.stops.slice(0, Math.min(filledUpTo + 1, C.countUpTo)).filter((s) => s.rec === false).length);

	$effect(() => {
		if (typeof matchMedia === 'undefined') return;
		const mq = matchMedia(PHONE_Q);
		const on = () => (phone = mq.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});

	// Phones: pin the sheet when it fits the screen; scrolling fills its rows.
	function pinScroll() {
		if (!pinPhone || !holdEl) return;
		const span = holdEl.offsetHeight - sheetH;
		const p = span > 0 ? Math.min(1, Math.max(0, (pinTop - holdEl.getBoundingClientRect().top) / span)) : 1;
		const n = Math.min(TOTAL, Math.ceil((p / FILL_BY) * TOTAL - 0.001));
		if (n !== revealed) {
			fresh = n > revealed ? n - 1 : -1;
			revealed = n;
		}
	}
	// `full`: also re-centre the sheet (load, fonts, resize). The sheet grows a
	// line once its total label changes, so ordinary re-measures leave it be.
	function pinMeasure(full = true) {
		if (!sheetEl) return;
		const w = sheetEl.offsetWidth;
		const h = sheetEl.offsetHeight;
		// Phone browsers shrink the screen a little when their toolbar slides in
		// (at the bottom of the page, say). Changing the pinned stretch then would
		// make the page jump, so only a real change (rotating, say) counts.
		const vh = window.innerHeight;
		if (!viewH || w !== lastW || Math.abs(vh - viewH) > 160) viewH = vh;
		sheetH = w === lastW ? Math.max(sheetH, h) : h;
		if (full || w !== lastW) pinTop = Math.max(8, Math.round((viewH - sheetH - 24) / 2));
		lastW = w;
		pinPhone = phone && !prefersReducedMotion() && pinTop + sheetH + 8 <= viewH;
		pinScroll();
	}
	$effect(() => {
		phone; // re-measure when crossing the phone width
		if (inFrame || !sheetEl) return;
		untrack(() => pinMeasure());
		document.fonts?.ready.then(() => pinMeasure());
		const ro = new ResizeObserver(() => requestAnimationFrame(() => untrack(() => pinMeasure(false))));
		ro.observe(sheetEl);
		const onResize = () => pinMeasure();
		window.addEventListener('resize', onResize);
		window.addEventListener('scroll', pinScroll, { passive: true });
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', onResize);
			window.removeEventListener('scroll', pinScroll);
		};
	});

	// Phones, when the sheet can't pin: the first time it comes into view, its
	// rows fill in one by one.
	$effect(() => {
		if (inFrame || !phone || pinPhone || !sheetEl || untrack(() => revealed) >= TOTAL) return;
		let timer;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				io.disconnect();
				if (prefersReducedMotion()) {
					revealed = TOTAL;
					return;
				}
				timer = setInterval(() => {
					revealed += 1;
					fresh = revealed - 1;
					if (revealed >= TOTAL) clearInterval(timer);
				}, 220);
			},
			{ threshold: 0.35 }
		);
		io.observe(sheetEl);
		return () => {
			io.disconnect();
			clearInterval(timer);
		};
	});

	// A row of the sheet: phones open that step on top; desktop scrolls to it.
	async function openStep(i) {
		if (i < 0 || i >= TOTAL) return;
		if (phone) {
			open = i;
			await tick();
			closeBtn?.focus({ preventScroll: true });
			return;
		}
		stopEls[i]?.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth', block: 'start' });
	}
	function closeStep() {
		const i = open;
		open = -1;
		rowEls[i]?.focus({ preventScroll: true });
	}
	function rowKey(e, i) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openStep(i);
		}
	}
	function onKey(e) {
		if (e.key === 'Escape' && open >= 0) closeStep();
	}

	// The active stop is the last one whose top has passed 45% of the screen height.
	function update() {
		const line = window.innerHeight * 0.45;
		let idx = 0;
		for (let i = 0; i < stopEls.length; i++) {
			if (stopEls[i] && stopEls[i].getBoundingClientRect().top <= line) idx = i;
		}
		if (idx !== active) {
			fresh = idx > active ? idx : -1;
			active = idx;
		}
	}
	$effect(() => {
		if (inFrame) return;
		// untrack: the effect must not re-run because update() reads and sets `active`
		untrack(update);
		window.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		return () => {
			window.removeEventListener('scroll', update);
			window.removeEventListener('resize', update);
		};
	});
</script>

{#snippet voice(v)}
	<div class="voice" class:red={v.red}><b>{v.by}</b>{v.text}</div>
{/snippet}

{#snippet stopBody(s)}
	{#each s.blocks as b, j (j)}
		{#if b.p}
			<p>{b.p}</p>
		{:else if b.voice}
			{@render voice(b.voice)}
		{:else if b.trio}
			<div class="trio">
				{#each b.trio as v, k (k)}{@render voice(v)}{/each}
			</div>
		{/if}
	{/each}
	<div class="ledger">
		<div class="ledger-h">{C.ui.sheetTitle}</div>
		<div class="ledger-row"><span>{s.row[1]}</span></div>
		<div class="ledger-rec" class:y={s.rec === true}>
			{s.rec === true ? '✓ ' : '✕ '}{s.recTxt}
		</div>
	</div>
	{#if s.src}<div class="src">{C.ui.source}{s.src}</div>{/if}
{/snippet}

<svelte:window onkeydown={onKey} />

<div class="wi wi-frame lt" class:inframe={inFrame}>
	<header>
		<div class="wi-kicker">{C.header.kicker}</div>
		<h2 class="wi-title">{C.header.title}</h2>
		<p class="wi-lede">
			{C.header.lede}
			{#if !inFrame && phone}
				<span class="how">{C.header.howToPhone}</span>
			{/if}
		</p>
	</header>

	<div class="layout">
		<section class="steps-col" aria-label={C.ui.trackLabel}>
			{#if !inFrame}
				<!-- Phones only: the running count stays at the top of the screen. The
				     stops say the same in words, so screen readers skip it. -->
				<div class="tally" aria-hidden="true">
					{C.ui.tallyMissing} <b>{C.ui.tallyCount(bn(missing))}</b> · {C.ui.tallyPeriod}
				</div>
			{/if}

			<ol class="track">
				{#each C.stops as s, i (i)}
					<li class="stop" class:done={i < active} class:cur={i === active} bind:this={stopEls[i]}>
						<span class="dot" aria-hidden="true">{bn(i + 1)}</span>
						<div class="head">
							<span class="when">{s.when}</span>
							<span class="t">{s.t}</span>
						</div>
						<div class="body">{@render stopBody(s)}</div>
					</li>
				{/each}
			</ol>
		</section>

		<div
			class="sheet-hold"
			class:pinned={pinPhone}
			bind:this={holdEl}
			style:height={pinPhone ? `${Math.round(sheetH + viewH * HOLD)}px` : null}
		>
		<aside
			class="sheet"
			aria-label={C.ui.sheetTitle}
			bind:this={sheetEl}
			style:top={pinPhone ? `${pinTop}px` : null}
		>
			<h3>{C.ui.sheetTitle}</h3>
			<div class="sub">{C.ui.sheetSub}</div>
			<div class="tablewrap">
				<table>
					<thead>
						<tr>{#each C.ui.cols as c, k (k)}<th>{c}</th>{/each}<th class="go"></th></tr>
					</thead>
					<tbody>
						{#each C.stops as s, i (i)}
							<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
							<tr
								class:pending={i > filledUpTo}
								class:fresh={i === fresh}
								bind:this={rowEls[i]}
								role="button"
								tabindex="0"
								aria-label="{bn(i + 1)}. {s.t}"
								onclick={() => openStep(i)}
								onkeydown={(e) => rowKey(e, i)}
							>
								<td>{s.row[1]}</td>
								<td class="rec"><span class={s.rec === true ? 'y' : 'n'}>{s.rec === true ? '✓ ' : '✕ '}{s.recTxt}</span></td>
								<td class="go" aria-hidden="true">›</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="total">
				<span>{filledUpTo < C.countUpTo ? C.ui.totalEarly : C.ui.totalLate}</span>
				<b>{bn(missing)}</b>
			</div>
			<p class="taphint">{C.ui.tapHint}</p>
		</aside>
		</div>
	</div>

	<!-- Phones: one step open on top of the sheet -->
	{#if open >= 0}
		{@const s = C.stops[open]}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="stepsheet" onclick={(e) => e.target === e.currentTarget && closeStep()}>
			<div class="panel" role="dialog" aria-modal="true" aria-label={s.t}>
				<div class="panel-top">
					<span class="panel-count">{C.ui.stepOf(bn(open + 1), bn(TOTAL))}</span>
					<button type="button" class="panel-close" bind:this={closeBtn} onclick={closeStep}>✕ {C.ui.close}</button>
				</div>
				<div class="head">
					<span class="when">{s.when}</span>
					<span class="t">{s.t}</span>
				</div>
				<div class="body">{@render stopBody(s)}</div>
				<div class="panel-nav">
					<button type="button" onclick={() => openStep(open - 1)} disabled={open === 0}>{C.ui.prevStep}</button>
					<button type="button" class="wi-primary" onclick={() => openStep(open + 1)} disabled={open === TOTAL - 1}
						>{C.ui.nextStep}</button
					>
				</div>
			</div>
		</div>
	{/if}

	<p class="end">{C.endQuote.text}<small>{C.endQuote.by}</small></p>

	<p class="wi-note">{C.note}</p>
</div>

<style>
	.lt {
		--lt-track: #c4ced6;
		--lt-rule: #b9c7d1;
		--lt-sheet: #f6f6f6; /* very light neutral grey, same as the verdicts band */
	}
	/* No grey panel: like the inquiry scrolly, it sits straight on the page. */
	.wi.wi.wi-frame.lt {
		--wi-pad: 0px;
		background: transparent;
		border: 0;
		border-radius: 0;
		padding: 0;
	}
	.how {
		display: block;
		margin-top: 6px;
		color: var(--wi-ink);
		font-weight: 500;
	}
	/* Desktop: note-sheet on the left, stops on the right. The sheet comes after
	   the stops in the page, so phones and screen readers get the stops first. */
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr);
		gap: 28px;
		align-items: start;
	}
	.layout > .sheet-hold {
		order: -1;
		align-self: stretch; /* full row height, so the sheet can stay on screen */
	}

	.wi.wi .track {
		position: relative;
	}
	.track::before {
		content: '';
		position: absolute;
		left: 15px;
		top: 8px;
		bottom: 8px;
		width: 2px;
		background: var(--lt-track);
	}
	.wi.wi .stop {
		position: relative;
		padding: 0 0 34px 44px;
		/* a sheet row scrolls its step to just above the reading line (45%) */
		scroll-margin-top: 30vh;
	}
	.ledger,
	.tally,
	.go,
	.taphint {
		display: none;
	}
	tbody tr {
		cursor: pointer;
	}
	tbody tr:hover td {
		background: rgba(17, 17, 17, 0.03);
	}
	.dot {
		position: absolute;
		left: 6px;
		top: 6px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #fff;
		border: 2px solid var(--lt-track);
		display: grid;
		place-items: center;
		font-size: 10.5px;
		line-height: 1;
		color: var(--wi-muted);
		transition:
			background 0.3s ease,
			border-color 0.3s ease;
	}
	.stop.done .dot {
		border-color: var(--wi-ink);
		background: var(--wi-ink);
		color: #fff;
	}
	.stop.cur .dot {
		border-color: var(--wi-red);
		background: var(--wi-red);
		color: #fff;
		box-shadow: 0 0 0 4px var(--wi-red-soft);
	}
	.head {
		display: flex;
		flex-direction: column;
		padding: 2px 0 0;
	}
	.when {
		font-size: 12.5px;
		color: var(--wi-muted);
	}
	.t {
		font-family: var(--wi-serif);
		font-weight: 600;
		font-size: 18px;
		line-height: 1.4;
		color: var(--wi-ink);
	}
	/* Plain text under each heading: no box, quotes stacked one under another. */
	.body {
		margin-top: 8px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.wi.wi .body p {
		font-family: var(--wi-serif);
		font-size: 16.5px;
		line-height: 1.7;
		color: var(--wi-body);
	}
	/* quotes: indented, no bar */
	.voice {
		padding-left: 14px;
		font-size: 15px;
		line-height: 1.6;
	}
	.voice b {
		display: block;
		font-size: 12.5px;
		color: var(--wi-muted);
		font-weight: 600;
	}
	.trio {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.src {
		font-size: 12px;
		color: var(--wi-muted);
	}

	.sheet {
		position: sticky;
		top: var(--wi-top-offset);
		/* moves up when the site's menu folds away (see base.css) */
		transition: top 0.35s ease;
		background: var(--lt-sheet);
		border: 1px solid var(--wi-line);
		border-radius: 4px;
		padding: 16px 16px 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.inframe .sheet {
		position: static;
	}
	.wi.wi .sheet h3 {
		font-family: var(--wi-serif);
		font-weight: 700;
		font-size: 19px;
		color: var(--wi-ink);
	}
	.sheet .sub {
		font-size: 12.5px;
		color: var(--wi-muted);
		margin-top: -6px;
	}
	.tablewrap {
		overflow-x: auto;
	}
	.wi.wi table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13.5px;
	}
	th {
		text-align: left;
		font-weight: 600;
		color: var(--wi-muted);
		font-size: 12px;
		border-bottom: 1.5px solid var(--lt-rule);
		padding: 4px 6px;
	}
	td {
		border-bottom: 1px solid var(--lt-rule);
		padding: 6px;
		vertical-align: top;
	}
	tr.pending td,
	tr.pending td * {
		color: transparent !important;
	}
	tr.pending td::after {
		content: '';
		display: block;
		height: 10px;
		margin-top: -14px;
		background: repeating-linear-gradient(90deg, var(--lt-rule) 0 6px, transparent 6px 10px);
		opacity: 0.6;
	}
	td.rec span {
		font-weight: 600;
	}
	td.rec .n {
		color: var(--wi-red);
	}
	td.rec .y {
		color: var(--wi-blue);
	}
	tr.fresh td {
		animation: ink 0.6s ease;
	}
	@keyframes ink {
		from {
			background: var(--wi-red-soft);
		}
		to {
			background: transparent;
		}
	}
	.total {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		align-items: baseline;
		border-top: 1.5px solid var(--lt-rule);
		padding-top: 8px;
	}
	.total b {
		font-family: var(--wi-serif);
		font-weight: 700;
		font-size: 28px;
		color: var(--wi-red);
		line-height: 1;
	}
	.total span {
		font-size: 13.5px;
		color: var(--wi-muted);
	}

	.wi.wi .end {
		font-family: var(--wi-serif);
		font-size: clamp(19px, 2.6vw, 23px);
		line-height: 1.6;
		color: var(--wi-ink);
		border-left: 3px solid var(--wi-red);
		padding: 2px 0 2px 16px;
		max-width: 60ch;
	}
	.end small {
		display: block;
		font-family: var(--wi-sans);
		font-size: 13px;
		color: var(--wi-muted);
		margin-top: 4px;
	}

	/* ---------- Phones & narrow screens: one column ---------- */
	@media (max-width: 820px) {
		/* phones: a tighter sheet, so it fits the screen and can stay on it */
		.sheet {
			padding: 12px 12px 10px;
			gap: 7px;
		}
		.wi.wi .sheet h3 {
			font-size: 17px;
		}
		table {
			font-size: 12.5px;
			line-height: 1.35;
		}
		td {
			padding: 4px 5px;
		}
		/* phones: no running total under the sheet */
		.wi.wi .total {
			display: none;
		}
		/* phones: the finished sheet only; each row opens its step on top */
		.steps-col {
			display: none;
		}
		.go {
			display: table-cell;
			width: 14px;
			padding-left: 0;
			text-align: right;
			font-size: 18px;
			line-height: 1;
			color: #9a9a9a;
			vertical-align: middle;
		}
		tbody tr:active td {
			background: rgba(17, 17, 17, 0.06);
		}
		.wi.wi .taphint {
			display: block;
			font-size: 12.5px;
			color: var(--wi-muted);
			text-align: center;
		}
		.stepsheet {
			position: fixed;
			inset: 0;
			z-index: 10000001;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 16px 12px;
			background: rgba(17, 17, 17, 0.55);
			overscroll-behavior: contain;
		}
		.panel {
			width: 100%;
			max-width: 460px;
			max-height: calc(100vh - 32px);
			overflow-y: auto;
			overscroll-behavior: contain;
			background: var(--wi-card);
			border-radius: 12px;
			padding: 14px 16px 16px;
			display: flex;
			flex-direction: column;
			gap: 10px;
		}
		.panel-top {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}
		.panel-count {
			font-size: 12.5px;
			font-weight: 600;
			color: var(--wi-muted);
		}
		.wi.wi .panel-close {
			padding: 4px 12px;
			border-radius: 999px;
			font-size: 13px;
		}
		.panel .body {
			margin-top: 0;
		}
		.panel-nav {
			display: flex;
			justify-content: space-between;
			gap: 10px;
			padding-top: 10px;
			border-top: 1px solid var(--wi-line);
		}
		.wi.wi .panel-nav button {
			min-height: 40px;
			padding: 6px 16px;
		}
		.layout {
			grid-template-columns: 1fr;
		}
		.layout > .sheet-hold {
			order: 0;
		}
		.sheet-hold:not(.pinned) > .sheet {
			position: static;
		}
		/* pinned: the sheet stays in the middle of the screen (top set inline) */
		.sheet-hold.pinned > .sheet {
			transition: none;
		}

		/* the running count at the top of the screen */
		.tally {
			display: block;
			position: sticky;
			/* right under the site's menu bar: the offset includes a 14px gap */
			top: calc(var(--wi-top-offset) - 14px);
			transition: top 0.35s ease;
			z-index: 3;
			margin-bottom: 14px;
			padding: 10px 0 9px;
			background: #fff;
			border-bottom: 1px solid var(--wi-line);
			box-shadow: 0 6px 12px -8px rgba(0, 0, 0, 0.18);
			font-size: 13.5px;
			color: var(--wi-muted);
			white-space: nowrap;
		}
		.tally b {
			font-family: var(--wi-serif);
			font-weight: 700;
			font-size: 18px;
			color: var(--wi-red);
		}

		/* the note-sheet line inside each stop */
		.ledger {
			display: block;
			background: var(--lt-sheet);
			border: 1px dashed var(--lt-rule);
			border-radius: 3px;
			padding: 8px 10px;
			font-size: 13.5px;
			line-height: 1.5;
		}
		.ledger-h {
			font-size: 11.5px;
			font-weight: 600;
			color: var(--wi-muted);
		}
		.ledger-row {
			display: flex;
			flex-wrap: wrap;
			gap: 2px 8px;
			color: var(--wi-ink);
		}
		.ledger-row span:first-child {
			color: var(--wi-muted);
		}
		.ledger-rec {
			font-weight: 600;
			color: var(--wi-red);
		}
		.ledger-rec.y {
			color: var(--wi-blue);
		}
	}
</style>
