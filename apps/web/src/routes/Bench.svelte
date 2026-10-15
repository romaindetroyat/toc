<script lang="ts">
  import {
    BENCH_OTHERS,
    BENCH_SEVENS,
    BOT_LEVELS,
    type BenchPosition,
    type BotLevel,
    benchPositions,
  } from "@toc/bots";
  import type { Rng } from "@toc/engine";
  import { onDestroy } from "svelte";
  import { fastEnough, resultsOf } from "../game/benchStats.ts";
  import { type BotRunner, createInlineRunner, ThinkCancelled } from "../game/botRunner.ts";
  import { banc, ms, resultsText } from "../i18n/fr/banc.ts";
  import { bots } from "../i18n/fr/bots.ts";
  import Icon from "../ui/Icon.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import { showToast } from "../ui/toast.svelte.ts";

  // The bench page « Banc d’essai de l’ordinateur » (#/banc, 03-UI-SPEC « Bench page », 03-RESEARCH
  // Pitfall 1): times the computer on this device, so that Romain can check BOT-05 on his own phone.
  // Linked from nowhere and loaded as its own chunk (App.svelte). It reads no game, no session and no
  // setting: only the fixed positions of @toc/bots benchPositions(), the same on every device.
  // Each decision runs through the game's inline runner (8 ms slices with yields) with the level's own
  // budget, but without the pacing and without the hard cap (deadline null): the time shown is the real
  // compute time. A requestAnimationFrame loop records the longest gap between two frames meanwhile.

  type Phase = "idle" | "running" | "done" | "stopped" | "interrupted" | "error";

  /** Computed once, on the first run (playing the eight fixed games takes a moment on a phone). */
  let positions: BenchPosition[] | null = null;

  let level = $state<BotLevel>(5);
  /** The level of the run shown (the picker may have moved since). */
  let measured = $state<BotLevel>(5);
  let phase = $state<Phase>("idle");
  /** Wall time of each decision measured, in ms. */
  let times = $state<number[]>([]);
  /** The longest gap between two frames during the run, in ms. */
  let frozen = $state(0);
  let total = $state(BENCH_SEVENS + BENCH_OTHERS);
  /** Set when the clipboard refused: the results are shown as selectable text instead. */
  let fallbackText = $state<string | undefined>();

  /** Bumped by every start, stop and interruption: a run older than this one stops at its next step. */
  let runId = 0;
  let runner: BotRunner | null = null;

  const running = $derived(phase === "running");
  const results = $derived(resultsOf(times, frozen));
  const shown = $derived(
    times.length > 0 && (phase === "done" || phase === "stopped" || phase === "interrupted"),
  );
  /** An interrupted run is not judged: the page went to the background. */
  const judged = $derived(shown && phase !== "interrupted");
  const fast = $derived(fastEnough(results));
  const current = $derived(Math.min(times.length + 1, total));

  const levelOptions = BOT_LEVELS.map((value) => ({
    value: String(value),
    label: bots.levels[value],
    title: bots.optionTitle(value),
  }));

  // Under 384 px the five names wrap on two rows, as on the launch screen held upright.
  let narrow = $state(false);
  $effect(() => {
    const query = window.matchMedia("(max-width: 415.98px)");
    narrow = query.matches;
    const onChange = () => (narrow = query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  });

  function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  /** One task boundary between two decisions, so the page paints, as the game's pace lets it. */
  function yieldToPage(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /** The fixed rng of decision i (the bench tool's first repeat), the same on every device. */
  function rngOf(i: number): Rng {
    return [1, i * 104729 + 3, i + 5, 0x9e3779b9];
  }

  async function start() {
    const id = ++runId;
    measured = level;
    times = [];
    frozen = 0;
    fallbackText = undefined;
    phase = "running";
    // « Coup 1 sur 40 » is on screen before the positions are prepared (not measured).
    await nextFrame();
    await nextFrame();
    if (id !== runId) return;
    try {
      positions ??= benchPositions();
      total = positions.length;
      const own = createInlineRunner({
        now: () => performance.now(),
        isHidden: () => document.hidden,
      });
      runner = own;

      let longest = 0;
      let last = performance.now();
      const watch = () => {
        if (id !== runId) return;
        const t = performance.now();
        longest = Math.max(longest, t - last);
        last = t;
        requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);

      for (const [i, { view, seat }] of positions.entries()) {
        const begin = performance.now();
        await own.think({ view, seat, level: measured, rng: rngOf(i), deadline: null });
        const spent = performance.now() - begin;
        if (id !== runId) return;
        times = [...times, spent];
        frozen = longest;
        await yieldToPage();
        if (id !== runId) return;
      }
      frozen = longest;
      runId++;
      phase = "done";
    } catch (error) {
      if (id !== runId || error instanceof ThinkCancelled) return;
      runId++;
      console.error(error);
      phase = "error";
    }
  }

  /** Ends the run in progress: the decisions measured so far are kept. */
  function end(next: Phase) {
    runId++;
    runner?.cancel();
    runner = null;
    phase = next;
  }

  // A page sent to the background stops the run: its numbers would not be the screen's.
  $effect(() => {
    const onVisibility = () => {
      if (document.hidden && phase === "running") end("interrupted");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  });

  onDestroy(() => {
    runId++;
    runner?.cancel();
  });

  /** The local date, AAAA-MM-JJ. */
  function today(): string {
    const d = new Date();
    const two = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  }

  async function copyResults() {
    const text = resultsText(bots.levels[measured], results, navigator.userAgent, today());
    try {
      // Plain text only: nothing here is ever turned into markup.
      await navigator.clipboard.writeText(text);
      fallbackText = undefined;
      showToast(banc.copied);
    } catch {
      fallbackText = text;
      showToast(banc.copyFailed);
    }
  }
</script>

<main class="banc" data-bench data-phase={phase}>
  <header>
    <a class="back btn btn-text" href="#/">{banc.back}</a>
    <h1 class="t-heading">{banc.title}</h1>
  </header>

  <p class="intro">{banc.intro}</p>

  {#if phase === "error"}
    <section class="card" role="alert" data-bench-error>
      <h2 class="strong">{banc.error.heading}</h2>
      <p class="muted">{banc.error.body}</p>
      <button type="button" class="btn btn-primary" onclick={() => location.reload()}>
        {banc.error.reload}
      </button>
    </section>
  {:else}
    <div class="level">
      <span class="label" aria-hidden="true">{banc.levelLabel}</span>
      <div class="picker">
        <Segmented
          options={levelOptions}
          value={String(level)}
          label={banc.levelLabel}
          wrap={narrow}
          disabled={running}
          onchange={(value) => (level = Number(value) as BotLevel)}
        />
      </div>
    </div>

    <div class="actions">
      {#if running}
        <button type="button" class="btn btn-secondary action" onclick={() => end("stopped")}>
          {banc.stop}
        </button>
      {:else}
        <button type="button" class="btn btn-primary action" onclick={start}>{banc.start}</button>
      {/if}
    </div>

    {#if running}
      <div class="progress" data-bench-progress>
        <p class="tabular">{banc.progress(current, total)}</p>
        <div
          class="track"
          role="progressbar"
          aria-label={banc.progressName}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={times.length}
        >
          <div class="fill" style:width={`${(100 * times.length) / total}%`}></div>
        </div>
      </div>
    {/if}

    {#if phase === "stopped"}
      <p class="note" data-bench-note>{banc.stopped(times.length)}</p>
    {:else if phase === "interrupted"}
      <p class="note" data-bench-note>{banc.interrupted}</p>
    {/if}

    <section class="card" data-bench-results>
      {#if shown}
        <h2 class="t-heading">{banc.resultsHeading}</h2>
        <dl>
          <div class="row">
            <dt>{banc.rows.count}</dt>
            <dd class="tabular">{results.count}</dd>
          </div>
          <div class="row">
            <dt>{banc.rows.p50}</dt>
            <dd class="tabular">{ms(results.p50)}</dd>
          </div>
          <div class="row">
            <dt>{banc.rows.p95}</dt>
            <dd class="tabular">{ms(results.p95)}</dd>
          </div>
          <div class="row">
            <dt>{banc.rows.max}</dt>
            <dd class="tabular">{ms(results.max)}</dd>
          </div>
          <div class="row">
            <dt>{banc.rows.frozen}</dt>
            <dd class="tabular">{ms(results.frozen)}</dd>
          </div>
        </dl>
        {#if judged}
          <p class="verdict" data-verdict={fast ? "fast" : "slow"}>
            <Icon name={fast ? "check" : "x"} size={16} />
            <span>{fast ? banc.fast : banc.slow}</span>
          </p>
        {/if}
        <button type="button" class="btn btn-secondary copy" onclick={copyResults}>
          {banc.copy}
        </button>
        {#if fallbackText !== undefined}
          <textarea
            class="results-text"
            readonly
            rows={8}
            aria-label={banc.resultsBox}
            value={fallbackText}
            onfocus={(event) => event.currentTarget.select()}
          ></textarea>
        {/if}
      {:else}
        <h2 class="strong">{banc.emptyHeading}</h2>
        <p class="muted">{banc.emptyBody}</p>
      {/if}
    </section>
  {/if}
</main>

<style>
  .banc {
    box-sizing: border-box;
    width: 100%;
    max-width: 640px;
    min-height: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-md) calc(var(--space-md) + env(safe-area-inset-right, 0px))
      calc(var(--space-md) + env(safe-area-inset-bottom, 0px))
      calc(var(--space-md) + env(safe-area-inset-left, 0px));
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 var(--space-sm);
  }

  h1,
  h2,
  p,
  dl,
  dd {
    margin: 0;
  }

  .back {
    min-height: var(--touch);
    margin-left: calc(-1 * var(--space-sm));
  }

  .level {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .label {
    font-size: var(--label-size);
    font-weight: 700;
    line-height: var(--label-line);
  }

  /* The same picker as the launch screen's strength rows: 4 px option padding, names on one line. */
  .picker {
    --segmented-pad: var(--space-xs);
  }

  .picker :global(.option) {
    white-space: nowrap;
  }

  .action {
    min-width: 160px;
  }

  .progress {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .progress p,
  .note {
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  .track {
    height: 8px;
    overflow: hidden;
    border-radius: 4px;
    background: var(--bois-sombre);
  }

  .fill {
    height: 100%;
    background: var(--creme);
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
    margin-top: var(--space-sm);
    padding: var(--space-md);
    border-radius: var(--radius-sheet);
    background: var(--bois-sombre);
  }

  .strong {
    font-size: var(--body-size);
    font-weight: 700;
    line-height: var(--body-line);
  }

  .muted {
    color: var(--creme-attenuee);
  }

  dl {
    display: flex;
    flex-direction: column;
    align-self: stretch;
    gap: var(--space-xs);
  }

  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-md);
    min-height: 24px;
    font-size: var(--label-size);
    line-height: var(--label-line);
  }

  dt {
    color: var(--creme-attenuee);
  }

  dd {
    font-weight: 700;
    text-align: right;
    white-space: nowrap;
  }

  .verdict {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-weight: 700;
  }

  .verdict :global(svg) {
    flex: none;
  }

  .results-text {
    align-self: stretch;
    padding: var(--space-sm) var(--space-md);
    border: 2px solid var(--creme-attenuee);
    border-radius: var(--radius-button);
    background: var(--noyer);
    color: var(--creme);
    font-family: inherit;
    font-size: var(--label-size);
    line-height: var(--label-line);
    resize: vertical;
  }
</style>
