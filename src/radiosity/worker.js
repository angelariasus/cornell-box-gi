/**
 * Web Worker that runs the radiosity pipeline off the main thread (PLAN.md, section 3.5).
 *
 * In:   { type: 'solve', id, scene, patchesPerUnit, method, iterations }
 * Out:  { type: 'progress', id, phase, pct }
 *       { type: 'result', id, layout, snapshots, steps, stepUnit, stats }
 *       { type: 'error', id, message }
 * `id` lets the page ignore results of a request that was superseded.
 */

import { solveRadiosity } from './solve.js';

self.onmessage = (event) => {
  const { type, id, scene, ...options } = event.data;
  if (type !== 'solve') return;
  try {
    let lastPct = -1;
    const result = solveRadiosity(scene, options, ({ phase, fraction }) => {
      const pct = Math.round(fraction * 100);
      if (pct !== lastPct || phase !== 'formFactors') {
        lastPct = pct;
        self.postMessage({ type: 'progress', id, phase, pct });
      }
    });
    self.postMessage(
      { type: 'result', id, ...result },
      result.snapshots.map((s) => s.buffer), // transfer, do not copy
    );
  } catch (error) {
    self.postMessage({ type: 'error', id, message: String(error?.message ?? error) });
  }
};
