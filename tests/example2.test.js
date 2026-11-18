/**
 * Report Example 2 (Section 3.8): one ray traced step by step through a glass sphere,
 * following the ray tracing equations of Hearn et al. (2014, pp. 636–639).
 *
 * Eye P0 = (0, 0, 0), direction u = (0, 0.6, 0.8); glass sphere centre Pc = (0, 2, 6),
 * radius √5, ηt = 1.5; point light at PL = (0, 7, 1); air ηi = 1.
 */
import { describe, expect, it } from 'vitest';
import {
  dot,
  intersectScene,
  length,
  negate,
  normalize,
  occluded,
  pointAt,
  reflect,
  refract,
  scale,
  sphereRoots,
  sub,
} from '../src/math/math.js';

const P0 = [0, 0, 0];
const u = [0, 0.6, 0.8];
const Pc = [0, 2, 6];
const r = Math.sqrt(5);
const PL = [0, 7, 1];
const etaI = 1;
const etaT = 1.5;
const sphere = { center: Pc, radius: r, material: 0 };
const scene = { quads: [], spheres: [sphere] };

const expectVec = (actual, expected, digits = 3) => {
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, digits));
};

describe('Report Example 2: one ray step by step', () => {
  // Step 1: where does the ray hit?
  const roots = sphereRoots(P0, u, Pc, r);
  const P = pointAt(P0, u, roots[0]);

  // Step 2: surface normal.
  const N = scale(sub(P, Pc), 1 / r);
  const cosI = -dot(u, N);

  it('step 1: the ray enters the sphere at s = 5 and leaves at s = 7', () => {
    expect(roots[0]).toBeCloseTo(5, 10);
    expect(roots[1]).toBeCloseTo(7, 10);
  });

  it('step 1: the visible point is P = (0, 3, 4)', () => {
    expectVec(P, [0, 3, 4], 10);
  });

  it('step 1: the scene query returns the same nearest hit', () => {
    const hit = intersectScene(scene, P0, u);
    expect(hit.t).toBeCloseTo(5, 10);
    expect(hit.frontFace).toBe(true);
  });

  it('step 2: N ≈ (0, 0.447, -0.894) and cos θi = 1/√5 (θi ≈ 63.4°)', () => {
    expectVec(N, [0, 0.447, -0.894]);
    expect(cosI).toBeCloseTo(1 / Math.sqrt(5), 10);
    expect((Math.acos(cosI) * 180) / Math.PI).toBeCloseTo(63.4, 1);
  });

  it('step 3: the light direction is l = (0, 0.8, -0.6) and N·l ≈ 0.894', () => {
    const l = normalize(sub(PL, P));
    expectVec(l, [0, 0.8, -0.6], 10);
    expect(length(sub(PL, P))).toBeCloseTo(5, 10);
    expect(dot(N, l)).toBeCloseTo(0.894, 3);
  });

  it('step 3: the shadow ray only finds the roots 0 and -4, so P is lit', () => {
    const l = normalize(sub(PL, P));
    const shadowRoots = sphereRoots(P, l, Pc, r);
    expect(shadowRoots[0]).toBeCloseTo(-4, 10);
    expect(shadowRoots[1]).toBeCloseTo(0, 10);
    expect(occluded(scene, P, PL)).toBe(false);
  });

  it('step 3: local term I_local = kd (N·l) ≈ 0.179 with kd = 0.2', () => {
    const l = normalize(sub(PL, P));
    expect(0.2 * dot(N, l)).toBeCloseTo(0.179, 3);
  });

  it('step 4: the reflected direction is R = (0, 1, 0)', () => {
    const R = reflect(u, N);
    expectVec(R, [0, 1, 0], 10);
    // Same angle with the normal as the incident ray.
    expect(dot(R, N)).toBeCloseTo(cosI, 10);
  });

  it('step 5: cos θt ≈ 0.803 (θt ≈ 36.6°) and T ≈ (0, 0.174, 0.985)', () => {
    const T = refract(u, N, etaI / etaT);
    const cosT = -dot(T, N);
    expect(cosT).toBeCloseTo(0.803, 3);
    expect((Math.acos(cosT) * 180) / Math.PI).toBeCloseTo(36.6, 1);
    expectVec(T, [0, 0.174, 0.985]);
    expect(length(T)).toBeCloseTo(1, 10);
  });

  it("step 5: the refraction matches the report's formula for T", () => {
    const eta = etaI / etaT;
    const cosT = Math.sqrt(1 - eta * eta * (1 - cosI * cosI));
    const formula = sub(scale(u, eta), scale(N, cosT - eta * cosI));
    expectVec(refract(u, N, eta), formula, 10);
  });

  it('step 6: pixel intensity I = 0.179 + 0.2·0.8 + 0.6·0.3 ≈ 0.519', () => {
    const l = normalize(sub(PL, P));
    const local = 0.2 * dot(N, l);
    const I = local + 0.2 * 0.8 + 0.6 * 0.3;
    expect(I).toBeCloseTo(0.519, 3);
  });

  it('the refracted ray continues inside the glass and leaves at the far side', () => {
    const T = refract(u, N, etaI / etaT);
    const hit = intersectScene(scene, P, T);
    expect(hit).not.toBeNull();
    expect(hit.frontFace).toBe(false); // hit from inside
    expectVec(hit.normal, negate(hit.geometricNormal), 10);
  });
});
