# Fase 3A — El mundo · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el decorado fijo en un mundo continuo por el que la cámara camina con el scroll, de la Home a Gastronomía, con llegada automática a cada estación.

**Architecture:** Un sendero puro (`scene/path/journeyPath.ts`) que avanza siempre hacia −Z, parametrizado por la profundidad `d`, del que salen el terreno global, las piedras, el encuadre de cámara (`scene/camera/pathRig.ts`) y la mezcla de ambientes entre estaciones. La posición de la cámara es *objetivo del scroll + desfase de viaje*; vive en el objeto de módulo `PATH` (un solo escritor, el rig) y el store sólo guarda la zona. Cada página termina en un tramo (`PathTramo`) cuyo scroll lleva la cámara a la siguiente estación.

**Tech Stack:** Next 16 (App Router, export estático), React 19.2, three 0.185 + R3F 9.7, GSAP 3.15 (ScrollTrigger), Lenis 1.3, Zustand 5, next-intl 4, bun.

**Spec:** `docs/superpowers/specs/2026-09-29-fase-3a-el-mundo-design.md`

## Global Constraints

- Runtime y gestor: **bun / bunx**. Nunca `npm` ni `npx`.
- Idioma: comentarios, documentación y textos en **español**; identificadores en inglés.
- `src/config/journey.ts` es la fuente única de verdad: nada de listas de estaciones duplicadas.
- La cámara **nunca entra en la escena**: encuadre observador, 22 u detrás del punto de interés.
- Nunca dos contextos WebGL vivos.
- El contenido es siempre DOM real; el canvas va detrás, `aria-hidden`.
- Lo que cambia a 60 fps **no vive en el store** (`PATH`, `TRAVEL`, `SCROLL_PATH` son objetos de módulo con un solo escritor).
- Dentro de un shader **no hay backticks** (cierran el template literal) y no se reutilizan nombres de un ámbito exterior.
- Todo cambio de GLSL se compila en un contexto WebGL2 real y se revisa la consola («Shader Error») antes de darlo por bueno.
- Valores del spec: `PATH_LENGTH = 400`; laterales inicio 0, ubicación −8, eventos 2, fushimi-inari −6, kiyomizu-dera 4, gion −5, gastronomía 0; pasillo |u| < 7; rumbo ≤ 15°, velocidad angular ≤ 12°/s; inclinación 3,5°–8,7°; tramo 220vh con `power2.inOut`; avance de lectura 4 u; viaje 1,8 s → ~4 s con curva `piedra`.
- **Sin commits intermedios**: el usuario revisa visualmente el bloque entero y commitea él (es su práctica en el historial del repo).
- Entre las tareas 2 y 5 `bun run typecheck` falla a propósito (las firmas del terreno cambian antes que sus consumidores). La prueba de esas tareas es `bun run check:path`. Desde la tarea 5 typecheck y build tienen que pasar.

## Review Focus

1. **«Atrás» después de una llegada automática** — el navegador vuelve a la página anterior; no puede volver a disparar la llegada. Lo impide el tramo «armado» (tarea 7) y lo comprueba el recorrido manual de la tarea 9.
2. **Dos saltos seguidos** (clic en otra estación en pleno viaje) — la cámara no puede saltar: el desfase se acumula. `jumpOffset` lo fija en `check:path` (tarea 4).
3. **Entrar directo a una URL profunda** (`/es/lugares/gion/`) — la cámara empieza en Gion sin viaje y con el ambiente de Gion desde el primer frame. Lo cubren `arrivals` y `zone` del store (tarea 5) y el recorrido manual (tarea 9).
4. **Página cuyo contenido cabe en pantalla, o valores de scroll no finitos** — el objetivo de la cámara nunca puede ser `NaN`. `scrollTargetDepth` sanea sus entradas y `check:path` lo comprueba (tarea 4).
5. **Movimiento reducido / modo 静** — la cámara salta, no hay llegada automática y el enlace del tramo funciona. Recorrido manual (tarea 9).

---

### Task 1: El sendero

**Files:**
- Modify: `src/config/journey.ts`
- Create: `src/scene/path/journeyPath.ts`
- Create: `scripts/check-path.ts`
- Modify: `package.json` (script `check:path`)

**Interfaces:**
- Produces:
  - `PATH_LENGTH: number` (journey.ts), `StationEnvironment.lateral: number`.
  - journeyPath.ts: `SLOPE_RUN`, `STATION_DEPTHS: readonly number[]`, `stationIndex(slug): number`, `stationDepth(slug): number`, `pathX(d): number`, `pathY(d): number`, `interface ZoneBlend { from; to; t }`, `zoneBlend(d): ZoneBlend`, `zoneWeight(d, index): number`, `dominantZone(d): number`, `blendByZone(d, value: (s: Station) => number): number`, `interface PathFrame { x; y; z; yaw }`, `interface Point3 { x; y; z }`, `PATH: { d; progress; advance; offset; frame: PathFrame; focus: Point3 }`, `frameToWorld(frame, x, z, out: { x; z }): void`.
  - check-path.ts: helpers `section(title)`, `check(name, ok, detail?)`, `range(from, to, step)` y el bloque final de resumen. Las tareas siguientes **insertan sus secciones antes del bloque de resumen**.

- [ ] **Step 1: Escribir las comprobaciones del sendero (fallan: el módulo no existe)**

Crear `scripts/check-path.ts`:

```ts
/**
 * Comprobaciones puras del camino (Fase 3A).
 *
 * Todo lo que se puede comprobar sin navegador —la forma del sendero, el
 * terreno, el encuadre de la cámara, las piedras, el scroll y el viaje— se
 * comprueba aquí, recorriendo el camino entero con paso fino. Lo que sólo se
 * ve en pantalla (que se sienta como caminar) es la revisión visual.
 *
 * Uso: bun run check:path
 */

import { JOURNEY, PATH_LENGTH } from '../src/config/journey';
import {
  dominantZone,
  pathX,
  pathY,
  STATION_DEPTHS,
  stationIndex,
  zoneWeight,
} from '../src/scene/path/journeyPath';

const failures: string[] = [];
const DEG = Math.PI / 180;

function section(title: string): void {
  console.log(`\n— ${title}`);
}

function check(name: string, ok: boolean, detail = ''): void {
  const suffix = detail ? ` (${detail})` : '';
  console.log(`${ok ? '✓' : '✗'} ${name}${suffix}`);
  if (!ok) failures.push(name);
}

function range(from: number, to: number, step: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to + 1e-9; value += step) values.push(value);
  return values;
}

/** Pendiente del eje en `d`, por diferencia centrada. */
function slopeAt(d: number): number {
  return (pathX(d + 0.01) - pathX(d - 0.01)) / 0.02;
}

/* ── 1. El sendero ─────────────────────────────────────────────────────── */

section('El sendero');

check(
  'las estaciones avanzan siempre hacia el fondo',
  STATION_DEPTHS.every((d, i) => i === 0 || d > STATION_DEPTHS[i - 1]!),
);
check(
  'la Home está en 0 y Gastronomía en PATH_LENGTH',
  STATION_DEPTHS[0] === 0 && STATION_DEPTHS[STATION_DEPTHS.length - 1] === PATH_LENGTH,
);

const lateralJumps = JOURNEY.slice(1).map((station, i) =>
  Math.abs(station.environment.lateral - JOURNEY[i]!.environment.lateral),
);
check(
  '|Δlateral| ≤ 10 entre estaciones consecutivas',
  Math.max(...lateralJumps) <= 10,
  `máx ${Math.max(...lateralJumps)}`,
);

check(
  'el eje pasa por el lateral de cada estación',
  JOURNEY.every((station, i) => Math.abs(pathX(STATION_DEPTHS[i]!) - station.environment.lateral) < 1e-9),
);

const stationSlopes = STATION_DEPTHS.map((d) => Math.abs(slopeAt(d)));
check(
  'la tangente es nula en cada estación (vista frontal, de cartel)',
  Math.max(...stationSlopes) < 1e-3,
  `máx ${Math.max(...stationSlopes).toExponential(1)}`,
);

let steepest = 0;
for (const d of range(-50, PATH_LENGTH + 50, 0.25)) {
  steepest = Math.max(steepest, Math.atan(Math.abs(slopeAt(d))));
}
check('el rumbo del eje nunca pasa de 15°', steepest <= 15 * DEG, `máx ${(steepest / DEG).toFixed(1)}°`);

let worstSum = 0;
let outside = false;
for (const d of range(-50, PATH_LENGTH + 50, 0.5)) {
  let sum = 0;
  for (let i = 0; i < JOURNEY.length; i += 1) {
    const weight = zoneWeight(d, i);
    if (weight < 0 || weight > 1) outside = true;
    sum += weight;
  }
  worstSum = Math.max(worstSum, Math.abs(sum - 1));
}
check('los pesos de zona suman 1 en todo el camino', worstSum < 1e-9 && !outside);
check(
  'cada estación pesa 1 en su propio punto',
  JOURNEY.every((_, i) => Math.abs(zoneWeight(STATION_DEPTHS[i]!, i) - 1) < 1e-9),
);
check(
  'en cada estación domina ella misma',
  JOURNEY.every((_, i) => dominantZone(STATION_DEPTHS[i]!) === i),
);

let descends = false;
let previousY = pathY(-60);
for (const d of range(-60, PATH_LENGTH + 250, 0.5)) {
  const y = pathY(d);
  if (y < previousY - 1e-9) descends = true;
  previousY = y;
}
check('el camino nunca baja', !descends);
check('la Home está a ras (pathY(0) = 0)', Math.abs(pathY(0)) < 1e-9);

const fushimi = STATION_DEPTHS[stationIndex('fushimi-inari')]!;
const rise = pathY(fushimi + 11) - pathY(fushimi - 11);
check(
  'en Fushimi Inari el camino sube su slope (2,4) cada 22 unidades',
  Math.abs(rise - 2.4) < 0.05,
  `sube ${rise.toFixed(2)}`,
);

/* ── Resumen ───────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} comprobación(es) fallaron.`);
  process.exit(1);
}

console.log('\n✓ Todo el camino en orden.');
```

Añadir a `package.json`, en `scripts`, después de `"palette"`:

```json
    "check:path": "bun run scripts/check-path.ts"
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `bun run check:path`
Expected: FAIL — no resuelve `../src/scene/path/journeyPath` (y `PATH_LENGTH` no existe).

- [ ] **Step 3: Datos del camino en `journey.ts`**

En `StationEnvironment`, sustituir el campo `slope` y añadir `lateral`:

```ts
  /**
   * Pendiente del tramo de esta estación: el camino sube `slope` unidades cada
   * 22 de recorrido (la distancia de la cámara a su punto de interés, así que
   * en la vista de la estación se ve exactamente esta cuesta). 0 = llano.
   * Nunca negativa: el camino sólo sube.
   */
  readonly slope: number;
  /**
   * Desvío lateral del camino en el punto de la estación, en unidades. Entre
   * dos estaciones el camino va de un lateral al otro, y ahí están las curvas.
   * Entre estaciones consecutivas |Δ| ≤ 10, para que el rumbo no pase de ~13°.
   */
  readonly lateral: number;
```

Añadir `lateral` a cada `environment` de `JOURNEY`: inicio `lateral: 0`, ubicacion `lateral: -8`, eventos `lateral: 2`, fushimi-inari `lateral: -6`, kiyomizu-dera `lateral: 4`, gion `lateral: -5`, gastronomia `lateral: 0`. Por ejemplo, la Home queda:

```ts
    environment: { hills: 'suaves', hillSides: ['izquierda'], slope: 0, lateral: 0 },
```

Justo antes de `export const JOURNEY`, añadir:

```ts
/**
 * Profundidad total del camino, en unidades de mundo: de la Home (`pathT` 0)
 * a Gastronomía (`pathT` 1). Con los `pathT` de abajo, cada estación queda a
 * unas 64–72 unidades de la siguiente. Ver `scene/path/journeyPath.ts`.
 */
export const PATH_LENGTH = 400;
```

Y actualizar el comentario de `pathT` en `Station`:

```ts
  /** Posición sobre el camino: 0 = inicio, 1 = final. Su profundidad es `pathT × PATH_LENGTH`. */
  readonly pathT: number;
```

- [ ] **Step 4: Escribir `src/scene/path/journeyPath.ts`**

```ts
/**
 * ★ El sendero del viaje, como matemática pura.
 *
 * Las siete estaciones de `journey.ts` son puntos de un único camino que avanza
 * siempre hacia el fondo (−Z). El parámetro es la **profundidad recorrida** `d`
 * (con z = −d): cada estación está en `d = pathT × PATH_LENGTH`, y entre dos
 * estaciones el camino se desvía de lado (`lateral`) y sube si la zona tiene
 * pendiente (`slope`).
 *
 * Dos decisiones sostienen todo lo demás:
 *
 *   · **El camino nunca vuelve atrás.** A cada profundidad le corresponde un
 *     solo punto del eje, así que el terreno, las colinas y la mezcla de
 *     ambientes se consultan en O(1), sin buscar el punto más cercano de una
 *     curva. El precio es no tener curvas en U, que una cámara observadora
 *     tampoco querría tomar.
 *   · **La tangente es nula en cada estación.** El desvío va de una estación a
 *     la siguiente con un `smoothstep`, así que la vista de cada estación es
 *     frontal, de cartel, y las curvas ocurren entre ellas.
 *
 * Usar la profundidad y no la longitud de arco es una simplificación
 * deliberada: con rumbos de 13° la diferencia es < 3 %.
 *
 * Aquí vive también `PATH`: dónde está la cámara ahora mismo. Mismo criterio
 * que `WIND` y `PARALLAX`: cambia sesenta veces por segundo, lo escribe un solo
 * sitio (el rig de cámara) y el resto lo lee dentro de `useFrame`.
 *
 * Módulo puro y sin React: `bun run check:path` lo recorre entero.
 */

import { JOURNEY, PATH_LENGTH, type Station, type StationSlug } from '@/config/journey';
import { clamp, lerp, smoothstep } from '@/lib/procedural';

/**
 * Sobre cuántas unidades se mide la `slope` de una estación: la distancia de la
 * cámara a su punto de interés. Así la cuesta que se ve en la vista de cada
 * estación es la misma que con la cámara quieta de la Fase 1.
 */
export const SLOPE_RUN = 22;

/** Fracción de cada tramo que ocupa el fundido entre sus dos estaciones. */
const BLEND_WIDTH = 0.5;

/** Profundidad de cada estación, en el orden de `JOURNEY`. */
export const STATION_DEPTHS: readonly number[] = JOURNEY.map((s) => s.pathT * PATH_LENGTH);

const INDEX = new Map<StationSlug, number>(JOURNEY.map((s, i) => [s.slug, i]));

export function stationIndex(slug: StationSlug): number {
  return INDEX.get(slug) ?? 0;
}

export function stationDepth(slug: StationSlug): number {
  return STATION_DEPTHS[stationIndex(slug)] ?? 0;
}

/**
 * Tramo al que pertenece `d`: el índice de la estación con la que empieza.
 * Antes de la Home cuenta como el primer tramo y después de Gastronomía como
 * el último, así que todo lo que se calcula fuera del camino se prolonga
 * plano.
 */
function segmentAt(d: number): number {
  const last = STATION_DEPTHS.length - 2;
  for (let i = 0; i < last; i += 1) {
    if (d < STATION_DEPTHS[i + 1]!) return i;
  }
  return last;
}

/** Centro del camino —la x del mundo— a la profundidad `d`. */
export function pathX(d: number): number {
  const i = segmentAt(d);
  const from = JOURNEY[i]!.environment.lateral;
  const to = JOURNEY[i + 1]!.environment.lateral;
  return lerp(from, to, smoothstep(STATION_DEPTHS[i]!, STATION_DEPTHS[i + 1]!, d));
}

/** Mezcla entre las dos estaciones de un tramo: `t` es el peso de `to`. */
export interface ZoneBlend {
  readonly from: number;
  readonly to: number;
  readonly t: number;
}

/**
 * Cuánto pesa cada estación en `d`. Cada una pesa 1 en su entorno y se funde
 * con la vecina en una banda centrada en la mitad del tramo. Todo lo que se
 * mezcla entre estaciones —relieve, color del suelo, niebla, viento, pétalos—
 * sale de aquí, así que nada puede cambiar de zona a destiempo de lo demás.
 */
export function zoneBlend(d: number): ZoneBlend {
  const i = segmentAt(d);
  const d0 = STATION_DEPTHS[i]!;
  const d1 = STATION_DEPTHS[i + 1]!;
  const middle = (d0 + d1) / 2;
  const half = ((d1 - d0) * BLEND_WIDTH) / 2;
  return { from: i, to: i + 1, t: smoothstep(middle - half, middle + half, d) };
}

/** Peso de la estación `index` en `d` (0 si no es de este tramo). */
export function zoneWeight(d: number, index: number): number {
  const zone = zoneBlend(d);
  if (index === zone.from) return 1 - zone.t;
  if (index === zone.to) return zone.t;
  return 0;
}

/** La estación que más pesa en `d`: la «zona» en la que está la cámara. */
export function dominantZone(d: number): number {
  const zone = zoneBlend(d);
  return zone.t < 0.5 ? zone.from : zone.to;
}

/** Mezcla, por pesos de zona, un valor numérico que declara cada estación. */
export function blendByZone(d: number, value: (station: Station) => number): number {
  const zone = zoneBlend(d);
  return lerp(value(JOURNEY[zone.from]!), value(JOURNEY[zone.to]!), zone.t);
}

/* ── Altura del camino ─────────────────────────────────────────────────── */

/**
 * La altura es la **integral de la pendiente**, así que no tiene fórmula
 * cerrada: se integra una vez en una tabla uniforme y se interpola. El terreno
 * la consulta decenas de miles de veces al construirse.
 */
const LUT_STEP = 0.5;
const LUT_FROM = -200;
const LUT_TO = PATH_LENGTH + 400;

function gradeAt(d: number): number {
  return blendByZone(d, (station) => station.environment.slope / SLOPE_RUN);
}

function buildElevation(): Float64Array {
  const count = Math.ceil((LUT_TO - LUT_FROM) / LUT_STEP) + 1;
  const table = new Float64Array(count);
  let previous = gradeAt(LUT_FROM);
  for (let i = 1; i < count; i += 1) {
    const current = gradeAt(LUT_FROM + i * LUT_STEP);
    table[i] = table[i - 1]! + ((previous + current) / 2) * LUT_STEP;
    previous = current;
  }
  return table;
}

const ELEVATION = buildElevation();

function sampleElevation(d: number): number {
  const at = (clamp(d, LUT_FROM, LUT_TO) - LUT_FROM) / LUT_STEP;
  const i = Math.min(ELEVATION.length - 2, Math.floor(at));
  return lerp(ELEVATION[i]!, ELEVATION[i + 1]!, at - i);
}

/** El camino empieza a ras en la Home: la altura se mide desde ahí. */
const ELEVATION_ORIGIN = sampleElevation(0);

/** Altura del eje del camino en `d`, relativa a la Home. Sólo sube. */
export function pathY(d: number): number {
  return sampleElevation(d) - ELEVATION_ORIGIN;
}

/* ── Dónde está la cámara ──────────────────────────────────────────────── */

/**
 * El encuadre local de la cámara: el origen de las coordenadas en que están
 * escritos `CAMERA_BASE`, la regla de tercios y las conductas de la fauna.
 * Local → mundo es girar `yaw` en Y y trasladar a (x, y, z).
 */
export interface PathFrame {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/**
 * El recorrido, vivo. **Un solo escritor**: `CameraRig`. Lo leen los pétalos,
 * la fauna, la atmósfera, el sol y `/diagnostico`, siempre dentro de un frame.
 */
export const PATH: {
  /** Profundidad del punto de interés de la cámara. */
  d: number;
  /** `d / PATH_LENGTH`, acotado a 0–1: el «pathProgress» del PLAN. */
  progress: number;
  /** Avance acumulado, con signo. Los pétalos lo integran para fluir. */
  advance: number;
  /** Desfase de viaje en curso; 0 en reposo. */
  offset: number;
  frame: PathFrame;
  /** Punto al que mira la cámara, en mundo. */
  focus: Point3;
} = {
  d: 0,
  progress: 0,
  advance: 0,
  offset: 0,
  frame: { x: 0, y: 0, z: 0, yaw: 0 },
  focus: { x: 0, y: 0, z: 0 },
};

/** Del encuadre local al mundo, en el plano XZ (la misma rotación que three). */
export function frameToWorld(
  frame: PathFrame,
  x: number,
  z: number,
  out: { x: number; z: number },
): void {
  const cos = Math.cos(frame.yaw);
  const sin = Math.sin(frame.yaw);
  out.x = frame.x + x * cos + z * sin;
  out.z = frame.z - x * sin + z * cos;
}
```

- [ ] **Step 5: Ejecutar las comprobaciones**

Run: `bun run check:path`
Expected: todas las líneas de «El sendero» en ✓ y `✓ Todo el camino en orden.` (salida 0).

---

### Task 2: El terreno global

**Files:**
- Modify: `src/scene/systems/elevation.ts` (reescritura)
- Modify: `scripts/check-path.ts` (nueva sección)

**Interfaces:**
- Consumes: `pathX`, `pathY`, `zoneBlend` (Task 1).
- Produces: `GROUND_Y = -1`, `CENTER_CLEAR = 7`, `hillAmplitude(d, side: Side): number`, `terrainHeight(x, z): number` (**sin** parámetro de estación), `groundY(x, z): number` (= `GROUND_Y + terrainHeight`).

- [ ] **Step 1: Comprobaciones del terreno (fallan: la firma no existe)**

En `scripts/check-path.ts`, añadir el import:

```ts
import {
  CENTER_CLEAR,
  hillAmplitude,
  terrainHeight,
} from '../src/scene/systems/elevation';
```

e insertar antes del bloque «Resumen»:

```ts
/* ── 2. El terreno ─────────────────────────────────────────────────────── */

section('El terreno');

let corridorWorst = 0;
for (const d of range(-60, PATH_LENGTH + 240, 1)) {
  for (const u of range(-CENTER_CLEAR, CENTER_CLEAR, 0.5)) {
    corridorWorst = Math.max(corridorWorst, Math.abs(terrainHeight(pathX(d) + u, -d) - pathY(d)));
  }
}
check(
  'el pasillo central (|u| ≤ 7) nunca tiene relieve, tampoco en las curvas',
  corridorWorst < 1e-9,
  `desvío máx ${corridorWorst.toExponential(1)}`,
);

const depthOf = (slug: Parameters<typeof stationIndex>[0]) => STATION_DEPTHS[stationIndex(slug)]!;
check(
  'Fushimi Inari levanta montaña a los dos lados',
  hillAmplitude(depthOf('fushimi-inari'), 'izquierda') === 9 &&
    hillAmplitude(depthOf('fushimi-inari'), 'derecha') === 9,
);
check(
  'Kiyomizu-dera sólo levanta relieve a la derecha',
  hillAmplitude(depthOf('kiyomizu-dera'), 'izquierda') === 0 &&
    hillAmplitude(depthOf('kiyomizu-dera'), 'derecha') === 9,
);
check(
  'Gastronomía es llana',
  hillAmplitude(depthOf('gastronomia'), 'izquierda') === 0 &&
    hillAmplitude(depthOf('gastronomia'), 'derecha') === 0,
);

let terrainStep = 0;
for (const d of range(-60, PATH_LENGTH + 240, 0.25)) {
  for (const u of [-40, -20, 20, 40]) {
    const x = pathX(d) + u;
    terrainStep = Math.max(terrainStep, Math.abs(terrainHeight(x, -d - 0.25) - terrainHeight(x, -d)));
  }
}
check(
  'el terreno no da escalones al pasar de una estación a otra',
  terrainStep < 1,
  `máx ${terrainStep.toFixed(3)} por cada 0,25 u`,
);
```

- [ ] **Step 2: Verlas fallar**

Run: `bun run check:path`
Expected: FAIL — `CENTER_CLEAR` / `hillAmplitude` no se exportan y `terrainHeight` pide un tercer argumento.

- [ ] **Step 3: Reescribir `src/scene/systems/elevation.ts`**

```ts
import { JOURNEY, type HillProfile, type Side } from '@/config/journey';
import { lerp, smoothstep } from '@/lib/procedural';
import { pathX, pathY, zoneBlend } from '@/scene/path/journeyPath';

/**
 * El relieve del terreno, como función pura y **global**.
 *
 * Desde la Fase 3A el terreno ya no depende de la estación activa: es un solo
 * mundo, y la altura de cada punto es la del camino a esa profundidad más las
 * colinas de sus costados. La misma función la usan la malla del suelo, las
 * piedras, la cámara y la fauna, así que nada flota ni se hunde.
 *
 * La regla dura de composición vive aquí: las colinas se miden desde el **eje
 * del camino** (`u = x − pathX(d)`), no desde x = 0, y `sideMask()` vale 0 en
 * |u| < 7. Ninguna colina puede invadir el pasillo por donde va el sujeto —
 * tampoco en las curvas—, y no depende de acordarse: es imposible por
 * construcción.
 *
 * Lo que había en la Fase 1 para que el relieve no apareciera en primer plano
 * (una máscara por z) era relativo a una cámara quieta. Con la cámara
 * avanzando, las colinas pasan a los lados, casi siempre fuera de cuadro.
 */

/** Altura del plano base. Todo lo que pisa el suelo parte de aquí. */
export const GROUND_Y = -1;

/** Semiancho del pasillo central que el relieve nunca invade. */
export const CENTER_CLEAR = 7;

/** Cuánto tarda el relieve en alcanzar su amplitud plena a partir del pasillo. */
const CENTER_FADE = 11;

const HILL_AMPLITUDE: Record<HillProfile, number> = {
  ninguna: 0,
  suaves: 2.6,
  montanosa: 9,
};

/** Amplitud de cada costado en cada estación, precalculada. */
const SIDE_AMPLITUDE: readonly Record<Side, number>[] = JOURNEY.map((station) => {
  const env = station.environment;
  const amplitude = HILL_AMPLITUDE[env.hills];
  return {
    izquierda: env.hillSides.includes('izquierda') ? amplitude : 0,
    derecha: env.hillSides.includes('derecha') ? amplitude : 0,
  };
});

/**
 * Amplitud del relieve de un costado en `d`: la de cada estación, mezclada por
 * pesos de zona. Al ir de Eventos a Fushimi Inari las lomas suaves crecen
 * hasta montaña poco a poco, sin escalón.
 */
export function hillAmplitude(d: number, side: Side): number {
  const zone = zoneBlend(d);
  return lerp(SIDE_AMPLITUDE[zone.from]![side], SIDE_AMPLITUDE[zone.to]![side], zone.t);
}

/**
 * Ondulación del relieve. Suma de senos en vez de ruido: es continua, barata y
 * no deja costuras entre vértices vecinos.
 */
function ridge(x: number, z: number): number {
  return (
    0.55 * Math.sin(x * 0.11 + 1.7) +
    0.3 * Math.sin(z * 0.085 - 0.4) +
    0.22 * Math.sin((x + z) * 0.05 + 2.3) +
    0.62
  );
}

/**
 * Altura del terreno en (x, z), relativa a `GROUND_Y`: la del camino a esa
 * profundidad, más las colinas si el punto cae fuera del pasillo.
 */
export function terrainHeight(x: number, z: number): number {
  const d = -z;
  const u = x - pathX(d);
  const amplitude = hillAmplitude(d, u < 0 ? 'izquierda' : 'derecha');
  const hills =
    amplitude === 0
      ? 0
      : amplitude * smoothstep(CENTER_CLEAR, CENTER_CLEAR + CENTER_FADE, Math.abs(u)) * ridge(x, z);

  return pathY(d) + hills;
}

/** La y del mundo en la que está el suelo. */
export function groundY(x: number, z: number): number {
  return GROUND_Y + terrainHeight(x, z);
}
```

- [ ] **Step 4: Verlas pasar**

Run: `bun run check:path`
Expected: «El sendero» y «El terreno» en ✓. Si «no da escalones» falla con un valor < 2, subir el umbral no es la respuesta: revisar que `hillAmplitude` use `zoneBlend` y no la estación dominante.

---

### Task 3: El rig de cámara, en puro

**Files:**
- Modify: `src/scene/camera/framing.ts` (añadir `VIEW`)
- Modify: `src/animation/presets.ts` (exportar `cubicBezierEase`, añadir `TRAMO_EASE`)
- Create: `src/scene/camera/pathRig.ts`
- Modify: `scripts/check-path.ts` (nueva sección)

**Interfaces:**
- Consumes: `pathX`, `pathY`, `PathFrame`, `Point3` (Task 1); `GROUND_Y`, `groundY` (Task 2); `CAMERA_BASE`.
- Produces:
  - framing.ts: `VIEW: { aspect: number }` (lo escribe el rig; 3B lo usará para márgenes).
  - presets.ts: `export function cubicBezierEase(x1, y1, x2, y2): (p: number) => number`, `export const TRAMO_EASE = 'power2.inOut'`.
  - pathRig.ts: `CAMERA_BACK` (22), `FOCUS_HEIGHT` (2,9), `CAMERA_HEIGHT` (5,2), `RIG_LIMITS { maxYaw; maxYawRate; pitchMin; pitchMax }`, `interface RigState { initialized; d; speed; focusX; yaw; focus: Point3; camera: Point3; frame: PathFrame }`, `createRig(): RigState`, `pathYaw(d): number`, `snapRig(rig, d): void`, `stepRig(rig, d, dt): void`.

- [ ] **Step 1: Comprobaciones de la cámara (fallan: el módulo no existe)**

En `scripts/check-path.ts`, añadir los imports:

```ts
import { cubicBezierEase } from '../src/animation/presets';
import { CAMERA_BACK, createRig, RIG_LIMITS, stepRig } from '../src/scene/camera/pathRig';
```

y ampliar el import de elevation con `groundY`. Insertar antes del «Resumen»:

```ts
/* ── 3. La cámara ──────────────────────────────────────────────────────── */

section('La cámara');

interface RigRun {
  maxYaw: number;
  maxYawRate: number;
  minPitch: number;
  maxPitch: number;
  minClearance: number;
  maxDeviation: number;
}

/** Recorre el camino con el rig a 60 fps, siguiendo `depthAt(t)`. */
function simulate(depthAt: (t: number) => number, duration: number): RigRun {
  const rig = createRig();
  const dt = 1 / 60;
  const run: RigRun = {
    maxYaw: 0,
    maxYawRate: 0,
    minPitch: Infinity,
    maxPitch: -Infinity,
    minClearance: Infinity,
    maxDeviation: 0,
  };
  let previousYaw: number | null = null;

  for (let t = 0; t <= duration + 1e-9; t += dt) {
    stepRig(rig, depthAt(t), dt);
    if (previousYaw !== null) {
      run.maxYawRate = Math.max(run.maxYawRate, Math.abs(rig.yaw - previousYaw) / dt);
    }
    previousYaw = rig.yaw;

    const pitch = Math.atan2(rig.camera.y - rig.focus.y, CAMERA_BACK);
    run.maxYaw = Math.max(run.maxYaw, Math.abs(rig.yaw));
    run.minPitch = Math.min(run.minPitch, pitch);
    run.maxPitch = Math.max(run.maxPitch, pitch);
    run.minClearance = Math.min(run.minClearance, rig.camera.y - groundY(rig.camera.x, rig.camera.z));
    run.maxDeviation = Math.max(run.maxDeviation, Math.abs(rig.focus.x - pathX(rig.d)));
  }

  return run;
}

const piedra = cubicBezierEase(0.65, 0, 0.35, 1);
const TRAVEL_SECONDS = 4;

const runs: [string, RigRun, number][] = [
  ['scroll (16 u/s)', simulate((t) => 16 * t, PATH_LENGTH / 16), 0.6],
  ['viaje de ida (4 s)', simulate((t) => PATH_LENGTH * piedra(t / TRAVEL_SECONDS), TRAVEL_SECONDS), 6],
  ['viaje de vuelta (4 s)', simulate((t) => PATH_LENGTH * (1 - piedra(t / TRAVEL_SECONDS)), TRAVEL_SECONDS), 6],
];

const EPS = 1e-6;
for (const [name, run, deviationLimit] of runs) {
  check(`${name}: rumbo ≤ 15°`, run.maxYaw <= RIG_LIMITS.maxYaw + EPS, `máx ${(run.maxYaw / DEG).toFixed(1)}°`);
  check(
    `${name}: giro ≤ 12°/s`,
    run.maxYawRate <= RIG_LIMITS.maxYawRate + EPS,
    `máx ${(run.maxYawRate / DEG).toFixed(1)}°/s`,
  );
  check(
    `${name}: inclinación entre 3,5° y 8,7° (horizonte al 25–40 %)`,
    run.minPitch >= RIG_LIMITS.pitchMin - EPS && run.maxPitch <= RIG_LIMITS.pitchMax + EPS,
    `${(run.minPitch / DEG).toFixed(2)}° – ${(run.maxPitch / DEG).toFixed(2)}°`,
  );
  check(`${name}: la cámara nunca a menos de 3 u del suelo`, run.minClearance >= 3, `mín ${run.minClearance.toFixed(2)}`);
  check(
    `${name}: el punto de interés no se aparta del eje más de ${deviationLimit} u`,
    run.maxDeviation <= deviationLimit,
    `máx ${run.maxDeviation.toFixed(2)}`,
  );
}
```

- [ ] **Step 2: Verlas fallar**

Run: `bun run check:path`
Expected: FAIL — no resuelve `pathRig` ni exporta `cubicBezierEase`.

- [ ] **Step 3: `VIEW` en `framing.ts`**

Después de `CAMERA_BASE`, añadir:

```ts
/**
 * Lo que la cámara real sabe de la pantalla y la matemática pura no: el
 * aspecto. Lo escribe `CameraRig` en cada frame. Las funciones de abajo siguen
 * asumiendo 16:9 por defecto; en la Fase 3B la fauna pasará a medir sus
 * márgenes con este valor.
 */
export const VIEW = { aspect: 16 / 9 };
```

Y en la cabecera del archivo, añadir un párrafo:

```ts
 * Desde la Fase 3A todo esto está escrito en el **encuadre local** de la
 * cámara (`PATH.frame`): la cámara viaja por el camino, pero respecto de ella
 * el cuadro es siempre el mismo. `pathRig.ts` hace la traducción al mundo.
```

- [ ] **Step 4: `presets.ts` exporta la curva y declara la del tramo**

Cambiar `function cubicBezierEase(` por `export function cubicBezierEase(` y, después de `FALLBACK_DURATIONS`, añadir:

```ts
/**
 * La curva del tramo: el scroll del final de cada página no mueve la cámara a
 * velocidad constante, sino que **arranca con peso, cruza a buen paso y llega
 * frenando**. Es la marcha de quien echa a andar y se detiene al llegar.
 *
 * Va aparte de las cuatro curvas de `tokens.css` porque no la usa el DOM: sólo
 * traduce el progreso del tramo en profundidad de cámara (`useJourneyScroll`).
 */
export const TRAMO_EASE = 'power2.inOut';
```

- [ ] **Step 5: Escribir `src/scene/camera/pathRig.ts`**

```ts
/**
 * El encuadre sobre el camino, como matemática pura.
 *
 * `CAMERA_BASE` es un encuadre **local**: cámara 22 unidades por detrás del
 * punto de interés y 2,3 por encima, ~6° de inclinación, horizonte al 32 %.
 * Aquí se lleva ese encuadre a cualquier punto del camino:
 *
 *   · el punto de interés es el eje en `d`, a 2,9 sobre el suelo del camino;
 *   · la cámara queda 22 unidades por detrás siguiendo su rumbo, a 5,2 sobre el
 *     terreno que tiene debajo;
 *   · **la inclinación queda acotada** a 3,5°–8,7° (horizonte al 25–40 %). En
 *     una cuesta, si la mirada se saliera de esa banda, se sube la cámara:
 *     nunca se inclina más. Altura e inclinación son dos mandos distintos.
 *
 * **El rumbo está acotado dos veces, contra el mareo**: en ángulo (±15°) y en
 * velocidad (12°/s). Y en los viajes rápidos el encuadre sigue una versión
 * filtrada del camino —paso bajo en rumbo y en desvío lateral, de ~0,5 s— que
 * recorta las curvas: a velocidad de viaje, seguirlas al pie de la letra sería
 * un zarandeo. A velocidad de scroll el filtro es casi transparente.
 *
 * Módulo puro: `bun run check:path` recorre el camino con él.
 */

import { clamp, damp, lerp, smoothstep } from '@/lib/procedural';
import { pathX, pathY, type PathFrame, type Point3 } from '@/scene/path/journeyPath';
import { GROUND_Y, groundY } from '@/scene/systems/elevation';

import { CAMERA_BASE } from './framing';

const DEG = Math.PI / 180;

const [, CAMERA_Y, CAMERA_Z] = CAMERA_BASE.position;
const [, TARGET_Y, TARGET_Z] = CAMERA_BASE.target;

/** Distancia horizontal de la cámara a su punto de interés. */
export const CAMERA_BACK = CAMERA_Z - TARGET_Z;
/** Altura del punto de interés sobre el suelo del camino. */
export const FOCUS_HEIGHT = TARGET_Y - GROUND_Y;
/** Altura de la cámara sobre el terreno que tiene debajo. */
export const CAMERA_HEIGHT = CAMERA_Y - GROUND_Y;

export const RIG_LIMITS = {
  maxYaw: 15 * DEG,
  maxYawRate: 12 * DEG,
  pitchMin: 3.5 * DEG,
  pitchMax: 8.7 * DEG,
} as const;

/** El rumbo mira la tangente promediada en ±10 unidades, no la puntual. */
const TANGENT_SPAN = 10;

/** Constante del filtro en reposo y en viaje (1/τ, en 1/s). */
const SETTLE_LAMBDA = 12;
const TRAVEL_LAMBDA = 2;

/** Entre estas velocidades (u/s) el filtro pasa de uno a otro. */
const SPEED_SETTLED = 15;
const SPEED_TRAVEL = 60;

export interface RigState {
  initialized: boolean;
  d: number;
  /** Velocidad de avance suavizada, u/s. */
  speed: number;
  /** Desvío lateral filtrado del punto de interés. */
  focusX: number;
  yaw: number;
  focus: Point3;
  camera: Point3;
  frame: PathFrame;
}

export function createRig(): RigState {
  return {
    initialized: false,
    d: 0,
    speed: 0,
    focusX: 0,
    yaw: 0,
    focus: { x: 0, y: 0, z: 0 },
    camera: { x: 0, y: 0, z: 0 },
    frame: { x: 0, y: 0, z: 0, yaw: 0 },
  };
}

/** El rumbo que pide el camino en `d`, ya acotado. */
export function pathYaw(d: number): number {
  const slope = (pathX(d + TANGENT_SPAN) - pathX(d - TANGENT_SPAN)) / (2 * TANGENT_SPAN);
  // Una rotación en Y lleva el −Z local hacia (−sen, −cos): para mirar hacia
  // donde avanza el camino, el rumbo es −atan de su pendiente.
  return clamp(-Math.atan(slope), -RIG_LIMITS.maxYaw, RIG_LIMITS.maxYaw);
}

/** Coloca el rig en `d` de golpe, sin filtros: la primera vez y sin movimiento. */
export function snapRig(rig: RigState, d: number): void {
  rig.initialized = true;
  rig.d = d;
  rig.speed = 0;
  rig.focusX = pathX(d);
  rig.yaw = pathYaw(d);
  place(rig);
}

/** Avanza el rig hasta `d` en `dt` segundos, con filtros y topes. */
export function stepRig(rig: RigState, d: number, dt: number): void {
  if (!rig.initialized || dt <= 0) {
    snapRig(rig, d);
    return;
  }

  rig.speed = damp(rig.speed, Math.abs(d - rig.d) / dt, 8, dt);
  const lambda = lerp(SETTLE_LAMBDA, TRAVEL_LAMBDA, smoothstep(SPEED_SETTLED, SPEED_TRAVEL, rig.speed));

  rig.focusX = damp(rig.focusX, pathX(d), lambda, dt);

  const wanted = damp(rig.yaw, pathYaw(d), lambda, dt);
  const maxStep = RIG_LIMITS.maxYawRate * dt;
  rig.yaw = clamp(
    rig.yaw + clamp(wanted - rig.yaw, -maxStep, maxStep),
    -RIG_LIMITS.maxYaw,
    RIG_LIMITS.maxYaw,
  );

  rig.d = d;
  place(rig);
}

function place(rig: RigState): void {
  const sin = Math.sin(rig.yaw);
  const cos = Math.cos(rig.yaw);
  const focusY = GROUND_Y + pathY(rig.d) + FOCUS_HEIGHT;

  rig.focus.x = rig.focusX;
  rig.focus.y = focusY;
  rig.focus.z = -rig.d;

  const cameraX = rig.focusX + CAMERA_BACK * sin;
  const cameraZ = -rig.d + CAMERA_BACK * cos;
  const lowest = focusY + CAMERA_BACK * Math.tan(RIG_LIMITS.pitchMin);
  const highest = focusY + CAMERA_BACK * Math.tan(RIG_LIMITS.pitchMax);

  rig.camera.x = cameraX;
  rig.camera.y = clamp(groundY(cameraX, cameraZ) + CAMERA_HEIGHT, lowest, highest);
  rig.camera.z = cameraZ;

  // El origen local es el punto que hace coincidir el objetivo de CAMERA_BASE
  // con el punto de interés: así la regla de tercios y las conductas de la
  // fauna, escritas en local, caen donde tienen que caer.
  rig.frame.yaw = rig.yaw;
  rig.frame.x = rig.focusX - TARGET_Z * sin;
  rig.frame.z = -rig.d - TARGET_Z * cos;
  rig.frame.y = focusY - TARGET_Y;
}
```

- [ ] **Step 6: Verlas pasar**

Run: `bun run check:path`
Expected: «La cámara» en ✓ para las tres simulaciones. El giro a 16 u/s roza el tope al salir de cada estación (la aceleración del `smoothstep` es máxima ahí): es el tope trabajando, no un fallo.

---

### Task 4: Piedras, scroll y viaje, en puro

**Files:**
- Create: `src/scene/objects/stoneGeometry.ts`
- Delete: `src/scene/objects/Stone.tsx`
- Create: `src/scene/path/stones.ts`
- Create: `src/animation/journeyScroll.ts`
- Create: `src/animation/travel.ts`
- Modify: `scripts/check-path.ts` (nueva sección)

**Interfaces:**
- Consumes: `pathX`, `STATION_DEPTHS`, `stationIndex` (Task 1); `groundY` (Task 2); `motionDurations`, `registerPresets` (presets.ts).
- Produces:
  - stoneGeometry.ts: `stoneGeometry(seed: number, detail?: number): BufferGeometry`.
  - stones.ts: `STONE_VARIANTS = 12`, `STONE_SINK = 0.12`, `STONE_MEANDER = 3`, `interface StoneInstance { variant; x; y; z; scale; rotation }`, `stoneSeed(variant): number`, `stoneLayout(): StoneInstance[]`.
  - journeyScroll.ts: `READING_DRIFT = 4`, `interface ScrollPath { station: StationSlug | null; content: number; tramo: number }` (`tramo` ya con la curva aplicada), `SCROLL_PATH`, `resetScrollPath(station)`, `scrollTargetDepth(station, scroll?): number`.
  - travel.ts: `TRAVEL: { offset: number; span: number }`, `JUMP_THRESHOLD = 6`, `travelDuration(distance, base?): number`, `jumpOffset(offset, previousTarget, target): number`, `absorbJump(previousTarget, target): void`, `cancelTravel(): void`, `isTraveling(): boolean`.

- [ ] **Step 1: Comprobaciones (fallan: los módulos no existen)**

En `scripts/check-path.ts`, añadir los imports:

```ts
import { READING_DRIFT, scrollTargetDepth } from '../src/animation/journeyScroll';
import { jumpOffset, travelDuration } from '../src/animation/travel';
import { STONE_MEANDER, STONE_SINK, STONE_VARIANTS, stoneLayout } from '../src/scene/path/stones';
```

e insertar antes del «Resumen»:

```ts
/* ── 4. Piedras, scroll y viaje ────────────────────────────────────────── */

section('Las piedras');

const stones = stoneLayout();
check('unas 310 piedras en todo el recorrido', stones.length >= 290 && stones.length <= 330, `${stones.length}`);
check(
  'cubren de antes de la Home a después de Gastronomía',
  Math.max(...stones.map((s) => s.z)) >= 25 && Math.min(...stones.map((s) => s.z)) <= -(PATH_LENGTH + 15),
);
check(
  'se usan las 12 formas',
  new Set(stones.map((s) => s.variant)).size === STONE_VARIANTS,
);
const worstLane = Math.max(...stones.map((s) => Math.abs(s.x - pathX(-s.z))));
check(
  'todas dentro del pasillo, serpenteando alrededor del eje',
  worstLane <= STONE_MEANDER + 0.3 && worstLane < CENTER_CLEAR,
  `máx ${worstLane.toFixed(2)} del eje`,
);
const worstRest = Math.max(
  ...stones.map((s) => Math.abs(s.y + STONE_SINK * s.scale - groundY(s.x, s.z))),
);
check('todas apoyan en el terreno', worstRest < 1e-9);

section('El scroll');

const withNext = JOURNEY.slice(0, -1);
check(
  'al empezar una página la cámara está en su estación',
  withNext.every((s, i) => scrollTargetDepth(s.slug, { station: s.slug, content: 0, tramo: 0 }) === STATION_DEPTHS[i]),
);
check(
  `al terminar de leer avanzó ${READING_DRIFT} u`,
  withNext.every(
    (s, i) =>
      Math.abs(scrollTargetDepth(s.slug, { station: s.slug, content: 1, tramo: 0 }) - (STATION_DEPTHS[i]! + READING_DRIFT)) < 1e-9,
  ),
);
check(
  'al terminar el tramo está exactamente en la siguiente estación',
  withNext.every(
    (s, i) =>
      Math.abs(scrollTargetDepth(s.slug, { station: s.slug, content: 1, tramo: 1 }) - STATION_DEPTHS[i + 1]!) < 1e-9,
  ),
);
check(
  'el scroll de otra página no mueve la cámara',
  scrollTargetDepth('eventos', { station: 'gion', content: 1, tramo: 1 }) === STATION_DEPTHS[stationIndex('eventos')],
);
check(
  'valores no finitos no llegan nunca a la cámara',
  scrollTargetDepth('eventos', { station: 'eventos', content: Number.NaN, tramo: Number.POSITIVE_INFINITY }) ===
    STATION_DEPTHS[stationIndex('eventos')],
);

section('El viaje');

check(
  'una estación de viaje dura ~1,8 s',
  Math.abs(travelDuration(66.7) - 1.8) < 0.05,
  `${travelDuration(66.7).toFixed(2)} s`,
);
check('el camino entero dura 4 s', travelDuration(PATH_LENGTH) === 4, `${travelDuration(PATH_LENGTH)} s`);
check('un salto corto no se hace eterno', travelDuration(5) >= 0.6 && travelDuration(5) < 1, `${travelDuration(5).toFixed(2)} s`);

// La cámara está en objetivo + desfase. Un salto del objetivo se absorbe en el
// desfase, así que la posición no cambia en ese frame —tampoco si el salto
// llega en mitad de otro viaje.
const cameraBefore = 100 + 0;
const offsetAfter = jumpOffset(0, 100, 300);
check('un salto del objetivo no mueve la cámara', 300 + offsetAfter === cameraBefore);
const midTravel = 300 + -120;
const offsetAgain = jumpOffset(-120, 300, 50);
check('un segundo salto en pleno viaje tampoco', 50 + offsetAgain === midTravel);
```

- [ ] **Step 2: Verlas fallar**

Run: `bun run check:path`
Expected: FAIL — no resuelve `journeyScroll`, `travel` ni `stones`.

- [ ] **Step 3: `src/scene/objects/stoneGeometry.ts`** (sale de `Stone.tsx`, que se borra)

```ts
import { IcosahedronGeometry, Vector3, type BufferAttribute, type BufferGeometry } from 'three';

import { directionalWobble, mulberry32 } from '@/lib/procedural';

/**
 * Piedra del camino.
 *
 * Icosaedro deformado por ruido direccional y dibujado con flat shading: da
 * las caras planas y el aire tallado de las referencias, y cada `seed` produce
 * una piedra distinta. Ninguna se dibujó a mano.
 *
 * Desde la Fase 3A no hay un mesh por piedra: el camino usa doce formas y las
 * instancia a lo largo de todo el recorrido (`systems/StonePath.tsx`).
 */
export function stoneGeometry(seed: number, detail = 1): BufferGeometry {
  const geo = new IcosahedronGeometry(1, detail);
  const position = geo.attributes.position as BufferAttribute;
  const random = mulberry32(seed);

  // Proporciones de canto rodado: ancha, poco alta.
  const squash = 0.3 + random() * 0.16;
  const stretchX = 0.95 + random() * 0.4;
  const stretchZ = 0.95 + random() * 0.4;

  const v = new Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).normalize();
    const radius = 1 + directionalWobble(v.x, v.y, v.z, seed);
    position.setXYZ(i, v.x * radius * stretchX, v.y * radius * squash, v.z * radius * stretchZ);
  }

  position.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
```

Borrar `src/scene/objects/Stone.tsx` (su único consumidor era `StonePath`, que se reescribe en la tarea 5).

- [ ] **Step 4: `src/scene/path/stones.ts`**

```ts
/**
 * Dónde va cada piedra del camino, como función pura.
 *
 * El camino entero, de antes de la Home a después de Gastronomía, con una
 * piedra cada ~1,45 unidades. Doce formas procedurales repartidas al azar
 * (`stoneSeed`), cada una con su giro y su escala.
 *
 * Dos decisiones:
 *
 *   · **La S de `3.png`.** La hilera serpentea ±3 unidades alrededor del eje,
 *     con una onda de ~34, siempre dentro del pasillo. La cámara sigue el eje,
 *     no la S: una cámara que zigzagueara con cada piedra marearía.
 *   · **Tamaño de mundo real.** En la Fase 1 las piedras lejanas eran más
 *     pequeñas a propósito (0,86 → 0,52), un truco que sólo funciona con la
 *     cámara quieta: con la cámara avanzando crecerían al acercarse. Ahora todas
 *     miden ~0,7 con un ±12 % de variación.
 */

import { PATH_LENGTH } from '@/config/journey';
import { mulberry32 } from '@/lib/procedural';
import { groundY } from '@/scene/systems/elevation';

import { pathX } from './journeyPath';

export const STONE_VARIANTS = 12;
/** Cuánto se entierra cada piedra, en fracción de su escala: pisaderas, no peñascos. */
export const STONE_SINK = 0.12;
/** Amplitud de la S alrededor del eje. */
export const STONE_MEANDER = 3;

const STONE_SPACING = 1.45;
const STONE_WAVE = 34;
const STONE_SCALE = 0.7;
/** Desde bajo la cámara de la Home hasta pasado el final del camino. */
const STONE_FROM = -30;
const STONE_TO = PATH_LENGTH + 20;

export interface StoneInstance {
  readonly variant: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
  readonly rotation: number;
}

/** Seed de cada una de las doce formas. */
export function stoneSeed(variant: number): number {
  return 100 + variant * 37;
}

export function stoneLayout(): StoneInstance[] {
  // Semilla fija: el camino es el mismo en cada carga.
  const random = mulberry32(1204);
  const stones: StoneInstance[] = [];

  for (let d = STONE_FROM; d <= STONE_TO; d += STONE_SPACING) {
    // Un poco de desorden: un camino real no está alineado a hilo.
    const along = d + (random() - 0.5) * 0.35;
    const meander = STONE_MEANDER * Math.sin((2 * Math.PI * (along + 10.4)) / STONE_WAVE + Math.PI / 2);
    const x = pathX(along) + meander + (random() - 0.5) * 0.55;
    const z = -along;
    const scale = STONE_SCALE * (0.88 + random() * 0.24);

    stones.push({
      variant: Math.floor(random() * STONE_VARIANTS),
      x,
      y: groundY(x, z) - STONE_SINK * scale,
      z,
      scale,
      rotation: random() * Math.PI * 2,
    });
  }

  return stones;
}
```

- [ ] **Step 5: `src/animation/journeyScroll.ts`**

```ts
/**
 * Del scroll de la página a la profundidad de la cámara, en puro.
 *
 * Cada página de estación tiene dos partes:
 *
 *   · **contenido**: mientras se lee, la cámara avanza sólo `READING_DRIFT`
 *     unidades. Se sigue «en» la estación;
 *   · **tramo**: la sección del final (`PathTramo`), cuyo scroll lleva la
 *     cámara de la estación a la siguiente con la curva del tramo.
 *
 * `SCROLL_PATH` lo escribe `useJourneyScroll` (un solo escritor) y lo lee el
 * rig de cámara en cada frame. Lleva la estación que lo escribió: si la página
 * que hay ahora no es de ninguna estación (`/diagnostico`), la cámara se queda
 * donde estaba en vez de volver a cero.
 */

import type { StationSlug } from '@/config/journey';
import { clamp } from '@/lib/procedural';
import { STATION_DEPTHS, stationIndex } from '@/scene/path/journeyPath';

/** Cuánto avanza la cámara mientras se lee el contenido de una estación. */
export const READING_DRIFT = 4;

export interface ScrollPath {
  station: StationSlug | null;
  /** Progreso del contenido, 0–1. */
  content: number;
  /** Progreso del tramo, 0–1, **ya pasado por la curva del tramo**. */
  tramo: number;
}

export const SCROLL_PATH: ScrollPath = { station: null, content: 0, tramo: 0 };

/** Cada estación empieza arriba: al montar su página, su scroll vuelve a cero. */
export function resetScrollPath(station: StationSlug): void {
  SCROLL_PATH.station = station;
  SCROLL_PATH.content = 0;
  SCROLL_PATH.tramo = 0;
}

/** Un NaN o un infinito en la cámara es un cuadro en blanco: se sanea aquí. */
function unit(value: number): number {
  return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
}

/** La profundidad a la que el scroll quiere llevar la cámara en esta estación. */
export function scrollTargetDepth(
  station: StationSlug,
  scroll: Readonly<ScrollPath> = SCROLL_PATH,
): number {
  const i = stationIndex(station);
  const here = STATION_DEPTHS[i]!;
  const own = scroll.station === station;

  const reading = here + READING_DRIFT * (own ? unit(scroll.content) : 0);
  const next = STATION_DEPTHS[i + 1];
  if (next === undefined) return reading;

  return reading + (next - reading) * (own ? unit(scroll.tramo) : 0);
}
```

- [ ] **Step 6: `src/animation/travel.ts`**

```ts
/**
 * El viaje: cómo llega la cámara a una estación cuando no la lleva el scroll.
 *
 * La posición de la cámara es siempre **objetivo del scroll + desfase de
 * viaje**. Cuando el objetivo salta —un enlace, «atrás», un clic en el
 * sidebar—, el salto no se aplica: se guarda entero en el desfase, de modo que
 * en ese frame la cámara no se mueve, y GSAP lleva el desfase a cero con la
 * curva `piedra`. El scroll durante el viaje se suma sin saltos, porque los dos
 * términos son independientes; y un segundo salto a mitad de viaje se acumula
 * en el desfase igual que el primero.
 *
 * Mismo criterio que `WIND`: objeto de módulo, un solo escritor (este archivo,
 * a petición del rig), leído dentro de `useFrame`.
 */

import { gsap } from 'gsap';

import { JOURNEY, PATH_LENGTH } from '@/config/journey';
import { clamp } from '@/lib/procedural';

import { motionDurations, registerPresets } from './presets';

export const TRAVEL = {
  /** Lo que le falta a la cámara para llegar a su objetivo. */
  offset: 0,
  /** |desfase| al empezar el viaje en curso (0 en reposo). */
  span: 0,
};

/**
 * A partir de cuántas unidades en un frame un cambio del objetivo se trata
 * como salto. El scroll suave de Lenis nunca llega a tanto.
 */
export const JUMP_THRESHOLD = 6;

/** Una estación, en profundidad media. */
const SEGMENT = PATH_LENGTH / (JOURNEY.length - 1);
const SHORTEST = 0.6;
const LONGEST = 4;

/**
 * Cuánto dura un viaje: `--dur-viaje` (1,8 s) para una estación, y crece con
 * la raíz de la distancia hasta 4 s para el camino entero. Más lejos es más
 * tiempo, pero no proporcionalmente: nadie quiere diez segundos de travelling.
 */
export function travelDuration(distance: number, base = 1.8): number {
  return clamp(base * Math.sqrt(Math.abs(distance) / SEGMENT), SHORTEST, LONGEST);
}

/** El desfase nuevo tras un salto del objetivo: la cámara no se mueve. */
export function jumpOffset(offset: number, previousTarget: number, target: number): number {
  return offset + previousTarget - target;
}

/** Absorbe un salto del objetivo y arranca (o reanuda) el viaje. */
export function absorbJump(previousTarget: number, target: number): void {
  // `piedra` se registra con el motor de movimiento, pero el viaje puede
  // ocurrir antes de que el motor arranque. Es idempotente.
  registerPresets();
  gsap.killTweensOf(TRAVEL);

  TRAVEL.offset = jumpOffset(TRAVEL.offset, previousTarget, target);
  TRAVEL.span = Math.abs(TRAVEL.offset);

  gsap.to(TRAVEL, {
    offset: 0,
    duration: travelDuration(TRAVEL.span, motionDurations().viaje),
    ease: 'piedra',
    onComplete: () => {
      TRAVEL.span = 0;
    },
  });
}

/** Sin viaje: la cámara salta. Primera llegada, modo 静, movimiento reducido. */
export function cancelTravel(): void {
  gsap.killTweensOf(TRAVEL);
  TRAVEL.offset = 0;
  TRAVEL.span = 0;
}

export function isTraveling(): boolean {
  return Math.abs(TRAVEL.offset) > 0.05;
}
```

- [ ] **Step 7: Verlas pasar**

Run: `bun run check:path`
Expected: «Las piedras», «El scroll» y «El viaje» en ✓, más todo lo anterior.

---

### Task 5: La escena sobre el camino

**Files:**
- Modify: `src/store/useKyotoStore.ts`
- Modify: `src/scene/camera/CameraRig.tsx` (reescritura)
- Modify: `src/scene/systems/Terrain.tsx` (reescritura)
- Modify: `src/scene/systems/StonePath.tsx` (reescritura)
- Create: `src/scene/systems/Atmosphere.tsx`
- Modify: `src/scene/FoundationScene.tsx` (reescritura)
- Modify: `src/scene/SceneCanvas.tsx`
- Modify: `src/scene/systems/WindDriver.tsx`
- Modify: `src/audio/AmbientAudio.tsx`
- Modify: `src/scene/systems/fauna/behaviors.ts`, `casting.ts`, `FaunaDirector.tsx`
- Modify: `src/components/ui/DiagnosticsPanel.tsx`
- Modify: `src/animation/MotionEngine.tsx`; Delete: `src/animation/useScrollScene.ts`
- Modify: `src/components/ActiveStation.tsx` (sólo comentario)

**Interfaces:**
- Consumes: todo lo de las tareas 1–4.
- Produces:
  - Store: `zone: StationSlug`, `setZone(slug)`, `arrivals: number` (cuántas veces una página declaró su estación). Fuera `pathProgress`, `setPathProgress`, `selectEnvironment`.
  - `CameraRig` es el único escritor de `PATH` y de `VIEW.aspect`.
  - `Atmosphere`, `Sun` (Atmosphere.tsx).
  - `FaunaAct` pierde `environment`; `groundAt(x, z)`; `AdvanceParams.canSpawn: boolean`.

- [ ] **Step 1: Store**

En `src/store/useKyotoStore.ts`:

Import: `import { type StationSlug } from '@/config/journey';` (fuera `getStation` y `StationEnvironment`).

Sustituir el bloque «Viaje» de la interfaz por:

```ts
  /* ── Viaje ─────────────────────────────────────────────────────────── */
  /** La estación de la ruta: adónde va la cámara. La declara cada página. */
  activeStation: StationSlug;
  /**
   * La estación en cuyo tramo está la cámara: lo que se ve y se oye. Cambia a
   * ritmo humano, así que sí vive aquí; el avance fino vive en `PATH`
   * (`scene/path/journeyPath.ts`), que cambia a 60 fps.
   */
  zone: StationSlug;
  /**
   * Cuántas veces una página ha declarado su estación. La primera es el
   * aterrizaje —la cámara aparece allí, sin viaje—; las demás son viajes.
   */
  arrivals: number;
  setActiveStation: (slug: StationSlug) => void;
  setZone: (slug: StationSlug) => void;
```

Y en el `create`:

```ts
      activeStation: 'inicio',
      zone: 'inicio',
      arrivals: 0,
      // La primera estación de la visita también fija la zona: así el ambiente
      // es el correcto antes incluso de que el canvas haya cargado.
      setActiveStation: (slug) =>
        set((s) => ({
          activeStation: slug,
          arrivals: s.arrivals + 1,
          zone: s.arrivals === 0 ? slug : s.zone,
        })),
      setZone: (slug) => set({ zone: slug }),
```

Borrar `pathProgress`, `setPathProgress` y el selector `selectEnvironment` con su comentario.

- [ ] **Step 2: `CameraRig.tsx`**

Reescribir entero:

```tsx
'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Camera, PerspectiveCamera } from 'three';

import { scrollTargetDepth } from '@/animation/journeyScroll';
import { absorbJump, cancelTravel, JUMP_THRESHOLD, TRAVEL } from '@/animation/travel';
import { JOURNEY, PATH_LENGTH, type StationSlug } from '@/config/journey';
import { readCssNumber } from '@/lib/css-vars';
import { clamp, damp } from '@/lib/procedural';
import { VIEW } from '@/scene/camera/framing';
import { CAMERA_BACK, createRig, snapRig, stepRig } from '@/scene/camera/pathRig';
import { dominantZone, PATH } from '@/scene/path/journeyPath';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

/**
 * La cámara sobre el camino, y el parallax de cursor que la reencuadra.
 *
 * Desde la Fase 3A la cámara **viaja**: su punto de interés está en la
 * profundidad `d = objetivo del scroll + desfase de viaje`, y `pathRig.ts`
 * traduce esa `d` a posición, rumbo e inclinación con sus topes anti-mareo.
 * Este componente es el **único escritor de `PATH`**: todo lo que depende de
 * dónde está la cámara —pétalos, fauna, niebla, sol, viento— lo lee de ahí.
 *
 * Cuándo se viaja y cuándo se salta:
 *
 *   · un salto del objetivo (cambio de estación, «atrás», la tecla Fin) se
 *     absorbe en el desfase y GSAP lo lleva a cero (`travel.ts`);
 *   · **la primera estación de la visita** es un aterrizaje: la cámara aparece
 *     allí sin recorrer el camino desde la Home;
 *   · con modo 静 o `prefers-reduced-motion` no hay viaje: la cámara salta.
 *
 * **El parallax sigue siendo deliberadamente sutil**, con los tres límites de
 * `tokens.css`: el 3,5 % del cuadro visible (medido a la distancia real del
 * punto de interés), 2° de giro y una amortiguación que convierte el token por
 * frame en una exponencial independiente del framerate. Se suma en los ejes
 * locales de la cámara, así que en una curva sigue siendo «a la derecha» de lo
 * que se ve.
 *
 * Sin un `lookAt` explícito la cámara miraría perfectamente horizontal; aquí
 * mira siempre al punto de interés, y es el rig el que decide su altura.
 */

/**
 * Desplazamiento actual del parallax, en unidades de mundo. Mismo criterio que
 * `WIND`: cambia cada frame. Sólo lo escribe el rig; `/diagnostico` lo lee.
 */
export const PARALLAX = { x: 0, y: 0 };

interface ParallaxConfig {
  /** Fracción del cuadro visible que puede desplazarse la cámara. */
  max: number;
  /** Constante de la exponencial de amortiguación. */
  lambda: number;
  /** Giro máximo permitido, en radianes. */
  tilt: number;
}

function readParallaxConfig(): ParallaxConfig {
  const perFrame = clamp(readCssNumber('--parallax-damping', 0.06), 0.001, 0.999);

  return {
    max: readCssNumber('--parallax-max', 0.035),
    // `damp()` usa 1 − e^(−λ·dt). Igualando a la interpolación por frame a
    // 60 fps: λ = −ln(1 − factor) · 60. Con 0.06 da λ ≈ 3.7.
    lambda: -Math.log(1 - perFrame) * 60,
    tilt: (readCssNumber('--parallax-tilt', 2) * Math.PI) / 180,
  };
}

export function CameraRig() {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const activeStation = useKyotoStore((s) => s.activeStation);

  const config = useMemo(readParallaxConfig, []);
  const rig = useMemo(createRig, []);
  const lastTarget = useRef<number | null>(null);
  const lastStation = useRef<StationSlug | null>(null);

  const advance = useCallback(
    (view: Camera, dt: number) => {
      const perspective = view as PerspectiveCamera;
      const store = useKyotoStore.getState();
      const motion = selectMotionAllowed(store);

      const target = scrollTargetDepth(store.activeStation);
      const previous = lastTarget.current;
      const stationChanged = lastStation.current !== null && lastStation.current !== store.activeStation;
      lastTarget.current = target;
      lastStation.current = store.activeStation;

      let snap = previous === null || !motion;
      if (!snap && previous !== null && Math.abs(target - previous) > JUMP_THRESHOLD) {
        if (stationChanged && store.arrivals <= 1) snap = true;
        else absorbJump(previous, target);
      }
      if (snap) cancelTravel();

      const before = rig.d;
      const wasReady = rig.initialized;
      if (snap) snapRig(rig, target);
      else stepRig(rig, target + TRAVEL.offset, dt);

      // Un salto seco no es avance: los pétalos no deben fluir cuatrocientas
      // unidades de golpe.
      if (wasReady && !snap) PATH.advance += rig.d - before;
      PATH.d = rig.d;
      PATH.progress = clamp(rig.d / PATH_LENGTH, 0, 1);
      PATH.offset = TRAVEL.offset;
      Object.assign(PATH.frame, rig.frame);
      Object.assign(PATH.focus, rig.focus);

      const zone = JOURNEY[dominantZone(rig.d)]!.slug;
      if (zone !== store.zone) store.setZone(zone);

      VIEW.aspect = perspective.aspect;

      // Tamaño del cuadro a la distancia del punto de interés: es la referencia
      // honesta para un desplazamiento "del 3,5 %".
      const distance = Math.hypot(CAMERA_BACK, rig.camera.y - rig.focus.y);
      const viewHeight = 2 * Math.tan((perspective.fov * Math.PI) / 360) * distance;
      const viewWidth = viewHeight * perspective.aspect;
      const limit = Math.tan(config.tilt) * distance;

      if (motion) {
        const { pointer } = store;
        const wantedX = clamp(pointer.x * viewWidth * config.max, -limit, limit);
        // El cursor cuenta la Y hacia abajo; la escena, hacia arriba.
        const wantedY = clamp(-pointer.y * viewHeight * config.max, -limit, limit);
        PARALLAX.x = damp(PARALLAX.x, wantedX, config.lambda, dt);
        PARALLAX.y = damp(PARALLAX.y, wantedY, config.lambda, dt);
      } else {
        PARALLAX.x = 0;
        PARALLAX.y = 0;
      }

      // El eje X local de la cámara, en mundo: (cos, 0, −sen) del rumbo.
      const cos = Math.cos(rig.yaw);
      const sin = Math.sin(rig.yaw);
      perspective.position.set(
        rig.camera.x + PARALLAX.x * cos,
        rig.camera.y + PARALLAX.y,
        rig.camera.z - PARALLAX.x * sin,
      );
      perspective.lookAt(rig.focus.x, rig.focus.y, rig.focus.z);
    },
    [rig, config],
  );

  // Sin movimiento el bucle pasa a `demand` y `useFrame` deja de correr: cada
  // cambio de estación (o de modo) pide su propio frame, con la cámara ya en
  // su sitio.
  useEffect(() => {
    if (motionAllowed) return;
    advance(camera, 0);
    invalidate();
  }, [motionAllowed, activeStation, camera, advance, invalidate]);

  // Prioridad −1: el rig escribe `PATH` antes de que nadie lo lea en el frame.
  // (Una prioridad positiva le quitaría a R3F el render automático.)
  useFrame((state, delta) => advance(state.camera, Math.min(delta, 0.1)), -1);

  return null;
}
```

- [ ] **Step 3: `Terrain.tsx`**

Reescribir entero:

```tsx
'use client';

import { useEffect, useMemo } from 'react';
import { Color, Float32BufferAttribute, PlaneGeometry, type BufferAttribute } from 'three';

import { JOURNEY } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import type { QualityProfile } from '@/scene/quality/tiers';
import { zoneBlend } from '@/scene/path/journeyPath';

import { GROUND_Y, terrainHeight } from './elevation';

/**
 * El suelo del camino entero, de antes de la Home a después de Gastronomía.
 *
 * Es **una sola malla**, calculada una vez al montar: el relieve ya no cambia
 * con la estación activa porque el mundo es uno solo (`elevation.ts`). Lo que
 * sí cambia a lo largo del camino es el color: cada vértice lleva el tinte de
 * suelo de su zona, mezclado con el de la vecina por los mismos pesos que el
 * relieve, la niebla y el viento.
 *
 * El color se mezcla casi del todo con el fondo a propósito (el 30 % del tinte
 * sobre el washi): ninguna referencia tiene un «piso» a color pleno, y el suelo
 * no debe competir con lo que se construya encima.
 */

/** Qué parte del tinte de suelo de cada estación llega al color final. */
const GROUND_TINT = 0.3;

/** Cobertura: el ancho de todo lo que la niebla deja ver, y todo el largo. */
const WIDTH = 360;
const NEAR_Z = 60;
const FAR_Z = -640;
const DEPTH = NEAR_Z - FAR_Z;
const CENTER_Z = (NEAR_Z + FAR_Z) / 2;

/** Segmentos en X y en Z: ~2 unidades por segmento en alto. */
function segmentsFor(tier: QualityProfile['tier']): [number, number] {
  if (tier === 'low') return [90, 175];
  return tier === 'medium' ? [144, 280] : [180, 350];
}

interface TerrainProps {
  palette: ScenePalette;
  profile: QualityProfile;
}

export function Terrain({ palette, profile }: TerrainProps) {
  const [segmentsX, segmentsZ] = segmentsFor(profile.tier);

  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(WIDTH, DEPTH, segmentsX, segmentsZ);
    const position = geo.attributes.position as BufferAttribute;
    const colors = new Float32Array(position.count * 3);

    const tints = JOURNEY.map((station) =>
      new Color(palette.washi).lerp(new Color(station.palette.ground), GROUND_TINT),
    );
    const mixed = new Color();

    // El mesh se rota −90° en X: el eje local Z es el "arriba" del mundo y el
    // local Y es el −Z del mundo, a partir del centro de la malla.
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const worldZ = CENTER_Z - position.getY(i);
      position.setZ(i, terrainHeight(x, worldZ));

      const zone = zoneBlend(-worldZ);
      mixed.lerpColors(tints[zone.from]!, tints[zone.to]!, zone.t);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    position.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [segmentsX, segmentsZ, palette.washi]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, GROUND_Y, CENTER_Z]}
      receiveShadow
    >
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}
```

- [ ] **Step 4: `StonePath.tsx`**

Reescribir entero:

```tsx
'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Euler,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type InstancedMesh,
} from 'three';

import { stoneGeometry } from '@/scene/objects/stoneGeometry';
import { STONE_VARIANTS, stoneLayout, stoneSeed, type StoneInstance } from '@/scene/path/stones';
import type { QualityProfile } from '@/scene/quality/tiers';

/**
 * El camino de piedras, entero.
 *
 * Unas trescientas piedras de la Home a Gastronomía, en **doce
 * `InstancedMesh`** —una por forma—: doce llamadas de dibujo en vez de
 * trescientas. Dónde va cada una lo decide `scene/path/stones.ts`, que es puro
 * y está comprobado por `bun run check:path`: todas dentro del pasillo y
 * apoyadas en el mismo terreno que se dibuja.
 */

interface StonePathProps {
  color: string;
  profile: QualityProfile;
}

export function StonePath({ color, profile }: StonePathProps) {
  // En tier bajo la piedra se ve igual de lejos con menos triángulos.
  const detail = profile.tier === 'low' ? 0 : 1;

  const geometries = useMemo(
    () => Array.from({ length: STONE_VARIANTS }, (_, variant) => stoneGeometry(stoneSeed(variant), detail)),
    [detail],
  );
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);

  const material = useMemo(
    () => new MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0 }),
    [color],
  );
  useEffect(() => () => material.dispose(), [material]);

  const batches = useMemo(() => {
    const groups = Array.from({ length: STONE_VARIANTS }, () => [] as StoneInstance[]);
    for (const stone of stoneLayout()) groups[stone.variant]!.push(stone);
    return groups;
  }, []);

  return (
    <>
      {batches.map((instances, variant) =>
        instances.length > 0 ? (
          <StoneBatch
            key={variant}
            geometry={geometries[variant]!}
            material={material}
            instances={instances}
          />
        ) : null,
      )}
    </>
  );
}

interface StoneBatchProps {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  instances: readonly StoneInstance[];
}

function StoneBatch({ geometry, material, instances }: StoneBatchProps) {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;

    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const euler = new Euler();

    instances.forEach((stone, i) => {
      position.set(stone.x, stone.y, stone.z);
      rotation.setFromEuler(euler.set(0, stone.rotation, 0));
      scale.setScalar(stone.scale);
      node.setMatrixAt(i, matrix.compose(position, rotation, scale));
    });

    node.instanceMatrix.needsUpdate = true;
    // La caja de un InstancedMesh cubre todas sus instancias sólo si se le
    // pide: sin esto, el frustum lo recortaría con la caja de una sola piedra.
    node.computeBoundingSphere();
  }, [instances, geometry]);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, instances.length]}
      castShadow
      receiveShadow
    />
  );
}
```

- [ ] **Step 5: `src/scene/systems/Atmosphere.tsx`**

```tsx
'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Fog, type DirectionalLight } from 'three';

import { JOURNEY, type Station } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import { lerp } from '@/lib/procedural';
import type { QualityProfile } from '@/scene/quality/tiers';
import { PATH, zoneBlend } from '@/scene/path/journeyPath';

/**
 * El aire del camino: el fondo, la niebla y el sol.
 *
 * Lo decide **dónde está la cámara**, no la ruta: al viajar de la Home a Gion
 * la luz pasa por el rosa de la sakura y el rojo de Fushimi Inari antes de
 * llegar al ámbar del anochecer. Todo se mezcla por los mismos pesos de zona
 * que el relieve y el color del suelo, y se escribe cada frame directamente en
 * la escena, sin estado de React: son sesenta cambios por segundo.
 */

/** Mezcla un color base con el tinte de cielo de la estación, si lo tiene. */
function tinted(base: string, station: Station): Color {
  const color = new Color(base);
  const tint = station.environment.skyTint;
  return tint ? color.lerp(new Color(tint.color), tint.amount) : color;
}

interface AtmosphereProps {
  palette: ScenePalette;
  profile: QualityProfile;
}

export function Atmosphere({ palette, profile }: AtmosphereProps) {
  const scene = useThree((state) => state.scene);

  // El fondo y la niebla llevan el tinte de cada estación: es lo que hace que
  // Fushimi Inari se sienta cálido y Gion al anochecer, sin cambiar de escena.
  const tones = useMemo(
    () => JOURNEY.map((station) => ({ sky: tinted(palette.washi, station), fog: tinted(palette.washiFog, station) })),
    [palette],
  );
  const fog = useMemo(() => new Fog(palette.washiFog, 18, 90), [palette.washiFog]);
  const background = useMemo(() => new Color(palette.washi), [palette.washi]);

  // Antes del primer frame: los materiales se compilan sabiendo que hay niebla.
  useLayoutEffect(() => {
    scene.fog = fog;
    scene.background = background;
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene, fog, background]);

  useFrame(() => {
    const zone = zoneBlend(PATH.d);
    const from = JOURNEY[zone.from]!;
    const to = JOURNEY[zone.to]!;

    background.lerpColors(tones[zone.from]!.sky, tones[zone.to]!.sky, zone.t);
    fog.color.lerpColors(tones[zone.from]!.fog, tones[zone.to]!.fog, zone.t);
    fog.near = lerp(from.ambient.fog.near, to.ambient.fog.near, zone.t) * profile.fogScale;
    fog.far = lerp(from.ambient.fog.far, to.ambient.fog.far, zone.t) * profile.fogScale;
  });

  return null;
}

/** Desde dónde llega la luz, respecto del punto que ilumina: rasante, por la izquierda. */
const SUN_OFFSET: [number, number, number] = [-6, 7, 4];

/**
 * La luz rasante de las referencias, que da relieve a las caras planas de las
 * piedras. **Sigue a la cámara**: apunta siempre al origen del encuadre local,
 * que es donde apuntaba en la Fase 1, y su caja de sombras (±12) viaja con
 * ella. Fija en el origen del mundo, las sombras desaparecerían al avanzar.
 */
export function Sun({ palette, profile }: AtmosphereProps) {
  const light = useRef<DirectionalLight>(null);

  useFrame(() => {
    const node = light.current;
    if (!node) return;

    const frame = PATH.frame;
    node.target.position.set(frame.x, frame.y, frame.z);
    node.position.set(frame.x + SUN_OFFSET[0], frame.y + SUN_OFFSET[1], frame.z + SUN_OFFSET[2]);
    // El objetivo no cuelga de la escena: su matriz hay que actualizarla a mano.
    node.target.updateMatrixWorld();
  });

  return (
    <directionalLight
      ref={light}
      position={SUN_OFFSET}
      intensity={1.9}
      color={palette.washi}
      castShadow={profile.shadows}
      shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-12}
      shadow-camera-right={12}
      shadow-camera-top={12}
      shadow-camera-bottom={-12}
    />
  );
}
```

- [ ] **Step 6: `FoundationScene.tsx`**

Reescribir entero:

```tsx
'use client';

import type { Station } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import type { QualityProfile } from '@/scene/quality/tiers';
import { Atmosphere, Sun } from '@/scene/systems/Atmosphere';
import { FaunaDirector } from '@/scene/systems/fauna/FaunaDirector';
import { PetalSystem } from '@/scene/systems/PetalSystem';
import { StonePath } from '@/scene/systems/StonePath';
import { Terrain } from '@/scene/systems/Terrain';

/**
 * El mundo del camino.
 *
 * Desde la Fase 3A es **un solo mundo continuo**: el terreno, las piedras y el
 * aire cubren el recorrido entero y se transforman de una estación a la
 * siguiente por los pesos de zona de `scene/path/journeyPath.ts`. La cámara
 * viaja por él (`camera/CameraRig.tsx`); nada se reconstruye al cambiar de
 * ruta.
 *
 * `station` es la **zona** en la que está la cámara, no la de la ruta: decide
 * qué fauna puede salir.
 *
 * **Composición (regla de tercios)**, en el encuadre local de la cámara:
 *   · el tercio inferior es del camino de piedras,
 *   · el medio, del texto y de la base de los objetos,
 *   · el superior queda despejado para copas, hojas al viento y aves.
 * El relieve sale siempre a los costados del eje del camino (`elevation.ts`).
 */

interface FoundationSceneProps {
  station: Station;
  palette: ScenePalette;
  profile: QualityProfile;
}

export function FoundationScene({ station, palette, profile }: FoundationSceneProps) {
  return (
    <>
      <Atmosphere palette={palette} profile={profile} />

      <hemisphereLight args={[palette.washi, palette.ishiDeep, 1.5]} />
      <Sun palette={palette} profile={profile} />

      <Terrain palette={palette} profile={profile} />
      <StonePath color={palette.ishi} profile={profile} />

      <PetalSystem station={station} palette={palette} />

      {/* La vida del cuadro: quién sale lo decide el director a partir de las
          especies de la zona en la que está la cámara. */}
      <FaunaDirector station={station} palette={palette} profile={profile} />
    </>
  );
}
```

(`PetalSystem` se sustituye por `PetalZones` en la tarea 6.)

- [ ] **Step 7: `SceneCanvas.tsx` y `WindDriver.tsx`**

En `SceneCanvas.tsx`, sustituir `const activeStation = useKyotoStore((s) => s.activeStation);` y `const station = getStation(activeStation);` por:

```tsx
  // La zona en la que está la cámara —no la de la ruta— decide el ambiente.
  const zone = useKyotoStore((s) => s.zone);
  const station = getStation(zone);
```

y `<WindDriver base={station.ambient.wind} enabled={motionAllowed} />` por:

```tsx
      <WindDriver enabled={motionAllowed} />
```

`WindDriver.tsx` entero:

```tsx
'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';

import { blendByZone, PATH } from '@/scene/path/journeyPath';

import { resetWind, updateWind } from './WindField';

/**
 * El único que hace avanzar el viento. Va dentro del `<Canvas>` para compartir
 * el reloj de la escena: así el viento que empuja una hoja es exactamente el
 * mismo que dibujó ese frame, sin desfase de un frame entre sistemas.
 *
 * El viento **base** es el de la zona en la que está la cámara, mezclado con la
 * vecina: al caminar hacia Gion la brisa se va calmando, no se corta.
 *
 * Con el bucle en `demand` (modo 静 o `prefers-reduced-motion`) `useFrame` no
 * se ejecuta, de modo que el aire se queda quieto solo. El efecto se encarga
 * además de borrar la ráfaga que hubiera a medias.
 */
export function WindDriver({ enabled }: { enabled: boolean }) {
  useFrame((_, delta) => {
    if (!enabled) return;
    // Al volver de una pestaña en segundo plano el delta puede valer varios
    // segundos; sin tope, la máquina de ráfagas saltaría medio ciclo de golpe.
    updateWind(Math.min(delta, 0.1), blendByZone(PATH.d, (station) => station.ambient.wind));
  });

  useEffect(() => {
    if (!enabled) resetWind();
  }, [enabled]);

  return null;
}
```

- [ ] **Step 8: `AmbientAudio.tsx`**

Sustituir `const activeStation = useKyotoStore((s) => s.activeStation);` por `const zone = useKyotoStore((s) => s.zone);` y el último efecto por:

```tsx
  // Cada zona tiene su paisaje sonoro, declarado en `journey.ts` junto al resto
  // de su ambiente: Gion suena a ciudad y a fuego, Kiyomizu a agua. Suena la
  // zona en la que está la cámara, no la de la ruta: al viajar, el sonido
  // cambia cuando cambia el paisaje.
  useEffect(() => {
    setAudioLayers(getStation(zone).ambient.sounds);
  }, [zone]);
```

- [ ] **Step 9: Fauna (sólo lo imprescindible de 3A)**

`behaviors.ts`:

- Import: `import type { FaunaKind } from '@/config/journey';` (fuera `StationEnvironment`); sustituir `import { GROUND_Y, terrainHeight } from '@/scene/systems/elevation';` por:

```ts
import { frameToWorld, PATH } from '@/scene/path/journeyPath';
import { groundY } from '@/scene/systems/elevation';
```

- En `FaunaAct`, borrar `readonly environment: StationEnvironment;`.
- Sustituir `groundAt` y `standingY` por:

```ts
const WORLD = { x: 0, z: 0 };

/**
 * Dónde está el suelo, en las coordenadas del encuadre local en que están
 * escritas todas las conductas.
 *
 * En la Fase 3A la fauna **viaja con el encuadre de la cámara** (`PATH.frame`):
 * respecto de ella se ve igual que antes. El suelo, en cambio, se lee en la
 * posición real del mundo, del mismo terreno que se dibuja, así que nada flota
 * ni se hunde en las cuestas. (La Fase 3B anclará los actos al mundo.)
 */
export function groundAt(x: number, z: number): number {
  const frame = PATH.frame;
  frameToWorld(frame, x, z, WORLD);
  return groundY(WORLD.x, WORLD.z) - frame.y;
}

/**
 * La altura a la que queda el **centro del cuerpo** de un animal de pie: el
 * suelo más lo que levantan sus patas. Todo lo que camina la usa; si alguna
 * conducta se apoyara directamente en `groundAt`, el animal andaría enterrado
 * hasta el pecho.
 */
export function standingY(act: FaunaAct, x: number, z: number): number {
  return groundAt(x, z) + act.spec.ride * act.spec.size;
}
```

- En `titilar`, sustituir `groundAt(out.x, out.z, act.environment) +` por `groundAt(out.x, out.z) +`.

`casting.ts`:

- En `AdvanceParams`, añadir:

```ts
  /**
   * Falso durante un viaje: la cámara pasa de largo, y lo que naciera ahora
   * se quedaría atrás antes de verse.
   */
  canSpawn: boolean;
```

- En `advanceCasting`, sustituir `if (cast.length === 0 || live.length >= config.maxActs) return { acts, spawned: null };` por:

```ts
  if (!params.canSpawn || cast.length === 0 || live.length >= config.maxActs) {
    return { acts, spawned: null };
  }
```

- En `castAct`, borrar la línea `environment: station.environment,`.

`FaunaDirector.tsx`:

- Imports: añadir `import type { Group } from 'three';`, `import { isTraveling } from '@/animation/travel';` y `import { PATH } from '@/scene/path/journeyPath';`.
- Tras `const memory = useRef(...)`, añadir `const stage = useRef<Group>(null);`.
- Sustituir el efecto «Al cambiar de estación no se hereda nada» por:

```tsx
  // Al apagar o encender el movimiento se empieza de cero. Al cambiar de zona
  // no: los actos vivos terminan su acto y la zona nueva sólo cuenta para el
  // siguiente reparto. Borrarlos de golpe se veía como un corte en mitad del
  // camino.
  useEffect(() => {
    setActs([]);
    memory.current = newMemory(WIND.time, random.current);
  }, [motionAllowed]);
```

- Al principio del `useFrame`, antes de `if (!motionAllowed) return;`:

```tsx
    // En la Fase 3A la fauna viaja con el encuadre de la cámara (ver
    // `groundAt`). La Fase 3B la anclará al mundo.
    const node = stage.current;
    if (node) {
      const frame = PATH.frame;
      node.position.set(frame.x, frame.y, frame.z);
      node.rotation.set(0, frame.yaw, 0);
    }
```

- En la llamada a `advanceCasting`, añadir `canSpawn: !isTraveling(),`.
- En el `return`, sustituir el fragmento `<>…</>` por `<group ref={stage}>…</group>`.

- [ ] **Step 10: `/diagnostico`, `MotionEngine` y `ActiveStation`**

`DiagnosticsPanel.tsx`:

- Import: `import { PATH } from '@/scene/path/journeyPath';`.
- En `MotionReadout`, sustituir `progress: number;` por:

```ts
  progress: number;
  depth: number;
  travelOffset: number;
```

- En el muestreo: `const { pointer } = state;` y `const station = getStation(state.zone);`; en `setReadout`, sustituir `progress: pathProgress,` por:

```ts
          progress: PATH.progress,
          depth: PATH.d,
          travelOffset: PATH.offset,
```

- En el componente: añadir `const zone = useKyotoStore((s) => s.zone);`, y usar `getStation(zone)` en vez de `getStation(activeStation)`.
- En «Escena», sustituir la fila «Estación activa» por:

```tsx
          <Row label="Estación de la ruta" value={activeStation} />
          <Row label="Zona de la cámara" value={zone} />
```

- En «Movimiento y ambiente», tras «Avance del camino»:

```tsx
          <Row
            label="Profundidad de la cámara"
            value={motion ? `${motion.depth.toFixed(1)} u` : '—'}
          />
          <Row
            label="Desfase de viaje"
            value={motion ? `${motion.travelOffset.toFixed(1)} u` : '—'}
          />
```

`MotionEngine.tsx`: borrar el import y la llamada `useScrollScene(motionAllowed);` y actualizar la cabecera para decir que el scroll → camino vive en `PathTramo` (tarea 7). Borrar `src/animation/useScrollScene.ts`.

`ActiveStation.tsx`: cambiar el comentario:

```tsx
/**
 * El contrato entre una ruta y la escena: la página no dibuja nada en 3D, sólo
 * declara "estoy en la estación X". La escena decide cómo llegar: la primera
 * vez la cámara aparece allí; después, viaja por el camino hasta ella
 * (`scene/camera/CameraRig.tsx`).
 */
```

- [ ] **Step 11: Typecheck, build y comprobaciones**

Run: `bun run typecheck`
Expected: sin errores. Si queda algún `environment` de estación o `pathProgress` suelto, `grep -rn "pathProgress\|act.environment\|selectEnvironment" src` lo localiza.

Run: `bun run check:path`
Expected: todo ✓.

Run: `bun run build`
Expected: export estático sin errores.

- [ ] **Step 12: Humo en el navegador**

Arrancar `bun run dev` (en segundo plano) y abrir `http://localhost:3000/es/` y `/es/lugares/fushimi-inari/`. Esperado: el terreno con colinas a los costados y el camino de piedras se ven; el canvas ocupa la pantalla (no 300×150); en la consola no hay «Shader Error». Los pétalos todavía se ven como en la Fase 2 y **no siguen a la cámara**: es la tarea 6. El scroll todavía no mueve la cámara: es la tarea 7.

---

### Task 6: Pétalos con la cámara en movimiento

**Files:**
- Modify: `src/scene/systems/petals.ts`
- Modify: `src/scene/systems/PetalSystem.tsx`
- Modify: `src/scene/FoundationScene.tsx`
- Modify: `src/components/ui/DiagnosticsPanel.tsx`

**Interfaces:**
- Consumes: `PATH`, `zoneBlend`, `zoneWeight` (Task 1).
- Produces: `petalPresence(station, surge, weight = 1)`, `petalPresentCount(layer, station, scale, surge, weight = 1)`, `petalDrawCount(layer, station, scale, surge, weight = 1)`, `petalTotal(station, scale, surge = 0, weight = 1)`, `petalCountsAt(d, scale, surge): { total: number; byLayer: string }`, componente `PetalZones({ palette })` (sustituye a `PetalSystem`).

- [ ] **Step 1: `petals.ts` — el peso de zona**

Añadir los imports `import { JOURNEY } from '@/config/journey';` (junto a los tipos) y `import { zoneBlend } from '@/scene/path/journeyPath';`. Sustituir las cuatro funciones de cuenta por:

```ts
/**
 * Fracción de la reserva que está presente ahora mismo, 0–1. Es lo que el
 * shader recibe como `uDensity`. `weight` es el peso de la zona en la posición
 * de la cámara: entre dos zonas, cada una aporta su parte.
 */
export function petalPresence(station: Station, surge: number, weight = 1): number {
  const peak = petalPeakFraction(station);
  if (peak <= 0) return 0;

  const base = petalBaseFraction(station);
  return ((base + (peak - base) * surge) / peak) * weight;
}

/** Cuántos pétalos se ven ahora mismo en una capa. */
export function petalPresentCount(
  layer: PetalLayer,
  station: Station,
  particleScale: number,
  surge: number,
  weight = 1,
): number {
  return Math.round(
    petalAllocation(layer, station, particleScale) * petalPresence(station, surge, weight),
  );
}

/**
 * Cuántos entran en el draw call: los que se ven **más la banda de los que
 * están a medio desvanecer**. Una zona con peso 0 no dibuja nada.
 */
export function petalDrawCount(
  layer: PetalLayer,
  station: Station,
  particleScale: number,
  surge: number,
  weight = 1,
): number {
  if (weight <= 0) return 0;
  const allocation = petalAllocation(layer, station, particleScale);
  const presence = petalPresence(station, surge, weight);

  return Math.min(allocation, Math.ceil(allocation * (presence + PETAL_FADE_BAND)));
}

/** Total visible de una zona, ya escalado por calidad, accesibilidad y peso. */
export function petalTotal(station: Station, particleScale: number, surge = 0, weight = 1): number {
  return petalLayers().reduce(
    (sum, layer) => sum + petalPresentCount(layer, station, particleScale, surge, weight),
    0,
  );
}

/**
 * Lo que hay en el aire en la profundidad `d`: las dos zonas del tramo, cada
 * una con su peso. Es la cuenta que enseña `/diagnostico`.
 */
export function petalCountsAt(
  d: number,
  particleScale: number,
  surge: number,
): { total: number; byLayer: string } {
  const zone = zoneBlend(d);
  const parts = [
    { station: JOURNEY[zone.from]!, weight: 1 - zone.t },
    { station: JOURNEY[zone.to]!, weight: zone.t },
  ];

  const byLayer = petalLayers().map((layer) => {
    const count = parts.reduce(
      (sum, part) => sum + petalPresentCount(layer, part.station, particleScale, surge, part.weight),
      0,
    );
    return `${layer.name} ${count}`;
  });
  const total = parts.reduce(
    (sum, part) => sum + petalTotal(part.station, particleScale, surge, part.weight),
    0,
  );

  return { total, byLayer: byLayer.join(' · ') };
}
```

- [ ] **Step 2: El shader — fluir en profundidad y desvanecerse en los bordes**

En `VERTEX` de `PetalSystem.tsx`, añadir `uniform float uAdvance;` tras `uniform float uDepthSway;`. Sustituir desde `float x01 = …` hasta `float fade = …;` por:

```glsl
    float x01 = fract(aOffset.x + uDrift / uSize.x);
    // La cámara avanza por el camino: los pétalos fluyen hacia ella en la
    // misma medida, y así se atraviesa la lluvia en vez de llevarla pegada.
    // El avance se integra en la CPU, así que es continuo aunque la velocidad
    // cambie.
    float z01 = fract(aOffset.z + uAdvance / uSize.z);

    float sway = sin(uTime * (0.6 + seed * 0.9) + seed * 31.4) * (0.25 + uStrength * 1.1);
    float bob = cos(uTime * (0.5 + seed * 0.7) + seed * 17.3) * 0.12;

    vec3 place = vec3(
      uCenter.x + (x01 - 0.5) * uSize.x + sway,
      uCenter.y + (0.5 - life) * uSize.y + bob,
      uCenter.z + (z01 - 0.5) * uSize.z + uDepthSway
    );

    // Entran y salen encogiendo por los dos motivos: porque terminan su caída,
    // y porque la densidad de la zona sube o baja con la ráfaga. Sin esto se
    // vería el salto de abajo a arriba y el estallido al empezar a soplar.
    float ciclo = smoothstep(0.0, 0.06, life) * (1.0 - smoothstep(0.88, 1.0, life));
    float presente = 1.0 - smoothstep(uDensity, uDensity + uFadeBand, aIndex);
    // El lado envuelve porque el viento tiene que poder empujar sin fin. A
    // 16:9 ese borde cae fuera de cuadro, pero en una pantalla muy ancha
    // entraría, así que también se desvanece ahí.
    float borde = smoothstep(0.0, 0.03, x01) * (1.0 - smoothstep(0.97, 1.0, x01));
    // La profundidad envuelve con el avance de la cámara, y ese borde sí está
    // siempre dentro de cuadro: por eso se desvanece en los dos extremos de
    // la caja, en vez de saltar de delante a atrás.
    float hondo = smoothstep(0.0, 0.12, z01) * (1.0 - smoothstep(0.88, 1.0, z01));
    float fade = ciclo * presente * borde * hondo;
```

(Las líneas `float sway`, `float bob` y `vec3 place` ya existían: se sustituyen, no se duplican. Ningún nombre nuevo repite uno exterior; no hay backticks.)

- [ ] **Step 3: El componente — zonas, peso y encuadre**

En `PetalSystem.tsx`:

- Imports: añadir `import { useFrame } from '@react-three/fiber';` (ya está), `type Group` de three, `import { JOURNEY } from '@/config/journey';` y `import { PATH, zoneWeight } from '@/scene/path/journeyPath';`.
- En `material`, añadir el uniform `uAdvance: { value: 0 },` junto a `uDepthSway`.
- `LayerProps` gana `zone: number;` y `PetalLayerMesh` lo recibe.
- La semilla del reparto decorrelaciona zonas con la misma cuenta: `mulberry32(layer.name.length * 977 + allocation + zone * 7919)` (y `zone` entra en las dependencias del `useMemo` de la geometría).
- En el `useFrame` de `PetalLayerMesh`, sustituir las líneas de `uDensity` y `count` por:

```tsx
    // Cuánto pesa esta zona donde está la cámara: entre dos estaciones, sus
    // lluvias se funden en vez de cortarse.
    const weight = zoneWeight(PATH.d, zone);
    // Envuelto a la profundidad de la caja: si creciera sin límite, el float
    // del shader perdería resolución en una sesión larga.
    uniforms.uAdvance!.value = PATH.advance % layer.size[2];
    uniforms.uDensity!.value = petalPresence(station, PETAL_SURGE.value, weight);

    if (mesh.current) {
      mesh.current.count = petalDrawCount(layer, station, particleScale, PETAL_SURGE.value, weight);
    }
```

- Sustituir `PetalSystem` (y su `PetalSystemProps`) por:

```tsx
/**
 * Todas las lluvias del camino. Cada estación con pétalos tiene su sistema,
 * reservado una sola vez al cargar, y dibuja sólo cuando su zona pesa algo
 * donde está la cámara: entre dos estaciones conviven dos, cada una con su
 * parte. No se monta ni se desmonta nada al viajar, así que no hay tirones de
 * compilación a mitad de camino.
 *
 * Las cajas viajan con el encuadre de la cámara (`PATH.frame`); lo que las hace
 * fluir hacia ella es `uAdvance`.
 */
export function PetalZones({ palette }: { palette: ScenePalette }) {
  const particleScale = useKyotoStore(selectParticleScale);
  const layers = petalLayers();
  const stage = useRef<Group>(null);

  useFrame(() => {
    const node = stage.current;
    if (!node) return;
    const frame = PATH.frame;
    node.position.set(frame.x, frame.y, frame.z);
    node.rotation.set(0, frame.yaw, 0);
  });

  if (particleScale <= 0) return null;

  return (
    <>
      <GustSurge />

      <group ref={stage}>
        {JOURNEY.map((station, zone) =>
          station.ambient.petalKind === 'ninguna'
            ? null
            : layers.map((layer) => {
                const allocation = petalAllocation(layer, station, particleScale);
                if (allocation <= 0) return null;

                return (
                  <PetalLayerMesh
                    key={`${station.slug}-${layer.name}-${allocation}`}
                    layer={layer}
                    station={station}
                    zone={zone}
                    palette={palette}
                    particleScale={particleScale}
                    allocation={allocation}
                  />
                );
              }),
        )}
      </group>
    </>
  );
}
```

- En la cabecera del archivo, añadir tras el párrafo de las tres capas:

```ts
 * **Con la cámara en movimiento (Fase 3A)**, las cajas viajan con ella y el
 * avance del camino, integrado en la CPU (`uAdvance`), las hace fluir hacia la
 * cámara. En profundidad envuelven, y como ese borde está siempre en cuadro,
 * se desvanecen en los dos extremos de la caja.
```

- [ ] **Step 4: `FoundationScene` y `/diagnostico` usan las zonas**

`FoundationScene.tsx`: `import { PetalZones } from '@/scene/systems/PetalSystem';` y `<PetalZones palette={palette} />` en lugar de `<PetalSystem … />`, con el comentario:

```tsx
      {/* Lo que cae del cielo en cada zona —sakura en eventos, momiji en los
          templos, hojas de bambú en la home—, fundido entre estaciones.
          Cruza por delante y por detrás del sujeto: es la capa que da la
          profundidad. */}
```

`DiagnosticsPanel.tsx`: import `petalCountsAt` (fuera `petalTotal`, `petalPresentCount`, `petalLayers` si ya no se usan) y en el muestreo:

```ts
        const counts = petalCountsAt(PATH.d, scale, surge);
```

con `petalsNow: counts.total,` y `petalsByLayer: counts.byLayer,`.

- [ ] **Step 5: Typecheck y build**

Run: `bun run typecheck && bun run build`
Expected: sin errores.

- [ ] **Step 6: Compilar el shader en WebGL2 real**

Con `bun run dev` corriendo, abrir `http://localhost:3000/es/eventos/` (sakura al 100 %) en Chrome y:
1. Leer la consola filtrando por `Shader Error|WebGLProgram`: esperado, nada.
2. Con la herramienta de JavaScript, comprobar que el programa de los pétalos compila y enlaza. El renderer de three imprime el log si falla, así que el punto 1 lo cubre; además, verificar visualmente que hay pétalos (si el programa no compila, desaparecen todos).
3. Visitar `/es/diagnostico/`: «Pétalos en el aire» > 0 en calma y sube con la ráfaga.

---

### Task 7: Scroll, tramo y llegada

**Files:**
- Create: `src/animation/useJourneyScroll.ts`
- Create: `src/components/sections/PathTramo.tsx`
- Create: `src/components/sections/ContentArrival.tsx`
- Modify: `src/components/sections/StationShell.tsx`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/styles/globals.css`
- Modify: `src/messages/es.json`, `src/messages/en.json`

**Interfaces:**
- Consumes: `SCROLL_PATH`, `resetScrollPath` (Task 4); `TRAVEL` (Task 4); `TRAMO_EASE`, `registerPresets` (presets); `getLenis`, `gsap`, `ScrollTrigger` (animation/gsap.ts); `neighbours`, `stationPath` (journey.ts); `Link`, `useRouter` (`@/i18n/navigation`).
- Produces: `useJourneyScroll({ station, tramo, enabled, onArrive })`, `<PathTramo station>`, `<ContentArrival>`.

> **Nota sobre `template.tsx`.** El spec proponía `app/[locale]/template.tsx` para el fundido del contenido. Leyendo la documentación de Next 16 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/template.md`), un template sólo se vuelve a montar cuando cambia **su** segmento hijo: entre `/lugares/fushimi-inari` y `/lugares/gion` el hijo de `[locale]` es `lugares` en los dos casos y no habría fundido. Por eso el fundido va en un componente cliente con `key={slug}` dentro de cada página (`ContentArrival`), que sí se monta de nuevo en cada estación.

- [ ] **Step 1: Textos del tramo**

En `src/messages/es.json`, tras el bloque `"home"`:

```json
  "tramo": {
    "label": "Camino hacia {station}",
    "continue": "Seguir el camino",
    "hint": "Sigue bajando: el camino continúa"
  },
```

En `src/messages/en.json`, en el mismo sitio:

```json
  "tramo": {
    "label": "Path to {station}",
    "continue": "Continue the path",
    "hint": "Keep scrolling: the path goes on"
  },
```

- [ ] **Step 2: `src/animation/useJourneyScroll.ts`**

```ts
'use client';

import { useEffect, useRef, type RefObject } from 'react';

import type { StationSlug } from '@/config/journey';
import { clamp } from '@/lib/procedural';

import { getLenis, gsap, ScrollTrigger } from './gsap';
import { resetScrollPath, SCROLL_PATH } from './journeyScroll';
import { registerPresets, TRAMO_EASE } from './presets';

/**
 * El puente entre el scroll de una página de estación y la cámara.
 *
 * Crea dos ScrollTrigger sobre la página que se está viendo: uno para el
 * contenido (de arriba hasta que el tramo asoma) y otro para el tramo (hasta
 * el final). Los dos escriben en `SCROLL_PATH`, que es todo lo que el rig de
 * cámara necesita saber del DOM. Así el scroll y la escena siguen sin llamarse
 * directamente.
 *
 * **La llegada automática.** Al terminar el tramo con scroll hacia abajo se
 * llama a `onArrive`, una sola vez por página. Y sólo si el tramo estaba
 * **armado**: si se pasó por debajo del 90 %, es que hubo recorrido de verdad.
 * Sin eso, un scroll restaurado o un cambio de tamaño que dejara la página al
 * fondo dispararía un cambio de página que nadie pidió — por ejemplo, al volver
 * con «atrás».
 *
 * Cada estación empieza arriba: al montar, el scroll vuelve a cero. «Atrás»
 * significa desandar el camino, no volver al fondo del tramo.
 */

/** A partir de aquí el tramo se da por recorrido. */
const ARRIVE_AT = 0.995;
/** Por debajo de aquí el tramo queda armado. */
const ARM_BELOW = 0.9;

function unit(value: number): number {
  return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
}

interface JourneyScrollOptions {
  station: StationSlug;
  /** La sección del tramo; `null` en la última estación, que no tiene. */
  tramo: RefObject<HTMLElement | null>;
  /** Falso con modo 静 o movimiento reducido: el scroll no mueve la cámara. */
  enabled: boolean;
  onArrive: () => void;
}

export function useJourneyScroll({ station, tramo, enabled, onArrive }: JourneyScrollOptions): void {
  const arrive = useRef(onArrive);
  useEffect(() => {
    arrive.current = onArrive;
  });

  useEffect(() => {
    resetScrollPath(station);
    getLenis()?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);

    if (!enabled) return;

    registerPresets();
    const ease = gsap.parseEase(TRAMO_EASE);
    const section = tramo.current;

    const content = ScrollTrigger.create({
      start: 0,
      // Hasta que el tramo asoma por abajo. `Math.max(1, …)` evita un rango
      // vacío cuando el contenido cabe en la pantalla.
      end: section ? () => Math.max(1, section.offsetTop - window.innerHeight) : 'max',
      onUpdate: (self) => {
        SCROLL_PATH.content = unit(self.progress);
      },
    });

    let armed = false;
    let arrived = false;

    const walk = section
      ? ScrollTrigger.create({
          trigger: section,
          start: 'top bottom',
          end: 'bottom bottom',
          onUpdate: (self) => {
            const progress = unit(self.progress);
            SCROLL_PATH.tramo = ease(progress);
            // El cartel de la siguiente estación se lee de esta variable en CSS.
            section.style.setProperty('--tramo', progress.toFixed(3));

            if (progress < ARM_BELOW) armed = true;
            if (armed && !arrived && progress >= ARRIVE_AT && self.direction === 1) {
              arrived = true;
              arrive.current();
            }
          },
        })
      : null;

    return () => {
      content.kill();
      walk?.kill();
    };
  }, [station, enabled, tramo]);
}
```

- [ ] **Step 3: `src/components/sections/PathTramo.tsx`**

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';

import { useJourneyScroll } from '@/animation/useJourneyScroll';
import { neighbours, stationPath, type StationSlug } from '@/config/journey';
import { Link, useRouter } from '@/i18n/navigation';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

/**
 * El tramo: la parte de cada página que es camino.
 *
 * Una sección de 220vh al final de la página. Su scroll lleva la cámara desde
 * esta estación hasta la siguiente (`useJourneyScroll`), y mientras tanto
 * aparece, cada vez más nítido, lo que hay al final: el kanji, el nombre y el
 * lema de la siguiente estación. Al terminarlo se llega: la URL cambia sola.
 *
 * El enlace «Seguir el camino» está siempre, y es la única forma de avanzar con
 * modo 静 o movimiento reducido: ahí no hay llegada automática, porque un
 * cambio de página provocado por el scroll sorprende a quien pidió menos
 * movimiento.
 *
 * Es DOM real, con un enlace de verdad, dentro de un `<nav>`: se llega por
 * teclado y lo leen los lectores de pantalla.
 *
 * Queda el hueco para los carteles con datos de `3/7/9/11.png`, que llegarán
 * con el contenido de cada estación.
 */
export function PathTramo({ station }: { station: StationSlug }) {
  const t = useTranslations('tramo');
  const names = useTranslations('stations');
  const router = useRouter();
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const section = useRef<HTMLElement>(null);
  const next = neighbours(station).next;

  useJourneyScroll({
    station,
    tramo: section,
    enabled: motionAllowed,
    onArrive: () => {
      if (next) router.push(stationPath(next));
    },
  });

  // La última estación no tiene tramo, pero su scroll sí mueve la cámara (el
  // avance de lectura): por eso el hook va antes de este return.
  if (!next) return null;

  const name = names(`${next.slug}.name`);

  return (
    <nav
      ref={section}
      aria-label={t('label', { station: name })}
      className="path-tramo"
      data-motion={motionAllowed ? 'on' : 'off'}
    >
      <div className="path-tramo__stage">
        <p className="path-tramo__sign kanji" style={{ color: next.palette.accent }} aria-hidden="true">
          {next.kanji}
        </p>
        <p className="path-tramo__sign mt-2 text-2xl">{name}</p>
        <p className="path-tramo__sign mt-1 max-w-prose opacity-80">{names(`${next.slug}.tagline`)}</p>

        <Link
          href={stationPath(next)}
          className="paper mt-6 inline-flex items-baseline gap-2 px-4 py-2 text-sm transition-transform duration-200 hover:-translate-y-0.5"
          style={{ borderLeft: `3px solid ${next.palette.accent}` }}
        >
          {t('continue')} → {name}
        </Link>

        {motionAllowed && <p className="brush mt-4 text-sm opacity-60">{t('hint')}</p>}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: `src/components/sections/ContentArrival.tsx`**

```tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { TRAVEL } from '@/animation/travel';

/**
 * La entrada del contenido de una estación.
 *
 * La primera página de la visita se ve tal cual llega del HTML estático: nada
 * se esconde a quien entra, ni a los buscadores, ni a quien no tiene JS. Las
 * siguientes entran con un fundido; y si la cámara viene de lejos, el
 * contenido **espera a que el viaje entre en su último tramo**, para que el
 * recorrido se vea limpio y no tapado por el texto que llega.
 *
 * Va con `key={slug}` en cada página: así se monta de nuevo en cada estación,
 * también entre dos lugares que comparten plantilla.
 */

/** Falso hasta que la primera página de la visita ha montado. */
let hydrated = false;

/** El contenido aparece cuando al viaje le queda menos de esta fracción. */
const REVEAL_AT = 0.4;
/** Por si algo se queda colgado: nunca más de esto sin contenido. */
const REVEAL_TIMEOUT = 4500;

export function ContentArrival({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'shown' | 'pending'>(() => (hydrated ? 'pending' : 'shown'));

  useEffect(() => {
    hydrated = true;
  }, []);

  useEffect(() => {
    if (state !== 'pending') return;

    const started = performance.now();
    let frames = 0;
    let raf = 0;

    const check = () => {
      frames += 1;
      // Dos frames de gracia: el viaje lo arranca el rig cuando ve la estación
      // nueva, un instante después de que esta página monte.
      const traveling = TRAVEL.span > 0 && Math.abs(TRAVEL.offset) > TRAVEL.span * REVEAL_AT;
      if (frames > 2 && (!traveling || performance.now() - started > REVEAL_TIMEOUT)) {
        setState('shown');
        return;
      }
      raf = window.requestAnimationFrame(check);
    };

    raf = window.requestAnimationFrame(check);
    return () => window.cancelAnimationFrame(raf);
  }, [state]);

  return (
    <div className="content-arrival" data-arrival={state}>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Estilos**

En `src/styles/globals.css`, dentro de `@layer components`, tras `.skip-link:focus-visible { … }`:

```css
  /* El tramo: la parte de cada página que es camino (`PathTramo`). Mientras
     se recorre, lo que hay dentro queda fijo abajo y el cartel de la
     siguiente estación gana nitidez con `--tramo`, que escribe el scroll. */
  .path-tramo {
    height: 220vh;
  }

  .path-tramo__stage {
    position: sticky;
    top: 0;
    display: flex;
    min-height: 100dvh;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding: 0 1.5rem 16vh;
    text-align: center;
  }

  .path-tramo__sign {
    opacity: clamp(0, calc((var(--tramo, 0) - 0.3) * 2.2), 1);
  }

  /* Sin movimiento no hay recorrido: el tramo se reduce a su enlace. */
  .path-tramo[data-motion='off'] {
    height: auto;
    padding-block: 12vh;
  }

  .path-tramo[data-motion='off'] .path-tramo__stage {
    position: static;
    min-height: 0;
    padding-bottom: 0;
  }

  .path-tramo[data-motion='off'] .path-tramo__sign {
    opacity: 1;
  }

  /* La entrada del contenido de una estación (`ContentArrival`). */
  .content-arrival {
    transition:
      opacity var(--dur-largo) var(--ease-washi),
      translate var(--dur-largo) var(--ease-washi);
  }

  .content-arrival[data-arrival='pending'] {
    opacity: 0;
    translate: 0 0.75rem;
  }
```

- [ ] **Step 6: Las páginas**

`StationShell.tsx`: importar `ContentArrival` y `PathTramo`, envolver el `<main>` y añadir el tramo tras él:

```tsx
      <ContentArrival key={slug}>
        <main id="contenido" className="mx-auto min-h-dvh max-w-5xl px-6 py-[18vh]">
          {/* …contenido de siempre… */}
        </main>
      </ContentArrival>

      <PathTramo station={slug} />
```

`src/app/[locale]/page.tsx`: igual, con `<ContentArrival key="inicio">` alrededor del `<main>` y `<PathTramo station="inicio" />` tras él.

- [ ] **Step 7: Typecheck, build y comprobaciones**

Run: `bun run typecheck && bun run check:path && bun run build`
Expected: sin errores y todo ✓.

- [ ] **Step 8: Recorrido en el navegador**

Con `bun run dev`, en `http://localhost:3000/es/`:
1. Bajar despacio: mientras se lee, la cámara casi no se mueve; al entrar en el tramo arranca con peso, cruza, frena; el cartel de «Ubicación 位置» aparece; al terminar, la URL pasa a `/es/ubicacion` sola y el contenido nuevo entra con fundido, sin salto de cámara.
2. Seguir hasta Gastronomía sólo con scroll.
3. Pulsar «atrás»: la cámara desanda hasta la estación anterior, el scroll está arriba y **no** se dispara ninguna llegada.
4. Desde la Home, un enlace de `StationLinks` a Gion: viaje de ~3,5 s pasando por los paisajes intermedios; el contenido espera al último tramo.
5. Entrar directo a `/es/lugares/gion/` (recarga): la cámara aparece en Gion sin viaje.

---

### Task 8: Documentación

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `CLAUDE.md`
- Modify: `src/animation/README.md`, `src/scene/camera/README.md`, `src/scene/systems/README.md`
- Modify: `docs/superpowers/specs/2026-09-29-fase-3a-el-mundo-design.md` (nota del template)

- [ ] **Step 1: `docs/PLAN.md`**

- Estado de la cabecera: «**Fase 3 en curso** — 3A (el mundo) implementada, pendiente de revisión; 3B y 3C se diseñan al llegar a ellas.»
- §5.3 El camino: añadir tras el segundo párrafo:

> **Cómo está hecho (Fase 3A).** El camino es un mundo continuo que avanza siempre hacia el fondo, con curvas laterales entre estaciones (`lateral`) y pendiente por zona (`slope`): `scene/path/journeyPath.ts`. La cámara está en *objetivo del scroll + desfase de viaje*: cada página termina en un **tramo** de 220vh cuyo scroll (curva `power2.inOut`) lleva la cámara a la siguiente estación, y al terminarlo se llega sola (`PathTramo`). Los saltos —enlaces, «atrás»— se absorben en el desfase y GSAP lo lleva a cero con la curva `piedra` (1,8 s por estación, 4 s el camino entero). El rumbo está acotado a ±15° y 12°/s, y en los viajes rápidos el encuadre recorta las curvas. El ambiente —niebla, cielo, viento, pétalos, sonido y elenco de fauna— lo decide la posición de la cámara, no la ruta.
>
> **`MotionPath` no se usa**: la curva vive en 3D y la de three da tangentes y longitudes. GSAP sigue siendo el orquestador de las transiciones y de ScrollTrigger.

- §8 Arquitectura: en el ejemplo de estación añadir `lateral` y mencionar `PATH_LENGTH`; añadir que el avance fino de la cámara vive en `PATH` (objeto de módulo) y el store sólo guarda `zone`.
- §10 Plan de fases: sustituir la fila 3 por:

| **3** | **El Camino** | Se parte en tres bloques con parada propia | ⏳ |
| **3A** | · El mundo | Sendero desde `journey.ts`, terreno continuo, piedras en todo el recorrido, cámara sobre el camino con scroll, tramo y llegada automática, viaje entre estaciones | ✅ pendiente de revisión |
| **3B** | · La fauna en el camino | Actos anclados al mundo, cercanía por estación, márgenes con la cámara real | ⏸ |
| **3C** | · La navegación | Sidebar radial (`13.png`) con íconos generados por código, progreso, móvil, teclado, transiciones | ⏸ |

- §11 Pendientes: «Slugs por idioma» → «✅ Decidido en la Fase 3: se quedan en español (el export estático no tiene middleware que reescriba). Se reconsidera en la Fase 9.»

- [ ] **Step 2: `CLAUDE.md`**

- Comandos: añadir `bun run check:path   # comprobaciones puras del camino, el terreno y la cámara`.
- Árbol de arquitectura: sustituir `useScrollScene.ts` por `journeyScroll.ts` (scroll → profundidad, puro), `useJourneyScroll.ts` (ScrollTrigger del contenido y del tramo, llegada) y `travel.ts` (desfase de viaje); añadir `scene/path/journeyPath.ts` (★ el sendero, `PATH`) y `scene/path/stones.ts`; `scene/camera/pathRig.ts` (★ encuadre sobre el camino, topes anti-mareo); `scene/systems/Atmosphere.tsx` (niebla, cielo y sol que siguen a la cámara); `objects/stoneGeometry.ts` en lugar de `objects/Stone.tsx`; `components/sections/PathTramo.tsx` y `ContentArrival.tsx`.
- «Cómo se conectan las piezas»: sustituir el primer punto por: una ruta renderiza `<ActiveStation slug>` y con eso dice **adónde ir**; la cámara viaja por el camino hasta allí (la primera vez aparece). La posición de la cámara (`PATH`) decide **qué se ve y qué se oye**: el store guarda `zone`, que leen el ambiente, el audio y la fauna.
- «Composición del cuadro»: aclarar que los números están en el **encuadre local** de la cámara (`PATH.frame`) y que la vista de cada estación es frontal porque la tangente del camino es nula en ella.
- Estado de las fases: 3 → «⏳ 3A ✅ pendiente de revisión · 3B ⏸ · 3C ⏸».
- Decisiones abiertas: quitar «Slugs por idioma» (decidido).
- Trampas: añadir sólo las que hayan aparecido de verdad durante la implementación, con el mismo formato (qué pasó, por qué, la regla). Candidata ya confirmada por la documentación: **un `template.tsx` no se vuelve a montar entre dos rutas que comparten su segmento hijo** (`/lugares/a` → `/lugares/b`), por eso el fundido del contenido va en `ContentArrival` con `key`.

- [ ] **Step 3: READMEs**

- `src/animation/README.md`: sustituir la línea de `useScrollScene.ts` por `journeyScroll.ts`, `useJourneyScroll.ts` y `travel.ts`, con una frase cada uno (qué escriben y quién lo lee).
- `src/scene/camera/README.md`: el encuadre base es local; `pathRig.ts` lo lleva al camino con los topes de rumbo (±15°, 12°/s) e inclinación (3,5°–8,7°); `CameraRig` es el único escritor de `PATH`.
- `src/scene/systems/README.md`: `elevation.ts` es global (eje del camino + colinas por zona); `Terrain.tsx` es una malla única con color por vértice; `StonePath.tsx` instancia doce formas; `Atmosphere.tsx`; `PetalSystem.tsx` exporta `PetalZones`.

- [ ] **Step 4: Nota en el spec**

En §7.3 y §11 del spec, sustituir `app/[locale]/template.tsx` por `components/sections/ContentArrival.tsx` con la frase: «(un `template.tsx` no se volvería a montar entre dos lugares: comparten el segmento `lugares`)».

---

### Task 9: Verificación final

**Files:** ninguno (sólo lectura y navegador).

- [ ] **Step 1: Comprobaciones puras, tipos y build**

Run: `bun run check:path && bun run typecheck && bun run build`
Expected: todo ✓, sin errores.

- [ ] **Step 2: Consola y shader**

Con `bun run dev`, recorrer `/es/`, `/es/eventos/`, `/es/lugares/fushimi-inari/`, `/es/lugares/gion/`, `/es/gastronomia/` y leer la consola: ni «Shader Error» ni errores de React. El canvas ocupa la ventana.

- [ ] **Step 3: Recorrido completo (Review Focus)**

1. Home → Gastronomía sólo con scroll: curvas suaves, la subida de Fushimi Inari, el paisaje transformándose; en cada llegada la URL cambia y el contenido entra sin salto de cámara.
2. «Atrás» tras una llegada automática: la cámara desanda, el scroll está arriba, **no** se dispara otra llegada.
3. Dos clics seguidos en `StationLinks` (el segundo en pleno viaje): la cámara no salta.
4. Recarga en `/es/lugares/gion/`: la cámara aparece en Gion, sin viaje, con su niebla ámbar desde el primer frame.
5. Modo 静: la cámara salta al cambiar de estación, el tramo se reduce a su enlace y no hay llegada automática; el enlace funciona.
6. Ventana a 390×844 (móvil): el tramo y el cartel se leen; el scroll táctil de Lenis mueve la cámara.
7. `/es/diagnostico/`: profundidad, zona y desfase de viaje se mueven con coherencia; FPS estables en tier alto.

- [ ] **Step 4: Parar y reportar**

Parar aquí (regla del proyecto: parada al final de cada bloque). Reportar al usuario: qué se hizo, qué se comprobó y con qué resultado, la limitación conocida de la fauna (patina con el scroll hasta 3B) y la lista de valores a calibrar en su revisión: amplitud de las colinas cerca del pasillo, largo del tramo (220vh), duración de los viajes, avance de lectura (4 u), `lateral` de cada estación, tamaño de las piedras.
