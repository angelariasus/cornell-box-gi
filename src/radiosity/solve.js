/**
 * The whole radiosity pipeline: patches → form factors → solver. Pure JavaScript, so it runs
 * both in the Web Worker (worker.js) and in the tests.
 */

import { computeFormFactors } from './formFactors.js';
import { buildPatches, patchArrays } from './patches.js';
import { gaussSeidel, jacobi, progressive } from './solvers.js';

export const RADIOSITY_METHODS = Object.freeze(['gauss-seidel', 'jacobi', 'progressive']);

/**
 * @param {object} scene  normalized scene from cornell.js (diffuse surfaces only)
 * @param {{patchesPerUnit?: number, method?: string, iterations?: number,
 *          samples?: number, nearSamples?: number}} options
 * @param {(progress: {phase: string, fraction: number}) => void} [onProgress]
 */
export function solveRadiosity(scene, options = {}, onProgress) {
  const {
    patchesPerUnit = 8,
    method = 'gauss-seidel',
    iterations = 24,
    samples = 4,
    nearSamples = 32,
  } = options;
  if (!RADIOSITY_METHODS.includes(method)) throw new Error(`Unknown radiosity method: ${method}`);

  const t0 = performance.now();
  onProgress?.({ phase: 'patches', fraction: 0 });
  const { patches, layout } = buildPatches(scene, patchesPerUnit);
  const { rho, E, A } = patchArrays(patches);
  const n = patches.length;

  const t1 = performance.now();
  const { F, maxRowSum } = computeFormFactors(scene, patches, {
    samples,
    nearSamples,
    onProgress: (fraction) => onProgress?.({ phase: 'formFactors', fraction }),
  });

  const t2 = performance.now();
  onProgress?.({ phase: 'solve', fraction: 0 });
  let result;
  if (method === 'jacobi') result = jacobi(F, rho, E, n, iterations);
  else if (method === 'gauss-seidel') result = gaussSeidel(F, rho, E, n, iterations);
  else result = progressive(F, rho, E, A, n, { maxShots: 4 * n });
  const t3 = performance.now();
  onProgress?.({ phase: 'solve', fraction: 1 });

  // Labels for the "shown iteration" control: iterations, or shots for the progressive method.
  const steps = result.shots ?? result.snapshots.map((_, k) => k);

  return {
    layout,
    snapshots: result.snapshots,
    steps,
    stepUnit: method === 'progressive' ? 'shots' : 'iterations',
    stats: {
      method,
      patchCount: n,
      maxRowSum,
      patchMs: t1 - t0,
      formFactorMs: t2 - t1,
      solveMs: t3 - t2,
    },
  };
}
