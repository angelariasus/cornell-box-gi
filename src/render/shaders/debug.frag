// Debug view used to validate geometry: flat material colors with a headlight, or normals.
// Not an illumination model.

uniform int uDebugView; // 0 = material colors, 1 = normals

vec3 shade(Ray ray) {
  Hit hit;
  if (!intersectScene(ray, hit)) return vec3(0.0);

  if (uDebugView == 1) return hit.normal * 0.5 + 0.5;

  int type = materialType(hit.material);
  vec3 base;
  if (type == MAT_EMISSIVE) return vec3(1.0);
  else if (type == MAT_MIRROR) base = vec3(0.75, 0.8, 0.85);
  else if (type == MAT_GLASS) base = vec3(0.55, 0.75, 0.95);
  else base = materialAlbedo(hit.material);

  // Faces seen head-on are brighter, so the shape of the box is readable.
  float headlight = 0.35 + 0.65 * abs(dot(hit.normal, ray.dir));
  return base * headlight;
}
