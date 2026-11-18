/**
 * Svelte stores shared by the UI and the renderer.
 *
 * - `params`: what the user chose (scene, method and per-method settings). The renderer
 *   reads it; the UI writes it.
 * - `stats`: what the renderer reports back (samples, resolution, frame time).
 * - `status`: renderer state ("compiling", "ready", errors and warnings).
 */

import { writable } from 'svelte/store';

export const DEFAULT_PARAMS = Object.freeze({
  scene: 'classic',
  mode: 'phong',
  exposure: 1.5,
  whiteBalance: true,
  resolutionScale: 1,
  samplesPerFrame: 0, // 0 = adaptive (fills each frame up to ~30 fps)
  // Phong
  phongShininess: 32,
  phongSpecular: 0.1,
  phongAmbient: 0.05,
  // Whitted ray tracing
  whittedDepth: 5,
  glassIor: 1.5,
  rayInspector: false, // click a pixel to draw its ray tree (Figure 7)
  // Path tracing
  pathMaxBounces: 8,
  pathMaxSamples: 4096,
  pathNextEvent: true,
  pathCosineSampling: true,
  pathRussianRoulette: true,
  // Radiosity
  radiosityPatches: 8,
  radiosityMethod: 'gauss-seidel',
  radiosityIterations: 24,
  radiosityStep: -1, // snapshot shown; -1 = the last one (converged)
  radiosityInterpolate: true,
  // Photon-mapped caustics (spheres scene, Whitted and path tracing)
  causticsEnabled: false,
  causticsPhotons: 500_000,
  causticsRadius: 15, // search radius r in data units (Example 5)
  // Split screen: a second method to the right of a draggable divider
  splitView: false,
  splitMode: 'path',
  splitPosition: 0.5, // fraction of the width
  // Debug view
  debugView: 'albedo',
});

/** Methods shown in the picker, in the order of the report. */
export const METHODS = Object.freeze([
  {
    id: 'phong',
    name: 'Phong',
    detail: 'Local model · Chapter 1',
    available: true,
  },
  {
    id: 'whitted',
    name: 'Whitted ray tracing',
    detail: 'Reflection and refraction · Chapter 3',
    available: true,
  },
  {
    id: 'path',
    name: 'Path tracing',
    detail: 'Monte Carlo global illumination · Chapter 5',
    available: true,
  },
  {
    id: 'radiosity',
    name: 'Radiosity',
    detail: 'Diffuse interreflection · Chapter 4',
    detailSpheres: 'Two-pass with ray tracing · Section 7.1',
    available: true,
  },
]);

export const SCENES = Object.freeze([
  { id: 'classic', name: 'Classic', detail: 'Two blocks, all diffuse' },
  { id: 'spheres', name: 'Spheres', detail: 'Mirror and glass spheres' },
]);

export const params = writable({ ...DEFAULT_PARAMS });

export const stats = writable({
  mode: DEFAULT_PARAMS.mode,
  samples: 0,
  maxSamples: 0,
  converged: false,
  width: 0,
  height: 0,
  frameMs: 0,
  format: '',
});

export const status = writable({ state: 'idle' });

/**
 * Every implemented method runs on both scenes (radiosity as a two-pass method with ray tracing
 * in the spheres scene). Kept as a hook in case a future method or scene needs a restriction.
 */
export function methodSupported(method, sceneId) {
  return method.available && Boolean(sceneId);
}

/** Switches scene; a method the new scene cannot run falls back to Phong. */
export function selectScene(sceneId) {
  params.update((p) => {
    const method = METHODS.find((m) => m.id === p.mode);
    const mode = method && !methodSupported(method, sceneId) ? 'phong' : p.mode;
    return { ...p, scene: sceneId, mode };
  });
}

/** Settings passed to `renderer.setParams()`: everything except scene and mode. */
export function rendererParams({ scene, mode, ...rest }) {
  return rest;
}
