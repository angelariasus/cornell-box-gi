import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { anglesFromCamera, cameraFrame, primaryRayDirection } from '../src/render/camera.js';
import { assembleShader, mapShaderLog } from '../src/render/gl.js';
import { intersectScene } from '../src/math/math.js';
import { createClassicScene, MAT, SHADER_LIMITS } from '../src/scene/cornell.js';

const classic = createClassicScene();

describe('assembleShader and mapShaderLog', () => {
  const parts = [
    { name: 'common.glsl', source: 'float a;\nfloat b;\n' },
    { name: 'method.frag', source: 'vec3 shade() {\n  return vec3(x);\n}' },
  ];
  const { source, sections } = assembleShader(parts, { MAX_QUADS: 24 });
  const lines = source.split('\n');

  it('starts with the version header and the defines', () => {
    expect(lines[0]).toBe('#version 300 es');
    expect(source).toContain('#define MAX_QUADS 24');
  });

  it('records the line where each part starts', () => {
    for (const section of sections) {
      const firstLine = parts.find((p) => p.name === section.name).source.split('\n')[0];
      expect(lines[section.start - 1]).toBe(firstLine);
    }
  });

  it('maps compiler errors back to file and line', () => {
    const errorLine = sections[1].start + 1; // "return vec3(x);"
    const log = `ERROR: 0:${errorLine}: 'x' : undeclared identifier`;
    expect(mapShaderLog(log, sections)).toBe("ERROR: method.frag:2: 'x' : undeclared identifier");
  });
});

describe('orbit camera math', () => {
  const home = classic.camera;
  const angles = anglesFromCamera(home.position, home.target);
  const frame = cameraFrame({ target: home.target, ...angles });

  it('reproduces the official camera from its orbit angles', () => {
    home.position.forEach((value, i) => expect(frame.position[i]).toBeCloseTo(value, 10));
    expect(angles.yaw).toBeCloseTo(0, 10);
    expect(angles.pitch).toBeCloseTo(0, 10);
  });

  it('has an orthonormal basis with +x on the left of the image', () => {
    expect(frame.right[0]).toBeCloseTo(-1, 10);
    expect(frame.up[1]).toBeCloseTo(1, 10);
  });

  it('the left edge of the image looks at the red wall, the right edge at the green one', () => {
    const at = (u) => {
      const dir = primaryRayDirection(frame, [u, 0.5], home.fovY, 1);
      return intersectScene(classic, frame.position, dir).material;
    };
    expect(at(0.02)).toBe(MAT.RED);
    expect(at(0.98)).toBe(MAT.GREEN);
  });

  it('the lower part of the image sees the floor; the very bottom passes under the open front', () => {
    const dir = (v) => primaryRayDirection(frame, [0.5, v], home.fovY, 1);
    const lower = intersectScene(classic, frame.position, dir(0.05));
    expect(classic.quads[lower.index].label).toBe('floor');
    // As in the reference photo, a thin strip below the box shows nothing.
    expect(intersectScene(classic, frame.position, dir(0.01))).toBeNull();
  });

  it('keeps the camera at the same distance while orbiting', () => {
    const moved = cameraFrame({ target: home.target, ...angles, yaw: 0.7, pitch: -0.3 });
    const d = Math.hypot(...moved.position.map((p, i) => p - home.target[i]));
    expect(d).toBeCloseTo(angles.distance, 10);
  });
});

describe('shader limits', () => {
  it('common.glsl uses the array sizes injected by the renderer', () => {
    const common = readFileSync(
      new URL('../src/render/shaders/common.glsl', import.meta.url),
      'utf8',
    );
    for (const name of Object.keys(SHADER_LIMITS)) expect(common).toContain(name);
  });
});
