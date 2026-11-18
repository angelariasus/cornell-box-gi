<!--
  Progress over the canvas: accumulated samples per pixel, frame time and a progress bar, with
  one row per side in split screen. The navigation hint sits on the right.
-->
<script>
  import { fmt, t } from '../i18n/index.js';
  import { params, stats } from '../state/params.js';

  const rows = $derived.by(() => {
    const main = {
      name: $t(`methods.${$params.mode}.short`),
      samples: $stats.samples,
      maxSamples: $stats.maxSamples,
    };
    if (!$stats.split) return [main];
    const right = {
      name: $t(`methods.${$stats.split.mode}.short`),
      samples: $stats.split.samples,
      maxSamples: $stats.split.maxSamples,
    };
    return [main, right];
  });
  const fraction = (row) => (row.maxSamples > 0 ? Math.min(1, row.samples / row.maxSamples) : 0);
</script>

<div class="hud">
  <div class="card" role="group" aria-label={$t('stats.progress')}>
    <div class="rows">
      {#each rows as row, i (i)}
        <div class="row">
          {#if rows.length > 1}<span class="name">{row.name}</span>{/if}
          <span class="count">
            <strong>{$fmt(row.samples)}</strong> / {$fmt(row.maxSamples)}
            <abbr title={$t('stats.samples')}>spp</abbr>
          </span>
          <div
            class="bar"
            role="progressbar"
            aria-label={row.name}
            aria-valuemin="0"
            aria-valuemax={row.maxSamples}
            aria-valuenow={row.samples}
          >
            <div
              class="fill"
              class:done={fraction(row) >= 1}
              style:width="{fraction(row) * 100}%"
            ></div>
          </div>
        </div>
      {/each}
    </div>
    <span class="time">
      {$stats.converged ? $t('stats.done') : `${$fmt($stats.frameMs, 1)} ms`}
    </span>
  </div>
  <p class="navigation">{$t('app.footer')}</p>
</div>

<style>
  .hud {
    position: absolute;
    left: 0.75rem;
    right: 0.75rem;
    bottom: 0.75rem;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    pointer-events: none;
  }

  .card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: calc(var(--radius) + 2px);
    background: rgb(22 25 29 / 0.82);
    backdrop-filter: blur(6px);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  .rows {
    display: flex;
    gap: 1rem;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    width: 9.5rem;
  }

  .name {
    color: var(--muted);
    font-size: 0.72rem;
    line-height: 1.2;
  }

  .count {
    color: var(--muted);
    line-height: 1.2;
  }

  strong {
    color: var(--fg);
    font-weight: 600;
  }

  abbr {
    text-decoration: none;
  }

  .bar {
    height: 3px;
    border-radius: 2px;
    background: rgb(255 255 255 / 0.12);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s linear;
  }

  .fill.done {
    background: var(--success);
  }

  .time {
    min-width: 3.5rem;
    color: var(--muted);
    text-align: right;
  }

  .navigation {
    margin: 0;
    padding: 0.3rem 0.6rem;
    border-radius: var(--radius);
    background: rgb(0 0 0 / 0.45);
    color: var(--muted);
    font-size: 0.75rem;
  }

  @media (max-width: 800px) {
    .navigation {
      display: none;
    }
  }
</style>
