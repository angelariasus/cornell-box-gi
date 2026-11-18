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
  mode: 'debug',
  debugView: 'albedo',
  exposure: 1,
  resolutionScale: 1,
  samplesPerFrame: 1,
});

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

/** Settings passed to `renderer.setParams()`: everything except scene and mode. */
export function rendererParams({ scene, mode, ...rest }) {
  return rest;
}
