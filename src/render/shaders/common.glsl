// Shared GLSL: scene data, ray-primitive intersection, materials, random numbers, camera.
//
// Mirrors src/math/math.js (tested against report Example 2). Scene arrays are packed by
// packScene() in src/scene/cornell.js:
//   quads     4 x vec4: (origin, material), (u, 0), (v, 0), (normal, 0)
//   spheres   2 x vec4: (center, radius), (material, 0, 0, 0)
//   materials 3 x vec4: (albedo, type), (emission, ior), (albedo2, checkerTiles)
// MAX_QUADS, MAX_SPHERES and MAX_MATERIALS are injected as #defines by the renderer.

#define PI 3.14159265358979
#define INV_PI 0.31830988618379
#define INFINITY 1e30
#define EPSILON 1e-4

#define MAT_DIFFUSE 0
#define MAT_MIRROR 1
#define MAT_GLASS 2
#define MAT_EMISSIVE 3

#define HIT_NONE 0
#define HIT_QUAD 1
#define HIT_SPHERE 2

uniform vec4 uQuads[MAX_QUADS * 4];
uniform vec4 uSpheres[MAX_SPHERES * 2];
uniform vec4 uMaterials[MAX_MATERIALS * 3];
uniform int uQuadCount;
uniform int uSphereCount;
uniform int uLightIndex;

uniform vec3 uCamPos;
uniform vec3 uCamForward;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uTanHalfFov;
uniform float uAspect;

struct Ray {
  vec3 origin;
  vec3 dir;
};

struct Hit {
  float t;
  vec3 point;
  vec3 normal;          // faces the incoming ray
  vec3 geometricNormal; // stored quad normal / outward sphere normal
  bool frontFace;       // the ray hit the side the geometric normal points to
  int material;
  int kind;             // HIT_QUAD or HIT_SPHERE
  int index;            // quad or sphere index
  vec2 st;              // local quad coordinates in [0, 1]^2 (radiosity, checker)
};

// ---------------------------------------------------------------------------
// Intersection
// ---------------------------------------------------------------------------

// Ray against parallelogram i (corner + edges u, v). Same as intersectQuad() in math.js.
bool intersectQuad(int i, Ray ray, float tMax, out float t, out vec2 st) {
  vec3 origin = uQuads[i * 4].xyz;
  vec3 u = uQuads[i * 4 + 1].xyz;
  vec3 v = uQuads[i * 4 + 2].xyz;
  vec3 n = cross(u, v);
  float denom = dot(n, ray.dir);
  if (abs(denom) < 1e-12) return false;

  t = dot(n, origin - ray.origin) / denom;
  if (t <= EPSILON || t >= tMax) return false;

  vec3 planar = ray.origin + t * ray.dir - origin;
  vec3 w = n / dot(n, n);
  st = vec2(dot(w, cross(planar, v)), dot(w, cross(u, planar)));
  return st.x >= 0.0 && st.x <= 1.0 && st.y >= 0.0 && st.y <= 1.0;
}

// Ray against sphere i, Hearn et al. (2014, p. 639): s = u.dP +- sqrt((u.dP)^2 - |dP|^2 + r^2).
bool intersectSphere(int i, Ray ray, float tMax, out float t) {
  vec3 center = uSpheres[i * 2].xyz;
  float radius = uSpheres[i * 2].w;
  vec3 dP = center - ray.origin;
  float b = dot(ray.dir, dP);
  float disc = b * b - dot(dP, dP) + radius * radius;
  if (disc < 0.0) return false;
  float root = sqrt(disc);
  t = b - root;
  if (t <= EPSILON) t = b + root;
  return t > EPSILON && t < tMax;
}

// Closest hit along the ray, with distance below tMax.
bool intersectScene(Ray ray, float tMax, out Hit hit) {
  hit.kind = HIT_NONE;
  hit.t = tMax;
  float t;
  vec2 st;

  for (int i = 0; i < MAX_QUADS; ++i) {
    if (i >= uQuadCount) break;
    if (intersectQuad(i, ray, hit.t, t, st)) {
      hit.t = t;
      hit.kind = HIT_QUAD;
      hit.index = i;
      hit.st = st;
    }
  }
  for (int i = 0; i < MAX_SPHERES; ++i) {
    if (i >= uSphereCount) break;
    if (intersectSphere(i, ray, hit.t, t)) {
      hit.t = t;
      hit.kind = HIT_SPHERE;
      hit.index = i;
    }
  }
  if (hit.kind == HIT_NONE) return false;

  hit.point = ray.origin + hit.t * ray.dir;
  if (hit.kind == HIT_QUAD) {
    hit.geometricNormal = uQuads[hit.index * 4 + 3].xyz;
    hit.material = int(uQuads[hit.index * 4].w + 0.5);
  } else {
    vec4 sphere = uSpheres[hit.index * 2];
    hit.geometricNormal = (hit.point - sphere.xyz) / sphere.w;
    hit.material = int(uSpheres[hit.index * 2 + 1].x + 0.5);
    hit.st = vec2(0.0);
  }
  hit.frontFace = dot(ray.dir, hit.geometricNormal) < 0.0;
  hit.normal = hit.frontFace ? hit.geometricNormal : -hit.geometricNormal;
  return true;
}

bool intersectScene(Ray ray, out Hit hit) {
  return intersectScene(ray, INFINITY, hit);
}

// Is anything between points p and q? (shadow rays, visibility)
// A shadow ray only needs to know whether something is in the way, not what is closest, so
// it stops at the first blocker instead of searching the whole scene for the nearest hit.
bool occluded(vec3 p, vec3 q) {
  vec3 toQ = q - p;
  float dist = length(toQ);
  Ray ray = Ray(p, toQ / dist);
  float tMax = dist - EPSILON;
  float t;
  vec2 st;
  for (int i = 0; i < MAX_QUADS; ++i) {
    if (i >= uQuadCount) break;
    if (intersectQuad(i, ray, tMax, t, st)) return true;
  }
  for (int i = 0; i < MAX_SPHERES; ++i) {
    if (i >= uSphereCount) break;
    if (intersectSphere(i, ray, tMax, t)) return true;
  }
  return false;
}

// Moves a ray origin off the surface along the normal, against self-intersection ("acne").
vec3 offsetPoint(vec3 p, vec3 normal) {
  return p + normal * EPSILON * 4.0;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

int materialType(int m) {
  return int(uMaterials[m * 3].w + 0.5);
}

vec3 materialEmission(int m) {
  return uMaterials[m * 3 + 1].rgb;
}

float materialIor(int m) {
  return uMaterials[m * 3 + 1].w;
}

// Refractive index of glass set from the panel (0 keeps the material's own value).
uniform float uGlassIor;

float glassIor(int m) {
  return uGlassIor > 0.0 ? uGlassIor : materialIor(m);
}

// Reflectance at a hit; applies the procedural checker pattern when the material has one.
vec3 materialAlbedo(int m, Hit hit) {
  vec4 pattern = uMaterials[m * 3 + 2];
  if (pattern.w > 0.0) {
    ivec2 cell = ivec2(floor(hit.st * pattern.w));
    if (((cell.x + cell.y) & 1) == 1) return pattern.rgb;
  }
  return uMaterials[m * 3].rgb;
}

// ---------------------------------------------------------------------------
// Random numbers (PCG hash, Jarzynski and Olano 2020)
// ---------------------------------------------------------------------------

uint rngState;

uint pcgHash(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

void initRandom(uvec2 pixel, uint frame) {
  rngState = pcgHash(pixel.x + pcgHash(pixel.y + pcgHash(frame)));
}

// Uniform float in [0, 1).
float random() {
  rngState = pcgHash(rngState);
  return float(rngState >> 8u) / 16777216.0;
}

vec2 random2() {
  return vec2(random(), random());
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

// Orthonormal basis (t, b, n) around a unit normal (Duff et al. 2017).
mat3 basisFromNormal(vec3 n) {
  float s = n.z >= 0.0 ? 1.0 : -1.0;
  float a = -1.0 / (s + n.z);
  float b = n.x * n.y * a;
  vec3 t = vec3(1.0 + s * n.x * n.x * a, s * b, -s * n.x);
  vec3 bt = vec3(b, s + n.y * n.y * a, -n.y);
  return mat3(t, bt, n);
}

// Direction on the hemisphere around n with density p = cos(theta) / pi
// (importance sampling of the Lambertian cosine, report Example 4b).
vec3 sampleCosineHemisphere(vec3 n) {
  vec2 u = random2();
  float r = sqrt(u.x);
  float phi = 2.0 * PI * u.y;
  vec3 local = vec3(r * cos(phi), r * sin(phi), sqrt(max(0.0, 1.0 - u.x)));
  return basisFromNormal(n) * local;
}

// Direction on the hemisphere around n with constant density p = 1 / (2 pi).
vec3 sampleUniformHemisphere(vec3 n) {
  vec2 u = random2();
  float cosTheta = u.x;
  float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
  float phi = 2.0 * PI * u.y;
  vec3 local = vec3(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
  return basisFromNormal(n) * local;
}

// Exact Fresnel reflectance of unpolarized light at a dielectric interface (same as
// fresnelDielectric() in math.js). It is 0 when n1 == n2, unlike Schlick's approximation.
float fresnelDielectric(float cosI, float cosT, float n1, float n2) {
  float rs = (n1 * cosI - n2 * cosT) / (n1 * cosI + n2 * cosT);
  float rp = (n2 * cosI - n1 * cosT) / (n2 * cosI + n1 * cosT);
  return 0.5 * (rs * rs + rp * rp);
}

// Refraction through a glass surface hit by `dir`. Returns the transmitted direction (zero on
// total internal reflection) and the exact Fresnel reflectance F in `reflectance`.
vec3 refractGlass(vec3 dir, Hit hit, out float reflectance) {
  float ior = glassIor(hit.material);
  float n1 = hit.frontFace ? 1.0 : ior; // entering from air, or leaving the glass
  float n2 = hit.frontFace ? ior : 1.0;
  vec3 t = refract(dir, hit.normal, n1 / n2);
  if (dot(t, t) == 0.0) {
    reflectance = 1.0; // total internal reflection
    return t;
  }
  float cosI = -dot(dir, hit.normal);
  float cosT = -dot(t, hit.normal);
  reflectance = fresnelDielectric(cosI, cosT, n1, n2);
  return t;
}

// Schlick's approximation of the Fresnel reflectance; n1 is the index on the incident side.
float fresnelSchlick(float cosTheta, float n1, float n2) {
  float r0 = (n1 - n2) / (n1 + n2);
  r0 *= r0;
  return r0 + (1.0 - r0) * pow(1.0 - clamp(cosTheta, 0.0, 1.0), 5.0);
}

// ---------------------------------------------------------------------------
// Area light (quad uLightIndex)
// ---------------------------------------------------------------------------

vec3 lightNormal() {
  return uQuads[uLightIndex * 4 + 3].xyz;
}

float lightArea() {
  return length(cross(uQuads[uLightIndex * 4 + 1].xyz, uQuads[uLightIndex * 4 + 2].xyz));
}

vec3 lightEmission() {
  return materialEmission(int(uQuads[uLightIndex * 4].w + 0.5));
}

vec3 lightPoint(vec2 st) {
  return uQuads[uLightIndex * 4].xyz + st.x * uQuads[uLightIndex * 4 + 1].xyz +
    st.y * uQuads[uLightIndex * 4 + 2].xyz;
}

vec3 lightCenter() {
  return lightPoint(vec2(0.5));
}

// Uniformly distributed point on the light (density 1 / area).
vec3 sampleLightPoint() {
  return lightPoint(random2());
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

// Primary ray through normalized image coordinates uv in [0, 1]^2.
Ray cameraRay(vec2 uv) {
  vec2 ndc = uv * 2.0 - 1.0;
  vec3 dir = uCamForward + ndc.x * uAspect * uTanHalfFov * uCamRight + ndc.y * uTanHalfFov * uCamUp;
  return Ray(uCamPos, normalize(dir));
}
