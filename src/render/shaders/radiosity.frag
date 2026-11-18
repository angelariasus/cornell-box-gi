// Displays a radiosity solution (report Chapter 4), as the second pass of a two-pass method
// when the scene has mirrors or glass (report Section 7.1).
//
// First pass (CPU worker): radiosity between the diffuse quads, with the spheres acting only
// as blockers. The worker uploads, one texel per patch (texel p % W, p / W), the irradiance H
// each patch receives (B = E + rho H). A primary ray finds the quad and its local (s, t):
//
//   patch = offset + iv * nu + iu,   iu = floor(s * nu), iv = floor(t * nv)
//
// and the radiance seen is L = rho(x) * H / pi. For a uniform patch this is B / pi (report
// Example 1, step 4), so brightness matches the path tracer; using the reflectance of each
// pixel keeps patterns finer than a patch (the checker floor) sharp. The light shows Le.
//
// Second pass (this shader): rays that hit the mirror or the glass are followed with the
// Whitted ray stack (reflection, refraction with exact Fresnel) until they reach a diffuse
// surface, where the radiosity solution is read. Light that went through the glass in the
// first pass is missing (L S D paths: caustics) unless the photon map is switched on.
//
// The solution does not depend on the camera: orbiting only repeats these lookups.
// "Patches" view shows each patch flat, so the mesh steps described in Section 4.4 are
// visible; the interpolated view blends neighbouring patch centres within each quad.

#define STACK_SIZE 16
#define MAX_TASKS 64
#define MIN_WEIGHT 0.001

uniform sampler2D uRadiosity;
uniform vec4 uPatchLayout[MAX_QUADS]; // (offset, nu, nv, unused) per quad
uniform bool uHasRadiosity;
uniform bool uInterpolate;
uniform int uMaxDepth; // Whitted depth for the second pass

vec3 patchIrradiance(int index) {
  int width = textureSize(uRadiosity, 0).x;
  return texelFetch(uRadiosity, ivec2(index % width, index / width), 0).rgb;
}

// Irradiance H from the radiosity solution at a hit on a quad.
vec3 radiosityIrradiance(Hit hit) {
  vec4 patchInfo = uPatchLayout[hit.index];
  int offset = int(patchInfo.x + 0.5);
  int nu = int(patchInfo.y + 0.5);
  int nv = int(patchInfo.z + 0.5);
  vec2 grid = hit.st * vec2(nu, nv);

  if (!uInterpolate) {
    int iu = min(int(grid.x), nu - 1);
    int iv = min(int(grid.y), nv - 1);
    return patchIrradiance(offset + iv * nu + iu);
  }
  // Bilinear interpolation between the four nearest patch centres of the same quad.
  vec2 f = grid - 0.5;
  ivec2 i0 = clamp(ivec2(floor(f)), ivec2(0), ivec2(nu - 1, nv - 1));
  ivec2 i1 = min(i0 + 1, ivec2(nu - 1, nv - 1));
  vec2 w = clamp(f - vec2(i0), 0.0, 1.0);
  vec3 h00 = patchIrradiance(offset + i0.y * nu + i0.x);
  vec3 h10 = patchIrradiance(offset + i0.y * nu + i1.x);
  vec3 h01 = patchIrradiance(offset + i1.y * nu + i0.x);
  vec3 h11 = patchIrradiance(offset + i1.y * nu + i1.x);
  return mix(mix(h00, h10, w.x), mix(h01, h11, w.x), w.y);
}

struct Task {
  Ray ray;
  vec3 weight;
  int depth;
};

vec3 shade(Ray primary) {
  if (!uHasRadiosity) return vec3(0.0);

  Task stack[STACK_SIZE];
  stack[0] = Task(primary, vec3(1.0), 0);
  int top = 1;
  vec3 color = vec3(0.0);

  for (int i = 0; i < MAX_TASKS; ++i) {
    if (top == 0) break;
    top--;
    Task task = stack[top];

    Hit hit;
    if (!intersectScene(task.ray, hit)) continue;

    int type = materialType(hit.material);
    if (type == MAT_EMISSIVE) {
      if (hit.frontFace) color += task.weight * lightEmission();
      continue;
    }

    vec3 albedo = materialAlbedo(hit.material, hit);
    if (type == MAT_DIFFUSE) {
      if (hit.frontFace && hit.kind == HIT_QUAD) {
        vec3 irradiance = radiosityIrradiance(hit) + causticIrradiance(hit);
        color += task.weight * albedo * INV_PI * irradiance;
      }
      continue;
    }

    // Second pass: follow mirror and glass like Whitted ray tracing.
    if (task.depth >= uMaxDepth) continue;
    int depth = task.depth + 1;
    vec3 reflected = reflect(task.ray.dir, hit.normal);

    if (type == MAT_MIRROR) {
      vec3 w = task.weight * albedo;
      if (max(w.r, max(w.g, w.b)) > MIN_WEIGHT && top < STACK_SIZE) {
        stack[top] = Task(Ray(offsetPoint(hit.point, hit.normal), reflected), w, depth);
        top++;
      }
      continue;
    }

    float fresnel;
    vec3 transmitted = refractGlass(task.ray.dir, hit, fresnel);
    vec3 wt = task.weight * albedo * (1.0 - fresnel);
    vec3 wr = task.weight * fresnel;
    if (fresnel < 1.0 && max(wt.r, max(wt.g, wt.b)) > MIN_WEIGHT && top < STACK_SIZE) {
      stack[top] = Task(Ray(offsetPoint(hit.point, -hit.normal), transmitted), wt, depth);
      top++;
    }
    if (max(wr.r, max(wr.g, wr.b)) > MIN_WEIGHT && top < STACK_SIZE) {
      stack[top] = Task(Ray(offsetPoint(hit.point, hit.normal), reflected), wr, depth);
      top++;
    }
  }
  return color;
}
