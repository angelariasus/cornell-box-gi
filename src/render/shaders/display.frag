// Display pass: exposure, ACES tone mapping and sRGB encoding. Identical for every method
// so the comparison between them is fair.

uniform sampler2D uAccumulated;
uniform float uExposure;
uniform int uToneMapping; // 0 = none (debug view), 1 = ACES

out vec4 outColor;

// ACES filmic curve, fit by Narkowicz (2015).
vec3 acesFilm(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 linearToSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 color = texelFetch(uAccumulated, ivec2(gl_FragCoord.xy), 0).rgb * uExposure;
  if (uToneMapping == 1) color = acesFilm(color);
  outColor = vec4(linearToSrgb(color), 1.0);
}
