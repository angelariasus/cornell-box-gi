<script>
  import { onMount } from 'svelte';
  import { LANGUAGES, locale, t } from './i18n/index.js';
  import { createRenderer } from './render/renderer.js';
  import { CORNELL_SCALE, createScene } from './scene/cornell.js';
  import { params, rendererParams, stats, status } from './state/params.js';
  import { createCausticsController } from './state/caustics.js';
  import { createRadiosityController } from './state/radiosity.js';
  import Controls from './ui/Controls.svelte';
  import InfoBox from './ui/InfoBox.svelte';
  import MethodPicker from './ui/MethodPicker.svelte';
  import RayInspector from './ui/RayInspector.svelte';
  import ScenePicker from './ui/ScenePicker.svelte';
  import SplitDivider from './ui/SplitDivider.svelte';
  import Stats from './ui/Stats.svelte';
  import StatusBanner from './ui/StatusBanner.svelte';
  import Toolbar from './ui/Toolbar.svelte';

  let canvas = $state();
  let renderer = $state(null);

  onMount(() => {
    renderer = createRenderer(canvas, {
      onStats: (s) => stats.set(s),
      onStatus: (s) => status.set(s),
    });
    // Console access for testing on other machines, e.g. `viewer.benchmark(20)` or
    // `viewerParams.update((p) => ({ ...p, pathNextEvent: false }))`.
    window.viewer = renderer;
    window.viewerParams = params;

    const radiosity = createRadiosityController(renderer);
    const caustics = createCausticsController(renderer);

    let scene = null;
    let shownStep = null;
    const unsubscribe = params.subscribe((p) => {
      if (p.scene !== scene?.id) {
        scene = createScene(p.scene);
        renderer.setScene(scene);
      }
      renderer.setMode(p.mode);
      renderer.setParams(rendererParams(p));

      // Methods on screen: the main one, and the right side of the split screen.
      const modes = p.splitView ? [p.mode, p.splitMode] : [p.mode];

      // Radiosity is solved on demand.
      if (modes.includes('radiosity') && scene.supportsRadiosity) {
        radiosity.solve(scene, {
          patchesPerUnit: p.radiosityPatches,
          method: p.radiosityMethod,
          iterations: p.radiosityIterations,
        });
        if (p.radiosityStep !== shownStep) {
          shownStep = p.radiosityStep;
          radiosity.show(shownStep);
        }
      }

      // The caustic photon map is traced on demand for scenes with mirrors or glass.
      const usesCaustics = modes.some((m) => ['whitted', 'path', 'radiosity'].includes(m));
      if (usesCaustics && p.causticsEnabled && scene.spheres.length > 0) {
        caustics.trace(scene, {
          photons: p.causticsPhotons,
          radius: p.causticsRadius * CORNELL_SCALE,
          ior: p.glassIor,
        });
      }
    });

    return () => {
      unsubscribe();
      radiosity.dispose();
      caustics.dispose();
      renderer.dispose();
    };
  });
</script>

<main class="layout">
  <section class="viewport">
    <canvas bind:this={canvas} aria-label={$t('app.canvas')}></canvas>
    <SplitDivider />
    <RayInspector {renderer} {canvas} />
    <StatusBanner />
  </section>

  <aside class="panel">
    <header>
      <div class="title">
        <h1>{$t('app.title')}</h1>
        <div class="segmented language" role="radiogroup" aria-label={$t('app.language')}>
          {#each LANGUAGES as language (language)}
            <button
              type="button"
              role="radio"
              lang={language}
              aria-checked={$locale === language}
              class:active={$locale === language}
              onclick={() => locale.set(language)}
            >
              {language.toUpperCase()}
            </button>
          {/each}
        </div>
      </div>
      <p class="hint">{$t('app.subtitle')}</p>
    </header>

    <ScenePicker />
    <MethodPicker />
    <InfoBox />
    <Controls />
    <Toolbar {renderer} />
    <Stats />

    <footer class="hint">{$t('app.footer')}</footer>
  </aside>
</main>

<style>
  .layout {
    display: grid;
    grid-template-columns: 1fr 340px;
    height: 100vh;
  }

  .viewport {
    position: relative;
    background: #000;
    min-height: 0;
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
  }

  canvas:active {
    cursor: grabbing;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.25rem;
    border-left: 1px solid var(--border);
    background: var(--panel);
    overflow-y: auto;
  }

  .title {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  h1 {
    margin: 0 0 0.15rem;
    font-size: 1.1rem;
  }

  .language {
    flex: none;
  }

  .language button {
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
  }

  footer {
    margin-top: auto;
  }

  /* Narrow screens: the panel moves below the canvas. */
  @media (max-width: 800px) {
    .layout {
      grid-template-columns: 1fr;
      grid-template-rows: min(62vh, 100vw) auto;
      height: auto;
    }

    .panel {
      border-left: none;
      border-top: 1px solid var(--border);
    }
  }
</style>
