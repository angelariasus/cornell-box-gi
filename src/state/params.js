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
  samplesPerFrame: 1,
  // Phong
  phongShininess: 32,
  phongSpecular: 0.1,
  phongAmbient: 0.05,
  // Whitted ray tracing
  whittedDepth: 5,
  glassIor: 1.5,
  // Path tracing
  pathMaxBounces: 8,
  pathMaxSamples: 4096,
  pathNextEvent: true,
  pathCosineSampling: true,
  pathRussianRoulette: true,
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
    available: false,
    diffuseOnly: true,
  },
]);

export const SCENES = Object.freeze([
  { id: 'classic', name: 'Classic', detail: 'Two blocks, all diffuse' },
  { id: 'spheres', name: 'Spheres', detail: 'Mirror, glass and checker floor' },
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

/** A method can run on a scene unless it needs diffuse-only geometry and the scene is not. */
export function methodSupported(method, sceneId) {
  return method.available && !(method.diffuseOnly && sceneId !== 'classic');
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
