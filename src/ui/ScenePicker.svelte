<!-- Scene selector: classic Cornell box (two blocks) or the spheres scene. -->
<script>
  import { params, SCENES, selectScene } from '../state/params.js';

  const current = $derived(SCENES.find((s) => s.id === $params.scene));
</script>

<section class="group" aria-labelledby="scene-heading">
  <h2 id="scene-heading">Scene</h2>
  <div class="segmented" role="radiogroup" aria-labelledby="scene-heading">
    {#each SCENES as scene (scene.id)}
      <button
        type="button"
        role="radio"
        aria-checked={$params.scene === scene.id}
        class:active={$params.scene === scene.id}
        onclick={() => selectScene(scene.id)}
      >
        {scene.name}
      </button>
    {/each}
  </div>
  <p class="hint">{current?.detail}</p>
</section>
