import { describe, expect, it } from 'vitest';
import { traceCaustics } from '../src/photons/trace.js';
import { pointToPolygonFormFactor } from '../src/radiosity/formFactors.js';
import { CORNELL_SCALE, createClassicScene, createSpheresScene } from '../src/scene/cornell.js';

const spheres = createSpheresScene();
const floorIndex = spheres.quads.findIndex((q) => q.label === 'floor');

/** Irradiance (green channel) of the floor cell under data-unit point (x, z). */
function floorIrradiance(result, x, z) {
  const floor = spheres.quads[floorIndex];
  const { offset, nu, nv } = result.layout.quads[floorIndex];
  const s = (x * CORNELL_SCALE - floor.origin[0]) / floor.u[0];
  const t = (z * CORNELL_SCALE - floor.origin[2]) / floor.v[2];
  const cell = offset + Math.floor(t * nv) * nu + Math.floor(s * nu);
  return result.irradiance[cell * 3 + 1];
}

describe('caustic photon map', () => {
  it('stores nothing in the classic scene, which has no specular surfaces', () => {
    const result = traceCaustics(createClassicScene(), { photons: 20_000 });
    expect(result.stats.stored).toBe(0);
  });

  it('conserves energy: the irradiance integrated over the cells equals the stored power', () => {
    const result = traceCaustics(spheres, { photons: 200_000, radius: 4 * CORNELL_SCALE });
    let integrated = 0;
    result.layout.quads.forEach(({ offset, nu, nv }, q) => {
      const quad = spheres.quads[q];
      const cellArea = (Math.hypot(...quad.u) / nu) * (Math.hypot(...quad.v) / nv);
      for (let k = offset; k < offset + nu * nv; k++)
        integrated += result.irradiance[k * 3 + 1] * cellArea;
    });
    // A small kernel keeps most disks inside their quad; the rest is lost at the edges.
    const ratio = integrated / result.stats.storedPower[1];
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.02);
  });

  it('with glass index 1 the light through the sphere equals the analytic direct light', () => {
    // The floor point under the glass sphere sees the whole light through the sphere. With
    // η = 1 the glass is air, so the photon map must give E = π · Le · F(point → light).
    const x = 185;
    const z = 170;
    const result = traceCaustics(spheres, {
      photons: 1_500_000,
      radius: 15 * CORNELL_SCALE,
      ior: 1,
    });
    const { light } = spheres;
    const polygon = [
      light.origin,
      light.origin.map((c, i) => c + light.u[i]),
      light.origin.map((c, i) => c + light.u[i] + light.v[i]),
      light.origin.map((c, i) => c + light.v[i]),
    ];
    const point = [x * CORNELL_SCALE, 0, z * CORNELL_SCALE];
    const expected =
      Math.PI * light.emission[1] * pointToPolygonFormFactor(point, [0, 1, 0], polygon);
    const measured = floorIrradiance(result, x, z);
    expect(Math.abs(measured - expected) / expected).toBeLessThan(0.1);
  }, 60_000);

  it('glass (η = 1.5) focuses the light: the brightest floor cell beats the unfocused one', () => {
    const options = { photons: 400_000, radius: 10 * CORNELL_SCALE };
    const peak = (result) => {
      const { offset, nu, nv } = result.layout.quads[floorIndex];
      let max = 0;
      for (let k = offset; k < offset + nu * nv; k++)
        max = Math.max(max, result.irradiance[k * 3 + 1]);
      return max;
    };
    const focused = peak(traceCaustics(spheres, { ...options, ior: 1.5 }));
    const unfocused = peak(traceCaustics(spheres, { ...options, ior: 1 }));
    expect(focused).toBeGreaterThan(2 * unfocused);
  }, 60_000);
});
