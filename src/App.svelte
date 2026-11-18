<script>
  import { onMount } from 'svelte';
  import { LANGUAGES, locale, t } from './i18n/index.js';
  import { createRenderer } from './render/renderer.js';
  import { CORNELL_SCALE, createScene } from './scene/cornell.js';
  import { params, rendererParams, stats, status } from './state/params.js';
  import { createCausticsController } from './state/caustics.js';
  import { createRadiosityController } from './state/radiosity.js';
  import Controls from './ui/Controls.svelte';
  import Hud from './ui/Hud.svelte';
  import MethodPicker from './ui/MethodPicker.svelte';
  import RayInspector from './ui/RayInspector.svelte';
  import ScenePicker from './ui/ScenePicker.svelte';
  import SplitDivider from './ui/SplitDivider.svelte';
  import Stats from './ui/Stats.svelte';
  import StatusBanner from './ui/StatusBanner.svelte';
  import ViewActions from './ui/ViewActions.svelte';

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
    <Hud />
    <ViewActions {renderer} />
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

    <div class="settings">
      <div class="pickers">
        <ScenePicker />
        <MethodPicker />
      </div>
      <Controls />
      <Stats />
    </div>
  </aside>
</main>

<style>
  .layout {
    display: grid;
    grid-template-columns: 1fr 360px;
    height: 100vh;
  }

  .viewport {
    position: relative;
    background: #000;
    min-height: 0;
    overflow: hidden;
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

  /* Fixed header; only the settings scroll. */
  .panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid var(--border);
    background: var(--panel);
  }

  header {
    padding: 0.9rem 1.25rem 0.8rem;
    border-bottom: 1px solid var(--border);
  }

  .title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  h1 {
    margin: 0;
    font-size: 1rem;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  header .hint {
    margin-top: 0.15rem;
  }

  .language {
    flex: none;
  }

  .language button {
    padding: 0.15rem 0.45rem;
    font-size: 0.72rem;
  }

  .settings {
    flex: 1;
    min-height: 0;
    padding: 0 1.25rem 1rem;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .pickers {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: 0.9rem 0 1rem;
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

    .settings {
      overflow: visible;
    }
  }
</style>
