/**
 * Vector math and ray queries in JavaScript.
 *
 * These functions mirror the GLSL code in `render/shaders/common.glsl` so the same
 * geometry can be tested here (report Example 2) and reused by the radiosity and photon
 * workers. Vectors are plain `[x, y, z]` arrays; every function returns a new array.
 */

/** Default offset that keeps secondary rays from re-hitting their own surface. */
export const EPSILON = 1e-4;

// ---------------------------------------------------------------------------
// Vectors
// ---------------------------------------------------------------------------

export const vec3 = (x = 0, y = 0, z = 0) => [x, y, z];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const mul = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a) => Math.sqrt(dot(a, a));
export const distance = (a, b) => length(sub(a, b));
export const negate = (a) => [-a[0], -a[1], -a[2]];

export function normalize(a) {
  const len = length(a);
  return len > 0 ? scale(a, 1 / len) : [0, 0, 0];
}

/** Point reached after travelling a distance `t` along a ray. */
export const pointAt = (origin, dir, t) => add(origin, scale(dir, t));

// ---------------------------------------------------------------------------
// Reflection, refraction and Fresnel
// ---------------------------------------------------------------------------

/**
 * Mirror reflection of direction `d` about the unit normal `n`: r = d - 2 (d·n) n.
 * Same as GLSL `reflect()` and report Section 3.2.
 */
export const reflect = (d, n) => sub(d, scale(n, 2 * dot(d, n)));

/**
 * Refraction of the unit direction `d` through a surface with unit normal `n`
 * (pointing against `d`), where `eta = ηi / ηt`. Same as GLSL `refract()`:
 *
 *   k = 1 - eta² (1 - (n·d)²)
 *   t = eta d - (eta (n·d) + √k) n
 *
 * which equals the report's form T = (ηi/ηt) u - (cos θt - (ηi/ηt) cos θi) N
 * with cos θi = -u·N and cos θt = √k. Returns `null` on total internal reflection.
 */
export function refract(d, n, eta) {
  const cosI = dot(n, d);
  const k = 1 - eta * eta * (1 - cosI * cosI);
  if (k < 0) return null;
  return sub(scale(d, eta), scale(n, eta * cosI + Math.sqrt(k)));
}

/**
 * Schlick's approximation of the Fresnel reflectance for an interface between
 * media with indices `n1` (incident side) and `n2`, given cos θ on the incident side.
 */
export function fresnelSchlick(cosTheta, n1, n2) {
  const r0 = ((n1 - n2) / (n1 + n2)) ** 2;
  return r0 + (1 - r0) * (1 - Math.min(1, Math.max(0, cosTheta))) ** 5;
}

/**
 * Exact Fresnel reflectance of an unpolarized ray at a dielectric interface, from the
 * cosines of the incident and transmitted angles. Unlike Schlick's approximation it is
 * exactly 0 when both indices are equal. Returns 1 on total internal reflection
 * (`cosT` is null). The GLSL `fresnelDielectric()` is identical.
 */
export function fresnelDielectric(cosI, cosT, n1, n2) {
  if (cosT === null) return 1;
  const rs = (n1 * cosI - n2 * cosT) / (n1 * cosI + n2 * cosT);
  const rp = (n2 * cosI - n1 * cosT) / (n2 * cosI + n1 * cosT);
  return 0.5 * (rs * rs + rp * rp);
}

// ---------------------------------------------------------------------------
// Ray-primitive intersection
// ---------------------------------------------------------------------------

/**
 * Both distances at which a ray meets a sphere, following Hearn et al. (2014, p. 639):
 *
 *   s = u·ΔP ± √((u·ΔP)² - |ΔP|² + r²),   with ΔP = Pc - P0 and u a unit direction.
 *
 * Returns `[sNear, sFar]` (sNear ≤ sFar), or `null` when the ray misses the sphere.
 */
export function sphereRoots(origin, dir, center, radius) {
  const deltaP = sub(center, origin);
  const b = dot(dir, deltaP);
  const disc = b * b - dot(deltaP, deltaP) + radius * radius;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  return [b - root, b + root];
}

/** Closest sphere hit with distance in (tMin, tMax), or `null`. */
export function intersectSphere(origin, dir, sphere, tMin = EPSILON, tMax = Infinity) {
  const roots = sphereRoots(origin, dir, sphere.center, sphere.radius);
  if (!roots) return null;
  for (const t of roots) {
    if (t > tMin && t < tMax) {
      const point = pointAt(origin, dir, t);
      return { t, point, outwardNormal: scale(sub(point, sphere.center), 1 / sphere.radius) };
    }
  }
  return null;
}

/**
 * Ray against a parallelogram defined by a corner `origin` and edge vectors `u`, `v`.
 * Returns the distance and the local coordinates (s, t) ∈ [0, 1]² of the hit, which the
 * radiosity display uses to find the patch. `null` when there is no hit in (tMin, tMax).
 */
export function intersectQuad(origin, dir, quad, tMin = EPSILON, tMax = Infinity) {
  const n = cross(quad.u, quad.v);
  const denom = dot(n, dir);
  if (Math.abs(denom) < 1e-12) return null; // ray parallel to the plane

  const t = dot(n, sub(quad.origin, origin)) / denom;
  if (!(t > tMin && t < tMax)) return null;

  const point = pointAt(origin, dir, t);
  const planar = sub(point, quad.origin);
  const w = scale(n, 1 / dot(n, n));
  const s = dot(w, cross(planar, quad.v));
  const tt = dot(w, cross(quad.u, planar));
  if (s < 0 || s > 1 || tt < 0 || tt > 1) return null;

  return { t, point, s, tt };
}

// ---------------------------------------------------------------------------
// Scene queries
// ---------------------------------------------------------------------------

/**
 * Closest hit against every quad and sphere of a scene (see `scene/cornell.js`).
 *
 * The returned `normal` faces the incoming ray; `frontFace` tells whether the ray hit the
 * side the stored normal points to (for spheres: the outside).
 */
export function intersectScene(scene, origin, dir, tMin = EPSILON, tMax = Infinity) {
  let closest = null;
  let limit = tMax;

  scene.quads.forEach((quad, index) => {
    const hit = intersectQuad(origin, dir, quad, tMin, limit);
    if (hit) {
      limit = hit.t;
      closest = {
        ...hit,
        kind: 'quad',
        index,
        material: quad.material,
        geometricNormal: quad.normal,
      };
    }
  });

  scene.spheres.forEach((sphere, index) => {
    const hit = intersectSphere(origin, dir, sphere, tMin, limit);
    if (hit) {
      limit = hit.t;
      closest = {
        t: hit.t,
        point: hit.point,
        kind: 'sphere',
        index,
        material: sphere.material,
        geometricNormal: hit.outwardNormal,
      };
    }
  });

  if (closest) {
    closest.frontFace = dot(dir, closest.geometricNormal) < 0;
    closest.normal = closest.frontFace ? closest.geometricNormal : negate(closest.geometricNormal);
  }
  return closest;
}

/**
 * Shadow test: is anything between points `p` and `q`? Used for shadow rays and for the
 * visibility term V_ij of the radiosity form factors.
 */
export function occluded(scene, p, q, epsilon = EPSILON) {
  const toQ = sub(q, p);
  const dist = length(toQ);
  const dir = scale(toQ, 1 / dist);
  return intersectScene(scene, p, dir, epsilon, dist - epsilon) !== null;
}
