// Caustic photon map lookup (report Chapter 6, Example 5), shared by Whitted and path tracing.
//
// The photon worker stores, for a fine grid of cells on every quad, the irradiance E carried
// by caustic photons (paths L S+ D: light, then mirror or glass, then a diffuse surface). A
// diffuse surface reflects L = rho / pi * E of it. The cells are packed like the radiosity
// patches: cell (iu, iv) of quad q has index offset + iv * nu + iu, one texel per cell.

uniform sampler2D uCaustics;
uniform vec4 uCausticLayout[MAX_QUADS]; // (offset, nu, nv, unused) per quad
uniform bool uHasCaustics;

vec3 causticCell(int index) {
  int width = textureSize(uCaustics, 0).x;
  return texelFetch(uCaustics, ivec2(index % width, index / width), 0).rgb;
}

// Caustic irradiance at a hit on a diffuse quad, interpolated between cell centres.
vec3 causticIrradiance(Hit hit) {
  if (!uHasCaustics || hit.kind != HIT_QUAD) return vec3(0.0);
  vec4 info = uCausticLayout[hit.index];
  int offset = int(info.x + 0.5);
  int nu = int(info.y + 0.5);
  int nv = int(info.z + 0.5);
  vec2 f = hit.st * vec2(nu, nv) - 0.5;
  ivec2 i0 = clamp(ivec2(floor(f)), ivec2(0), ivec2(nu - 1, nv - 1));
  ivec2 i1 = min(i0 + 1, ivec2(nu - 1, nv - 1));
  vec2 w = clamp(f - vec2(i0), 0.0, 1.0);
  vec3 e00 = causticCell(offset + i0.y * nu + i0.x);
  vec3 e10 = causticCell(offset + i0.y * nu + i1.x);
  vec3 e01 = causticCell(offset + i1.y * nu + i0.x);
  vec3 e11 = causticCell(offset + i1.y * nu + i1.x);
  return mix(mix(e00, e10, w.x), mix(e01, e11, w.x), w.y);
}
