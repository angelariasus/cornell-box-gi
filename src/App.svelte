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

  const REPOSITORY_URL = 'https://github.com/angelariasus/cornell-box-gi';

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
        <div class="header-actions">
          <a
            class="repo"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={$t('app.sourceCode')}
          >
            <!-- GitHub mark (filled), not in the Hugeicons set used elsewhere. -->
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.683-.217.683-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.455-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.004.071 1.532 1.032 1.532 1.032.892 1.529 2.341 1.087 2.91.831.091-.647.349-1.087.636-1.337-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.987 1.029-2.687-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.295 2.748-1.026 2.748-1.026.546 1.378.203 2.397.1 2.65.64.7 1.028 1.594 1.028 2.687 0 3.848-2.338 4.695-4.566 4.943.359.31.678.92.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .269.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.523 2 12 2z"
              ></path>
            </svg>
            <span class="tip" aria-hidden="true">{$t('app.sourceCode')}</span>
          </a>
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: none;
  }

  /* Link to the repository: icon only, label on hover or keyboard focus. */
  .repo {
    position: relative;
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius);
    color: var(--muted);
  }

  .repo:hover {
    background: var(--surface-hover);
    color: var(--fg);
  }

  .repo:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .repo .tip {
    position: absolute;
    top: calc(100% + 0.45rem);
    right: 0;
    z-index: 2;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    background: rgb(0 0 0 / 0.85);
    color: var(--fg);
    font-size: 0.75rem;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.12s;
  }

  .repo:hover .tip,
  .repo:focus-visible .tip {
    opacity: 1;
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
