<!--
  Path tracing quality: the number of samples per pixel where accumulation stops. Each step
  quadruples the samples and halves the noise (Monte Carlo error falls as 1/√N). Raising it keeps
  the samples already accumulated.
-->
<script>
  import Info from './Info.svelte';
  import { t } from '../i18n/index.js';
  import { params } from '../state/params.js';

  let { label } = $props();

  const PRESETS = [256, 1024, 4096, 16384];
  const presetLabel = (n) => (n >= 1024 ? `${n / 1024}k` : String(n));
  const id = `presets-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="field">
  <span class="field-label">
    <span {id}>{label}</span>
    <Info text={$t('path.qualityInfo')} />
  </span>
  <div class="segmented" role="radiogroup" aria-labelledby={id}>
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
</div>
