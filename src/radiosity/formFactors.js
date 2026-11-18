/**
 * Patch-to-patch form factors (report Equation 7):
 *
 *   F_ij = (1 / A_i) ∫_Ai ∫_Aj cos(θi) cos(θj) / (π r²) · V_ij dA_j dA_i
 *
 * The inner integral over patch j is computed exactly with the point-to-polygon form factor
 * (Lambert's contour formula), after clipping patch j to the hemisphere above the point. Only
 * the outer integral (random points x on patch i) and the visibility term (rays from x to
 * random points on j) are sampled:
 *
 *   F_ij ≈ mean over samples of  F(x → polygon j) · V(x, y)
 *
 * Sampling the full double integral instead has enormous variance for patches that share an
 * edge (corners of the room, block bases), where cos θi cos θj / r² blows up.
 *
 * Every row i uses the same stratified points x for all patches j: for a fixed x the point
 * form factors to the visible polygons add up to at most 1, which keeps each row close to
 * energy conservation. Two final steps then make the matrix consistent:
 *   1. reciprocity (Equation 8): A_i F_ij and A_j F_ji are averaged, so it holds exactly;
 *   2. energy conservation: the few rows that visibility noise pushes above 1 are scaled
 *      back to 1 (`maxRowSum` reports the largest sum before this step).
 *
 * Visibility uses the same ray-quad and ray-sphere tests as math.js, written with plain
 * numbers because this loop runs millions of times.
 */

/** Deterministic random numbers (mulberry32), so results are reproducible. */
function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

/** Precomputed blockers: one entry per quad and per sphere. */
function buildBlockers(scene) {
  const quads = scene.quads.map((q) => {
    const [ux, uy, uz] = q.u;
    const [vx, vy, vz] = q.v;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const nn = nx * nx + ny * ny + nz * nz;
    return {
      o: q.origin,
      ux,
      uy,
      uz,
      vx,
      vy,
      vz,
      nx,
      ny,
      nz,
      wx: nx / nn,
      wy: ny / nn,
      wz: nz / nn,
    };
  });
  const spheres = scene.spheres.map((s) => ({ c: s.center, r2: s.radius * s.radius }));
  return { quads, spheres };
}

const T_EPSILON = 1e-6;

/** Does anything block the open segment p + t·d, t ∈ (0, 1)? */
function segmentBlocked(blockers, px, py, pz, dx, dy, dz) {
  for (const q of blockers.quads) {
    const denom = q.nx * dx + q.ny * dy + q.nz * dz;
    if (denom > -1e-14 && denom < 1e-14) continue;
    const t = (q.nx * (q.o[0] - px) + q.ny * (q.o[1] - py) + q.nz * (q.o[2] - pz)) / denom;
    if (t <= T_EPSILON || t >= 1 - T_EPSILON) continue;
    const hx = px + t * dx - q.o[0];
    const hy = py + t * dy - q.o[1];
    const hz = pz + t * dz - q.o[2];
    // s = w · (planar × v), tt = w · (u × planar)
    const s =
      q.wx * (hy * q.vz - hz * q.vy) +
      q.wy * (hz * q.vx - hx * q.vz) +
      q.wz * (hx * q.vy - hy * q.vx);
    if (s < 0 || s > 1) continue;
    const tt =
      q.wx * (q.uy * hz - q.uz * hy) +
      q.wy * (q.uz * hx - q.ux * hz) +
      q.wz * (q.ux * hy - q.uy * hx);
    if (tt >= 0 && tt <= 1) return true;
  }
  for (const s of blockers.spheres) {
    const ox = px - s.c[0];
    const oy = py - s.c[1];
    const oz = pz - s.c[2];
    const a = dx * dx + dy * dy + dz * dz;
    const b = ox * dx + oy * dy + oz * dz;
    const c = ox * ox + oy * oy + oz * oz - s.r2;
    const disc = b * b - a * c;
    if (disc < 0) continue;
    const root = Math.sqrt(disc);
    const t1 = (-b - root) / a;
    const t2 = (-b + root) / a;
    if ((t1 > T_EPSILON && t1 < 1 - T_EPSILON) || (t2 > T_EPSILON && t2 < 1 - T_EPSILON)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Point-to-polygon form factor
// ---------------------------------------------------------------------------

/**
 * Exact form factor from a differential area at `x` with unit normal `n` to a planar polygon
 * (Lambert's formula), ignoring occlusion:
 *
 *   F = (1 / 2π) Σ_k  γ_k · (n · (a_k × a_{k+1}) / |a_k × a_{k+1}|)
 *
 * where a_k are unit vectors from x to the vertices and γ_k the angle between consecutive
 * ones. The polygon is first clipped to the half-space in front of x, because the formula
 * only holds for the part of the polygon above the tangent plane.
 *
 * @param {number[]} x
 * @param {number[]} n
 * @param {number[][]} polygon  vertices in order
 */
export function pointToPolygonFormFactor(x, n, polygon) {
  // Clip against n · (p − x) ≥ 0 (Sutherland–Hodgman with one plane).
  const clipped = [];
  const side = polygon.map(
    (p) => n[0] * (p[0] - x[0]) + n[1] * (p[1] - x[1]) + n[2] * (p[2] - x[2]),
  );
  for (let k = 0; k < polygon.length; k++) {
    const next = (k + 1) % polygon.length;
    const a = polygon[k];
    const b = polygon[next];
    if (side[k] >= 0) clipped.push(a);
    if (side[k] >= 0 !== side[next] >= 0) {
      const t = side[k] / (side[k] - side[next]);
      clipped.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]);
    }
  }
  if (clipped.length < 3) return 0;

  const dirs = clipped.map((p) => {
    const dx = p[0] - x[0];
    const dy = p[1] - x[1];
    const dz = p[2] - x[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    return [dx / len, dy / len, dz / len];
  });

  let sum = 0;
  for (let k = 0; k < dirs.length; k++) {
    const a = dirs[k];
    const b = dirs[(k + 1) % dirs.length];
    const cx = a[1] * b[2] - a[2] * b[1];
    const cy = a[2] * b[0] - a[0] * b[2];
    const cz = a[0] * b[1] - a[1] * b[0];
    const len = Math.sqrt(cx * cx + cy * cy + cz * cz);
    if (len < 1e-12) continue;
    const gamma = Math.atan2(len, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
    sum += (gamma * (n[0] * cx + n[1] * cy + n[2] * cz)) / len;
  }
  return Math.abs(sum) / (2 * Math.PI);
}

const corners = (p) => [
  p.origin,
  [p.origin[0] + p.du[0], p.origin[1] + p.du[1], p.origin[2] + p.du[2]],
  [
    p.origin[0] + p.du[0] + p.dv[0],
    p.origin[1] + p.du[1] + p.dv[1],
    p.origin[2] + p.du[2] + p.dv[2],
  ],
  [p.origin[0] + p.dv[0], p.origin[1] + p.dv[1], p.origin[2] + p.dv[2]],
];

// ---------------------------------------------------------------------------
// Form factor matrix
// ---------------------------------------------------------------------------

/** `count` points on a patch from a jittered √count × √count grid (count a perfect square). */
function stratifiedPoints(patch, count, random) {
  const side = Math.max(1, Math.round(Math.sqrt(count)));
  const points = [];
  for (let a = 0; a < side; a++) {
    for (let b = 0; b < side; b++) {
      const s = (a + random()) / side;
      const t = (b + random()) / side;
      points.push([
        patch.origin[0] + s * patch.du[0] + t * patch.dv[0],
        patch.origin[1] + s * patch.du[1] + t * patch.dv[1],
        patch.origin[2] + s * patch.du[2] + t * patch.dv[2],
      ]);
    }
  }
  return points;
}

/**
 * Form factor matrix for the given patches (see patches.js).
 *
 * @param {object} scene  normalized scene, used for the visibility tests
 * @param {object[]} patches
 * @param {{samples?: number, nearSamples?: number, seed?: number,
 *          onProgress?: (fraction: number) => void}} options
 *   `samples`: stratified points on patch i (each with one visibility ray) used for every
 *   pair of its row; `nearSamples`: points for pairs closer than two patch sizes, where the
 *   form factor changes fastest across i. Both are rounded to perfect squares.
 * @returns {{F: Float32Array, maxRowSum: number, rowSums: Float64Array}}
 */
export function computeFormFactors(scene, patches, options = {}) {
  const { samples = 4, nearSamples = 16, seed = 1, onProgress } = options;
  const n = patches.length;
  const F = new Float32Array(n * n);
  const random = createRandom(seed);
  const blockers = buildBlockers(scene);
  const size = patches.map((p) => Math.sqrt(p.area));
  const polygons = patches.map(corners);
  const progressStep = Math.max(1, Math.floor(n / 50));

  for (let i = 0; i < n; i++) {
    const pi = patches[i];
    const ni = pi.normal;
    // The same points serve every j of this row, which keeps the row sum at most 1.
    const farPoints = stratifiedPoints(pi, samples, random);
    const nearPoints = stratifiedPoints(pi, nearSamples, random);

    for (let j = 0; j < n; j++) {
      const pj = patches[j];
      if (j === i || pj.quad === pi.quad) continue; // a flat quad never sees itself
      const nj = pj.normal;

      // Quick reject: j entirely behind i's plane, or i entirely behind j's plane.
      const cx = pj.center[0] - pi.center[0];
      const cy = pj.center[1] - pi.center[1];
      const cz = pj.center[2] - pi.center[2];
      const reach = (size[i] + size[j]) * 0.75;
      if (ni[0] * cx + ni[1] * cy + ni[2] * cz < -reach) continue;
      if (-(nj[0] * cx + nj[1] * cy + nj[2] * cz) < -reach) continue;

      const centerDistance = Math.sqrt(cx * cx + cy * cy + cz * cz);
      const points = centerDistance < 2 * Math.max(size[i], size[j]) ? nearPoints : farPoints;

      let sum = 0;
      for (const x of points) {
        // x must be in front of patch j for any light to travel from j to x.
        const front =
          nj[0] * (x[0] - pj.origin[0]) +
          nj[1] * (x[1] - pj.origin[1]) +
          nj[2] * (x[2] - pj.origin[2]);
        if (front <= 0) continue;
        const pointFactor = pointToPolygonFormFactor(x, ni, polygons[j]);
        if (pointFactor === 0) continue;
        const b1 = random();
        const b2 = random();
        const dx = pj.origin[0] + b1 * pj.du[0] + b2 * pj.dv[0] - x[0];
        const dy = pj.origin[1] + b1 * pj.du[1] + b2 * pj.dv[1] - x[1];
        const dz = pj.origin[2] + b1 * pj.du[2] + b2 * pj.dv[2] - x[2];
        if (segmentBlocked(blockers, x[0], x[1], x[2], dx, dy, dz)) continue;
        sum += pointFactor;
      }
      F[i * n + j] = sum / points.length;
    }
    if (onProgress && i % progressStep === 0) onProgress(i / n);
  }

  // 1. Reciprocity: both directions of a pair estimate the same exchanged energy
  //    A_i F_ij = A_j F_ji. Averaging them makes Equation 8 exact and halves the noise.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const exchanged = (patches[i].area * F[i * n + j] + patches[j].area * F[j * n + i]) / 2;
      F[i * n + j] = exchanged / patches[i].area;
      F[j * n + i] = exchanged / patches[j].area;
    }
  }

  // 2. Energy conservation: the front of the box is open, so every row must sum to at most 1.
  //    Visibility sampling can push a few rows slightly above; scale those back to 1.
  const rowSums = new Float64Array(n);
  let maxRowSum = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += F[i * n + j];
    maxRowSum = Math.max(maxRowSum, sum);
    if (sum > 1) {
      for (let j = 0; j < n; j++) F[i * n + j] /= sum;
      sum = 1;
    }
    rowSums[i] = sum;
  }
  onProgress?.(1);
  return { F, maxRowSum, rowSums };
}
