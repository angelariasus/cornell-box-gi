<!-- Live statistics reported by the renderer, with quick quality presets for path tracing. -->
<script>
  import { fmt, t } from '../i18n/index.js';
  import { params, stats } from '../state/params.js';

  // Path tracing stops at this many samples per pixel. Each step quadruples the samples and
  // halves the noise (Monte Carlo error falls as 1/√N, report Section 5.2). Raising it keeps the
  // samples already accumulated.
  const PRESETS = [256, 1024, 4096, 16384];

  const progress = $derived(
    $stats.maxSamples > 0 ? Math.min(1, $stats.samples / $stats.maxSamples) : 0,
  );
  const showPresets = $derived(
    $params.mode === 'path' || ($params.splitView && $params.splitMode === 'path'),
  );
  const presetLabel = (n) => (n >= 1024 ? `${n / 1024}k` : String(n));
</script>

<section class="group" aria-labelledby="stats-heading">
  <h2 id="stats-heading">{$t('stats.heading')}</h2>
  {#if showPresets}
    <div class="field">
      <span id="quality-label">{$t('stats.presets')}</span>
      <div class="segmented" role="radiogroup" aria-labelledby="quality-label">
        {#each PRESETS as preset (preset)}
          <button
            type="button"
            role="radio"
            aria-checked={$params.pathMaxSamples === preset}
            class:active={$params.pathMaxSamples === preset}
            onclick={() => ($params.pathMaxSamples = preset)}
          >
            {presetLabel(preset)}
          </button>
        {/each}
      </div>
      <p class="hint">{$t('stats.presetsHint')}</p>
    </div>
  {/if}
  <div
    class="progress"
    role="progressbar"
    aria-label={$t('stats.progress')}
    aria-valuemin="0"
    aria-valuemax={$stats.maxSamples}
    aria-valuenow={$stats.samples}
  >
    <div class="bar" style:width="{progress * 100}%"></div>
  </div>
  <dl>
    <dt>{$t('stats.samples')}</dt>
    <dd>{$stats.samples} / {$stats.maxSamples}</dd>
    {#if $stats.split}
      <dt>{$t('stats.rightSide')}</dt>
      <dd>{$stats.split.samples} / {$stats.split.maxSamples}</dd>
    {/if}
    <dt>{$t('stats.resolution')}</dt>
    <dd>{$stats.width} × {$stats.height}</dd>
    <dt>{$t('stats.frameTime')}</dt>
    <dd>{$stats.converged ? $t('stats.done') : `${$fmt($stats.frameMs, 1)} ms`}</dd>
    {#if !$stats.converged && $stats.samplesPerFrame}
      <dt>{$t('stats.samplesPerFrame')}</dt>
      <dd>{$stats.samplesPerFrame}{$stats.autoSamples ? ` ${$t('stats.auto')}` : ''}</dd>
    {/if}
    <dt>{$t('stats.buffer')}</dt>
    <dd>{$stats.format}</dd>
  </dl>
</section>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
  }

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
