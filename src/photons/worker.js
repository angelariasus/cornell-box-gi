/**
 * Web Worker that traces the caustic photon map off the main thread (PLAN.md, section 3.5).
 *
 * In:   { type: 'trace', id, scene, photons, radius, ior }
 * Out:  { type: 'progress', id, pct }
 *       { type: 'result', id, layout, irradiance, stats }
 *       { type: 'error', id, message }
 */

import { traceCaustics } from './trace.js';

self.onmessage = (event) => {
  const { type, id, scene, ...options } = event.data;
  if (type !== 'trace') return;
  try {
    let lastPct = -1;
    const result = traceCaustics(scene, options, (fraction) => {
      const pct = Math.round(fraction * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        self.postMessage({ type: 'progress', id, pct });
      }
    });
    self.postMessage({ type: 'result', id, ...result }, [result.irradiance.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', id, message: String(error?.message ?? error) });
  }
};
