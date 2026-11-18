<!-- Status shown over the canvas: compilation, radiosity progress, errors and compatibility
     warnings. -->
<script>
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
  <div class="banner {message.kind}" role={message.kind === 'error' ? 'alert' : 'status'}>
    {#if message.code}
      <pre>{message.text}</pre>
    {:else}
      <span>{message.text}</span>
    {/if}
    {#if message.dismissible}
      <button
        type="button"
        aria-label={$t('status.dismiss')}
        onclick={() => (dismissedWarning = true)}>×</button
      >
    {/if}
  </div>
{/if}

<style>
  .banner {
    position: absolute;
    inset: auto 1rem 1rem 1rem;
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius);
    background: rgb(0 0 0 / 0.78);
    font-size: 0.88rem;
  }

  .banner.warning {
    color: var(--accent);
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
    border: none;
    background: none;
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
  }
</style>
