<!-- Status shown at the top of the canvas: compilation, radiosity progress, errors and compatibility
     warnings. -->
<script>
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { Cancel01Icon } from '@hugeicons/core-free-icons';
  import { t } from '../i18n/index.js';
  import { params, status } from '../state/params.js';
  import { radiosityState } from '../state/radiosity.js';
  import { causticsState } from '../state/caustics.js';

  let dismissedWarning = $state(false);

  const message = $derived.by(() => {
    switch ($status.state) {
      case 'idle':
      case 'compiling':
        return { kind: 'info', text: $t('status.compiling') };
      case 'no-webgl2':
        return { kind: 'error', text: $t('status.noWebgl') };
      case 'context-lost':
        return {
          kind: 'warning',
          text: $t('status.contextLost'),
        };
      case 'error':
        return { kind: 'error', text: $status.message, code: true };
      default:
        if ($params.mode === 'radiosity' && $radiosityState.status === 'solving') {
          const what =
            $radiosityState.phase === 'formFactors'
              ? $t('radiosity.computingFormFactors')
              : $t('radiosity.solvingRadiosity');
          return { kind: 'info', text: `${what}… ${$radiosityState.pct}%` };
        }
        if ($params.causticsEnabled && $causticsState.status === 'tracing') {
          return { kind: 'info', text: `${$t('caustics.tracing')}… ${$causticsState.pct}%` };
        }
        if ($status.format && $status.format !== 'float32' && !dismissedWarning) {
          return {
            kind: 'warning',
            text: $t('status.lowPrecision', { format: $status.format }),
            dismissible: true,
          };
        }
        return null;
    }
  });
</script>

{#if message}
  <div
    class="banner overlay-card {message.kind}"
    role={message.kind === 'error' ? 'alert' : 'status'}
  >
    {#if message.code}
      <pre>{message.text}</pre>
    {:else}
      <span>{message.text}</span>
    {/if}
    {#if message.dismissible}
      <button
        type="button"
        aria-label={$t('status.dismiss')}
        onclick={() => (dismissedWarning = true)}
        ><HugeiconsIcon icon={Cancel01Icon} size={16} /></button
      >
    {/if}
  </div>
{/if}

<style>
  .banner {
    position: absolute;
    top: 0.75rem;
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: min(36rem, calc(100% - 16rem));
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.6rem 0.8rem;
    font-size: 0.88rem;
  }

  .banner.warning {
    color: var(--warning);
  }

  .banner.error {
    color: var(--danger);
    max-height: 50%;
    overflow: auto;
  }

  pre {
    margin: 0;
    white-space: pre-wrap;
    font-size: 0.8rem;
  }

  span {
    flex: 1;
  }

  button {
    display: grid;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
  }
</style>
