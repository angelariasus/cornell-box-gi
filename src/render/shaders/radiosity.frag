// Displays a radiosity solution (report Chapter 4).
//
// The solution B (W/m², one RGB value per patch) is computed on the CPU by the radiosity
// worker and uploaded to uRadiosity, one texel per patch (texel p % W, p / W). A primary ray
// finds the quad under the pixel and its local (s, t) coordinates, which give the patch:
//
//   patch = offset + iv * nu + iu,   iu = floor(s * nu), iv = floor(t * nv)
//
// For a Lambertian surface the radiance seen by the camera is L = B / pi (report Example 1,
// step 4), so the brightness matches the path tracer. The solution does not depend on the
// camera: orbiting only repeats this lookup, it never recomputes the radiosity.
//
// "Patches" view shows each patch flat, so the mesh steps described in Section 4.4 are
// visible; the interpolated view blends neighbouring patch centres within each quad.

uniform sampler2D uRadiosity;
uniform vec4 uPatchLayout[MAX_QUADS]; // (offset, nu, nv, unused) per quad
uniform bool uHasRadiosity;
uniform bool uInterpolate;

vec3 patchRadiosity(int index) {
  int width = textureSize(uRadiosity, 0).x;
  return texelFetch(uRadiosity, ivec2(index % width, index / width), 0).rgb;
}

vec3 shade(Ray ray) {
  Hit hit;
  if (!intersectScene(ray, hit) || !hit.frontFace || !uHasRadiosity) return vec3(0.0);
  if (hit.kind != HIT_QUAD) return vec3(0.0); // radiosity scenes are made of quads only

  vec4 patchInfo = uPatchLayout[hit.index];
  int offset = int(patchInfo.x + 0.5);
  int nu = int(patchInfo.y + 0.5);
  int nv = int(patchInfo.z + 0.5);
  vec2 grid = hit.st * vec2(nu, nv);

  vec3 radiosity;
  if (!uInterpolate) {
    int iu = min(int(grid.x), nu - 1);
    int iv = min(int(grid.y), nv - 1);
    radiosity = patchRadiosity(offset + iv * nu + iu);
  } else {
    // Bilinear interpolation between the four nearest patch centres of the same quad.
    vec2 f = grid - 0.5;
    ivec2 i0 = clamp(ivec2(floor(f)), ivec2(0), ivec2(nu - 1, nv - 1));
    ivec2 i1 = min(i0 + 1, ivec2(nu - 1, nv - 1));
    vec2 w = clamp(f - vec2(i0), 0.0, 1.0);
    vec3 b00 = patchRadiosity(offset + i0.y * nu + i0.x);
    vec3 b10 = patchRadiosity(offset + i0.y * nu + i1.x);
    vec3 b01 = patchRadiosity(offset + i1.y * nu + i0.x);
    vec3 b11 = patchRadiosity(offset + i1.y * nu + i1.x);
    radiosity = mix(mix(b00, b10, w.x), mix(b01, b11, w.x), w.y);
  }
  return radiosity * INV_PI;
}
