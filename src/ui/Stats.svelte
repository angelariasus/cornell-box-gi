<!-- Detailed statistics reported by the renderer. The headline numbers are also on the canvas. -->
<script>
  import Section from './Section.svelte';
  import { fmt, t } from '../i18n/index.js';
  import { stats } from '../state/params.js';
</script>

<Section title={$t('stats.heading')} open={false}>
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
</Section>

<style>
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
