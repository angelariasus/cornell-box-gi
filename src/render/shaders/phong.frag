// Local illumination baseline: Phong (1975) with one shadow ray (report Section 1.1).
// The shading itself lives in local.glsl, shared with Whitted ray tracing.
//
// No light bounces between surfaces: shadows are hard, the ceiling only gets the ambient
// term, and there is no color bleeding. Mirror and glass are shaded as shiny Phong
// surfaces that reflect nothing, which is exactly the limitation of a local model.

vec3 shade(Ray ray) {
  Hit hit;
  if (!intersectScene(ray, hit)) return vec3(0.0);

  int type = materialType(hit.material);
  if (type == MAT_EMISSIVE) return hit.frontFace ? lightEmission() : vec3(0.0);

  vec3 albedo = materialAlbedo(hit.material, hit);
  if (type == MAT_MIRROR || type == MAT_GLASS) {
    // A local model cannot reflect or refract: use a dark, very shiny Phong surface.
    return localIllumination(hit, -ray.dir, albedo * 0.15, 0.9, max(uShininess, 128.0));
  }
  return localIllumination(hit, -ray.dir, albedo, uSpecular, uShininess);
}
