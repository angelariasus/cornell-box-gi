/**
 * Connects the photon worker, the renderer and the UI (same pattern as radiosity.js).
 * A new photon map is traced only when the scene, the number of photons, the search radius or
 * the glass index change; results of superseded requests are ignored.
 */

import { writable } from 'svelte/store';

export const causticsState = writable({
  status: 'idle', // 'idle' | 'tracing' | 'ready' | 'error'
  pct: 0,
  stats: null,
  error: null,
});

/**
 * @param {{setCaustics: Function}} renderer
 */
export function createCausticsController(renderer) {
  const worker = new Worker(new URL('../photons/worker.js', import.meta.url), { type: 'module' });
  let requestId = 0;
  let requestKey = null;
  let requestScene = null;

  worker.onmessage = ({ data }) => {
    if (data.id !== requestId) return; // a newer request replaced this one
    if (data.type === 'progress') {
      causticsState.update((s) => ({ ...s, pct: data.pct }));
    } else if (data.type === 'result') {
      renderer.setCaustics(data.irradiance, data.layout, requestScene);
      causticsState.set({ status: 'ready', pct: 100, stats: data.stats, error: null });
    } else if (data.type === 'error') {
      causticsState.update((s) => ({ ...s, status: 'error', error: data.message }));
    }
  };

  /**
   * @param {object} scene  normalized scene
   * @param {{photons: number, radius: number, ior: number}} options
   */
  function trace(scene, options) {
    const key = JSON.stringify([scene.id, options.photons, options.radius, options.ior]);
    if (key === requestKey) return;
    requestKey = key;
    requestId += 1;
    requestScene = scene.id;
    causticsState.update((s) => ({ ...s, status: 'tracing', pct: 0, error: null }));
    worker.postMessage({ type: 'trace', id: requestId, scene, ...options });
  }

  return {
    trace,
    dispose() {
      worker.terminate();
    },
  };
}
