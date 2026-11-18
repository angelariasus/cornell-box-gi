// Local illumination shared by Phong and by the local term of Whitted ray tracing.
//
// The area light is replaced by a point light at its centre whose intensity matches the
// panel seen from the shaded point, I = Le * A * cos(theta_light). The irradiance follows
// report Example 1, part (a):  E = I cos(theta) / d^2.
//
//   diffuse   L = (rho / pi) E                       (Lambertian BRDF, Example 1 step 3)
//   specular  L = ks E max(R . V, 0)^n               (Phong lobe)
//   ambient   L = rho La                             (uniform light, Example 1 part (b))
//
// The ambient light stands in for indirect light, which comes from the same lamp, so it has
// the lamp's color (normalized to luminance 1); La sets its strength.

uniform float uShininess; // Phong exponent n
uniform float uSpecular;  // specular coefficient ks
uniform float uAmbient;   // radiance La of the constant ambient term

vec3 ambientLight() {
  vec3 le = lightEmission();
  return uAmbient * le / dot(le, vec3(0.2126, 0.7152, 0.0722));
}

// `toViewer` points from the surface to the eye.
vec3 localIllumination(Hit hit, vec3 toViewer, vec3 albedo, float ks, float shininess) {
  vec3 color = albedo * ambientLight();

  vec3 toLight = lightCenter() - hit.point;
  float d2 = dot(toLight, toLight);
  vec3 l = toLight / sqrt(d2);
  float cosTheta = dot(hit.normal, l);
  float cosLight = dot(lightNormal(), -l);
  if (cosTheta <= 0.0 || cosLight <= 0.0) return color;

  // Shadow ray: anything between the point and the light leaves only the ambient term.
  if (occluded(offsetPoint(hit.point, hit.normal), lightCenter())) return color;

  vec3 irradiance = lightEmission() * lightArea() * cosLight * cosTheta / d2;
  vec3 r = reflect(-l, hit.normal);
  float specular = pow(max(dot(r, toViewer), 0.0), shininess);
  return color + (albedo * INV_PI + ks * specular) * irradiance;
}
