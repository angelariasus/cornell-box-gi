<script>
  import { onMount } from 'svelte';
  import { createRenderer } from './render/renderer.js';
  import { createScene } from './scene/cornell.js';
  import { params, rendererParams, stats, status } from './state/params.js';
  import Controls from './ui/Controls.svelte';
  import MethodPicker from './ui/MethodPicker.svelte';
  import ScenePicker from './ui/ScenePicker.svelte';
  import Stats from './ui/Stats.svelte';
  import StatusBanner from './ui/StatusBanner.svelte';
  import Toolbar from './ui/Toolbar.svelte';

  let canvas;
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

    let sceneId = null;
    const unsubscribe = params.subscribe((p) => {
      if (p.scene !== sceneId) {
        sceneId = p.scene;
        renderer.setScene(createScene(p.scene));
      }
      renderer.setMode(p.mode);
      renderer.setParams(rendererParams(p));
    });

    return () => {
      unsubscribe();
      renderer.dispose();
    };
  });
</script>

<main class="layout">
  <section class="viewport">
    <canvas bind:this={canvas} aria-label="Rendered Cornell box. Drag to orbit, scroll to zoom."
    ></canvas>
    <StatusBanner />
  </section>

  <aside class="panel">
    <header>
      <h1>Global Illumination Viewer</h1>
      <p class="hint">The Cornell box rendered with four illumination methods</p>
    </header>

    <ScenePicker />
    <MethodPicker />
    <Controls />
    <Toolbar {renderer} />
    <Stats />

    <footer class="hint">Drag to orbit · scroll or pinch to zoom</footer>
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

  h1 {
    margin: 0 0 0.15rem;
    font-size: 1.1rem;
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
