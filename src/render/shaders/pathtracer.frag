// Path tracing (Kajiya 1986), report Chapter 5, Equation 10 and Figure 14.
//
// Each sample follows one random path from the eye. At every vertex the rendering equation
// is estimated with a single direction, so the path throughput beta accumulates the factor
// f_r cos(theta) / p (Equation 10):
//
//   diffuse, cosine sampling   p = cos / pi         ->  f_r cos / p = rho
//   diffuse, uniform sampling  p = 1 / (2 pi)       ->  f_r cos / p = 2 rho cos
//   mirror                     delta reflection     ->  rho
//   glass                      reflect with prob. F, refract with prob. 1 - F
//
// Next event estimation: at each diffuse vertex a point q on the area light is sampled
// (density 1 / A) and its direct contribution added:
//
//   beta * f_r * Le * cos(theta) * cos(theta_q) * A / |p - q|^2
//
// To avoid counting the light twice, emission found by a bounce is only added when the
// previous vertex was the camera or a specular surface (or when next event estimation is
// off). Russian roulette from the 4th bounce ends weak paths and divides the survivors by
// their survival probability, which keeps the estimate unbiased.
//
// The light quad ends a path: its measured reflectance (0.78) is ignored, as in Figure 14
// of the report; the radiosity solver makes the same choice.
//
// Photon-mapped caustics (optional, caustics.glsl): every diffuse vertex adds the caustic
// irradiance of the photon map, rho / pi * E. The same light must not be counted twice, so
// paths that reach the light through a chain of specular bounces after a diffuse vertex
// (D S+ L, i.e. the caustic seen from the camera side) are then dropped.

#define MAX_BOUNCES_LIMIT 32
#define ROULETTE_START 3

uniform int uMaxBounces;
uniform bool uNextEvent;
uniform bool uCosineSampling;
uniform bool uRussianRoulette;

vec3 directLight(Hit hit, vec3 albedo) {
  vec3 q = sampleLightPoint();
  vec3 toLight = q - hit.point;
  float d2 = dot(toLight, toLight);
  vec3 l = toLight / sqrt(d2);
  float cosTheta = dot(hit.normal, l);
  float cosLight = dot(lightNormal(), -l);
  if (cosTheta <= 0.0 || cosLight <= 0.0) return vec3(0.0);
  if (occluded(offsetPoint(hit.point, hit.normal), q)) return vec3(0.0);
  return albedo * INV_PI * lightEmission() * cosTheta * cosLight * lightArea() / d2;
}

vec3 shade(Ray ray) {
  vec3 radiance = vec3(0.0);
  vec3 beta = vec3(1.0);         // path throughput
  bool countEmission = true;     // camera ray or specular bounce
  bool afterDiffuse = false;     // the path already has a diffuse vertex
  bool specularSinceDiffuse = false;

  for (int bounce = 0; bounce < MAX_BOUNCES_LIMIT; ++bounce) {
    if (bounce >= uMaxBounces) break;

    Hit hit;
    if (!intersectScene(ray, hit)) break; // escaped through the open front

    int type = materialType(hit.material);
    if (type == MAT_EMISSIVE) {
      bool causticPath = afterDiffuse && specularSinceDiffuse; // D S+ L
      bool fromPhotonMap = uHasCaustics && causticPath;
      if (hit.frontFace && (countEmission || !uNextEvent) && !fromPhotonMap) {
        radiance += beta * lightEmission();
      }
      break;
    }

    vec3 albedo = materialAlbedo(hit.material);

    if (type == MAT_DIFFUSE) {
      if (uNextEvent) radiance += beta * directLight(hit, albedo);
      radiance += beta * albedo * INV_PI * causticIrradiance(hit);
      afterDiffuse = true;
      specularSinceDiffuse = false;

      vec3 dir;
      if (uCosineSampling) {
        dir = sampleCosineHemisphere(hit.normal);
        beta *= albedo;
      } else {
        dir = sampleUniformHemisphere(hit.normal);
        beta *= 2.0 * albedo * dot(hit.normal, dir);
      }
      ray = Ray(offsetPoint(hit.point, hit.normal), dir);
      countEmission = false;
    } else if (type == MAT_MIRROR) {
      beta *= albedo;
      ray = Ray(offsetPoint(hit.point, hit.normal), reflect(ray.dir, hit.normal));
      countEmission = true;
      specularSinceDiffuse = true;
    } else {
      // Glass: choose reflection or refraction with the Fresnel probabilities.
      float fresnel;
      vec3 transmitted = refractGlass(ray.dir, hit, fresnel);
      if (random() < fresnel) {
        ray = Ray(offsetPoint(hit.point, hit.normal), reflect(ray.dir, hit.normal));
      } else {
        beta *= albedo;
        ray = Ray(offsetPoint(hit.point, -hit.normal), transmitted);
      }
      countEmission = true;
      specularSinceDiffuse = true;
    }

    if (uRussianRoulette && bounce >= ROULETTE_START) {
      float survive = clamp(max(beta.r, max(beta.g, beta.b)), 0.05, 0.95);
      if (random() > survive) break;
      beta /= survive;
    }
  }
  return radiance;
}
