<!-- Per-method settings, display settings and the advanced debug view. -->
<script>
  import Slider from './Slider.svelte';
  import Toggle from './Toggle.svelte';
  import { fmt, t } from '../i18n/index.js';
  import { METHODS, params } from '../state/params.js';
  import { radiosityState } from '../state/radiosity.js';
  import { causticsState } from '../state/caustics.js';

  const showCaustics = $derived(
    $params.scene === 'spheres' && ['whitted', 'path', 'radiosity'].includes($params.mode),
  );
  const formatPhotons = (v) => `${$fmt(Math.round(2 ** v / 1000))}k`;

  const SOLVERS = [
    ['gauss-seidel', 'gaussSeidel'],
    ['jacobi', 'jacobi'],
    ['progressive', 'progressive'],
  ];

  // Shown snapshot: the slider runs over 0..steps-1; -1 in the params means "the last one".
  const lastStep = $derived(Math.max(0, $radiosityState.steps.length - 1));
  const shownIndex = $derived(
    $params.radiosityStep < 0 || $params.radiosityStep > lastStep
      ? lastStep
      : $params.radiosityStep,
  );
  const stepLabel = (index) => {
    const n = $radiosityState.steps[index] ?? 0;
    const unit = $radiosityState.stepUnit === 'shots' ? 'stepShot' : 'stepIteration';
    const step = $t(`radiosity.${unit}${n === 1 ? '' : 's'}`, { n: $fmt(n) });
    return index === lastStep ? $t('radiosity.stepFinal', { step }) : step;
  };

  const fixed = (digits) => (v) => $fmt(Number(v), digits);

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

{#if $params.mode === 'radiosity'}
  <section class="group" aria-labelledby="radiosity-heading">
    <h2 id="radiosity-heading">{$t('radiosity.heading')}</h2>
    <Slider
      label={$t('radiosity.patches')}
      min={2}
      max={16}
      step={1}
      bind:value={$params.radiosityPatches}
      hint={$radiosityState.stats
        ? $t('radiosity.patchesHint', {
            patches: $fmt($radiosityState.stats.patchCount),
            formFactors: $fmt($radiosityState.stats.patchCount ** 2),
          })
        : $t('radiosity.patchesHintIdle')}
    />
    <div class="field">
      <span id="solver-label">{$t('radiosity.solver')}</span>
      <div class="segmented" role="radiogroup" aria-labelledby="solver-label">
        {#each SOLVERS as [value, key] (value)}
          <button
            type="button"
            role="radio"
            aria-checked={$params.radiosityMethod === value}
            class:active={$params.radiosityMethod === value}
            onclick={() => {
              $params.radiosityMethod = value;
              $params.radiosityStep = -1;
            }}
          >
            {$t(`radiosity.solvers.${key}`)}
          </button>
        {/each}
      </div>
    </div>
    {#if $params.radiosityMethod !== 'progressive'}
      <Slider
        label={$t('radiosity.iterations')}
        min={1}
        max={64}
        step={1}
        bind:value={$params.radiosityIterations}
      />
    {/if}

    {#if $radiosityState.status === 'solving'}
      <div class="solving" role="status">
        <span>
          {$radiosityState.phase === 'formFactors'
            ? $t('radiosity.computingFormFactors')
            : $t('radiosity.solving')}… {$radiosityState.pct}%
        </span>
        <div class="progress"><div class="bar" style:width="{$radiosityState.pct}%"></div></div>
      </div>
    {:else if $radiosityState.status === 'error'}
      <p class="error">{$radiosityState.error}</p>
    {:else if $radiosityState.status === 'ready'}
      <Slider
        label={$t('radiosity.shownStep')}
        min={0}
        max={lastStep}
        step={1}
        bind:value={() => shownIndex, (v) => ($params.radiosityStep = v === lastStep ? -1 : v)}
        format={stepLabel}
        hint={$t('radiosity.shownStepHint')}
      />
      <p class="hint">
        {$t('radiosity.timings', {
          formFactors: $fmt($radiosityState.stats.formFactorMs),
          solve: $fmt($radiosityState.stats.solveMs),
        })}
      </p>
    {/if}

    <Toggle
      label={$t('radiosity.smooth')}
      bind:checked={$params.radiosityInterpolate}
      hint={$t('radiosity.smoothHint')}
    />
  </section>
{/if}

{#if $params.mode === 'path'}
  <section class="group" aria-labelledby="path-heading">
    <h2 id="path-heading">{$t('path.heading')}</h2>
    <Slider
      label={$t('path.bounces')}
      min={1}
      max={16}
      step={1}
      bind:value={$params.pathMaxBounces}
      hint={$t('path.bouncesHint')}
    />
    <Toggle label={$t('path.nee')} bind:checked={$params.pathNextEvent} hint={$t('path.neeHint')} />
    <div class="field">
      <span id="sampling-label">{$t('path.sampling')}</span>
      <div class="segmented" role="radiogroup" aria-labelledby="sampling-label">
        {#each [[true, 'cosine'], [false, 'uniform']] as [value, key] (key)}
          <button
            type="button"
            role="radio"
            aria-checked={$params.pathCosineSampling === value}
            class:active={$params.pathCosineSampling === value}
            onclick={() => ($params.pathCosineSampling = value)}
          >
            {$t(`path.${key}`)}
          </button>
        {/each}
      </div>
      <p class="hint">{$t('path.samplingHint')}</p>
    </div>
    <Toggle
      label={$t('path.roulette')}
      bind:checked={$params.pathRussianRoulette}
      hint={$t('path.rouletteHint')}
    />
    <Slider
      label={$t('path.samplesPerFrame')}
      min={0}
      max={8}
      step={1}
      bind:value={$params.samplesPerFrame}
      format={(v) => (Number(v) === 0 ? $t('path.auto') : String(v))}
      hint={$t('path.samplesPerFrameHint')}
    />
    <Slider
      label={$t('path.maxSamples')}
      min={4}
      max={14}
      step={1}
      bind:value={() => Math.log2($params.pathMaxSamples), (v) => ($params.pathMaxSamples = 2 ** v)}
      format={(v) => $fmt(2 ** v)}
    />
  </section>
{/if}

{#if $params.mode === 'whitted'}
  <section class="group" aria-labelledby="whitted-heading">
    <h2 id="whitted-heading">{$t('whitted.heading')}</h2>
    <Slider
      label={$t('whitted.depth')}
      min={0}
      max={6}
      step={1}
      bind:value={$params.whittedDepth}
      hint={$t('whitted.depthHint')}
    />
    <Slider
      label={$t('whitted.ior')}
      min={1}
      max={2}
      step={0.01}
      bind:value={$params.glassIor}
      format={fixed(2)}
      hint={$t('whitted.iorHint')}
    />
    <Toggle
      label={$t('whitted.inspector')}
      bind:checked={$params.rayInspector}
      hint={$t('whitted.inspectorHint')}
    />
  </section>
{/if}

{#if showCaustics}
  <section class="group" aria-labelledby="caustics-heading">
    <h2 id="caustics-heading">{$t('caustics.heading')}</h2>
    <Toggle
      label={$t('caustics.toggle')}
      bind:checked={$params.causticsEnabled}
      hint={$t('caustics.toggleHint')}
    />
    {#if $params.causticsEnabled}
      <Slider
        label={$t('caustics.photons')}
        min={17}
        max={21}
        step={0.5}
        bind:value={
          () => Math.log2($params.causticsPhotons),
          (v) => ($params.causticsPhotons = Math.round(2 ** v))
        }
        format={formatPhotons}
      />
      <Slider
        label={$t('caustics.radius')}
        min={4}
        max={60}
        step={1}
        bind:value={$params.causticsRadius}
        format={(v) => $t('caustics.radiusValue', { n: $fmt(v) })}
        hint={$t('caustics.radiusHint')}
      />
      {#if $causticsState.status === 'tracing'}
        <div class="solving" role="status">
          <span>{$t('caustics.tracing')}… {$causticsState.pct}%</span>
          <div class="progress">
            <div class="bar" style:width="{$causticsState.pct}%"></div>
          </div>
        </div>
      {:else if $causticsState.status === 'error'}
        <p class="error">{$causticsState.error}</p>
      {:else if $causticsState.stats}
        <p class="hint">
          {$t('caustics.stats', {
            stored: $fmt($causticsState.stats.stored),
            emitted: $fmt($causticsState.stats.emitted),
            ms: $fmt($causticsState.stats.ms),
          })}
        </p>
      {/if}
    {/if}
  </section>
{/if}

{#if $params.mode === 'phong' || $params.mode === 'whitted'}
  <section class="group" aria-labelledby="phong-heading">
    <h2 id="phong-heading">
      {$params.mode === 'whitted' ? $t('phong.localHeading') : $t('phong.heading')}
    </h2>
    <Slider
      label={$t('phong.shininess')}
      min={0}
      max={8}
      step={0.25}
      bind:value={() => Math.log2($params.phongShininess), (v) => ($params.phongShininess = 2 ** v)}
      format={(v) => $fmt(2 ** v)}
      hint={$t('phong.shininessHint')}
    />
    <Slider
      label={$t('phong.specular')}
      min={0}
      max={1}
      step={0.01}
      bind:value={$params.phongSpecular}
      format={fixed(2)}
    />
    <Slider
      label={$t('phong.ambient')}
      min={0}
      max={0.3}
      step={0.005}
      bind:value={$params.phongAmbient}
      format={fixed(3)}
      hint={$t('phong.ambientHint')}
    />
  </section>
{/if}

<section class="group" aria-labelledby="compare-heading">
  <h2 id="compare-heading">{$t('compare.heading')}</h2>
  <Toggle
    label={$t('compare.split')}
    bind:checked={$params.splitView}
    hint={$t('compare.splitHint')}
  />
  {#if $params.splitView}
    <div class="field">
      <span id="split-label">{$t('compare.rightSide')}</span>
      <div class="segmented compact" role="radiogroup" aria-labelledby="split-label">
        {#each METHODS.filter((m) => m.available) as method (method.id)}
          <button
            type="button"
            role="radio"
            aria-checked={$params.splitMode === method.id}
            class:active={$params.splitMode === method.id}
            onclick={() => ($params.splitMode = method.id)}
          >
            {$t(`methods.${method.id}.short`)}
          </button>
        {/each}
      </div>
      <p class="hint">{$t('compare.shared')}</p>
    </div>
  {/if}
</section>

<section class="group" aria-labelledby="display-heading">
  <h2 id="display-heading">{$t('display.heading')}</h2>
  <Slider
    label={$t('display.exposure')}
    min={-3}
    max={3}
    step={0.1}
    bind:value={() => Math.log2($params.exposure), (v) => ($params.exposure = 2 ** v)}
    format={(v) => `×${$fmt(2 ** v, 2)}`}
  />
  <Toggle
    label={$t('display.whiteBalance')}
    bind:checked={$params.whiteBalance}
    hint={$t('display.whiteBalanceHint')}
  />
  <Slider
    label={$t('display.resolution')}
    min={0.25}
    max={1}
    step={0.05}
    bind:value={$params.resolutionScale}
    format={(v) => `${Math.round(v * 100)}%`}
  />
</section>

<details class="advanced">
  <summary>{$t('advanced.summary')}</summary>
  <div class="group">
    <h2 id="debug-heading">{$t('advanced.debugHeading')}</h2>
    <div class="segmented" role="radiogroup" aria-labelledby="debug-heading">
      {#each [['off', 'off'], ['albedo', 'materials'], ['normals', 'normals']] as [value, key] (value)}
        <button
          type="button"
          role="radio"
          aria-checked={debugChoice === value}
          class:active={debugChoice === value}
          onclick={() => setDebug(value)}
        >
          {$t(`advanced.${key}`)}
        </button>
      {/each}
    </div>
  </div>
</details>

<style>
  .compact button {
    padding: 0.35rem 0.2rem;
    font-size: 0.78rem;
  }

  .solving {
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
    transition: width 0.15s linear;
  }

  .error {
    margin: 0;
    color: var(--danger);
    font-size: 0.85rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
  }

  .advanced summary {
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 0.6rem;
  }
</style>
