<script>
  // Phase 0 placeholder. The canvas is wired to the renderer in Phase 2
  // and the control panel is built in Phase 3.
</script>

<main class="layout">
  <section class="viewport">
    <canvas aria-label="Render output"></canvas>
  </section>

  <aside class="panel">
    <h1>Global Illumination Viewer</h1>
    <p class="subtitle">Cornell box · Phong · Whitted · Path tracing · Radiosity</p>
    <p class="note">Project scaffold ready. Rendering starts in Phase 2.</p>
  </aside>
</main>

<style>
  .layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    height: 100vh;
  }

  .viewport {
    display: grid;
    place-items: center;
    background: #000;
    min-height: 0;
  }

  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .panel {
    padding: 1.25rem;
    border-left: 1px solid var(--border);
    overflow-y: auto;
  }

  h1 {
    font-size: 1.15rem;
    margin: 0 0 0.25rem;
  }

  .subtitle {
    margin: 0 0 1rem;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .note {
    font-size: 0.9rem;
  }

  /* Narrow screens: the panel moves below the canvas. */
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
