<!--
  Labelled range input with the current value shown on the right.
  `format` turns the slider value into the text shown (e.g. for logarithmic sliders).
-->
<script>
  let {
    label,
    value = $bindable(),
    min,
    max,
    step = 0.01,
    format = (v) => String(v),
    hint = '',
  } = $props();

  const id = `slider-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="slider">
  <div class="row">
    <label for={id}>{label}</label>
    <output for={id}>{format(value)}</output>
  </div>
  <input {id} type="range" {min} {max} {step} bind:value />
  {#if hint}<p class="hint">{hint}</p>{/if}
</div>

<style>
  .slider {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
  }

  output {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  input {
    width: 100%;
    margin: 0.2rem 0 0;
  }
</style>
