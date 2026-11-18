<!-- Short explanation of what is on screen, the report section it comes from and something to
     try. Doubles as a script for the presentation. -->
<script>
  import { t } from '../i18n/index.js';
  import { params } from '../state/params.js';

  // Texts live in the dictionaries under info.<method>; the tip depends on the scene.
  const key = $derived(`info.${$params.mode}`);
  const tip = $derived($t(`${key}.${$params.scene === 'spheres' ? 'tipSpheres' : 'tipClassic'}`));
</script>

{#if $params.mode}
  <section class="info" aria-live="polite">
    <h2>{$t(`${key}.title`)}</h2>
    <p>{$t(`${key}.text`)}</p>
    {#if tip}<p class="tip"><span>{$t('info.try')}</span> {tip}</p>{/if}
    <p class="source">{$t(`${key}.source`)}</p>
  </section>
{/if}

<style>
  .info {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.75rem 0.85rem;
    border-left: 3px solid var(--accent);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: 0.82rem;
  }

  h2 {
    margin: 0;
    font-size: 0.9rem;
  }

  p {
    margin: 0;
  }

  .tip span {
    color: var(--accent);
    font-weight: 600;
  }

  .source {
    color: var(--muted);
    font-size: 0.75rem;
  }
</style>
