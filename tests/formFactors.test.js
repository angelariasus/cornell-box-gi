import { describe, expect, it } from 'vitest';
import { computeFormFactors } from '../src/radiosity/formFactors.js';
import { buildPatches, PATCH_TEXTURE_WIDTH } from '../src/radiosity/patches.js';
import { solveRadiosity } from '../src/radiosity/solve.js';
import { createClassicScene, createSpheresScene, MAT } from '../src/scene/cornell.js';

const gray = [{ type: 0, albedo: [0.5, 0.5, 0.5] }];
const quad = (origin, u, v, normal) => ({ origin, u, v, normal, material: 0 });
const sceneOf = (quads) => ({ quads, spheres: [], materials: gray });

/** Form factor between whole quads a and b, summing over their patches: F_AB = Σ A_i F_ij / A_A. */
function quadFormFactor(scene, patchesPerUnit, a, b, options) {
  const { patches } = buildPatches(scene, patchesPerUnit);
  const { F } = computeFormFactors(scene, patches, options);
  const n = patches.length;
  let flux = 0;
  let area = 0;
  patches.forEach((pi, i) => {
    if (pi.quad !== a) return;
    area += pi.area;
    patches.forEach((pj, j) => {
      if (pj.quad === b) flux += pi.area * F[i * n + j];
    });
  });
  return flux / area;
}

// Analytic form factor between two directly opposed parallel rectangles a × b at distance c.
function parallelRectangles(a, b, c) {
  const X = a / c;
  const Y = b / c;
  const x1 = Math.sqrt(1 + X * X);
  const y1 = Math.sqrt(1 + Y * Y);
  return (
    (2 / (Math.PI * X * Y)) *
    (Math.log(Math.sqrt(((1 + X * X) * (1 + Y * Y)) / (1 + X * X + Y * Y))) +
      X * y1 * Math.atan(X / y1) +
      Y * x1 * Math.atan(Y / x1) -
      X * Math.atan(X) -
      Y * Math.atan(Y))
  );
}

describe('form factors against analytic values', () => {
  it('two parallel unit squares one unit apart: F ≈ 0.1998', () => {
    const scene = sceneOf([
      quad([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0]),
      quad([0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0]),
    ]);
    const expected = parallelRectangles(1, 1, 1);
    expect(expected).toBeCloseTo(0.1998, 4);
    const F = quadFormFactor(scene, 4, 0, 1, { samples: 16 });
    expect(Math.abs(F - expected) / expected).toBeLessThan(0.03);
  });

  it('two perpendicular unit squares sharing an edge: F ≈ 0.2000', () => {
    const scene = sceneOf([
      quad([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0]), // floor
      quad([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]), // wall on the shared edge z = 0
    ]);
    const F = quadFormFactor(scene, 8, 0, 1, { samples: 8, nearSamples: 64 });
    expect(Math.abs(F - 0.20004) / 0.20004).toBeLessThan(0.05);
  });

  it('a closed unit cube sends all the light of each face to the other faces (rows sum to 1)', () => {
    const scene = sceneOf([
      quad([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0]),
      quad([0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0]),
      quad([0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]),
      quad([1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0]),
      quad([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]),
      quad([0, 0, 1], [1, 0, 0], [0, 1, 0], [0, 0, -1]),
    ]);
    const { patches } = buildPatches(scene, 4);
    const { rowSums } = computeFormFactors(scene, patches, { samples: 16, nearSamples: 64 });
    const mean = rowSums.reduce((a, b) => a + b, 0) / rowSums.length;
    expect(mean).toBeGreaterThan(0.97);
    expect(mean).toBeLessThan(1.03);
  });

  it('reciprocity A_i F_ij = A_j F_ji holds within 5% for the energy exchanged', () => {
    const scene = createClassicScene();
    const { patches } = buildPatches(scene, 3);
    const { F } = computeFormFactors(scene, patches, { samples: 16, nearSamples: 64 });
    const n = patches.length;
    let difference = 0;
    let total = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const lhs = patches[i].area * F[i * n + j];
        const rhs = patches[j].area * F[j * n + i];
        difference += Math.abs(lhs - rhs);
        total += (lhs + rhs) / 2;
      }
    }
    expect(difference / total).toBeLessThan(0.05);
  });
});

describe('patches', () => {
  const scene = createClassicScene();
  const { patches, layout } = buildPatches(scene, 8);

  it('cover every quad exactly and follow the layout order', () => {
    scene.quads.forEach((q, index) => {
      const { offset, nu, nv } = layout.quads[index];
      const own = patches.slice(offset, offset + nu * nv);
      expect(own.every((p) => p.quad === index)).toBe(true);
      const area = own.reduce((sum, p) => sum + p.area, 0);
      const quadArea = Math.hypot(
        q.u[1] * q.v[2] - q.u[2] * q.v[1],
        q.u[2] * q.v[0] - q.u[0] * q.v[2],
        q.u[0] * q.v[1] - q.u[1] * q.v[0],
      );
      expect(area).toBeCloseTo(quadArea, 10);
    });
    expect(layout.textureWidth).toBe(PATCH_TEXTURE_WIDTH);
  });

  it('only the light emits, with B = π·Le, and it does not reflect', () => {
    const light = patches.filter((p) => p.E[1] > 0);
    expect(light.length).toBeGreaterThan(0);
    for (const p of light) {
      expect(scene.quads[p.quad].material).toBe(MAT.LIGHT);
      expect(p.E[0]).toBeCloseTo(17 * Math.PI, 10);
      expect(p.rho).toEqual([0, 0, 0]);
    }
  });
});

describe('radiosity of the classic Cornell box', () => {
  const result = solveRadiosity(createClassicScene(), { patchesPerUnit: 8, iterations: 24 });
  const n = result.stats.patchCount;
  const final = result.snapshots.at(-1);
  const B = (i) => [final[i * 3], final[i * 3 + 1], final[i * 3 + 2]];

  it('solves a few hundred patches; sampling noise in the row sums stays below 5%', () => {
    expect(n).toBeGreaterThan(300);
    expect(n).toBeLessThan(800);
    expect(result.stats.maxRowSum).toBeLessThan(1.05);
    expect(result.snapshots).toHaveLength(25);
  });

  it('no patch sends out more light than it has after the final scaling (Σ F_ij ≤ 1)', () => {
    const scene = createClassicScene();
    const { patches } = buildPatches(scene, 8);
    const { rowSums } = computeFormFactors(scene, patches);
    expect(Math.max(...rowSums)).toBeLessThanOrEqual(1 + 1e-6);
  });

  it('converges: the last two Gauss-Seidel iterations barely differ', () => {
    const prev = result.snapshots.at(-2);
    let maxChange = 0;
    for (let k = 0; k < final.length; k++)
      maxChange = Math.max(maxChange, Math.abs(final[k] - prev[k]));
    expect(maxChange).toBeLessThan(0.01);
  });

  it('the ceiling, which gets no direct light, is lit by interreflection', () => {
    const scene = createClassicScene();
    const meanGreen = (label) => {
      const q = scene.quads.findIndex((x) => x.label === label);
      const { offset, nu, nv } = result.layout.quads[q];
      let sum = 0;
      for (let k = offset; k < offset + nu * nv; k++) sum += B(k)[1];
      return sum / (nu * nv);
    };
    const ceiling = meanGreen('ceiling front');
    const floor = meanGreen('floor');
    expect(result.snapshots[0][0]).toBe(0); // before solving, only the light shines
    expect(ceiling).toBeGreaterThan(0.1 * floor);
    expect(ceiling).toBeLessThan(floor);
  });

  it('color bleeding: the floor next to the red wall is redder than next to the green wall', () => {
    const scene = createClassicScene();
    const floor = scene.quads.findIndex((q) => q.label === 'floor');
    const { offset, nu, nv } = result.layout.quads[floor];
    // u runs along x (green wall at x = 0, red wall at x = max); take the middle row in z.
    const row = Math.floor(nv / 2);
    const nearGreen = B(offset + row * nu + 0);
    const nearRed = B(offset + row * nu + nu - 1);
    expect(nearRed[0] / nearRed[1]).toBeGreaterThan(nearGreen[0] / nearGreen[1]);
  });
});

describe('two-pass radiosity support', () => {
  it('patchAlbedo averages the checker floor and leaves plain materials alone', async () => {
    const { patchAlbedo } = await import('../src/radiosity/patches.js');
    const { MATERIALS, MAT } = await import('../src/scene/cornell.js');
    const checker = MATERIALS[MAT.CHECKER];
    // One full tile (tiles are 1/8 of the floor) is a single color; two tiles average them.
    patchAlbedo(checker, 0, 1 / 8, 0, 1 / 8).forEach((c, i) =>
      expect(c).toBeCloseTo(checker.albedo[i], 10),
    );
    const two = patchAlbedo(checker, 0, 2 / 8, 0, 1 / 8);
    two.forEach((c, i) => expect(c).toBeCloseTo((checker.albedo[i] + checker.albedo2[i]) / 2, 10));
    expect(patchAlbedo(MATERIALS[MAT.RED], 0, 0.5, 0, 0.5)).toBe(MATERIALS[MAT.RED].albedo);
  });

  it('irradianceFromRadiosity inverts B = E + rho H and gives 0 on the light', async () => {
    const { irradianceFromRadiosity } = await import('../src/radiosity/patches.js');
    const rho = [0.5, 0.5, 0.5, 0, 0, 0];
    const E = [0, 0, 0, 50, 50, 50];
    const B = [1.5, 1.5, 1.5, 50, 50, 50]; // patch 0: H = 3, patch 1: the light
    expect([...irradianceFromRadiosity(B, rho, E)]).toEqual([3, 3, 3, 0, 0, 0]);
  });

  it('the spheres scene solves with the spheres as blockers and keeps energy bounded', () => {
    const scene = createSpheresScene();
    const result = solveRadiosity(scene, { patchesPerUnit: 6, iterations: 24 });
    expect(result.stats.patchCount).toBeGreaterThan(100);
    expect(result.stats.maxRowSum).toBeLessThan(1.05);
    expect(result.rho).toHaveLength(result.stats.patchCount * 3);
  });
});
