<!--
  Split screen divider: a draggable handle over the canvas and the name of the method on each
  side. Moving it only changes the display pass, so neither image loses its samples.
-->
<script>
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { ArrowLeftRightIcon } from '@hugeicons/core-free-icons';
  import { t } from '../i18n/index.js';
  import { params } from '../state/params.js';

  let container = $state();
  let dragging = $state(false);

  const nameOf = (id) => $t(`methods.${id}.name`);

  function moveTo(clientX) {
    const box = container.getBoundingClientRect();
    const position = (clientX - box.left) / box.width;
    $params.splitPosition = Math.min(0.95, Math.max(0.05, position));
  }

  function onPointerDown(event) {
    event.stopPropagation(); // do not orbit the camera
    try {
      event.currentTarget.setPointerCapture(event.pointerId); // keep dragging outside the handle
    } catch {
      // Synthetic or already released pointers cannot be captured; dragging still works.
    }
    dragging = true;
    moveTo(event.clientX);
  }

  function onPointerMove(event) {
    if (dragging) moveTo(event.clientX);
  }

  function onPointerUp() {
    dragging = false;
  }

  function onKeyDown(event) {
    const step = event.shiftKey ? 0.1 : 0.02;
    if (event.key === 'ArrowLeft')
      $params.splitPosition = Math.max(0.05, $params.splitPosition - step);
    if (event.key === 'ArrowRight')
      $params.splitPosition = Math.min(0.95, $params.splitPosition + step);
  }
</script>

{#if $params.splitView}
  <div class="split" bind:this={container}>
    <span class="label left" style:right="{(1 - $params.splitPosition) * 100}%">
      {nameOf($params.mode)}
    </span>
    <span class="label right" style:left="{$params.splitPosition * 100}%">
      {nameOf($params.splitMode)}
    </span>
    <div
      class="handle"
      class:dragging
      style:left="{$params.splitPosition * 100}%"
      role="slider"
      tabindex="0"
      aria-label={$t('compare.divider')}
      aria-valuemin="5"
      aria-valuemax="95"
      aria-valuenow={Math.round($params.splitPosition * 100)}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onkeydown={onKeyDown}
    >
      <span class="grip"><HugeiconsIcon icon={ArrowLeftRightIcon} size={14} strokeWidth={2} /></span
      >
    </div>
  </div>
{/if}

<style>
  .split {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .label {
    position: absolute;
    bottom: 4.6rem; /* above the progress card */
    padding: 0.2rem 0.55rem;
    margin: 0 0.6rem;
    border-radius: var(--radius);
    background: rgb(0 0 0 / 0.65);
    font-size: 0.78rem;
    white-space: nowrap;
  }

  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 24px;
    transform: translateX(-50%);
    cursor: ew-resize;
    pointer-events: auto;
    touch-action: none;
    display: grid;
    place-items: center;
  }

  .grip {
    display: grid;
    padding: 0.3rem;
    border-radius: 999px;
    background: #fff;
    color: #111;
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.5);
  }

  .handle:focus-visible .grip,
  .handle.dragging .grip {
    outline: 2px solid var(--accent);
  }
</style>
