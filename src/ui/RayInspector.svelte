<!--
  Ray inspector (report Figure 7): in Whitted mode, a click on the image (without dragging)
  computes the ray tree of that pixel with the same rules as the shader and draws it over the
  canvas. The tree lives in world space and is re-projected every frame, so it can be seen
  from another angle by orbiting the camera.
-->
<script>
  import { buildRayTree, flattenRayTree } from '../math/rayTree.js';
  import { params } from '../state/params.js';

  let { renderer, canvas } = $props();

  const COLORS = {
    primary: '#60a5fa',
    reflected: '#f59e0b',
    refracted: '#34d399',
    lit: '#fde047',
    blocked: '#ef4444',
  };
  const NEAR = 0.01; // clip segments that go behind the camera
  const CLICK_TOLERANCE = 4; // pixels a click may move and still count as a click

  const active = $derived($params.mode === 'whitted' && $params.rayInspector);

  let pixel = $state(null); // { x, y } in CSS pixels
  let pixelScene = $state(null);
  let tree = $state(null);
  let segments = $state([]);
  let points = $state([]);

  // Rebuild the tree when the pixel, the depth, the glass index or the scene change.
  $effect(() => {
    const scene = renderer?.getScene();
    if (!active || !pixel || !scene || scene.id !== $params.scene) {
      tree = null;
      return;
    }
    if (pixelScene !== scene.id) {
      pixel = null;
      return;
    }
    const ray = renderer.rayThroughCanvasPoint(pixel.x, pixel.y);
    tree = buildRayTree(scene, ray.origin, ray.dir, {
      maxDepth: $params.whittedDepth,
      ior: $params.glassIor,
    });
  });

  // Clicks on the canvas pick the pixel; drags orbit the camera as usual.
  $effect(() => {
    if (!active || !canvas) return;
    let down = null;
    const onDown = (e) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > CLICK_TOLERANCE) return;
      const box = canvas.getBoundingClientRect();
      pixel = { x: e.clientX - box.left, y: e.clientY - box.top };
      pixelScene = $params.scene;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
    };
  });

  // Re-project the tree every frame, so it follows the camera.
  $effect(() => {
    if (!tree) {
      segments = [];
      points = [];
      return;
    }
    const nodes = flattenRayTree(tree);
    let frameId = 0;
    const project = () => {
      const next = [];
      const hits = [];
      for (const node of nodes) {
        const style = {
          color: COLORS[node.kind],
          opacity: Math.max(0.3, Math.min(1, node.weight)),
        };
        const segment = clip(node.from, node.to);
        if (segment) next.push({ ...segment, ...style, dashed: false });
        if (node.hit) {
          const p = renderer.projectToCanvas(node.to);
          if (p.depth > NEAR) hits.push({ x: p.x, y: p.y, color: COLORS[node.kind] });
        }
        if (node.shadow && !node.shadow.facesAway) {
          const shadow = clip(node.to, node.shadow.to);
          const color = node.shadow.blocked ? COLORS.blocked : COLORS.lit;
          if (shadow) next.push({ ...shadow, color, opacity: 0.9, dashed: true });
        }
      }
      segments = next;
      points = hits;
      frameId = requestAnimationFrame(project);
    };
    project();
    return () => cancelAnimationFrame(frameId);
  });

  /** Screen segment between two world points, clipped against the camera's near plane. */
  function clip(a, b) {
    let pa = renderer.projectToCanvas(a);
    let pb = renderer.projectToCanvas(b);
    if (pa.depth <= NEAR && pb.depth <= NEAR) return null;
    if (pa.depth <= NEAR || pb.depth <= NEAR) {
      const t = (NEAR - pa.depth) / (pb.depth - pa.depth);
      const cut = a.map((v, i) => v + (b[i] - v) * t);
      const pc = renderer.projectToCanvas(cut.map((v, i) => v + (b[i] - a[i]) * 1e-4));
      if (pa.depth <= NEAR) pa = pc;
      else pb = pc;
    }
    return { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y };
  }

  const describe = (node) => {
    const label = node.kind[0].toUpperCase() + node.kind.slice(1);
    const digits = node.weight < 0.01 ? 3 : 2;
    const weight = node.depth > 0 ? ` (w ${node.weight.toFixed(digits)})` : '';
    const target = node.hit
      ? `${node.surface}${node.inside ? ', from inside' : ''}`
      : 'leaves the box';
    let shadow = '';
    if (node.shadow) {
      if (node.shadow.facesAway) shadow = ' · faces away from the light';
      else if (node.shadow.blocked) shadow = ` · shadow ray blocked by ${node.shadow.blocker}`;
      else shadow = ' · lit (shadow ray reaches the light)';
    }
    return `${label}${weight} → ${target}${shadow}`;
  };
</script>

{#if active}
  <svg class="overlay" aria-hidden="true">
    {#each segments as s, i (i)}
      <line
        x1={s.x1}
        y1={s.y1}
        x2={s.x2}
        y2={s.y2}
        stroke={s.color}
        stroke-opacity={s.opacity}
        stroke-width="2.5"
        stroke-dasharray={s.dashed ? '6 5' : null}
        stroke-linecap="round"
      />
    {/each}
    {#each points as p, i (i)}
      <circle cx={p.x} cy={p.y} r="4" fill={p.color} stroke="#000" stroke-width="1" />
    {/each}
  </svg>

  <div class="legend" role="status">
    <strong>Ray inspector</strong>
    {#if tree}
      <ol>
        {#each flattenRayTree(tree) as node, i (i)}
          <li style:padding-left="{node.depth * 0.8}rem" style:color={COLORS[node.kind]}>
            <span>{describe(node)}</span>
          </li>
        {/each}
      </ol>
    {:else}
      <p>Click a pixel to trace its rays.</p>
    {/if}
    <p class="key">
      <span style:color={COLORS.primary}>━ primary</span>
      <span style:color={COLORS.reflected}>━ reflected</span>
      <span style:color={COLORS.refracted}>━ refracted</span>
      <span style:color={COLORS.lit}>┅ shadow, lit</span>
      <span style:color={COLORS.blocked}>┅ shadow, blocked</span>
    </p>
  </div>
{/if}

<style>
  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .legend {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    max-width: min(30rem, calc(100% - 1.5rem));
    max-height: 45%;
    overflow: auto;
    padding: 0.55rem 0.75rem;
    border-radius: var(--radius);
    background: rgb(0 0 0 / 0.72);
    font-size: 0.78rem;
    pointer-events: auto;
  }

  ol {
    margin: 0.35rem 0;
    padding: 0;
    list-style: none;
  }

  li span {
    color: var(--fg);
  }

  li::before {
    content: '● ';
  }

  p {
    margin: 0.3rem 0 0;
  }

  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.7rem;
    font-size: 0.72rem;
  }
</style>
