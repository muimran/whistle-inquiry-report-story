<script>
	// Scrolly: a small chart stays on screen while the reader scrolls past one
	// card per step. Each step adds its dots, grows the time band and moves the
	// deadline line. Inside an iframe (where nothing can stay on screen) it shows
	// the same cards as a plain list instead.
	import * as C from './content.js';
	import { bn, MONTHS, prefersReducedMotion } from '../../lib/bn.js';
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	const DAY = 86400000;
	const T = ([y, m, d]) => Date.UTC(y, m - 1, d);
	const D = C.dates;
	const T0 = T(D.axisFrom);
	const T1 = T(D.axisTo);
	const LETTER = T(D.letter);
	const DEADLINE = T(D.deadline);
	const REPORT = T(D.report);
	const EXT1 = D.ext1 ? T(D.ext1) : null;
	const EXT2 = T(D.ext2);
	const short = ([, m, d]) => `${bn(d)} ${MONTHS[m - 1]}`;

	const steps = C.steps.map((s, i) => {
		const ts = s.events.flatMap((e) => [e.date, ...(e.also || [])]).map(T);
		return { ...s, i, until: Math.max(...ts) };
	});

	// One dot per date, tagged with the step that reveals it. Dots sit on the band.
	const dots = steps.flatMap((s) =>
		s.events
			.filter((e) => e.dot !== false)
			.flatMap((e) => [e.date, ...(e.also || [])].map((d) => ({ t: T(d), step: s.i })))
	);

	const months = [];
	for (let [y, m] = D.axisFrom; T([y, m, 1]) <= T1; m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
		const start = Math.max(T([y, m, 1]), T0);
		const next = m === 12 ? T([y + 1, 1, 1]) : T([y, m + 1, 1]);
		// the year goes under the first month and under every January
		const year = months.length === 0 || m === 1 ? bn(y) : '';
		months.push({ start, mid: (start + Math.min(next, T1 + DAY)) / 2, label: MONTHS[m - 1], year });
	}

	const inFrame = typeof window !== 'undefined' && window.self !== window.top;

	let active = $state(0);
	let w = $state(600);
	let stageEl = $state();
	let stageH = $state(0);
	const stepEls = [];

	// Chart rows (px): deadline label, time band, months, years.
	const PAD = 8;
	const Y = { flag: 12, band: 24, bandH: 12, month: 54, year: 68, h: 72 };
	const x = (t) => PAD + ((t - T0) / (T1 - T0)) * Math.max(0, w - 2 * PAD);

	const step = $derived(steps[active]);
	const before = $derived(step.until < LETTER);
	const endT = $derived(Math.min(step.until, REPORT));
	const days = $derived(Math.max(0, Math.round((endT - LETTER) / DAY)));
	const over = $derived(Math.max(0, Math.round((endT - DEADLINE) / DAY)));

	const dlState = $derived(step.deadline);
	const openExt = $derived(dlState === 'ext1' && !EXT1);
	const flagT = $derived(dlState === 'ext2' ? EXT2 : dlState === 'ext1' && EXT1 ? EXT1 : DEADLINE);
	const flagText = $derived(
		dlState === 'ext1' ? (EXT1 ? C.ui.deadline.ext1Dated(short(D.ext1)) : C.ui.deadline.ext1) : C.ui.deadline[dlState]
	);
	// On the step about the deadline itself (30 November) the line stands out.
	const flagNow = $derived(step.events.some((e) => e.dot === false && T(e.date) === DEADLINE));
	// Keep the label inside the chart: near an edge it hangs off the line's inner side.
	const labelAt = (fx) =>
		fx < 110 ? { x: Math.max(PAD, fx - 10), anchor: 'start' } : fx > w - 110 ? { x: Math.min(w - PAD, fx + 10), anchor: 'end' } : { x: fx, anchor: 'middle' };

	// The band's end and the deadline line glide to their new dates.
	const motion = () => (prefersReducedMotion() ? { duration: 0 } : { duration: 700, easing: cubicOut });
	const band = new Tween(LETTER);
	const flag = new Tween(DEADLINE);
	$effect(() => {
		band.set(before ? LETTER : endT, motion());
	});
	$effect(() => {
		flag.set(flagT, motion());
	});

	// Which step is active: the last card whose top has passed a line
	// a little below the chart.
	function update() {
		if (!stageEl) return;
		const vh = window.innerHeight;
		const bottom = Math.min(stageEl.getBoundingClientRect().bottom, vh * 0.65);
		const line = bottom + (vh - bottom) * 0.3;
		let idx = 0;
		for (let i = 0; i < stepEls.length; i++) {
			if (stepEls[i] && stepEls[i].getBoundingClientRect().top <= line) idx = i;
		}
		if (idx !== active) active = idx;
	}
	$effect(() => {
		if (inFrame || !stageEl) return;
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

<div class="wi wi-frame inq" class:inframe={inFrame}>
	<header>
		<p class="wi-kicker">{C.header.kicker}</p>
		<h3 class="wi-title">{C.header.title}</h3>
		<p class="wi-lede">
			{C.header.lede}
			{#if !inFrame}<span class="how">{C.header.howTo}</span>{/if}
		</p>
	</header>

	<div class="scrolly">
		{#if !inFrame}
			<!-- The cards below say all of this in words, so screen readers skip it. -->
			<div class="stage" bind:this={stageEl} bind:clientHeight={stageH} aria-hidden="true">
				<div class="ctr" class:off={before}>
					<span class="ctr-line">
						<span class="ctr-value">{before ? '—' : C.ui.days.value(bn(days))}</span>
						<span class="ctr-sub" class:red={over > 0}>
							{before ? C.ui.days.before : over > 0 ? C.ui.pastDeadline(bn(over)) : ''}
						</span>
					</span>
				</div>

				<div class="chart" bind:clientWidth={w}>
					<svg width={w} height={Y.h} viewBox="0 0 {w} {Y.h}">
						<!-- time band: dark until the original deadline, red after it -->
						<rect class="track" x={PAD} y={Y.band + 3} width={Math.max(0, w - 2 * PAD)} height={Y.bandH - 6} rx="3" />
						{#if !before}
							{@const end = band.current}
							<rect class="win" x={x(LETTER)} y={Y.band} width={Math.max(0, x(Math.min(end, DEADLINE)) - x(LETTER))} height={Y.bandH} />
							{#if end > DEADLINE}
								<rect class="over" x={x(DEADLINE)} y={Y.band} width={Math.max(0, x(end) - x(DEADLINE))} height={Y.bandH} />
							{/if}
						{/if}

						{#each months as mo (mo.start)}
							<text class="month" x={x(mo.mid)} y={Y.month} text-anchor="middle">{mo.label}</text>
							{#if mo.year}
								<text class="year" x={x(mo.mid)} y={Y.year} text-anchor="middle">{mo.year}</text>
							{/if}
						{/each}

						{#each dots as d, j (j)}
							<circle class="mk" class:shown={d.step <= active} class:now={d.step === active} cx={x(d.t)} cy={Y.band + Y.bandH / 2} r={d.step === active ? 5.5 : 4} />
						{/each}

						{#if dlState !== 'announced'}
							{@const fx = x(flag.current)}
							{@const lab = openExt ? { x: fx + 5, anchor: 'start' } : labelAt(fx)}
							<line class="dl" class:dashed={openExt} class:now={flagNow} x1={fx} x2={fx} y1={Y.band - 7} y2={Y.band + Y.bandH + 5} />
							<text class="dl-label" x={lab.x} y={Y.flag} text-anchor={lab.anchor}>{flagText}</text>
						{/if}
					</svg>
				</div>
			</div>
		{/if}

		<div class="cols" style:--stage-h="{stageH}px">
		{#if !inFrame}
			<!-- Desktop: the day count, large, beside the cards. Screen readers skip it. -->
			<div class="bigday" class:off={before} aria-hidden="true">
				<span class="bd-label">{C.ui.days.label}</span>
				<span class="bd-num">{before ? '—' : bn(days)}</span>
				{#if !before}<span class="bd-unit">দিন</span>{/if}
				<span class="bd-sub" class:red={over > 0}>
					{before ? C.ui.days.before : over > 0 ? C.ui.pastDeadline(bn(over)) : '\u00a0'}
				</span>
			</div>
		{/if}
		<div class="steps">
			{#each steps as s, i (i)}
				<section class="step" class:here={inFrame || i === active} bind:this={stepEls[i]}>
					<div class="card">
						{#if i === 0 || steps[i - 1].phase !== s.phase}
							<h4 class="phase">
								{C.ui.phase(C.phases[s.phase].n, C.phases[s.phase].title)}
								<span>({C.phases[s.phase].when})</span>
							</h4>
						{/if}
						{#each s.events as e, j (j)}
							<div class="ev">
								<p class="when">{e.when || short(e.date)}</p>
								{#each e.text as para, k (k)}<p class="txt">{para}</p>{/each}
								{#if e.src}<p class="src">{C.ui.source}{e.src}</p>{/if}
							</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>
		</div>
	</div>

	<p class="wi-note">{C.note}</p>
</div>

<style>
	.inq {
		--inq-dark: #22323f;
		--inq-track: #dde2e0;
	}
	/* No grey panel around the scrolly: it sits straight on the page. */
	.wi.wi.wi-frame.inq {
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

	/* ---------- the chart that stays on screen ---------- */
	.stage {
		position: sticky;
		/* start right under the site's menu bar: the offset includes a 14px gap */
		top: calc(var(--wi-top-offset) - 14px);
		/* moves up when the site's menu folds away (see base.css) */
		transition: top 0.35s ease;
		z-index: 2;
		background: #fff;
		margin: 0 calc(-1 * var(--wi-pad));
		padding: 14px var(--wi-pad) 8px;
		border-bottom: 1px solid var(--wi-line);
		box-shadow: 0 6px 12px -8px rgba(0, 0, 0, 0.18);
	}
	.ctr {
		display: flex;
		flex-direction: column;
		margin-bottom: 4px;
	}
	.ctr-line {
		display: flex;
		align-items: baseline;
		gap: 10px;
		white-space: nowrap;
	}
	.ctr-value {
		font-size: 24px;
		line-height: 1.25;
		font-weight: 700;
		color: var(--inq-dark);
	}
	.ctr-sub {
		font-size: 13px;
		font-weight: 500;
		color: var(--wi-muted);
	}
	.ctr-sub.red {
		font-weight: 600;
		color: var(--wi-red);
	}
	.chart {
		width: 100%;
	}
	.chart svg {
		display: block;
		overflow: visible;
	}
	svg text {
		font-family: var(--wi-sans);
	}
	.track {
		fill: var(--inq-track);
	}
	.win {
		fill: var(--inq-dark);
	}
	.over {
		fill: var(--wi-red);
	}
	.month {
		font-size: 11px;
		fill: var(--wi-muted);
	}
	.year {
		font-size: 10.5px;
		font-weight: 600;
		fill: var(--wi-muted);
	}
	.dl {
		stroke: var(--wi-red);
		stroke-width: 2;
	}
	.dl.dashed {
		stroke-dasharray: 5 3;
	}
	.dl.now {
		stroke-width: 4;
	}
	/* event dots on the band: hidden until their step, the current ones larger and dark */
	.mk {
		fill: #fff;
		stroke: var(--inq-dark);
		stroke-width: 1.5;
		opacity: 0;
		transition: opacity 0.35s ease;
	}
	.mk.shown {
		opacity: 1;
	}
	.mk.now {
		fill: var(--inq-dark);
		stroke: #fff;
	}
	.dl-label {
		font-size: 11.5px;
		font-weight: 700;
		fill: var(--wi-red);
	}

	/* ---------- the cards ---------- */
	/* Desktop: big day count on the left (it stays in view under the chart),
	   cards on the right. Phones keep the count inside the chart instead. */
	.bigday {
		display: none;
	}
	/* before the committee exists (first card) there is no count yet: it fades
	   in at day 0. It keeps its space, so nothing moves when it appears. */
	.bigday,
	.ctr {
		transition: opacity 0.35s ease;
	}
	.bigday.off,
	.ctr.off {
		opacity: 0;
	}
	@media (min-width: 900px) {
		.cols {
			display: grid;
			grid-template-columns: 220px minmax(0, 1fr);
			column-gap: 40px;
			align-items: start;
		}
		.inframe .cols {
			display: block;
		}
		.bigday {
			display: flex;
			flex-direction: column;
			position: sticky;
			/* centred in the space between the chart and the bottom of the screen,
			   level with the card being read (the block is about 210px tall) */
			top: calc((var(--wi-top-offset) - 14px + var(--stage-h) + 100vh) / 2 - 105px);
			padding-top: 18px;
			transition: top 0.35s ease;
		}
		.bd-label {
			font-size: 13px;
			font-weight: 600;
			color: var(--wi-muted);
		}
		.bd-num {
			font-family: var(--wi-serif);
			font-weight: 700;
			font-size: 104px;
			line-height: 1;
			color: var(--inq-dark);
			margin-top: 6px;
			font-variant-numeric: tabular-nums;
		}
		.bd-unit {
			font-family: var(--wi-serif);
			font-weight: 700;
			font-size: 28px;
			line-height: 1.1;
			color: var(--inq-dark);
		}
		.bd-sub {
			margin-top: 10px;
			font-size: 14px;
			line-height: 1.45;
			font-weight: 600;
			color: var(--wi-muted);
		}
		.bd-sub.red {
			color: var(--wi-red);
		}
		/* the small count in the chart isn't needed when the big one is there */
		.stage .ctr {
			display: none;
		}
		.card {
			margin: 0;
		}
	}
	.steps {
		position: relative;
		z-index: 1;
	}
	.step {
		min-height: 78vh;
		padding: 18px 0 8px;
	}
	.step:last-child {
		min-height: 70vh;
	}
	.card {
		max-width: 640px;
		margin: 0 auto;
		background: var(--wi-card);
		border: 1px solid var(--wi-line);
		border-radius: 8px;
		padding: 16px 18px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
		opacity: 0.4;
		transition: opacity 0.3s ease;
	}
	.here .card {
		opacity: 1;
	}
	.wi.wi .phase {
		font-size: 13px;
		line-height: 1.45;
		font-weight: 600;
		color: var(--wi-red);
		margin-bottom: 10px;
	}
	.wi.wi .phase span {
		color: var(--wi-muted);
		font-weight: 500;
	}
	.ev + .ev {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px dashed var(--wi-line);
	}
	.wi.wi .when {
		font-size: 15px;
		font-weight: 700;
		color: var(--wi-ink);
		margin-bottom: 2px;
	}
	.wi.wi .txt {
		font-family: var(--wi-serif);
		font-size: 16.5px;
		line-height: 1.7;
		color: var(--wi-body);
	}
	.wi.wi .txt + .txt {
		margin-top: 6px;
	}
	.wi.wi .src {
		font-size: 12px;
		line-height: 1.5;
		color: var(--wi-muted);
		margin-top: 4px;
	}

	/* ---------- inside an iframe: a plain list ---------- */
	.inframe .step {
		min-height: 0;
		padding: 0 0 12px;
	}
	.inframe .card {
		opacity: 1;
	}

	@media (max-width: 640px) {
		.stage {
			padding-top: 12px;
		}
		.ctr-value {
			font-size: 21px;
		}
		.ctr-sub {
			font-size: 12px;
		}
		.card {
			padding: 14px;
		}
		.wi.wi .txt {
			font-size: 16px;
			line-height: 1.65;
		}
	}
</style>
