<!-- Camera reset, accumulation restart and PNG capture. -->
<script>
  import { params, stats } from '../state/params.js';

  let { renderer } = $props();

  async function saveImage() {
    const blob = await renderer?.capture();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cornell-${$params.scene}-${$params.mode}-${$stats.samples}spp.png`;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="toolbar">
  <button type="button" class="button" onclick={() => renderer?.resetCamera()}>
    Official camera
  </button>
  <button type="button" class="button" onclick={() => renderer?.restart()}>Restart</button>
  <button type="button" class="button" onclick={saveImage}>Save PNG</button>
</div>

<style>
  .toolbar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.4rem;
  }
</style>
