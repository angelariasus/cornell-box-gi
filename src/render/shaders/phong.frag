// Local illumination baseline: Phong (1975) with one shadow ray (report Section 1.1).
//
// The area light is replaced by a point light at its centre whose intensity matches the
// panel seen from the shaded point, I = Le * A * cos(theta_light). The irradiance follows
// report Example 1, part (a):  E = I cos(theta) / d^2.
//
//   diffuse   L = (rho / pi) E                       (Lambertian BRDF, Example 1 step 3)
//   specular  L = ks E max(R . V, 0)^n               (Phong lobe)
//   ambient   L = rho La                             (uniform light, Example 1 part (b))
//
// No light bounces between surfaces: shadows are hard, the ceiling only gets the ambient
// term, and there is no color bleeding. Mirror and glass are shaded as shiny Phong
// surfaces that reflect nothing, which is exactly the limitation of a local model.

uniform float uShininess; // Phong exponent n
uniform float uSpecular;  // specular coefficient ks of diffuse materials
uniform float uAmbient;   // radiance La of the constant ambient term

vec3 shade(Ray ray) {
  Hit hit;
  if (!intersectScene(ray, hit)) return vec3(0.0);

  int type = materialType(hit.material);
  if (type == MAT_EMISSIVE) return hit.frontFace ? lightEmission() : vec3(0.0);

  vec3 albedo = materialAlbedo(hit.material, hit);
  float ks = uSpecular;
  float shininess = uShininess;
  if (type == MAT_MIRROR || type == MAT_GLASS) {
    // A local model cannot reflect or refract: use a dark, very shiny Phong surface.
    albedo *= 0.15;
    ks = 0.9;
    shininess = max(uShininess, 128.0);
  }

  vec3 color = albedo * uAmbient;

  vec3 toLight = lightCenter() - hit.point;
  float d2 = dot(toLight, toLight);
  vec3 l = toLight / sqrt(d2);
  float cosTheta = dot(hit.normal, l);
  float cosLight = dot(lightNormal(), -l);
  if (cosTheta <= 0.0 || cosLight <= 0.0) return color;

  vec3 origin = offsetPoint(hit.point, hit.normal);
  if (occluded(origin, lightCenter())) return color; // hard shadow

  vec3 irradiance = lightEmission() * lightArea() * cosLight * cosTheta / d2;
  vec3 r = reflect(-l, hit.normal);
  float specular = pow(max(dot(r, -ray.dir), 0.0), shininess);

  color += (albedo * INV_PI + ks * specular) * irradiance;
  return color;
}
