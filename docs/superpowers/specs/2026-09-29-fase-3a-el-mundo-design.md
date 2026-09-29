# Fase 3A — El mundo: diseño

> Bloque 3A de la Fase 3 («El Camino»). La Fase 3 se parte en tres bloques con
> parada propia, como la Fase 2: **3A el mundo**, 3B la fauna en el camino, 3C la
> navegación. Este documento cubre **sólo 3A**; 3B y 3C se diseñan cuando se
> vayan a implementar, con lo aprendido en la revisión de éste.

## 1. Qué se busca

Que navegar sea avanzar por el camino. Hoy la escena es un decorado fijo que
cambia de golpe al cambiar de ruta; al terminar 3A es **un mundo continuo** por
el que la cámara se desplaza con el scroll, y cambiar de sección es recorrer el
tramo que separa una estación de la siguiente.

**Criterio de éxito (revisión visual del usuario):** bajar desde la Home hasta
Gastronomía sólo con el scroll se siente como caminar por un sendero —con curvas,
con la subida de Fushimi Inari, con el paisaje transformándose entre
estaciones— sin cortes, sin mareo y sin que la cámara entre nunca en la escena.

## 2. Decisiones ya tomadas

| Tema | Decisión | Origen |
|---|---|---|
| Modelo del mundo | **Mundo continuo sobre un sendero que avanza siempre hacia el fondo** (−Z), con curvas laterales y pendiente. Sin curvas en U | Enfoque 1, elegido por el usuario |
| Llegada a la siguiente estación | **Automática** al terminar el tramo con el scroll, más un enlace explícito siempre visible | Usuario |
| Slugs en inglés | Se quedan en español (el export estático no tiene middleware que reescriba). Se reconsidera en la Fase 9 | Usuario |
| Fauna | Anclada al mundo + cercanía por estación | Usuario — **se implementa en 3B**, no aquí |
| Íconos del sidebar | Generados por código | Usuario — **se implementa en 3C** |
| Scroll en el tramo | Curva con inercia **`power2.inOut`**: arranca y llega con peso | Recomendación del usuario para 3A |
| Giro de cámara en curvas | **Bien acotado**, en ángulo y en velocidad angular, sobre todo en los viajes rápidos, para evitar mareo | Recomendación del usuario para 3A |
| `MotionPath` de GSAP | No se usa: la curva vive en 3D y la de three da tangentes y longitudes. GSAP sigue con las tweens del viaje y ScrollTrigger | Se actualiza el PLAN |

## 3. El sendero

### 3.1 Datos en `journey.ts`

`journey.ts` sigue siendo la fuente única de verdad. Cambios:

- **`PATH_LENGTH = 400`**: profundidad total del camino, en unidades de mundo.
  Con los `pathT` actuales, cada estación queda a unas 64–72 unidades de la
  siguiente.
- **`lateral`** (nuevo, en `StationEnvironment`): desvío lateral del camino en
  el punto de la estación, en unidades. Valores iniciales, calibrables en la
  revisión: inicio 0, ubicación −8, eventos 2, fushimi-inari −6,
  kiyomizu-dera 4, gion −5, gastronomía 0. Entre estaciones consecutivas
  |Δlateral| ≤ 10.
- **`slope`** conserva su valor pero cambia de sentido: deja de ser «cuánto sube
  el camino en el cuadro de esta estación» y pasa a ser **la pendiente de su
  tramo**: sube `slope` unidades cada 22 de camino (22 es la distancia de la
  cámara a su punto de interés, así que en la vista de la estación se ve la
  misma cuesta que hoy). Fushimi Inari 2,4 → ~6°; Kiyomizu-dera 1,2 → ~3°.

### 3.2 Geometría (`scene/path/journeyPath.ts`, módulo puro)

- El parámetro del camino es la **profundidad recorrida** `d ∈ [0, 400]`, con
  `z = −d`. Cada estación está en `d = pathT × PATH_LENGTH`.
- **Eje lateral** `pathX(d)`: entre dos estaciones, `lerp(lateralᵢ, lateralᵢ₊₁,
  smoothstep(u))`. La tangente es **nula en cada estación** —la vista de la
  estación es frontal, de cartel— y máxima a mitad de tramo. Con |Δ| ≤ 10 en
  ≥ 64 unidades, el rumbo nunca pasa de ~13°.
- **Pesos de zona** `zoneWeights(d)`: partición de la unidad. Cada estación pesa
  1 en su entorno y se funde con la vecina en una banda centrada en la mitad del
  tramo (50 % del tramo). Todo lo que se mezcla entre estaciones usa estos
  pesos.
- **Altura del camino** `pathY(d)`: integral de la pendiente de cada zona,
  ponderada por los pesos. Sólo sube (ninguna estación declara pendiente
  negativa); todo lo demás es relativo a ella.
- Todo se precalcula en una **tabla uniforme en `d`** (paso 0,5), con margen
  antes de 0 y después de 400. Las consultas son O(1) por interpolación: el
  terreno hace decenas de miles.
- Como `d` es la profundidad y no la longitud de arco, la diferencia entre
  ambas es < 3 % con rumbos de 13°. No merece la complejidad de reparametrizar.

### 3.3 `PATH`: el estado vivo del recorrido

Objeto de módulo, **un único escritor** (el rig de cámara), mismo criterio que
`WIND` y `PARALLAX`: cambia a 60 fps y no puede vivir en el store.

```ts
PATH = {
  d,          // profundidad del punto de interés de la cámara
  progress,   // d / PATH_LENGTH — el «pathProgress» del PLAN
  advance,    // avance acumulado (con signo): lo integran los pétalos
  offset,     // desfase de viaje en curso (0 en reposo)
  frame,      // { x, y, z, yaw }: el encuadre local que usan pétalos y fauna
}
```

`pathProgress` **sale del store**. En su lugar el store gana `zone`: la estación
en cuyo tramo está la cámara, que cambia a ritmo humano y es la que leen el
ambiente, el audio y el director de fauna.

## 4. El terreno

- `terrainHeight(x, z)` pasa a ser **global**: `pathY(d) + relieve`, con
  `u = x − pathX(d)` como distancia al eje del camino.
- El **pasillo central** (|u| < 7) sigue siendo imposible de invadir por
  construcción: `sideMask()` se evalúa sobre `u`, no sobre `x`, así que la
  garantía se mantiene en las curvas.
- La **amplitud de cada costado** es la mezcla, por pesos de zona, de la
  amplitud de cada estación en ese lado (`hills` × `hillSides`). Al ir de
  Eventos a Fushimi Inari las lomas suaves crecen hasta montaña poco a poco.
- Desaparece la máscara `HILL_START_Z`/`HILL_FULL_Z` («sin relieve en primer
  plano»): era relativa a una cámara quieta. Ahora las colinas pasan a los
  lados, casi siempre fuera de cuadro. La amplitud cerca del pasillo se calibra
  en la revisión.
- **Una sola malla** larga que cubre el camino con márgenes (≈ 360 × 700
  unidades), calculada **una vez** al montar. Resolución por tier (del orden de
  180 × 340 segmentos en alto, menos en medio y bajo).
- **Color por vértice**: el tinte de suelo de cada estación (el 30 % de
  `palette.ground` sobre el washi, como hoy), mezclado por pesos de zona.

## 5. Las piedras

- **Todo el recorrido**, de `d ≈ −30` (bajo la cámara de la Home) a `d ≈ 420`,
  con separación ~1,45: unas 310 piedras.
- **`InstancedMesh`**: 12 geometrías procedurales (las mismas de `Stone.tsx`,
  con 12 seeds) y cada instancia con su giro y su escala. 12 llamadas de dibujo.
- **La S de `3.png`**: las piedras serpentean ±3 unidades alrededor del eje
  del camino, con una onda de ~34 unidades, dentro del pasillo. La cámara sigue
  el eje, no la S.
- **Tamaño de mundo real** (~0,7 con variación de ±12 %). El degradado actual
  cerca/lejos (0,86 → 0,52) era un truco de cámara quieta: con la cámara
  avanzando, las piedras crecerían al acercarse.
- Se apoyan en `terrainHeight()`, algo enterradas, como hoy.

## 6. La cámara

### 6.1 Encuadre sobre el camino

- `CAMERA_BASE` se mantiene como **encuadre local**: cámara a 22 unidades por
  detrás del punto de interés y 2,3 por encima, ~6° de inclinación, horizonte
  al 32 %. `framing.ts` sigue valiendo en coordenadas locales.
- **Punto de interés**: el eje del camino en `PATH.d`, a 2,9 sobre `pathY`.
- **Cámara**: 22 unidades por detrás siguiendo el rumbo de la cámara, a 5,2
  sobre el terreno que tiene debajo.
- **Inclinación acotada**: la inclinación hacia abajo queda entre 3,5° y 8,7°,
  que es mantener el horizonte entre el 25 % y el 40 % desde arriba. Si la
  cuesta la saca de esa banda, **se sube la cámara**, nunca se inclina más (la
  regla «altura e inclinación son dos mandos distintos»).
- El **parallax de cursor** se suma encima, en los ejes locales, igual que hoy.
- `framing.ts` gana el **aspecto real** de la pantalla (hoy asume 16:9), que el
  rig publica. 3B lo necesita para los márgenes de la fauna.

### 6.2 Rumbo acotado (anti-mareo)

- El rumbo objetivo es la tangente de `pathX` **promediada en ±10 unidades**.
- **Tope de ángulo**: |rumbo| ≤ 15°.
- **Tope de velocidad angular**: 12°/s.
- **En viajes rápidos**, el encuadre sigue una versión filtrada del camino
  (paso bajo en rumbo y en desvío lateral, constante de ~0,5 s) que recorta las
  curvas. A velocidad de scroll normal coincide con el camino.
- `check-path` verifica los topes sobre todo el recorrido (§10).

## 7. Scroll, tramo y llegada

### 7.1 Cada página: contenido + tramo

- **Contenido**: mientras se lee, la cámara avanza **4 unidades** en total,
  lineal. Se sigue «en» la estación.
- **Tramo** (`components/sections/PathTramo.tsx`): sección de **220vh** al final
  de la página. Su progreso de scroll lleva la cámara desde `dᵢ + 4` hasta
  `dᵢ₊₁` con la curva **`power2.inOut`**: arranca con peso, cruza a buen paso y
  llega frenando. La curva se declara con nombre en `animation/presets.ts`.
- En el tramo aparecen, cada vez más nítidos con el progreso, el kanji, el
  nombre y el lema de la siguiente estación, y el enlace «Seguir el camino →
  …». Es DOM real. Queda el hueco para los carteles de `3/7/9/11.png`, que
  llegan con el contenido de cada fase.
- La Home tiene tramo hacia Ubicación. Gastronomía, final del camino, no tiene.

### 7.2 Llegada automática

- Al llegar al final del tramo con scroll **hacia abajo**, `router.push` a la
  siguiente estación (queda en el historial). La página nueva empieza en scroll
  0, que corresponde a `dᵢ₊₁`: exactamente donde ya está la cámara, sin salto.
- Sólo la dispara un scroll real hacia abajo, una vez por página: nunca un
  scroll restaurado ni un cambio de tamaño.

### 7.3 Viaje

- `PATH.d = objetivo del scroll + PATH.offset`.
- Al cambiar la estación activa (enlace, atrás/adelante, llegada): `offset =
  d actual − nuevo objetivo`, y GSAP lo lleva a 0 con la curva `piedra`.
  Duración de 1,8 s (`--dur-viaje`, una estación) a ~4 s (el camino entero). En
  la llegada automática el desfase es ~0 y no hay viaje.
- El scroll durante el viaje se suma sin saltos: los dos términos son
  independientes.
- **Cada cambio de ruta devuelve el scroll arriba.** Si no, «atrás» dejaría a
  la persona al fondo del tramo y volvería a disparar la llegada. Coste
  asumido: no se restaura la posición de scroll; «atrás» es desandar el camino.
- **URL directa**: la cámara empieza en esa estación, sin viaje.
- **Contenido nuevo**: entra con un fundido (`components/sections/ContentArrival.tsx` —un `template.tsx` no se volvería a montar entre dos lugares: comparten el segmento `lugares`—, curva
  `washi`). En un viaje largo espera al último tramo, para que el recorrido se
  vea limpio. El pulido de estas transiciones es de 3C.
- Las páginas que no son estación (`/diagnostico`, `/tipografia`) dejan la
  cámara donde estaba.

### 7.4 Movimiento reducido y modo 静

- Sin viaje animado: la cámara salta a la estación (un solo frame, el bucle está
  en `demand`).
- El scroll no mueve la cámara, el tramo se acorta a lo necesario para el
  enlace y **no hay llegada automática**: un cambio de página provocado por el
  scroll sorprende a quien pidió menos movimiento.

## 8. El ambiente sigue a la cámara

La **ruta** dice adónde ir; la **posición de la cámara** dice qué se ve y qué se
oye. Todo se mezcla por pesos de zona en `PATH.d`:

| Qué | Cómo |
|---|---|
| Niebla (near/far, color) y fondo (washi + tinte de cielo) | Mezcla continua, escrita cada frame directamente en `scene.fog` y el fondo, sin estado de React |
| Viento base | Mezcla continua, en `WindDriver` |
| Pétalos | Hasta dos sistemas vivos (las dos zonas vecinas), cada uno con su peso sobre la densidad. Se montan/desmontan al entrar/salir de la influencia de una zona |
| Sonido | Capas de la zona dominante (`store.zone`); el motor ya hace los fundidos |
| Luz direccional y su caja de sombras | Siguen al punto de interés (hoy fijas en ±12 alrededor del origen) |

### 8.1 Pétalos con la cámara en movimiento

- Las cajas de las capas viajan con el encuadre local (`PATH.frame`).
- El avance de la cámara se integra en la CPU (`PATH.advance` → uniform
  `uAdvance`) y **hace fluir los pétalos hacia la cámara**: se atraviesa la
  lluvia, no se la ve pegada a la pantalla.
- En profundidad pasan a envolver con `fract()`. Como ese borde está dentro de
  cuadro, **se desvanecen en los dos extremos de la caja** (la trampa del
  `fract()` de `CLAUDE.md`). La fase se integra, no se multiplica, así que es
  continua aunque la velocidad cambie.

## 9. La fauna durante 3A (provisional)

3B rehace el anclaje de la fauna. En 3A sólo lo imprescindible para que no se
rompa:

- El grupo de la fauna **viaja con el encuadre de la cámara** (`PATH.frame`):
  respecto de la cámara, se ve exactamente como hoy.
- `groundAt()` convierte la posición local a mundo y lee el `terrainHeight()`
  global: nada flota ni se hunde en las cuestas.
- El elenco sale de `store.zone`, no de la ruta. Al cambiar de zona los actos
  vivos **terminan su acto** (hoy se borran de golpe); la zona nueva sólo
  cuenta para el siguiente reparto.
- **Sin reparto nuevo durante un viaje** (`PATH.offset ≠ 0`).
- **Limitación conocida, que resuelve 3B**: mientras se hace scroll, los animales
  de suelo se desplazan con la cámara y parecen patinar.

## 10. Verificación

- **`bun run check:path`** (`scripts/check-path.ts`, puro), sobre todo el
  recorrido:
  - el camino avanza siempre hacia el fondo;
  - el pasillo central (|u| < 7) está libre de relieve;
  - los pesos de zona suman 1 en cada punto;
  - rumbo ≤ 15° y velocidad angular ≤ 12°/s a la velocidad máxima de viaje;
  - la inclinación queda en [3,5°, 8,7°] (horizonte al 25–40 %);
  - la cámara nunca queda a menos de 3 unidades del terreno;
  - las piedras apoyan sobre el terreno.
- `bun run typecheck` y `bun run build`.
- **GLSL**: el shader de pétalos cambia → se compila en un contexto WebGL2 real
  y se revisa la consola en busca de «Shader Error».
- **Navegador**: Home → Gastronomía sólo con scroll; saltos con los enlaces;
  atrás/adelante; URL directa; movimiento reducido y modo 静; tamaño móvil;
  tiempo de construcción del terreno y fps; que el canvas no quede en 300×150.
- `/diagnostico` muestra `PATH` (profundidad, progreso, zona, desfase de viaje).

**A calibrar en la revisión del usuario:** amplitud de las colinas cerca del
pasillo en zonas montañosas, largo del tramo (220vh), duración de los viajes,
avance mientras se lee (4 u), valores de `lateral`, tamaño de las piedras.

## 11. Mapa de archivos

**Nuevos**
- `src/scene/path/journeyPath.ts` — sendero, tabla, pesos de zona, `PATH`.
- `src/animation/travel.ts` — desfase de viaje (tween de GSAP).
- `src/animation/useJourneyScroll.ts` — sustituye a `useScrollScene.ts`.
- `src/components/sections/PathTramo.tsx` — el tramo al final de cada página.
- `src/components/sections/ContentArrival.tsx` — fundido de entrada del contenido (un `template.tsx` no se volvería a montar entre dos lugares: comparten el segmento `lugares`).
- `scripts/check-path.ts` — comprobaciones puras (`bun run check:path`).

**Cambian**
- `src/config/journey.ts` — `PATH_LENGTH`, `lateral`, sentido de `slope`.
- `src/scene/systems/elevation.ts` — `terrainHeight(x, z)` global.
- `src/scene/systems/Terrain.tsx` — malla única, color por vértice.
- `src/scene/systems/StonePath.tsx`, `src/scene/objects/Stone.tsx` — instanciado.
- `src/scene/camera/CameraRig.tsx`, `src/scene/camera/framing.ts` — rig sobre el
  camino, topes de rumbo e inclinación, aspecto real.
- `src/scene/SceneCanvas.tsx`, `src/scene/FoundationScene.tsx` — ambiente por
  zona, niebla/fondo por frame, luz que sigue a la cámara.
- `src/scene/systems/PetalSystem.tsx`, `src/scene/systems/petals.ts` — flujo en
  profundidad, fundido en los bordes, dos zonas.
- `src/scene/systems/WindDriver.tsx`, `src/audio/AmbientAudio.tsx` — por zona.
- `src/scene/systems/fauna/*` — sólo lo de §9.
- `src/store/useKyotoStore.ts` — fuera `pathProgress`, entra `zone`.
- `src/animation/MotionEngine.tsx`, `src/animation/presets.ts`.
- `src/components/ActiveStation.tsx`, `src/components/sections/StationShell.tsx`,
  `src/app/[locale]/page.tsx` — tramo y viaje.
- `src/components/ui/DiagnosticsPanel.tsx`, `src/messages/{es,en}.json`.
- `docs/PLAN.md`, `CLAUDE.md`, READMEs de `animation/`, `scene/camera/`,
  `scene/systems/`.

**Se queda en 3A**: `StationLinks` (hace falta para probar los viajes; lo
sustituye el sidebar en 3C).

## 12. Fuera de alcance (3A)

- Anclaje de la fauna al mundo, cercanía por estación, tope de lo que vuela,
  márgenes con la cámara real, retirada de actos → **3B**.
- Sidebar radial, íconos, progreso del camino, navegación móvil, teclado,
  pulido de transiciones → **3C**.
- Carteles con datos en los tramos → fases de contenido (4–8).
- Decoración por estación (toriis, cerezos, machiya) → fases 4–8.
