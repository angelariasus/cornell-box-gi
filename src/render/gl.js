/**
 * WebGL2 helpers: context creation, shader assembly and compilation, render targets.
 *
 * GLSL ES has no #include, so fragment shaders are assembled from named parts
 * (common code, the method, the accumulation entry point). Compile errors are mapped back
 * to "file:line" so they point at the right source file.
 */

export const GLSL_HEADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

// ---------------------------------------------------------------------------
// Context and render target format
// ---------------------------------------------------------------------------

/**
 * Creates a WebGL2 context and picks the best color format for accumulation:
 * 32-bit float, then 16-bit float, then 8-bit as a last resort (visible banding).
 */
export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true, // lets the canvas be captured as PNG at any time
    powerPreference: 'high-performance',
  });
  if (!gl) return null;

  let format;
  if (gl.getExtension('EXT_color_buffer_float')) {
    format = { internalFormat: gl.RGBA32F, type: gl.FLOAT, label: 'float32' };
  } else if (gl.getExtension('EXT_color_buffer_half_float')) {
    format = { internalFormat: gl.RGBA16F, type: gl.HALF_FLOAT, label: 'float16' };
  } else {
    format = { internalFormat: gl.RGBA8, type: gl.UNSIGNED_BYTE, label: 'unorm8' };
  }

  const parallelCompile = gl.getExtension('KHR_parallel_shader_compile');
  return { gl, format, parallelCompile };
}

/** A texture plus framebuffer the method passes render into. Returns null if incomplete. */
export function createTarget(gl, width, height, format) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, format.internalFormat, width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  if (!complete) {
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    return null;
  }
  return { texture, framebuffer, width, height };
}

export function deleteTarget(gl, target) {
  if (!target) return;
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

// ---------------------------------------------------------------------------
// Shader assembly
// ---------------------------------------------------------------------------

/**
 * Joins named GLSL parts after the version header and `#define`s. Returns the source and,
 * for each part, the line where it starts, so compiler errors can be mapped back.
 *
 * @param {{name: string, source: string}[]} parts
 * @param {Record<string, string | number>} defines
 */
export function assembleShader(parts, defines = {}) {
  const defineLines = Object.entries(defines).map(([key, value]) => `#define ${key} ${value}`);
  const prelude = GLSL_HEADER + defineLines.join('\n') + '\n';

  let source = prelude;
  let line = prelude.split('\n').length; // 1-based line where the next part starts
  const sections = [];
  for (const part of parts) {
    const text = part.source.endsWith('\n') ? part.source : part.source + '\n';
    sections.push({ name: part.name, start: line });
    source += text;
    line += text.split('\n').length - 1;
  }
  return { source, sections };
}

/** Rewrites "ERROR: 0:LINE:" in a compiler log as "ERROR: file:line:". */
export function mapShaderLog(log, sections) {
  return log.replace(/(ERROR|WARNING): \d+:(\d+):/g, (match, kind, lineText) => {
    const lineNumber = Number(lineText);
    const section = [...sections].reverse().find((s) => lineNumber >= s.start);
    if (!section) return match;
    return `${kind}: ${section.name}:${lineNumber - section.start + 1}:`;
  });
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export class ShaderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ShaderError';
  }
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/**
 * Compiles and links a program without blocking the page when
 * KHR_parallel_shader_compile is available (long shaders can take seconds on Windows).
 *
 * @returns {Promise<Program>}
 */
export async function compileProgram(context, vertex, fragment) {
  const { gl, parallelCompile } = context;

  const compile = (type, assembled) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, assembled.source);
    gl.compileShader(shader);
    return shader;
  };

  const vs = compile(gl.VERTEX_SHADER, vertex);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (parallelCompile) {
    while (!gl.getProgramParameter(program, parallelCompile.COMPLETION_STATUS_KHR)) {
      await nextFrame();
    }
  } else {
    await nextFrame(); // give the UI one frame to show "Compiling shaders…"
  }

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const logs = [
      mapShaderLog(gl.getShaderInfoLog(vs) ?? '', vertex.sections),
      mapShaderLog(gl.getShaderInfoLog(fs) ?? '', fragment.sections),
      gl.getProgramInfoLog(program) ?? '',
    ].filter((text) => text.trim());
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new ShaderError(logs.join('\n'));
  }

  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return new Program(gl, program);
}

/** A linked program with cached uniform locations. */
export class Program {
  constructor(gl, program) {
    this.gl = gl;
    this.program = program;
    this.locations = new Map();
  }

  use() {
    this.gl.useProgram(this.program);
    return this;
  }

  loc(name) {
    if (!this.locations.has(name)) {
      this.locations.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.locations.get(name);
  }

  dispose() {
    this.gl.deleteProgram(this.program);
  }
}
