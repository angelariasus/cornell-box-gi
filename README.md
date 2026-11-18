# Global Illumination Viewer · Cornell Box

Interactive web application that renders the **same Cornell box scene with four illumination
methods** so they can be compared side by side:

| Method              | What it shows                                                |
| ------------------- | ------------------------------------------------------------ |
| Phong (local)       | Baseline: hard shadows, no indirect light                    |
| Whitted ray tracing | Exact mirror reflection and glass refraction                 |
| Path tracing        | Full global illumination with Monte Carlo integration        |
| Radiosity           | Diffuse interreflection and color bleeding, view independent |

Built for the collaborative report _Modelos de iluminación global_ (Group 5, Computación Visual).
The development plan lives in [PLAN.md](PLAN.md).

## Tech stack

- [Vite](https://vite.dev) + [Svelte 5](https://svelte.dev) for the user interface
- Hand-written **WebGL2 / GLSL ES 3.0** for every rendering algorithm
- Web Workers for radiosity
- [Vitest](https://vitest.dev) for tests
- No backend: the build output is a static site

## Requirements

- Node.js 20 or newer
- [pnpm](https://pnpm.io)
- A desktop browser with WebGL2 (recent Chrome or Edge recommended)

## Getting started

```bash
pnpm install
pnpm dev          # start the dev server with hot reload
```

## Scripts

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `pnpm dev`        | Start the development server       |
| `pnpm build`      | Build the static site into `dist/` |
| `pnpm preview`    | Serve the production build locally |
| `pnpm test`       | Run the test suite once            |
| `pnpm test:watch` | Run tests in watch mode            |
| `pnpm format`     | Format the code with Prettier      |

## Project structure

```
src/
├─ App.svelte          # layout: canvas + control panel
├─ ui/                 # Svelte components for the panel
├─ state/              # Svelte stores (parameters, statistics)
├─ scene/              # Cornell box data (classic and spheres scenes)
├─ math/               # ray math in JavaScript (shared by tests and workers)
├─ render/             # WebGL2 renderer, camera and GLSL shaders
├─ radiosity/          # patches, form factors, solvers, worker
└─ photons/            # optional caustic photon map
tests/                 # Vitest suites (report examples are reproduced here)
docs/                  # user manual and captures for the report
```

## Deployment

The project is a static site. When development is finished it will be published on
[Vercel](https://vercel.com) from a public GitHub repository (framework preset: Vite,
build command `pnpm build`, output directory `dist`).
