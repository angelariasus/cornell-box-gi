# Video script (60–90 s)

Screen recording of the viewer with a Spanish voice-over (the presentation is in Spanish). Before
recording: interface in ES, window around 1600 × 900, official camera, default settings, path
tracing samples at 4k. Times are approximate.

| Time    | On screen                                                                                     | Voz en off                                                                                                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–8 s   | Classic scene, Phong. Slow orbit and back to the official camera.                             | "Esta es la caja de Cornell, con las medidas reales publicadas por la Universidad de Cornell. Empezamos con el modelo local de Phong."                                                        |
| 8–16 s  | Stay on Phong; point at the dark ceiling with the cursor.                                     | "Cada punto solo ve la lámpara: el techo queda oscuro, las sombras son duras y no hay sangrado de color."                                                                                     |
| 16–30 s | Radiosity. Move _Paso mostrado_ from 1 to 24 iterations, then orbit.                          | "La radiosidad resuelve el intercambio de luz entre parches difusos. Cada iteración agrega un rebote, como en la Tabla 2. Al girar no se recalcula nada: la solución no depende de la vista." |
| 30–45 s | Path tracing from 0 samples; after a few seconds turn next event estimation off and on again. | "El trazado de caminos sigue caminos aleatorios: la imagen empieza con ruido y se limpia al acumular muestras. Sin estimación de evento siguiente el ruido es mucho mayor."                   |
| 45–60 s | Spheres scene. Split screen: Whitted left, path tracing right; drag the divider.              | "Con un espejo y una esfera de vidrio, Whitted da reflejos y refracción exactos, pero sombras duras y ninguna cáustica. El trazado de caminos sí la produce, aunque lentamente."              |
| 60–72 s | Path tracing alone; turn on _Cáusticas por mapa de fotones_.                                  | "El mapa de fotones traza la luz desde la lámpara y obtiene la cáustica limpia en pocos segundos, a cambio de un pequeño suavizado."                                                          |
| 72–85 s | Whitted with the ray inspector on; click the glass sphere; orbit to see the tree.             | "El inspector de rayos dibuja el árbol de rayos de Whitted de un píxel: reflexión, refracción y rayos de sombra."                                                                             |
| 85–90 s | Back to the official camera; show the address of the live version.                            | "La aplicación funciona en cualquier navegador, en {{URL_VERCEL}}."                                                                                                                           |

Tips:

- Record at 60 fps with the browser in full screen; hide the bookmarks bar.
- Path tracing needs a couple of seconds per step to look clean on an integrated GPU; cut the waits
  in editing if the video runs long.
- If the recording runs over 90 s, drop the ray inspector scene first.
