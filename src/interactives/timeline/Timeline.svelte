<script>
	// The 83 days between the appointment letter and the report date.
	// Desktop: a day-by-day strip with a scrubber. Phones: a 12-week calendar
	// (one row per week) with big previous/next buttons. Both share one state.
	import { onDestroy } from 'svelte';
	import { bn, dateOf, fmtDate, prefersReducedMotion } from '../../lib/bn.js';
	import * as C from './content.js';

	const LAST = C.lastDay;
	const DL = C.deadlineDay;
	const N = LAST + 1;

	const days = Array.from({ length: N }, (_, i) => {
		const date = dateOf(C.start, i);
		const wd = date.getDay();
		return { i, date, weekend: wd === 5 || wd === 6 };
	});
	const evByDay = new Map(C.events.map((e) => [e.d, e]));
	const center = (d) => ((d + 0.5) / N) * 100; // % position of a day's cell centre

	// Calendar rows (Sunday first). The month name goes on the row where a month starts.
	const lead = days[0].date.getDay();
	const calRows = Array.from({ length: Math.ceil((lead + N) / 7) }, (_, r) => {
		const cells = Array.from({ length: 7 }, (_, c) => {
			const i = r * 7 + c - lead;
			return i >= 0 && i <= LAST ? days[i] : null;
		});
		const starter = cells.find((d) => d && (d.i === 0 || d.date.getDate() === 1));
		return { cells, month: starter ? C.calendar.months[starter.date.getMonth()] : '' };
	});
	const cellLabel = (d) =>
		`${C.ui.day} ${bn(d.i)}, ${fmtDate(d.date)}${evByDay.has(d.i) ? ': ' + evByDay.get(d.i).t : ''}`;

	let cur = $state(C.startDay);
	let playing = $state(false);
	let timer = null;
	let stripEl;

	const exact = $derived(evByDay.get(cur));
	const shown = $derived(exact ?? [...C.events].reverse().find((e) => e.d <= cur) ?? C.events[0]);

	function go(i) {
		cur = Math.max(0, Math.min(LAST, i));
	}
	function stop() {
		clearTimeout(timer);
		timer = null;
		playing = false;
	}
	function step() {
		if (cur >= LAST) return stop();
		const reduce = prefersReducedMotion();
		go(reduce ? (C.events.find((e) => e.d > cur)?.d ?? LAST) : cur + 1);
		const ev = evByDay.get(cur);
		const delay = reduce ? 1800 : ev?.key ? 1800 : ev ? 700 : 130;
		timer = setTimeout(step, delay);
	}
	function togglePlay() {
		if (playing) return stop();
		if (cur >= LAST) go(0);
		playing = true;
		timer = setTimeout(step, 300);
	}
	function prevEvent() {
		stop();
		const p = [...C.events].reverse().find((e) => e.d < cur);
		go(p ? p.d : 0);
	}
	function nextEvent() {
		stop();
		const n = C.events.find((e) => e.d > cur);
		go(n ? n.d : LAST);
	}
	function pick(e) {
		const r = stripEl.getBoundingClientRect();
		const x = Math.max(0, Math.min(r.width - 1, e.clientX - r.left));
		stop();
		go(Math.floor((x / r.width) * N));
	}

	// Strip input: a mouse picks on press and drag. A finger picks on tap or on a
	// sideways drag; an up-down swipe is left to the page so it still scrolls.
	let drag = null;
	function onDown(e) {
		if (e.pointerType === 'mouse') {
			stripEl.setPointerCapture(e.pointerId);
			drag = { mouse: true };
			pick(e);
		} else {
			drag = { x: e.clientX, y: e.clientY, moved: false };
		}
	}
	function onMove(e) {
		if (!drag) return;
		if (drag.mouse) {
			if (e.buttons) pick(e);
			return;
		}
		const dx = Math.abs(e.clientX - drag.x);
		if (!drag.moved && dx > 6 && dx > Math.abs(e.clientY - drag.y)) {
			drag.moved = true;
			stripEl.setPointerCapture(e.pointerId);
		}
		if (drag.moved) pick(e);
	}
	function onUp(e) {
		if (drag && !drag.mouse && !drag.moved) pick(e);
		drag = null;
	}

	onDestroy(stop);

	// Phase bars: place the label after the bar, or before it if the bar ends near the right edge
	const phaseBars = C.phases.map((p) => {
		const left = (p.from / LAST) * 100;
		const width = ((p.to - p.from) / LAST) * 100;
		const end = left + width;
		return { ...p, left, width, labelStyle: end > 85 ? `right:${100 - left + 1}%` : `left:${end + 1}%` };
	});
</script>

<div class="wi wi-frame tl">
	<header>
		<div class="wi-kicker">{C.header.kicker}</div>
		<h2 class="wi-title">{C.header.title}</h2>
		<p class="wi-lede">
			{C.header.lede}
			<span class="desk">{C.header.howTo}</span><span class="phone">{C.header.howToPhone}</span>
		</p>
	</header>

	<section class="figs" aria-label="মূল সংখ্যা">
		{#each C.figures as f}
			<div class="fig" class:accent={f.accent}>
				<b>{f.value}</b>
				<span>{f.text}</span>
			</div>
		{/each}
	</section>

	<section class="board" aria-label="দিনভিত্তিক সময়রেখা">
		<div class="counter">
			<div class="day">{C.ui.day} {bn(cur)}<small>/ {bn(LAST)}</small></div>
			<div class="date">{fmtDate(dateOf(C.start, cur))}</div>
			<div class="status" class:ok={cur <= DL}>
				{cur <= DL ? C.ui.withinTime : C.ui.overdue(bn(cur - DL))}
			</div>
		</div>

		<!-- Desktop: day strip -->
		<div class="strip-wrap">
			<div class="ticks" style="--n:{N}">
				{#each days as d (d.i)}
					{#if evByDay.has(d.i)}
						<button
							type="button"
							class="tick"
							class:on={d.i === cur}
							aria-label="{C.ui.day} {bn(d.i)}: {evByDay.get(d.i).t}"
							onclick={() => {
								stop();
								go(d.i);
							}}
						></button>
					{:else}
						<span></span>
					{/if}
				{/each}
			</div>
			<div
				class="strip"
				style="--n:{N}"
				role="presentation"
				bind:this={stripEl}
				onpointerdown={onDown}
				onpointermove={onMove}
				onpointerup={onUp}
				onpointercancel={() => (drag = null)}
			>
				{#each days as d (d.i)}
					<div
						class:wk={d.weekend}
						class:dl={d.i <= DL}
						class:past={d.i <= cur}
						class:cur={d.i === cur}
					></div>
				{/each}
			</div>
			<div class="axis">
				{#each C.axis as a, i}
					<span
						class:mid={i > 0 && i < C.axis.length - 1}
						class:hide-sm={i === C.axis.length - 2}
						style={i === 0 ? 'left:0' : i === C.axis.length - 1 ? 'right:0' : `left:${center(a.day)}%`}
						>{a.label}</span
					>
				{/each}
			</div>
			<div class="dl-row">
				<span class="dl-label" style="left:calc({center(DL)}% - 6px)">{C.deadlineLabel}</span>
			</div>
		</div>

		<!-- Phones: calendar, one row per week -->
		<div class="cal">
			<span></span>
			{#each C.calendar.weekdays as w, c}
				<span class="wd" class:wk={c === 5 || c === 6}>{w}</span>
			{/each}
			{#each calRows as row}
				<span class="mo">{row.month}</span>
				{#each row.cells as d}
					{#if d}
						<button
							type="button"
							class="cell"
							class:wk={d.weekend}
							class:dl={d.i <= DL}
							class:past={d.i <= cur}
							class:cur={d.i === cur}
							class:ev={evByDay.has(d.i)}
							class:first={d.date.getDate() === 1}
							tabindex={evByDay.has(d.i) ? 0 : -1}
							aria-label={cellLabel(d)}
							onclick={() => {
								stop();
								go(d.i);
							}}>{bn(d.date.getDate())}</button
						>
					{:else}
						<span></span>
					{/if}
				{/each}
			{/each}
		</div>

		<div class="legend">
			<span><em style="background:var(--wi-red)"></em>{C.legend.deadline}</span>
			<span><em style="background:var(--tl-past)"></em>{C.legend.past}</span>
			<span><em style="background:var(--tl-weekend)"></em>{C.legend.weekend}</span>
			<span><i class="evdot"></i>{C.legend.event}</span>
		</div>

		<div class="controls">
			<button type="button" class="wi-primary play" onclick={togglePlay}>{playing ? C.ui.pause : C.ui.play}</button>
			<button type="button" class="prev" onclick={prevEvent}
				><span class="desk">{C.ui.prev}</span><span class="phone">{C.ui.prevShort}</span></button
			>
			<button type="button" class="next" onclick={nextEvent}
				><span class="desk">{C.ui.next}</span><span class="phone">{C.ui.nextShort}</span></button
			>
			<input
				type="range"
				min="0"
				max={LAST}
				value={cur}
				aria-label={C.ui.rangeLabel}
				oninput={(e) => {
					stop();
					go(+e.currentTarget.value);
				}}
			/>
		</div>

		<article class="ev-card" class:quiet={!exact} aria-live="polite">
			<div class="when">
				{exact
					? `${C.ui.day} ${bn(shown.d)} · ${fmtDate(dateOf(C.start, shown.d))}`
					: C.ui.noEvent(bn(shown.d), bn(cur))}
			</div>
			<h3>{shown.t}</h3>
			<p>{shown.b}</p>
			<div class="src">{C.ui.source}{shown.s}</div>
		</article>
	</section>

	<section class="lanes" aria-label={C.phasesTitle}>
		<h3 class="sub">{C.phasesTitle}</h3>
		{#each phaseBars as p}
			<div class="lane">
				<span>{p.label}</span>
				<div class="bar">
					<b style="left:{p.left}%;width:{p.width}%;background:{p.color}"></b>
					<small style={p.labelStyle}>{p.text}</small>
				</div>
			</div>
		{/each}
	</section>

	<section class="after" aria-label={C.afterTitle}>
		<h3 class="sub">{C.afterTitle}</h3>
		<ol>
			{#each C.after as a}
				<li><b>{a.when}</b>{a.text}</li>
			{/each}
		</ol>
	</section>

	<p class="wi-note">{C.note}</p>
</div>

<style>
	.tl {
		--tl-past: #22323f;
		--tl-future: #d9dfe4;
		--tl-weekend: #e4e8ea;
	}
	.phone {
		display: none;
	}

	.figs {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}
	.fig {
		border-top: 3px solid var(--wi-line);
		padding-top: 10px;
	}
	.fig.accent {
		border-color: var(--wi-red);
	}
	.fig b {
		display: block;
		font-family: var(--wi-serif);
		font-weight: 700;
		font-size: clamp(24px, 4.5vw, 32px);
		line-height: 1.2;
		color: var(--wi-ink);
	}
	.fig span {
		font-size: 14px;
		color: var(--wi-muted);
	}

	.board {
		background: var(--wi-card);
		border: 1px solid var(--wi-line);
		border-radius: 4px;
		padding: 20px clamp(12px, 2.5vw, 22px);
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.counter {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px 12px;
		flex-wrap: wrap;
	}
	.counter .day {
		font-family: var(--wi-serif);
		font-weight: 700;
		font-size: clamp(28px, 5.5vw, 40px);
		line-height: 1;
		color: var(--wi-ink);
	}
	.counter .day small {
		font-family: var(--wi-sans);
		font-weight: 400;
		font-size: 15px;
		color: var(--wi-muted);
		margin-left: 6px;
	}
	.counter .date {
		color: var(--wi-muted);
		font-size: 15px;
	}
	.status {
		font-size: 14px;
		font-weight: 600;
		padding: 3px 10px;
		border-radius: 999px;
		background: var(--wi-red-soft);
		color: var(--wi-red);
	}
	.status.ok {
		background: var(--tl-weekend);
		color: var(--wi-muted);
	}

	/* ---------- Desktop strip ---------- */
	.strip-wrap {
		position: relative;
	}
	.ticks,
	.strip {
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
	}
	.ticks {
		height: 16px;
		align-items: end;
	}
	.wi.wi .tick {
		justify-self: center;
		width: 9px;
		height: 9px;
		min-width: 0;
		border-radius: 50%;
		background: var(--wi-ink);
		opacity: 0.35;
		border: 0;
		padding: 0;
	}
	.wi.wi .tick.on {
		opacity: 1;
		background: var(--wi-red);
		transform: scale(1.3);
	}
	.strip {
		gap: 1px;
		height: 46px;
		margin-top: 4px;
		cursor: pointer;
		touch-action: pan-y;
	}
	.strip div {
		background: var(--tl-future);
		border-radius: 1px;
	}
	.strip div.wk {
		background: var(--tl-weekend);
	}
	.strip div.dl {
		box-shadow: inset 0 -6px 0 var(--wi-red);
	}
	.strip div.past {
		background: var(--tl-past);
	}
	.strip div.past.dl {
		background: var(--wi-red);
	}
	.strip div.cur {
		outline: 2px solid var(--wi-red);
		outline-offset: 1px;
	}
	.axis {
		position: relative;
		height: 20px;
		font-size: 12.5px;
		color: var(--wi-muted);
		margin-top: 6px;
	}
	.axis span {
		position: absolute;
		top: 0;
		white-space: nowrap;
	}
	.axis span.mid {
		transform: translateX(-50%);
	}
	.axis span.mid::before {
		content: '';
		position: absolute;
		left: 50%;
		top: -6px;
		height: 5px;
		border-left: 1px solid var(--wi-muted);
	}
	.dl-row {
		position: relative;
		height: 20px;
	}
	.dl-label {
		position: absolute;
		top: 0;
		font-size: 12.5px;
		color: var(--wi-red);
		font-weight: 600;
		white-space: nowrap;
	}

	/* ---------- Phone calendar (hidden on desktop) ---------- */
	.cal {
		display: none;
		grid-template-columns: 30px repeat(7, minmax(0, 1fr));
		gap: 3px;
		align-items: center;
	}
	.wd {
		font-size: 11px;
		line-height: 1.2;
		color: var(--wi-muted);
		text-align: center;
		padding-bottom: 2px;
	}
	.wd.wk {
		color: #8d969d;
	}
	.mo {
		font-size: 11px;
		line-height: 1.1;
		font-weight: 600;
		color: var(--wi-muted);
		white-space: nowrap;
	}
	.cal .cell {
		position: relative;
		height: 26px;
		min-width: 0;
		padding: 0;
		border: 0;
		border-radius: 3px;
		background: var(--tl-future);
		color: var(--wi-muted);
		font-size: 11.5px;
		line-height: 1;
		display: grid;
		place-items: center;
		-webkit-tap-highlight-color: transparent;
	}
	.cal .cell.wk {
		background: var(--tl-weekend);
	}
	.cal .cell.dl {
		box-shadow: inset 0 -4px 0 var(--wi-red);
	}
	.cal .cell.past {
		background: var(--tl-past);
		color: #fff;
	}
	.cal .cell.past.dl {
		background: var(--wi-red);
		box-shadow: none;
	}
	.cal .cell.first {
		font-weight: 700;
	}
	.cal .cell.ev::after {
		content: '';
		position: absolute;
		top: 2px;
		right: 2px;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--wi-ink);
	}
	.cal .cell.past.ev::after {
		background: #fff;
	}
	.cal .cell.cur {
		outline: 2.5px solid var(--wi-red);
		outline-offset: 1.5px;
		z-index: 1;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
		font-size: 13px;
		color: var(--wi-muted);
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.legend em {
		display: inline-block;
		width: 14px;
		height: 10px;
		border-radius: 2px;
	}
	.legend .evdot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--wi-ink);
		opacity: 0.6;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.controls input[type='range'] {
		flex: 1 1 240px;
		min-width: 0;
		accent-color: var(--wi-red);
		margin: 0;
	}

	.ev-card {
		border-left: 3px solid var(--wi-red);
		padding: 4px 0 4px 14px;
		min-height: 124px;
	}
	.ev-card.quiet {
		border-color: var(--wi-line);
	}
	.ev-card .when {
		font-size: 13px;
		color: var(--wi-muted);
	}
	.wi.wi .ev-card h3 {
		font-family: var(--wi-serif);
		font-weight: 700;
		font-size: 20px;
		line-height: 1.4;
		color: var(--wi-ink);
		margin: 2px 0 4px;
		text-wrap: balance;
	}
	.ev-card p {
		max-width: 64ch;
	}
	.ev-card .src {
		font-size: 12.5px;
		color: var(--wi-muted);
		margin-top: 6px;
	}

	.wi.wi .sub {
		font-size: 14px;
		font-weight: 600;
		color: var(--wi-muted);
	}
	.lanes {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.lane {
		display: grid;
		grid-template-columns: minmax(0, 190px) minmax(0, 1fr);
		gap: 10px;
		align-items: center;
		font-size: 13.5px;
	}
	.bar {
		position: relative;
		height: 14px;
		background: var(--tl-weekend);
		border-radius: 2px;
	}
	.bar b {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 2px;
	}
	.bar small {
		position: absolute;
		top: -1px;
		font-size: 12px;
		color: var(--wi-muted);
		white-space: nowrap;
		line-height: 16px;
	}

	.after ol {
		margin-top: 8px;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}
	.after li {
		border-top: 1px solid var(--wi-line);
		padding-top: 8px;
		font-size: 14px;
	}
	.after li b {
		display: block;
		font-weight: 600;
		color: var(--wi-ink);
	}

	@media (max-width: 560px) {
		.after ol {
			grid-template-columns: 1fr;
		}
		.lane {
			grid-template-columns: 1fr;
			gap: 2px;
		}
		.axis span.hide-sm {
			display: none;
		}
	}

	/* ---------- Phones: calendar instead of strip ---------- */
	@media (max-width: 640px) {
		.desk {
			display: none;
		}
		.phone {
			display: inline;
		}
		/* figures: number on the left, text on the right */
		.figs {
			grid-template-columns: 1fr;
			gap: 0;
		}
		.fig {
			display: grid;
			grid-template-columns: 118px minmax(0, 1fr);
			gap: 10px;
			align-items: baseline;
			padding: 8px 0;
			border-top-width: 2px;
		}
		.fig b {
			font-size: 22px;
		}
		.fig span {
			font-size: 13.5px;
			line-height: 1.5;
		}
		.board {
			padding: 16px 12px;
			gap: 14px;
		}
		.strip-wrap,
		.controls input[type='range'] {
			display: none;
		}
		.cal {
			display: grid;
		}
		/* keep calendar, buttons and the event card together on one screen */
		.cal {
			order: 1;
		}
		.controls {
			order: 2;
		}
		.ev-card {
			order: 3;
			min-height: 0;
		}
		.legend {
			order: 4;
			font-size: 12.5px;
		}
		.controls {
			display: grid;
			grid-template-columns: 1fr 1fr 1fr;
			gap: 8px;
		}
		.controls .prev {
			order: 1;
		}
		.controls .play {
			order: 2;
		}
		.controls .next {
			order: 3;
		}
		.wi.wi .controls button {
			min-height: 42px;
			padding: 8px 6px;
			font-size: 14.5px;
		}
	}
</style>
