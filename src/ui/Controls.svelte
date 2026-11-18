<!-- Per-method settings, display settings and the advanced debug view. -->
<script>
  import Slider from './Slider.svelte';
  import { params } from '../state/params.js';

  const fixed = (digits) => (v) => Number(v).toFixed(digits);

  // The debug view is a separate mode; remember which method to return to.
  let lastMethod = $state('phong');
  $effect(() => {
    if ($params.mode !== 'debug') lastMethod = $params.mode;
  });

  const debugChoice = $derived($params.mode === 'debug' ? $params.debugView : 'off');

  function setDebug(choice) {
    if (choice === 'off') {
      $params.mode = lastMethod;
    } else {
      $params.debugView = choice;
      $params.mode = 'debug';
    }
  }
</script>

{#if $params.mode === 'whitted'}
  <section class="group" aria-labelledby="whitted-heading">
    <h2 id="whitted-heading">Whitted settings</h2>
    <Slider
      label="Max depth"
      min={0}
      max={6}
      step={1}
      bind:value={$params.whittedDepth}
      hint="Depth of the ray tree (Figure 8). 0 = primary rays only"
    />
    <Slider
      label="Glass index η"
      min={1}
      max={2}
      step={0.01}
      bind:value={$params.glassIor}
      format={fixed(2)}
      hint="1.00 = air (no refraction) · 1.50 = glass · 2.00 ≈ diamond"
    />
  </section>
{/if}

{#if $params.mode === 'phong' || $params.mode === 'whitted'}
  <section class="group" aria-labelledby="phong-heading">
    <h2 id="phong-heading">
      {$params.mode === 'whitted' ? 'Local term (Phong)' : 'Phong settings'}
    </h2>
    <Slider
      label="Shininess n"
      min={0}
      max={8}
      step={0.25}
      bind:value={() => Math.log2($params.phongShininess), (v) => ($params.phongShininess = 2 ** v)}
      format={(v) => (2 ** v).toFixed(0)}
      hint="Exponent of the specular lobe (R·V)ⁿ"
    />
    <Slider
      label="Specular ks"
      min={0}
      max={1}
      step={0.01}
      bind:value={$params.phongSpecular}
      format={fixed(2)}
    />
    <Slider
      label="Ambient La"
      min={0}
      max={0.3}
      step={0.005}
      bind:value={$params.phongAmbient}
      format={fixed(3)}
      hint="Constant light that replaces the missing indirect light"
    />
  </section>
{/if}

<section class="group" aria-labelledby="display-heading">
  <h2 id="display-heading">Display</h2>
  <Slider
    label="Exposure"
    min={-3}
    max={3}
    step={0.1}
    bind:value={() => Math.log2($params.exposure), (v) => ($params.exposure = 2 ** v)}
    format={(v) => `×${(2 ** v).toFixed(2)}`}
  />
  <Slider
    label="Resolution scale"
    min={0.25}
    max={1}
    step={0.05}
    bind:value={$params.resolutionScale}
    format={(v) => `${Math.round(v * 100)}%`}
  />
</section>

<details class="advanced">
  <summary>Advanced</summary>
  <div class="group">
    <h2 id="debug-heading">Geometry debug view</h2>
    <div class="segmented" role="radiogroup" aria-labelledby="debug-heading">
      {#each [['off', 'Off'], ['albedo', 'Materials'], ['normals', 'Normals']] as [value, text] (value)}
        <button
          type="button"
          role="radio"
          aria-checked={debugChoice === value}
          class:active={debugChoice === value}
          onclick={() => setDebug(value)}
        >
          {text}
        </button>
      {/each}
    </div>
  </div>
</details>

<style>
  .advanced summary {
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 0.6rem;
  }
</style>
