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
import localGlsl from './shaders/local.glsl?raw';
import phongFrag from './shaders/phong.frag?raw';
import whittedFrag from './shaders/whitted.frag?raw';
import pathtracerFrag from './shaders/pathtracer.frag?raw';
import radiosityFrag from './shaders/radiosity.frag?raw';

const MAX_SAMPLES_PER_FRAME = 8;
const MAX_DEVICE_PIXEL_RATIO = 2;
const INTERACTION_SCALE = 0.5;
const FRAME_BUDGET_MS = 31; // GPU time per frame for adaptive samples: fits two 60 Hz refreshes
const CALIBRATION_DELAY = 6; // frames after a change before measuring the cost of a sample
const RECALIBRATION_FRAMES = 90;
const STATS_INTERVAL_MS = 250;

const LOCAL = { name: 'local.glsl', source: localGlsl };

/**
 * Per-mode settings. `parts` are shared GLSL files inserted between common.glsl and the
 * method; `maxSamples` stops deterministic modes once they are antialiased; `toneMapping`
 * is off for the debug view so material colors are shown as they are.
 */
const MODES = {
  phong: {
    source: phongFrag,
    file: 'phong.frag',
    parts: [LOCAL],
    maxSamples: 16,
    toneMapping: 1,
  },
  whitted: {
    source: whittedFrag,
    file: 'whitted.frag',
    parts: [LOCAL],
    maxSamples: 16,
    toneMapping: 1,
  },
  path: {
    source: pathtracerFrag,
    file: 'pathtracer.frag',
    parts: [],
    maxSamples: null, // set by params.pathMaxSamples
    // Noisy images gain little from more pixels: render path tracing at CSS resolution on
    // high-density screens (up to 4x fewer paths per sample on a 200% display).
    maxDevicePixelRatio: 1,
    toneMapping: 1,
  },
  radiosity: {
    source: radiosityFrag,
    file: 'radiosity.frag',
    parts: [],
    maxSamples: 16,
    toneMapping: 1,
  },
  debug: { source: debugFrag, file: 'debug.frag', parts: [], maxSamples: 16, toneMapping: 0 },
};

export const RENDER_MODES = Object.freeze(Object.keys(MODES));

const DEFINES = {
  MAX_QUADS: SHADER_LIMITS.MAX_QUADS,
  MAX_SPHERES: SHADER_LIMITS.MAX_SPHERES,
  MAX_MATERIALS: SHADER_LIMITS.MAX_MATERIALS,
  MAX_SAMPLES_PER_FRAME,
};

const DEFAULT_PARAMS = {
  exposure: 1.5,
  resolutionScale: 1,
  samplesPerFrame: 0, // 0 = adaptive
  debugView: 'albedo',
  phongShininess: 32,
  phongSpecular: 0.1,
  phongAmbient: 0.05,
  whittedDepth: 5,
  glassIor: 1.5,
  pathMaxBounces: 8,
  pathMaxSamples: 1024,
  pathNextEvent: true,
  pathCosineSampling: true,
  pathRussianRoulette: true,
  radiosityInterpolate: true,
  whiteBalance: true,
};

/**
 * Von Kries white balance for the scene light: per-channel gains that turn the light's color
 * into a neutral gray of the same luminance, like a camera set to that illuminant. The
 * measured Cornell light is orange, so without it the white walls look yellow.
 */
export function whiteBalanceGains(emission) {
  const luminance = 0.2126 * emission[0] + 0.7152 * emission[1] + 0.0722 * emission[2];
  return emission.map((c) => (c > 0 ? luminance / c : 1));
}

/**
 * Parameters that do not change the image being computed: the display (exposure), how fast
 * samples arrive, or where accumulation stops. Changing them keeps the accumulated samples.
 */
const KEEP_ACCUMULATION = new Set([
  'exposure',
  'whiteBalance',
  'samplesPerFrame',
  'pathMaxSamples',
  // Radiosity solve settings: the image changes only when the new solution arrives.
  'radiosityPatches',
  'radiosityMethod',
  'radiosityIterations',
  'radiosityStep',
]);

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
  let radiosityTexture = null;
  let radiosity = null; // { data: Float32Array RGBA, width, height, layout: Float32Array }
  let mode = 'phong';
  let params = { ...DEFAULT_PARAMS };

  let sampleCount = 0;
  let frameIndex = 0;
  let needsDisplay = true;
  let cssSize = { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 };
  let frameMs = 0;
  let autoSamples = 1;
  let calibrationKey = null;
  let framesSinceChange = 0; // rendered frames since the method, scene, size or settings changed
  let framesSinceCalibration = 0;
  const syncPixel = new Float32Array(4);
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
            ...config.parts,
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
    uploadRadiosity(); // after a context restore
    status('ready', { format: context.format.label });
    rafId = requestAnimationFrame(frame);
  }

  /** Copies the current radiosity solution into its float texture (one texel per patch). */
  function uploadRadiosity() {
    if (!ready || !radiosity) return;
    const { gl } = context;
    if (!radiosityTexture) {
      radiosityTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, radiosityTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, radiosityTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      radiosity.width,
      radiosity.height,
      0,
      gl.RGBA,
      gl.FLOAT,
      radiosity.data,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  function releaseGpuResources() {
    if (!context) return;
    const { gl } = context;
    if (radiosityTexture) gl.deleteTexture(radiosityTexture);
    radiosityTexture = null;
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
    const maxDpr = MODES[mode].maxDevicePixelRatio ?? MAX_DEVICE_PIXEL_RATIO;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
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
    return MODES[mode].maxSamples ?? params.pathMaxSamples;
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
    gl.uniform1i(program.loc('uMaxDepth'), params.whittedDepth);
    gl.uniform1f(program.loc('uGlassIor'), params.glassIor);
    gl.uniform1i(program.loc('uMaxBounces'), params.pathMaxBounces);
    gl.uniform1i(program.loc('uNextEvent'), params.pathNextEvent ? 1 : 0);
    gl.uniform1i(program.loc('uCosineSampling'), params.pathCosineSampling ? 1 : 0);
    gl.uniform1i(program.loc('uRussianRoulette'), params.pathRussianRoulette ? 1 : 0);

    gl.uniform1i(program.loc('uInterpolate'), params.radiosityInterpolate ? 1 : 0);
    const hasRadiosity = Boolean(radiosity && radiosityTexture && radiosity.sceneId === scene?.id);
    gl.uniform1i(program.loc('uHasRadiosity'), hasRadiosity ? 1 : 0);
    if (hasRadiosity) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, radiosityTexture);
      gl.uniform1i(program.loc('uRadiosity'), 1);
      gl.uniform4fv(program.loc('uPatchLayout'), radiosity.layout);
      gl.activeTexture(gl.TEXTURE0);
    }
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

  /** Waiting for the GPU needs a pixel read, which is only portable from float32 buffers. */
  function canSyncGpu() {
    return context.format.type === context.gl.FLOAT;
  }

  /** Blocks until the GPU has finished the queued work (reads back one pixel). */
  function syncGpu() {
    if (!canSyncGpu()) return;
    const { gl } = context;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[0].framebuffer);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, syncPixel);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Samples traced in the next pass: the user's setting, or the adaptive value when it is 0. */
  function samplesThisFrame() {
    if (params.samplesPerFrame > 0) return params.samplesPerFrame;
    return camera.interacting ? 1 : autoSamples;
  }

  /**
   * Adaptive samples per frame. Tracing one sample per frame leaves a fast GPU idle while it
   * waits for the next screen refresh (16.7 ms at 60 Hz). Frame times can only be whole
   * refresh periods, so guessing from frame intervals gets stuck (2 samples of 9 ms take two
   * refreshes, the same throughput as 1). Instead, whenever the method, scene, resolution or
   * settings change, the GPU time of one sample is measured directly (two synchronized passes)
   * and the count is chosen to fill two refresh periods: k = floor(31 ms / cost), 1 ≤ k ≤ 8.
   * The measurement waits a few frames after a change, because an idle integrated GPU runs at a
   * low clock speed for its first frames, and is repeated now and then.
   */
  function calibrateSamples() {
    const key = JSON.stringify([mode, scene?.id, targets[0].width, targets[0].height, params]);
    if (key !== calibrationKey) {
      calibrationKey = key;
      autoSamples = 1;
      framesSinceChange = 0;
    }
    framesSinceChange += 1;
    framesSinceCalibration += 1;
    // Measure on the 6th frame after a change, when an integrated GPU has left its idle clock
    // speed, and again every 90 frames in case conditions change (other tabs, power saving).
    if (framesSinceChange !== CALIBRATION_DELAY && framesSinceCalibration < RECALIBRATION_FRAMES)
      return;
    framesSinceCalibration = 0;
    if (!canSyncGpu()) return; // keep 1 sample per frame on devices without float buffers
    // Warm-up pass: the first draw after a change can include the driver finishing the
    // shader compilation, which would make the sample look several times more expensive.
    methodPass(maxSamples(), 1);
    syncGpu();
    const start = performance.now();
    methodPass(maxSamples(), 1);
    methodPass(maxSamples(), 1);
    syncGpu();
    const msPerSample = (performance.now() - start) / 2;
    autoSamples = Math.max(
      1,
      Math.min(MAX_SAMPLES_PER_FRAME, Math.floor(FRAME_BUDGET_MS / msPerSample)),
    );
  }

  function methodPass(limit = maxSamples(), perPass = samplesThisFrame()) {
    const { gl } = context;
    const [read, write] = targets;
    const program = programs[mode].use();
    const k = Math.min(perPass, limit - sampleCount, MAX_SAMPLES_PER_FRAME);

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
    const gains = params.whiteBalance ? whiteBalanceGains(scene.light.emission) : [1, 1, 1];
    gl.uniform3fv(display.loc('uWhiteBalance'), gains);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    if (disposed || !ready) return;
    rafId = requestAnimationFrame(frame);
    if (!packed || !targets[0]) return;

    const rendering = sampleCount < maxSamples();
    let perFrame = 0;
    if (rendering) {
      if (lastFrameTime) {
        const interval = now - lastFrameTime;
        frameMs = frameMs ? frameMs * 0.9 + interval * 0.1 : interval;
      }
      if (params.samplesPerFrame === 0 && !camera.interacting) calibrateSamples();
      perFrame = samplesThisFrame();
      if (sampleCount < maxSamples()) methodPass(); // calibration may have finished the image
      needsDisplay = true;
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
        samplesPerFrame: perFrame,
        autoSamples: params.samplesPerFrame === 0,
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
    radiosityTexture = null; // GPU objects die with the context; the data is re-uploaded
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
      if (changed.every((key) => KEEP_ACCUMULATION.has(key))) {
        needsDisplay = true;
      } else {
        resetAccumulation();
      }
      if (scaleChanged) resizeTargets();
    },

    /**
     * Shows a radiosity solution. `snapshot` holds one RGB radiosity per patch (n × 3) and
     * `layout` comes from the radiosity worker (patches.js). `sceneId` guards against showing
     * a solution on the wrong scene; `null` clears it.
     */
    setRadiosity(snapshot, layout, sceneId) {
      if (!snapshot) {
        radiosity = null;
        resetAccumulation();
        return;
      }
      const n = layout.patchCount;
      const width = layout.textureWidth;
      const height = layout.textureHeight;
      const data = new Float32Array(width * height * 4);
      for (let i = 0; i < n; i++) {
        data[i * 4] = snapshot[i * 3];
        data[i * 4 + 1] = snapshot[i * 3 + 1];
        data[i * 4 + 2] = snapshot[i * 3 + 2];
        data[i * 4 + 3] = 1;
      }
      const quads = new Float32Array(SHADER_LIMITS.MAX_QUADS * 4);
      layout.quads.forEach((q, i) => quads.set([q.offset, q.nu, q.nv, 0], i * 4));
      radiosity = { data, width, height, layout: quads, sceneId };
      uploadRadiosity();
      resetAccumulation();
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
      if (!canSyncGpu()) return null;
      sampleCount = 0;
      methodPass(maxSamples(), 1);
      syncGpu(); // warm-up pass, also flushes earlier work
      const start = performance.now();
      for (let i = 0; i < passes; i++) {
        sampleCount = 1; // keep the shader on its normal path without hitting maxSamples
        methodPass(maxSamples(), 1);
      }
      syncGpu();
      const msPerPass = (performance.now() - start) / passes;
      resetAccumulation();
      return {
        mode,
        msPerPass,
        width: targets[0].width,
        height: targets[0].height,
        samplesPerPass: 1,
      };
    },

    /**
     * Accumulates up to `samples` samples per pixel as fast as the GPU allows, in chunks that
     * yield to the browser so the page stays responsive and the GPU watchdog is never hit.
     * Used for high-quality captures and for the convergence checks.
     */
    async accumulate(samples) {
      if (!ready || !packed || !targets[0]) return null;
      const start = performance.now();
      while (sampleCount < samples) {
        methodPass(samples, params.samplesPerFrame || MAX_SAMPLES_PER_FRAME);
        needsDisplay = true;
        if (frameIndex % 4 === 0) {
          syncGpu(); // wait for the GPU before queueing more work
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (!ready) return null;
        }
      }
      displayPass();
      needsDisplay = false;
      return { samples: sampleCount, seconds: (performance.now() - start) / 1000 };
    },

    /**
     * The accumulated image in linear radiance (before exposure and tone mapping), as
     * {width, height, data: Float32Array RGBA}. Only available with float buffers.
     */
    readAccumulated() {
      if (!ready || !targets[0] || context.format.type !== context.gl.FLOAT) return null;
      const { gl } = context;
      const { width, height, framebuffer } = targets[0];
      const data = new Float32Array(width * height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, data);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { width, height, samples: sampleCount, data };
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
