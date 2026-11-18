<!-- Collapsible group of controls with an uppercase heading. -->
<script>
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
  let { title, open = $bindable(true), children } = $props();
</script>

<details class="section" bind:open>
  <summary>
    <h2>{title}</h2>
    <span class="chevron" aria-hidden="true">
      <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={1.8} />
    </span>
  </summary>
  <div class="group body">
    {@render children()}
  </div>
</details>

<style>
  .section {
    border-top: 1px solid var(--border);
  }

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 0;
    list-style: none;
    cursor: pointer;
    user-select: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary:hover h2,
  summary:hover .chevron {
    color: var(--fg);
  }

  summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 4px;
  }

  h2 {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
  }

  .chevron {
    display: grid;
    color: var(--muted);
    transform: rotate(-90deg);
    transition: transform 0.15s;
  }

  details[open] .chevron {
    transform: none;
  }

  .body {
    padding-bottom: 0.9rem;
  }
</style>
