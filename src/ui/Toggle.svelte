<!--
  Labelled on/off switch. `hint` is shown under the label; `info` is a longer explanation behind
  an ⓘ button.
-->
<script>
  import Info from './Info.svelte';

  let { label, checked = $bindable(), hint = '', info = '' } = $props();

  const id = `toggle-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="toggle">
  <span class="text">
    <span class="label">
      <label for={id}>{label}</label>
      {#if info}<Info text={info} />{/if}
    </span>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </span>
  <input {id} type="checkbox" role="switch" bind:checked />
</div>

<style>
  .toggle {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
  }

  label {
    cursor: pointer;
  }

  .text {
    display: flex;
    flex-direction: column;
  }

  .label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
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
