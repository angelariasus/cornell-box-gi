# User manual

Global Illumination Viewer renders the Cornell box with four illumination methods so they can be
compared on the same scene: Phong (local), Whitted ray tracing, path tracing and radiosity, plus
photon-mapped caustics and a two-pass radiosity + ray tracing method for the spheres scene. It was
built for the report _Modelos de iluminación global_ (Group 5, Computación Visual, UNMSM) and is the
basis for its Appendix B. Measured results are in [verification.md](verification.md).

- Repository: _to be published_ (GitHub)
- Live version: _to be published_ (Vercel)

## 1. Running it

Requirements: Node.js 20 or newer, [pnpm](https://pnpm.io) and a desktop browser with WebGL2
(recent Chrome or Edge; Firefox and Safari also work). There is no backend.

```bash
pnpm install
pnpm dev            # development server at http://localhost:5173
pnpm dev --host     # same, reachable from other devices on the local network
pnpm build          # static site in dist/
pnpm preview        # serves dist/ at http://localhost:4173
pnpm test           # runs the 113 automated tests
```

`dist/` can be opened by any static web server, so a copy of it on a USB drive is enough to run the
viewer without internet access (`pnpm preview` or any other static server; opening `index.html`
directly from disk does not work because browsers block Web Workers on `file://`).

## 2. The screen

The canvas is on the left and the control panel on the right (below the canvas on narrow screens).

| Mouse / touch                  | Action                                               |
| ------------------------------ | ---------------------------------------------------- |
| Drag on the canvas             | Orbit the camera around the box                      |
| Wheel / pinch                  | Zoom                                                 |
| Click (Whitted, ray inspector) | Trace the rays of that pixel and draw their tree     |
| Drag the ⇆ handle              | Move the split screen divider (arrow keys also work) |

The panel, from top to bottom:

1. **Title and EN | ES switch.** The interface language. The first visit follows the browser
   language; the choice is remembered.
2. **Scene.** _Classic_: the measured Cornell box with its two blocks, all surfaces diffuse.
   _Spheres_: the same room with a mirror sphere and a glass sphere instead of the blocks.
3. **Method.** Phong, Whitted ray tracing, path tracing or radiosity. In the spheres scene radiosity
   runs as a two-pass method (radiosity for the walls, ray tracing through the spheres).
4. **Settings of the chosen method** (section 3).
5. **Caustics (photon map)**, spheres scene only, for Whitted, path tracing and radiosity.
6. **Compare.** Split screen: a second method to the right of a draggable divider. Both sides share
   the camera and the settings; each keeps its own accumulated samples.
7. **Display.** Exposure, white balance and resolution scale, applied the same way to every method.
8. **Advanced.** Geometry debug view: material colors or surface normals, without lighting.
9. **Toolbar.** _Official camera_ returns to the camera of the Cornell data. _Restart_ clears the
   accumulated samples. _Save PNG_ downloads the current image cropped to the box.
10. **Statistics.** Samples per pixel (and of the right side in split screen), resolution, frame
    time, samples traced per frame and buffer format. With path tracing on screen, the 256 / 1k /
    4k / 16k buttons set how many samples per pixel to accumulate before stopping (default 4k).

Images are refined progressively: each frame adds samples to an accumulation buffer, and any change
of camera or setting starts again. Phong and Whitted converge in a few frames (the extra samples
only smooth the edges); path tracing needs thousands of samples.

## 3. Methods and their settings

### Phong (local illumination)

Each point sees only the light, through one shadow ray towards a point of the area light. Light
does not bounce: the ceiling stays dark, shadows are hard and there is no color bleeding.

| Setting     | Effect                                                       |
| ----------- | ------------------------------------------------------------ |
| Shininess n | Exponent of the specular lobe (R·V)ⁿ                         |
| Specular ks | Weight of the highlight                                      |
| Ambient La  | Constant light that stands in for the missing indirect light |

### Whitted ray tracing

Rays follow exact mirror reflection and refraction (Snell's law, exact Fresnel). Diffuse surfaces
use the Phong term, so it captures LDS\*E | LS\*E paths only. The Phong settings above also apply.

| Setting       | Effect                                                                         |
| ------------- | ------------------------------------------------------------------------------ |
| Max depth     | Depth of the ray tree; 0 = primary rays only                                   |
| Glass index η | 1.00 = air (the sphere disappears), 1.50 = glass, 2.00 ≈ diamond               |
| Ray inspector | Click a pixel to draw its ray tree over the image and list each ray and weight |

### Path tracing

One random path per sample and pixel, averaged over thousands of samples; it captures every path
L(D|S)\*E and its noise falls as 1/√N.

| Setting               | Effect                                                                  |
| --------------------- | ----------------------------------------------------------------------- |
| Max bounces           | Surface interactions per path                                           |
| Next event estimation | Samples the light directly at every diffuse bounce (much less noise)    |
| Direction sampling    | Cosine (importance sampling) or uniform over the hemisphere             |
| Russian roulette      | Ends weak paths randomly from the 4th bounce, without bias              |
| Samples per frame     | _Auto_ measures the GPU and fills each frame while keeping about 30 fps |
| Max samples per pixel | When to stop accumulating (also set by the buttons in Statistics)       |

### Radiosity

The diffuse surfaces are split into patches, the form factors between every pair are computed
(exact point-to-polygon formula with visibility sampling) and the linear system is solved in a Web
Worker. The solution does not depend on the camera: orbiting does not recompute anything.

| Setting          | Effect                                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| Patches per unit | Mesh resolution (8 ≈ 320–390 patches; 14 ≈ 1,200); the hint shows the count |
| Solver           | Gauss-Seidel, Jacobi or progressive refinement (shooting)                   |
| Iterations       | Iterations of Jacobi or Gauss-Seidel                                        |
| Shown step       | Shows the solution after each iteration or shot, to watch it converge       |
| Smooth shading   | Off shows each patch flat, revealing the mesh                               |

### Caustics (photon map)

Photons are shot from the light; those that hit the mirror or the glass and then land on a diffuse
surface (L S+ D paths) are stored and turned into irradiance with the density estimate of Example 5.
While it is on, the path tracer stops tracing those paths itself, so nothing is counted twice.

| Setting         | Effect                                                      |
| --------------- | ----------------------------------------------------------- |
| Photons         | Photons emitted (131k–2.1M)                                 |
| Search radius r | Large r: smooth but blurry (bias). Small r: sharp but noisy |

## 4. Things to try

These reproduce the observations of the report; they also work as a script for the presentation.

| Scene   | Method       | Try                                                              | What you see                                                    |
| ------- | ------------ | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Classic | Phong        | Compare with path tracing in split screen                        | Dark ceiling, hard shadows, no color bleeding (Table 4)         |
| Classic | Whitted      | Compare with Phong                                               | Identical: with only diffuse walls Whitted adds nothing         |
| Classic | Path tracing | Turn next event estimation off, then switch to uniform sampling  | Same image, much more noise; cosine sampling helps (Example 4b) |
| Classic | Path tracing | 256 → 1k → 4k → 16k                                              | Each step halves the noise (1/√N)                               |
| Classic | Radiosity    | Move _Shown step_ back to 1 iteration; orbit the camera          | The solution fills in (Table 2); orbiting recomputes nothing    |
| Classic | Radiosity    | Smooth shading off; patches per unit 4 vs 12                     | Mesh artifacts and light leaks at shadow edges                  |
| Spheres | Whitted      | Max depth 0, 1, 2; glass index 1.00; ray inspector               | The ray tree of Figure 7; refraction disappears with η = 1      |
| Spheres | Path tracing | Look under the glass sphere, then turn photon-mapped caustics on | The caustic converges slowly; the photon map makes it clean     |
| Spheres | Radiosity    | Two-pass, without and with the photon map                        | No caustic until the photon map is on (two-pass methods, Ch. 7) |
| Spheres | Caustics     | Search radius 4 vs 50                                            | Noise vs bias trade-off (Example 5)                             |

## 5. How it works

All rendering runs on the GPU in hand-written WebGL2 fragment shaders. A full-screen triangle runs
one shader per method; each pixel casts its ray against an analytic scene (quads and spheres) passed
as uniform arrays. Bounding boxes around the two blocks let rays skip five quads at a time.

```
params (Svelte store) ──► renderer.js ──► method shader ──► accumulation buffer (RGBA32F, ping-pong)
                              │                                        │
       radiosity worker ──────┤ patch radiosity (float texture)        ▼
       photon worker ─────────┘ caustic irradiance (float texture)   display.frag: exposure,
                                                                     white balance, ACES, sRGB
```

- **Accumulation.** Each pass adds k samples per pixel to a float buffer (k chosen from the
  measured GPU cost); the display pass divides by the sample count.
- **Display.** White balance to the color of the measured light (von Kries), ACES tone mapping
  and sRGB output, identical for every method so they can be compared.
- **Whitted.** An explicit stack replaces recursion (GLSL has none): each node keeps its ray and
  weight; reflection and refraction weights come from the exact Fresnel equations.
- **Path tracing.** Next event estimation towards the area light, emission counted only after the
  camera or a specular bounce (no double counting), Russian roulette, cosine or uniform sampling.
- **Radiosity.** `radiosity/` builds the patches, computes the form factors (symmetrized for
  reciprocity and clamped so no row exceeds 1) and runs the solvers of Chapter 4. The shader reads
  the irradiance of each patch, bilinearly interpolated when smooth shading is on.
- **Photon map.** `photons/` traces the photons on the CPU in a worker and stores the irradiance on
  a cell grid per quad, which the shaders read as a texture.
- **Ray inspector.** `math/rayTree.js` rebuilds the Whitted ray tree of one pixel in JavaScript
  with the same rules as the shader and draws it as an SVG over the canvas.

Scene data comes from the Cornell Box Data page (bowers.cornell.edu/computer-graphics/data):
coordinates in millimetres divided by 555, measured reflectances and light emission (17.0, 11.8, 4.0),
and the official camera at (278, 273, −800) with a 39.31° vertical field of view.

## 6. Code structure

```
src/
├─ App.svelte              layout, wiring between the stores, the renderer and the workers
├─ i18n/                   English and Spanish texts, language store, number formatting
├─ ui/                     panel components (pickers, settings, statistics, split divider, ray inspector)
├─ state/                  stores: parameters, statistics, radiosity and caustics controllers
├─ scene/cornell.js        Cornell box data, both scenes, materials, packing for the shaders
├─ math/                   vector math, random numbers, Whitted ray tree in JavaScript
├─ render/
│  ├─ renderer.js          WebGL2 setup, views, accumulation, adaptive samples, capture
│  ├─ camera.js            orbit camera and projection
│  ├─ gl.js                context, shader assembly and error mapping
│  └─ shaders/             phong, whitted, pathtracer, radiosity, debug, display (+ shared .glsl)
├─ radiosity/              patches, form factors, solvers (Jacobi, Gauss-Seidel, progressive), worker
└─ photons/                caustic photon tracing and density estimate, worker
tests/                     Vitest suites
docs/                      this manual, verification log, captures
```

## 7. Tests

`pnpm test` runs 113 tests in Node (no browser needed).

| Suite                 | Tests | What it checks                                                                                    |
| --------------------- | ----- | ------------------------------------------------------------------------------------------------- |
| `example2.test.js`    | 12    | Report Example 2 step by step (intersection, shadow ray, reflection, refraction, final intensity) |
| `example3.test.js`    | 9     | Table 2: every Jacobi and Gauss-Seidel value; exact solution; progressive refinement              |
| `formFactors.test.js` | 13    | Form factors against analytic values, reciprocity, closed cube, radiosity of the Cornell box      |
| `math.test.js`        | 14    | Quad and sphere intersection, reflection, refraction, total internal reflection, Fresnel          |
| `photons.test.js`     | 4     | Photon map: energy conservation, analytic direct light with η = 1, focusing with η = 1.5          |
| `rayTree.test.js`     | 6     | Whitted ray tree: shadow rays, Fresnel weights, depth limit                                       |
| `scene.test.js`       | 18    | Cornell data, normals, light, official camera, shader packing, block bounding boxes               |
| `render.test.js`      | 10    | Shader assembly and error mapping, camera math, white balance                                     |
| `i18n.test.js`        | 7     | Both languages have the same texts and placeholders; every text used exists                       |
| `structure.test.js`   | 20    | The files the project is built on exist                                                           |

The browser checks (image comparisons between methods, timings) are recorded in
[verification.md](verification.md).

## 8. Captures

`docs/captures/` holds the images for the report, rendered in headless Chrome on a 1000 × 1000
canvas from the official camera and cropped to the box (about 970 × 960 pixels each). Composites
put the images side by side, left to right in the order of the file name, at full resolution.

| File                                          | Content                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `capture-1-classic-phong-radiosity-path.png`  | Classic scene: Phong, radiosity (8 patches/unit), path tracing 4096 spp |
| `capture-2-spheres-whitted-path.png`          | Spheres scene: Whitted, path tracing 4096 spp                           |
| `capture-3-path-1-16-256-4096.png`            | Path tracing at 1, 16, 256 and 4096 samples per pixel                   |
| `capture-4-radiosity-mesh-4-12.png`           | Radiosity, 4 patches/unit flat and smooth, 12 flat and smooth           |
| `capture-5-uniform-vs-cosine-256spp.png`      | 256 spp without next event estimation: uniform, cosine                  |
| `capture-6-gauss-seidel-1-3-8-24.png`         | Gauss-Seidel after 1, 3, 8 and 24 iterations                            |
| `capture-7-path-tracing-official-camera.png`  | Path tracing 4096 spp, for comparison with the Cornell reference        |
| `capture-8-caustic-path-vs-photon-256spp.png` | Spheres, 256 spp: path tracing, with photon map; 4096 spp reference     |

## 9. Console access

For tests on other machines, the browser console exposes the renderer and the parameters:

```js
viewer.benchmark(20); // GPU milliseconds per pass of the current method
viewerParams.update((p) => ({ ...p, pathNextEvent: false }));
await viewer.accumulate(4096); // accumulate as fast as possible, then viewer.capture()
```

Adding `?cull=0` to the address disables the block bounding boxes (for performance comparisons).

## 10. Limitations

- Only quads and spheres; no meshes loaded from files, no textures.
- Lambertian, ideal mirror and ideal dielectric materials only.
- Path tracing on an integrated GPU needs about a minute for 4096 samples per pixel at 1000 × 1000
  (68 s for the classic scene and 55 s for the spheres scene on the test machine).
- The two-pass method in the spheres scene misses light that the spheres send to the walls and that
  bounces again (about 10% darker than path tracing); see verification.md.
- Designed for desktop browsers; it works on phones but slowly.
