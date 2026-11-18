<!-- Live statistics reported by the renderer. -->
<script>
  import { stats } from '../state/params.js';

  const progress = $derived(
    $stats.maxSamples > 0 ? Math.min(1, $stats.samples / $stats.maxSamples) : 0,
  );
</script>

<section class="group" aria-labelledby="stats-heading">
  <h2 id="stats-heading">Statistics</h2>
  <div
    class="progress"
    role="progressbar"
    aria-label="Accumulated samples"
    aria-valuemin="0"
    aria-valuemax={$stats.maxSamples}
    aria-valuenow={$stats.samples}
  >
    <div class="bar" style:width="{progress * 100}%"></div>
  </div>
  <dl>
    <dt>Samples per pixel</dt>
    <dd>{$stats.samples} / {$stats.maxSamples}</dd>
    {#if $stats.split}
      <dt>Right side</dt>
      <dd>{$stats.split.samples} / {$stats.split.maxSamples}</dd>
    {/if}
    <dt>Resolution</dt>
    <dd>{$stats.width} × {$stats.height}</dd>
    <dt>Frame time</dt>
    <dd>{$stats.converged ? 'done' : `${$stats.frameMs.toFixed(1)} ms`}</dd>
    {#if !$stats.converged && $stats.samplesPerFrame}
      <dt>Samples per frame</dt>
      <dd>{$stats.samplesPerFrame}{$stats.autoSamples ? ' (auto)' : ''}</dd>
    {/if}
    <dt>Buffer</dt>
    <dd>{$stats.format}</dd>
  </dl>
</section>

<style>
  .progress {
    height: 4px;
    border-radius: 2px;
    background: var(--surface);
    overflow: hidden;
  }

  .bar {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s linear;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.15rem 0.8rem;
    margin: 0;
    font-size: 0.82rem;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
