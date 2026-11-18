// Whitted (1980) recursive ray tracing (report Chapter 3, Equation 4, Figure 8):
//
//   I = I_local + k_r I_r + k_t I_t
//
// GLSL has no recursion, so the ray tree of Figure 7 is walked with an explicit stack of
// rays, each carrying the product of the coefficients along its branch (its weight) and
// its depth. As in Figure 8, the primary ray has depth 0 and a surface spawns secondary
// rays only while depth < uMaxDepth.
//
// - Diffuse surfaces: local Phong term with a shadow ray (local.glsl), no secondary rays.
//   This is why Whitted cannot capture indirect diffuse light or color bleeding.
// - Mirror: one reflected ray, k_r = mirror reflectance.
// - Glass: reflected and refracted rays, k_r = F and k_t = 1 - F (exact Fresnel), with
//   total internal reflection. Glass blocks shadow rays, so there are no caustics.
// Mirror and glass get no local highlight of their own: the reflected ray reaches the area
// light itself, which already produces the highlight.
// With photon-mapped caustics on, diffuse surfaces also add the caustic irradiance.

#define STACK_SIZE 16
#define MAX_TASKS 128
#define MIN_WEIGHT 0.001

uniform int uMaxDepth;

struct Task {
  Ray ray;
  vec3 weight;
  int depth;
};

vec3 shade(Ray primary) {
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

    vec3 albedo = materialAlbedo(hit.material);
    if (type == MAT_DIFFUSE) {
      color += task.weight * localIllumination(hit, -task.ray.dir, albedo, uSpecular, uShininess);
      // Optional photon-mapped caustic (caustics.glsl): the light that reaches this point
      // through the mirror or the glass, which Whitted's shadow rays cannot follow.
      color += task.weight * albedo * INV_PI * causticIrradiance(hit);
      continue;
    }

    // Specular surfaces: spawn secondary rays while the depth limit allows it.
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

    // Glass
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
