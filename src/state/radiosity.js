/**
 * Connects the radiosity worker, the renderer and the UI.
 *
 * - A new solve is requested only when something that changes the solution changes: the
 *   scene, patches per unit, the solver or the number of iterations. Orbiting the camera or
 *   switching between patch and interpolated views never recomputes it.
 * - The worker returns one snapshot per iteration; choosing which one to show just uploads it
 *   to the renderer (the "shown iteration" slider).
 * - Results of superseded requests are ignored.
 */

import { writable } from 'svelte/store';
import { irradianceFromRadiosity } from '../radiosity/patches.js';

export const radiosityState = writable({
  status: 'idle', // 'idle' | 'solving' | 'ready' | 'error'
  phase: null,
  pct: 0,
  steps: [],
  stepUnit: 'iterations',
  stats: null,
  error: null,
});

const PHASE_WEIGHT = { patches: [0, 2], formFactors: [2, 95], solve: [95, 100] };

/**
 * @param {{setRadiosity: Function}} renderer
 */
export function createRadiosityController(renderer) {
  const worker = new Worker(new URL('../radiosity/worker.js', import.meta.url), { type: 'module' });
  let requestId = 0;
  let requestKey = null;
  let requestScene = null; // scene id of the latest request
  let result = null; // last solution: { sceneId, layout, snapshots, steps, stepUnit, stats }
  let shownStep = -1;

  worker.onmessage = ({ data }) => {
    if (data.id !== requestId) return; // a newer request replaced this one
    if (data.type === 'progress') {
      const [from, to] = PHASE_WEIGHT[data.phase] ?? [0, 100];
      radiosityState.update((s) => ({
        ...s,
        phase: data.phase,
        pct: Math.round(from + ((to - from) * data.pct) / 100),
      }));
    } else if (data.type === 'result') {
      result = { ...data, sceneId: requestScene };
      radiosityState.set({
        status: 'ready',
        phase: null,
        pct: 100,
        steps: data.steps,
        stepUnit: data.stepUnit,
        stats: data.stats,
        error: null,
      });
      show(shownStep);
    } else if (data.type === 'error') {
      radiosityState.update((s) => ({ ...s, status: 'error', error: data.message }));
    }
  };

  /** Index of the snapshot to show; -1 (or anything past the end) means the last one. */
  function show(step) {
    shownStep = step;
    if (!result) return;
    const last = result.snapshots.length - 1;
    const index = step < 0 || step > last ? last : step;
    // The renderer shows L = rho(x) · H / π, so it receives irradiance H, not radiosity B.
    const H = irradianceFromRadiosity(result.snapshots[index], result.rho, result.E);
    renderer.setRadiosity(H, result.layout, result.sceneId);
  }

  /**
   * Requests a solution if the inputs changed since the last request.
   * @param {object} scene  normalized scene (must support radiosity)
   * @param {{patchesPerUnit: number, method: string, iterations: number}} options
   */
  function solve(scene, options) {
    const key = JSON.stringify([
      scene.id,
      options.patchesPerUnit,
      options.method,
      options.iterations,
    ]);
    if (key === requestKey) return;
    requestKey = key;
    requestId += 1;
    requestScene = scene.id;
    radiosityState.update((s) => ({
      ...s,
      status: 'solving',
      phase: 'patches',
      pct: 0,
      error: null,
    }));
    worker.postMessage({ type: 'solve', id: requestId, scene, ...options });
  }

  return {
    solve,
    show,
    dispose() {
      worker.terminate();
    },
  };
}
