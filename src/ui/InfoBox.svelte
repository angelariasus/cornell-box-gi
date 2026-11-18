<!-- Short explanation of what is on screen, the report section it comes from and something to
     try. Doubles as a script for the presentation. -->
<script>
  import { params } from '../state/params.js';

  const INFO = {
    phong: {
      title: 'Local illumination',
      text: 'Each point sees only the light, through one shadow ray. No light bounces between surfaces: the ceiling stays dark, shadows are hard and there is no color bleeding.',
      source: 'Report: Chapter 1, Example 1',
      try: {
        classic: 'Switch to Path tracing and watch the ceiling and the block sides light up.',
        spheres: 'The mirror and the glass reflect nothing: a local model cannot follow rays.',
      },
    },
    whitted: {
      title: 'Whitted ray tracing',
      text: 'Rays follow exact mirror reflection and refraction (Equation 4, Figure 8). Diffuse surfaces still use the local model, so it only captures LDS*E | LS*E paths.',
      source: 'Report: Chapter 3, Example 2',
      try: {
        classic: 'With only diffuse walls it looks exactly like Phong: no indirect light.',
        spheres:
          'Lower Max depth to 0 and 1, or set the glass index to 1.00. Photon-mapped caustics add the light Whitted misses.',
      },
    },
    path: {
      title: 'Path tracing',
      text: 'One random path per sample solves the rendering equation by Monte Carlo (Equation 10, Figure 14). It captures every path L(D|S)*E; the noise fades as 1/√N.',
      source: 'Report: Chapter 5, Example 4',
      try: {
        classic:
          'Turn next event estimation off, then switch to uniform sampling: same image, more noise.',
        spheres:
          'Look under the glass sphere: the caustic (LSDE) converges slowly. Then turn photon-mapped caustics on.',
      },
    },
    radiosity: {
      title: 'Radiosity',
      text: 'An energy balance between diffuse patches (Equation 6) solved as a linear system. The solution does not depend on the camera, but it only models LD*E paths.',
      source: 'Report: Chapter 4, Example 3',
      try: {
        classic:
          'Orbit the camera (nothing is recomputed), move Shown step, or turn smooth shading off.',
        spheres: '',
      },
    },
    debug: {
      title: 'Geometry debug view',
      text: 'Material colors or surface normals, without lighting. Used to check the Cornell box data.',
      source: 'Cornell Box Data (bowers.cornell.edu)',
      try: { classic: '', spheres: '' },
    },
  };

  const info = $derived(INFO[$params.mode]);
  const tip = $derived(info?.try[$params.scene]);
</script>

{#if info}
  <section class="info" aria-live="polite">
    <h2>{info.title}</h2>
    <p>{info.text}</p>
    {#if tip}<p class="tip"><span>Try:</span> {tip}</p>{/if}
    <p class="source">{info.source}</p>
  </section>
{/if}

<style>
  .info {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.75rem 0.85rem;
    border-left: 3px solid var(--accent);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: 0.82rem;
  }

  h2 {
    margin: 0;
    font-size: 0.9rem;
  }

  p {
    margin: 0;
  }

  .tip span {
    color: var(--accent);
    font-weight: 600;
  }

  .source {
    color: var(--muted);
    font-size: 0.75rem;
  }
</style>
