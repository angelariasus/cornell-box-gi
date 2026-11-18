/**
 * Radiosity solvers (report Chapter 4, Section 4.3).
 *
 * All of them solve the radiosity equation (Equation 6)
 *
 *   B_i = E_i + rho_i * sum_j F_ij * B_j
 *
 * for n patches and any number of color channels. Data layout:
 * - `F`: Float64Array or Float32Array of n * n, row-major, F[i * n + j] = F_ij
 * - `rho`, `E`: arrays of n * channels (patch-major: rho[i * channels + c])
 *
 * Each solver returns snapshots of B (Float32Array of n * channels): snapshot 0 is B = E,
 * as in row 0 of Table 2, and one snapshot follows every iteration (or group of shots for the
 * progressive method), so the UI can show how the solution converges.
 */

const channelsOf = (E, n) => E.length / n;

/**
 * Jacobi iteration: every patch is updated from the values of the previous iteration.
 * @returns {{snapshots: Float32Array[]}}
 */
export function jacobi(F, rho, E, n, iterations) {
  const channels = channelsOf(E, n);
  let B = Float64Array.from(E);
  const snapshots = [Float32Array.from(B)];
  for (let it = 0; it < iterations; it++) {
    const next = new Float64Array(B.length);
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < channels; c++) {
        let gathered = 0;
        for (let j = 0; j < n; j++) gathered += F[i * n + j] * B[j * channels + c];
        next[i * channels + c] = E[i * channels + c] + rho[i * channels + c] * gathered;
      }
    }
    B = next;
    snapshots.push(Float32Array.from(B));
  }
  return { snapshots };
}

/**
 * Gauss-Seidel iteration: patches are updated in order and each update already uses the
 * values computed earlier in the same iteration, so it converges faster than Jacobi.
 * Hearn et al. (2014, p. 652) use this method.
 */
export function gaussSeidel(F, rho, E, n, iterations) {
  const channels = channelsOf(E, n);
  const B = Float64Array.from(E);
  const snapshots = [Float32Array.from(B)];
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < channels; c++) {
        let gathered = 0;
        for (let j = 0; j < n; j++) gathered += F[i * n + j] * B[j * channels + c];
        B[i * channels + c] = E[i * channels + c] + rho[i * channels + c] * gathered;
      }
    }
    snapshots.push(Float32Array.from(B));
  }
  return { snapshots };
}

/**
 * Progressive refinement radiosity (Cohen et al. 1988), report Figure 11. At each step the
 * patch with the most unshot energy (ΔB_i · A_i) shoots it to every other patch j:
 *
 *   ΔR = rho_j · ΔB_i · F_ij · A_i / A_j        (reciprocity: F_ji = F_ij · A_i / A_j)
 *
 * Snapshots are taken after 1, 2, 4, 8, ... shots, so the first image appears at once and
 * later ones show the solution filling in. Stops after `maxShots` shots or when the largest
 * unshot energy falls below `epsilon` times the initial one.
 *
 * @returns {{snapshots: Float32Array[], shots: number[]}}  shots[k] = shots before snapshot k
 */
export function progressive(F, rho, E, A, n, { maxShots = 4 * n, epsilon = 1e-4 } = {}) {
  const channels = channelsOf(E, n);
  const B = Float64Array.from(E);
  const unshot = Float64Array.from(E);
  const snapshots = [Float32Array.from(B)];
  const shots = [0];

  const energy = (i) => {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += unshot[i * channels + c];
    return sum * A[i];
  };
  let initial = 0;
  for (let i = 0; i < n; i++) initial = Math.max(initial, energy(i));

  let nextSnapshot = 1;
  for (let shot = 1; shot <= maxShots; shot++) {
    let source = 0;
    let best = -1;
    for (let i = 0; i < n; i++) {
      const e = energy(i);
      if (e > best) {
        best = e;
        source = i;
      }
    }
    if (best <= epsilon * initial) {
      if (shots[shots.length - 1] !== shot - 1) {
        snapshots.push(Float32Array.from(B));
        shots.push(shot - 1);
      }
      break;
    }

    for (let j = 0; j < n; j++) {
      if (j === source) continue;
      const factor = (F[source * n + j] * A[source]) / A[j];
      if (factor === 0) continue;
      for (let c = 0; c < channels; c++) {
        const delta = rho[j * channels + c] * unshot[source * channels + c] * factor;
        unshot[j * channels + c] += delta;
        B[j * channels + c] += delta;
      }
    }
    for (let c = 0; c < channels; c++) unshot[source * channels + c] = 0;

    if (shot === nextSnapshot || shot === maxShots) {
      snapshots.push(Float32Array.from(B));
      shots.push(shot);
      nextSnapshot *= 2;
    }
  }
  return { snapshots, shots };
}
