import { describe, expect, it } from 'vitest';
import {
  fresnelSchlick,
  intersectQuad,
  intersectScene,
  length,
  normalize,
  occluded,
  reflect,
  refract,
} from '../src/math/math.js';

const unitSquare = { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], normal: [0, 1, 0] };

describe('intersectQuad', () => {
  it('returns distance and local (s, t) coordinates', () => {
    const hit = intersectQuad([0.25, 2, 0.75], [0, -1, 0], unitSquare);
    expect(hit.t).toBeCloseTo(2, 10);
    expect(hit.s).toBeCloseTo(0.25, 10);
    expect(hit.tt).toBeCloseTo(0.75, 10);
  });

  it('misses outside the parallelogram and when parallel', () => {
    expect(intersectQuad([1.5, 2, 0.5], [0, -1, 0], unitSquare)).toBeNull();
    expect(intersectQuad([0.5, 2, 0.5], [1, 0, 0], unitSquare)).toBeNull();
  });

  it('ignores hits behind the ray or beyond tMax', () => {
    expect(intersectQuad([0.5, 2, 0.5], [0, 1, 0], unitSquare)).toBeNull();
    expect(intersectQuad([0.5, 2, 0.5], [0, -1, 0], unitSquare, 1e-4, 1.5)).toBeNull();
  });

  it('works for non-rectangular parallelograms', () => {
    const skew = { origin: [0, 0, 0], u: [2, 0, 0], v: [1, 0, 1], normal: [0, 1, 0] };
    const hit = intersectQuad([2, 1, 0.5], [0, -1, 0], skew);
    expect(hit.s).toBeCloseTo(0.75, 10);
    expect(hit.tt).toBeCloseTo(0.5, 10);
  });
});

describe('reflect and refract', () => {
  it('reflect keeps the length and mirrors the normal component', () => {
    const d = normalize([1, -1, 0]);
    const r = reflect(d, [0, 1, 0]);
    expect(r[0]).toBeCloseTo(d[0], 10);
    expect(r[1]).toBeCloseTo(-d[1], 10);
    expect(length(r)).toBeCloseTo(1, 10);
  });

  it('refract with eta = 1 does not bend the ray', () => {
    const d = normalize([1, -2, 0.5]);
    const t = refract(d, [0, 1, 0], 1);
    d.forEach((value, i) => expect(t[i]).toBeCloseTo(value, 10));
  });

  it('refract returns null on total internal reflection', () => {
    // Leaving glass (1.5 → 1) at 60° exceeds the critical angle (≈ 41.8°).
    const d = [Math.sin(Math.PI / 3), -Math.cos(Math.PI / 3), 0];
    expect(refract(d, [0, 1, 0], 1.5)).toBeNull();
  });
});

describe('fresnelSchlick', () => {
  it('gives 4% at normal incidence on glass and 100% at grazing angles', () => {
    expect(fresnelSchlick(1, 1, 1.5)).toBeCloseTo(0.04, 10);
    expect(fresnelSchlick(0, 1, 1.5)).toBeCloseTo(1, 10);
  });
});

describe('scene queries', () => {
  const scene = {
    quads: [{ ...unitSquare, material: 0 }],
    spheres: [{ center: [0.5, 1, 0.5], radius: 0.25, material: 1 }],
  };

  it('returns the closest primitive', () => {
    const hit = intersectScene(scene, [0.5, 3, 0.5], [0, -1, 0]);
    expect(hit.kind).toBe('sphere');
    expect(hit.t).toBeCloseTo(1.75, 10);
  });

  it('flips the shading normal towards the incoming ray', () => {
    const hit = intersectScene(scene, [0.1, -1, 0.1], [0, 1, 0]);
    expect(hit.kind).toBe('quad');
    expect(hit.frontFace).toBe(false);
    expect(hit.normal).toEqual([-0, -1, -0]);
  });

  it('occluded detects blockers between two points only', () => {
    expect(occluded(scene, [0.5, 3, 0.5], [0.5, 0.01, 0.5])).toBe(true);
    expect(occluded(scene, [0.1, 3, 0.1], [0.1, 0.01, 0.1])).toBe(false);
    expect(occluded(scene, [0.5, 3, 0.5], [0.5, 2, 0.5])).toBe(false);
  });
});
