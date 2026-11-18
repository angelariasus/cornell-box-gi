<!-- Labelled on/off switch with an optional hint. -->
<script>
  let { label, checked = $bindable(), hint = '' } = $props();
</script>

<label class="toggle">
  <span class="text">
    <span>{label}</span>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </span>
  <input type="checkbox" role="switch" bind:checked />
</label>

<style>
  .toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .text {
    display: flex;
    flex-direction: column;
  }

  input {
    appearance: none;
    flex: none;
    width: 2.1rem;
    height: 1.2rem;
    margin: 0;
    border-radius: 999px;
    background: var(--surface-hover);
    border: 1px solid var(--border);
    position: relative;
    cursor: pointer;
    transition: background 0.15s;
  }

  input::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 0.15rem;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    background: var(--muted);
    transform: translateY(-50%);
    transition:
      left 0.15s,
      background 0.15s;
  }

  input:checked {
    background: var(--accent-soft);
    border-color: var(--accent);
  }

  input:checked::after {
    left: calc(100% - 0.95rem);
    background: var(--accent);
  }

  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
