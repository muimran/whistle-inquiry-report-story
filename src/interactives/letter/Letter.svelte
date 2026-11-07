<script>
	// The 2021 letter's path, stop by stop. A light scrolly: every stop is shown
	// in full, and scrolling past a stop fills its row in an office "note-sheet"
	// and updates the count of steps with no written record.
	//   Desktop: stops on the left, the note-sheet stays on screen on the right.
	//   Phones:  each stop carries its own note-sheet line; a slim line at the top
	//            of the screen keeps the running count; the full sheet comes last.
	//   Inside an iframe (nothing can stay on screen): everything shown filled in.
	import { bn } from '../../lib/bn.js';
	import * as C from './content.js';

	const TOTAL = C.stops.length;
	const inFrame = typeof window !== 'undefined' && window.self !== window.top;

	let active = $state(inFrame ? TOTAL - 1 : 0);
	let fresh = $state(-1);
	const stopEls = [];

	const missing = $derived(C.stops.slice(0, Math.min(active + 1, C.countUpTo)).filter((s) => s.rec === false).length);

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
		update();
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

<div class="wi wi-frame lt" class:inframe={inFrame}>
	<header>
		<div class="wi-kicker">{C.header.kicker}</div>
		<h2 class="wi-title">{C.header.title}</h2>
		<p class="wi-lede">
			{C.header.lede}
			{#if !inFrame}
				<span class="how"><span class="desk">{C.header.howTo}</span><span class="phone">{C.header.howToPhone}</span></span>
			{/if}
		</p>
	</header>

	<div class="layout">
		<section aria-label={C.ui.trackLabel}>
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
						<div class="body">
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
								<div class="ledger-row"><span>{s.row[0]}</span><span>{s.row[1]}</span></div>
								<div class="ledger-rec" class:y={s.rec === true}>
									{s.rec === true ? '✓ ' : '✕ '}{s.recTxt}
								</div>
							</div>
							<div class="src">{C.ui.source}{s.src}</div>
						</div>
					</li>
				{/each}
			</ol>
		</section>

		<aside class="sheet" aria-label={C.ui.sheetTitle}>
			<h3>{C.ui.sheetTitle}</h3>
			<div class="sub">{C.ui.sheetSub}</div>
			<div class="tablewrap">
				<table>
					<thead>
						<tr>{#each C.ui.cols as c, k (k)}<th>{c}</th>{/each}</tr>
					</thead>
					<tbody>
						{#each C.stops as s, i (i)}
							<tr class:pending={i > active} class:fresh={i === fresh}>
								<td>{s.row[0]}</td>
								<td>{s.row[1]}</td>
								<td class="rec"><span class={s.rec === true ? 'y' : 'n'}>{s.rec === true ? '✓ ' : '✕ '}{s.recTxt}</span></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="total">
				<span>{active < C.countUpTo ? C.ui.totalEarly : C.ui.totalLate}</span>
				<b>{bn(missing)}</b>
			</div>
		</aside>
	</div>

	<p class="end">{C.endQuote.text}<small>{C.endQuote.by}</small></p>

	<p class="wi-note">{C.note}</p>
</div>

<style>
	.lt {
		--lt-track: #c4ced6;
		--lt-rule: #b9c7d1;
		--lt-sheet: #fbfbf8;
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
	.layout > .sheet {
		order: -1;
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
	}
	.phone,
	.ledger,
	.tally {
		display: none;
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
	.voice {
		border-left: 2px solid var(--wi-line);
		padding-left: 12px;
		font-size: 15px;
		line-height: 1.6;
	}
	.voice b {
		display: block;
		font-size: 12.5px;
		color: var(--wi-muted);
		font-weight: 600;
	}
	.voice.red {
		border-color: var(--wi-red);
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
		.layout {
			grid-template-columns: 1fr;
		}
		.layout > .sheet {
			order: 0;
			position: static;
		}
		.desk {
			display: none;
		}
		.phone {
			display: inline;
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
