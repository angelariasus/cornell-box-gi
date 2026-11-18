// Display pass: white balance, exposure, ACES tone mapping and sRGB encoding. Identical for
// every method so the comparison between them is fair.
//
// Split screen: pixels right of the divider (uSplitX, in pixels) show the second view, each
// side with its own tone mapping, and a thin line marks the divider. uSplitX < 0 disables it.

uniform sampler2D uAccumulated;
uniform sampler2D uAccumulatedRight;
uniform float uSplitX;
uniform float uExposure;
uniform vec3 uWhiteBalance;   // per-channel gains; (1, 1, 1) disables it
uniform int uToneMapping;     // 0 = none (debug view), 1 = white balance + ACES
uniform int uToneMappingRight;

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
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  bool right = uSplitX >= 0.0 && gl_FragCoord.x >= uSplitX;
  vec3 color = right ? texelFetch(uAccumulatedRight, pixel, 0).rgb : texelFetch(uAccumulated, pixel, 0).rgb;
  int toneMapping = right ? uToneMappingRight : uToneMapping;

  if (toneMapping == 1) color = acesFilm(color * uWhiteBalance * uExposure);
  else color *= uExposure;
  color = linearToSrgb(color);

  if (uSplitX >= 0.0 && abs(gl_FragCoord.x - uSplitX) < 1.0) color = vec3(1.0);
  outColor = vec4(color, 1.0);
}
