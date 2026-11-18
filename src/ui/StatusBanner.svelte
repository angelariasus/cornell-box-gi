<!-- Renderer status shown over the canvas: compilation, errors and compatibility warnings. -->
<script>
  import { status } from '../state/params.js';

  let dismissedWarning = $state(false);

  const message = $derived.by(() => {
    switch ($status.state) {
      case 'idle':
      case 'compiling':
        return { kind: 'info', text: 'Compiling shaders…' };
      case 'no-webgl2':
        return { kind: 'error', text: 'This browser does not support WebGL2.' };
      case 'context-lost':
        return {
          kind: 'warning',
          text: 'The graphics context was lost. Waiting for the browser to restore it…',
        };
      case 'error':
        return { kind: 'error', text: $status.message, code: true };
      default:
        if ($status.format && $status.format !== 'float32' && !dismissedWarning) {
          return {
            kind: 'warning',
            text: `This device cannot render to 32-bit float buffers; using ${$status.format}. Images may show banding.`,
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
      <button type="button" aria-label="Dismiss" onclick={() => (dismissedWarning = true)}>×</button
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
