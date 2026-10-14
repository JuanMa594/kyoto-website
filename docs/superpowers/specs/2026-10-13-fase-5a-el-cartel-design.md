# Fase 5A — Ubicación 位置, el cartel: diseño

> La Fase 5 se parte en dos bloques con parada propia. **5A es el cartel**: la
> estación de Ubicación, con la maqueta de Japón interactiva, el zoom a Kyoto y
> *Ichi / 位置*. **5B es el tramo** hacia Eventos (carteles de madera con los
> mapas antiguos desplegables, la reseña, la roca pintada y la decoración del
> valle) y se diseña después de revisar 5A. Este documento sólo cubre 5A.

## 1. Qué se busca

Que al llegar a Ubicación se lea el cartel de `2.png` —Japón con el pin en
Kyoto a un lado, *Ichi / 位置* al otro— **con volumen y respondiendo a la
mano**: una maqueta de Japón, prefectura a prefectura, apoyada en un atril de
piedra en el valle; cada prefectura se levanta al pasar el cursor y dice su
nombre, y al tocar Kyoto la maqueta se acerca y se queda con Kansai.

**Criterio de éxito (revisión visual del usuario):**

- Ubicación se reconoce como `2.png` en 16:9 y conserva su lectura (texto
  arriba, maqueta debajo) en 9:16.
- La maqueta se lee como un objeto del valle, apoyado en algo, no como un
  gráfico pegado sobre la escena.
- El pin no se pierde: blanco con contorno shu, como la bandera.
- El hover y el zoom se sienten con peso (muelles, curva `piedra`), nunca a
  saltos, y se deshacen solos al empezar a caminar.
- `check:path` sigue verde, con la maqueta dentro de sus comprobaciones.

## 2. Decisiones ya tomadas

| Tema | Decisión | Origen |
|---|---|---|
| Alcance | **Dos bloques**: 5A el cartel, 5B el tramo. Diseño detallado sólo de 5A | Usuario |
| Forma del mapa | **Maqueta inclinada** ~40° hacia la cámara sobre un **atril de piedra** bajo, a la izquierda del camino | Usuario |
| Aspecto | **Losas de `2.png`**: cada prefectura una losa washi del mismo grosor, juntas de tinta sumi entre vecinas, cantos de costa en koke | Usuario |
| Zoom | **Al tocar Kyoto** (o con el botón DOM); se deshace con otro toque, Escape, el botón, al caminar o al irse | Usuario |
| Técnica | **Enfoque A**: pipeline offline (`bun run geo` ampliado) + una sola geometría con id por prefectura; elevación y fundido en el shader | Usuario |
| Pin | **Blanco con contorno shu** y el disco rojo, como el de `2.png` (que no se pierda sobre el blanco ni sobre el fondo) | Usuario |
| Lago Biwa | **Sí**, como un hueco de agua en Shiga | Propuesta aceptada |
| Tercio superior | Hokkaido **puede** rozarlo: es la punta de un objeto inclinado | Usuario |
| Esquina de `2.png` (torii + Fuji + sol) | **No en el cartel.** Pasa a 5B como una **roca pequeña vertical pintada** en el tramo hacia Eventos | Usuario |
| Botón DOM del zoom | **Componente aislado** (`MaquetaToggle`): quitarlo es borrar una línea, sin romper nada | Usuario |
| Color del título | **koke-deep**, como el verde de `2.png`; el `accent` de Ubicación pasa a ese verde | Propuesta aceptada |
| Ficha de Kyoto | Datos sueltos en el zoom; el solape con los textos del tramo se resuelve en 5B | Propuesta aceptada |
| Plantilla de título | `CartelTitle` (romaji + `<InkKanji>` + halo), estrenado aquí, para Eventos y Lugares | Propuesta aceptada |

## 3. Composición y encuadre

### 3.1 Horizontal (16:9)

`2.png` en espejo respecto de la Home: **la maqueta a la izquierda** del camino,
**el texto a la derecha** (DOM). La Home y Ubicación alternan de lado.

- La maqueta mide **~6 × 6 u**, inclinada **~40°** hacia la cámara, a la
  profundidad de la estación (**d ≈ 0, u ≈ −3,5**). A esa distancia el cuadro
  mide ~14 u de ancho: Japón entero cabe en la mitad izquierda sin tocar el
  camino.
- El pie del atril cae en el **tercio medio**; la cara de la maqueta ocupa el
  medio y puede rozar el superior con Hokkaido.
- El **pin** flota sobre la ciudad de Kyoto con un vaivén lento y proyecta su
  sombra sobre la losa (tier alto).
- Los números exactos los fija `check:path`, en una sección nueva: «El cartel
  de Ubicación».

### 3.2 Vertical (9:16)

El texto sube a la franja alta, alineado a la izquierda; la maqueta se va al
fondo (`portrait`, **d ≈ 8**), arrimada al borde izquierdo del camino. Misma
idea que el torii de la Home en vertical. La ficha del zoom se pliega bajo el
botón.

### 3.3 La estación en `journey.ts`

La maqueta es un objeto más de la decoración:

```ts
{ kind: 'maqueta', at: { d: 0, u: -3.5 }, portrait: { d: 8, u: -2.6 } }
```

Con su **huella** (círculo del atril + rectángulo de la bandeja proyectada al
suelo): la cámara no se le acerca a menos de 1,5 u, no pisa las piedras y la
fauna no la atraviesa. Lleva **musgo** al pie y **sombra de contacto**, con los
sistemas que ya existen (`moss.ts`, `contact.ts`). El resto del valle es de 5B.

## 4. La maqueta

### 4.1 El dato (`bun run geo`, ampliado)

`scripts/build-geo.ts` gana un segundo producto, sin tocar el del ícono:

1. Descarga una vez **las prefecturas de Natural Earth** (*admin-1 states
   provinces*, 1:10 m, dominio público) y **los lagos** (*lakes*, 1:10 m) en
   `assets/geo/source/`, que no se versiona.
2. Se queda con Japón y lo recorta con los mismos límites que el ícono (de
   Kyushu a Hokkaido). **Okinawa queda fuera**, como en `2.png` y `13.png`.
   Descarta los islotes por área.
3. Simplifica con **topología compartida** (`topojson-server` +
   `topojson-simplify`, dependencias de desarrollo) hasta **~2.500 vértices**:
   la frontera entre dos vecinas es la misma línea para las dos, sin huecos ni
   solapes.
4. Proyecta con la misma proyección del ícono (equirrectangular corregida a
   37°N) y lo encaja en el ancho de la maqueta.
5. **Encoge cada prefectura hacia dentro** un pelo (*offset* con Clipper,
   dependencia de desarrollo): ese hueco es la junta de tinta (§4.2). Las islas
   que el encogido haría desaparecer se dejan sin encoger o fuera, por umbral.
6. **Recorta el lago Biwa** de Shiga (diferencia de polígonos): queda un agujero
   en la losa.
7. Escribe **`src/scene/objects/maqueta/prefectures.generated.ts`** (sí se
   versiona): por prefectura, `id`, `name` (romaji), `nameJa`, sus anillos
   (exterior y agujeros, ya encogidos), su centroide y si es de **Kinki**; el
   contorno de costa (la unión, sin encoger) para la base; el lago; y el punto
   de la ciudad de Kyoto, donde va el pin.

`nameJa` sale del propio dato (`name_ja`). Si el *admin-1* no lo trae, el
script lleva una tabla de los 46 nombres. Kinki se declara en el script: Kyoto,
Ōsaka, Hyōgo, Nara, Shiga, Wakayama, Mie.

### 4.2 Geometría (`scene/objects/maqueta/`)

Tres piezas sobre la bandeja, todas en el espacio local de la maqueta:

1. **La bandeja**: una losa de piedra *ishi* con cantos redondeados. Es el mar,
   un tono más oscuro que el washi del fondo para que la costa se recorte. El
   agujero del lago deja ver un agua de bandeja algo más oscura.
2. **La base de costa**: la unión de Japón, extruida fina, **cara sumi** y
   **cantos koke** (la franja verde de `2.png`).
3. **Las losas**: cada prefectura, ya encogida, extruida encima con **cara
   washi**. Por el hueco entre losas asoma la base sumi: la junta de tinta.
   Las 46 se funden en **una geometría con el atributo `aPref`** (una draw
   call). **Kyoto** lleva la cara con un lavado shu suave y está elevada desde
   el principio.

**El atril**: un pedestal de torno bajo (tres o cuatro tambores) del mismo
material de piedra que los faroles, con su musgo al pie, que sostiene la
bandeja. Reutiliza la mirada **`cartelLook`** (washi + tinta) del resto de la
decoración.

**Normales**: la extrusión no deja triángulos de área cero (la trampa de los
NaN); `check:path` lo comprueba sobre la geometría generada.

### 4.3 El shader de las losas

Sobre el material de la decoración (`MeshStandardMaterial` + `cartelLook`, con
`onBeforeCompile`), dos uniforms indexados por `aPref`:

- `uLift[46]` — cuánto sube cada losa (hover, Kyoto elevada, hundimiento del
  zoom). Desplaza en el eje normal de la bandeja.
- `uSea[46]` — 0–1, cuánto se funde la cara de cada losa con el color del mar.

Los valores los integra la CPU (un muelle amortiguado por losa, como
`sway.ts`) y se suben como arrays: el shader no lleva reloj. Su sombra
necesita el mismo desplazamiento en un `customDepthMaterial`.

### 4.4 El pin

Un pin **2.5D extruido** (gota con disco), que mira siempre a la cámara: cara
**blanca**, **canto shu** y un **bisel shu** en el borde de la cara —el
contorno se ve desde cualquier ángulo del parallax— y el **disco shu** en el
centro. Flota sobre la ciudad de Kyoto con un vaivén lento; crece un poco en el
zoom.

### 4.5 Peso

~2.500 vértices de contorno → **~15–25 k triángulos** con los cantos. Bandeja +
base + losas + pin: 4 draw calls; el atril, 1–2 más.

## 5. La interacción y el zoom

### 5.1 Del cursor a la escena, sin que el canvas capture el puntero

- **`MaquetaInput`** (componente cliente de la página) escucha `pointermove`,
  `pointerdown` y `keydown` en `window`, ignora lo que cae sobre enlaces y
  botones del DOM, y escribe en **`MAQUETA`**, un objeto de módulo con un único
  escritor, como `PARALLAX`: posición del puntero en −1…1, si es táctil, y los
  toques pendientes.
- Dentro del `<Canvas>`, la maqueta hace el **raycast en `useFrame`** sólo con
  la cámara en la estación y sólo si el puntero se movió: primero contra la caja
  de la bandeja, después contra las losas. Publica en `MAQUETA.hover` la
  prefectura bajo el cursor.
- **El store** (Zustand) guarda sólo el estado del zoom, `mapZoom: 'japon' |
  'kyoto'`, con la acción `setMapZoom`. Cambia a ritmo humano.

### 5.2 Hover

- La prefectura bajo el cursor **sube ~0,12 u** con su muelle.
- Su nombre aparece en una **etiqueta DOM** (`aria-hidden`), «Ōsaka · 大阪府»,
  colocada por un callback de `gsap.ticker` que proyecta el centro de la losa a
  la pantalla, fuera de React (como la marca del riel).
- El cursor es mano **sólo sobre Kyoto**.
- **Táctil**: tocar una prefectura la levanta y muestra su nombre unos
  segundos; tocar Kyoto hace el zoom.

### 5.3 El zoom: `japon` → `kyoto`

Una línea de tiempo de GSAP de **~1,6 s**, curva `piedra`:

- La bandeja **se endereza** de ~40° a ~60°, **crece ×2,8 alrededor de Kyoto**
  y se desplaza para que Kyoto quede donde estaba el centro de la maqueta. **La
  cámara no se mueve.**
- Las prefecturas de fuera de Kinki **se hunden** en la bandeja y su cara se
  funde con el mar (`uLift` negativo, `uSea` → 1).
- Quedan las siete de **Kinki**, con sus nombres a la vista (etiquetas DOM).
- El pin crece un poco; la **ficha de Kyoto** aparece en el lado del texto (§6).

**Volver**: otro toque en Kyoto, el botón, **Escape**, **empezar a caminar**
(en cuanto el tramo avanza un poco, el zoom se deshace solo) o irse de la
estación. Con **静 o movimiento reducido**, el cambio es inmediato, sin
animación.

### 5.4 El botón DOM (`MaquetaToggle`)

En el bloque de texto: «Acercarse a Kyoto» / «Ver todo Japón», con
`aria-pressed`. Es la vía del teclado y del lector de pantalla, y la única sin
WebGL (sin WebGL sólo cambia la ficha).

**Es un componente aislado**: sólo llama a `setMapZoom`. Escape, el toque en
Kyoto y el deshacer al caminar los lleva `MaquetaInput`, no el botón. Quitarlo
es borrar una línea de la página sin romper nada. Si algún día no convence a la
vista, lo prudente es dejarlo `sr-only` en lugar de borrarlo: es la única forma
de hacer el zoom con el teclado.

## 6. El texto y 位置

### 6.1 El cartel

A la derecha, con el **halo de papel** (`.paper-halo`):

- **«Ichi»** en One Jinja, grande (como KYOTO en la Home), y debajo **位置
  dibujado con `<InkKanji>`**, trazo a trazo, **cada vez que se llega** a la
  estación (~1,2 s). Con 静 o movimiento reducido, ya dibujado.
- En el `<h1>`, un texto oculto que se lee: «Ubicación — Ichi 位置».
- El tagline en Gaze Nozarashi: **«Ubicación · dónde queda Kyoto»**, y un
  párrafo corto de resumen.
- Botón del zoom (§5.4) y ficha (§6.2).

**Color**: título y kanji en **koke-deep** (`#306828`), como el verde de
`2.png`. El `accent` de Ubicación en `journey.ts` pasa de `#C4181A` a ese verde,
para que el pin y Kyoto sean lo único rojo del cuadro. Efecto colateral
aceptado: el 位置 del final del tramo de la Home sale verde.

### 6.2 La ficha de Kyoto

Aparece con el zoom, `aria-live="polite"`. Datos, no prosa:

- Prefectura: Kyoto (京都府) · Región: Kansai (Kinki)
- 35,0° N · 135,8° E · ~1,46 millones de habitantes
- Distancias: Ōsaka ~45 km · Nara ~35 km · Tokio ~370 km (2 h 15 en shinkansen)

Sus textos van en `messages/{es,en}.json` (`ubicacion.*`). El solape con las
tarjetas provisionales del tramo («370 km de Tokio», «junto a Osaka y Nara») se
resuelve en 5B: allí, ya como mapas antiguos, contarán la historia.

### 6.3 `CartelTitle`

Componente pequeño (`components/sections/CartelTitle.tsx`): romaji + kanji con
`<InkKanji>` + halo + texto oculto, con el color de la estación. Lo estrena
Ubicación y lo usarán Eventos y los tres Lugares. La Home **no** lo usa: su
entrada tiene coreografía propia.

### 6.4 La página

`ubicacion/page.tsx` deja `StationShell` y compone: `ActiveStation`,
`ContentArrival` con el cartel (`CartelTitle`, tagline, resumen,
`MaquetaToggle`, ficha), `MaquetaInput`, las etiquetas de las prefecturas y
`PathTramo` (que en 5A sigue con sus tarjetas provisionales).

## 7. Calidad y rendimiento

- **Montaje**: con `StationDecor`, viva con la cámara en Ubicación o en una
  zona vecina. La geometría se construye una vez a nivel de módulo y se libera
  con `dispose()` al desmontar.
- **Tier alto**: maqueta y pin proyectan sombra. **Medio y bajo**: sin sombra,
  con la sombra de contacto al pie del atril. La geometría es la misma.
- **Profundidad de campo** (tier alto): comprobar que la maqueta, a ~13 u,
  queda en foco; si no, se ajusta para esa estación, no el global.
- **Raycast**: sólo en la estación y sólo al moverse el puntero; despreciable.
- **Presupuesto**: +5–6 draw calls y ~25 k triángulos en el cartel de
  Ubicación, a 60 fps en la GPU integrada; se mide antes y después.

## 8. Verificación

- **`check:path`**, sección «El cartel de Ubicación» (`scripts/check-decor.ts`):
  - La maqueta no pisa las piedras; la cámara queda a ≥ 1,5 u en las **dos
    poses** (`japon`, `kyoto`) y en los viajes de ida y vuelta; la fauna no la
    cruza, y la estación conserva actos viables.
  - El dato: 46 prefecturas, Kyoto existe, Kinki tiene 7, el lago es un agujero
    dentro de Shiga, anillos cerrados, **ningún triángulo de área cero**.
  - Los textos de la ficha y del botón existen en los dos idiomas.
- **El GLSL nuevo** se compila en un contexto WebGL2 real (`compileShader` +
  `getShaderInfoLog`) y se mira la consola en busca de «Shader Error».
- `bun run typecheck` y `bun run build`.
- **Revisión en el navegador**: 16:9 y 9:16; hover y toque; zoom de ida y
  vuelta, Escape y caminar para deshacerlo; 静 y movimiento reducido; sin JS
  (el texto se lee, la ficha oculta); draw calls y fps.

## 9. Mapa de archivos

**Nuevos**

- `src/scene/objects/maqueta/prefectures.generated.ts` — el dato (generado).
- `src/scene/objects/maqueta/maquetaGeometry.ts` — bandeja, base, losas con
  `aPref`, atril (puro, three).
- `src/scene/objects/maqueta/zoom.ts` — las dos poses y su interpolación
  (puro: lo usan la escena y `check:path`).
- `src/scene/objects/maqueta/Maqueta.tsx` — montaje, raycast, muelles,
  uniforms, línea de tiempo del zoom.
- `src/scene/objects/maqueta/Pin.tsx` (+ su geometría).
- `src/scene/objects/maqueta/input.ts` — `MAQUETA` (objeto de módulo).
- `src/components/ubicacion/MaquetaInput.tsx`, `MaquetaToggle.tsx`,
  `PrefectureLabels.tsx`, `KyotoFicha.tsx`.
- `src/components/sections/CartelTitle.tsx`.

**Modificados**

- `scripts/build-geo.ts` — prefecturas, lagos, topología, encogido, salida.
- `package.json` — dependencias de desarrollo (`topojson-server`,
  `topojson-simplify`, `topojson-client`, Clipper).
- `src/config/journey.ts` — `DecorMaqueta` en `DecorItem`; decoración de
  Ubicación; `accent` a koke-deep.
- `src/scene/decor/placement.ts`, `footprints.ts`, `contact.ts`, `moss.ts`,
  `StationDecor.tsx` — el nuevo tipo.
- `src/store/useKyotoStore.ts` — `mapZoom` y `setMapZoom`.
- `src/app/[locale]/ubicacion/page.tsx` — el cartel.
- `src/styles/globals.css` — cartel de Ubicación, etiquetas, ficha.
- `src/messages/{es,en}.json` — tagline, resumen, botón, ficha.
- `scripts/check-decor.ts` — las comprobaciones de §8.

**Documentación**

- `CLAUDE.md`: árbol (`scene/objects/maqueta/`, `components/ubicacion/`), qué
  produce ahora `bun run geo`, 5A en el estado de las fases.
- `docs/PLAN.md`: §5 con Ubicación; §7 con la maqueta; la Fase 5 partida en
  5A/5B en el plan de fases.

## 10. Fuera de alcance (5A)

Lo que es de **5B**:

- Los **carteles de madera** con los dos mapas antiguos desplegables, y la
  reseña.
- La **roca pintada**: una piedra pequeña vertical con el torii, el Fuji y el
  sol rojo de la esquina de `2.png`.
- La decoración del valle y del tramo hacia Eventos.
- Resolver el solape entre los textos del tramo y la ficha.

Y además: sonido propio de la maqueta, Okinawa, la noche.

## 11. Riesgos y a calibrar en la revisión

| Tema | Qué vigilar |
|---|---|
| `name_ja` | Que el *admin-1* lo traiga; si no, tabla en el script |
| Islas finas | Que el encogido no borre Shōdoshima, Awaji o Sado; por debajo de un umbral se dejan sin encoger o fuera |
| Kyoto frente al pin | Que el lavado shu de la losa no se coma el contorno del pin; si pasa, Kyoto blanca y marcada sólo por la elevación |
| Inclinación | Que a 40° Japón se lea entero; si no, más inclinada hacia la cámara |
| Zoom ×2,8 | Que Kinki quepa en la mitad izquierda sin acercarse a la cámara; si no, menos aumento |
| Profundidad de campo | Que la maqueta quede en foco en tier alto |
| Peso de la geometría | Si construirla al montar pasa de un frame, repartir en `requestIdleCallback` |

## 12. Desviaciones al implementar

Lo que cambió respecto de este diseño al construirlo y revisarlo en el navegador:

| Tema | Diseño | Implementado | Por qué |
|---|---|---|---|
| Huella de la bandeja | Un círculo | Un **rectángulo girado** (`rectangulo`, nuevo en `footprints.ts`) y un círculo pequeño al pie del atril | Un círculo que cubriera las esquinas (3,2 u) le quitaba al camino un metro de cada lado |
| Colocación | d 0, u −3,5 | **d −5, u −5,8, yaw 0,15** | La cámara, al caminar hacia Eventos, se abre a la izquierda; con ≥ 1,5 u, la bandeja no pasa del ~31 % del ancho |
| Medidas | 40° → 50°, ×2,8, atril de 2,25 | **45° → 55°, ×4,2**, eje a 2,8 u | Con ×2,8 Kinki quedaba pequeña y sus nombres se pisaban; más alta, la maqueta cae en el tercio medio |
| Cara de las losas | washi | **kami** (blanco) | Sobre la bandeja de piedra, el washi apenas se distinguía; `2.png` las tiene blancas |
| Etiquetas | Encima de su punto | **Debajo**, en dos líneas; en el zoom, sin la de Kyoto | Tapaban el pin y se pisaban en Kinki |
| Ficha | Debajo del botón | **En el sitio del resumen** mientras dura el zoom | No cabía en 900 px de alto |
| Vertical | d ≈ 8, junto al borde | **d 20, u −4,5, escala 0,8** (`DecorAt.scale`, nuevo); sin los nombres de Kinki en el zoom | El cuadro de un teléfono (≈ 0,45) no da para más; queda pendiente de revisar (PLAN §11) |
| Kanji al cargar | Se dibuja también en la primera carga | **Sólo al llegar** desde otra estación | En la primera carga ya está pintado en el HTML: dibujarlo sería borrarlo y volver a pintarlo |
| Archivo del componente | `Maqueta.tsx` | **`MaquetaJapon.tsx`** | En Windows choca con `maqueta.ts` (TS1149) |
| Nombres para el DOM | Del dato | **`names.generated.ts`** aparte | Para no meter los polígonos (~80 KB) en el JS de la página |
| Movimiento reducido | — | **`MAQUETA.wake()`** | El canvas pinta a demanda: sin pedir frame, el zoom no se veía |
| Presupuesto | +5–6 draw calls | **+16** (con la pasada de sombra), +24 k triángulos, 60 fps | Bandeja, base y losas con dos materiales cada una, el atril, el pin y sus sombras |

## 13. Revisión del usuario (1)

| Pedido | Hecho |
|---|---|
| En el zoom, los nombres de Kinki se solapan | `labelLayout.ts`: cada etiqueta prueba sitios alrededor de su punto (abajo, arriba, a los lados, en diagonal y dos anillos más lejos) y se queda con el primero libre, sin pisar a las demás ni al pin; las lejanas llevan una línea de tinta. Prueba primero el sitio que tenía, para no saltar |
| El mapa se ve pálido: más color, dentro de la paleta | Las prefecturas, por región, en tonos pálidos de la paleta (`regions.ts`), Kinki en blanco. El mar, con un velo de índigo |
| Olas a pinceladas, con aire de arte japonés | Cinco grupos de tres trazos (`waves.ts`): crestas cuya curvatura crece hasta el rizo, que se afinan en las puntas; el pincel seco y las vetas, en el shader. Pintadas en la bandeja: con el zoom no se mueven |
| Color del mar y de las olas | El usuario eligió **añadir el índigo 藍** (`--color-ai`, #165E83) a la paleta, sólo para esto |

## 14. Revisión del usuario (2)

| Pedido | Hecho |
|---|---|
| Subir el mapa (~15–20 %) e inclinarlo un poco más | El eje del atril, de 2,8 a 3,9 u; la inclinación, de 45° a 48°. En 16:9 la bandeja pasa del 38–78 % al 28–67 % del alto |
| Suavizar la sombra sobre el suelo | Ni la bandeja ni las losas ni el pin proyectan sombra dura: una penumbra de contacto ancha (r 2,6) y a media fuerza la sustituye (`contact.ts`). La columna sí la proyecta, como los faroles |
| En el zoom, la cámara interpola hacia una vista frontal | **La cámara no se mueve** (regla dura 2 y `CameraRig`, único escritor): la maqueta se **gira y se endereza** hasta mirarla de frente (`faceCamera`, a 3° de la vista), con la misma curva del zoom, y se adelanta 0,8 u para no cruzarse con la columna |
| El mapa lejano destellaba desde el tramo de la Home | Era **z-fighting**: el mar era un plano a 2 mm de la cara de la bandeja, y a 40–60 u la profundidad no los distingue. Ahora el mar va pintado en la propia bandeja (`aSea`); las olas, a 1,2 cm y con `polygonOffset` |
| Las olas se quedaban quietas con el zoom | Cada pincelada sigue a su sitio del mapa sin cambiar de tamaño; las de Japón se alejan y se desvanecen, y aparecen tres grupos alrededor de Kinki |
| La ficha no cabía con el navegador al 90 % | En el zoom, el título se recoge (en alto de pantalla) y el bloque sube; comprobado a 1874×977, 1778×1000, 1366×657 y 1600×900, sin quitar ningún dato |
| El lago Biwa no se distinguía y subía con Shiga | Agua propia en índigo hondo (`LAKE_BIWA`), en el contenido y sin `aPref`: no sube al pasar el cursor |

## 15. Revisión del usuario (3)

| Pedido | Hecho |
|---|---|
| Al pasar el cursor, la flecha tapa a veces el nombre | Con ratón, la etiqueta de la prefectura bajo el cursor ya no cuelga del centro de la prefectura sino **del cursor**, por debajo de su flecha (`cursorAnchor`), y la flecha cuenta como obstáculo para las demás (`cursorRect`). En táctil, sin cursor, sigue en el centro |

## 16. Revisión del usuario (4)

| Pedido | Hecho |
|---|---|
| En el zoom, al pasar el cursor deprisa los nombres de Kinki se mueven «como locos» | La escena marca aparte los nombres del zoom (`MAQUETA.labelOn` = 2). Su reparto **no atiende al cursor** —ni quién está debajo ni la flecha— y su punto no sube con la losa al hacer hover. Al terminar el zoom, lo que se aparta cada uno de su punto **queda fijado** y sólo sigue al mapa (el parallax); se suelta al salir del zoom o si cambia la ventana. El nombre de Kyoto ya no sale en el zoom, ni al tocarlo: lo marcan el pin y la ficha |
| Que cada nombre tenga una línea señalando su prefectura | Todos llevan su línea de tinta y un punto en la prefectura |
| La tarjeta de Ōsaka se cruzaba con la línea de Hyōgo: mejor en círculo, unos más cerca y otros más lejos | **Corro alrededor de Kinki** (`ringLayout`): cada nombre va por el rayo que sale del centro del grupo y pasa por su prefectura, fuera del grupo y del pin. Como todas las líneas salen de un mismo centro, ni se cruzan ni pasan por otra etiqueta. Una de cada dos, en el orden del giro, va un 16 % más lejos, y cada una se aparta ±5 % por su cuenta; si dos aún se estorban, se abren en ángulo. `check:path` lo comprueba con el grupo real y con uno apretado. Por CDP: tres pasadas rápidas del ratón por las seis prefecturas, ninguna etiqueta se movió respecto de su punto. A vigilar: el corro no conoce el borde de la bandeja, y Mie asoma unos px por la derecha |
| Sólo se veía la sombra del poste, no la de la bandeja | La bandeja vuelve a proyectar sombra (`castShadow`), y se quita la penumbra ancha que la sustituía (`TRAY_SHADOW` en `contact.ts`), que la habría oscurecido dos veces. El atril conserva su penumbra de contacto |
| Mie y Wakayama, dentro de la bandeja; Wakayama cerca de su prefectura y no a la altura de Nara; Ōsaka, un poco más abajo | La escena publica la cara visible de la bandeja en la ventana (`MAQUETA.frame`) y el corro no sale de ella: la que asoma se acerca a su prefectura y, si no basta, gira hacia dentro (`frameExcess`). Dos etiquetas a menos de 96 px de lado no comparten altura (`sameLevel`). Retoques a ojo en `PrefectureLabels` (`RING_TOUCH`): **Wakayama** va junto a su prefectura, hacia el mar del oeste (`near`); **Ōsaka**, con su punto casi en el centro del grupo —su rayo no apuntaba a ningún sitio y cambiaba de una pantalla a otra—, lleva un rumbo fijo al oeste, un poco hacia abajo (`aim`). Al separarse, dos etiquetas siguen su orden de partida alrededor del grupo: así no se cambian el sitio. Por CDP a 1366×657 (dos veces, igual), 1600×900 y 1874×977: todo dentro, sin cruces. A 1366 Wakayama y Nara comparten parte de la altura, a 100 px una de otra, cada una a un lado de Nara |
| En el zoom, el nombre de Kyoto ya no salía al pasar el cursor | Vuelve: quieto junto a su prefectura y con su línea, sin apartar al corro ni pisar el pin. Esquiva el cursor sólo al aparecer y luego se queda mientras dura el hover |
| El lago Biwa subía otra vez con Shiga al hacer hover en el zoom | El agua no subía —tiene su propia malla, sin `aPref`—, pero de frente lo parecía: la orilla era el borde del agujero de la losa de Shiga, que sí sube. Ahora el agua se adelanta 0,45 u en profundidad por su propio rayo de vista (mismo píxel, más cerca: `LAKE_AHEAD` en `slabMaterial.ts`) y es ella la orilla; no escribe profundidad y se pinta entre las losas y el pin (`renderOrder`), así el pin queda encima. Por CDP a 1874×977: la orilla no se mueve al levantar Shiga. Y la elección del cursor pasa a `pickSlab` (`zoom.ts`), que no cuenta los cantos: `check:path` comprueba con la cámara real que el cursor sobre el agua no elige Shiga |
