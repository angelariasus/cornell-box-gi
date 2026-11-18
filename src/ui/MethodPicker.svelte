<!--
  Method selector: a 2 × 2 grid of short names, with the full name and description of the chosen
  method underneath. In the spheres scene radiosity runs as a two-pass method with ray tracing,
  and its description says so.
-->
<script>
  import { t } from '../i18n/index.js';
  import { METHODS, methodSupported, params } from '../state/params.js';

  const current = $derived(METHODS.find((m) => m.id === $params.mode));
  const detailOf = (method) => {
    if (!method.available) return $t('method.comingSoon');
    if ($params.scene === 'spheres' && method.hasSpheresDetail)
      return $t(`methods.${method.id}.detailSpheres`);
    return $t(`methods.${method.id}.detail`);
  };
</script>

<section class="group" aria-labelledby="method-heading">
  <h2 id="method-heading">{$t('method.heading')}</h2>
  <div class="methods" role="radiogroup" aria-labelledby="method-heading">
    {#each METHODS as method (method.id)}
      {@const enabled = methodSupported(method, $params.scene)}
      <label
        class="method"
        class:active={$params.mode === method.id}
        class:disabled={!enabled}
        title={$t(`methods.${method.id}.name`)}
      >
        <input
          class="visually-hidden"
          type="radio"
          name="method"
          value={method.id}
          bind:group={$params.mode}
          disabled={!enabled}
          aria-describedby="method-detail"
        />
        {$t(`methods.${method.id}.short`)}
      </label>
    {/each}
  </div>
  <p id="method-detail" class="detail">
    {#if current}
      <strong>{$t(`methods.${current.id}.name`)}</strong> · {detailOf(current)}
    {:else}
      {$t(`methods.${$params.mode}.name`)}
    {/if}
  </p>
</section>

<style>
  .methods {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.35rem;
  }

  .method {
    display: grid;
    place-items: center;
    min-height: 2.5rem;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: 0.88rem;
    font-weight: 600;
    text-align: center;
    cursor: pointer;
    transition:
      background 0.12s,
      border-color 0.12s;
  }

  .method:hover:not(.disabled) {
    background: var(--surface-hover);
  }

  .method.active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }

  .method:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .method.disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .detail {
    margin: 0;
    font-size: 0.8rem;
    color: var(--muted);
  }

  strong {
    color: var(--fg);
    font-weight: 600;
  }
</style>
