/**
 * Splits the scene quads into radiosity patches (report Section 4.1).
 *
 * Each quad is divided into nu × nv patches, with nu = round(|u| · patchesPerUnit) and
 * nv = round(|v| · patchesPerUnit) (at least 1). Patches are stored quad by quad, row by
 * row: patch (iu, iv) of quad q has index layout.quads[q].offset + iv · nu + iu. The shader
 * uses the same rule to find the patch under a hit point from its local (s, t) coordinates.
 *
 * Emission is stored as radiosity: a Lambertian emitter of radiance Le has B = π · Le
 * (report Example 1, step 4), and the display shows L = B / π again. The light's own
 * reflectance is ignored (rho = 0), as in the path tracer.
 */

import { add, cross, length, scale } from '../math/math.js';
import { MATERIAL_TYPE } from '../scene/cornell.js';

/**
 * Reflectance of the part [s0, s1] × [t0, t1] of a quad. Plain materials return their albedo;
 * the checker floor returns the average of its two colors over the patch (the same pattern as
 * materialAlbedo() in common.glsl), estimated on an 8 × 8 grid of points.
 */
export function patchAlbedo(material, s0, s1, t0, t1) {
  const tiles = material.checkerTiles ?? 0;
  if (!tiles) return material.albedo;
  const sum = [0, 0, 0];
  const steps = 8;
  for (let a = 0; a < steps; a++) {
    for (let b = 0; b < steps; b++) {
      const s = s0 + ((a + 0.5) / steps) * (s1 - s0);
      const t = t0 + ((b + 0.5) / steps) * (t1 - t0);
      const odd = (Math.floor(s * tiles) + Math.floor(t * tiles)) % 2 === 1;
      const color = odd ? material.albedo2 : material.albedo;
      for (let c = 0; c < 3; c++) sum[c] += color[c];
    }
  }
  return sum.map((v) => v / (steps * steps));
}

/**
 * Turns a radiosity snapshot B into the irradiance H that each patch receives, using
 * B = E + rho · H (Equation 6 with H = Σ F_ij B_j). The display multiplies H by the reflectance
 * of each pixel, L = rho(x) · H / π, so textures finer than a patch (the checker floor) stay
 * sharp; for uniform patches this is exactly L = B / π. Light patches (rho = 0) get H = 0:
 * the shader shows their emission directly.
 */
export function irradianceFromRadiosity(B, rho, E) {
  const H = new Float32Array(B.length);
  for (let k = 0; k < B.length; k++) H[k] = rho[k] > 0 ? (B[k] - E[k]) / rho[k] : 0;
  return H;
}

/** Width of the texture the patches are packed into (patch p → texel p % W, ⌊p / W⌋). */
export const PATCH_TEXTURE_WIDTH = 1024;

/**
 * @param {{quads: object[], materials: object[]}} scene  normalized scene (cornell.js)
 * @param {number} patchesPerUnit
 */
export function buildPatches(scene, patchesPerUnit) {
  const quads = [];
  const patches = [];

  scene.quads.forEach((quad, q) => {
    const nu = Math.max(1, Math.round(length(quad.u) * patchesPerUnit));
    const nv = Math.max(1, Math.round(length(quad.v) * patchesPerUnit));
    const material = scene.materials[quad.material];
    const emissive = material.type === MATERIAL_TYPE.EMISSIVE;
    const E = emissive ? scale(material.emission, Math.PI) : [0, 0, 0];
    const du = scale(quad.u, 1 / nu);
    const dv = scale(quad.v, 1 / nv);
    const area = length(cross(du, dv));

    quads.push({ offset: patches.length, nu, nv });
    for (let iv = 0; iv < nv; iv++) {
      for (let iu = 0; iu < nu; iu++) {
        const rho = emissive
          ? [0, 0, 0]
          : patchAlbedo(material, iu / nu, (iu + 1) / nu, iv / nv, (iv + 1) / nv);
        const origin = add(add(quad.origin, scale(du, iu)), scale(dv, iv));
        patches.push({
          quad: q,
          iu,
          iv,
          origin, // corner of the patch
          du, // edge vectors of the patch
          dv,
          center: add(origin, scale(add(du, dv), 0.5)),
          normal: quad.normal,
          area,
          rho,
          E,
        });
      }
    }
  });

  const layout = {
    quads,
    patchCount: patches.length,
    textureWidth: PATCH_TEXTURE_WIDTH,
    textureHeight: Math.max(1, Math.ceil(patches.length / PATCH_TEXTURE_WIDTH)),
  };
  return { patches, layout };
}

/** Flat arrays used by the solvers: rho and E (n × 3) and areas (n). */
export function patchArrays(patches) {
  const n = patches.length;
  const rho = new Float64Array(n * 3);
  const E = new Float64Array(n * 3);
  const A = new Float64Array(n);
  patches.forEach((p, i) => {
    rho.set(p.rho, i * 3);
    E.set(p.E, i * 3);
    A[i] = p.area;
  });
  return { rho, E, A };
}
