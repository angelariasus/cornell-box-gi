<!-- Collapsible group of controls with an uppercase heading. -->
<script>
  let { title, open = $bindable(true), children } = $props();
</script>

<details class="section" bind:open>
  <summary>
    <h2>{title}</h2>
    <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 6.5l3 3 3-3" /></svg>
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
    stroke: var(--fg);
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
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .chevron {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
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
