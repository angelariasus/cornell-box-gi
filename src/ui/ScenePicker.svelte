<!-- Scene selector: classic Cornell box (two blocks) or the spheres scene. -->
<script>
  import { t } from '../i18n/index.js';
  import { params, SCENES, selectScene } from '../state/params.js';
</script>

<section class="group" aria-labelledby="scene-heading">
  <h2 id="scene-heading">{$t('scene.heading')}</h2>
  <div class="segmented" role="radiogroup" aria-labelledby="scene-heading">
    {#each SCENES as scene (scene.id)}
      <button
        type="button"
        role="radio"
        aria-checked={$params.scene === scene.id}
        class:active={$params.scene === scene.id}
        onclick={() => selectScene(scene.id)}
      >
        {$t(`scenes.${scene.id}.name`)}
      </button>
    {/each}
  </div>
  <p class="hint">{$t(`scenes.${$params.scene}.detail`)}</p>
</section>
