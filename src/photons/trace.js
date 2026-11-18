/**
 * Caustic photon map (Jensen 1996), report Chapter 6 and Example 5.
 *
 * Photons leave the area light with equal power ΔΦ = Φ / N, where Φ = π · Le · A is the
 * total flux of a Lambertian emitter. Only caustic paths are kept: a photon must hit a
 * specular surface (mirror or glass) first, may bounce between specular surfaces, and is
 * stored where it first lands on a diffuse surface. In path notation these are the L S+ D
 * paths of the caustic map; everything else is left to the renderer.
 *
 * The irradiance on every diffuse quad is estimated on a fine grid with the density estimate
 * of report Example 5: each photon adds ΔΦ / (π r²) to the grid cells within distance r of
 * where it landed, so a cell ends up with E ≈ (Σ ΔΦ of nearby photons) / (π r²). A larger r
 * gives a smoother but blurrier result (bias); a smaller r a sharper but noisier one.
 *
 * The renderer adds L = ρ/π · E at diffuse surfaces and stops counting the same paths itself.
 */

import {
  add,
  cross,
  dot,
  fresnelDielectric,
  intersectScene,
  length,
  normalize,
  pointAt,
  reflect,
  refract,
  scale,
} from '../math/math.js';
import { createRandom } from '../math/random.js';
import { CORNELL_SCALE, MATERIAL_TYPE } from '../scene/cornell.js';

export const CAUSTIC_DEFAULTS = Object.freeze({
  photons: 500_000,
  radius: 15 * CORNELL_SCALE, // 15 data units
  cellsPerUnit: 128,
  maxBounces: 16,
  seed: 7,
});

const TEXTURE_WIDTH = 1024;
const OFFSET = 4e-4; // same ray offset as the shaders (EPSILON * 4)

/**
 * Grid of cells over every quad, stored quad by quad and row by row (like the radiosity
 * patches): cell (iu, iv) of quad q has index quads[q].offset + iv · nu + iu.
 */
export function causticLayout(scene, cellsPerUnit) {
  let offset = 0;
  const quads = scene.quads.map((q) => {
    const nu = Math.max(1, Math.round(length(q.u) * cellsPerUnit));
    const nv = Math.max(1, Math.round(length(q.v) * cellsPerUnit));
    const entry = { offset, nu, nv };
    offset += nu * nv;
    return entry;
  });
  return {
    quads,
    cellCount: offset,
    textureWidth: TEXTURE_WIDTH,
    textureHeight: Math.max(1, Math.ceil(offset / TEXTURE_WIDTH)),
  };
}

/**
 * @param {object} scene  normalized scene from cornell.js
 * @param {{photons?: number, radius?: number, cellsPerUnit?: number, ior?: number,
 *          maxBounces?: number, seed?: number}} options
 * @param {(fraction: number) => void} [onProgress]
 * @returns {{layout: object, irradiance: Float32Array, stats: object}}
 */
export function traceCaustics(scene, options = {}, onProgress) {
  const { photons, radius, cellsPerUnit, maxBounces, seed } = { ...CAUSTIC_DEFAULTS, ...options };
  const start = performance.now();
  const random = createRandom(seed);
  const layout = causticLayout(scene, cellsPerUnit);
  const irradiance = new Float32Array(layout.cellCount * 3);

  const { light } = scene;
  const flux = light.emission.map((le) => Math.PI * le * light.area); // Φ = π Le A
  const photonPower = flux.map((f) => f / photons);
  // Basis around the light normal for cosine-weighted emission.
  const n = light.normal;
  const t = normalize(light.u);
  const b = cross(n, t);
  const kernel = 1 / (Math.PI * radius * radius);

  const storedPower = [0, 0, 0];
  let stored = 0;
  const progressStep = Math.max(1, Math.floor(photons / 50));

  const deposit = (hit, power) => {
    const quad = scene.quads[hit.index];
    const { offset, nu, nv } = layout.quads[hit.index];
    const uLength = length(quad.u);
    const vLength = length(quad.v);
    const cu = hit.s * nu;
    const cv = hit.tt * nv;
    const ru = (radius / uLength) * nu;
    const rv = (radius / vLength) * nv;
    const iu0 = Math.max(0, Math.floor(cu - ru));
    const iu1 = Math.min(nu - 1, Math.floor(cu + ru));
    const iv0 = Math.max(0, Math.floor(cv - rv));
    const iv1 = Math.min(nv - 1, Math.floor(cv + rv));
    for (let iv = iv0; iv <= iv1; iv++) {
      const dv = ((iv + 0.5) / nv - hit.tt) * vLength;
      for (let iu = iu0; iu <= iu1; iu++) {
        const du = ((iu + 0.5) / nu - hit.s) * uLength;
        if (du * du + dv * dv > radius * radius) continue;
        const cell = (offset + iv * nu + iu) * 3;
        irradiance[cell] += power[0] * kernel;
        irradiance[cell + 1] += power[1] * kernel;
        irradiance[cell + 2] += power[2] * kernel;
      }
    }
    stored += 1;
    for (let c = 0; c < 3; c++) storedPower[c] += power[c];
  };

  for (let k = 0; k < photons; k++) {
    // Emission: uniform point on the light, cosine-weighted direction around its normal.
    const origin0 = add(add(light.origin, scale(light.u, random())), scale(light.v, random()));
    const r1 = random();
    const phi = 2 * Math.PI * random();
    const r = Math.sqrt(r1);
    let dir = add(
      add(scale(t, r * Math.cos(phi)), scale(b, r * Math.sin(phi))),
      scale(n, Math.sqrt(Math.max(0, 1 - r1))),
    );
    let origin = pointAt(origin0, n, OFFSET);
    let power = photonPower;
    let specularBounces = 0;

    for (let bounce = 0; bounce < maxBounces; bounce++) {
      const hit = intersectScene(scene, origin, dir);
      if (!hit) break; // escaped through the open front
      const material = scene.materials[hit.material];

      if (material.type === MATERIAL_TYPE.DIFFUSE) {
        if (specularBounces > 0) deposit(hit, power); // L S+ D: a caustic photon
        break; // other paths are not part of the caustic map
      }
      if (material.type === MATERIAL_TYPE.EMISSIVE) break;

      specularBounces += 1;
      if (material.type === MATERIAL_TYPE.MIRROR) {
        power = power.map((p, c) => p * material.albedo[c]);
        dir = reflect(dir, hit.normal);
        origin = pointAt(hit.point, hit.normal, OFFSET);
        continue;
      }

      // Glass: reflect with probability F, refract otherwise (exact Fresnel, as in the shaders).
      const ior = options.ior ?? material.ior;
      const n1 = hit.frontFace ? 1 : ior;
      const n2 = hit.frontFace ? ior : 1;
      const transmitted = refract(dir, hit.normal, n1 / n2);
      const cosI = -dot(dir, hit.normal);
      const fresnel = transmitted
        ? fresnelDielectric(cosI, -dot(transmitted, hit.normal), n1, n2)
        : 1;
      if (random() < fresnel) {
        dir = reflect(dir, hit.normal);
        origin = pointAt(hit.point, hit.normal, OFFSET);
      } else {
        power = power.map((p, c) => p * material.albedo[c]);
        dir = transmitted;
        origin = pointAt(hit.point, hit.normal, -OFFSET);
      }
    }
    if (onProgress && k % progressStep === 0) onProgress(k / photons);
  }
  onProgress?.(1);

  return {
    layout,
    irradiance,
    stats: {
      emitted: photons,
      stored,
      storedPower,
      radius,
      ms: performance.now() - start,
    },
  };
}
