/**
 * Deterministic random numbers (mulberry32) for the CPU-side Monte Carlo code (form factors,
 * photon tracing). A fixed seed makes results reproducible, which the tests rely on.
 *
 * @param {number} seed
 * @returns {() => number} uniform numbers in [0, 1)
 */
export function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
