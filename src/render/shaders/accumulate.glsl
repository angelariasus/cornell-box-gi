// Entry point shared by every method: traces uSamplesPerFrame jittered primary rays per
// pixel through shade() (defined by the method file) and blends them into the running
// average stored in uPrevious:
//
//   average_new = (average_old * n + sum_of_new_samples) / (n + k)
//
// This running average is the Monte Carlo estimator F_N of report Equation 9: each sample is
// already divided by its probability density inside the method (Equation 10 for paths).
//
// The first sample of an image goes through the pixel centre so a single frame looks
// sharp; later samples are jittered, which gives antialiasing for free.

uniform sampler2D uPrevious;
uniform float uSampleCount; // n: samples already in uPrevious
uniform int uSamplesPerFrame; // k
uniform uint uFrame;
uniform vec2 uResolution;

out vec4 outColor;

void main() {
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  initRandom(uvec2(pixel), uFrame);

  vec3 sum = vec3(0.0);
  for (int i = 0; i < MAX_SAMPLES_PER_FRAME; ++i) {
    if (i >= uSamplesPerFrame) break;
    vec2 offset = (uSampleCount + float(i) > 0.0) ? random2() : vec2(0.5);
    vec3 color = shade(cameraRay((vec2(pixel) + offset) / uResolution));
    // A NaN or infinite sample would poison the whole average: drop it.
    if (any(isnan(color)) || any(isinf(color))) color = vec3(0.0);
    sum += color;
  }

  vec3 previous = uSampleCount > 0.0 ? texelFetch(uPrevious, pixel, 0).rgb : vec3(0.0);
  float k = float(uSamplesPerFrame);
  outColor = vec4((previous * uSampleCount + sum) / (uSampleCount + k), 1.0);
}
