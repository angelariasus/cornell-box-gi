<!--
  "ⓘ" button that shows a longer explanation on hover, focus or tap. The text appears under the
  nearest positioned ancestor (the control's label row), across the full width of the panel.
-->
<script>
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { InformationCircleIcon } from '@hugeicons/core-free-icons';
  import { t } from '../i18n/index.js';

  let { text } = $props();

  let hovered = $state(false);
  let pinned = $state(false);
  let focused = $state(false);
  const open = $derived(hovered || pinned || focused);
  const id = `info-${Math.random().toString(36).slice(2, 9)}`;
  let button = $state();

  // Safari does not focus buttons on click, so a tapped explanation also closes on any tap
  // elsewhere.
  function closeOutside(event) {
    if (pinned && !button.contains(event.target)) pinned = false;
  }
</script>

<svelte:window onpointerdown={closeOutside} />

<button
  bind:this={button}
  type="button"
  class="info"
  class:open
  aria-label={$t('app.moreInfo')}
  aria-describedby={id}
  aria-expanded={open}
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
  onfocus={() => (focused = true)}
  onblur={() => ((focused = false), (pinned = false))}
  onclick={(event) => {
    event.preventDefault(); // inside a <label> this would toggle the control
    pinned = !pinned;
  }}
  onkeydown={(event) => {
    if (event.key === 'Escape') ((pinned = false), (focused = false), event.currentTarget.blur());
  }}
>
  <HugeiconsIcon icon={InformationCircleIcon} size={15} strokeWidth={1.6} aria-hidden="true" />
</button>
<span {id} role="tooltip" class="tip" class:open>{text}</span>

<style>
  .info {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 1.1rem;
    height: 1.1rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--muted);
    cursor: help;
    vertical-align: -0.2rem;
  }

  .info:hover,
  .info.open {
    color: var(--accent);
  }

  .info:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .tip {
    position: absolute;
    z-index: 5;
    top: calc(100% + 0.3rem);
    left: 0;
    right: 0;
    display: none;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-raised);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.45);
    color: var(--fg);
    font-size: 0.8rem;
    font-weight: 400;
    line-height: 1.45;
    text-transform: none;
    letter-spacing: normal;
    pointer-events: none;
  }

  .tip.open {
    display: block;
  }
</style>
