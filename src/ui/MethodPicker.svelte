<!-- Method selector. Methods that are not implemented yet, or that the scene cannot run
     (radiosity needs diffuse surfaces only), are disabled. -->
<script>
  import { METHODS, methodSupported, params } from '../state/params.js';

  const radiosityBlocked = $derived($params.scene !== 'classic');
</script>

<section class="group" aria-labelledby="method-heading">
  <h2 id="method-heading">Method</h2>
  <div class="methods" role="radiogroup" aria-labelledby="method-heading">
    {#each METHODS as method (method.id)}
      {@const enabled = methodSupported(method, $params.scene)}
      <label class="method" class:active={$params.mode === method.id} class:disabled={!enabled}>
        <input
          type="radio"
          name="method"
          value={method.id}
          bind:group={$params.mode}
          disabled={!enabled}
        />
        <span class="name">{method.name}</span>
        <span class="detail">{method.available ? method.detail : 'Coming soon'}</span>
      </label>
    {/each}
  </div>
  {#if radiosityBlocked}
    <p class="hint">Radiosity only supports diffuse surfaces (LD*E).</p>
  {/if}
</section>

<style>
  .methods {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .method {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.6rem;
    align-items: center;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    cursor: pointer;
  }

  .method:hover:not(.disabled) {
    background: var(--surface-hover);
  }

  .method.active {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .method.disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  input {
    grid-row: span 2;
    margin: 0;
  }

  .name {
    font-size: 0.9rem;
    font-weight: 600;
  }

  .detail {
    font-size: 0.75rem;
    color: var(--muted);
  }
</style>
