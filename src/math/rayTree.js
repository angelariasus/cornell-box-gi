/**
 * The Whitted ray tree of one pixel (report Figure 7), computed in JavaScript with the same
 * rules as whitted.frag so it can be drawn over the image:
 *
 * - every hit on a diffuse surface sends a shadow ray towards the centre of the light;
 * - a mirror spawns one reflected ray (weight k_r = mirror reflectance);
 * - glass spawns a reflected ray (weight F) and a refracted ray (weight 1 − F), with exact
 *   Fresnel and total internal reflection;
 * - like Figure 8, the primary ray has depth 0 and secondary rays are spawned only while
 *   depth < maxDepth; branches whose weight falls below minWeight are dropped.
 */

import {
  dot,
  fresnelDielectric,
  intersectScene,
  length,
  normalize,
  pointAt,
  reflect,
  refract,
  sub,
} from './math.js';
import { MATERIAL_TYPE } from '../scene/cornell.js';

const OFFSET = 4e-4; // same ray offset as the shaders
const MISS_LENGTH = 1.5; // how far a ray that leaves the box is drawn

/**
 * @typedef {object} RayNode
 * @property {'primary'|'reflected'|'refracted'} kind
 * @property {number[]} from   start point
 * @property {number[]} to     hit point, or a point MISS_LENGTH away when the ray escapes
 * @property {boolean} hit
 * @property {number} depth
 * @property {number} weight   product of the coefficients along the branch (max channel)
 * @property {string} [surface]  label of the surface hit
 * @property {string} [material] name of its material
 * @property {boolean} [inside]  the ray hit the surface from inside (glass)
 * @property {{to: number[], blocked: boolean, blocker?: string}} [shadow]  diffuse hits only
 * @property {RayNode[]} children
 */

/**
 * @param {object} scene  normalized scene from cornell.js
 * @param {number[]} origin
 * @param {number[]} dir   unit direction of the primary ray
 * @param {{maxDepth?: number, ior?: number, minWeight?: number}} options
 * @returns {RayNode}
 */
export function buildRayTree(scene, origin, dir, options = {}) {
  const { maxDepth = 5, ior, minWeight = 0.001 } = options;
  return trace('primary', origin, dir, 0, 1);

  function trace(kind, from, direction, depth, weight) {
    const hit = intersectScene(scene, from, direction);
    if (!hit) {
      return {
        kind,
        from,
        to: pointAt(from, direction, MISS_LENGTH),
        hit: false,
        depth,
        weight,
        children: [],
      };
    }

    const material = scene.materials[hit.material];
    const surface =
      hit.kind === 'quad' ? scene.quads[hit.index].label : scene.spheres[hit.index].label;
    const node = {
      kind,
      from,
      to: hit.point,
      hit: true,
      depth,
      weight,
      surface,
      material: material.name,
      inside: !hit.frontFace,
      children: [],
    };

    if (material.type === MATERIAL_TYPE.DIFFUSE) {
      node.shadow = shadowRay(hit);
      return node;
    }
    if (material.type === MATERIAL_TYPE.EMISSIVE || depth >= maxDepth) return node;

    const reflected = reflect(direction, hit.normal);
    const above = pointAt(hit.point, hit.normal, OFFSET);
    if (material.type === MATERIAL_TYPE.MIRROR) {
      const w = weight * Math.max(...material.albedo);
      if (w > minWeight) node.children.push(trace('reflected', above, reflected, depth + 1, w));
      return node;
    }

    // Glass
    const index = ior ?? material.ior;
    const n1 = hit.frontFace ? 1 : index;
    const n2 = hit.frontFace ? index : 1;
    const transmitted = refract(direction, hit.normal, n1 / n2);
    const cosI = -dot(direction, hit.normal);
    const fresnel = transmitted
      ? fresnelDielectric(cosI, -dot(transmitted, hit.normal), n1, n2)
      : 1;
    node.fresnel = fresnel;
    if (transmitted && weight * (1 - fresnel) > minWeight) {
      const below = pointAt(hit.point, hit.normal, -OFFSET);
      node.children.push(trace('refracted', below, transmitted, depth + 1, weight * (1 - fresnel)));
    }
    if (weight * fresnel > minWeight) {
      node.children.push(trace('reflected', above, reflected, depth + 1, weight * fresnel));
    }
    return node;
  }

  // Shadow ray towards the centre of the light, as in local.glsl.
  function shadowRay(hit) {
    const target = scene.light.center;
    const start = pointAt(hit.point, hit.normal, OFFSET);
    const toLight = sub(target, start);
    const distance = length(toLight);
    // A surface facing away from the light gets no shadow ray (only the ambient term).
    if (dot(toLight, hit.normal) <= 0 || dot(toLight, scene.light.normal) >= 0) {
      return { to: target, blocked: true, facesAway: true };
    }
    const blocker = intersectScene(scene, start, normalize(toLight), 1e-4, distance - 1e-4);
    if (!blocker) return { to: target, blocked: false };
    const label =
      blocker.kind === 'quad'
        ? scene.quads[blocker.index].label
        : scene.spheres[blocker.index].label;
    return { to: blocker.point, blocked: true, blocker: label };
  }
}

/** All nodes of a tree, depth first (parents before children). */
export function flattenRayTree(node, list = []) {
  list.push(node);
  for (const child of node.children) flattenRayTree(child, list);
  return list;
}
