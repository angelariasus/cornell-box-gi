/**
 * Renderer: frame loop, progressive accumulation, mode switching and the public API used by
 * the UI (PLAN.md, section 3.4).
 *
 * Every frame:
 *   1. method pass: the selected method's fragment shader traces k samples per pixel and
 *      blends them into a float render target (ping-pong between two targets);
 *   2. display pass: exposure + tone mapping + sRGB into the canvas.
 * Svelte never draws: it only calls setScene / setMode / setParams.
 */

import { packScene, SHADER_LIMITS } from '../scene/cornell.js';
import { OrbitCamera } from './camera.js';
import {
  assembleShader,
  compileProgram,
  createContext,
  createTarget,
  deleteTarget,
  ShaderError,
} from './gl.js';

import quadVert from './shaders/quad.vert?raw';
import commonGlsl from './shaders/common.glsl?raw';
import accumulateGlsl from './shaders/accumulate.glsl?raw';
import displayFrag from './shaders/display.frag?raw';
import debugFrag from './shaders/debug.frag?raw';
import phongFrag from './shaders/phong.frag?raw';

const MAX_SAMPLES_PER_FRAME = 8;
const MAX_DEVICE_PIXEL_RATIO = 2;
const INTERACTION_SCALE = 0.5;
const STATS_INTERVAL_MS = 250;

/**
 * Per-mode settings. `maxSamples` stops deterministic modes once they are antialiased;
 * `toneMapping` is off for the debug view so material colors are shown as they are.
 */
const MODES = {
  phong: { source: phongFrag, file: 'phong.frag', maxSamples: 16, toneMapping: 1 },
  debug: { source: debugFrag, file: 'debug.frag', maxSamples: 16, toneMapping: 0 },
};

export const RENDER_MODES = Object.freeze(Object.keys(MODES));

const DEFINES = {
  MAX_QUADS: SHADER_LIMITS.MAX_QUADS,
  MAX_SPHERES: SHADER_LIMITS.MAX_SPHERES,
  MAX_MATERIALS: SHADER_LIMITS.MAX_MATERIALS,
  MAX_SAMPLES_PER_FRAME,
};

const DEFAULT_PARAMS = {
  exposure: 1,
  resolutionScale: 1,
  samplesPerFrame: 1,
  debugView: 'albedo',
  phongShininess: 32,
  phongSpecular: 0.1,
  phongAmbient: 0.05,
};

/** Parameters that only affect the display pass: changing them keeps the accumulation. */
const DISPLAY_ONLY = new Set(['exposure']);

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{onStats?: Function, onStatus?: Function}} callbacks
 */
export function createRenderer(canvas, { onStats, onStatus } = {}) {
  let context = null;
  let programs = {}; // mode -> Program
  let display = null;
  let vao = null;
  let targets = [null, null]; // ping-pong: [read, write]
  let rafId = 0;
  let disposed = false;
  let ready = false;

  let scene = null;
  let packed = null;
  let mode = 'phong';
  let params = { ...DEFAULT_PARAMS };

  let sampleCount = 0;
  let frameIndex = 0;
  let needsDisplay = true;
  let cssSize = { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 };
  let frameMs = 0;
  let lastFrameTime = 0;
  let lastStatsTime = 0;

  const status = (state, extra = {}) => onStatus?.({ state, ...extra });

  const camera = new OrbitCamera(
    canvas,
    { position: [0, 0, -1], target: [0, 0, 0], fovY: 40 },
    () => resetAccumulation(),
  );

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  async function init() {
    ready = false;
    context = createContext(canvas);
    if (!context) {
      status('no-webgl2');
      return;
    }
    const { gl } = context;
    vao = gl.createVertexArray();

    status('compiling', { format: context.format.label });
    try {
      const vertex = assembleShader([{ name: 'quad.vert', source: quadVert }]);
      display = await compileProgram(
        context,
        vertex,
        assembleShader([{ name: 'display.frag', source: displayFrag }]),
      );
      for (const [name, config] of Object.entries(MODES)) {
        const fragment = assembleShader(
          [
            { name: 'common.glsl', source: commonGlsl },
            { name: config.file, source: config.source },
            { name: 'accumulate.glsl', source: accumulateGlsl },
          ],
          DEFINES,
        );
        programs[name] = await compileProgram(context, vertex, fragment);
      }
    } catch (error) {
      if (disposed) return;
      status('error', { message: error instanceof ShaderError ? error.message : String(error) });
      console.error(error);
      return;
    }
    if (disposed) return;

    ready = true;
    resizeTargets(true);
    status('ready', { format: context.format.label });
    rafId = requestAnimationFrame(frame);
  }

  function releaseGpuResources() {
    if (!context) return;
    const { gl } = context;
    targets.forEach((target) => deleteTarget(gl, target));
    targets = [null, null];
    Object.values(programs).forEach((program) => program.dispose());
    programs = {};
    display?.dispose();
    display = null;
    if (vao) gl.deleteVertexArray(vao);
    vao = null;
  }

  // -------------------------------------------------------------------------
  // Size
  // -------------------------------------------------------------------------

  const resizeObserver = new ResizeObserver(([entry]) => {
    const box = entry.contentRect;
    cssSize = { width: Math.max(1, box.width), height: Math.max(1, box.height) };
    resizeTargets();
  });
  resizeObserver.observe(canvas);

  function renderSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    const interaction = camera.interacting ? INTERACTION_SCALE : 1;
    const factor = dpr * params.resolutionScale * interaction;
    return {
      width: Math.max(1, Math.round(cssSize.width * factor)),
      height: Math.max(1, Math.round(cssSize.height * factor)),
    };
  }

  function resizeTargets(force = false) {
    if (!ready) return;
    const { width, height } = renderSize();
    if (!force && targets[0] && targets[0].width === width && targets[0].height === height) return;

    const { gl, format } = context;
    canvas.width = width;
    canvas.height = height;
    targets.forEach((target) => deleteTarget(gl, target));
    targets = [createTarget(gl, width, height, format), createTarget(gl, width, height, format)];
    if (!targets[0] || !targets[1])
      status('error', { message: 'Could not create render targets.' });
    resetAccumulation();
  }

  // -------------------------------------------------------------------------
  // Frame loop
  // -------------------------------------------------------------------------

  function resetAccumulation() {
    sampleCount = 0;
    needsDisplay = true;
    resizeTargets(); // the camera may have started or stopped interacting
  }

  function maxSamples() {
    return MODES[mode].maxSamples;
  }

  function setSceneUniforms(program) {
    const { gl } = context;
    gl.uniform4fv(program.loc('uQuads'), packed.quads);
    if (packed.sphereCount > 0) gl.uniform4fv(program.loc('uSpheres'), packed.spheres);
    gl.uniform4fv(program.loc('uMaterials'), packed.materials);
    gl.uniform1i(program.loc('uQuadCount'), packed.quadCount);
    gl.uniform1i(program.loc('uSphereCount'), packed.sphereCount);
    gl.uniform1i(program.loc('uLightIndex'), packed.lightIndex);
  }

  /** Method-specific settings. Uniforms a program does not declare are ignored by WebGL. */
  function setMethodUniforms(program) {
    const { gl } = context;
    gl.uniform1i(program.loc('uDebugView'), params.debugView === 'normals' ? 1 : 0);
    gl.uniform1f(program.loc('uShininess'), params.phongShininess);
    gl.uniform1f(program.loc('uSpecular'), params.phongSpecular);
    gl.uniform1f(program.loc('uAmbient'), params.phongAmbient);
  }

  function setCameraUniforms(program, width, height) {
    const { gl } = context;
    const f = camera.frame();
    gl.uniform3fv(program.loc('uCamPos'), f.position);
    gl.uniform3fv(program.loc('uCamForward'), f.forward);
    gl.uniform3fv(program.loc('uCamRight'), f.right);
    gl.uniform3fv(program.loc('uCamUp'), f.up);
    // The official view is square. On portrait screens keep the horizontal field of view
    // instead, so the whole box stays visible.
    const aspect = width / height;
    const tanHalfFov = Math.tan((camera.fovY * Math.PI) / 360) / Math.min(aspect, 1);
    gl.uniform1f(program.loc('uTanHalfFov'), tanHalfFov);
    gl.uniform1f(program.loc('uAspect'), aspect);
  }

  function methodPass() {
    const { gl } = context;
    const [read, write] = targets;
    const program = programs[mode].use();
    const k = Math.min(params.samplesPerFrame, maxSamples() - sampleCount, MAX_SAMPLES_PER_FRAME);

    gl.bindFramebuffer(gl.FRAMEBUFFER, write.framebuffer);
    gl.viewport(0, 0, write.width, write.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform1i(program.loc('uPrevious'), 0);
    gl.uniform1f(program.loc('uSampleCount'), sampleCount);
    gl.uniform1i(program.loc('uSamplesPerFrame'), k);
    gl.uniform1ui(program.loc('uFrame'), frameIndex);
    gl.uniform2f(program.loc('uResolution'), write.width, write.height);
    setMethodUniforms(program);
    setSceneUniforms(program);
    setCameraUniforms(program, write.width, write.height);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    targets = [write, read];
    sampleCount += k;
    frameIndex = (frameIndex + 1) >>> 0;
  }

  function displayPass() {
    const { gl } = context;
    display.use();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[0].texture);
    gl.uniform1i(display.loc('uAccumulated'), 0);
    gl.uniform1f(display.loc('uExposure'), params.exposure);
    gl.uniform1i(display.loc('uToneMapping'), MODES[mode].toneMapping);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    if (disposed || !ready) return;
    rafId = requestAnimationFrame(frame);
    if (!packed || !targets[0]) return;

    const rendering = sampleCount < maxSamples();
    if (rendering) {
      methodPass();
      needsDisplay = true;
      if (lastFrameTime)
        frameMs = frameMs ? frameMs * 0.9 + (now - lastFrameTime) * 0.1 : now - lastFrameTime;
      lastFrameTime = now;
    } else {
      lastFrameTime = 0;
    }
    if (needsDisplay) {
      displayPass();
      needsDisplay = false;
    }
    if (now - lastStatsTime > STATS_INTERVAL_MS) {
      lastStatsTime = now;
      onStats?.({
        mode,
        samples: sampleCount,
        maxSamples: maxSamples(),
        converged: !rendering,
        width: targets[0].width,
        height: targets[0].height,
        frameMs: rendering ? frameMs : 0,
        format: context.format.label,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Context loss
  // -------------------------------------------------------------------------

  function onContextLost(event) {
    event.preventDefault(); // allows the browser to restore the context
    ready = false;
    cancelAnimationFrame(rafId);
    targets = [null, null];
    programs = {};
    display = null;
    vao = null;
    status('context-lost');
  }

  function onContextRestored() {
    init();
  }

  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  init();

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  return {
    /** @param {ReturnType<import('../scene/cornell.js').createScene>} next */
    setScene(next) {
      const sameScene = scene?.id === next.id;
      scene = next;
      packed = packScene(next);
      if (!sameScene) camera.setHome(next.camera);
      resetAccumulation();
    },

    setMode(next) {
      if (!MODES[next]) throw new Error(`Unknown render mode: ${next}`);
      if (next === mode) return;
      mode = next;
      resetAccumulation();
    },

    setParams(next) {
      const merged = { ...params, ...next };
      const changed = Object.keys(merged).filter((key) => merged[key] !== params[key]);
      if (changed.length === 0) return;
      const scaleChanged = merged.resolutionScale !== params.resolutionScale;
      params = merged;
      if (changed.every((key) => DISPLAY_ONLY.has(key))) {
        needsDisplay = true;
      } else {
        resetAccumulation();
      }
      if (scaleChanged) resizeTargets();
    },

    /** Moves the camera back to the official Cornell view. */
    resetCamera() {
      camera.reset();
    },

    /** Restarts the accumulation from zero samples. */
    restart() {
      resetAccumulation();
    },

    /**
     * GPU cost of the current method: renders `passes` method passes back to back, waits for
     * the GPU (readPixels forces a sync) and returns the average milliseconds per pass. The
     * frame-time statistic cannot be used for this in a background tab, where the browser
     * throttles requestAnimationFrame. The accumulation restarts afterwards.
     */
    benchmark(passes = 10) {
      if (!ready || !packed || !targets[0]) return null;
      const { gl } = context;
      const pixel = new Float32Array(4);
      const sync = () => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, targets[0].framebuffer);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixel);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      };
      sampleCount = 0;
      methodPass();
      sync(); // warm-up pass, also flushes earlier work
      const start = performance.now();
      for (let i = 0; i < passes; i++) {
        sampleCount = 1; // keep the shader on its normal path without hitting maxSamples
        methodPass();
      }
      sync();
      const msPerPass = (performance.now() - start) / passes;
      resetAccumulation();
      return {
        mode,
        msPerPass,
        width: targets[0].width,
        height: targets[0].height,
        samplesPerPass: params.samplesPerFrame,
      };
    },

    /** PNG of the current image. */
    capture() {
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    },

    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      camera.dispose();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      releaseGpuResources();
    },
  };
}
