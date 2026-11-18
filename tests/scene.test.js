import { describe, expect, it } from 'vitest';
import {
  add,
  cross,
  dot,
  intersectScene,
  length,
  normalize,
  scale,
  sub,
} from '../src/math/math.js';
import {
  CORNELL_SCALE,
  MAT,
  ROOM,
  SHADER_LIMITS,
  SHORT_BLOCK_TOP,
  TALL_BLOCK_TOP,
  createClassicScene,
  createScene,
  createSpheresScene,
  packScene,
} from '../src/scene/cornell.js';

const classic = createClassicScene();
const spheres = createSpheresScene();

const center = (q) => add(q.origin, scale(add(q.u, q.v), 0.5));
const area = (q) => length(cross(q.u, q.v));
const room = [ROOM.width, ROOM.height, ROOM.depth].map((x) => x * CORNELL_SCALE);
const inside = (p) => p.every((c, i) => c > 0 && c < room[i]);

describe('scene contents', () => {
  it('classic: 4 walls + 4 ceiling strips + light + two 5-face blocks = 19 quads', () => {
    expect(classic.quads).toHaveLength(19);
    expect(classic.spheres).toHaveLength(0);
    expect(classic.supportsRadiosity).toBe(true);
  });

  it('spheres: 9 room quads, mirror and glass spheres, checker floor, no radiosity', () => {
    expect(spheres.quads).toHaveLength(9);
    expect(spheres.spheres.map((s) => s.material)).toEqual([MAT.MIRROR, MAT.GLASS]);
    expect(spheres.quads.find((q) => q.label === 'floor').material).toBe(MAT.CHECKER);
    expect(spheres.supportsRadiosity).toBe(false);
  });

  it('createScene builds both scenes by id and rejects unknown ids', () => {
    expect(createScene('classic').id).toBe('classic');
    expect(createScene('spheres').id).toBe('spheres');
    expect(() => createScene('bunny')).toThrow();
  });
});

describe('geometry', () => {
  it('every quad normal is unit length and points into the room', () => {
    for (const scene of [classic, spheres]) {
      for (const q of scene.quads) {
        expect(length(q.normal)).toBeCloseTo(1, 10);
        expect(inside(add(center(q), scale(q.normal, 1e-3)))).toBe(true);
      }
    }
  });

  it('block faces point away from their block', () => {
    for (const label of ['short block', 'tall block']) {
      const faces = classic.quads.filter((q) => q.label.startsWith(label));
      expect(faces).toHaveLength(5);
      const blockCenter = scale(
        faces.map(center).reduce((a, b) => add(a, b)),
        1 / faces.length,
      );
      for (const f of faces) {
        expect(dot(f.normal, sub(center(f), blockCenter))).toBeGreaterThan(0);
      }
    }
  });

  it('regularized block tops stay within 2.8 data units of the measured corners', () => {
    for (const [label, top] of [
      ['short block', SHORT_BLOCK_TOP],
      ['tall block', TALL_BLOCK_TOP],
    ]) {
      const q = classic.quads.find((x) => x.label === `${label} top`);
      const corner2 = scale(add(add(q.origin, q.u), q.v), 1 / CORNELL_SCALE);
      const error = Math.hypot(corner2[0] - top[2][0], corner2[2] - top[2][1]);
      expect(error).toBeLessThan(2.85);
    }
  });

  it('ceiling strips and light tile the whole ceiling without overlap', () => {
    const ceiling = classic.quads.filter(
      (q) => q.label.startsWith('ceiling') || q.label === 'light',
    );
    const total = ceiling.reduce((sum, q) => sum + area(q), 0);
    expect(total).toBeCloseTo(room[0] * room[2], 10);
  });

  it('the light matches the data: 130 × 105, flush with the ceiling, facing down', () => {
    const { light } = classic;
    expect(classic.quads[light.quadIndex].label).toBe('light');
    expect(light.area).toBeCloseTo(130 * 105 * CORNELL_SCALE ** 2, 10);
    expect(light.origin[1]).toBeCloseTo(548.8 * CORNELL_SCALE, 10);
    expect(light.normal).toEqual([0, -1, 0]);
  });
});

describe('official camera', () => {
  const cam = classic.camera;
  const forward = normalize(sub(cam.target, cam.position));
  const right = normalize(cross(forward, cam.up));

  it('looks along +z with a vertical field of view of about 39.31°', () => {
    [0, 0, 1].forEach((value, i) => expect(forward[i]).toBeCloseTo(value, 10));
    expect(cam.fovY).toBeCloseTo(39.31, 2);
  });

  it('sees the red wall on the left and the green wall on the right', () => {
    const red = classic.quads.find((q) => q.material === MAT.RED);
    const green = classic.quads.find((q) => q.material === MAT.GREEN);
    expect(dot(sub(center(red), cam.position), right)).toBeLessThan(0);
    expect(dot(sub(center(green), cam.position), right)).toBeGreaterThan(0);
  });

  it('the centre ray hits the front of the tall block', () => {
    const hit = intersectScene(classic, cam.position, forward);
    expect(classic.quads[hit.index].label).toMatch(/^tall block side/);
    expect(hit.frontFace).toBe(true);
  });

  it('a ray going up under the light hits the light, not the ceiling', () => {
    const below = sub(classic.light.center, [0, 0.1, 0]);
    const hit = intersectScene(classic, below, [0, 1, 0]);
    expect(hit.material).toBe(MAT.LIGHT);
    expect(hit.frontFace).toBe(true);
  });

  it('the spheres scene: a ray from the camera to the glass sphere hits glass first', () => {
    const glass = spheres.spheres[1];
    const dir = normalize(sub(glass.center, spheres.camera.position));
    const hit = intersectScene(spheres, spheres.camera.position, dir);
    expect(hit.kind).toBe('sphere');
    expect(hit.material).toBe(MAT.GLASS);
  });
});

describe('packScene', () => {
  it('produces vec4-aligned arrays within the shader limits', () => {
    for (const scene of [classic, spheres]) {
      const packed = packScene(scene);
      expect(packed.quads).toHaveLength(scene.quads.length * 16);
      expect(packed.spheres).toHaveLength(scene.spheres.length * 8);
      expect(packed.materials).toHaveLength(scene.materials.length * 12);
      expect(packed.quadCount).toBeLessThanOrEqual(SHADER_LIMITS.MAX_QUADS);
      expect(packed.lightIndex).toBe(scene.light.quadIndex);
    }
  });

  it('stores the material id next to each quad origin', () => {
    const packed = packScene(classic);
    classic.quads.forEach((q, i) => expect(packed.quads[i * 16 + 3]).toBe(q.material));
  });
});
