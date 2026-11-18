# Report drafts

Draft texts for the report _Modelos de iluminación global_ (Group 5). They are in Spanish because
they go into the report as they are; the group should review them before pasting. Figure numbers
continue the report (its last figure is Figura 21); appendix figures and tables use the appendix
letter, as Tabla A1 and Tabla C1 do. Every number comes from measurements taken in the browser or
from the captures in `docs/captures/`. Placeholders to fill after deployment: `{{URL_VERCEL}}`
and `{{URL_GITHUB}}` (also in the video script).

---

## Sección 7.3 · Aplicación gráfica

Para observar los métodos de los capítulos anteriores sobre una escena completa, el grupo desarrolló
un visor web interactivo de la caja de Cornell. La aplicación renderiza la misma escena con
iluminación local de Phong, trazado de rayos de Whitted, trazado de caminos y radiosidad, de modo
que cada método puede compararse con los demás sin cambiar la geometría, los materiales ni la cámara.
El Anexo B describe su uso, su estructura y las pruebas realizadas.

La escena reproduce los datos medidos de la caja de Cornell publicados por la Universidad de Cornell
(Cornell Ann S. Bowers College of Computing and Information Science, s. f.): la geometría de las
paredes y de los dos bloques, la reflectancia de cada superficie, la emisión de la lámpara y la
posición de la cámara original. Se incluyó además una segunda escena, con la misma habitación y una
esfera de espejo y otra de vidrio en lugar de los bloques, para mostrar los caminos especulares que
la escena original no contiene.

La aplicación funciona en el navegador, sin servidor. Todos los métodos de render se programaron
directamente en WebGL2 y en el lenguaje de sombreadores GLSL ES 3.0, que la tarjeta gráfica ejecuta
para cada píxel; la interfaz se construyó con Svelte y Vite. La radiosidad y el trazado de fotones
se calculan en Web Workers, procesos en segundo plano que no detienen la interfaz. Cada imagen se
refina de forma progresiva: en cada cuadro se suman nuevas muestras a un búfer de acumulación y se
muestra su promedio, por lo que el usuario puede girar la cámara y ver la imagen mejorar en tiempo
real.

Cada método sigue la formulación expuesta en el informe:

- El modelo de Phong usa un rayo de sombra hacia la fuente y un término ambiental constante.
- El trazado de rayos de Whitted reemplaza la recursión por una pila explícita, porque GLSL no
  admite funciones recursivas, y calcula la reflexión y la refracción con las ecuaciones de Fresnel
  y la ley de Snell.
- El trazado de caminos incluye la estimación de evento siguiente, el muestreo por coseno y la
  ruleta rusa del pseudocódigo de la Figura 14.
- La radiosidad divide las superficies difusas en parches, calcula los factores de forma entre
  todos los pares y resuelve el sistema con los métodos de Jacobi, de Gauss-Seidel o de
  refinamiento progresivo.
- Como extensiones, se implementó un mapa de fotones para las cáusticas, con la estimación de
  densidad del Ejemplo 5, y un método de dos pasadas que combina la radiosidad con el trazado de
  rayos en la escena de las esferas.

Para validar la implementación se escribieron 113 pruebas automáticas. Entre ellas, el programa
reproduce paso a paso el Ejemplo 2 y obtiene los 54 valores de la Tabla 2 con dos decimales. Además,
se compararon las imágenes de distintos métodos que deben coincidir. El brillo medio de la escena
calculado por radiosidad difiere del calculado por trazado de caminos en 1,5 % con 8 parches por
unidad de longitud y en 0,6 % con 14; esta diferencia es el error de discretización de la malla.
Las cáusticas del mapa de fotones coinciden con las del trazado de caminos con una diferencia de
0,2 %.

La Figura 22 compara los tres métodos principales sobre la escena original. Con el modelo de Phong,
el techo, que no recibe luz directa, queda oscuro y las sombras son duras. La radiosidad y el
trazado de caminos iluminan el techo por interreflexión y tiñen de rojo y de verde las caras de los
bloques cercanas a las paredes, que es el sangrado de color descrito en el Capítulo 1. En esta
escena, el trazado de rayos de Whitted produce la misma imagen que el modelo de Phong, porque todas
las superficies son difusas y Whitted no sigue los caminos difusos indirectos, como indica la
Tabla 4.

**Figura 22**
_Caja de Cornell calculada con el modelo de Phong, con radiosidad y con trazado de caminos_
`capture-1-classic-phong-radiosity-path.png`
_Nota._ De izquierda a derecha: modelo de Phong; radiosidad con 8 parches por unidad de longitud
(384 parches); trazado de caminos con 4096 muestras por píxel. Elaboración propia con la aplicación
del grupo.

La Figura 23 muestra la escena de las esferas. El trazado de rayos de Whitted reproduce con
exactitud los reflejos de la esfera de espejo y la refracción de la de vidrio, pero sus sombras son
duras y bajo la esfera de vidrio solo aparece sombra. El trazado de caminos produce sombras suaves,
porque la lámpara tiene área, y una cáustica bajo la esfera de vidrio: la luz que la esfera enfoca
sobre el piso, un camino LSDE que Whitted no puede seguir.

**Figura 23**
_Escena de las esferas calculada con trazado de rayos de Whitted y con trazado de caminos_
`capture-2-spheres-whitted-path.png`
_Nota._ A la izquierda, trazado de rayos de Whitted; a la derecha, trazado de caminos con 4096
muestras por píxel. Elaboración propia con la aplicación del grupo.

El costo de cada método también coincide con la Tabla 4. En la computadora de pruebas, con una
tarjeta gráfica integrada y una imagen de 918 × 702 píxeles, una pasada del modelo de Phong tomó
unos 2 ms y una de Whitted, unos 4 ms, por lo que ambos funcionan a la frecuencia de la pantalla.
Una muestra de trazado de caminos tomó unos 8 ms, y la imagen de 4096 muestras de la Figura 22,
de unos 1000 × 1000 píxeles, necesitó 68 s. La Figura 24 muestra cómo disminuye el
ruido: cada vez que el número de muestras se multiplica por 16, el error se divide aproximadamente
por 4, como predice la convergencia 1/√N de Monte Carlo. La radiosidad, en cambio, resolvió la
escena en unos 0,2 s y, como su solución no depende de la vista, la cámara puede girar sin
recalcular nada.

**Figura 24**
_Trazado de caminos con 1, 16, 256 y 4096 muestras por píxel_
`capture-3-path-1-16-256-4096.png`
_Nota._ De izquierda a derecha: 1, 16, 256 y 4096 muestras por píxel, con estimación de evento
siguiente y muestreo por coseno. Elaboración propia con la aplicación del grupo.

Por último, la Figura 25 compara la imagen calculada por trazado de caminos con la imagen de
referencia de la caja de Cornell publicada por la Universidad de Cornell. Ambas muestran el techo
iluminado por interreflexión, el sangrado de color sobre los bloques y las sombras suaves de la
lámpara. Las diferencias de tono que se observen se deben sobre todo a que el visor ajusta el
balance de blancos al color anaranjado de la lámpara medida y a que cada imagen usa su propio mapeo
de tonos.

**Figura 25**
_Caja de Cornell calculada por la aplicación y en la imagen de referencia de Cornell_
`capture-7-path-tracing-official-camera.png` + imagen de referencia
_Nota._ A la izquierda, trazado de caminos con 4096 muestras por píxel, elaboración propia con la
aplicación del grupo. A la derecha, imagen de referencia tomada de _The Cornell box_, por Cornell
Ann S. Bowers College of Computing and Information Science, s. f.
(https://bowers.cornell.edu/cornell-box).

> Para el grupo: la imagen de referencia debe descargarse de la página citada y colocarse junto a la
> captura 7 en Word. Si su licencia no permite reproducirla, la Figura 25 puede mostrar solo la
> captura y el texto puede remitir a la página.

En conjunto, la aplicación confirma las conclusiones de la Tabla 4. El modelo local es inmediato
pero no produce luz indirecta. Whitted resuelve los caminos especulares, pero no los difusos
indirectos. La radiosidad resuelve la interreflexión difusa con independencia de la vista, a cambio
de los artefactos de malla que muestra la Figura B1. El trazado de caminos captura todos los
efectos, pero necesita miles de muestras por píxel para eliminar el ruido. El mapa de fotones
reduce ese costo en las cáusticas a cambio de un sesgo controlado por el radio de búsqueda.

---

## Conclusiones · cambio en el párrafo de limitaciones

Texto actual:

> La aplicación gráfica del grupo permitirá observar estos métodos sobre escenas más completas.

Texto propuesto:

> La aplicación gráfica del grupo (Sección 7.3 y Anexo B) permitió observar estos métodos sobre la
> caja de Cornell completa. En ella se comprobó que el modelo local deja el techo a oscuras, que
> Whitted no agrega luz indirecta en una escena difusa, que la radiosidad coincide con el trazado
> de caminos dentro del error de su malla y que el mapa de fotones obtiene cáusticas limpias con
> muchas menos muestras que el trazado de caminos.

Ajustes menores sugeridos en otras partes del informe:

- Capítulo 1, último párrafo de la Sección 1.4: "el Capítulo 7 compara los métodos y reserva un
  espacio para la aplicación gráfica del grupo" → "el Capítulo 7 compara los métodos y presenta la
  aplicación gráfica del grupo".
- Resumen: puede añadirse al final de la penúltima oración: "y una aplicación web que renderiza la
  caja de Cornell con cada método permite compararlos sobre la misma escena".

---

## Anexo A · texto y filas nuevas

Frase para añadir al final del primer párrafo, antes de "La Tabla A1 detalla las interacciones":

> En la etapa de desarrollo de la aplicación gráfica se utilizó además para revisar el borrador del
> informe, definir la tecnología y el plan de la aplicación, programarla, escribir sus pruebas
> automáticas, medir sus resultados y redactar el borrador de la Sección 7.3 y del Anexo B. El
> código y los resultados fueron comprobados con pruebas automáticas y mediciones descritas en el
> Anexo B.

Filas nuevas de la Tabla A1 (fechas y horas de Lima, al inicio de cada interacción):

| N.º | Tema consultado                                                     | IA y versión      | Fecha      | Hora (Lima) | Uso                                                                                                                                                          |
| --- | ------------------------------------------------------------------- | ----------------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 13  | Revisión del borrador del informe                                   | Claude (Opus 5.5) | 17/11/2026 | 21:11       | Revisión técnica y de formato; comprobación numérica de los ejemplos resueltos y de la Tabla 2                                                               |
| 14  | Definición de la aplicación gráfica y de su tecnología              | Claude (Opus 5.5) | 17/11/2026 | 21:17       | Propuesta del visor de la caja de Cornell; comparación entre WebGL2, Three.js y entornos de desarrollo web; elección de la versión medida de la caja         |
| 15  | Plan de implementación de la aplicación                             | Claude (Opus 5.5) | 17/11/2026 | 21:40       | Plan por fases, alcance de las extensiones y criterios de verificación                                                                                       |
| 16  | Programación de la base del visor, del modelo de Phong y de Whitted | Claude (Opus 5.5) | 17/11/2026 | 21:53       | Datos de la escena, renderizador WebGL2, interfaz, sombreadores de Phong y de Whitted; pruebas del Ejemplo 2                                                 |
| 17  | Programación del trazado de caminos y de la radiosidad              | Claude (Opus 5.5) | 17/11/2026 | 22:59       | Trazado de caminos con estimación de evento siguiente y ruleta rusa; factores de forma y métodos de Jacobi, Gauss-Seidel y progresivo; pruebas de la Tabla 2 |
| 18  | Rendimiento del trazado de caminos y radiosidad con esferas         | Claude (Opus 5.5) | 17/11/2026 | 23:26       | Explicación del costo del trazado de caminos; muestras por cuadro adaptativas, cajas envolventes y mediciones de tiempo en la tarjeta gráfica                |
| 19  | Extensiones de la aplicación                                        | Claude (Opus 5.5) | 17/11/2026 | 23:45       | Cáusticas por mapa de fotones, radiosidad de dos pasadas, inspector de rayos y pantalla dividida, verificados frente al trazado de caminos                   |
| 20  | Ajustes de la interfaz                                              | Claude (Opus 5.5) | 18/11/2026 | 00:20       | Niveles de calidad del trazado de caminos, piso blanco en la escena de las esferas, interfaz en inglés y español y recorte de la imagen descargada           |
| 21  | Manual, capturas y borradores del informe                           | Claude (Opus 5.5) | 18/11/2026 | 00:48       | Manual de uso, capturas para el informe y borradores de la Sección 7.3, del Anexo B y de estas filas                                                         |

---

## Anexo B · Aplicación gráfica

Este anexo complementa la Sección 7.3 con la forma de acceder a la aplicación, su uso, la estructura
de su código y las pruebas que la validan.

### B.1 Acceso y ejecución

La aplicación está publicada en {{URL_VERCEL}} y su código fuente, en {{URL_GITHUB}}. Funciona en
cualquier navegador de escritorio actual compatible con WebGL2 (Chrome, Edge, Firefox o Safari) y
no necesita servidor propio. Para ejecutarla localmente se requieren Node.js 20 o superior y el
gestor de paquetes pnpm:

```
pnpm install
pnpm dev        (servidor de desarrollo en http://localhost:5173)
pnpm build      (sitio estático en la carpeta dist/)
pnpm test       (pruebas automáticas)
```

### B.2 Uso

La pantalla muestra la imagen a la izquierda y el panel de control a la derecha. Arrastrar sobre la
imagen gira la cámara alrededor de la caja y la rueda del ratón la acerca o la aleja; el botón
Cámara oficial devuelve la vista original de Cornell. El panel permite:

- elegir la escena (clásica o con esferas) y el método (Phong, Whitted, trazado de caminos o
  radiosidad);
- ajustar los parámetros de cada método: el exponente especular y el término ambiental de Phong;
  la profundidad máxima y el índice de refracción de Whitted; los rebotes, la estimación de evento
  siguiente, el muestreo por coseno o uniforme y la ruleta rusa del trazado de caminos; y el número
  de parches, el método de solución, las iteraciones y el sombreado suave de la radiosidad;
- recorrer las iteraciones de la radiosidad para ver cómo converge la solución, como en la Tabla 2;
- activar las cáusticas por mapa de fotones en la escena de las esferas y cambiar su radio de
  búsqueda;
- activar el inspector de rayos, que dibuja sobre la imagen el árbol de rayos de Whitted del píxel
  seleccionado, como en la Figura 7;
- dividir la pantalla para comparar dos métodos con la misma cámara;
- elegir cuántas muestras por píxel acumula el trazado de caminos (256, 1024, 4096 o 16 384),
  guardar la imagen en PNG y cambiar el idioma de la interfaz entre inglés y español.

El panel de estadísticas muestra las muestras acumuladas, la resolución y el tiempo por cuadro.

### B.3 Estructura del código

| Carpeta              | Contenido                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `src/scene`          | Datos de la caja de Cornell: geometría, materiales, lámpara y cámara                          |
| `src/render`         | Renderizador WebGL2, cámara y sombreadores de Phong, Whitted, trazado de caminos y radiosidad |
| `src/radiosity`      | Parches, factores de forma y métodos de Jacobi, Gauss-Seidel y refinamiento progresivo        |
| `src/photons`        | Trazado de fotones para las cáusticas y estimación de densidad                                |
| `src/math`           | Operaciones vectoriales e intersecciones de rayos, y árbol de rayos del inspector             |
| `src/ui`, `src/i18n` | Componentes del panel de control y textos en inglés y español                                 |
| `tests`              | Pruebas automáticas                                                                           |

### B.4 Pruebas

La Tabla B1 resume las pruebas automáticas, que se ejecutan con `pnpm test`, y la Tabla B2, las
comprobaciones realizadas en el navegador.

**Tabla B1**
_Pruebas automáticas de la aplicación_

| Grupo de pruebas      | N.º | Qué comprueba                                                                                       |
| --------------------- | --- | --------------------------------------------------------------------------------------------------- |
| Ejemplo 2             | 12  | Intersecciones, rayo de sombra, reflexión, refracción e intensidad final del Ejemplo 2              |
| Ejemplo 3 y Tabla 2   | 9   | Todos los valores de Jacobi y Gauss-Seidel de la Tabla 2, solución exacta y refinamiento progresivo |
| Factores de forma     | 13  | Valores analíticos, reciprocidad, cubo cerrado y radiosidad de la caja de Cornell                   |
| Geometría y óptica    | 14  | Intersección con rectángulos y esferas, reflexión, refracción, reflexión total interna y Fresnel    |
| Mapa de fotones       | 4   | Conservación de la energía, luz directa analítica con η = 1 y enfoque de la luz con η = 1,5         |
| Árbol de rayos        | 6   | Rayos de sombra, pesos de Fresnel y límite de profundidad                                           |
| Escena                | 18  | Datos de Cornell, normales, lámpara, cámara oficial y datos enviados a la tarjeta gráfica           |
| Renderizador          | 10  | Ensamblado de sombreadores, cámara y balance de blancos                                             |
| Interfaz y estructura | 27  | Textos en ambos idiomas y archivos del proyecto                                                     |
| **Total**             | 113 |                                                                                                     |

_Nota._ Elaboración propia.

**Tabla B2**
_Comprobaciones de la aplicación en el navegador_

| Comprobación                                                                  | Resultado     |
| ----------------------------------------------------------------------------- | ------------- |
| Brillo medio con y sin estimación de evento siguiente (1024 muestras)         | razón 0,999   |
| Brillo medio con y sin ruleta rusa (1024 muestras)                            | razón 1,000   |
| Error con 16 muestras sin estimación de evento siguiente: uniforme / coseno   | 1,71 / 1,12   |
| Brillo medio de la radiosidad / trazado de caminos, 8 y 14 parches por unidad | 0,985 y 0,994 |
| Cáusticas por mapa de fotones (256 muestras) / trazado de caminos (4096)      | 1,002         |
| Dos pasadas / trazado de caminos, escena de las esferas, con mapa de fotones  | 0,898         |
| Tiempo de la radiosidad (8 parches por unidad, 384 parches)                   | 0,2 s         |
| Tiempo del mapa de fotones (500 000 fotones)                                  | 0,22 s        |

_Nota._ Medido en Chrome con una tarjeta gráfica integrada Intel. El error es la raíz del error
cuadrático medio relativo de la luminancia frente a una imagen de referencia. Elaboración propia.

### B.5 Capturas adicionales

**Figura B1**
_Radiosidad con 4 y con 12 parches por unidad de longitud_
`capture-4-radiosity-mesh-4-12.png`
_Nota._ De izquierda a derecha: 4 parches por unidad sin y con sombreado suave; 12 parches por
unidad sin y con sombreado suave. Con la malla gruesa, cada parche promedia las zonas iluminadas y
las sombreadas que cubre, por lo que las sombras de los bloques casi desaparecen. Elaboración propia con la
aplicación del grupo.

**Figura B2**
_Muestreo uniforme y muestreo por coseno con 256 muestras por píxel_
`capture-5-uniform-vs-cosine-256spp.png`
_Nota._ Trazado de caminos sin estimación de evento siguiente. A la izquierda, muestreo uniforme del
hemisferio; a la derecha, muestreo por coseno, con menos ruido, como en el Ejemplo 4. Elaboración
propia con la aplicación del grupo.

**Figura B3**
_Solución de la radiosidad tras 1, 3, 8 y 24 iteraciones de Gauss-Seidel_
`capture-6-gauss-seidel-1-3-8-24.png`
_Nota._ Tras la primera iteración las sombras quedan casi negras y el techo, oscuro; cada iteración
agrega luz de nuevos rebotes, y desde la octava la imagen apenas cambia. Elaboración propia con la
aplicación del grupo.

**Figura B4**
_Cáustica por trazado de caminos y por mapa de fotones_
`capture-8-caustic-path-vs-photon-256spp.png`
_Nota._ De izquierda a derecha: trazado de caminos con 256 muestras por píxel; el mismo con la
cáustica calculada por mapa de fotones; trazado de caminos con 4096 muestras como referencia. El
mapa de fotones obtiene con 256 muestras una cáustica sin ruido, ligeramente suavizada por el radio
de búsqueda (sesgo), como en el Ejemplo 5. Elaboración propia con la aplicación del grupo.

### B.6 Limitaciones

La aplicación solo admite rectángulos y esferas, materiales difusos, espejos ideales y vidrio, y no
carga modelos ni texturas. En una tarjeta gráfica integrada, el trazado de caminos necesita cerca de
un minuto para acumular 4096 muestras por píxel. El método de dos pasadas no transporta la luz que
las esferas envían a las paredes y que vuelve a rebotar, por lo que su imagen es cerca de 10 % más
oscura que la del trazado de caminos.
