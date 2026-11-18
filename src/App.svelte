<script>
  import { onMount } from 'svelte';
  import { createRenderer } from './render/renderer.js';
  import { createScene } from './scene/cornell.js';
  import { params, rendererParams, stats, status } from './state/params.js';

  let canvas;
  let renderer = $state(null);

  onMount(() => {
    renderer = createRenderer(canvas, {
      onStats: (s) => stats.set(s),
      onStatus: (s) => status.set(s),
    });

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
    <canvas bind:this={canvas} aria-label="Render output"></canvas>
    {#if $status.state !== 'ready'}
      <div class="status" class:error={$status.state === 'error'}>
        {#if $status.state === 'compiling'}
          Compiling shaders…
        {:else if $status.state === 'no-webgl2'}
          This browser does not support WebGL2.
        {:else if $status.state === 'context-lost'}
          The graphics context was lost. Waiting for the browser to restore it…
        {:else if $status.state === 'error'}
          <pre>{$status.message}</pre>
        {/if}
      </div>
    {/if}
  </section>

  <!-- Temporary development panel (Phase 2). Replaced by the real panel in Phase 3. -->
  <aside class="panel">
    <h1>Global Illumination Viewer</h1>
    <p class="subtitle">Phase 2 · geometry check</p>

    <label>
      Scene
      <select bind:value={$params.scene}>
        <option value="classic">Classic (two blocks)</option>
        <option value="spheres">Spheres (mirror and glass)</option>
      </select>
    </label>

    <fieldset>
      <legend>Debug view</legend>
      <label><input type="radio" bind:group={$params.debugView} value="albedo" /> Materials</label>
      <label><input type="radio" bind:group={$params.debugView} value="normals" /> Normals</label>
    </fieldset>

    <label>
      Resolution scale: {$params.resolutionScale.toFixed(2)}
      <input type="range" min="0.25" max="1" step="0.05" bind:value={$params.resolutionScale} />
    </label>

    <button type="button" onclick={() => renderer?.resetCamera()}>Official camera</button>

    <dl class="stats">
      <dt>Samples</dt>
      <dd>{$stats.samples} / {$stats.maxSamples}</dd>
      <dt>Resolution</dt>
      <dd>{$stats.width} × {$stats.height}</dd>
      <dt>Frame time</dt>
      <dd>{$stats.converged ? 'idle' : `${$stats.frameMs.toFixed(1)} ms`}</dd>
      <dt>Buffer</dt>
      <dd>{$stats.format}</dd>
    </dl>

    <p class="hint">Drag to orbit · wheel or pinch to zoom</p>
  </aside>
</main>

<style>
  .layout {
    display: grid;
    grid-template-columns: 1fr 320px;
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

  .status {
    position: absolute;
    inset: auto 1rem 1rem 1rem;
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    background: rgb(0 0 0 / 0.75);
    font-size: 0.9rem;
  }

  .status.error {
    color: #ff8a80;
    max-height: 50%;
    overflow: auto;
  }

  .status pre {
    margin: 0;
    white-space: pre-wrap;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1.25rem;
    border-left: 1px solid var(--border);
    overflow-y: auto;
  }

  h1 {
    font-size: 1.15rem;
    margin: 0;
  }

  .subtitle,
  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }

  fieldset {
    border: 1px solid var(--border);
    border-radius: 6px;
    display: flex;
    gap: 1rem;
  }

  fieldset label {
    flex-direction: row;
    align-items: center;
  }

  .stats {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.2rem 0.8rem;
    margin: 0;
    font-size: 0.85rem;
  }

  .stats dt {
    color: var(--muted);
  }

  .stats dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 800px) {
    .layout {
      grid-template-columns: 1fr;
      grid-template-rows: 60vh auto;
      height: auto;
    }

    .panel {
      border-left: none;
      border-top: 1px solid var(--border);
    }
  }
</style>
