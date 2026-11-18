<!-- Per-method settings, display settings and the advanced debug view. -->
<script>
  import Slider from './Slider.svelte';
  import Toggle from './Toggle.svelte';
  import { radiosityState } from '../state/radiosity.js';
  import { causticsState } from '../state/caustics.js';

  const showCaustics = $derived(
    $params.scene === 'spheres' && ['whitted', 'path', 'radiosity'].includes($params.mode),
  );
  const formatPhotons = (v) => `${Math.round(2 ** v / 1000).toLocaleString('en-US')}k`;

  const SOLVERS = [
    ['gauss-seidel', 'Gauss-Seidel'],
    ['jacobi', 'Jacobi'],
    ['progressive', 'Progressive'],
  ];

  // Shown snapshot: the slider runs over 0..steps-1; -1 in the params means "the last one".
  const lastStep = $derived(Math.max(0, $radiosityState.steps.length - 1));
  const shownIndex = $derived(
    $params.radiosityStep < 0 || $params.radiosityStep > lastStep
      ? lastStep
      : $params.radiosityStep,
  );
  const stepLabel = (index) => {
    const value = $radiosityState.steps[index] ?? 0;
    const plural = value === 1 ? '' : 's';
    const unit = $radiosityState.stepUnit === 'shots' ? `shot${plural}` : `iteration${plural}`;
    return index === lastStep ? `${value} ${unit} (final)` : `${value} ${unit}`;
  };
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

{#if $params.mode === 'radiosity'}
  <section class="group" aria-labelledby="radiosity-heading">
    <h2 id="radiosity-heading">Radiosity settings</h2>
    <Slider
      label="Patches per unit"
      min={2}
      max={16}
      step={1}
      bind:value={$params.radiosityPatches}
      hint={$radiosityState.stats
        ? `${$radiosityState.stats.patchCount} patches · ${$radiosityState.stats.patchCount ** 2} form factors`
        : 'Mesh resolution: each wall is about one unit wide'}
    />
    <div class="field">
      <span id="solver-label">Solver</span>
      <div class="segmented" role="radiogroup" aria-labelledby="solver-label">
        {#each SOLVERS as [value, text] (value)}
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
            {text}
          </button>
        {/each}
      </div>
    </div>
    {#if $params.radiosityMethod !== 'progressive'}
      <Slider
        label="Iterations"
        min={1}
        max={64}
        step={1}
        bind:value={$params.radiosityIterations}
      />
    {/if}

    {#if $radiosityState.status === 'solving'}
      <div class="solving" role="status">
        <span>
          {$radiosityState.phase === 'formFactors' ? 'Computing form factors' : 'Solving'}… {$radiosityState.pct}%
        </span>
        <div class="progress"><div class="bar" style:width="{$radiosityState.pct}%"></div></div>
      </div>
    {:else if $radiosityState.status === 'error'}
      <p class="error">{$radiosityState.error}</p>
    {:else if $radiosityState.status === 'ready'}
      <Slider
        label="Shown step"
        min={0}
        max={lastStep}
        step={1}
        bind:value={() => shownIndex, (v) => ($params.radiosityStep = v === lastStep ? -1 : v)}
        format={stepLabel}
        hint="Move back to watch the solution converge (Table 2, Figure 13b)"
      />
      <p class="hint">
        Form factors {Math.round($radiosityState.stats.formFactorMs)} ms · solve
        {Math.round($radiosityState.stats.solveMs)} ms
      </p>
    {/if}

    <Toggle
      label="Smooth shading"
      bind:checked={$params.radiosityInterpolate}
      hint="Off shows each patch flat, revealing the mesh (Section 4.4)"
    />
  </section>
{/if}

{#if $params.mode === 'path'}
  <section class="group" aria-labelledby="path-heading">
    <h2 id="path-heading">Path tracing settings</h2>
    <Slider
      label="Max bounces"
      min={1}
      max={16}
      step={1}
      bind:value={$params.pathMaxBounces}
      hint="Surface interactions per path"
    />
    <Toggle
      label="Next event estimation"
      bind:checked={$params.pathNextEvent}
      hint="Sample the light at every diffuse bounce"
    />
    <div class="field">
      <span id="sampling-label">Direction sampling</span>
      <div class="segmented" role="radiogroup" aria-labelledby="sampling-label">
        {#each [[true, 'Cosine'], [false, 'Uniform']] as [value, text] (text)}
          <button
            type="button"
            role="radio"
            aria-checked={$params.pathCosineSampling === value}
            class:active={$params.pathCosineSampling === value}
            onclick={() => ($params.pathCosineSampling = value)}
          >
            {text}
          </button>
        {/each}
      </div>
      <p class="hint">
        Cosine = importance sampling (Example 4b). The difference is clearest with next event
        estimation off.
      </p>
    </div>
    <Toggle
      label="Russian roulette"
      bind:checked={$params.pathRussianRoulette}
      hint="End weak paths from the 4th bounce"
    />
    <Slider
      label="Samples per frame"
      min={0}
      max={8}
      step={1}
      bind:value={$params.samplesPerFrame}
      format={(v) => (Number(v) === 0 ? 'Auto' : String(v))}
      hint="Auto fills each frame while keeping about 30 fps"
    />
    <Slider
      label="Max samples per pixel"
      min={4}
      max={14}
      step={1}
      bind:value={() => Math.log2($params.pathMaxSamples), (v) => ($params.pathMaxSamples = 2 ** v)}
      format={(v) => String(2 ** v)}
    />
  </section>
{/if}

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

{#if showCaustics}
  <section class="group" aria-labelledby="caustics-heading">
    <h2 id="caustics-heading">Caustics (photon map)</h2>
    <Toggle
      label="Photon-mapped caustics"
      bind:checked={$params.causticsEnabled}
      hint="Light through the glass and off the mirror, traced from the lamp (Chapter 6)"
    />
    {#if $params.causticsEnabled}
      <Slider
        label="Photons"
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
        label="Search radius r"
        min={4}
        max={60}
        step={1}
        bind:value={$params.causticsRadius}
        format={(v) => `${v} units`}
        hint="Large r: smooth but blurry (bias). Small r: sharp but noisy (Example 5)"
      />
      {#if $causticsState.status === 'tracing'}
        <div class="solving" role="status">
          <span>Tracing photons… {$causticsState.pct}%</span>
          <div class="progress">
            <div class="bar" style:width="{$causticsState.pct}%"></div>
          </div>
        </div>
      {:else if $causticsState.status === 'error'}
        <p class="error">{$causticsState.error}</p>
      {:else if $causticsState.stats}
        <p class="hint">
          {$causticsState.stats.stored.toLocaleString('en-US')} caustic photons stored of
          {$causticsState.stats.emitted.toLocaleString('en-US')} · {Math.round(
            $causticsState.stats.ms,
          )} ms
        </p>
      {/if}
    {/if}
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
  <Toggle
    label="White balance"
    bind:checked={$params.whiteBalance}
    hint="Neutralize the orange measured light, like a camera"
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
