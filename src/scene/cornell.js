/**
 * Cornell box scene data (report Section 1.2, Figure 2).
 *
 * Source: Cornell Program of Computer Graphics, "Cornell Box Data"
 * (https://bowers.cornell.edu/computer-graphics/data), retrieved 2026-11-17.
 *
 * Coordinate system (as in the data): y is up and the official camera looks towards +z,
 * so +x is on the LEFT of the image. The red wall is at x ≈ 556 and the green one at x = 0.
 *
 * Simplifications, documented so they can be stated in the report:
 * - The measured walls are not perfectly perpendicular: the floor and back wall end at
 *   x = 549.6–552.8 instead of 556 (at most 6.4 units, about 1%). The room is modelled as
 *   an axis-aligned box with the exact ceiling extents (556 × 548.8 × 559.2).
 * - The ceiling is split into four strips around the light opening ("ceiling hole" in the
 *   data), so the light sits flush at y = 548.8 without overlapping the ceiling.
 * - Each block top is turned into a parallelogram from three of its measured corners; the
 *   fourth corner moves by at most 2.8 units. This keeps every block a closed solid.
 *
 * Every surface is a parallelogram ("quad": corner `origin` plus edge vectors `u`, `v`) or
 * a sphere, the two primitives the shaders intersect analytically. All lengths are divided
 * by 555 (`CORNELL_SCALE`) so the box is about one unit in size.
 */

import { add, cross, dot, length, negate, normalize, scale, sub } from '../math/math.js';

/** Data units → scene units. */
export const CORNELL_SCALE = 1 / 555;

/** Room size in data units (exact ceiling extents). */
export const ROOM = { width: 556.0, height: 548.8, depth: 559.2 };

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

export const MATERIAL_TYPE = Object.freeze({ DIFFUSE: 0, MIRROR: 1, GLASS: 2, EMISSIVE: 3 });

/** Material ids, used as indices into `MATERIALS` and in the shader. */
export const MAT = Object.freeze({
  WHITE: 0,
  RED: 1,
  GREEN: 2,
  LIGHT: 3,
  MIRROR: 4,
  GLASS: 5,
  CHECKER: 6,
});

/*
 * Diffuse reflectances are the usual RGB approximations of the measured spectra, as used
 * by reference renderers. Spot values from the Cornell table at 650 / 550 / 450 nm:
 *   white ≈ (0.73, 0.73, 0.77), red ≈ (0.61, 0.06, 0.06), green ≈ (0.12, 0.37, 0.10).
 *
 * Light emission is the measured spectrum (400: 0, 500: 8, 600: 15.6, 700: 18.4) linearly
 * interpolated at 650 / 550 / 450 nm → (17.0, 11.8, 4.0). The data also gives the light a
 * constant reflectance of 0.78.
 */
export const MATERIALS = Object.freeze([
  { id: MAT.WHITE, name: 'white', type: MATERIAL_TYPE.DIFFUSE, albedo: [0.725, 0.71, 0.68] },
  { id: MAT.RED, name: 'red', type: MATERIAL_TYPE.DIFFUSE, albedo: [0.63, 0.065, 0.05] },
  { id: MAT.GREEN, name: 'green', type: MATERIAL_TYPE.DIFFUSE, albedo: [0.14, 0.45, 0.091] },
  {
    id: MAT.LIGHT,
    name: 'light',
    type: MATERIAL_TYPE.EMISSIVE,
    albedo: [0.78, 0.78, 0.78],
    emission: [17.0, 11.8, 4.0],
  },
  { id: MAT.MIRROR, name: 'mirror', type: MATERIAL_TYPE.MIRROR, albedo: [0.95, 0.95, 0.95] },
  { id: MAT.GLASS, name: 'glass', type: MATERIAL_TYPE.GLASS, albedo: [1, 1, 1], ior: 1.5 },
  {
    id: MAT.CHECKER,
    name: 'checker floor',
    type: MATERIAL_TYPE.DIFFUSE,
    albedo: [0.725, 0.71, 0.68],
    albedo2: [0.15, 0.15, 0.15],
    checkerTiles: 8,
  },
]);

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

/**
 * Official camera from the data: position, direction (0, 0, 1), up (0, 1, 0), focal length
 * 0.035 and a 0.025 × 0.025 film. The orbit target lies on the view axis at the centre of
 * the room's depth, so orbiting starts from exactly the official view.
 */
const FOCAL_LENGTH = 0.035;
const FILM_SIZE = 0.025;

export const OFFICIAL_CAMERA = Object.freeze({
  position: [278, 273, -800],
  target: [278, 273, ROOM.depth / 2],
  up: [0, 1, 0],
  fovY: (2 * Math.atan(FILM_SIZE / 2 / FOCAL_LENGTH) * 180) / Math.PI, // ≈ 39.31°
});

// ---------------------------------------------------------------------------
// Builders (data units)
// ---------------------------------------------------------------------------

/**
 * A parallelogram with its unit normal flipped, if needed, to agree with `facing`.
 * The normal marks the visible side: into the room for walls, away from the block for
 * block faces, downwards for the light.
 */
function makeQuad(label, origin, u, v, material, facing) {
  let normal = normalize(cross(u, v));
  if (dot(normal, facing) < 0) normal = negate(normal);
  return { label, origin, u, v, normal, material };
}

const quadCenter = (q) => add(q.origin, scale(add(q.u, q.v), 0.5));

function roomQuads({ leftWall, rightWall }) {
  const { width: W, height: H, depth: D } = ROOM;
  // Light opening in the ceiling (data: x 213–343, z 227–332).
  const [x0, x1, z0, z1] = [213, 343, 227, 332];

  return [
    makeQuad('floor', [0, 0, 0], [W, 0, 0], [0, 0, D], MAT.WHITE, [0, 1, 0]),
    makeQuad('back wall', [0, 0, D], [W, 0, 0], [0, H, 0], MAT.WHITE, [0, 0, -1]),
    makeQuad('right wall', [0, 0, 0], [0, 0, D], [0, H, 0], rightWall, [1, 0, 0]),
    makeQuad('left wall', [W, 0, 0], [0, 0, D], [0, H, 0], leftWall, [-1, 0, 0]),
    makeQuad('ceiling front', [0, H, 0], [W, 0, 0], [0, 0, z0], MAT.WHITE, [0, -1, 0]),
    makeQuad('ceiling back', [0, H, z1], [W, 0, 0], [0, 0, D - z1], MAT.WHITE, [0, -1, 0]),
    makeQuad('ceiling right', [0, H, z0], [x0, 0, 0], [0, 0, z1 - z0], MAT.WHITE, [0, -1, 0]),
    makeQuad('ceiling left', [x1, H, z0], [W - x1, 0, 0], [0, 0, z1 - z0], MAT.WHITE, [0, -1, 0]),
    makeQuad('light', [x0, H, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], MAT.LIGHT, [0, -1, 0]),
  ];
}

/**
 * A block from its four measured top corners (x, z) and its height. Corners 0, 1 and 3 fix
 * the parallelogram; corner 2 becomes c1 + c3 - c0 so the faces close exactly.
 */
function blockQuads(label, topXZ, height, material) {
  const [c0, c1, , c3] = topXZ.map(([x, z]) => [x, 0, z]);
  const e1 = sub(c1, c0);
  const e3 = sub(c3, c0);
  const c2 = add(c1, e3);
  const corners = [c0, c1, c2, c3];
  const up = [0, height, 0];
  const center = add(scale(add(c0, c2), 0.5), scale(up, 0.5));

  const top = makeQuad(`${label} top`, add(c0, up), e1, e3, material, [0, 1, 0]);
  const sides = corners.map((start, i) => {
    const end = corners[(i + 1) % 4];
    const edge = sub(end, start);
    const sideCenter = add(add(start, scale(edge, 0.5)), scale(up, 0.5));
    return makeQuad(`${label} side ${i + 1}`, start, edge, up, material, sub(sideCenter, center));
  });
  return [top, ...sides];
}

/** Measured top corners (x, z) of both blocks, in the order listed by the data. */
export const SHORT_BLOCK_TOP = [
  [130, 65],
  [82, 225],
  [240, 272],
  [290, 114],
];
export const TALL_BLOCK_TOP = [
  [423, 247],
  [265, 296],
  [314, 456],
  [472, 406],
];

// ---------------------------------------------------------------------------
// Normalization and derived data
// ---------------------------------------------------------------------------

function normalizeScene(scene) {
  const s = CORNELL_SCALE;
  const quads = scene.quads.map((q) => ({
    ...q,
    origin: scale(q.origin, s),
    u: scale(q.u, s),
    v: scale(q.v, s),
  }));
  const spheres = scene.spheres.map((sp) => ({
    ...sp,
    center: scale(sp.center, s),
    radius: sp.radius * s,
  }));
  const camera = {
    ...OFFICIAL_CAMERA,
    position: scale(OFFICIAL_CAMERA.position, s),
    target: scale(OFFICIAL_CAMERA.target, s),
  };

  const lightIndex = quads.findIndex((q) => q.material === MAT.LIGHT);
  const lq = quads[lightIndex];
  const light = {
    quadIndex: lightIndex,
    origin: lq.origin,
    u: lq.u,
    v: lq.v,
    normal: lq.normal,
    center: quadCenter(lq),
    area: length(cross(lq.u, lq.v)),
    emission: MATERIALS[MAT.LIGHT].emission,
  };

  return { ...scene, quads, spheres, camera, light, materials: MATERIALS };
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

/** Scene A: the measured Cornell box with its two white blocks. Everything is diffuse. */
export function createClassicScene() {
  return normalizeScene({
    id: 'classic',
    name: 'Classic (two blocks)',
    supportsRadiosity: true,
    quads: [
      ...roomQuads({ leftWall: MAT.RED, rightWall: MAT.GREEN }),
      ...blockQuads('short block', SHORT_BLOCK_TOP, 165, MAT.WHITE),
      ...blockQuads('tall block', TALL_BLOCK_TOP, 330, MAT.WHITE),
    ],
    spheres: [],
  });
}

/**
 * Scene B: same room and light, a mirror sphere and a glass sphere, and a checker floor
 * that makes reflection and refraction easy to see. Radiosity does not apply (not diffuse).
 */
export function createSpheresScene() {
  const quads = roomQuads({ leftWall: MAT.RED, rightWall: MAT.GREEN }).map((q) =>
    q.label === 'floor' ? { ...q, material: MAT.CHECKER } : q,
  );
  return normalizeScene({
    id: 'spheres',
    name: 'Spheres (mirror and glass)',
    supportsRadiosity: false,
    quads,
    // The spheres float 1 data unit (0.2% of their size) above the floor. Touching it
    // exactly leaves a gap thinner than the ray offset near the contact point, where
    // refracted rays would slip under the floor and show a black spot.
    spheres: [
      { label: 'mirror sphere', center: [370, 101, 370], radius: 100, material: MAT.MIRROR },
      { label: 'glass sphere', center: [185, 101, 170], radius: 100, material: MAT.GLASS },
    ],
  });
}

export const SCENE_IDS = Object.freeze(['classic', 'spheres']);

export function createScene(id) {
  if (id === 'classic') return createClassicScene();
  if (id === 'spheres') return createSpheresScene();
  throw new Error(`Unknown scene: ${id}`);
}

// ---------------------------------------------------------------------------
// Packing for the shaders
// ---------------------------------------------------------------------------

/** Array sizes declared in the shaders. Keep in sync with `common.glsl`. */
export const SHADER_LIMITS = Object.freeze({
  MAX_QUADS: 24,
  MAX_SPHERES: 4,
  MAX_MATERIALS: 8,
  MAX_GROUPS: 4,
});

/**
 * Groups of quads that form one object (the blocks), with their axis-aligned bounding box.
 * A ray that misses the box cannot hit any of its quads, so the shaders skip all of them.
 * The room quads come first and are always tested; the quads of a group are consecutive.
 */
export function quadGroups(scene) {
  const groups = [];
  scene.quads.forEach((q, index) => {
    const name = q.label.match(/^(.*block)/)?.[1];
    if (!name) return;
    let group = groups.find((g) => g.name === name);
    if (!group) {
      group = {
        name,
        first: index,
        count: 0,
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
      };
      groups.push(group);
    }
    if (index !== group.first + group.count)
      throw new Error(`Quads of ${name} are not consecutive`);
    group.count += 1;
    const corners = [
      q.origin,
      add(q.origin, q.u),
      add(q.origin, q.v),
      add(add(q.origin, q.u), q.v),
    ];
    for (const c of corners) {
      for (let k = 0; k < 3; k++) {
        group.min[k] = Math.min(group.min[k], c[k]);
        group.max[k] = Math.max(group.max[k], c[k]);
      }
    }
  });
  const roomQuadCount = groups.length ? groups[0].first : scene.quads.length;
  groups.forEach((g, i) => {
    const expected = i === 0 ? roomQuadCount : groups[i - 1].first + groups[i - 1].count;
    if (g.first !== expected) throw new Error('Grouped quads must follow the room quads');
  });
  if (groups.length && groups.at(-1).first + groups.at(-1).count !== scene.quads.length) {
    throw new Error('Grouped quads must be the last quads of the scene');
  }
  return { roomQuadCount, groups };
}

/**
 * Flattens a scene into vec4-aligned Float32Arrays for `uniform vec4` arrays:
 * - quads, 4 × vec4 each: (origin, material), (u, 0), (v, 0), (normal, 0)
 * - spheres, 2 × vec4 each: (center, radius), (material, 0, 0, 0)
 * - materials, 3 × vec4 each: (albedo, type), (emission, ior), (albedo2, checkerTiles)
 * - groups, 2 × vec4 each: (box min, first quad), (box max, quad count)
 */
export function packScene(scene) {
  const { MAX_QUADS, MAX_SPHERES, MAX_MATERIALS } = SHADER_LIMITS;
  if (scene.quads.length > MAX_QUADS) throw new Error('Too many quads for the shader');
  if (scene.spheres.length > MAX_SPHERES) throw new Error('Too many spheres for the shader');
  if (scene.materials.length > MAX_MATERIALS) throw new Error('Too many materials for the shader');

  const quads = new Float32Array(scene.quads.length * 16);
  scene.quads.forEach((q, i) => {
    quads.set([...q.origin, q.material, ...q.u, 0, ...q.v, 0, ...q.normal, 0], i * 16);
  });

  const spheres = new Float32Array(scene.spheres.length * 8);
  scene.spheres.forEach((sp, i) => {
    spheres.set([...sp.center, sp.radius, sp.material, 0, 0, 0], i * 8);
  });

  const materials = new Float32Array(scene.materials.length * 12);
  scene.materials.forEach((m, i) => {
    materials.set(
      [
        ...m.albedo,
        m.type,
        ...(m.emission ?? [0, 0, 0]),
        m.ior ?? 1,
        ...(m.albedo2 ?? m.albedo),
        m.checkerTiles ?? 0,
      ],
      i * 12,
    );
  });

  const { roomQuadCount, groups: groupList } = quadGroups(scene);
  if (groupList.length > SHADER_LIMITS.MAX_GROUPS)
    throw new Error('Too many groups for the shader');
  const groups = new Float32Array(Math.max(1, groupList.length) * 8);
  groupList.forEach((g, i) => groups.set([...g.min, g.first, ...g.max, g.count], i * 8));

  return {
    quadCount: scene.quads.length,
    roomQuadCount,
    groupCount: groupList.length,
    groups,
    sphereCount: scene.spheres.length,
    materialCount: scene.materials.length,
    lightIndex: scene.light.quadIndex,
    quads,
    spheres,
    materials,
  };
}
