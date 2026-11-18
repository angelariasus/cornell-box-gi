/**
 * Report Example 3 (Section 4.8): radiosity of the faces of a long duct with a regular
 * pentagonal cross-section. Face 1 emits E1 = 100 W/m² with rho1 = 0.5; faces 2–5 have
 * rho = 0.7. Form factors: adjacent faces Fc = (3 − √5)/4, opposite faces Fn = (√5 − 1)/4.
 *
 * Table 2 of the report was computed with the reduced system of three equations
 * (B5 = B2, B4 = B3), in the order B1, B2, B3. These tests must reproduce it exactly.
 */
import { describe, expect, it } from 'vitest';
import { gaussSeidel, jacobi, progressive } from '../src/radiosity/solvers.js';

const Fc = (3 - Math.sqrt(5)) / 4;
const Fn = (Math.sqrt(5) - 1) / 4;

// Reduced system: B_i = E_i + rho_i * sum_j K_ij B_j for (B1, B2, B3).
//   B1 = 100 + 0.5 (2 Fc B2 + 2 Fn B3)
//   B2 = 0.7 (Fc B1 + Fn B2 + (Fc + Fn) B3)
//   B3 = 0.7 (Fn B1 + (Fc + Fn) B2 + Fc B3)
const K = [0, 2 * Fc, 2 * Fn, Fc, Fn, Fc + Fn, Fn, Fc + Fn, Fc];
const rho = [0.5, 0.7, 0.7];
const E = [100, 0, 0];

// Table 2 of the report (W/m², two decimals). Rows: iterations 0 to 8.
const TABLE_2 = {
  jacobi: [
    [100.0, 0.0, 0.0],
    [100.0, 13.37, 21.63],
    [109.24, 23.83, 29.2],
    [113.58, 29.98, 35.87],
    [116.81, 34.22, 39.86],
    [118.85, 36.97, 42.57],
    [120.22, 38.79, 44.34],
    [121.11, 39.98, 45.51],
    [121.7, 40.77, 46.27],
  ],
  gaussSeidel: [
    [100.0, 0.0, 0.0],
    [100.0, 13.37, 26.31],
    [110.68, 26.9, 36.87],
    [116.53, 34.3, 42.14],
    [119.57, 38.16, 44.85],
    [121.15, 40.15, 46.25],
    [121.96, 41.18, 46.98],
    [122.38, 41.71, 47.35],
    [122.6, 41.99, 47.54],
  ],
  exact: [122.83, 42.28, 47.75],
};

const round2 = (x) => Math.round(x * 100) / 100;

describe('Report Table 2: Jacobi and Gauss-Seidel on the pentagon', () => {
  it('Jacobi reproduces every row of Table 2', () => {
    const { snapshots } = jacobi(K, rho, E, 3, 8);
    snapshots.forEach((B, row) => expect([...B].map(round2)).toEqual(TABLE_2.jacobi[row]));
  });

  it('Gauss-Seidel reproduces every row of Table 2', () => {
    const { snapshots } = gaussSeidel(K, rho, E, 3, 8);
    snapshots.forEach((B, row) => expect([...B].map(round2)).toEqual(TABLE_2.gaussSeidel[row]));
  });

  it('both converge to the exact solution 122.83 / 42.28 / 47.75', () => {
    for (const solve of [jacobi, gaussSeidel]) {
      const { snapshots } = solve(K, rho, E, 3, 80);
      expect([...snapshots.at(-1)].map(round2)).toEqual(TABLE_2.exact);
    }
  });

  it('Gauss-Seidel is closer to the solution than Jacobi after every iteration', () => {
    const j = jacobi(K, rho, E, 3, 8).snapshots;
    const g = gaussSeidel(K, rho, E, 3, 8).snapshots;
    const error = (B) => Math.max(...B.map((b, i) => Math.abs(b - TABLE_2.exact[i])));
    for (let it = 2; it <= 8; it++) expect(error(g[it])).toBeLessThan(error(j[it]));
  });
});

describe('Full five-face pentagon', () => {
  // F_ij for the 5 faces: 0 to itself, Fc to the two neighbours, Fn to the two opposite faces.
  const n = 5;
  const F = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const d = Math.min((i - j + n) % n, (j - i + n) % n);
      F[i * n + j] = d === 0 ? 0 : d === 1 ? Fc : Fn;
    }
  }
  const rho5 = [0.5, 0.7, 0.7, 0.7, 0.7];
  const E5 = [100, 0, 0, 0, 0];
  const A5 = [1, 1, 1, 1, 1];
  const expected = [122.83, 42.28, 47.75, 47.75, 42.28];

  it('closure: every face sends all its light to the other faces (2 Fc + 2 Fn = 1)', () => {
    expect(2 * Fc + 2 * Fn).toBeCloseTo(1, 12);
  });

  it('Gauss-Seidel on all five faces gives the same solution as the reduced system', () => {
    const { snapshots } = gaussSeidel(F, rho5, E5, n, 80);
    expect([...snapshots.at(-1)].map(round2)).toEqual(expected);
  });

  it('progressive refinement, step 4: the first shot gives ΔB = 13.37 and 21.63', () => {
    const { snapshots, shots } = progressive(F, rho5, E5, A5, n, { maxShots: 1 });
    expect(shots).toEqual([0, 1]);
    expect([...snapshots[1]].map(round2)).toEqual([100, 13.37, 21.63, 21.63, 13.37]);
  });

  it('progressive refinement converges to the same solution', () => {
    const { snapshots } = progressive(F, rho5, E5, A5, n, { maxShots: 500, epsilon: 1e-9 });
    expect([...snapshots.at(-1)].map(round2)).toEqual(expected);
  });

  it('works per color channel', () => {
    const rgb = (values) => values.flatMap((v) => [v, v, v]);
    const { snapshots } = gaussSeidel(F, rgb(rho5), rgb(E5), n, 80);
    expect([...snapshots.at(-1)].map(round2)).toEqual(rgb(expected));
  });
});
