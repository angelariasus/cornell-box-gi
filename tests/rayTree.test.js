import { describe, expect, it } from 'vitest';
import { normalize, sub } from '../src/math/math.js';
import { buildRayTree, flattenRayTree } from '../src/math/rayTree.js';
import { createClassicScene, createSpheresScene } from '../src/scene/cornell.js';

const spheres = createSpheresScene();
const classic = createClassicScene();
const eye = spheres.camera.position;
const towards = (point) => normalize(sub(point, eye));
const glass = spheres.spheres.find((s) => s.label === 'glass sphere');
const mirror = spheres.spheres.find((s) => s.label === 'mirror sphere');

describe('Whitted ray tree (Figure 7)', () => {
  it('a diffuse hit ends the branch with a shadow ray towards the light', () => {
    const tree = buildRayTree(classic, classic.camera.position, [0, 0, 1]);
    expect(tree.kind).toBe('primary');
    expect(tree.surface).toMatch(/^tall block/);
    expect(tree.children).toHaveLength(0);
    expect(tree.shadow).toBeDefined();
  });

  it('shadow rays are blocked behind the blocks and free elsewhere', () => {
    const cam = classic.camera;
    const outcomes = { free: 0, blocked: 0, facesAway: 0 };
    for (let a = -0.3; a <= 0.3; a += 0.05) {
      for (let b = -0.3; b <= 0.3; b += 0.05) {
        const tree = buildRayTree(classic, cam.position, normalize([a, b, 1]));
        if (!tree.shadow) continue;
        if (tree.shadow.facesAway) outcomes.facesAway += 1;
        else if (tree.shadow.blocked) outcomes.blocked += 1;
        else outcomes.free += 1;
      }
    }
    expect(outcomes.free).toBeGreaterThan(0);
    expect(outcomes.blocked).toBeGreaterThan(0);
  });

  it('glass spawns a refracted and a reflected ray whose weights add up to the parent', () => {
    const tree = buildRayTree(spheres, eye, towards(glass.center), { maxDepth: 5 });
    expect(tree.material).toBe('glass');
    const kinds = tree.children.map((c) => c.kind).sort();
    expect(kinds).toEqual(['reflected', 'refracted']);
    const sum = tree.children.reduce((s, c) => s + c.weight, 0);
    expect(sum).toBeCloseTo(1, 10);
    const refracted = tree.children.find((c) => c.kind === 'refracted');
    expect(refracted.inside).toBe(true); // it travels inside the glass and hits it from within
  });

  it('a mirror spawns exactly one reflected ray, scaled by its reflectance', () => {
    const tree = buildRayTree(spheres, eye, towards(mirror.center), { maxDepth: 5 });
    expect(tree.material).toBe('mirror');
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].kind).toBe('reflected');
    expect(tree.children[0].weight).toBeCloseTo(0.95, 10);
  });

  it('respects the depth limit: depth 0 has no secondary rays, depth 1 no grandchildren', () => {
    const depth0 = buildRayTree(spheres, eye, towards(glass.center), { maxDepth: 0 });
    expect(flattenRayTree(depth0)).toHaveLength(1);
    const depth1 = buildRayTree(spheres, eye, towards(glass.center), { maxDepth: 1 });
    expect(Math.max(...flattenRayTree(depth1).map((n) => n.depth))).toBe(1);
  });

  it('with glass index 1 the ray passes straight through without reflecting', () => {
    const tree = buildRayTree(spheres, eye, towards(glass.center), { maxDepth: 5, ior: 1 });
    expect(tree.children.map((c) => c.kind)).toEqual(['refracted']);
    expect(tree.children[0].weight).toBeCloseTo(1, 10);
  });
});
