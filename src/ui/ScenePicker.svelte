<!-- Scene selector: classic Cornell box (two blocks) or the spheres scene. -->
<script>
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { CubeIcon, SphereIcon } from '@hugeicons/core-free-icons';
  import { t } from '../i18n/index.js';
  import { params, SCENES, selectScene } from '../state/params.js';

  const ICONS = { classic: CubeIcon, spheres: SphereIcon };
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
        <span class="option">
          <HugeiconsIcon icon={ICONS[scene.id]} size={16} strokeWidth={1.6} aria-hidden="true" />
          {$t(`scenes.${scene.id}.name`)}
        </span>
      </button>
    {/each}
  </div>
  <p class="hint">{$t(`scenes.${$params.scene}.detail`)}</p>
</section>

<style>
  .option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }
</style>
