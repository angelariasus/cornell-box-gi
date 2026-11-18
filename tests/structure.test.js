import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

// Files every phase builds on. Keeps the layout described in PLAN.md honest.
const requiredFiles = [
  'src/main.js',
  'src/App.svelte',
  'src/state/params.js',
  'src/scene/cornell.js',
  'src/math/math.js',
  'src/render/renderer.js',
  'src/render/gl.js',
  'src/render/camera.js',
  'src/render/shaders/quad.vert',
  'src/render/shaders/common.glsl',
  'src/render/shaders/display.frag',
  'src/render/shaders/phong.frag',
  'src/render/shaders/whitted.frag',
  'src/render/shaders/pathtracer.frag',
  'src/render/shaders/radiosity.frag',
  'src/radiosity/patches.js',
  'src/radiosity/formFactors.js',
  'src/radiosity/solvers.js',
  'src/radiosity/solve.js',
  'src/radiosity/worker.js',
];

describe('project structure', () => {
  it.each(requiredFiles)('%s exists', (file) => {
    expect(existsSync(root + file)).toBe(true);
  });
});
