# Fase 5B — El tramo hacia Eventos: plan de implementación

> **Para quien ejecute:** se implementa en esta misma sesión, tarea a tarea
> (superpowers:executing-plans). Los pasos van con casillas (`- [ ]`).
> **Commits:** sólo el spec y este plan; los commits de código los decide el
> usuario (memoria del proyecto). Ningún paso de código termina en commit.

**Objetivo:** convertir el tramo Ubicación → Eventos en un valle con tres
kōsatsu (dos con mapas antiguos que se desenrollan), una roca pintada, susuki,
faroles mezclados y los primeros cerezos, con el texto DOM encajado sobre las
tablas.

**Arquitectura:** todo sale de `journey.ts`. Las tarjetas con `sign` generan
sus kōsatsu en `placement.ts` (delante de su parada, `cardStopD`); la roca, el
cerezo y la susuki son decoración declarada. La escena proyecta la zona de
escritura de cada kōsatsu en `KOSATSU` (objeto de módulo, un escritor) y un
callback de `gsap.ticker` encaja allí el DOM de la tarjeta; el tramo escribe en
`KOSATSU` cuánto está desenrollado cada mapa (`tramoUnroll`). Los mapas son SVG
generados por `bun run maps` (Natural Earth + datos de Heian-kyō + trazos de
KanjiVG) y rasterizados a WebP con sharp.

**Stack:** Next 16 · R3F 9.7 · three 0.185.1 · GSAP 3.15 · bun · sharp ·
topojson · KanjiVG.

**Spec:** `docs/superpowers/specs/2026-10-15-fase-5b-el-tramo-design.md`
(con la §15, «Correcciones al planificar»).

## Restricciones globales

- Runtime y gestor: **bun** (`bun`, `bunx`); nunca npm/npx.
- Idioma: comentarios y documentación en español; identificadores en inglés;
  commits en inglés.
- Regla 1: todo por código. Ningún SVG a mano: los mapas los genera un script.
- Regla 2: la cámara nunca entra (≥ 1,5 u de todo, también viajando).
- Regla 4: `journey.ts` es la fuente única: los kōsatsu se derivan de las
  tarjetas, no se declaran aparte.
- Regla 5: el texto es DOM real; el canvas, `aria-hidden`.
- Todo GLSL nuevo se compila en un WebGL2 real (`gl.compileShader` +
  `getShaderInfoLog`) y se mira la consola por «Shader Error». Sin backticks
  dentro de los shaders.
- Un `ShaderMaterial` propio necesita niebla y `colorspace_fragment`: por eso
  todo lo nuevo es `MeshStandardMaterial` + `onBeforeCompile`.
- Con `frameloop="demand"` (movimiento reducido) lo que cambia pide su frame
  con `invalidate()`.
- Un dato pesado no va al primer JS: los objetos nuevos se montan desde
  `StationDecor` y las texturas se cargan en diferido.
- `check:path` verde al terminar (el check «reparto más caro de la garza
  ≤ 8 ms» es ruidoso en esta máquina: repetir antes de culpar al cambio).
- Textos ≤ 60 palabras por tarjeta, en `es` y `en`.

## Foco de revisión

1. **Pantallas de 16:10 y bajas** (1440×900, 1366×657): la tabla tiene que
   caber en su mitad de la pantalla y la letra leerse; si no, la tarjeta de
   papel de siempre. Lo fija la comprobación de encaje de la Tarea 3.
2. **Ir hacia atrás por el tramo** (scroll hacia arriba): el rollo vuelve a
   subir y el texto se va, sin saltos. Lo fija la monotonía de `tramoUnroll`
   (Tarea 1) y la revisión por CDP (Tarea 9).
3. **Sin WebGL / `PATH.live` falso / 静**: el texto vuelve a la tarjeta de
   papel o a la lista, nunca queda invisible ni flotando en la nada. Lo fija la
   Tarea 3 (CSS por `data-board`) y la captura con 静.
4. **Girar el móvil a mitad de una parada**: el kōsatsu se recoloca con la
   decoración (clave por aspecto en `StationDecor`) y el texto pasa a la
   tarjeta. Lo fija la Tarea 3.
5. **La fauna del valle**: con kōsatsu de ~8 u de ancho, susuki y cerezos, la
   libélula y la garza siguen saliendo en Ubicación. Lo fija la Tarea 8.

---

### Tarea 1: Los datos — tarjetas con cartel, paradas, desenrollado y textos

**Archivos:**
- Modificar: `src/config/journey.ts` (tipos `TramoCard.sign`, `OldMap`; el
  tramo de Ubicación)
- Modificar: `src/animation/journeyScroll.ts` (`cardStopD`, `tramoUnroll`)
- Modificar: `src/messages/es.json`, `src/messages/en.json`
- Modificar: `src/components/sections/PathTramo.tsx` (deja de usar
  `mapPlaceholder`)
- Modificar: `scripts/check-path.ts` (comprobaciones)

**Interfaces:**
- Produce:
  - `type OldMap = 'japon' | 'heian'` y `TramoCard.sign?: { readonly map?: OldMap }`.
  - `cardStopD(station: StationSlug, index: number): number` — la d **absoluta**
    del punto de interés de la cámara en la mitad de la parada `index`.
  - `tramoUnroll(progress: number, cards: number, index: number, walkVh?: number): number` — 0–1.
  - Mensajes `tramos.ubicacion.{capital,heian,kyoto}.{title,body}` y
    `tramo.maps.{japon,heian}` (el `alt`).

- [ ] **Paso 1: los tipos y el tramo en `journey.ts`.**

```ts
/** Los mapas antiguos del tramo de Ubicación (Fase 5B): `bun run maps`. */
export type OldMap = 'japon' | 'heian';

export interface TramoCard {
  readonly id: string;
  /** A qué lado del camino aparece. En móvil, siempre centrada. */
  readonly side: Side;
  /** `mapa` lleva un mapa antiguo (`sign.map`); `texto` es sólo lectura. */
  readonly kind: 'texto' | 'mapa';
  /**
   * Va escrita en un kōsatsu plantado delante de su parada (Fase 5B): el
   * tablón se deriva de aquí (`placement.ts`), no se declara en `decor`.
   */
  readonly sign?: { readonly map?: OldMap };
}

const TRAMO_UBICACION: StationTramo = {
  cards: [
    { id: 'capital', side: 'izquierda', kind: 'mapa', sign: { map: 'japon' } },
    { id: 'heian', side: 'derecha', kind: 'mapa', sign: { map: 'heian' } },
    { id: 'kyoto', side: 'izquierda', kind: 'texto', sign: {} },
  ],
};
```

- [ ] **Paso 2: las comprobaciones (fallan).** En `scripts/check-path.ts`,
  sección «El tramo y sus carteles»:

```ts
section('El tramo y sus carteles');
const UBI_SLUG = 'ubicacion' as const;
const ubiCards = getStation(UBI_SLUG).tramo.cards;
const stops = ubiCards.map((_, i) => cardStopD(UBI_SLUG, i));
const ubiD = stationDepth(UBI_SLUG);
check('las paradas de Ubicación caen a ~35, ~66 y ~97 u de la estación',
  [34.8, 66.0, 97.2].every((want, i) => Math.abs(stops[i]! - ubiD - want) < 1),
  stops.map((d) => (d - ubiD).toFixed(1)).join(' · '));
check('cada parada es la profundidad del scroll en mitad de su lectura', ubiCards.every((_, i) => {
  const walkVh = tramoWalkVh(UBI_SLUG);
  const height = tramoHeightVh(ubiCards.length, walkVh);
  const walk = walkVh / (ubiCards.length + 1);
  const mid = ((i + 1) * walk + i * TRAMO_STOP_VH + TRAMO_STOP_VH / 2) / height;
  const d = scrollTargetDepth(UBI_SLUG, { station: UBI_SLUG, content: 1, tramo: tramoFraction(mid, ubiCards.length, walkVh) });
  return Math.abs(d - stops[i]!) < 0.05;
}));
for (let i = 0; i < ubiCards.length; i += 1) {
  const n = ubiCards.length;
  const walkVh = tramoWalkVh(UBI_SLUG);
  const samples = range(0, 1, 0.001).map((p) => tramoUnroll(p, n, i, walkVh));
  const peak = samples.indexOf(Math.max(...samples));
  const up = samples.slice(0, peak + 1).every((v, k, a) => k === 0 || v >= a[k - 1]! - 1e-9);
  const down = samples.slice(peak).every((v, k, a) => k === 0 || v <= a[k - 1]! + 1e-9);
  const jumps = samples.every((v, k, a) => k === 0 || Math.abs(v - a[k - 1]!) < 0.05);
  check(`tarjeta ${i}: el rollo sube y baja sin saltos`, up && down && jumps && samples[0] === 0 && Math.max(...samples) === 1);
  check(`tarjeta ${i}: el rollo está abajo antes de que el texto se lea`, range(0, 1, 0.001)
    .every((p) => tramoCardOpacity(p, n, i, walkVh) < 0.5 || tramoUnroll(p, n, i, walkVh) > 0.95));
}
for (const [lang, messages] of [['es', messagesEs], ['en', messagesEn]] as const) {
  for (const card of ubiCards) {
    const text = messages.tramos.ubicacion[card.id as 'capital'];
    const words = text?.body.split(/\s+/).length ?? 0;
    check(`${lang} · ${card.id}: título y texto, ≤ 60 palabras`, Boolean(text?.title) && words > 0 && words <= 60, `${words}`);
    if (card.sign?.map) check(`${lang} · el alt del mapa ${card.sign.map}`, Boolean(messages.tramo.maps[card.sign.map]));
  }
}
```

  (Importar lo que falte: `getStation`, `stationDepth`, `cardStopD`,
  `tramoUnroll`, `tramoWalkVh`, `tramoHeightVh`, `TRAMO_STOP_VH`,
  `tramoFraction`, `tramoCardOpacity`, `scrollTargetDepth`, los JSON.)
  Ejecutar `bun run scripts/check-path.ts` → falla (no existen).

- [ ] **Paso 3: `cardStopD` y `tramoUnroll` en `journeyScroll.ts`.**

```ts
/** Cuánto antes de su parada empieza a bajar el rollo, y cuánto antes termina, en vh. */
const UNROLL_FROM_VH = 60;
const UNROLL_TO_VH = 10;

/**
 * La d absoluta del punto de interés de la cámara en mitad de la parada
 * `index` del tramo que sale de `station`. Los kōsatsu se plantan respecto
 * de ella (`placement.ts`).
 */
export function cardStopD(station: StationSlug, index: number): number {
  const i = stationIndex(station);
  const here = STATION_DEPTHS[i]!;
  const next = STATION_DEPTHS[i + 1];
  if (next === undefined) return here;
  const { distance } = tramoLayout(cardCount(station), tramoWalkVh(station));
  const fraction = (index + 1) * distance + index * STOP_DRIFT + STOP_DRIFT / 2;
  const reading = here + READING_DRIFT;
  return reading + (next - reading) * fraction;
}

/**
 * Cuánto está desenrollado el mapa de la tarjeta `index` (0–1): baja antes de
 * que el texto aparezca, se queda abajo mientras se lee y vuelve a subir al
 * irse. Continua y monótona a cada lado de la parada.
 */
export function tramoUnroll(progress: number, cards: number, index: number, walkVh = TRAMO_WALK_VH): number {
  const { count, walk, height } = tramoLayout(cards, walkVh);
  if (index < 0 || index >= count) return 0;
  const x = unit(progress) * height;
  const start = (index + 1) * walk + index * TRAMO_STOP_VH;
  const end = start + TRAMO_STOP_VH;
  const down = smoothstep(start - UNROLL_FROM_VH, start - UNROLL_TO_VH, x);
  const up = 1 - smoothstep(end + UNROLL_TO_VH, end + UNROLL_FROM_VH, x);
  return Math.min(down, up);
}
```

  `cardCount(station)` es `getStation(station).tramo.cards.length` (importar
  `getStation` de `journey.ts`; no hay ciclo: `journeyScroll` ya importa de
  `journey`). Comprobar que `smoothstep` devuelve exactamente 0 y 1 en los
  extremos (lo hace la de `lib/procedural`).

- [ ] **Paso 4: los textos.** En `es.json` y `en.json`, `tramos.ubicacion`
  pasa a `capital` / `heian` / `kyoto` con los textos del spec §8, y
  `tramo.mapPlaceholder` se cambia por:

```json
"maps": {
  "japon": "Mapa de Japón al estilo de Edo, con Kyoto marcado con un sello rojo.",
  "heian": "Plano de Heian-kyō en 794: la cuadrícula de avenidas, el palacio al norte, la avenida Suzaku y la puerta de Rashōmon al sur, entre los ríos Kamo y Katsura."
}
```

  (`en`: «Edo-style map of Japan, with Kyoto marked by a red seal.» / «Plan
  of Heian-kyō in 794: the grid of avenues, the palace to the north, Suzaku
  Avenue and the Rashōmon gate to the south, between the Kamo and Katsura
  rivers.»). En `PathTramo.tsx`, el hueco del mapa se queda vacío hasta la
  Tarea 3 (quitar el `<span>` con `mapPlaceholder`).

- [ ] **Paso 5:** `bun run check:path` y `bun run typecheck` → verdes.

---

### Tarea 2: El kōsatsu — medidas, colocación, huellas y objeto 3D

**Archivos:**
- Crear: `src/scene/objects/kosatsu/kosatsu.ts` (medidas puras, `KOSATSU`)
- Crear: `src/scene/objects/kosatsu/kosatsuGeometry.ts`
- Crear: `src/scene/objects/kosatsu/Kosatsu.tsx`
- Modificar: `src/scene/decor/placement.ts`, `footprints.ts`, `contact.ts`,
  `moss.ts`, `StationDecor.tsx`
- Modificar: `scripts/check-decor.ts`

**Interfaces:**
- Consume: `cardStopD`, `TramoCard.sign` (Tarea 1).
- Produce:
  - `KOSATSU_SIZE` — medidas (ver abajo).
  - `KosatsuItem = { kind: 'kosatsu'; card: number; side: Side; map?: OldMap }`,
    y `DecorObject = Exclude<DecorItem, DecorGrove> | KosatsuItem`.
  - `kosatsuWriting(o: PlacedObject): { center: [number, number, number]; right: [number, number, number]; up: [number, number, number]; w: number; h: number }`
    — la zona de escritura en el mundo (centro y semiejes), para la escena y
    las comprobaciones.
  - `KOSATSU` — objeto de módulo:
    `{ rects: { x: number; y: number; w: number; h: number; on: boolean }[]; unroll: number[]; wake: () => void }`,
    indexado por tarjeta. Escribe `rects` la escena; `unroll`, el tramo.

- [ ] **Paso 1: las medidas (`kosatsu.ts`).** Origen: el centro de la base,
  en el suelo; la tabla en el plano XY, mirando a +z; x hacia el camino es
  `-side` (se resuelve en la colocación con el giro).

```ts
export const KOSATSU_SIZE = {
  /** La tabla: ancho total y alto, y a qué altura empieza. */
  boardWidth: 7.9,
  boardHeight: 3.95,
  boardBottom: 0.6,
  boardDepth: 0.14,
  /** Marco de listón alrededor de la tabla. */
  frame: 0.12,
  /** Los postes, en los extremos de la tabla. */
  postSize: 0.24,
  postInset: 0.35,
  /** El tejadillo: vuelo a cada lado y por delante, y su alto. */
  roofOverhang: 0.35,
  roofDepth: 0.95,
  roofRise: 0.55,
  /** El kakejiku, del lado de fuera: ancho y margen. */
  scrollWidth: 2.1,
  margin: 0.25,
  /** Distancia en profundidad de la cámara de su parada a la tabla, y u de su canto interior. */
  depthFromCamera: 20,
  innerU: 2.0,
} as const;

/** Alto total, del suelo a la cumbrera. */
export const KOSATSU_HEIGHT =
  KOSATSU_SIZE.boardBottom + KOSATSU_SIZE.boardHeight + KOSATSU_SIZE.roofRise + 0.15;
```

  La zona de escritura ocupa del canto interior + `margin` hasta el kakejiku
  (o toda la tabla sin `map`), con `boardHeight − 2·margin` de alto.

- [ ] **Paso 2: comprobaciones (fallan).** En `check-decor.ts`, sección
  «Los kōsatsu»: hay tres en Ubicación (horizontal y vertical); cada uno en su
  lado; su centro a `cardStopD − 22 + depthFromCamera ± 0,5`; el canto
  interior a |u| ≥ 1,9; la tabla mira a la cámara de su parada (ángulo entre
  su normal y la dirección a la cámara < 3°); `KOSATSU_HEIGHT ≤ 8,5`; sus
  postes cierran el paso a la fauna; y las comprobaciones generales («ninguna
  huella pisa una piedra», «la cámara pasa a ≥ 1,5 u», ya existentes) siguen
  verdes con ellos dentro. Para la cámara de la parada: `snapRig(rig, cardStopD(...))`.

- [ ] **Paso 3: la colocación (`placement.ts`).** En `stationDecorLayout`,
  después del bucle de `decor`, por cada tarjeta con `sign` del tramo de la
  estación:

```ts
station.tramo.cards.forEach((card, index) => {
  if (!card.sign) return;
  const stop = cardStopD(station.slug, index);
  const rig = createRig();
  snapRig(rig, stop);
  const cameraD = -rig.camera.z;
  const sign = card.side === 'izquierda' ? -1 : 1;
  const half = KOSATSU_SIZE.boardWidth / 2;
  const d = cameraD + KOSATSU_SIZE.depthFromCamera;
  const x = pathX(d) + sign * (KOSATSU_SIZE.innerU + half);
  const z = -d;
  // De frente a la cámara de su parada: su normal (+z local) apunta a ella.
  const yaw = Math.atan2(rig.camera.x - x, rig.camera.z - z);
  objects.push({ item: { kind: 'kosatsu', card: index, side: card.side, map: card.sign.map }, x, y: groundY(x, z), z, yaw, scale: 1 });
});
```

  `placement.ts` importa `cardStopD` (`animation/journeyScroll`) y
  `createRig`/`snapRig` (`camera/pathRig`), que son puros. En vertical se
  usa la misma colocación (el kōsatsu es escenario; el texto va a la tarjeta).

- [ ] **Paso 4: huellas, musgo y sombras.** En `footprints.ts`,
  `objectBases` para `kosatsu`: dos círculos, uno por poste
  (`r = postSize`, `foot = postSize`, `top = KOSATSU_HEIGHT`, sólido); y en
  `decorFootprints` un `RectFootprint` de la planta del tejadillo
  (`hx = boardWidth/2 + roofOverhang`, `hz = roofDepth/2`) con
  `faunaMargin: SOLID_MARGIN` (la tabla baja hasta 0,6: lo que anda no pasa
  por debajo). En `contact.ts` y `moss.ts`, entradas `kosatsu` en `SPREAD`,
  `STRENGTH` y `PER_BASE` (como el farol: 1,9 / 0,85 / el del farol).

- [ ] **Paso 5: la geometría (`kosatsuGeometry.ts`).** Cajas fusionadas
  (`BoxGeometry` + `mergeGeometries`), en tres partes con su material:
  `wood` (postes, marco, varas del rollo), `board` (la tabla: un plano con
  `uv` 0–1 para la madera en el shader) y `roof` (dos faldones inclinados
  `roofRise` y una cumbrera). La parte del papel del rollo **no** va aquí
  (Tarea 4). Sin triángulos de área cero; `computeVertexNormals` sobre cada
  caja antes de fusionar.

- [ ] **Paso 6: el componente (`Kosatsu.tsx`).** Como `Torii.tsx`: un
  `<group>` en `placed`, con tres `<mesh>` y materiales
  `createDecorMaterial` (`wood`: `palette.sumiSoft`, rugosidad 0,85;
  `board`: madera pálida `palette.ishi` con vetas en el shader —un
  `onBeforeCompile` encadenado como `withMoss` en `StoneLanterns`, vetas en
  `uv.y` con ruido—; `roof`: `palette.sumi`). En `useFrame`, proyecta las
  cuatro esquinas de la zona de escritura con la cámara real y escribe
  `KOSATSU.rects[card]` en px de la ventana (`on` falso si alguna esquina está
  detrás de la cámara). Al desmontar, `on = false`. `KOSATSU.wake = invalidate`.
  `StationDecor` lo monta para `kind === 'kosatsu'`.

- [ ] **Paso 7: compilar el shader de la tabla en WebGL2** (script de CDP
  con `gl.compileShader`) y mirar «Shader Error» en la consola de
  `/es/ubicacion`.

- [ ] **Paso 8:** `bun run check:path`, `bun run typecheck` → verdes.

---

### Tarea 3: El texto sobre la tabla

**Archivos:**
- Crear: `src/components/sections/useKosatsuFit.ts`
- Modificar: `src/components/sections/PathTramo.tsx`
- Modificar: `src/styles/globals.css`
- Modificar: `scripts/check-decor.ts` (la comprobación de encaje)

**Interfaces:**
- Consume: `KOSATSU.rects` (Tarea 2), `kosatsuWriting` (Tarea 2).
- Produce: `useKosatsuFit(section: RefObject<HTMLElement | null>, enabled: boolean): void`;
  atributos `data-sign` y `data-board="on" | "off"` en cada tarjeta.

- [ ] **Paso 1: la comprobación de encaje (falla).** En `check-decor.ts`,
  con la cámara de cada parada (`PerspectiveCamera(34, aspect)` en
  `rig.camera` mirando a `rig.focus`, como `homeCamera`), proyectar la zona de
  escritura y medir, para el bloque DOM de `BLOCK_REM = 22` rem de ancho
  (352 px a 16 px/rem):

```ts
const scale = projectedWidthPx / 352;
const bodyPx = 17.6 * scale; // 1.1rem
```

  y exigir: **1600×900**: `bodyPx ≥ 16` y la tabla entera dentro de su mitad
  de la pantalla (canto exterior ≥ 1 % del borde, interior ≤ 48 % / ≥ 52 %);
  **1440×900**: la tabla dentro de su mitad; **1366×657**: lo que dé
  (se informa) — si `bodyPx < 14` el tramo usa la tarjeta (Paso 3), así que
  la comprobación es que la regla de caída esté escrita, no un umbral.

- [ ] **Paso 2: `useKosatsuFit`.** Un callback de `gsap.ticker` que, por cada
  tarjeta con `data-sign`, lee `KOSATSU.rects[i]` y decide:

```ts
const MIN_BODY_PX = 14;
const usable = PATH.live && rect.on && !portrait
  && rect.w / BLOCK_PX * BODY_PX >= MIN_BODY_PX
  && rect.x >= 0 && rect.x + rect.w <= innerWidth;
node.dataset.board = usable ? 'on' : 'off';
if (usable) node.style.transform =
  `translate3d(${rect.x}px, ${rect.y}px, 0) scale(${rect.w / BLOCK_PX})`;
else node.style.removeProperty('transform');
```

  `portrait` = `innerHeight >= innerWidth` o `NAV_MOBILE_QUERY`. El bloque
  tiene `transform-origin: 0 0`. Escribe sólo si cambia (como
  `PrefectureLabels`). Sin `enabled` (静 / movimiento reducido), no hace nada
  y quita `data-board`.

- [ ] **Paso 3: el CSS.** En `globals.css`:

```css
/* Sobre la tabla del kōsatsu (Fase 5B): sin papel, tinta sobre la madera. */
.tramo-card[data-board='on'] {
  top: 0;
  left: 0;
  right: auto;
  width: 22rem;
  padding: 0;
  background: none;
  backdrop-filter: none;
  box-shadow: none;
  transform-origin: 0 0;
  translate: none;
  color: var(--color-sumi);
}
.tramo-card[data-board='on'] .tramo-card__body { font-size: 1.1rem; line-height: 1.55; }
.tramo-card[data-board='on'] .tramo-card__map { display: none; }
```

  Con `data-board='off'` (o sin él) la tarjeta es la de papel de siempre, con
  el mapa en un `<img>` (Tarea 4) en el hueco `.tramo-card__map`, que deja de
  ser un recuadro punteado. La lista de 静 no cambia de forma.

- [ ] **Paso 4: `PathTramo`.** `data-sign` en las tarjetas con `card.sign`;
  llamar a `useKosatsuFit(section, motionAllowed)`.

- [ ] **Paso 5: CDP** — a 1600×900, scroll hasta cada parada: el bloque cae
  dentro de la zona de escritura (bbox del DOM vs `KOSATSU.rects`, ±4 px) y su
  alto entra en la tabla (`height·scale ≤ rect.h`); a 900×1600 la tarjeta es
  la de papel; con `PATH.live` falso (sin WebGL), también.

- [ ] **Paso 6:** `check:path`, `typecheck`, `build` → verdes.

---

### Tarea 4: Los mapas antiguos y el rollo que baja

**Archivos:**
- Crear: `scripts/build-maps.ts`, `scripts/maps/heian.ts` (el dato), `scripts/maps/kanji.ts` (trazos KanjiVG → paths)
- Crear (generados): `public/maps/{japon,heian}.{svg,webp}`
- Crear: `src/scene/objects/kosatsu/scrollMaterial.ts`
- Modificar: `src/scene/objects/kosatsu/Kosatsu.tsx`, `kosatsuGeometry.ts`
- Modificar: `src/animation/useJourneyScroll.ts` (escribe `KOSATSU.unroll`)
- Modificar: `src/components/sections/PathTramo.tsx` (el `<img>`)
- Modificar: `package.json` (`"maps": "bun run scripts/build-maps.ts"`),
  `assets/kanji/LICENSES.md`

**Interfaces:**
- Consume: `KOSATSU.unroll` (Tarea 2), `tramoUnroll` (Tarea 1),
  `prefectures.generated.ts` y `regions.ts` (5A), `waves.ts` (5A).
- Produce: `/maps/japon.svg|webp`, `/maps/heian.svg|webp`;
  `MAP_ASPECT: Record<OldMap, number>` (alto/ancho) exportado desde
  `kosatsu.ts`, que comparten el script y la geometría.

- [ ] **Paso 1: trazos de KanjiVG a paths.** `scripts/maps/kanji.ts`:
  `kanjiPaths(char: string): Promise<string[]>` — lee
  `assets/kanji/source/<hex>.svg` (lo descarga si falta, con la misma URL de
  `build-kanji.ts`) y devuelve los `d` de sus trazos (viewBox 109×109).
  `drawKanji(text, x, y, size, color, width)` devuelve un `<g>` con los
  trazos escalados, `stroke-linecap: round`. Si KanjiVG no tiene 國 o 圖, se
  usan 国 / 図 (log).

- [ ] **Paso 2: Japón (`build-maps.ts`).** Proyección: la de la maqueta
  (`PREFECTURES` ya trae los anillos en coordenadas de la bandeja). SVG de
  1000 × 1000·`MAP_ASPECT.japon`, fondo transparente:
  1. Cada prefectura, relleno del tono de su región (`REGION_TONE`), borde
     sumi de 1,2 px.
  2. La costa (contorno de la unión, `base` de `PREFECTURES`) en sumi de 4 px.
  3. Las olas de `waveStrokes('japon')` como trazos índigo de 2 px.
  4. Kyoto: círculo shu de 18 px en `KYOTO_CITY` y 京 en sumi al lado.
  5. El cartucho 大日本國圖 en un rectángulo de washi con borde sumi, arriba a
     la derecha.

- [ ] **Paso 3: Heian-kyō (`scripts/maps/heian.ts` + `build-maps.ts`).** El
  dato, en metros con el origen en la esquina noroeste del recinto:

```ts
export const HEIAN = {
  width: 4500, // este–oeste
  height: 5200, // norte–sur
  /** Las grandes avenidas este–oeste, de norte a sur: 一条 … 九条. */
  jo: [0, 600, 1200, 1800, 2400, 3000, 3600, 4200, 5200],
  /** Las avenidas norte–sur, de oeste a este; la del centro es Suzaku. */
  bo: [0, 560, 1120, 1690, 2250, 2810, 3380, 3940, 4500],
  suzaku: { x: 2250, width: 85 },
  palace: { x0: 1690, x1: 2810, y0: 0, y1: 1380 }, // 大内裏: entre Ichijō y Nijō
  rashomon: { x: 2250, y: 5200 },
  toji: { x: 2810, y: 4800 }, saiji: { x: 1690, y: 4800 },
  kamo: [[4800, -300], [4700, 1500], [4750, 3200], [4600, 5600]],
  katsura: [[-400, -300], [-350, 2000], [-150, 4000], [300, 5600]],
} as const;
```

  SVG: papel transparente; manzanas como cuadrícula fina (las calles menores,
  4 por bō), avenidas jō/bō en sumi de 2 px, Suzaku de 6 px, el palacio en
  `REGION_TONE` de Kinki con borde, 羅城門 / 東寺 / 西寺 marcados, ríos en
  índigo con trazo ondulado, 一条…九条 en el margen izquierdo, 左京 / 右京
  (左京 al **este**: la izquierda vista desde el palacio), cartucho 平安京圖.

- [ ] **Paso 4: rasterizar.** `sharp(Buffer.from(svg)).resize(1024).webp({ quality: 88 })`.
  `bun run maps` → cuatro archivos. Abrir los WebP con Read para revisarlos.

- [ ] **Paso 5: el rollo (`scrollMaterial.ts` + geometría).** El papel es un
  plano de `scrollWidth × mapHeight` con la parte de arriba en la vara alta.
  Uniforms `uUnroll` (0–1) y `uMap` (la textura). Vértice: los vértices por
  debajo de `uUnroll` se suben a la línea de corte (el papel enrollado no
  cuelga). Fragmento: `discard` por debajo del corte (después de las
  derivadas, si las hay), el mapa encima de un washi envejecido (bordes
  amarillentos con ruido, grano). La vara de abajo es una malla aparte cuya
  `position.y` se pone en `useFrame` con el mismo `uUnroll`.
  `MeshStandardMaterial` con `map` + `onBeforeCompile`; textura con
  `TextureLoader` en diferido (`colorSpace = SRGBColorSpace`).

- [ ] **Paso 6: escribir el desenrollado.** En `useJourneyScroll`,
  `onUpdate` del tramo: `KOSATSU.unroll[i] = tramoUnroll(progress, cards, i, walkVh)`
  y `KOSATSU.wake()`; sin `enabled`, `KOSATSU.unroll.fill(1)`. En
  `Kosatsu.tsx`, sin tramo propio (la cámara en otra estación) vale el último
  valor; al montar, 0 si hay movimiento y 1 si no.

- [ ] **Paso 7: el `<img>`.** En `PathTramo`, dentro de `.tramo-card__map`:
  `<img src={`/maps/${card.sign.map}.svg`} alt={t(`maps.${map}`)} width height loading="lazy" />`
  (las rutas estáticas de `public` no llevan idioma).

- [ ] **Paso 8:** compilar el shader del rollo en WebGL2; CDP: a mitad de la
  subida a la parada 1, el rollo está a medio bajar; en la parada, entero;
  al volver hacia atrás, sube. `check:path`, `typecheck`, `build`.

---

### Tarea 5: La roca pintada

**Archivos:**
- Crear: `src/scene/objects/roca/roca.ts`, `rocaGeometry.ts`, `rocaMaterial.ts`, `Roca.tsx`
- Modificar: `src/config/journey.ts` (`DecorRoca`, la roca en `DECOR_UBICACION`)
- Modificar: `placement.ts` (sin volteo), `footprints.ts`, `contact.ts`, `moss.ts`, `StationDecor.tsx`
- Modificar: `scripts/check-decor.ts`

**Interfaces:**
- Produce: `DecorRoca { kind: 'roca' } & DecorObjectBase`; `ROCA_SIZE = { width: 3.8, height: 2.8, depth: 1.1 }`;
  `rocaGeometry(seed: number): BufferGeometry` con atributo `aFace` (coordenadas
  planas de la cara delantera, −1…1, y la cara: `w = 1` en la delantera).

- [ ] **Paso 1: comprobaciones (fallan).** «La roca pintada»: hay una en
  Ubicación; mide `ROCA_SIZE` (caja de la geometría ±5 %); desde la cámara de
  Ubicación (16:9) está a 45–60 u, en cuadro, y su caja proyectada no toca la
  zona del título (x 55–93 %, y 12–70 %) ni la bandeja de la maqueta; desde la
  cámara de la primera parada no tapa la tabla del kōsatsu 1 (rectángulos
  proyectados disjuntos); normales finitas y no nulas.

- [ ] **Paso 2: la geometría.** Una `BoxGeometry(1, 1, 1, 24, 18, 8)`
  redondeada (cada vértice hacia su superelipsoide, exponente 3) a
  `ROCA_SIZE`, con ruido 3D (el de `stoneGeometry`) de amplitud 0,08 en la
  cara delantera y 0,18 en el resto, base plana enterrada 0,1. `aFace`: x, y
  normalizados de la cara delantera y `w = smoothstep` de la normal hacia +z.

- [ ] **Paso 3: el material (`rocaMaterial.ts`).** `createDecorMaterial`
  (`palette.ishiDeep`) + `onBeforeCompile` encadenado. Fragmento, sobre `aFace`:

```glsl
// Las formas de la esquina de 2.png, en la cara (p en −1…1, y hacia arriba).
// Distancias firmadas: < 0 dentro.
float sdBox(vec2 q, vec2 c, vec2 h) { vec2 d = abs(q - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sun = length(p - vec2(0.1, 0.2)) - 0.62;
// El Fuji: un trapecio de laderas cóncavas, cima en y = 0.05.
float slope = 0.05 - abs(p.x - 0.02) * 0.9 + abs(p.x - 0.02) * abs(p.x - 0.02) * 0.25;
float fuji = p.y - slope;
// La nieve: la cima hasta y = -0.22, con el borde dentado.
float snowLine = -0.22 + sin(p.x * 38.0) * 0.035 + sin(p.x * 17.0) * 0.02;
float snow = max(fuji, snowLine - p.y);
// El torii: dos pilares, el nuki y el kasagi con sus puntas levantadas.
float pillars = min(sdBox(p, vec2(-0.42, -0.25), vec2(0.06, 0.75)), sdBox(p, vec2(0.46, -0.25), vec2(0.06, 0.75)));
float nuki = sdBox(p, vec2(0.02, 0.28), vec2(0.66, 0.04));
float kasagiY = 0.5 + pow(abs(p.x - 0.02) / 0.82, 3.0) * 0.08;
float kasagi = max(abs(p.y - kasagiY) - 0.055, abs(p.x - 0.02) - 0.82);
float torii = min(min(pillars, nuki), kasagi);
// Pincel seco en los bordes y pintura que cede en el relieve.
float brush = (rocaNoise(p * 18.0) - 0.5) * 0.06;
float wear = smoothstep(0.55, 0.85, vFace.w);
```

  `rocaNoise` es un value noise 2D local al shader. Cada capa se pinta con
  `1 - smoothstep(-0.01, 0.01, forma + brush)` multiplicado por `wear`. Las
  posiciones exactas se calibran mirando la cara de frente por CDP contra
  `2.png`.

  Orden de capas: piedra → sol (shu) → Fuji (sumi) → nieve (washi) → torii
  (sumi). La pintura es mate (rugosidad 0,95 donde hay pintura). Sin
  backticks; nombres que no tapen variables de fuera.

- [ ] **Paso 4: colocación y calibración.** `DECOR_UBICACION` gana
  `{ kind: 'roca', at: { d: 30, u: 5.2 }, portrait: { d: 34, u: 3.4, scale: 0.8 }, yaw: -0.2 }`
  como punto de partida; mover `d`/`u` hasta que pasen las comprobaciones del
  Paso 1 (si a la derecha cae siempre en el título, pasar a la izquierda del
  camino y anotarlo como desviación en el spec).

- [ ] **Paso 5: huellas.** `objectBases` de la roca: tres círculos a lo largo
  de su ancho (x = −1,25 / 0 / 1,25, `r = 0,8`, `foot = 0,7`,
  `top = y + height`, sólidos). `SPREAD`/`STRENGTH`/`PER_BASE` como el farol.

- [ ] **Paso 6:** compilar en WebGL2; CDP de la vista inicial y de la parada 1;
  `check:path`, `typecheck`.

---

### Tarea 6: La susuki

**Archivos:**
- Crear: `src/scene/decor/susuki.ts` (puro), `src/scene/systems/SusukiField.tsx`
- Modificar: `journey.ts` (`DecorSusuki`), `placement.ts` (`layout.susuki`),
  `footprints.ts` (franja para cámara y piedras), `StationDecor.tsx`
- Modificar: `src/scene/shaders/windSway.ts` (la espiga) si hace falta
- Modificar: `scripts/check-decor.ts`

**Interfaces:**
- Produce: `DecorSusuki { kind: 'susuki'; area: DecorArea; portrait?: DecorArea | null; density: number; taper?: number; height: readonly [number, number]; seed: number }`;
  `PlacedSusuki { item: DecorSusuki; area: DecorArea; stationD: number }`;
  `DecorLayout.susuki: readonly PlacedSusuki[]`;
  `susukiTufts(p: PlacedSusuki, densityScale: number): Tuft[]` con
  `Tuft = { x, y, z, height, yaw, phase, spring, plumes: number }`.

- [ ] **Paso 1: comprobaciones (fallan).** «La susuki»: hay matas en
  Ubicación; ninguna sobre una piedra; ninguna dentro del triángulo cámara de
  la parada → zona de escritura de su kōsatsu (en planta, con 0,5 u de
  margen); la última mata cae antes del primer cerezo (d); el reparto de
  la libélula y la garza sigue saliendo (Tarea 8 lo comprueba entero).

- [ ] **Paso 2: `susuki.ts`.** Igual que `groveCulms` (rechazo por `taper`,
  separación mínima 0,35) más: `susukiBladeGeometry()` (cinta de 6 tramos,
  ancho 0,035, curvada hacia fuera con la altura) y `susukiPlumeGeometry()`
  (una espiga: abanico de 7 cintas finas de 0,25 de largo). Cada mata = 14
  hojas + 2–4 espigas, como instancias (una matriz por hoja/espiga, la base en
  la mata).

- [ ] **Paso 3: `SusukiField.tsx`.** Dos `InstancedMesh` (hojas, espigas)
  con `createDecorMaterial(..., sway: 'hoja')` (las hojas giran sobre su base
  y se tienden: es justo `leafTurn`/`leafStream`) y `aSway` por instancia (la
  base de la mata, su alto, su fase y el muelle `SHRUB_SPRING`), sombra con
  `createSwayDepthMaterial(true)`. Color: por instancia, entre
  `palette.matchaSoft` y `palette.kohaku` (verde a paja), y en la hoja un
  degradado hacia la punta en el fragmento (`uv.y`); las espigas,
  `palette.washiDeep` con un toque de `palette.sakuraBlush`.
  Densidad por tier (`DECOR_DENSITY`). Libera geometrías y materiales.

- [ ] **Paso 4: la declaración.** En `DECOR_UBICACION`, manchas por los dos
  costados entre d 8 y 92 (`inner` 3–4, `outer` 9–14), `taper` 0,3 en la
  última; sin manchas delante de las tablas (el check del Paso 1 lo exige).

- [ ] **Paso 5:** compilar en WebGL2; CDP; `check:path`, `typecheck`.

---

### Tarea 7: El cerezo

**Archivos:**
- Crear: `src/scene/objects/cerezo/cerezo.ts` (crecimiento, puro),
  `cerezoGeometry.ts`, `blossomMaterial.ts`, `Cerezo.tsx`
- Modificar: `journey.ts` (`DecorCerezo`), `footprints.ts`, `contact.ts`,
  `moss.ts`, `StationDecor.tsx`
- Modificar: `scripts/check-decor.ts`

**Interfaces:**
- Produce: `DecorCerezo { kind: 'cerezo'; seed: number } & DecorObjectBase`;
  `growCerezo(seed: number): { branches: Branch[]; clusters: Cluster[]; height: number; trunkRadius: number }`
  con `Branch = { from: [x,y,z]; to: [x,y,z]; r0: number; r1: number }` y
  `Cluster = { x, y, z, radius }`; `CEREZO_SIZE = { height: [5, 7], spread: [5, 7.5] }`.

- [ ] **Paso 1: comprobaciones (fallan).** «El cerezo»: 2–3 en los últimos
  30 u del tramo, a |u| 7–14; altura en `CEREZO_SIZE.height`; ninguna rama
  por debajo del suelo; desde la cámara de la tercera parada, la copa no tapa
  la tabla; el tronco cierra el paso; triángulos por árbol < 8 000 (tronco) y
  flores ≤ 2 500 instancias en tier alto.

- [ ] **Paso 2: `cerezo.ts`.** Crecimiento recursivo con semilla
  (`mulberry32`): tronco de 1,4–2 u que se abre en 3–4 ramas principales muy
  abiertas (45–70° de la vertical), cada una con 2–3 hijas por nivel, 4
  niveles, largo × 0,72 y radio × 0,62 por nivel, una curva suave por rama
  (ruido en la dirección). Los extremos del último nivel dejan un `Cluster`
  cada uno (radio 0,5–0,9). La copa queda ancha y baja (somei-yoshino).

- [ ] **Paso 3: `cerezoGeometry.ts`.** Cada rama un tubo de 6 lados entre sus
  radios (`CylinderGeometry` orientado), fusionados; color de la corteza
  `palette.sumiSoft` hacia `palette.sumi` en la base. Las flores:
  `blossomGeometry()` = un quad de 0,22 u; instancias repartidas en cada
  cluster (esfera achatada, más densas fuera).

- [ ] **Paso 4: `blossomMaterial.ts`.** `createDecorMaterial` con
  `doubleSide`, `sway: 'hoja'` y un fragmento que dibuja la flor en el quad:
  cinco pétalos por distancia polar (`abs(sin(2.5·θ))`), escotadura en la
  punta, `discard` fuera (las derivadas antes del `discard`), centro
  `palette.sakura`, pétalo de `palette.sakuraPale` a blanco por instancia.
  Sombra con el viento (`createSwayDepthMaterial(true)` + el mismo `discard`
  en la sombra, o sin sombra en las flores y sí en el tronco: decidir midiendo
  el coste).

- [ ] **Paso 5: la declaración.** En `DECOR_UBICACION`:
  `{ kind: 'cerezo', seed: 21, at: { d: 108, u: -9 } }`,
  `{ kind: 'cerezo', seed: 22, at: { d: 116, u: 11.5 }, scale: 1.1 }`,
  `{ kind: 'cerezo', seed: 23, at: { d: 124, u: -13 }, scale: 0.9 }` (a
  calibrar con el Paso 1). Huella: el tronco (círculo, `r = trunkRadius·1,6`,
  sólido); musgo y sombra de contacto como el arbusto.

- [ ] **Paso 6:** compilar en WebGL2; CDP de la tercera parada (los cerezos
  detrás) y del final del tramo; medir fps y draw calls en tier alto.

---

### Tarea 8: El reparto del valle

**Archivos:**
- Modificar: `src/config/journey.ts` (`DECOR_UBICACION`)
- Modificar: `scripts/check-decor.ts`

- [ ] **Paso 1: comprobaciones.** «El valle de Ubicación»: al menos un grupo
  con kasuga y yukimi en el mismo lado a < 3 u entre sí, y al menos un farol
  suelto; ningún objeto tapa una tabla desde la cámara de su parada (para
  cada objeto, su caja proyectada vs el rectángulo de la tabla); la fauna de
  Ubicación (`libelula`, `garza`) sale en ≥ 75 % de los repartos en d =
  estación, y en d = cada parada, en horizontal y vertical (el bucle de «La
  fauna sigue teniendo sitio», generalizado a una lista de estaciones y d).

- [ ] **Paso 2: la declaración.** Partiendo de:

```ts
{ kind: 'farol', variant: 'kasuga', at: { d: 46, u: 4.4 } },
{ kind: 'farol', variant: 'yukimi', at: { d: 48.2, u: 5.6 } },
{ kind: 'arbusto', seed: 31, at: { d: 50, u: 6.8 } },
{ kind: 'farol', variant: 'yukimi', at: { d: 80, u: -4.8 } },
{ kind: 'arbusto', seed: 32, at: { d: 14, u: -6.5 } },
{ kind: 'arbusto', seed: 33, at: { d: 72, u: 6.2 } },
```

  ajustar hasta que pasen las comprobaciones, mirando capturas por CDP de la
  vista inicial (no se carga) y de las tres paradas.

- [ ] **Paso 3:** `check:path` entero → verde.

---

### Tarea 9: Revisión en el navegador y documentación

**Archivos:**
- Modificar: `docs/PLAN.md`, `CLAUDE.md`, `assets/kanji/LICENSES.md`,
  el spec (§16 «Desviaciones al implementar», si las hay)

- [ ] **Paso 1: CDP (Chrome headless), horizontal 1600×900 y 1366×657, vertical 430×932:**
  la vista inicial de Ubicación; cada parada; el rollo a medio bajar; volver
  hacia atrás; el final del tramo con los cerezos; la lista con 静 (los `<img>`
  de los mapas). Consola sin «Shader Error» ni errores.
- [ ] **Paso 2:** `bun run check:path`, `bun run typecheck`, `bun run build`
  → verdes.
- [ ] **Paso 3: PLAN.md:** estado (5A ✅, 5B 🔎); §5.4c con el tramo; la
  regla de los faroles («en pareja, mezclados, solos»); el kōsatsu, la roca,
  la susuki y el cerezo en §7; `bun run maps`.
- [ ] **Paso 4: CLAUDE.md:** comandos (`bun run maps`), arquitectura
  (`objects/kosatsu|roca|cerezo`, `decor/susuki.ts`, `public/maps`), estado de
  las fases, y las trampas nuevas que aparezcan.
- [ ] **Paso 5:** parar y reportar al usuario (sin commits de código).
