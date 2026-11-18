<!-- Floating buttons over the canvas: official camera, restart accumulation and PNG capture. -->
<script>
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { Camera01Icon, Download04Icon, RefreshIcon } from '@hugeicons/core-free-icons';
  import { t } from '../i18n/index.js';
  import { params, stats } from '../state/params.js';

  let { renderer } = $props();

  async function saveImage() {
    const blob = await renderer?.capture();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cornell-${$params.scene}-${$params.mode}-${$stats.samples}spp.png`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const ACTIONS = [
    {
      key: 'officialCamera',
      run: () => renderer?.resetCamera(),
      icon: Camera01Icon,
    },
    {
      key: 'restart',
      run: () => renderer?.restart(),
      icon: RefreshIcon,
    },
    {
      key: 'savePng',
      run: saveImage,
      icon: Download04Icon,
    },
  ];
</script>

<div class="actions" role="toolbar" aria-label={$t('toolbar.label')}>
  {#each ACTIONS as action (action.key)}
    <button type="button" onclick={action.run} aria-label={$t(`toolbar.${action.key}`)}>
      <HugeiconsIcon icon={action.icon} size={18} strokeWidth={1.6} aria-hidden="true" />
      <span class="tip" aria-hidden="true">{$t(`toolbar.${action.key}`)}</span>
    </button>
  {/each}
</div>

<style>
  .actions {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: flex;
    gap: 2px;
    padding: 3px;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: calc(var(--radius) + 2px);
    background: rgb(22 25 29 / 0.82);
    backdrop-filter: blur(6px);
  }

  button {
    position: relative;
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    padding: 0;
    border: none;
    border-radius: var(--radius);
    background: transparent;
    color: var(--fg);
    cursor: pointer;
  }

  button:hover {
    background: var(--surface-hover);
  }

  button:active {
    color: var(--accent);
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  /* Label under the button, shown on hover or keyboard focus. */
  .tip {
    position: absolute;
    top: calc(100% + 0.45rem);
    right: 0;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    background: rgb(0 0 0 / 0.85);
    font-size: 0.75rem;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.12s;
  }

  button:hover .tip,
  button:focus-visible .tip {
    opacity: 1;
  }
</style>
