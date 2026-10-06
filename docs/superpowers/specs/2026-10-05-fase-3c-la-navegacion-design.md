# Fase 3C — La navegación: diseño

> Bloque 3C de la Fase 3 («El Camino»). 3A dejó un mundo continuo por el que la
> cámara viaja entre estaciones y 3B puso la fauna en ese mundo. Lo que falta es
> **cómo se mueve la persona por el camino**: el sidebar de los seis círculos de
> `13.png`, el progreso, el móvil y el teclado. Este documento cubre sólo 3C. La
> Home (Fase 4) y las páginas siguientes se diseñan al llegar a ellas.

## 1. Qué se busca

Que desde cualquier punto del sitio se pueda llegar a cualquier sección **sin
romper la sensación de camino**. Saltar sigue siendo recorrer: la cámara viaja y
la navegación lo acompaña.

**Criterio de éxito (revisión visual del usuario):**

- Desde cualquier página se llega a cualquier estación con un clic, un toque o
  el teclado, y **siempre se ve el viaje**.
- En reposo, la navegación no le quita protagonismo al cuadro. Se descubre sola
  al acercarse.
- El progreso del camino se lee de un vistazo, y durante un viaje la marca
  recorre el riel al ritmo de la cámara.
- Todo funciona con el canvas apagado, en modo 静, con movimiento reducido y con
  un lector de pantalla.
- En vertical, el milano se ve al menos la mitad de su acto, igual que en
  horizontal.

## 2. Decisiones ya tomadas

| Tema | Decisión | Origen |
|---|---|---|
| Técnica de los íconos | **SVG calculado**: geometría en TypeScript, sin dibujar nada a mano. Japón sale de Natural Earth (dominio público) | Usuario |
| Panel en escritorio | **Riel de piedras**: siempre visible y mínimo en el borde derecho. Se despliega en círculos sobre un arco al acercar el cursor o al llegar con el teclado | Usuario |
| Móvil | **Barra plegada + abanico**: una píldora flotante con el riel en horizontal y los mandos; al tocarla, los 6 círculos se abren en abanico | Usuario |
| Fauna en vertical | **Entra en la 3C**, como último paso y separada de la navegación | Usuario |
| Idioma | **Botón ES ⇄ EN** junto a 音 y 静 | Usuario |
| Arquitectura | **Enfoque A**: una navegación persistente en el layout, con el progreso fuera de React | Usuario |
| Títulos | **Un `<title>` por estación** («Ubicación · Kyoto») | Usuario |
| Animación del DOM | GSAP y las curvas de `tokens.css` (`--ease-spring`, `--ease-washi`). **Motion no entra**: GSAP ya está cargado y el PLAN lo deja como opcional | Propuesta aceptada |
| Atajos de teclado globales | **No hay.** Las flechas y Av Pág ya caminan el camino, y las letras son de los lectores de pantalla | Propuesta aceptada |

## 3. Estructura y datos

### 3.1 Dónde vive

`<JourneyNav>` es un componente cliente montado en `app/[locale]/layout.tsx`,
**antes** de `{children}`. Como `<SceneRoot>`, **no se desmonta** al cambiar de
ruta: la marca de progreso sigue viva durante el viaje.

El orden del DOM queda así: enlace «saltar al contenido» → navegación →
contenido → mandos de escritorio.

Se renderiza en el export estático, así que los 7 enlaces existen en el HTML de
cada página y los buscadores los siguen.

Las dos presentaciones (`RadialSidebar` y `MobileNav`) se renderizan siempre y
el CSS decide cuál se ve (§6.1). La oculta lleva `display: none`, así que sale
del árbol de accesibilidad y del orden de tabulación. Al hidratar no hay salto de
maquetación.

### 3.2 Componentes

| Archivo | Qué hace |
|---|---|
| `components/nav/JourneyNav.tsx` | Calcula la estación actual a partir de la URL y monta las dos presentaciones |
| `components/nav/RadialSidebar.tsx` | El riel de escritorio (§4) |
| `components/nav/MobileNav.tsx` | La barra y el abanico (§6) |
| `components/nav/StationIcon.tsx` | Vuelca un `IconShape` en un `<svg aria-hidden>` sobre el círculo del `halo` |
| `components/nav/icons/*.ts` | Una función pura por ícono, más `stoneOutline` (§5) |
| `components/nav/icons/japan.generated.ts` | Los polígonos de Japón, generados por `bun run geo` (§5.4) |
| `components/nav/railProgress.ts` | Puro: de la profundidad del camino a la posición en el riel, y de ahí a coordenadas del arco |
| `components/nav/useRailProgress.ts` | El callback de `gsap.ticker` que mueve la marca (§3.4) |
| `components/nav/LanguageToggle.tsx` | ES ⇄ EN (§3.5) |

### 3.3 La estación actual sale de la URL

`journey.ts` gana un derivado puro:

```ts
/** La estación de una ruta sin idioma («/lugares/gion» → gion). Null fuera del camino. */
export function stationFromPathname(pathname: string): Station | null;
```

`JourneyNav` lo usa con el `usePathname` de `@/i18n/navigation`. Así
`aria-current="page"` **ya es correcto en el HTML estático** de cada página, sin
esperar al store, que antes de hidratar dice `inicio` en todas. En las páginas
de herramientas (`/diagnostico`, `/tipografia`) devuelve `null` y ningún círculo
queda marcado.

### 3.4 El progreso, fuera de React

La marca cambia 60 veces por segundo, así que sigue la regla de `WIND` y
`PARALLAX`: ni store ni renders.

`useRailProgress` se engancha a `gsap.ticker`, el mismo reloj que Lenis. En cada
frame:

1. Lee la profundidad: `PATH.d` si `PATH.live`; si no, la de la estación de la
   URL.
2. La convierte en **posición de riel** `s ∈ [0, 6]`:
   `s = i + (d − dᵢ) / (dᵢ₊₁ − dᵢ)`, donde `i` es la estación anterior a `d` y
   `dᵢ` sale de `STATION_DEPTHS`. 0 = 京都 y 6 = 京料理.
3. Si `s` cambió: coloca la marca (`transform`) en el punto del arco con la
   curvatura actual (§4.2) y marca como recorridas (`data-walked`) las piedras
   con `i ≤ s`. Toca atributos del DOM directamente, sin `setState`.

Las estaciones van **equiespaciadas en el riel**, no en proporción a su
distancia. En proporción, el primer tramo (64 u de 786) dejaría ~39 px entre 京都
y Ubicación, y los círculos de 56 px se pisarían al desplegarse. La distancia
real se nota igualmente en la velocidad: la marca va más deprisa por los tramos
cortos.

**`PATH.live`.** Es un campo nuevo de `PATH`. Lo pone a `true` su único
escritor, `CameraRig`, en su primer frame. Sin él, si el canvas no carga nunca
(sin WebGL), la marca se quedaría clavada en la Home.

### 3.5 Idioma

`LanguageToggle` es un `<Link>` de `@/i18n/navigation` con `locale` del otro
idioma y la misma ruta. Los slugs son iguales en los dos idiomas (decidido en la
Fase 3), así que la ruta no hay que traducirla.

El `<html lang>` vive en `[locale]/layout.tsx`: cambiar de idioma cambia ese
segmento y **la escena se monta de nuevo**. Es un aterrizaje en la misma
estación, sin viaje. Es lo esperable al cambiar de idioma y no rompe la regla 3,
porque el contexto viejo se libera al desmontarse. Se verifica al implementar
(§9).

### 3.6 Cambios en lo que ya existe

- **`AmbientControls`** pasa de dos a tres botones (音 · 静 · ES/EN) y recibe una
  variante: `corner` (la esquina de escritorio, como hoy) o `bar` (dentro de la
  barra móvil). Las dos se renderizan y el CSS decide cuál se ve.
- **Se borra `components/nav/StationLinks.tsx`** y sus dos usos (la Home y
  `StationShell`). Su propio comentario lo anunciaba.
- Los `<main id="contenido">` reciben `tabIndex={-1}`, para que Escape pueda
  devolverles el foco (§7).
- **`PetalGeometry.ts`** saca sus contornos a `lib/petalOutlines.ts` (§5.5).

## 4. El riel de escritorio

```
 plegado (≈28 px)          desplegado
                                               京都
      京                                  ╭──╮
      ┊                       位置 Ubicación │地│   ← etiqueta al pasar por encima
      ◆  ← recorridas                    ╰──╯
      ●  ← tú                           ╭──╮
      ┊                                 │桜│
      ◇  ← por delante                 ╭──╮
      ◇                                │⛩│       arco: su centro queda fuera
      ◇                                 ╭──╮       de la pantalla, a la derecha
      ◇                                 │塔│ …
```

### 4.1 Forma

- En el borde derecho, centrado en vertical, de `min(64vh, 560px)` de alto.
- 京都 arriba y las 6 estaciones debajo, equiespaciadas sobre un **arco** cuyo
  centro queda fuera de pantalla a la derecha. La curvatura (la flecha del arco)
  mide **8 px plegado y 40 px desplegado**.
- **Plegado:** cada estación es una piedrecita irregular de ~10 px (§5.3). Las
  recorridas van rellenas con el `accent` de su estación y las de delante, solo en
  contorno `sumi-faint`. Las une una línea discontinua, como pisadas.
- **Desplegado:** cada piedra es un círculo de 56 px con el `halo` de su estación,
  un filo sumi tenue y su ícono.
- **Las piedras son los propios enlaces.** Plegar y desplegar solo cambia su
  tamaño; no hay dos juegos de enlaces.

### 4.2 La marca «tú»

Un punto washi con anillo shu, `aria-hidden`. La coloca `useRailProgress` (§3.4)
en el punto del arco que corresponde a `s`, **con la curvatura del momento**: un
valor de módulo que anima la timeline de despliegue y que el ticker lee. Así la
marca nunca se sale de la línea, ni siquiera a mitad del despliegue.

### 4.3 Despliegue

Es una timeline de GSAP reversible. Se despliega con cualquiera de estos tres:

- el cursor a menos de **96 px** del borde derecho (un `pointermove` pasivo en
  `window`);
- el cursor sobre el riel;
- el foco **de teclado** dentro del riel (`:focus-visible`).

Al desplegarse:

1. La curvatura pasa de 8 a 40 px (curva `washi`, `--dur-medio`).
2. Las piedras crecen hasta los círculos con la curva `spring` y 40 ms de
   desfase, repartido **desde la estación actual hacia fuera**, como una onda.
3. Los íconos aparecen 120 ms después y 京都 crece hasta su tamaño de marca.

Se pliega 350 ms después de que el cursor salga de la zona y no haya foco de
teclado dentro, con la misma timeline al revés a `--dur-rapido`.

El clic deja el foco en el enlace. Por eso **solo el foco de teclado** mantiene el
riel abierto; si contara cualquier foco, se quedaría desplegado después de cada
clic.

### 4.4 Al pasar por encima

- El círculo da un pulso *spring* (escala 1 → 1,14 → 1,06) y se queda en 1,06
  mientras dura el hover o el foco.
- A su izquierda aparece una etiqueta de papel translúcido, con el mismo estilo
  que las tarjetas del camino: el kanji (Zen Old Mincho, en el `accent`) y el
  nombre (One Jinja).
- El ícono hace su microanimación (§5.6).
- La estación actual lleva además un anillo de 2 px del `accent`.

### 4.5 Transiciones de un salto

Al hacer clic en un círculo, sobre todo uno lejano:

1. **El riel se pliega al instante**, para que el viaje se vea limpio. Es el mismo
   criterio que `ContentArrival`.
2. **La marca camina por el riel** al ritmo de la cámara, porque lee `PATH.d`.
   Hereda sin código nuevo la curva `piedra` y el tope de 160 u/s de `travel.ts`.
3. Cada vez que la cámara entra en la zona de una estación (cambia `zone` en el
   store, a ritmo humano), **su piedra da un destello**. Va por
   `useKyotoStore.subscribe` y GSAP anima el nodo directamente, sin render.
4. Al llegar, la piedra de destino **se asienta** con un pulso *spring*.

### 4.6 Modo 静 y movimiento reducido

- El despliegue es un fundido de 150 ms: sin spring, sin onda y sin cambio de
  curvatura.
- Sin microanimaciones ni destellos.
- La marca sigue a `PATH.d`. En estos modos la cámara salta, así que la marca
  también salta.

### 4.7 Convivencia

- Los mandos 音 · 静 · ES siguen abajo a la derecha, por debajo del final del
  riel.
- En pantallas bajas (< 600 px de alto) los círculos miden
  `clamp(44px, 7vh, 56px)`: nunca menos de 44 px.
- Las tarjetas `derecha` del tramo se colocan hoy a `right: 6vw`, que a 1024 px
  son 61 px. Pasan a `right: max(6vw, 4.5rem)`, para dejar siempre libre el riel
  plegado. Desplegado puede taparlas un momento: es transitorio.
- z-index al nivel de los mandos (40). Solo el riel y su zona de 96 px reciben el
  puntero.

## 5. Los íconos

### 5.1 Contrato

```ts
interface IconLayer {
  /** Path calculado, en viewBox −1…1, redondeado a 3 decimales. */
  readonly d: string;
  /** Siempre `var(--color-…)` de tokens.css: la paleta no se duplica en TS. */
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  /** Gancho de su microanimación: se vuelca como `data-part`. */
  readonly part?: string;
}
type IconShape = readonly IconLayer[];
```

- Cada ícono es una función pura, sin React ni three.
- La geometría se calcula **una vez, al importar el módulo**, con semillas fijas.
  El HTML del servidor y el del cliente son idénticos y no hay errores de
  hidratación.
- El fondo del círculo es el `halo` de la estación (`journey.ts`). Los acentos
  por estación sí se permiten allí.
- `13.png` marca el lenguaje (silueta plana, dos o tres tintas), pero no se
  calca: es una referencia con marca de agua.

### 5.2 Los seis

| Ícono | Cómo se genera | Microanimación |
|---|---|---|
| **mapa** (Ubicación) | Polígonos de `japan.generated.ts` (§5.4) en el `accent` de Ubicación, más un punto en Kyoto (35,01°N 135,77°E) en kohaku con filo sumi | El punto de Kyoto lanza una onda que se expande y se desvanece |
| **sakura** (Eventos) | Ramificación recursiva con semilla: tronco en diagonal de abajo a la izquierda hacia arriba a la derecha, dos niveles de ramas que se afinan, y flores de 5 pétalos con `sakuraOutline()` (§5.5) girado 72° cada vez, más algún capullo | La rama se mece (±3° sobre su base) y un pétalo se suelta y cae girando |
| **torii** (Fushimi Inari) | Por proporciones: kasagi con las puntas alzadas (curvas cuadráticas), shimaki, nuki, gakuzuka, dos hashira con un leve ahusado y nemaki oscuro al pie. Debajo, líneas de agua discontinuas | Las líneas de agua ondulan (`stroke-dashoffset`) |
| **pagoda** (Kiyomizu-dera) | Tres tejados, cada uno al 78 % del anterior y con los aleros curvados hacia arriba, cuerpos entre ellos y el sōrin en kohaku | Destella el sōrin y los tejados se asientan uno tras otro, de abajo arriba |
| **farol** (Gion) | Chōchin: nueve costillas cuya anchura sigue el perfil de una elipse, alternando shu y shu oscuro, tapas sumi, cordón en triángulo y borla | Se balancea como un péndulo amortiguado desde el cordón y se enciende por dentro (kohaku) |
| **naruto** (Gastronomía) | Dos rodajas, la de atrás desplazada. Borde festoneado `r(θ) = R + a·sin(10θ)` y espiral de Arquímedes `r = kθ` en tinta sumi sobre kami | La espiral de la rodaja de delante gira |

### 5.3 Las piedras del riel

`stoneOutline(seed)`: un contorno cerrado de 7–9 vértices con ruido en el radio
(`mulberry32` de `lib/procedural.ts`), una semilla distinta por estación. Es el
mismo lenguaje que las piedras del camino, a 10 px.

### 5.4 Japón: `bun run geo`

Un script nuevo, `scripts/build-geo.ts`, sigue el patrón de `bun run models`:

1. Si no está ya, descarga `ne_50m_admin_0_countries.geojson` de Natural Earth
   (repositorio `nvkelso/natural-earth-vector`) a `assets/geo/source/`. **No se
   versiona**, igual que los modelos originales.
2. Se queda con Japón y lo **recorta** de Kyushu a Hokkaido (sin Ryukyu ni
   Ogasawara, como en `13.png`).
3. Lo **proyecta**: equirrectangular, con la longitud corregida por `cos 37°`.
4. **Simplifica** con Visvalingam hasta unos 300 vértices en total y **descarta**
   los islotes por debajo de un área mínima.
5. Normaliza al viewBox −1…1 y escribe `components/nav/icons/japan.generated.ts`
   (**sí se versiona**), con los polígonos como arrays de puntos y la posición
   de Kyoto. El path `d` se arma en TypeScript, en `icons/mapa.ts`.

Guarda polígonos y no un path ya hecho: así el mismo dato le puede servir al mapa
extruido de la Fase 5 sin rehacer el pipeline. En esta fase no se construye nada
para eso.

La licencia (dominio público) se anota en un `assets/geo/LICENSES.md` nuevo,
igual que fuentes y modelos.

### 5.5 Los contornos de pétalo, fuera de `PetalGeometry`

`sakuraOutline()` vive hoy dentro de `scene/objects/PetalGeometry.ts`, que
importa three. Si el ícono importara ese archivo, **three entraría en el bundle
de la navegación**, que carga en todas las páginas antes que el canvas.

Los tres contornos (`sakuraOutline`, `momijiOutline`, `bambuOutline`) y
`mirrorHalf` son puros y pasan a `src/lib/petalOutlines.ts`. `PetalGeometry`
los importa de ahí. En la escena no cambia nada: es la misma función.

### 5.6 Microanimaciones

- Las anima GSAP sobre los `[data-part]` de cada ícono, **solo** al pasar el
  cursor o con el foco de teclado, y se revierten al salir.
- En reposo no se anima nada: son seis círculos permanentes y no deben competir
  con el cuadro.
- Con 静 o movimiento reducido no hay microanimaciones.
- Cada módulo de ícono puede exportar su `hover(root: SVGElement):
  gsap.core.Timeline`. `StationIcon` la crea en pausa y la reproduce o la
  revierte.

## 6. Móvil

### 6.1 Cuándo aplica

```css
@media (max-width: 767px), (hover: none) and (pointer: coarse) { … }
```

Es el mismo corte de 768 px que ya usa `globals.css`, más **cualquier pantalla
táctil sin hover**: un iPad en horizontal también recibe la barra, porque el
riel depende de acercar el cursor al borde.

### 6.2 La barra plegada

```
 ┌──────────────────────────────────────┐   flotante: 12 px de margen a los lados,
 │  京 · ◆ ◆ ●─◇──◇──◇──◇     音  静  ES   │   bottom = 12 px + env(safe-area-inset-bottom),
 └──────────────────────────────────────┘   52 px de alto
   └──── un solo botón ────┘ └── mandos ──┘
```

- Es una píldora flotante, no una franja de borde a borde, para tapar lo menos
  posible del camino, que vive en el tercio inferior. El fondo es el papel
  translúcido de las tarjetas de texto del tramo (`surface-paper` al 78 % con
  desenfoque de 6 px).
- **A la izquierda**, el riel en horizontal, con las mismas piedras, la misma
  marca y el mismo `railProgress`, sin curvatura. Todo él es **un solo botón**
  (`aria-expanded`, `aria-controls`, etiqueta `nav.open` / `nav.close`).
- **A la derecha**, `AmbientControls` en su variante `bar`: 音 · 静 · ES, de 44 px.
- El contenido gana en móvil un margen inferior del alto de la barra más 24 px,
  para que el enlace «Seguir el camino» del tramo nunca quede debajo.

### 6.3 El abanico

```
            (桜)     (⛩)
      (地)                 (塔)
   (京)ˡ                      (灯)      ← nombre en One Jinja bajo cada círculo
                 京都                   ← el centro: enlace a la Home
 ┌──────────────────────────────────────┐
```

- **Velo** washi al 60 % con un desenfoque leve sobre la escena.
- 京都 abajo en el centro, como enlace a la Home, y los 6 círculos de 52 px
  sobre un semicírculo de radio `min(40vw, 160px)`. En 360 px quedan 10 px de
  margen a cada lado.
- **Entrada:** los círculos salen del centro y recorren el arco hasta su sitio,
  con spring y 35 ms de desfase. La salida es la misma al revés, más deprisa.
- **Al tocar uno:** pulso *spring* y aparece su kanji. En móvil no hay hover, así
  que es la ocasión de verlo. Después el abanico se cierra y se ve el viaje.
- **Mientras está abierto, Lenis se detiene** (`getLenis()?.stop()`, y `start()`
  al cerrar): el scroll de detrás no puede mover la cámara.
- Es modal: `role="dialog"`, `aria-modal="true"`, `aria-label` = `nav.label`.
  Al abrir, el foco va al círculo de la estación actual; Tab circula solo dentro
  del abanico, y al cerrar el foco vuelve al botón de la barra.
- Con 静 o movimiento reducido aparece con un fundido, sin vuelo ni spring.

### 6.4 Cómo se cierra

Al elegir una estación, al tocar el velo, con el mismo botón, con Escape y con
**«atrás» del sistema**:

- Al abrir se apila una entrada de historial con **la misma URL**
  (`history.pushState`).
- Si llega un `popstate` con el abanico abierto, se cierra.
- Si se cierra de otra forma y esa entrada sigue arriba, se consume con
  `history.back()`.
- Al elegir una estación se navega con `router.replace`, que **sustituye** la
  entrada de relleno: el historial queda igual que tras una navegación normal.

Next 16 integra el `pushState` nativo con su router y la URL no cambia, así que
ni `MotionEngine` ni ScrollTrigger deberían reaccionar. Aun así, **es un riesgo a
verificar** (§12), porque la restauración de scroll ya nos mordió una vez. Si
interfiere, se quita este mecanismo, quedan las otras cuatro formas de cerrar y
se avisa en la revisión.

## 7. Teclado y accesibilidad

### 7.1 Teclado

| Tecla | Qué hace |
|---|---|
| Tab / Shift+Tab | Recorre los 7 enlaces (京都 + 6). El foco de teclado despliega el riel |
| ↑ ↓ (y ← → en el abanico) | Estación anterior o siguiente, sin dar la vuelta al llegar al final |
| Inicio / Fin | 京都 / 京料理 |
| Enter | Sigue el enlace: es un `<a>` de verdad y la cámara viaja |
| Escape | Riel: lo pliega y lleva el foco a `#contenido`. Abanico: lo cierra (§6.4) |

Las flechas, Inicio y Fin hacen `preventDefault` **solo mientras el foco está
dentro de la navegación**. Fuera de ella siguen caminando el tramo.

### 7.2 Lectores de pantalla

- `<nav aria-label={nav.label}>` con un `<ol>`, que anuncia la posición («3 de
  7»).
- El nombre accesible de cada enlace es el nombre de la estación en el idioma
  activo (`stations.<slug>.name`). El ícono, el kanji, la línea y la marca van
  `aria-hidden`.
- La estación actual lleva `aria-current="page"`, correcta desde el HTML estático
  (§3.3).
- El botón de idioma se etiqueta en su propio idioma: `aria-label="English"`,
  `lang="en"`, `hrefLang="en"` (y al revés).

### 7.3 Un título por estación

Hoy todas las estaciones comparten el `<title>` del layout. El anunciador de
rutas de Next lee el título para anunciar el cambio de página, y si no cambia,
**no anuncia nada**: quien usa un lector de pantalla salta de estación sin
enterarse.

- El layout pasa a `title: { template: '%s · Kyoto', default: t('title') }`.
- Cada archivo de página de estación (`ubicacion`, `eventos`, `gastronomia`,
  `lugares/[slug]`) exporta `generateMetadata` con `stations.<slug>.name`.
  `StationShell` es un componente y no puede exportar metadatos. Lugares saca el
  slug de sus `params`. La Home se queda con el título por defecto.

### 7.4 Visibilidad

- El foco se ve como un anillo shu de 2 px con 3 px de separación, que en los
  círculos sigue su forma.
- Cada círculo lleva un filo sumi tenue: los `halo` muy claros (el blanco de
  Ubicación) tienen que separarse del washi.

## 8. La fauna en vertical

### 8.1 Qué pasa hoy

- **El milano** planea en círculos de 5–8,5 u de radio a unas 22–39 u. A 30 u, el
  medio ancho del cuadro es de ~16 u en 16:9 y de ~5 u en 9:16. `check:path` da
  **36 %** de su acto a la vista en 9:16, frente a 74–76 % en horizontal. La
  exigencia del 50 % hoy solo cubre aspectos ≥ 1.
- **El resto:** cada acto guarda `aspect = max(aspecto real, 16:9)`, y con él
  calcula por dónde entrar y salir (`offscreenX`). En vertical, quien cruza de
  lado a lado empieza y termina muy lejos del cuadro real: según la cuenta, se le
  ve en torno a un tercio del acto. La cota protege de aparecer a la vista y lo
  cumple, pero en móvil la fauna se ve poco.

### 8.2 Qué se hace, en este orden

1. **Medir.** `check:path` gana un **informe**, no un umbral que falle: por
   conducta, la fracción del acto a la vista en 9:16 frente a 16:9. Es la línea
   base.
2. **El milano.** `FaunaAct` guarda dos aspectos: `aspect` (acotado a ≥ 16:9,
   como hoy, para los márgenes) y `viewAspect` (el real, el de `VIEW.aspect` al
   nacer). En `planearEnCirculos`, el radio y la deriva del viento se multiplican
   por:

   ```
   ajuste = clamp(viewAspect / (16/9), 0.5, 1)
   ```

   El medio ancho del cuadro es proporcional al aspecto, así que el cociente no
   depende de la profundidad. El **suelo de 0,5** evita que los círculos se
   cierren tanto que parezca que gira sobre sí mismo. El milano es igual de
   grande; solo traza círculos más cerrados. Su velocidad baja con el radio, así
   que sigue por debajo del tope de 3 u/s que ya comprueba `check:path`. La
   exigencia de «≥ 50 % de su acto a la vista» **pasa a cubrir los cuatro
   aspectos**.
3. **El resto se revisa, no se cambia de oficio.** Si en el informe alguna
   conducta queda por debajo del **40 % a la vista en 9:16**, se le enseñan los
   números al usuario con una propuesta **antes de tocarla**. La propuesta sería
   que sus márgenes salgan de `viewAspect` y que la duración del cruce se ajuste
   para conservar la velocidad de la especie (un ave a un tercio de su velocidad
   parecería suspendida). Esas conductas ya están aprobadas, y el PLAN dice
   «revisar».

### 8.3 Lo que no cambia

Ningún animal desaparece a la vista, ningún acto empieza ya a la vista, nada
nace en un viaje y nada visible queda a menos de 7 u. `check:path` lo sigue
comprobando en los cuatro aspectos y en la simulación de 16:9 y 9:16.

### 8.4 Caso límite aceptado

Cada acto fija sus aspectos al nacer. Si alguien gira el móvil a mitad de un
acto, el cuadro se ensancha de golpe y un animal podría verse en el margen por
donde iba a entrar. Recalcular el acto al girar lo teletransportaría, que es
peor. Al girar cambia el cuadro entero. Se anota en las trampas de `CLAUDE.md`.

## 9. Verificación

**`bun run check:path`** suma:

- `stationFromPathname`: cada ruta de `JOURNEY` (con y sin barra final) da su
  estación; `/diagnostico` da `null`.
- `railProgress`: `s` vale exactamente `i` en la profundidad de cada estación, es
  monótona y continua, y está acotada a [0, 6] fuera del camino.
- Los íconos: todos los paths son finitos (sin `NaN`) y caben en el viewBox; dos
  llamadas producen la misma cadena; cada ícono pesa ≤ 4 KB y Japón ≤ 6 KB.
- Los textos: `stations.<slug>.name` y las cadenas de `nav` existen en los dos
  idiomas.
- La fauna: el informe por conducta (§8.2), el milano ≥ 50 % en los cuatro
  aspectos, y todo lo que ya comprobaba.

**`bun run typecheck`** y **`bun run build`** sin errores. En el HTML exportado
de cada estación, el enlace correcto lleva `aria-current="page"` y el `<title>`
es el de la estación.

**En el navegador** (escritorio y 390×844):

- Riel: el despliegue al acercarse al borde y con Tab; la marca recorriendo el
  riel en un salto de 京都 a 京料理; los destellos; el asentamiento.
- Abanico: abrir y cerrar por las cinco vías, incluida «atrás», comprobando que
  el historial queda como tras una navegación normal y que la cámara no se mueve
  al cerrar.
- Cambio de idioma: aterriza en la misma estación y el contexto WebGL viejo se
  libera (un solo `<canvas>` vivo).
- Con 静 y con `prefers-reduced-motion`: fundidos, sin spring, y la marca salta
  con la cámara.
- Sin WebGL (canvas bloqueado): la navegación funciona y la marca está en la
  estación de la URL.
- Consola limpia, sin errores de hidratación.

## 10. Mapa de archivos

**Nuevos**

- `src/components/nav/JourneyNav.tsx`
- `src/components/nav/RadialSidebar.tsx`
- `src/components/nav/MobileNav.tsx`
- `src/components/nav/StationIcon.tsx`
- `src/components/nav/LanguageToggle.tsx`
- `src/components/nav/railProgress.ts`
- `src/components/nav/useRailProgress.ts`
- `src/components/nav/icons/{types,mapa,sakura,torii,pagoda,farol,naruto,stone,index}.ts`
- `src/components/nav/icons/japan.generated.ts` (generado, versionado)
- `src/lib/petalOutlines.ts`
- `scripts/build-geo.ts` y el script `geo` en `package.json`
- `assets/geo/LICENSES.md` (`assets/geo/source/` sin versionar, en `.gitignore`)

**Modificados**

- `src/app/[locale]/layout.tsx`: monta `JourneyNav` y la plantilla de título.
- `src/app/[locale]/page.tsx` y `src/components/sections/StationShell.tsx`: sin
  `StationLinks`, con `tabIndex={-1}` en `<main>`.
- Las páginas de estación (`ubicacion`, `eventos`, `gastronomia`,
  `lugares/[slug]`): `generateMetadata`.
- `src/components/ui/AmbientControls.tsx`: tercer botón y variantes.
- `src/config/journey.ts`: `stationFromPathname`.
- `src/scene/path/journeyPath.ts`: `PATH.live`.
- `src/scene/camera/CameraRig.tsx`: escribe `PATH.live`.
- `src/scene/objects/PetalGeometry.ts`: importa los contornos de `lib/`.
- `src/scene/systems/fauna/{behaviors,casting}.ts`: `viewAspect` y el ajuste del
  milano.
- `src/styles/globals.css`: el riel, la barra, el abanico, el margen inferior en
  móvil y `right: max(6vw, 4.5rem)`.
- `src/messages/{es,en}.json`: solo si falta alguna cadena (`nav.*` ya existe).
- `scripts/check-path.ts` y `scripts/check-fauna.ts`.

**Borrados**

- `src/components/nav/StationLinks.tsx`

**Documentación**

- `CLAUDE.md`: el árbol de `components/nav/`, el comando `bun run geo`, la trampa
  del giro a mitad de acto (§8.4) y la fase en el estado.
- `docs/PLAN.md`: §5.4 con lo construido, la 3C en el plan de fases y el
  pendiente «Fauna en vertical» de §11 cerrado o actualizado con los números.

## 11. Fuera de alcance (3C)

- El hero de la Home, el torii 3D y cualquier contenido nuevo de las páginas.
- Traducir los slugs (`/en/location`): sigue decidido para la Fase 9.
- El giroscopio en iOS y su interruptor (§11 del PLAN).
- Los créditos visibles de los modelos (Fase 9).
- El mapa extruido de Ubicación (Fase 5). Los polígonos de Japón quedan
  disponibles, pero no se construye nada para él.
- Cambiar las conductas de fauna, salvo el milano, sin pasar antes por §8.2,
  paso 3.

## 12. Riesgos y a calibrar en la revisión

| Tema | Qué vigilar |
|---|---|
| «Atrás» cierra el abanico | Que `pushState` con la misma URL no dispare `MotionEngine`, ScrollTrigger ni la restauración de scroll. Si interfiere, se quita (§6.4) |
| Cambio de idioma | Que el remontaje de la escena libere el contexto viejo antes de crear el nuevo: un solo `<canvas>` |
| Suelo del milano | Si con `ajuste ≥ 0,5` no llega al 50 % en 9:16, se enseñan los números y se calibra con el usuario: bajar el suelo, alejarlo o aceptar menos |
| Tamaños y tiempos | 96 px de zona de despliegue, 350 ms de espera al plegar, 56 px por círculo, 40 px de curvatura: son de partida y se ajustan al verlos |
| Contraste | Las piedras `sumi-faint` en contorno sobre washi tienen que leerse; si no, se oscurecen |
