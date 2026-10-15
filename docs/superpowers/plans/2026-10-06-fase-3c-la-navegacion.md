# Fase 3C — La navegación: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendada) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** el riel de piedras de escritorio, la barra con abanico de móvil, los seis íconos calculados, el progreso del camino, el teclado, un título por estación, el cambio de idioma y el ajuste de la fauna en vertical.

**Arquitectura:** una navegación persistente (`JourneyNav`) montada en el layout de `[locale]`, que no se desmonta al cambiar de ruta. La estación actual sale de la URL. La marca de progreso no pasa por React: un callback de `gsap.ticker` lee `PATH.d` y toca el DOM. Los íconos son funciones puras que devuelven paths SVG, y sus microanimaciones van aparte, con GSAP.

**Stack:** Next 16 (export estático), React 19.2.8, next-intl 4, GSAP 3.15, Zustand 5, Tailwind 4, bun.

**Spec:** `docs/superpowers/specs/2026-10-05-fase-3c-la-navegacion-design.md`. Quien ejecute lee los dos documentos.

## Restricciones globales

- **Solo bun**: `bun run …`, `bunx …`. En este equipo no hay Node, así que nada de `npm` ni `npx`.
- **Sin dependencias nuevas.** React sigue en 19.2.8 y three en 0.185.1. Motion no entra.
- **Nada dibujado a mano**: toda la geometría de los íconos se calcula. Japón sale de Natural Earth (dominio público).
- **Nunca dos contextos WebGL vivos a la vez.**
- **`src/config/journey.ts` es la fuente única**: orden, rutas, kanji y acentos por estación. Los colores genéricos van siempre como `var(--color-…)` de `tokens.css`, sin hex en TypeScript.
- **El contenido es DOM real**: la navegación funciona sin canvas, en modo 静 y con lector de pantalla.
- **Enlaces internos con el `<Link>` de `@/i18n/navigation`** y rutas sin idioma (`stationPath(station)`).
- **Toda página bajo `[locale]` empieza con `await staticLocale(params)`.**
- Comentarios, commits y documentación **en español**; identificadores en inglés.
- **Gaze Nozarashi nunca por debajo de 1,2rem.** La navegación usa One Jinja (`--font-display`) y Zen Old Mincho (`--font-kanji`), no Gaze.
- **Los mensajes de commit terminan con** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- La consulta de móvil está **duplicada a propósito** en CSS y en TS: `(max-width: 767px), (hover: none) and (pointer: coarse)`. Si cambia en un sitio, cambia en el otro.

## Foco de revisión

Lo que el spec implica y ninguna comprobación automática cubre. Cada punto tiene su comprobación manual en la tarea que lo posee; las pruebas en el navegador las hace el usuario al final de la fase:

1. **«Atrás» con el abanico abierto:** cierra el abanico, no cambia de página, la cámara no se mueve y el historial queda como tras una navegación normal (Tarea 8).
2. **Clic en la estación en la que ya se está:** el riel o el abanico se pliegan, no hay viaje ni errores, y no se apila nada en el historial (Tareas 7 y 8).
3. **Cruzar el corte de 768 px** (redimensionar o girar) con el riel o el abanico abiertos: se cierran limpios y el scroll vuelve (Lenis arrancado, sin `nav-locked`) (Tarea 8).
4. **Solo teclado:** Tab despliega el riel, Enter viaja y pliega, Escape devuelve el foco al contenido sin un anillo de foco sobre todo el `<main>` (Tareas 5 y 7).
5. **Sin WebGL:** la marca está en la estación de la URL, no en 京都 (Tarea 7, `PATH.live`).

---

## Mapa de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/config/journey.ts` | `stationFromPathname` | 1 |
| `src/scene/path/journeyPath.ts`, `src/scene/camera/CameraRig.tsx` | `PATH.live` | 1 |
| `src/components/nav/railProgress.ts` | Geometría pura del riel, la barra y el abanico | 1 |
| `scripts/check-nav.ts`, `package.json` | Comprobaciones de la navegación (dentro de `check:path`) | 1, 3 |
| `scripts/build-geo.ts`, `assets/geo/LICENSES.md`, `.gitignore`, `package.json` | `bun run geo` | 2 |
| `src/components/nav/icons/japan.generated.ts` | Japón generado (versionado) | 2 |
| `src/lib/petalOutlines.ts`, `src/scene/objects/PetalGeometry.ts` | Contornos de pétalo sin three | 3 |
| `src/components/nav/icons/{types,svg,stone,naruto,torii,pagoda,farol,sakura,mapa,index}.ts` | Geometría de los íconos | 3 |
| `src/components/nav/icons/hover.ts`, `src/components/nav/StationIcon.tsx` | Volcado en SVG y microanimaciones | 4 |
| `src/i18n/stationMetadata.ts`, layout, páginas, `StationShell`, Home, `globals.css` | Un título por estación, `<main tabIndex={-1}>` | 5 |
| `src/components/nav/LanguageToggle.tsx`, `src/components/ui/AmbientControls.tsx`, layout, `globals.css` | ES ⇄ EN y las variantes de los mandos | 6 |
| `src/components/nav/{navQuery,navKeys,useRailProgress,RadialSidebar,JourneyNav}.ts(x)`, layout, Home, `StationShell`, `globals.css`; borra `StationLinks.tsx` | El riel de escritorio | 7 |
| `src/components/nav/MobileNav.tsx`, `JourneyNav.tsx`, `globals.css` | La barra y el abanico | 8 |
| `src/scene/systems/fauna/{behaviors,casting}.ts`, `scripts/check-fauna.ts` | Fauna en vertical | 9 |
| `CLAUDE.md`, `docs/PLAN.md` | Documentación | 10 |

---

### Tarea 1: Datos puros — de la ruta a la estación, `PATH.live` y la geometría del riel

**Archivos:**
- Crear: `scripts/check-nav.ts`
- Crear: `src/components/nav/railProgress.ts`
- Modificar: `src/config/journey.ts` (después de `stationHref`, ~línea 431)
- Modificar: `src/scene/path/journeyPath.ts:165-191` (objeto `PATH`)
- Modificar: `src/scene/camera/CameraRig.tsx:114` (tras `PATH.d = rig.d;`)
- Modificar: `package.json` (script `check:path`)

**Interfaces:**
- Produce `stationFromPathname(pathname: string): Station | null` (journey.ts).
- Produce `PATH.live: boolean` (journeyPath.ts), escrito solo por `CameraRig`.
- Produce, en `railProgress.ts`:
  - `RAIL_LAST: number` (= 6)
  - `interface RailPoint { x: number; y: number }`
  - `railPosition(d: number): number`
  - `railBend(t: number): number`
  - `railPoint(s: number, height: number, bulge: number, out: RailPoint): RailPoint`
  - `barPoint(s: number, width: number, out: RailPoint): RailPoint`
  - `fanAngle(index: number): number`
  - `fanPose(index: number, k: number, radius: number, out: RailPoint): RailPoint`

- [ ] **Paso 1: Escribir la comprobación que falla**

Crear `scripts/check-nav.ts`:

```ts
/**
 * Comprobaciones puras de la navegación (Fase 3C): de la ruta a la estación,
 * el riel y su progreso, el abanico, los íconos y sus textos. Lo que sólo se ve
 * en pantalla —el despliegue, el abanico, el viaje de la marca— es la revisión
 * visual.
 *
 * Uso: bun run check:path (corre después de check-path y check-fauna)
 */

import {
  barPoint,
  fanAngle,
  fanPose,
  RAIL_LAST,
  railPoint,
  railPosition,
} from '../src/components/nav/railProgress';
import { JOURNEY, PATH_LENGTH, stationFromPathname } from '../src/config/journey';
import messagesEn from '../src/messages/en.json';
import messagesEs from '../src/messages/es.json';
import { STATION_DEPTHS } from '../src/scene/path/journeyPath';
import { check, finish, range, section } from './check-kit';

/* ── 1. De la ruta a la estación ───────────────────────────────────────── */

section('De la ruta a la estación');

const routeMisses = JOURNEY.filter((station) => {
  const bare = station.route ? `/${station.route}` : '/';
  const slashed = station.route ? `/${station.route}/` : '/';
  return (
    stationFromPathname(bare)?.slug !== station.slug ||
    stationFromPathname(slashed)?.slug !== station.slug
  );
});
check(
  'cada ruta del camino da su estación, con y sin barra final',
  routeMisses.length === 0,
  routeMisses.map((station) => station.slug).join(', '),
);
check(
  'fuera del camino no hay estación',
  stationFromPathname('/diagnostico') === null && stationFromPathname('/tipografia/') === null,
);

/* ── 2. El riel ────────────────────────────────────────────────────────── */

section('El riel');

check('siete paradas: 京都 y las seis del sidebar', RAIL_LAST === 6 && JOURNEY.length === 7);
check(
  'en cada estación la marca está justo en su parada',
  STATION_DEPTHS.every((d, i) => Math.abs(railPosition(d) - i) < 1e-9),
);

let previousS = railPosition(-50);
let monotonic = true;
let maxStep = 0;
for (const d of range(-50, PATH_LENGTH + 50, 0.05)) {
  const s = railPosition(d);
  if (s < previousS - 1e-12) monotonic = false;
  maxStep = Math.max(maxStep, s - previousS);
  previousS = s;
}
check('la marca avanza siempre y sin saltos', monotonic && maxStep < 0.01, `paso máx ${maxStep.toFixed(4)}`);
check(
  'fuera del camino se queda en sus extremos',
  railPosition(-100) === 0 && railPosition(PATH_LENGTH + 100) === RAIL_LAST,
);

const P = { x: 0, y: 0 };
const startOnEdge = railPoint(0, 500, 40, P).x === 0 && P.y === 0;
const endOnEdge = Math.abs(railPoint(RAIL_LAST, 500, 40, P).x) < 1e-9 && Math.abs(P.y - 500) < 1e-9;
const middleOut = Math.abs(railPoint(RAIL_LAST / 2, 500, 40, P).x + 40) < 1e-9;
check(
  'el arco toca el borde en sus extremos y se separa la flecha entera en medio',
  startOnEdge && endOnEdge && middleOut,
);
check(
  'la barra móvil va de 0 a su ancho',
  barPoint(0, 170, P).x === 0 && barPoint(RAIL_LAST, 170, P).x === 170,
);

/* ── 3. El abanico ─────────────────────────────────────────────────────── */

section('El abanico');

check(
  'va de la izquierda (π) a la derecha (0)',
  Math.abs(fanAngle(1) - Math.PI) < 1e-12 && Math.abs(fanAngle(RAIL_LAST)) < 1e-12,
);
const FAN_R = Math.min(0.4 * 360, 160);
check(
  'desplegado, cada círculo está en el semicírculo, por encima del centro',
  range(1, RAIL_LAST, 1).every((i) => {
    fanPose(i, 1, FAN_R, P);
    return Math.abs(Math.hypot(P.x, P.y) - FAN_R) < 1e-9 && P.y <= 1e-9;
  }),
);
check(
  'plegado, todos en el centro',
  range(1, RAIL_LAST, 1).every((i) => {
    fanPose(i, 0, FAN_R, P);
    return Math.abs(P.x) < 1e-12 && Math.abs(P.y) < 1e-12;
  }),
);
check('en 360 px cabe con 10 px de margen (círculos de 52 px)', FAN_R + 26 <= 180 - 10, `radio ${FAN_R} px`);

/* ── 4. Los textos ─────────────────────────────────────────────────────── */

section('Los textos');

type NavMessages = {
  nav?: Record<string, string>;
  ui?: Record<string, string>;
  stations?: Record<string, { name?: string }>;
};
const missingTexts: string[] = [];
for (const [lang, messages] of [
  ['es', messagesEs],
  ['en', messagesEn],
] as [string, NavMessages][]) {
  for (const key of ['label', 'open', 'close']) {
    if (!messages.nav?.[key]) missingTexts.push(`${lang}:nav.${key}`);
  }
  for (const key of ['languageEs', 'languageEn']) {
    if (!messages.ui?.[key]) missingTexts.push(`${lang}:ui.${key}`);
  }
  for (const station of JOURNEY) {
    if (!messages.stations?.[station.slug]?.name) missingTexts.push(`${lang}:stations.${station.slug}.name`);
  }
}
check(
  'la navegación tiene sus textos en español y en inglés',
  missingTexts.length === 0,
  missingTexts.join(', '),
);

/* ── Resumen ───────────────────────────────────────────────────────────── */

finish('La navegación en orden.');
```

- [ ] **Paso 2: Ejecutarla para ver que falla**

Ejecutar: `bun run scripts/check-nav.ts`
Esperado: error de resolución de módulo (`Cannot find module '../src/components/nav/railProgress'`) o `stationFromPathname` no exportada.

- [ ] **Paso 3: Implementar `stationFromPathname`**

En `src/config/journey.ts`, justo después de `stationHref`:

```ts
/**
 * La estación de una ruta **sin idioma**, como la da el `usePathname` de
 * `@/i18n/navigation` («/lugares/gion/» → gion). Acepta la barra final del
 * export. `null` fuera del camino (`/diagnostico`, `/tipografia`). La usa la
 * navegación para marcar la estación actual ya en el HTML estático, sin
 * esperar al store (Fase 3C).
 */
export function stationFromPathname(pathname: string): Station | null {
  const route = pathname.replace(/^\/+|\/+$/g, '');
  return JOURNEY.find((station) => station.route === route) ?? null;
}
```

- [ ] **Paso 4: Implementar `PATH.live`**

En `src/scene/path/journeyPath.ts`, en el tipo de `PATH`, después de `focus: Point3;`:

```ts
  /**
   * Si `CameraRig` ya escribió algún frame. Sin canvas (sin WebGL) se queda en
   * `false`, y la navegación pone la marca en la estación de la URL en vez de
   * en la Home (Fase 3C).
   */
  live: boolean;
```

y en el valor inicial, después de `focus: { x: 0, y: 0, z: 0 },`:

```ts
  live: false,
```

En `src/scene/camera/CameraRig.tsx`, justo después de `PATH.d = rig.d;`:

```ts
      PATH.live = true;
```

- [ ] **Paso 5: Implementar `railProgress.ts`**

Crear `src/components/nav/railProgress.ts`:

```ts
/**
 * El riel de la navegación, en puro: de la profundidad del camino a una
 * posición sobre el riel, y de ahí a píxeles. Lo usan el riel de escritorio, la
 * barra móvil y el abanico (Fase 3C), y lo comprueba `scripts/check-nav.ts`.
 *
 * El riel tiene una parada por estación de `JOURNEY` —京都 y las seis del
 * sidebar—, **equiespaciadas**: en proporción a la distancia real, el primer
 * tramo (64 u de 786) dejaría los dos primeros círculos montados al
 * desplegarse. La distancia real se nota en la velocidad: la marca cruza más
 * deprisa los tramos cortos.
 */

import { lerp } from '@/lib/procedural';
import { STATION_DEPTHS } from '@/scene/path/journeyPath';

/** Índice de la última parada (京料理). La primera, 0, es 京都. */
export const RAIL_LAST = STATION_DEPTHS.length - 1;

export interface RailPoint {
  x: number;
  y: number;
}

/**
 * Posición en el riel, de 0 a `RAIL_LAST`: exactamente `i` en la profundidad
 * de la estación `i` y lineal entre dos estaciones. Fuera del camino se queda
 * en sus extremos.
 */
export function railPosition(d: number): number {
  if (d <= STATION_DEPTHS[0]!) return 0;
  for (let i = 1; i < STATION_DEPTHS.length; i += 1) {
    const from = STATION_DEPTHS[i - 1]!;
    const to = STATION_DEPTHS[i]!;
    if (d <= to) return i - 1 + (d - from) / (to - from);
  }
  return RAIL_LAST;
}

/**
 * Cuánto se separa del borde la parada en `t` (0–1), relativo a la flecha del
 * arco: 0 en los extremos y 1 en medio. Es una parábola: con flechas de 8–40 px
 * sobre 400–560 px de cuerda no se distingue de un arco de círculo.
 */
export function railBend(t: number): number {
  const u = 2 * t - 1;
  return 1 - u * u;
}

/**
 * El riel vertical de escritorio. `y` va de 0 (京都) a `height` (京料理); `x` es
 * ≤ 0 —hacia la izquierda, lejos del borde— y vale `-bulge` a media altura.
 */
export function railPoint(s: number, height: number, bulge: number, out: RailPoint): RailPoint {
  const t = s / RAIL_LAST;
  out.x = -bulge * railBend(t);
  out.y = t * height;
  return out;
}

/** La barra móvil: el mismo riel, recto y en horizontal, de 0 a `width`. */
export function barPoint(s: number, width: number, out: RailPoint): RailPoint {
  out.x = (s / RAIL_LAST) * width;
  out.y = 0;
  return out;
}

/** Ángulo final de la parada `index` (1…RAIL_LAST) en el abanico: de π (izquierda) a 0 (derecha). */
export function fanAngle(index: number): number {
  return Math.PI * (1 - (index - 1) / (RAIL_LAST - 1));
}

/**
 * El abanico móvil, desplegándose. Con `k` = 0 todo está en el centro (京都);
 * con `k` = 1, cada círculo en su sitio del semicírculo de radio `radius`. Por
 * el camino el ángulo barre desde la izquierda, así que los círculos
 * **recorren el arco** en vez de salir en línea recta. La `y` hacia arriba es
 * negativa, como en CSS. Con un *spring* `k` pasa un momento de 1: el círculo
 * se pasa un poco y vuelve.
 */
export function fanPose(index: number, k: number, radius: number, out: RailPoint): RailPoint {
  const angle = lerp(Math.PI, fanAngle(index), k);
  out.x = Math.cos(angle) * radius * k;
  out.y = -Math.sin(angle) * radius * k;
  return out;
}
```

- [ ] **Paso 6: Añadir check-nav a `check:path`**

En `package.json`:

```json
    "check:path": "bun run scripts/check-path.ts && bun run scripts/check-fauna.ts && bun run scripts/check-nav.ts"
```

- [ ] **Paso 7: Ejecutar y ver que pasa**

Ejecutar: `bun run scripts/check-nav.ts`
Esperado: todas las líneas con `✓` y `✓ La navegación en orden.`

Ejecutar: `bun run typecheck`
Esperado: sin errores.

- [ ] **Paso 8: Commit**

```powershell
git add scripts/check-nav.ts src/components/nav/railProgress.ts src/config/journey.ts src/scene/path/journeyPath.ts src/scene/camera/CameraRig.tsx package.json
git commit -m @'
Fase 3C: de la ruta a la estación, PATH.live y la geometría del riel

stationFromPathname marca la estación actual desde la URL; PATH.live
deja saber si el canvas escribe la cámara; railProgress lleva la
profundidad del camino al riel, la barra y el abanico. Nuevo
check-nav.ts dentro de check:path.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Tarea 2: Japón desde Natural Earth (`bun run geo`)

**Archivos:**
- Crear: `scripts/build-geo.ts`
- Crear: `assets/geo/LICENSES.md`
- Crear (generado, se versiona): `src/components/nav/icons/japan.generated.ts`
- Modificar: `.gitignore`
- Modificar: `package.json` (script `geo`)

**Interfaces:**
- Produce `JAPAN_ISLANDS: readonly (readonly (readonly [number, number])[])[]` y `KYOTO_POINT: readonly [number, number]`, en el viewBox −1…1 con la y hacia abajo.

- [ ] **Paso 1: Escribir el script**

Crear `scripts/build-geo.ts`:

```ts
/**
 * Japón para el ícono de Ubicación (Fase 3C), desde Natural Earth.
 *
 *   1. Descarga una vez los países a 1:50 m de Natural Earth —dominio
 *      público— en `assets/geo/source/`, que no se versiona.
 *   2. Se queda con Japón y lo recorta de Kyushu a Hokkaido: sin Ryukyu ni
 *      Ogasawara, que alejarían el resto hasta hacerlo diminuto (`13.png`
 *      tampoco los dibuja).
 *   3. Lo proyecta —equirrectangular con la longitud corregida a 37°N, que a
 *      esta escala no se distingue de una cónica— y descarta los islotes.
 *   4. Simplifica cada isla con Visvalingam hasta unos 300 vértices en total.
 *   5. Lo encaja en el viewBox −1…1 de los íconos y escribe
 *      `src/components/nav/icons/japan.generated.ts`, que sí se versiona.
 *
 * Guarda polígonos y no un path ya hecho: el mapa extruido de la Fase 5 puede
 * partir del mismo dato.
 *
 * Uso: bun run geo
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
// Como los demás scripts: `tsc` también revisa `scripts/` y no hay tipos de Bun.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'assets/geo/source/ne_50m_admin_0_countries.geojson');
const OUTPUT = join(ROOT, 'src/components/nav/icons/japan.generated.ts');

/** De Kyushu a Hokkaido, en grados. */
const BOUNDS = { lonMin: 128.5, lonMax: 146.5, latMin: 30.8, latMax: 46 };
/** Latitud de referencia de la proyección. */
const LAT_REF = 37;
const KYOTO = { lon: 135.768, lat: 35.012 };
/** Islotes por debajo de esta fracción del área de la isla mayor: fuera. */
const MIN_AREA = 0.0025;
const TARGET_VERTICES = 300;
const MIN_VERTICES = 6;
/** Hasta dónde llega el mapa dentro del viewBox −1…1. */
const EXTENT = 0.82;

type Point = [number, number];

interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

async function loadSource(): Promise<{ features: Feature[] }> {
  if (!existsSync(SOURCE)) {
    console.log(`Descargando ${SOURCE_URL}…`);
    const response = await fetch(SOURCE_URL);
    if (!response.ok) throw new Error(`Natural Earth respondió ${response.status}`);
    mkdirSync(dirname(SOURCE), { recursive: true });
    writeFileSync(SOURCE, await response.text());
  }
  return JSON.parse(readFileSync(SOURCE, 'utf8')) as { features: Feature[] };
}

/** Los anillos exteriores de un Polygon o un MultiPolygon, en [lon, lat]. */
function outerRings(geometry: Feature['geometry']): Point[][] {
  if (geometry.type === 'Polygon') return [(geometry.coordinates as Point[][])[0]!];
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as Point[][][]).map((polygon) => polygon[0]!);
  }
  throw new Error(`Geometría inesperada: ${geometry.type}`);
}

/** Equirrectangular con la longitud corregida a `LAT_REF`; la y hacia abajo, como en SVG. */
function project([lon, lat]: Point): Point {
  return [lon * Math.cos((LAT_REF * Math.PI) / 180), -lat];
}

function area(ring: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function perimeter(ring: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += Math.hypot(x2 - x1, y2 - y1);
  }
  return sum;
}

function centroid(ring: readonly Point[]): Point {
  const n = ring.length;
  return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
}

/**
 * Visvalingam–Whyatt: quita una y otra vez el vértice que forma el triángulo
 * más pequeño con sus vecinos, hasta quedarse con `keep`. A tan pocos vértices
 * conserva la silueta mucho mejor que Douglas-Peucker.
 */
function simplify(ring: readonly Point[], keep: number): Point[] {
  const points = [...ring];
  // GeoJSON cierra el anillo repitiendo el primer punto.
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (points.length > 1 && first[0] === last[0] && first[1] === last[1]) points.pop();

  const triangle = (i: number) => {
    const a = points[(i - 1 + points.length) % points.length]!;
    const b = points[i]!;
    const c = points[(i + 1) % points.length]!;
    return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  };

  while (points.length > keep) {
    let smallest = 0;
    let best = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      const size = triangle(i);
      if (size < best) {
        best = size;
        smallest = i;
      }
    }
    points.splice(smallest, 1);
  }
  return points;
}

const round = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded === 0 ? 0 : rounded;
};

const source = await loadSource();
const japan = source.features.find((feature) => feature.properties.ADM0_A3 === 'JPN');
if (!japan) throw new Error('Japón no aparece en el archivo de Natural Earth');

const rings = outerRings(japan.geometry)
  .filter((ring) => {
    const [lon, lat] = centroid(ring);
    return lon >= BOUNDS.lonMin && lon <= BOUNDS.lonMax && lat >= BOUNDS.latMin && lat <= BOUNDS.latMax;
  })
  .map((ring) => ring.map(project));

const largest = Math.max(...rings.map(area));
const islands = rings.filter((ring) => area(ring) >= largest * MIN_AREA);
const totalPerimeter = islands.reduce((sum, ring) => sum + perimeter(ring), 0);
const simplified = islands.map((ring) =>
  simplify(ring, Math.max(MIN_VERTICES, Math.round((TARGET_VERTICES * perimeter(ring)) / totalPerimeter))),
);

const xs = simplified.flat().map((p) => p[0]);
const ys = simplified.flat().map((p) => p[1]);
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);
const scale = (2 * EXTENT) / Math.max(maxX - minX, maxY - minY);
const fit = ([x, y]: Point): Point => [round((x - (minX + maxX) / 2) * scale), round((y - (minY + maxY) / 2) * scale)];

const islandsOut = simplified.map((ring) => ring.map(fit));
const kyoto = fit(project([KYOTO.lon, KYOTO.lat]));
const vertexCount = islandsOut.reduce((sum, ring) => sum + ring.length, 0);

const body = islandsOut.map((ring) => `  ${JSON.stringify(ring)},`).join('\n');
writeFileSync(
  OUTPUT,
  `// Generado por scripts/build-geo.ts (\`bun run geo\`) desde Natural Earth,
// dominio público. No editar a mano.

/** Las islas de Japón, de Kyushu a Hokkaido, en el viewBox −1…1 (y hacia abajo). */
export const JAPAN_ISLANDS: readonly (readonly (readonly [number, number])[])[] = [
${body}
];

/** Kyoto, en las mismas coordenadas. */
export const KYOTO_POINT: readonly [number, number] = ${JSON.stringify(kyoto)};
`,
);

console.log(`✓ ${islandsOut.length} islas, ${vertexCount} vértices → ${OUTPUT}`);
```

- [ ] **Paso 2: Registro del script, licencia y `.gitignore`**

En `package.json`, dentro de `scripts`, después de `"models"`:

```json
    "geo": "bun run scripts/build-geo.ts",
```

Al final de `.gitignore`:

```
# fuente de Natural Earth para el ícono de Ubicación (~3 MB): la descarga
# `bun run geo`, y lo que se versiona es icons/japan.generated.ts.
/assets/geo/source/
```

Crear `assets/geo/LICENSES.md`:

```markdown
# Datos geográficos

## Natural Earth — `ne_50m_admin_0_countries`

- **Origen:** https://www.naturalearthdata.com/ (copia en
  https://github.com/nvkelso/natural-earth-vector)
- **Licencia:** dominio público. «No permission is needed to use Natural
  Earth. Crediting the authors is unnecessary.» Se cita igual, por cortesía.
- **Uso:** la silueta de Japón del ícono de Ubicación del sidebar (Fase 3C).
  `bun run geo` descarga el archivo en `assets/geo/source/` (no se versiona) y
  escribe `src/components/nav/icons/japan.generated.ts` (sí se versiona).
```

- [ ] **Paso 3: Ejecutarlo**

Ejecutar: `bun run geo`
Esperado: `✓ N islas, ~300 vértices → …japan.generated.ts`, con N entre 4 y 12 (las cuatro islas mayores, más Sado, Awaji, Tsushima, Iki…). Si sale una sola isla o más de 20, revisar `BOUNDS` y `MIN_AREA`, y volver a ejecutar.

Ejecutar: `bun run typecheck`
Esperado: sin errores.

- [ ] **Paso 4: Commit**

```powershell
git add scripts/build-geo.ts assets/geo/LICENSES.md .gitignore package.json src/components/nav/icons/japan.generated.ts
git commit -m @'
Fase 3C: Japón desde Natural Earth (bun run geo)

Recorta Japón de Kyushu a Hokkaido, lo proyecta, descarta islotes y lo
simplifica con Visvalingam a unos 300 vértices en el viewBox de los
íconos. La fuente (dominio público) no se versiona; el resultado sí.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Tarea 3: La geometría de los íconos

**Archivos:**
- Crear: `src/lib/petalOutlines.ts`
- Modificar: `src/scene/objects/PetalGeometry.ts` (sacar los contornos)
- Crear: `src/components/nav/icons/types.ts`, `svg.ts`, `stone.ts`, `naruto.ts`, `torii.ts`, `pagoda.ts`, `farol.ts`, `sakura.ts`, `mapa.ts`, `index.ts`
- Modificar: `scripts/check-nav.ts` (sección de íconos)

**Interfaces:**
- Consume `JAPAN_ISLANDS` y `KYOTO_POINT` (Tarea 2).
- Produce en `icons/types.ts`: `IconLayer`, `IconShape`, `IconName` (= `Exclude<StationIcon, 'kanji'>`).
- Produce en `icons/svg.ts`: `Pt`, `num`, `polygon`, `polyline`, `rect`, `circle`, `ellipsePoints`, `place`, `fitter`, `pathNumbers`.
- Produce `stoneOutline(seed: number): string` (`icons/stone.ts`).
- Produce en `icons/index.ts`: `ICON_SHAPES: Readonly<Record<IconName, IconShape>>`, `ICON_BUILDERS: Readonly<Record<IconName, () => IconShape>>` e `isIconName(icon: StationIcon): icon is IconName`.
- Produce los pivotes de las microanimaciones: `NARUTO_FRONT: Pt` (naruto.ts), `LANTERN_PIVOT: Pt` (farol.ts) y `SAKURA_PIVOT: Pt` (sakura.ts).
- Produce en `lib/petalOutlines.ts`: `OutlinePoint`, `mirrorHalf`, `sakuraOutline(segments?)`, `momijiOutline`, `bambuOutline`.

**Ajuste sobre el spec:** el presupuesto de la sakura sube de 4 a **6 KB**. Repite el contorno del pétalo unas 45 veces (9 flores × 5 pétalos), y con 4 KB no le quedarían ni seis flores. El total de los seis íconos queda acotado a **18 KB**: van en línea en el HTML de cada página, en el riel y en el abanico.

- [ ] **Paso 1: Escribir las comprobaciones que fallan**

En `scripts/check-nav.ts`, añadir a los imports:

```ts
import { ICON_BUILDERS, isIconName } from '../src/components/nav/icons';
import { stoneOutline } from '../src/components/nav/icons/stone';
import { pathNumbers } from '../src/components/nav/icons/svg';
import type { IconName, IconShape } from '../src/components/nav/icons/types';
import { SIDEBAR_STATIONS } from '../src/config/journey';
```

(`SIDEBAR_STATIONS` se añade al import existente de `../src/config/journey`).

Y antes de `/* ── Resumen`:

```ts
/* ── 5. Los íconos ─────────────────────────────────────────────────────── */

section('Los íconos');

check(
  'la Home es texto (京都) y cada estación del sidebar tiene su propio ícono',
  JOURNEY[0]!.icon === 'kanji' &&
    SIDEBAR_STATIONS.every((station) => isIconName(station.icon)) &&
    new Set(SIDEBAR_STATIONS.map((station) => station.icon)).size === SIDEBAR_STATIONS.length,
);

/** Presupuesto por ícono, en caracteres de path. La sakura repite su pétalo ~45 veces. */
const ICON_BUDGET: Record<IconName, number> = {
  mapa: 6144,
  sakura: 6144,
  torii: 4096,
  pagoda: 4096,
  farol: 4096,
  naruto: 4096,
};
let iconsTotal = 0;
for (const [name, build] of Object.entries(ICON_BUILDERS) as [IconName, () => IconShape][]) {
  const shape = build();
  const text = shape.map((layer) => layer.d).join('');
  const numbers = shape.flatMap((layer) => pathNumbers(layer.d));
  const largest = Math.max(...numbers.map(Math.abs));
  iconsTotal += text.length;

  check(`${name}: tiene capas, todas con path`, shape.length > 0 && shape.every((layer) => layer.d.length > 0));
  check(
    `${name}: sin NaN y dentro del viewBox`,
    !/NaN|Infinity/.test(text) && numbers.every((n) => Number.isFinite(n)) && largest <= 1,
    `máx |${largest.toFixed(3)}|`,
  );
  check(`${name}: determinista`, JSON.stringify(build()) === JSON.stringify(shape));
  check(
    `${name}: pesa ≤ ${ICON_BUDGET[name] / 1024} KB`,
    text.length <= ICON_BUDGET[name],
    `${(text.length / 1024).toFixed(1)} KB`,
  );
  check(
    `${name}: sus colores salen de tokens.css`,
    shape.every((layer) =>
      [layer.fill, layer.stroke].every((color) => color === undefined || color.startsWith('var(--color-')),
    ),
  );
}
check('los seis juntos pesan ≤ 18 KB', iconsTotal <= 18 * 1024, `${(iconsTotal / 1024).toFixed(1)} KB`);

const stones = range(0, RAIL_LAST, 1).map((seed) => stoneOutline(seed));
check(
  'las piedrecitas del riel: cerradas, dentro del viewBox, deterministas y distintas',
  stones.every((d, seed) => d.endsWith('Z') && pathNumbers(d).every((n) => Math.abs(n) <= 1) && d === stoneOutline(seed)) &&
    new Set(stones).size === stones.length,
);
```

- [ ] **Paso 2: Ejecutarlas para ver que fallan**

Ejecutar: `bun run scripts/check-nav.ts`
Esperado: error de módulo (`Cannot find module '../src/components/nav/icons'`).

- [ ] **Paso 3: Sacar los contornos de pétalo a `lib/`**

Crear `src/lib/petalOutlines.ts` (las funciones se mueven tal cual desde `PetalGeometry.ts`; `sakuraOutline` gana el parámetro `segments`):

```ts
/**
 * Los contornos de las hojas y los pétalos, en puro: sin three.
 *
 * Los usan dos sitios: la escena, que los triangula en abanico para las
 * partículas (`scene/objects/PetalGeometry.ts`), y el ícono de Eventos del
 * sidebar, que dibuja sus flores con el mismo pétalo que cae (Fase 3C). Viven
 * fuera de `PetalGeometry` para que el ícono no meta three en el bundle de la
 * navegación, que carga en todas las páginas antes que el canvas.
 *
 * Coordenadas propias: la base de la hoja en el origen y la punta hacia +y.
 */

import { smoothstep } from '@/lib/procedural';

export interface OutlinePoint {
  x: number;
  y: number;
}

/** Cierra un contorno simétrico a partir de su mitad derecha. */
export function mirrorHalf(half: readonly OutlinePoint[]): OutlinePoint[] {
  const outline = [...half];
  for (let i = half.length - 2; i >= 1; i -= 1) {
    const point = half[i]!;
    outline.push({ x: -point.x, y: point.y });
  }
  return outline;
}

/** Vértices de media hoja en la escena. */
const SEGMENTS = 14;

/**
 * Pétalo de cerezo. La clave está en la muesca: el borde sube por los dos
 * lóbulos y **baja** al llegar al centro. Sin ese hundimiento la silueta es una
 * lágrima y podría ser cualquier cosa.
 *
 * `segments` baja la resolución sin cambiar la forma: en el ícono del sidebar,
 * a 56 px, el pétalo mide unos 3 px y se conforma con 4.
 */
export function sakuraOutline(segments = SEGMENTS): OutlinePoint[] {
  const width = 0.42;
  const notch = 0.34;

  const half: OutlinePoint[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    half.push({
      x: width * Math.sin(Math.PI * u) ** 0.55,
      y: u ** 0.9 - notch * smoothstep(0.72, 1, u),
    });
  }

  return mirrorHalf(half);
}

/**
 * Hoja de arce. Cinco lóbulos en coordenadas polares: `|cos(2.5θ)|` tiene
 * exactamente cinco máximos en una vuelta, y el exponente los afila.
 */
export function momijiOutline(): OutlinePoint[] {
  const points: OutlinePoint[] = [];
  const steps = 60;

  for (let i = 0; i < steps; i += 1) {
    // El desfase deja un lóbulo apuntando hacia arriba.
    const angle = (i / steps) * Math.PI * 2 + Math.PI / 2;
    const lobes = Math.abs(Math.cos(2.5 * (angle - Math.PI / 2)));
    const radius = 0.5 * (0.42 + 0.58 * lobes ** 0.4);
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }

  return points;
}

/** Hoja de bambú: lanceolada, larga y con una curva suave hacia un lado. */
export function bambuOutline(): OutlinePoint[] {
  const width = 0.16;
  const bend = 0.14;

  const half: OutlinePoint[] = [];
  for (let i = 0; i <= SEGMENTS; i += 1) {
    const u = i / SEGMENTS;
    half.push({ x: bend * u * u + width * Math.sin(Math.PI * u) ** 0.8, y: u });
  }

  const outline = [...half];
  for (let i = SEGMENTS - 1; i >= 1; i -= 1) {
    const u = i / SEGMENTS;
    outline.push({ x: bend * u * u - width * Math.sin(Math.PI * u) ** 0.8, y: u });
  }

  return outline;
}
```

En `src/scene/objects/PetalGeometry.ts`:
- borrar la `interface Point` (líneas 20–23), `mirrorHalf` (70–78), `SEGMENTS` (80), `sakuraOutline` (82–101), `momijiOutline` (103–120) y `bambuOutline` (122–140);
- cambiar `import { smoothstep } from '@/lib/procedural';` por:

```ts
import { bambuOutline, momijiOutline, sakuraOutline, type OutlinePoint } from '@/lib/petalOutlines';
```

- cambiar la firma de `fanFromOutline` a:

```ts
function fanFromOutline(outline: readonly OutlinePoint[], cup: number, sizeFactor: number): BufferGeometry {
```

- y añadir al final del comentario de cabecera:

```ts
 *
 * Los contornos viven en `lib/petalOutlines.ts`: el ícono de Eventos del
 * sidebar los comparte sin cargar three (Fase 3C).
```

`petalGeometry()` no cambia: sigue llamando a `sakuraOutline()` (14 segmentos por defecto), `momijiOutline()` y `bambuOutline()`.

- [ ] **Paso 4: Tipos y utilidades de SVG**

Crear `src/components/nav/icons/types.ts`:

```ts
import type { StationIcon } from '@/config/journey';

/**
 * Los íconos del sidebar (Fase 3C) son geometría calculada, no dibujos: cada
 * uno es una función pura que devuelve sus capas en el viewBox −1…1, con la y
 * hacia abajo, como el propio SVG. `StationIcon` las vuelca en un `<svg>`.
 */
export interface IconLayer {
  /** Path calculado, con 3 decimales. */
  readonly d: string;
  /** Siempre `var(--color-…)` de `tokens.css`: la paleta no se duplica en TS. */
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  /** `stroke-dasharray`, en unidades del viewBox. */
  readonly dash?: string;
  readonly opacity?: number;
  /**
   * Gancho de su microanimación: se vuelca como `data-part`. Puede llevar
   * varias palabras («lantern glow»); se buscan con `[data-part~="…"]`.
   */
  readonly part?: string;
}

export type IconShape = readonly IconLayer[];

/** Los seis íconos con dibujo. `kanji` —la Home— es texto: 京都. */
export type IconName = Exclude<StationIcon, 'kanji'>;
```

Crear `src/components/nav/icons/svg.ts`:

```ts
/**
 * Utilidades para escribir paths de SVG a partir de geometría calculada. Todo
 * en el viewBox −1…1 de los íconos, con la y hacia abajo.
 */

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Un número del path: 3 decimales y nunca «-0». */
export function num(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded === 0 ? 0 : rounded);
}

const pair = (p: Pt) => `${num(p.x)} ${num(p.y)}`;

/** Polígono cerrado. */
export function polygon(points: readonly Pt[]): string {
  return `M${points.map(pair).join('L')}Z`;
}

/** Trazo abierto. */
export function polyline(points: readonly Pt[]): string {
  return `M${points.map(pair).join('L')}`;
}

export function rect(x: number, y: number, width: number, height: number): string {
  return polygon([
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]);
}

/** Círculo como dos arcos: un path, sin `<circle>`, para tratarlo como cualquier capa. */
export function circle(cx: number, cy: number, r: number): string {
  const a = `${num(cx - r)} ${num(cy)}`;
  const b = `${num(cx + r)} ${num(cy)}`;
  return `M${a}A${num(r)} ${num(r)} 0 1 0 ${b}A${num(r)} ${num(r)} 0 1 0 ${a}Z`;
}

export function ellipsePoints(cx: number, cy: number, rx: number, ry: number, steps = 32): Pt[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * Math.PI * 2;
    return { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry };
  });
}

/** Escala, gira (radianes) y traslada, en ese orden. */
export function place(
  points: readonly Pt[],
  { x = 0, y = 0, rotate = 0, scale = 1 }: { x?: number; y?: number; rotate?: number; scale?: number },
): Pt[] {
  const cos = Math.cos(rotate);
  const sin = Math.sin(rotate);
  return points.map((p) => ({
    x: x + (p.x * cos - p.y * sin) * scale,
    y: y + (p.x * sin + p.y * cos) * scale,
  }));
}

/** Encaja un conjunto de puntos en ±`extent`, centrado y sin deformar. */
export function fitter(points: readonly Pt[], extent: number) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = (2 * extent) / Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const point = (p: Pt): Pt => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale });
  return { scale, point, points: (list: readonly Pt[]) => list.map(point) };
}

/** Todos los números de un path: para comprobar que son finitos y caben. */
export function pathNumbers(d: string): number[] {
  return (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
}
```

- [ ] **Paso 5: Las piedrecitas y los seis íconos**

Crear `src/components/nav/icons/stone.ts`:

```ts
import { mulberry32 } from '@/lib/procedural';

import { polygon, type Pt } from './svg';

/**
 * Una piedrecita del riel plegado: un contorno de 7–9 vértices con ruido en el
 * radio, algo apaisado. Es el mismo lenguaje que las piedras del camino, a
 * 10 px. Determinista: misma semilla, misma piedra.
 */
export function stoneOutline(seed: number): string {
  const random = mulberry32(seed * 7919 + 17);
  const count = 7 + Math.floor(random() * 3);
  const turn = random() * Math.PI * 2;
  const points: Pt[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = turn + ((i + (random() - 0.5) * 0.5) / count) * Math.PI * 2;
    const radius = 0.78 + random() * 0.2;
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.8 });
  }
  return polygon(points);
}
```

Crear `src/components/nav/icons/naruto.ts`:

```ts
import { polygon, polyline, type Pt } from './svg';
import type { IconShape } from './types';

/**
 * Gastronomía: dos rodajas de naruto, la de atrás desplazada. El borde
 * festoneado es `r(θ) = R + a·sin(10θ)` y el remolino, una espiral de
 * Arquímedes `r = kθ`.
 */

/** La rodaja de delante: el centro sobre el que gira su espiral. */
export const NARUTO_FRONT = { x: -0.14, y: 0.12, r: 0.52 } as const;
const NARUTO_BACK = { x: 0.24, y: -0.16, r: 0.46 } as const;

const LOBES = 10;
const EDGE_STEPS = 70;
const SPIRAL_TURNS = 3.2 * Math.PI;
const SPIRAL_STEPS = 40;

function slice(cx: number, cy: number, r: number): Pt[] {
  return Array.from({ length: EDGE_STEPS }, (_, i) => {
    const t = (i / EDGE_STEPS) * Math.PI * 2;
    const radius = r + r * 0.09 * Math.sin(LOBES * t);
    return { x: cx + Math.cos(t) * radius, y: cy + Math.sin(t) * radius };
  });
}

function spiral(cx: number, cy: number, r: number): Pt[] {
  const k = (r * 0.62) / SPIRAL_TURNS;
  return Array.from({ length: SPIRAL_STEPS + 1 }, (_, i) => {
    const t = (i / SPIRAL_STEPS) * SPIRAL_TURNS;
    return { x: cx + Math.cos(t) * k * t, y: cy + Math.sin(t) * k * t };
  });
}

export function buildNaruto(): IconShape {
  const ink = 'var(--color-sumi)';
  const paper = 'var(--color-kami)';
  const { x: bx, y: by, r: br } = NARUTO_BACK;
  const { x: fx, y: fy, r: fr } = NARUTO_FRONT;
  return [
    { d: polygon(slice(bx, by, br)), fill: paper, stroke: ink, strokeWidth: 0.07 },
    { d: polyline(spiral(bx, by, br)), stroke: ink, strokeWidth: 0.06 },
    { d: polygon(slice(fx, fy, fr)), fill: paper, stroke: ink, strokeWidth: 0.07 },
    { d: polyline(spiral(fx, fy, fr)), stroke: ink, strokeWidth: 0.06, part: 'spiral' },
  ];
}

export const NARUTO = buildNaruto();
```

Crear `src/components/nav/icons/torii.ts`:

```ts
import { polygon, rect } from './svg';
import type { IconShape } from './types';

/**
 * Fushimi Inari: un torii por proporciones —kasagi con las puntas alzadas,
 * shimaki, nuki, gakuzuka, hashira con un leve ahusado y nemaki oscuro al
 * pie— y, debajo, dos líneas de agua discontinuas.
 */
export function buildTorii(): IconShape {
  const shu = 'var(--color-shu)';
  const sumi = 'var(--color-sumi)';
  // El kasagi: arriba y abajo, curvas que dejan las puntas más altas que el centro.
  const kasagi = 'M-0.82 -0.66Q0 -0.5 0.82 -0.66L0.76 -0.54Q0 -0.4 -0.76 -0.54Z';
  const pillar = (side: 1 | -1) =>
    polygon([
      { x: side * 0.34, y: -0.44 },
      { x: side * 0.44, y: -0.44 },
      { x: side * 0.47, y: 0.46 },
      { x: side * 0.35, y: 0.46 },
    ]);
  return [
    { d: kasagi, fill: shu },
    { d: rect(-0.68, -0.48, 1.36, 0.07), fill: shu },
    { d: rect(-0.62, -0.26, 1.24, 0.08), fill: shu },
    { d: rect(-0.07, -0.42, 0.14, 0.17), fill: shu },
    { d: rect(-0.045, -0.39, 0.09, 0.1), fill: 'var(--color-kami)' },
    { d: pillar(-1), fill: shu },
    { d: pillar(1), fill: shu },
    { d: rect(-0.49, 0.4, 0.16, 0.09), fill: sumi },
    { d: rect(0.33, 0.4, 0.16, 0.09), fill: sumi },
    { d: 'M-0.74 0.62L0.74 0.62', stroke: shu, strokeWidth: 0.035, dash: '0.22 0.1', part: 'water' },
    { d: 'M-0.56 0.74L0.56 0.74', stroke: shu, strokeWidth: 0.035, dash: '0.16 0.12', part: 'water' },
  ];
}

export const TORII = buildTorii();
```

Crear `src/components/nav/icons/pagoda.ts`:

```ts
import { circle, num, rect } from './svg';
import type { IconLayer, IconShape } from './types';

/**
 * Kiyomizu-dera: tres tejados, cada uno al 78 % del anterior y con los aleros
 * curvados hacia arriba, y el sōrin —la aguja— en kohaku.
 */

const TIERS = 3;
const SHRINK = 0.78;
/** Distancia vertical entre tejados. */
const RISE = 0.34;
/** La línea del alero del tejado de abajo. */
const BASE = 0.6;

/** Un tejado: `y` es la línea del alero, `w` el medio ancho de punta a punta y `h` su alto. */
function roof(y: number, w: number, h: number): string {
  const p = (x: number, yy: number) => `${num(x)} ${num(yy)}`;
  return (
    `M${p(-0.4 * w, y - h)}L${p(0.4 * w, y - h)}` +
    `Q${p(0.58 * w, y - 0.25 * h)} ${p(w, y - 0.4 * h)}` +
    `Q${p(0.9 * w, y)} ${p(0.76 * w, y)}` +
    `L${p(-0.76 * w, y)}` +
    `Q${p(-0.9 * w, y)} ${p(-w, y - 0.4 * h)}` +
    `Q${p(-0.58 * w, y - 0.25 * h)} ${p(-0.4 * w, y - h)}Z`
  );
}

export function buildPagoda(): IconShape {
  const body = 'var(--color-shu-deep)';
  const tile = 'var(--color-shu-soft)';
  const bodies: IconLayer[] = [{ d: rect(-0.24, BASE, 0.48, 0.16), fill: body }];
  const roofs: IconLayer[] = [];

  let previousTop = BASE;
  for (let i = 0; i < TIERS; i += 1) {
    const w = 0.8 * SHRINK ** i;
    const h = 0.24 * 0.88 ** i;
    const y = BASE - i * RISE;
    // El cuerpo de este piso: del tejado de abajo a la línea de este alero.
    if (i > 0) bodies.push({ d: rect(-0.3 * w, y, 0.6 * w, previousTop - y), fill: body });
    roofs.push({ d: roof(y, w, h), fill: tile, part: 'roof' });
    previousTop = y - h;
  }

  // El sōrin: aguja, tres anillos y la joya (hōju) en lo alto.
  const top = previousTop;
  const gold = 'var(--color-kohaku)';
  const edge = 'var(--color-sumi-soft)';
  const sorin: IconLayer[] = [
    { d: rect(-0.02, top - 0.34, 0.04, 0.34), fill: edge },
    { d: rect(-0.07, top - 0.1, 0.14, 0.035), fill: gold, stroke: edge, strokeWidth: 0.015 },
    { d: rect(-0.06, top - 0.18, 0.12, 0.035), fill: gold, stroke: edge, strokeWidth: 0.015 },
    { d: rect(-0.05, top - 0.26, 0.1, 0.035), fill: gold, stroke: edge, strokeWidth: 0.015 },
    {
      d: `M0 ${num(top - 0.52)}Q0.07 ${num(top - 0.4)} 0 ${num(top - 0.34)}Q-0.07 ${num(top - 0.4)} 0 ${num(top - 0.52)}Z`,
      fill: gold,
      stroke: edge,
      strokeWidth: 0.02,
    },
    { d: circle(0, top - 0.42, 0.1), fill: 'var(--color-kami)', opacity: 0, part: 'glint' },
  ];

  return [...bodies, ...roofs, ...sorin];
}

export const PAGODA = buildPagoda();
```

Crear `src/components/nav/icons/farol.ts`:

```ts
import { circle, ellipsePoints, polygon, polyline, rect } from './svg';
import type { IconLayer, IconShape } from './types';

/**
 * Gion: un chōchin. Nueve costillas cuya anchura sigue el perfil de una
 * elipse, alternando shu y shu oscuro, con tapas, cordón y borla. Todo cuelga
 * de `LANTERN_PIVOT`, que es sobre lo que se balancea.
 */

export const LANTERN_PIVOT = { x: 0, y: -0.84 } as const;

const CY = 0.04;
const H = 0.5;
const W = 0.5;
const RIBS = 9;
const MIN_HALF = 0.2;

const halfWidth = (y: number) => Math.max(MIN_HALF, W * Math.sqrt(Math.max(0, 1 - ((y - CY) / H) ** 2)));

export function buildFarol(): IconShape {
  const top = CY - H;
  const bottom = CY + H;
  const layers: IconLayer[] = [
    {
      d: polyline([
        { x: -0.16, y: top - 0.06 },
        LANTERN_PIVOT,
        { x: 0.16, y: top - 0.06 },
      ]),
      stroke: 'var(--color-shu-deep)',
      strokeWidth: 0.03,
      part: 'lantern',
    },
  ];

  for (let i = 0; i < RIBS; i += 1) {
    const y0 = top + (i / RIBS) * 2 * H;
    const y1 = top + ((i + 1) / RIBS) * 2 * H;
    const ym = (y0 + y1) / 2;
    const [w0, wm, w1] = [halfWidth(y0), halfWidth(ym), halfWidth(y1)];
    layers.push({
      d: polygon([
        { x: -w0, y: y0 },
        { x: w0, y: y0 },
        { x: wm, y: ym },
        { x: w1, y: y1 },
        { x: -w1, y: y1 },
        { x: -wm, y: ym },
      ]),
      fill: i % 2 === 0 ? 'var(--color-shu)' : 'var(--color-shu-deep)',
      part: 'lantern',
    });
  }

  layers.push(
    { d: polygon(ellipsePoints(0, CY, W * 0.7, H * 0.7)), fill: 'var(--color-kohaku)', opacity: 0, part: 'lantern glow' },
    { d: rect(-0.22, top - 0.08, 0.44, 0.09), fill: 'var(--color-sumi)', part: 'lantern' },
    { d: rect(-0.22, bottom - 0.01, 0.44, 0.09), fill: 'var(--color-sumi)', part: 'lantern' },
    { d: rect(-0.045, bottom + 0.08, 0.09, 0.22), fill: 'var(--color-shu)', part: 'lantern' },
    { d: circle(0, bottom + 0.09, 0.05), fill: 'var(--color-shu-deep)', part: 'lantern' },
  );

  return layers;
}

export const FAROL = buildFarol();
```

Crear `src/components/nav/icons/sakura.ts`:

```ts
import { sakuraOutline } from '@/lib/petalOutlines';
import { lerp, mulberry32 } from '@/lib/procedural';

import { circle, ellipsePoints, fitter, place, polygon, type Pt } from './svg';
import type { IconShape } from './types';

/**
 * Eventos: una rama de cerezo por ramificación recursiva con semilla. El
 * tronco sube en diagonal, de abajo a la izquierda hacia arriba a la derecha;
 * dos niveles de ramas se van afinando, y las flores son cinco pétalos con el
 * **mismo contorno que cae en la escena** (`lib/petalOutlines.ts`), más
 * grueso: a 56 px el pétalo mide unos 3 px.
 */

/** Un pétalo con 4 segmentos por lado: 8 vértices, la muesca incluida. */
const PETAL = sakuraOutline(4);
const EXTENT = 0.84;

interface Layout {
  readonly twigs: Pt[][];
  readonly blossoms: Pt[][][];
  readonly centers: Pt[];
  readonly buds: Pt[][];
  readonly falling: Pt[];
  readonly base: Pt;
}

/** Una rama ahusada: un cuadrilátero que adelgaza hacia la punta. */
function twig(from: Pt, to: Pt, width: number): Pt[] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const end = width * 0.55;
  return [
    { x: from.x + (nx * width) / 2, y: from.y + (ny * width) / 2 },
    { x: to.x + (nx * end) / 2, y: to.y + (ny * end) / 2 },
    { x: to.x - (nx * end) / 2, y: to.y - (ny * end) / 2 },
    { x: from.x - (nx * width) / 2, y: from.y - (ny * width) / 2 },
  ];
}

function flower(center: Pt, size: number, turn: number): Pt[][] {
  return Array.from({ length: 5 }, (_, k) =>
    place(PETAL, { x: center.x, y: center.y, rotate: turn + (k * 2 * Math.PI) / 5, scale: size }),
  );
}

function layout(): Layout {
  const random = mulberry32(31);
  const base: Pt = { x: 0, y: 0 };
  const twigs: Pt[][] = [];
  const tips: Pt[] = [];
  const mids: Pt[] = [];

  const grow = (from: Pt, angle: number, length: number, width: number, depth: number) => {
    const to = { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
    twigs.push(twig(from, to, width));
    tips.push(to);
    if (depth === 0) {
      mids.push({ x: lerp(from.x, to.x, 0.5), y: lerp(from.y, to.y, 0.5) });
      return;
    }
    for (const [at, side] of [
      [0.38, -1],
      [0.68, 1],
    ] as const) {
      const start = { x: lerp(from.x, to.x, at), y: lerp(from.y, to.y, at) };
      grow(start, angle + side * (0.5 + random() * 0.3), length * (0.4 + random() * 0.12), width * 0.6, depth - 1);
    }
  };
  // En SVG la y va hacia abajo: «hacia arriba a la derecha» es un ángulo negativo.
  grow(base, -Math.PI / 4 - 0.08, 1, 0.05, 2);

  const blossoms: Pt[][][] = [];
  const centers: Pt[] = [];
  for (const tip of tips) {
    const spots = [tip];
    if (random() < 0.3) {
      const a = random() * Math.PI * 2;
      spots.push({ x: tip.x + Math.cos(a) * 0.13, y: tip.y + Math.sin(a) * 0.13 });
    }
    for (const spot of spots) {
      centers.push(spot);
      blossoms.push(flower(spot, 0.12 + random() * 0.03, random() * Math.PI * 2));
    }
  }

  const buds = mids.map((m) => ellipsePoints(m.x, m.y, 0.025, 0.035, 10));
  // Un pétalo suelto junto a la punta del tronco: es el que cae al pasar por encima.
  const falling = place(PETAL, { x: tips[0]!.x + 0.12, y: tips[0]!.y + 0.16, rotate: 0.6, scale: 0.12 });

  const fit = fitter([...twigs, ...blossoms.flat(), ...buds, falling].flat(), EXTENT);
  return {
    twigs: twigs.map(fit.points),
    blossoms: blossoms.map((f) => f.map(fit.points)),
    centers: centers.map(fit.point),
    buds: buds.map(fit.points),
    falling: fit.points(falling),
    base: fit.point(base),
  };
}

export function buildSakura(): IconShape {
  const { twigs, blossoms, centers, buds, falling } = layout();
  const petal = 'var(--color-sakura-pale)';
  const blush = 'var(--color-sakura)';
  return [
    { d: twigs.map(polygon).join(''), fill: 'var(--color-sumi-soft)', part: 'branch' },
    { d: buds.map(polygon).join(''), fill: blush, part: 'branch' },
    { d: blossoms.flat().map(polygon).join(''), fill: petal, stroke: blush, strokeWidth: 0.012, part: 'branch' },
    { d: centers.map((c) => circle(c.x, c.y, 0.024)).join(''), fill: blush, part: 'branch' },
    { d: polygon(falling), fill: petal, stroke: blush, strokeWidth: 0.012, part: 'falling' },
  ];
}

export const SAKURA = buildSakura();

/** El pie de la rama, ya encajado en el viewBox: el eje de su vaivén. */
export const SAKURA_PIVOT: Pt = layout().base;
```

Crear `src/components/nav/icons/mapa.ts`:

```ts
import { JAPAN_ISLANDS, KYOTO_POINT } from './japan.generated';
import { circle, polygon } from './svg';
import type { IconShape } from './types';

/**
 * Ubicación: Japón de Kyushu a Hokkaido (Natural Earth, `bun run geo`) y un
 * punto en Kyoto, del que sale una onda al pasar por encima.
 */
export function buildMapa(): IconShape {
  const [kx, ky] = KYOTO_POINT;
  return [
    { d: JAPAN_ISLANDS.map((ring) => polygon(ring.map(([x, y]) => ({ x, y })))).join(''), fill: 'var(--color-shu)' },
    { d: circle(kx, ky, 0.13), stroke: 'var(--color-sumi)', strokeWidth: 0.03, opacity: 0, part: 'ripple' },
    { d: circle(kx, ky, 0.055), fill: 'var(--color-kohaku)', stroke: 'var(--color-sumi)', strokeWidth: 0.025 },
  ];
}

export const MAPA = buildMapa();
```

Crear `src/components/nav/icons/index.ts`:

```ts
import type { StationIcon } from '@/config/journey';

import { buildFarol, FAROL } from './farol';
import { buildMapa, MAPA } from './mapa';
import { buildNaruto, NARUTO } from './naruto';
import { buildPagoda, PAGODA } from './pagoda';
import { buildSakura, SAKURA } from './sakura';
import { buildTorii, TORII } from './torii';
import type { IconName, IconShape } from './types';

/** La geometría de cada ícono, calculada una vez al importar. */
export const ICON_SHAPES: Readonly<Record<IconName, IconShape>> = {
  mapa: MAPA,
  sakura: SAKURA,
  torii: TORII,
  pagoda: PAGODA,
  farol: FAROL,
  naruto: NARUTO,
};

/** Las funciones que la producen: `check-nav.ts` las llama dos veces para comprobar el determinismo. */
export const ICON_BUILDERS: Readonly<Record<IconName, () => IconShape>> = {
  mapa: buildMapa,
  sakura: buildSakura,
  torii: buildTorii,
  pagoda: buildPagoda,
  farol: buildFarol,
  naruto: buildNaruto,
};

export function isIconName(icon: StationIcon): icon is IconName {
  return icon !== 'kanji';
}
```

- [ ] **Paso 6: Ejecutar y ajustar hasta que pase**

Ejecutar: `bun run scripts/check-nav.ts`
Esperado: todo `✓`. Si falla un presupuesto, se baja la resolución **solo de ese ícono**: en naruto, `EDGE_STEPS` y `SPIRAL_STEPS`; en sakura, `sakuraOutline(3)` o una probabilidad menor de segunda flor (`0.3`). Si algo se sale del viewBox, se reduce su `EXTENT` o las coordenadas fijas. Después se vuelve a ejecutar.

Ejecutar: `bun run check:path`
Esperado: todo `✓`. Los pétalos de la escena no cambian, porque `sakuraOutline()` sigue con 14 segmentos.

Ejecutar: `bun run typecheck`
Esperado: sin errores.

- [ ] **Paso 7: Commit**

```powershell
git add src/lib/petalOutlines.ts src/scene/objects/PetalGeometry.ts src/components/nav/icons scripts/check-nav.ts
git commit -m @'
Fase 3C: los seis íconos del sidebar, calculados

Mapa (Natural Earth), sakura (ramificación con semilla y el mismo pétalo
de la escena), torii, pagoda, farol y naruto como funciones puras que
devuelven paths en el viewBox -1..1, más las piedrecitas del riel. Los
contornos de pétalo pasan a lib/petalOutlines.ts para no meter three en
la navegación.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Tarea 4: `StationIcon` y las microanimaciones

**Archivos:**
- Crear: `src/components/nav/icons/hover.ts`
- Crear: `src/components/nav/StationIcon.tsx`

**Interfaces:**
- Consume `ICON_SHAPES`, `IconName`, `NARUTO_FRONT`, `LANTERN_PIVOT`, `SAKURA_PIVOT`, `KYOTO_POINT` (Tareas 2–3) y `registerPresets` (`@/animation/presets`).
- Produce `iconMotion(icon: IconName, svg: SVGSVGElement): IconMotion` con `interface IconMotion { enter(): void; leave(): void; kill(): void }`.
- Produce `<StationIcon icon={IconName} active={boolean} className?={string} />`: con `active` en `true` reproduce la microanimación (solo si se permite el movimiento) y con `false` la revierte.

- [ ] **Paso 1: Las microanimaciones**

Crear `src/components/nav/icons/hover.ts`:

```ts
/**
 * Las microanimaciones de los íconos, al pasar por encima o con el foco de
 * teclado (Fase 3C). Van aparte de la geometría porque necesitan GSAP y el DOM;
 * la geometría es pura y la comprueba `check-nav.ts`.
 *
 * En reposo no se anima nada: son seis círculos permanentes y no deben competir
 * con el cuadro. Con modo 静 o movimiento reducido ni se crean (`StationIcon`).
 *
 * Las partes se buscan con `[data-part~="…"]`, y los giros usan `svgOrigin`, en
 * las coordenadas del viewBox −1…1.
 */

import { gsap } from 'gsap';

import { registerPresets } from '@/animation/presets';

import { LANTERN_PIVOT } from './farol';
import { KYOTO_POINT } from './japan.generated';
import { NARUTO_FRONT } from './naruto';
import { SAKURA_PIVOT } from './sakura';
import type { IconName } from './types';

export interface IconMotion {
  enter(): void;
  leave(): void;
  kill(): void;
}

const parts = (svg: SVGSVGElement, name: string) =>
  Array.from(svg.querySelectorAll<SVGElement>(`[data-part~="${name}"]`));
const origin = (x: number, y: number) => `${x} ${y}`;

const MOTIONS: Record<IconName, (svg: SVGSVGElement) => IconMotion> = {
  // Del punto de Kyoto sale una onda que se expande y se desvanece.
  mapa: (svg) => {
    const ripple = parts(svg, 'ripple');
    gsap.set(ripple, { svgOrigin: origin(KYOTO_POINT[0], KYOTO_POINT[1]) });
    let tween: gsap.core.Tween | null = null;
    return {
      enter: () => {
        tween?.kill();
        tween = gsap.fromTo(ripple, { scale: 0.4, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 1.1, ease: 'washi' });
      },
      leave: () => {},
      kill: () => tween?.kill(),
    };
  },

  // La rama se mece sobre su pie y un pétalo se suelta y cae girando.
  sakura: (svg) => {
    const branch = parts(svg, 'branch');
    const falling = parts(svg, 'falling');
    gsap.set(branch, { svgOrigin: origin(SAKURA_PIVOT.x, SAKURA_PIVOT.y) });
    gsap.set(falling, { transformOrigin: '50% 50%' });
    let timeline: gsap.core.Timeline | null = null;
    return {
      enter: () => {
        timeline?.kill();
        timeline = gsap
          .timeline()
          .to(branch, { rotation: 3, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0)
          .fromTo(
            falling,
            { x: 0, y: 0, rotation: 0, opacity: 1 },
            { x: 0.22, y: 0.7, rotation: 160, opacity: 0, duration: 1.4, ease: 'power1.in' },
            0.15,
          );
      },
      leave: () => {
        timeline?.kill();
        gsap.to(branch, { rotation: 0, duration: 0.3, ease: 'washi' });
        gsap.to(falling, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.4, delay: 0.2, ease: 'washi' });
      },
      kill: () => {
        timeline?.kill();
        gsap.killTweensOf([...branch, ...falling]);
      },
    };
  },

  // Las líneas de agua ondulan mientras dura el hover.
  torii: (svg) => {
    const water = parts(svg, 'water');
    let tween: gsap.core.Tween | null = null;
    return {
      enter: () => {
        tween?.kill();
        tween = gsap.to(water, { attr: { 'stroke-dashoffset': '-=0.64' }, duration: 1.6, ease: 'none', repeat: -1 });
      },
      leave: () => {
        tween?.kill();
        tween = gsap.to(water, { attr: { 'stroke-dashoffset': 0 }, duration: 0.4, ease: 'washi' });
      },
      kill: () => tween?.kill(),
    };
  },

  // Los tejados se asientan de abajo arriba y destella el sōrin.
  pagoda: (svg) => {
    const roofs = parts(svg, 'roof');
    const glint = parts(svg, 'glint');
    gsap.set(glint, { transformOrigin: '50% 50%' });
    let timeline: gsap.core.Timeline | null = null;
    return {
      enter: () => {
        timeline?.kill();
        timeline = gsap
          .timeline()
          .fromTo(roofs, { y: -0.05 }, { y: 0, duration: 0.6, ease: 'spring', stagger: 0.08 }, 0)
          .fromTo(
            glint,
            { opacity: 0, scale: 0.5 },
            { opacity: 0.9, scale: 1.3, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 },
            0.2,
          );
      },
      leave: () => {},
      kill: () => timeline?.kill(),
    };
  },

  // Se balancea como un péndulo amortiguado desde el cordón y se enciende por dentro.
  farol: (svg) => {
    const lantern = parts(svg, 'lantern');
    const glow = parts(svg, 'glow');
    gsap.set(lantern, { svgOrigin: origin(LANTERN_PIVOT.x, LANTERN_PIVOT.y) });
    let timeline: gsap.core.Timeline | null = null;
    return {
      enter: () => {
        timeline?.kill();
        timeline = gsap
          .timeline()
          .to(
            lantern,
            {
              keyframes: [
                { rotation: 7, duration: 0.35, ease: 'sine.out' },
                { rotation: -4.5, duration: 0.5, ease: 'sine.inOut' },
                { rotation: 2.2, duration: 0.45, ease: 'sine.inOut' },
                { rotation: 0, duration: 0.5, ease: 'sine.inOut' },
              ],
            },
            0,
          )
          .to(glow, { opacity: 0.4, duration: 0.4, ease: 'washi' }, 0);
      },
      leave: () => {
        gsap.to(glow, { opacity: 0, duration: 0.5, ease: 'washi' });
      },
      kill: () => {
        timeline?.kill();
        gsap.killTweensOf(lantern);
      },
    };
  },

  // La espiral de la rodaja de delante gira mientras dura el hover y frena al salir.
  naruto: (svg) => {
    const spiral = parts(svg, 'spiral');
    gsap.set(spiral, { svgOrigin: origin(NARUTO_FRONT.x, NARUTO_FRONT.y) });
    let tween: gsap.core.Tween | null = null;
    return {
      enter: () => {
        tween?.kill();
        tween = gsap.to(spiral, { rotation: '+=360', duration: 2.4, ease: 'none', repeat: -1 });
      },
      leave: () => {
        tween?.kill();
        tween = gsap.to(spiral, { rotation: '+=50', duration: 0.6, ease: 'power2.out' });
      },
      kill: () => tween?.kill(),
    };
  },
};

export function iconMotion(icon: IconName, svg: SVGSVGElement): IconMotion {
  registerPresets();
  return MOTIONS[icon](svg);
}
```

- [ ] **Paso 2: El componente**

Crear `src/components/nav/StationIcon.tsx`:

```tsx
'use client';

import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';

import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { ICON_SHAPES } from './icons';
import { iconMotion, type IconMotion } from './icons/hover';
import type { IconName } from './icons/types';

/**
 * Un ícono de estación: vuelca su geometría calculada (`icons/`) en un `<svg>`
 * decorativo —el nombre accesible lo pone el enlace que lo contiene— y, con
 * `active`, reproduce su microanimación. Sin movimiento permitido (modo 静,
 * `prefers-reduced-motion`) no se crea ninguna.
 */
export function StationIcon({
  icon,
  active,
  className,
}: {
  icon: IconName;
  active: boolean;
  className?: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const motion = useRef<IconMotion | null>(null);
  const wasActive = useRef(false);
  const motionAllowed = useKyotoStore(selectMotionAllowed);

  useEffect(() => {
    const node = svg.current;
    if (!node || !motionAllowed) return;
    const created = iconMotion(icon, node);
    motion.current = created;
    return () => {
      created.kill();
      motion.current = null;
      wasActive.current = false;
      gsap.set(node.querySelectorAll('[data-part]'), { clearProps: 'all' });
    };
  }, [icon, motionAllowed]);

  useEffect(() => {
    if (active === wasActive.current) return;
    wasActive.current = active;
    if (active) motion.current?.enter();
    else motion.current?.leave();
  }, [active]);

  return (
    <svg ref={svg} viewBox="-1 -1 2 2" aria-hidden="true" focusable="false" className={className}>
      {ICON_SHAPES[icon].map((layer, i) => (
        <path
          key={i}
          d={layer.d}
          fill={layer.fill ?? 'none'}
          stroke={layer.stroke}
          strokeWidth={layer.strokeWidth}
          strokeDasharray={layer.dash}
          strokeDashoffset={layer.dash ? 0 : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={layer.opacity}
          data-part={layer.part}
        />
      ))}
    </svg>
  );
}
```

- [ ] **Paso 3: Verificar**

Ejecutar: `bun run typecheck`
Esperado: sin errores. (Con `import { gsap } from 'gsap'`, los tipos `gsap.core.Tween` y `gsap.core.Timeline` ya están disponibles; no hace falta otro import).

Ejecutar: `bun run check:path`
Esperado: todo `✓`.

- [ ] **Paso 4: Commit**

```powershell
git add src/components/nav/icons/hover.ts src/components/nav/StationIcon.tsx
git commit -m @'
Fase 3C: StationIcon y las microanimaciones de los íconos

Onda en Kyoto, rama que se mece y suelta un pétalo, agua que ondula
bajo el torii, tejados que se asientan, farol que se balancea y se
enciende, espiral del naruto que gira. Sólo al pasar por encima o con
foco, y nunca con modo 静 o movimiento reducido.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Tarea 5: Un título por estación y `<main>` enfocable

**Archivos:**
- Crear: `src/i18n/stationMetadata.ts`
- Modificar: `src/app/[locale]/layout.tsx:26-34` (`generateMetadata`)
- Modificar: `src/app/[locale]/ubicacion/page.tsx`, `eventos/page.tsx`, `gastronomia/page.tsx`, `lugares/[slug]/page.tsx`
- Modificar: `src/components/sections/StationShell.tsx:32` y `src/app/[locale]/page.tsx:30` (`tabIndex={-1}`)
- Modificar: `src/styles/globals.css` (`main[tabindex='-1']:focus`)

**Interfaces:**
- Produce `stationMetadata(params: Promise<{ locale: string }>, slug: StationSlug): Promise<Metadata>`.
- Produce `<main id="contenido" tabIndex={-1}>`: Escape del riel (Tarea 7) le devuelve el foco.

- [ ] **Paso 1: El ayudante**

Crear `src/i18n/stationMetadata.ts`:

```ts
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { StationSlug } from '@/config/journey';

import { staticLocale } from './params';

/**
 * El título de una estación: «Ubicación · Kyoto». La plantilla `%s · Kyoto` la
 * pone el layout de `[locale]`.
 *
 * No es sólo SEO: el anunciador de rutas de Next lee el `<title>` para decirle
 * al lector de pantalla que la página cambió, y con un título compartido entre
 * estaciones no anunciaba nada (Fase 3C).
 */
export async function stationMetadata(
  params: Promise<{ locale: string }>,
  slug: StationSlug,
): Promise<Metadata> {
  const locale = await staticLocale(params);
  const t = await getTranslations({ locale, namespace: 'stations' });
  return { title: t(`${slug}.name`) };
}
```

- [ ] **Paso 2: La plantilla en el layout**

En `src/app/[locale]/layout.tsx`, `generateMetadata` devuelve:

```ts
  return {
    // Cada estación pone su nombre y la plantilla añade el sitio: «Ubicación ·
    // Kyoto». La Home comparte segmento con este layout, así que la plantilla
    // no le aplica y se queda con el título completo (Fase 3C).
    title: { template: '%s · Kyoto', default: t('title') },
    description: t('description'),
  };
```

- [ ] **Paso 3: `generateMetadata` en cada página de estación**

`src/app/[locale]/ubicacion/page.tsx` completo:

```tsx
import type { Metadata } from 'next';

import { StationShell } from '@/components/sections/StationShell';
import { staticLocale } from '@/i18n/params';
import { stationMetadata } from '@/i18n/stationMetadata';

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return stationMetadata(params, 'ubicacion');
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await staticLocale(params);

  return <StationShell slug="ubicacion" locale={locale} />;
}
```

`src/app/[locale]/eventos/page.tsx` completo:

```tsx
import type { Metadata } from 'next';

import { StationShell } from '@/components/sections/StationShell';
import { staticLocale } from '@/i18n/params';
import { stationMetadata } from '@/i18n/stationMetadata';

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return stationMetadata(params, 'eventos');
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await staticLocale(params);

  return <StationShell slug="eventos" locale={locale} />;
}
```

`src/app/[locale]/gastronomia/page.tsx` completo:

```tsx
import type { Metadata } from 'next';

import { StationShell } from '@/components/sections/StationShell';
import { staticLocale } from '@/i18n/params';
import { stationMetadata } from '@/i18n/stationMetadata';

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return stationMetadata(params, 'gastronomia');
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await staticLocale(params);

  return <StationShell slug="gastronomia" locale={locale} />;
}
```

En `src/app/[locale]/lugares/[slug]/page.tsx`, añadir:

```tsx
import type { Metadata } from 'next';

import { stationMetadata } from '@/i18n/stationMetadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return isStationSlug(slug) ? stationMetadata(params, slug) : {};
}
```

(`isStationSlug` ya está importado en ese archivo).

- [ ] **Paso 4: `<main>` enfocable**

En `src/components/sections/StationShell.tsx` y en `src/app/[locale]/page.tsx`, el `<main id="contenido" …>` gana `tabIndex={-1}`:

```tsx
        <main id="contenido" tabIndex={-1} className="mx-auto min-h-dvh max-w-5xl px-6 py-[18vh]">
```

(en la Home, con su propio `className`: `max-w-6xl … py-[14vh]`).

En `src/styles/globals.css`, dentro de `@layer base`, después de la regla de `:focus-visible`:

```css
  /* El contenido recibe el foco por programa —el «saltar al contenido», el
     Escape del riel—, pero no es un control: sin anillo alrededor de toda la
     página. */
  main[tabindex='-1']:focus {
    outline: none;
  }
```

- [ ] **Paso 5: Verificar en el export**

Ejecutar: `bun run typecheck`
Esperado: sin errores.

Ejecutar: `bun run build`
Esperado: termina sin errores.

Ejecutar:

```powershell
bun -e "for (const p of ['out/es/index.html','out/es/ubicacion/index.html','out/en/lugares/gion/index.html','out/es/lugares/fushimi-inari/index.html']) { const h = await Bun.file(p).text(); console.log(p, '→', h.match(/<title>[^<]*<\/title>/)?.[0]); }"
```

Esperado:

```
out/es/index.html → <title>Kyoto — 京都</title>
out/es/ubicacion/index.html → <title>Ubicación · Kyoto</title>
out/en/lugares/gion/index.html → <title>Gion · Kyoto</title>
out/es/lugares/fushimi-inari/index.html → <title>Fushimi Inari Taisha · Kyoto</title>
```

- [ ] **Paso 6: Commit**

```powershell
git add src/i18n/stationMetadata.ts "src/app/[locale]" src/components/sections/StationShell.tsx src/styles/globals.css
git commit -m @'
Fase 3C: un título por estación y el contenido enfocable

«Ubicación · Kyoto»: el anunciador de rutas de Next lee el título, y con
uno compartido no avisaba del cambio de página al lector de pantalla.
<main> acepta foco por programa para el Escape del riel y el «saltar al
contenido».

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Tarea 6: ES ⇄ EN y las variantes de los mandos

**Archivos:**
- Crear: `src/components/nav/LanguageToggle.tsx`
- Modificar: `src/components/ui/AmbientControls.tsx` (completo)
- Modificar: `src/app/[locale]/layout.tsx` (`<AmbientControls variant="corner" />`)
- Modificar: `src/styles/globals.css` (`.nav-latin`)

**Interfaces:**
- Produce `<LanguageToggle className?={string} />`.
- Produce `<AmbientControls variant={'corner' | 'bar'} />`. La variante `corner` lleva la clase `ambient-corner` (la Tarea 7 la oculta en móvil); `bar` es un `div` sin posición, para dentro de la barra móvil (Tarea 8).

- [ ] **Paso 1: El botón de idioma**

Crear `src/components/nav/LanguageToggle.tsx`:

```tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';

import { LOCALES } from '@/config/journey';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * ES ⇄ EN. Lleva a la misma estación en el otro idioma: los slugs son iguales
 * en los dos (decidido en la Fase 3), así que la ruta no se traduce. Cambiar
 * de idioma monta de nuevo el layout de `[locale]` —y con él la escena—: se
 * aterriza en la misma estación, sin viaje.
 *
 * Se etiqueta en su propio idioma («English», `lang="en"`), como piden las
 * pautas de accesibilidad: quien no lee el idioma actual tiene que poder
 * encontrar el suyo.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('ui');
  const other = LOCALES.find((candidate) => candidate !== locale) ?? locale;
  const label = other === 'es' ? t('languageEs') : t('languageEn');

  return (
    <Link
      href={pathname}
      locale={other}
      hrefLang={other}
      lang={other}
      aria-label={label}
      title={label}
      className={className}
    >
      <span className="nav-latin" aria-hidden="true">
        {other.toUpperCase()}
      </span>
    </Link>
  );
}
```

- [ ] **Paso 2: Los mandos, con tres botones y dos variantes**

Reemplazar `src/components/ui/AmbientControls.tsx` completo:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { LanguageToggle } from '@/components/nav/LanguageToggle';
import { selectAudioAudible, useKyotoStore } from '@/store/useKyotoStore';

/** El botón redondo de papel de los tres mandos. */
const BUTTON =
  'paper pointer-events-auto relative grid h-11 w-11 place-items-center rounded-full transition-[opacity,transform] duration-200 hover:-translate-y-0.5';

/**
 * Los tres mandos: el sonido, el modo 静 y el idioma.
 *
 * Discretos a propósito —tres glifos—, pero **siempre visibles**: el PLAN exige
 * que no haya sonido sin un mando a la vista, y que el modo quieto esté al
 * alcance sin entrar en ningún menú.
 *
 * Dos variantes, que se renderizan las dos y el CSS decide cuál se ve
 * (Fase 3C): `corner`, en la esquina inferior derecha del escritorio, y `bar`,
 * dentro de la barra de la navegación móvil (`MobileNav`).
 *
 * Los iconos de sonido y quietud son los propios kanji, 音 y 静, que ya viajan
 * en la fuente subseteada. Es DOM real, con botones de verdad: se llega por
 * teclado, se anuncia su estado con `aria-pressed` y funciona igual con el
 * canvas apagado.
 */
export function AmbientControls({ variant }: { variant: 'corner' | 'bar' }) {
  const t = useTranslations('ui');

  // El store se rehidrata en un efecto; hasta entonces no se pinta el estado
  // para que el HTML estático y el primer render del cliente coincidan.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const audioEnabled = useKyotoStore((s) => s.audioEnabled);
  const setAudioEnabled = useKyotoStore((s) => s.setAudioEnabled);
  const audible = useKyotoStore(selectAudioAudible);
  const stillMode = useKyotoStore((s) => s.stillMode);
  const setStillMode = useKyotoStore((s) => s.setStillMode);

  if (!mounted) return null;

  const buttons = (
    <>
      <button
        type="button"
        onClick={() => setAudioEnabled(!audioEnabled)}
        aria-pressed={audioEnabled}
        aria-label={audioEnabled ? t('audioOff') : t('audioOn')}
        title={`${t('audio')} — ${audible ? t('audioOff') : t('audioOn')}`}
        className={BUTTON}
        style={{ opacity: audioEnabled ? 1 : 0.55 }}
      >
        <span className="kanji text-[1.2rem] leading-none" aria-hidden="true">
          音
        </span>
        {/* Tachado cuando está apagado: el estado tiene que verse, no sólo
            leerse con un lector de pantalla. */}
        {!audioEnabled && (
          <span
            aria-hidden="true"
            className="absolute h-[1.6rem] w-px rotate-45 bg-[color:var(--color-sumi)] opacity-70"
          />
        )}
      </button>

      <button
        type="button"
        onClick={() => setStillMode(!stillMode)}
        aria-pressed={stillMode}
        aria-label={t('stillMode')}
        title={`${t('stillMode')} — ${t('stillModeHint')}`}
        className={BUTTON}
        style={{
          opacity: stillMode ? 1 : 0.55,
          background: stillMode ? 'var(--color-sumi)' : undefined,
          color: stillMode ? 'var(--color-washi)' : undefined,
        }}
      >
        <span className="kanji text-[1.2rem] leading-none" aria-hidden="true">
          静
        </span>
      </button>

      <LanguageToggle className={BUTTON} />
    </>
  );

  if (variant === 'bar') return <div className="flex shrink-0 gap-1.5">{buttons}</div>;

  return (
    // El canvas vive detrás de todo el DOM; esta isla sí recibe el puntero,
    // pero sólo ella.
    <div className="ambient-corner pointer-events-none fixed right-4 bottom-4 z-40 flex gap-2">{buttons}</div>
  );
}
```

- [ ] **Paso 3: Layout y estilo**

En `src/app/[locale]/layout.tsx`, `<AmbientControls />` pasa a `<AmbientControls variant="corner" />` y su comentario a `{/* Los tres mandos —sonido, 静 e idioma— en la esquina del escritorio. */}`.

En `src/styles/globals.css`, dentro de `@layer components`, después de `.brush`:

```css
  /* Texto latino corto de la navegación (ES/EN): en la letra de titulares,
     no en la de pincel, que por debajo de 1,2rem no se lee. */
  .nav-latin {
    font-family: var(--font-display);
    font-size: 0.95rem;
    line-height: 1;
    letter-spacing: 0.06em;
  }
```

- [ ] **Paso 4: Verificar**

Ejecutar: `bun run typecheck` y después `bun run build`
Esperado: sin errores.

- [ ] **Paso 5: Commit**

```powershell
git add src/components/nav/LanguageToggle.tsx src/components/ui/AmbientControls.tsx "src/app/[locale]/layout.tsx" src/styles/globals.css
git commit -m @'
Fase 3C: ES ⇄ EN junto a 音 y 静

Un tercer mando lleva a la misma estación en el otro idioma, etiquetado
en su propio idioma. AmbientControls gana dos variantes: la esquina del
escritorio y la barra móvil.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Tarea 7: El riel de escritorio

**Archivos:**
- Crear: `src/components/nav/navQuery.ts`, `navKeys.ts`, `useRailProgress.ts`, `RadialSidebar.tsx`, `JourneyNav.tsx`
- Modificar: `src/app/[locale]/layout.tsx` (montar `<JourneyNav />` antes de `{children}`)
- Modificar: `src/app/[locale]/page.tsx` y `src/components/sections/StationShell.tsx` (quitar `StationLinks`)
- Borrar: `src/components/nav/StationLinks.tsx`
- Modificar: `src/styles/globals.css` (riel, tarjetas `derecha`, ocultar en móvil)

**Interfaces:**
- Consume `railPosition`, `railPoint`, `railBend`, `RAIL_LAST`, `RailPoint` (Tarea 1), `stoneOutline`, `isIconName` (Tarea 3), `StationIcon` (Tarea 4), `stationFromPathname`, `PATH.live` (Tarea 1) y `#contenido` enfocable (Tarea 5).
- Produce:
  - `NAV_MOBILE_QUERY: string` y `useNavLayout(): 'mobile' | 'desktop' | null` (navQuery.ts);
  - `moveFocus(key: string, links: readonly HTMLElement[]): boolean` (navKeys.ts);
  - `useRailProgress(options: { marker: RefObject<HTMLElement | null>; stops: RefObject<HTMLElement[]>; place: (s: number, out: RailPoint) => void; current: StationSlug | null; enabled: boolean }): void`;
  - `<RadialSidebar current={StationSlug | null} active={boolean} />`;
  - `<JourneyNav />`.

- [ ] **Paso 1: La consulta de móvil y las teclas**

Crear `src/components/nav/navQuery.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';

/**
 * Cuándo manda la navegación móvil: pantallas estrechas **y** cualquier
 * pantalla táctil sin hover —un iPad en horizontal—, porque el riel se
 * despliega al acercar el cursor al borde y con el dedo eso no existe.
 *
 * El mismo corte vive en `globals.css` (`.rail`, `.mnav`, `.ambient-corner`):
 * si cambia aquí, cambia allí.
 */
export const NAV_MOBILE_QUERY = '(max-width: 767px), (hover: none) and (pointer: coarse)';

/**
 * Qué navegación está a la vista. `null` antes de montar: el HTML estático
 * trae las dos y el CSS elige, así que nada salta al hidratar.
 */
export function useNavLayout(): 'mobile' | 'desktop' | null {
  const [layout, setLayout] = useState<'mobile' | 'desktop' | null>(null);

  useEffect(() => {
    const query = window.matchMedia(NAV_MOBILE_QUERY);
    const sync = () => setLayout(query.matches ? 'mobile' : 'desktop');
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return layout;
}
```

Crear `src/components/nav/navKeys.ts`:

```ts
/**
 * Flechas, Inicio y Fin dentro de una lista de enlaces de navegación (el riel o
 * el abanico), sin dar la vuelta al llegar al final. Devuelve `true` si la
 * tecla era suya: quien llama hace entonces `preventDefault`, para que la
 * flecha no camine además el tramo. Fuera de la navegación las flechas siguen
 * siendo del scroll.
 *
 * Las cuatro flechas valen en los dos: en el riel se lee de arriba abajo y en
 * el abanico de izquierda a derecha, y el orden del DOM es el del camino.
 */
export function moveFocus(key: string, links: readonly HTMLElement[]): boolean {
  const index = links.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return false;

  const last = links.length - 1;
  let target = -1;
  if (key === 'ArrowDown' || key === 'ArrowRight') target = Math.min(last, index + 1);
  else if (key === 'ArrowUp' || key === 'ArrowLeft') target = Math.max(0, index - 1);
  else if (key === 'Home') target = 0;
  else if (key === 'End') target = last;
  if (target < 0) return false;

  links[target]?.focus();
  return true;
}
```

- [ ] **Paso 2: La marca al ritmo de la cámara**

Crear `src/components/nav/useRailProgress.ts`:

```ts
'use client';

import { gsap } from 'gsap';
import { useEffect, useRef, type RefObject } from 'react';

import type { StationSlug } from '@/config/journey';
import { PATH, STATION_DEPTHS, stationIndex } from '@/scene/path/journeyPath';

import { railPosition, type RailPoint } from './railProgress';

/**
 * La marca «tú» y las piedras recorridas, al ritmo de la cámara.
 *
 * Cambia sesenta veces por segundo, así que no pasa por React ni por el store:
 * un callback de `gsap.ticker` —el reloj de Lenis— lee `PATH.d`, lo convierte
 * en posición de riel y toca el DOM sólo si algo cambió. Es la regla de `WIND`
 * y `PARALLAX`. En un salto la marca recorre el riel con la curva `piedra` del
 * viaje sin una línea de código: lee lo mismo que la cámara.
 *
 * Sin canvas (`PATH.live` falso, sin WebGL) la marca se queda en la estación
 * de la URL en vez de en la Home.
 *
 * Antes de arrancar, la marca se coloca por CSS con `--s0` (la estación del
 * HTML estático). Al arrancar se le pone `data-live` y desde entonces la
 * coloca sólo su `transform`.
 */
export function useRailProgress({
  marker,
  stops,
  place,
  current,
  enabled,
}: {
  marker: RefObject<HTMLElement | null>;
  stops: RefObject<HTMLElement[]>;
  place: (s: number, out: RailPoint) => void;
  current: StationSlug | null;
  enabled: boolean;
}): void {
  const fallback = useRef(0);

  useEffect(() => {
    fallback.current = current ? STATION_DEPTHS[stationIndex(current)]! : 0;
  }, [current]);

  useEffect(() => {
    const node = marker.current;
    if (!enabled || !node) return;

    const point = { x: 0, y: 0 };
    let lastX = Number.NaN;
    let lastY = Number.NaN;
    let lastWalked = -1;

    const tick = () => {
      const s = railPosition(PATH.live ? PATH.d : fallback.current);
      place(s, point);
      if (!(Math.abs(point.x - lastX) < 0.05 && Math.abs(point.y - lastY) < 0.05)) {
        node.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
        lastX = point.x;
        lastY = point.y;
      }
      const walked = Math.floor(s + 1e-6);
      if (walked !== lastWalked) {
        stops.current.forEach((stop, i) => stop.toggleAttribute('data-walked', i <= walked));
        lastWalked = walked;
      }
    };

    node.setAttribute('data-live', '');
    tick();
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      node.removeAttribute('data-live');
      node.style.transform = '';
    };
  }, [enabled, marker, stops, place]);
}
```

- [ ] **Paso 3: El riel**

Crear `src/components/nav/RadialSidebar.tsx`:

```tsx
'use client';

import { gsap } from 'gsap';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';

import { motionDurations, registerPresets } from '@/animation/presets';
import { JOURNEY, stationPath, type StationSlug } from '@/config/journey';
import { Link } from '@/i18n/navigation';
import { stationIndex } from '@/scene/path/journeyPath';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { isIconName } from './icons';
import { stoneOutline } from './icons/stone';
import { moveFocus } from './navKeys';
import { RAIL_LAST, railBend, railPoint, type RailPoint } from './railProgress';
import { StationIcon } from './StationIcon';
import { useRailProgress } from './useRailProgress';

/** A cuántos px del borde derecho el cursor despliega el riel. */
const EDGE_ZONE = 96;
/** Lo que espera el riel antes de plegarse cuando el cursor se va, en ms. */
const FOLD_DELAY = 350;
/** Flecha del arco, plegado y desplegado, en px. */
const BULGE_FOLDED = 8;
const BULGE_OPEN = 40;
/** Escala de un círculo plegado: una piedrecita de ~11 px sobre 56. */
const FOLDED_SCALE = 0.2;

const STONES = JOURNEY.map((_, i) => stoneOutline(i));

/**
 * El riel de escritorio (Fase 3C): siete paradas —京都 y las seis estaciones
 * de `13.png`— sobre un arco pegado al borde derecho.
 *
 * Plegado es un camino de piedrecitas con la marca «tú». Se despliega al
 * acercar el cursor al borde, al pasar por encima o con el foco **de
 * teclado**: el arco se curva y cada piedra crece hasta su círculo, en una
 * onda que sale de la estación actual. Las piedras son los propios enlaces:
 * plegar y desplegar sólo cambia su tamaño.
 *
 * Al hacer clic se pliega al instante, para que el viaje se vea limpio, y la
 * marca recorre el riel al ritmo de la cámara (`useRailProgress`). Cada zona
 * por la que pasa la cámara hace destellar su piedra, y la de destino se
 * asienta al llegar.
 */
export function RadialSidebar({ current, active }: { current: StationSlug | null; active: boolean }) {
  const t = useTranslations('nav');
  const names = useTranslations('stations');
  const motionAllowed = useKyotoStore(selectMotionAllowed);

  const root = useRef<HTMLElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const line = useRef<SVGPathElement>(null);
  const stops = useRef<HTMLElement[]>([]);
  const geometry = useRef({ height: 0, bulge: BULGE_FOLDED });
  const timeline = useRef<gsap.core.Timeline | null>(null);

  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const openRef = useRef(false);
  const currentRef = useRef(current);
  const pointerNear = useRef(false);
  const keyboardInside = useRef(false);
  const suppressed = useRef(false);
  const foldTimer = useRef(0);

  const currentIndex = current ? stationIndex(current) : 0;

  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const place = useCallback(
    (s: number, out: RailPoint) => railPoint(s, geometry.current.height, geometry.current.bulge, out),
    [],
  );
  useRailProgress({ marker, stops, place, current, enabled: active });

  const applyBulge = useCallback(() => {
    root.current?.style.setProperty('--bulge', `${geometry.current.bulge}px`);
  }, []);

  /** Decide si el riel tiene que estar abierto. Plegarse espera un poco; abrirse no. */
  const evaluate = useCallback(() => {
    window.clearTimeout(foldTimer.current);
    if (suppressed.current) {
      setOpen(false);
      return;
    }
    if (pointerNear.current || keyboardInside.current) {
      setOpen(true);
      return;
    }
    foldTimer.current = window.setTimeout(() => setOpen(false), FOLD_DELAY);
  }, []);

  // Alto del riel y la línea de pisadas (plegada: con el riel abierto se oculta).
  useEffect(() => {
    const nav = root.current;
    if (!nav || !active) return;
    const point = { x: 0, y: 0 };
    const measure = () => {
      geometry.current.height = nav.clientHeight;
      let d = '';
      for (let s = 0; s <= RAIL_LAST + 1e-9; s += 0.125) {
        railPoint(s, geometry.current.height, BULGE_FOLDED, point);
        d += `${d ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      }
      line.current?.setAttribute('d', d);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [active]);

  // La timeline del despliegue. Se rehace al cambiar de estación (la onda sale
  // de la actual) o de modo de movimiento.
  useEffect(() => {
    const nav = root.current;
    if (!nav || !active) return;
    registerPresets();
    const { medio, rapido } = motionDurations();
    const circles = nav.querySelectorAll('.rail__circle');
    const stones = nav.querySelectorAll('.rail__stone');
    const faces = nav.querySelectorAll('.rail__face');
    const home = nav.querySelector('.rail__home');
    const lineNode = line.current;

    gsap.set(circles, { scale: FOLDED_SCALE });
    gsap.set(faces, { opacity: 0 });
    const tl = gsap.timeline({ paused: true });
    if (motionAllowed) {
      tl.to(geometry.current, { bulge: BULGE_OPEN, duration: medio, ease: 'washi', onUpdate: applyBulge }, 0)
        .to(
          circles,
          { scale: 1, duration: medio, ease: 'spring', stagger: { each: 0.04, from: Math.max(0, currentIndex - 1) } },
          0,
        )
        .to(stones, { opacity: 0, duration: rapido }, 0)
        .to(faces, { opacity: 1, duration: rapido }, 0.12)
        .to(home, { scale: 1.35, duration: medio, ease: 'spring' }, 0)
        .to(lineNode, { opacity: 0, duration: rapido }, 0);
    } else {
      // Sin movimiento: un fundido, sin spring, sin onda y sin curvarse.
      tl.to(circles, { scale: 1, duration: 0.001 }, 0)
        .to(stones, { opacity: 0, duration: 0.15 }, 0)
        .to(faces, { opacity: 1, duration: 0.15 }, 0)
        .to(lineNode, { opacity: 0, duration: 0.15 }, 0);
    }
    if (openRef.current) tl.progress(1);
    timeline.current = tl;

    return () => {
      tl.kill();
      timeline.current = null;
      geometry.current.bulge = BULGE_FOLDED;
      applyBulge();
      gsap.set([...circles, ...stones, ...faces, home, lineNode].filter(Boolean), { clearProps: 'all' });
    };
  }, [active, motionAllowed, currentIndex, applyBulge]);

  useEffect(() => {
    const tl = timeline.current;
    if (!tl) return;
    const { medio, rapido } = motionDurations();
    if (open) tl.timeScale(1).play();
    else tl.timeScale(motionAllowed ? medio / rapido : 1).reverse();
  }, [open, motionAllowed]);

  // El cursor cerca del borde.
  useEffect(() => {
    if (!active) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const inside = event.target instanceof Node && Boolean(root.current?.contains(event.target));
      const near = inside || event.clientX >= window.innerWidth - EDGE_ZONE;
      // Tras un clic el riel se queda plegado hasta que el cursor se va.
      if (!near) suppressed.current = false;
      if (near !== pointerNear.current) {
        pointerNear.current = near;
        evaluate();
      }
    };
    const onLeave = () => {
      pointerNear.current = false;
      suppressed.current = false;
      evaluate();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.clearTimeout(foldTimer.current);
      pointerNear.current = false;
      setOpen(false);
    };
  }, [active, evaluate]);

  // Pulso *spring* del círculo bajo el cursor o el foco.
  useEffect(() => {
    if (hovered === null || !motionAllowed || !open) return;
    const face = stops.current[hovered]?.querySelector('.rail__face');
    if (!face) return;
    gsap.fromTo(
      face,
      { scale: 1 },
      {
        keyframes: [
          { scale: 1.14, duration: 0.16, ease: 'power2.out' },
          { scale: 1.06, duration: 0.45, ease: 'spring' },
        ],
      },
    );
    return () => {
      gsap.to(face, { scale: 1, duration: 0.25, ease: 'washi' });
    };
  }, [hovered, motionAllowed, open]);

  // Destello de cada zona por la que pasa la cámara; la de destino se asienta.
  useEffect(() => {
    if (!active) return;
    return useKyotoStore.subscribe((state, previous) => {
      if (state.zone === previous.zone || !selectMotionAllowed(state)) return;
      const stop = stops.current[stationIndex(state.zone)];
      if (!stop) return;
      gsap.fromTo(stop, { '--glow': 1 }, { '--glow': 0, duration: 0.9, ease: 'washi' });
      if (state.zone === currentRef.current) {
        const stone = stop.querySelector('.rail__stone, .rail__home');
        if (stone) {
          gsap.fromTo(
            stone,
            { scale: 1 },
            {
              keyframes: [
                { scale: 1.7, duration: 0.18, ease: 'power2.out' },
                { scale: 1, duration: 0.55, ease: 'spring' },
              ],
            },
          );
        }
      }
    });
  }, [active]);

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    if (!(event.target as HTMLElement).matches(':focus-visible')) return;
    keyboardInside.current = true;
    suppressed.current = false;
    evaluate();
  };

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (root.current?.contains(event.relatedTarget as Node | null)) return;
    keyboardInside.current = false;
    evaluate();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      keyboardInside.current = false;
      suppressed.current = true;
      evaluate();
      document.getElementById('contenido')?.focus();
      return;
    }
    if (suppressed.current) {
      suppressed.current = false;
      keyboardInside.current = true;
      evaluate();
    }
    const links = Array.from(root.current?.querySelectorAll<HTMLElement>('.rail__link') ?? []);
    if (moveFocus(event.key, links)) event.preventDefault();
  };

  const onLinkClick = () => {
    suppressed.current = true;
    setHovered(null);
    evaluate();
  };

  return (
    <nav
      ref={root}
      className="rail"
      aria-label={t('label')}
      data-open={open ? '' : undefined}
      style={{ '--s0': currentIndex } as CSSProperties}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <svg className="rail__line" aria-hidden="true" focusable="false">
        <path ref={line} />
      </svg>

      <ol className="rail__list">
        {JOURNEY.map((station, i) => {
          const isCurrent = station.slug === current;
          const style = {
            '--t': i / RAIL_LAST,
            '--bend': railBend(i / RAIL_LAST),
            '--halo': station.palette.halo,
            '--accent': station.palette.accent,
          } as CSSProperties;

          return (
            <li
              key={station.slug}
              ref={(node) => {
                if (node) stops.current[i] = node;
              }}
              className="rail__stop"
              style={style}
            >
              <Link
                href={stationPath(station)}
                className="rail__link"
                aria-current={isCurrent ? 'page' : undefined}
                onClick={onLinkClick}
                onPointerEnter={() => setHovered(i)}
                onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered((h) => (h === i ? null : h))}
              >
                {station.inSidebar && isIconName(station.icon) ? (
                  <span className="rail__circle" aria-hidden="true">
                    <svg className="rail__stone" viewBox="-1 -1 2 2" focusable="false">
                      <path d={STONES[i]} />
                    </svg>
                    <span className="rail__face">
                      <StationIcon icon={station.icon} active={open && hovered === i} className="rail__icon" />
                    </span>
                  </span>
                ) : (
                  <span className="rail__home" aria-hidden="true">
                    {station.kanji}
                  </span>
                )}
                <span className="rail__label">
                  <span className="rail__label-kanji" aria-hidden="true">
                    {station.kanji}
                  </span>
                  <span className="rail__label-name">{names(`${station.slug}.name`)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <span ref={marker} className="rail__marker" aria-hidden="true" />
    </nav>
  );
}
```

- [ ] **Paso 4: `JourneyNav` y el layout**

Crear `src/components/nav/JourneyNav.tsx`:

```tsx
'use client';

import { stationFromPathname } from '@/config/journey';
import { usePathname } from '@/i18n/navigation';

import { useNavLayout } from './navQuery';
import { RadialSidebar } from './RadialSidebar';

/**
 * La navegación del camino (Fase 3C). Vive en el layout de `[locale]`, como la
 * escena, y **no se desmonta** al cambiar de ruta: la marca de progreso sigue
 * viva durante el viaje.
 *
 * La estación actual sale de la URL, no del store: así `aria-current` ya es
 * correcto en el HTML estático de cada página. Las dos presentaciones se
 * renderizan siempre y el CSS decide cuál se ve; `active` sólo enciende la que
 * está a la vista (sus listeners, su ticker, sus timelines).
 */
export function JourneyNav() {
  const pathname = usePathname();
  const current = stationFromPathname(pathname)?.slug ?? null;
  const layout = useNavLayout();

  return <RadialSidebar current={current} active={layout === 'desktop'} />;
}
```

En `src/app/[locale]/layout.tsx`: importar `import { JourneyNav } from '@/components/nav/JourneyNav';` y, entre `<SceneRoot />` y `{children}`:

```tsx
          {/* La navegación: persistente como la escena, y antes del contenido
              en el orden de tabulación (después del «saltar al contenido»). */}
          <JourneyNav />
```

- [ ] **Paso 5: Quitar `StationLinks`**

Ejecutar: `git grep -n "StationLinks"`
Esperado: solo `src/app/[locale]/page.tsx`, `src/components/sections/StationShell.tsx` y el propio archivo.

En los dos usos, borrar el `import { StationLinks } …` y la línea `<StationLinks … />`. Después: `git rm src/components/nav/StationLinks.tsx`.

- [ ] **Paso 6: Los estilos del riel**

En `src/styles/globals.css`, la regla `.tramo-card[data-side='derecha']` pasa a:

```css
  /* Nunca debajo del riel plegado de la navegación (Fase 3C): 6vw son 61 px a
     1024 px de ancho. */
  .tramo-card[data-side='derecha'] {
    right: max(6vw, 4.5rem);
  }
```

Y al final de `@layer components`, antes de la llave que lo cierra:

```css
  /* ── La navegación (Fase 3C) ───────────────────────────────────────────
     El riel de escritorio: siete paradas sobre un arco pegado al borde
     derecho. Aquí vive la geometría en reposo —plegado—; el despliegue
     (`--bulge`, la escala de los círculos) lo anima `RadialSidebar`. Las
     paradas están en `top: t · 100 %` y se separan del borde `bulge · bend`. */
  .rail {
    --bulge: 8px;
    --circle: clamp(44px, 7vh, 56px);
    position: fixed;
    top: 50%;
    right: 2.25rem;
    z-index: 40;
    width: 0;
    height: min(64vh, 560px);
    translate: 0 -50%;
  }

  .rail__list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rail__stop {
    --glow: 0;
    position: absolute;
    top: calc(var(--t) * 100%);
    right: 0;
    translate: calc(var(--bulge) * var(--bend) * -1) 0;
  }

  .rail__link {
    position: absolute;
    top: calc(var(--circle) / -2);
    left: calc(var(--circle) / -2);
    display: grid;
    width: var(--circle);
    height: var(--circle);
    place-items: center;
    border-radius: 9999px;
  }

  .rail__link:focus-visible {
    outline-offset: 3px;
    border-radius: 9999px;
  }

  .rail__circle {
    position: absolute;
    inset: 0;
    transform: scale(0.2);
  }

  .rail__stone {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(0 0 calc(var(--glow) * 30px) var(--accent));
  }

  .rail__stone path {
    fill: transparent;
    stroke: var(--color-sumi-faint);
    stroke-width: 0.22;
  }

  .rail__stop[data-walked] .rail__stone path {
    fill: var(--accent);
    stroke: var(--accent);
  }

  .rail__face {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--color-sumi) 22%, transparent);
    border-radius: 9999px;
    background: var(--halo);
    box-shadow: var(--shadow-paper);
    opacity: 0;
  }

  .rail__link[aria-current='page'] .rail__face {
    box-shadow:
      0 0 0 2px var(--accent),
      var(--shadow-paper);
  }

  .rail__icon {
    width: 76%;
    height: 76%;
    overflow: visible;
  }

  .rail__home {
    font-family: var(--font-kanji);
    font-size: 1rem;
    line-height: 1;
    letter-spacing: 0.1em;
    color: var(--color-shu);
    writing-mode: vertical-rl;
    filter: drop-shadow(0 0 calc(var(--glow) * 8px) var(--accent));
  }

  .rail__label {
    position: absolute;
    top: 50%;
    right: calc(100% + 0.75rem);
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.35rem 0.8rem;
    white-space: nowrap;
    border: 1px solid var(--border-hairline);
    border-radius: 0.6rem;
    background: color-mix(in srgb, var(--surface-paper) 78%, transparent);
    backdrop-filter: blur(6px);
    box-shadow: var(--shadow-paper);
    opacity: 0;
    pointer-events: none;
    translate: 0.5rem -50%;
    transition:
      opacity var(--dur-rapido) var(--ease-washi),
      translate var(--dur-rapido) var(--ease-washi);
  }

  .rail[data-open] .rail__link:hover .rail__label,
  .rail[data-open] .rail__link:focus-visible .rail__label {
    opacity: 1;
    translate: 0 -50%;
  }

  .rail__label-kanji {
    font-family: var(--font-kanji);
    font-size: 1.1rem;
    color: var(--accent);
  }

  .rail__label-name {
    font-family: var(--font-display);
    font-size: 1.05rem;
  }

  .rail__line {
    position: absolute;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    overflow: visible;
    pointer-events: none;
  }

  .rail__line path {
    fill: none;
    stroke: var(--color-sumi-faint);
    stroke-width: 1;
    stroke-dasharray: 2 5;
    opacity: 0.7;
  }

  .rail__marker {
    position: absolute;
    top: -5px;
    right: -5px;
    width: 10px;
    height: 10px;
    border: 2px solid var(--color-shu);
    border-radius: 9999px;
    background: var(--color-washi);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-shu) 18%, transparent);
    pointer-events: none;
    will-change: transform;
  }

  /* Antes de que el ticker arranque, la marca está en la estación del HTML. */
  .rail__marker:not([data-live]) {
    top: calc(var(--s0) / 6 * 100% - 5px);
  }
```

Y al final del archivo, fuera de las capas:

```css
/* Navegación móvil: pantallas estrechas y táctiles sin hover. El mismo corte
   vive en `components/nav/navQuery.ts`: si cambia aquí, cambia allí. */
@media (max-width: 767px), (hover: none) and (pointer: coarse) {
  .rail,
  .ambient-corner {
    display: none;
  }
}
```

- [ ] **Paso 7: Verificar**

Ejecutar: `bun run typecheck`
Esperado: sin errores.

Ejecutar: `bun run check:path`
Esperado: todo `✓`.

Ejecutar: `bun run build`
Esperado: termina sin errores.

Ejecutar:

```powershell
bun -e "for (const [p, href] of [['out/es/ubicacion/index.html','/es/ubicacion/'],['out/en/lugares/gion/index.html','/en/lugares/gion/'],['out/es/index.html','/es/']]) { const h = await Bun.file(p).text(); const links = [...h.matchAll(/<a[^>]*class=\"rail__link\"[^>]*>/g)].map((m) => m[0]); const cur = links.filter((a) => a.includes('aria-current=\"page\"')); console.log(p, links.length, 'enlaces;', cur.length === 1 && cur[0].includes('href=\"' + href + '\"') ? 'actual OK' : 'actual MAL: ' + cur.join(' | ')); }"
```

Esperado: `7 enlaces; actual OK` en las tres páginas. Si el orden de los atributos impide que la regex encuentre la clase, buscar `rail__link` sin la comilla y repetir.

**Comprobación manual (el usuario, al final de la fase):** el despliegue al acercar el cursor y con Tab; la marca recorriendo el riel en un salto de 京都 a 京料理, con los destellos y el asentamiento; un clic en la estación actual (se pliega y no viaja); Enter con teclado (viaja); Escape (foco al contenido sin anillo); con WebGL desactivado, la marca en la estación de la URL.

- [ ] **Paso 8: Commit**

```powershell
git add -A src/components/nav "src/app/[locale]" src/components/sections/StationShell.tsx src/styles/globals.css
git commit -m @'
Fase 3C: el riel de piedras del escritorio

Siete paradas sobre un arco pegado al borde derecho: plegado es un
camino de piedrecitas con la marca de progreso, que sigue a la cámara
desde gsap.ticker; al acercar el cursor o con el teclado se despliega en
los seis círculos con sus íconos. Destello por zona en los viajes,
flechas/Inicio/Fin/Escape. Sustituye a StationLinks.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Tarea 8: La barra móvil y el abanico

**Archivos:**
- Crear: `src/components/nav/MobileNav.tsx`
- Modificar: `src/components/nav/JourneyNav.tsx`
- Modificar: `src/styles/globals.css`

**Interfaces:**
- Consume `barPoint`, `fanPose`, `RAIL_LAST`, `RailPoint` (Tarea 1), `stoneOutline`, `isIconName` (Tarea 3), `StationIcon` (Tarea 4), `AmbientControls variant="bar"` (Tarea 6), `useRailProgress` y `moveFocus` (Tarea 7), y `getLenis` (`@/animation/gsap`).
- Produce `<MobileNav current={StationSlug | null} active={boolean} />`.

- [ ] **Paso 1: El componente**

Crear `src/components/nav/MobileNav.tsx`:

```tsx
'use client';

import { gsap } from 'gsap';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

import { getLenis } from '@/animation/gsap';
import { motionDurations, registerPresets } from '@/animation/presets';
import { AmbientControls } from '@/components/ui/AmbientControls';
import { JOURNEY, stationPath, type StationSlug } from '@/config/journey';
import { Link, useRouter } from '@/i18n/navigation';
import { stationIndex } from '@/scene/path/journeyPath';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { isIconName } from './icons';
import { stoneOutline } from './icons/stone';
import { moveFocus } from './navKeys';
import { barPoint, fanPose, RAIL_LAST, type RailPoint } from './railProgress';
import { StationIcon } from './StationIcon';
import { useRailProgress } from './useRailProgress';

/** La marca del historial con la que «atrás» cierra el abanico. */
const FAN_HISTORY_KEY = 'kyotoFan';
/** Lo que se deja ver el pulso y el kanji antes de navegar, en ms. */
const PICK_DELAY = 320;

const STONES = JOURNEY.map((_, i) => stoneOutline(i));

/** Radio del abanico: el 40 % del ancho, nunca más de 160 px. */
const fanRadius = () => Math.min(window.innerWidth * 0.4, 160);

type FanState = 'closed' | 'open' | 'closing';

const fanInHistory = () =>
  Boolean((window.history.state as Record<string, unknown> | null)?.[FAN_HISTORY_KEY]);

/**
 * La navegación móvil (Fase 3C): una píldora flotante con el riel en
 * horizontal —las mismas piedras, la misma marca— y los tres mandos. Al
 * tocarla se abre el abanico: 京都 en el centro y los seis círculos en un
 * semicírculo, que salen del centro recorriendo el arco.
 *
 * El abanico es modal: el foco no sale de él, Lenis se detiene (el scroll de
 * detrás no mueve la cámara) y se cierra al elegir, al tocar el velo, con
 * Escape y con «atrás» del sistema. Para eso último, al abrir se apila una
 * entrada de historial con la **misma URL**; si se cierra de otra forma se
 * consume con `history.back()`, y al elegir una estación se navega con
 * `router.replace`, que la sustituye: el historial queda como tras una
 * navegación normal.
 */
export function MobileNav({ current, active }: { current: StationSlug | null; active: boolean }) {
  const t = useTranslations('nav');
  const names = useTranslations('stations');
  const router = useRouter();
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const fanId = useId();

  const toggle = useRef<HTMLButtonElement>(null);
  const track = useRef<HTMLSpanElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const stops = useRef<HTMLElement[]>([]);
  const fan = useRef<HTMLDivElement>(null);
  const items = useRef<HTMLLIElement[]>([]);
  const width = useRef(0);
  const currentRef = useRef(current);
  const historyPushed = useRef(false);
  const ignorePop = useRef(false);
  const returnFocus = useRef(false);

  const [state, setState] = useState<FanState>('closed');
  const [tapped, setTapped] = useState<number | null>(null);

  const currentIndex = current ? stationIndex(current) : 0;

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const place = useCallback((s: number, out: RailPoint) => barPoint(s, width.current, out), []);
  useRailProgress({ marker, stops, place, current, enabled: active });

  useEffect(() => {
    const node = track.current;
    if (!node || !active) return;
    const measure = () => {
      width.current = node.clientWidth;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  const openFan = () => {
    window.history.pushState({ [FAN_HISTORY_KEY]: true }, '');
    historyPushed.current = true;
    setState('open');
  };

  /** Cierra sin navegar: velo, botón, Escape o un cambio de presentación. */
  const dismiss = useCallback(() => {
    returnFocus.current = Boolean(fan.current?.contains(document.activeElement));
    if (historyPushed.current && fanInHistory()) {
      ignorePop.current = true;
      window.history.back();
    }
    historyPushed.current = false;
    setState((s) => (s === 'open' ? 'closing' : s));
  }, []);

  // «Atrás» del sistema con el abanico abierto.
  useEffect(() => {
    const onPop = () => {
      if (ignorePop.current) {
        ignorePop.current = false;
        return;
      }
      if (!historyPushed.current) return;
      historyPushed.current = false;
      returnFocus.current = Boolean(fan.current?.contains(document.activeElement));
      setState((s) => (s === 'open' ? 'closing' : s));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Si la pantalla pasa a escritorio con el abanico abierto, se cierra.
  useEffect(() => {
    if (!active && state === 'open') dismiss();
  }, [active, state, dismiss]);

  // Abrir y cerrar.
  useEffect(() => {
    const root = fan.current;
    if (!root || state === 'closed') return;
    registerPresets();
    const { medio, rapido } = motionDurations();
    const list = items.current;
    const hub = list[0];
    const arc = list.slice(1);
    const veil = root.querySelector('.mnav__veil');
    const radius = fanRadius();
    const point = { x: 0, y: 0 };
    const placeItem = (li: HTMLElement, index: number, k: number) => {
      fanPose(index, k, radius, point);
      li.style.translate = `${point.x}px ${point.y}px`;
    };

    if (state === 'open') {
      getLenis()?.stop();
      document.documentElement.classList.add('nav-locked');
      const tl = gsap.timeline();
      if (motionAllowed) {
        arc.forEach((li, j) => placeItem(li, j + 1, 0));
        tl.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: rapido, ease: 'washi' }, 0);
        tl.fromTo(hub, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: rapido, ease: 'washi' }, 0);
        arc.forEach((li, j) => {
          const proxy = { k: 0 };
          const at = 0.05 + j * 0.035;
          tl.to(proxy, { k: 1, duration: medio, ease: 'spring', onUpdate: () => placeItem(li, j + 1, proxy.k) }, at);
          tl.fromTo(li, { opacity: 0 }, { opacity: 1, duration: rapido }, at);
        });
      } else {
        arc.forEach((li, j) => placeItem(li, j + 1, 1));
        tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.15 });
      }
      const target = currentRef.current ? stationIndex(currentRef.current) : 0;
      list[target]?.querySelector('a')?.focus();
      return () => {
        tl.kill();
      };
    }

    // state === 'closing'
    const tl = gsap.timeline({ onComplete: () => setState('closed') });
    if (motionAllowed) {
      tl.to(arc, { opacity: 0, scale: 0.6, duration: rapido, ease: 'washi', stagger: 0.02 }, 0)
        .to(hub ?? [], { opacity: 0, duration: rapido }, 0)
        .to(veil, { opacity: 0, duration: rapido }, 0);
    } else {
      tl.to(root, { opacity: 0, duration: 0.15 });
    }
    return () => {
      tl.kill();
    };
  }, [state, motionAllowed]);

  // Cerrado: el scroll vuelve, se limpia lo animado y el foco vuelve al botón.
  useEffect(() => {
    if (state !== 'closed') return;
    getLenis()?.start();
    document.documentElement.classList.remove('nav-locked');
    const root = fan.current;
    const veil = root?.querySelector('.mnav__veil');
    gsap.set([...items.current, veil, root].filter(Boolean), { clearProps: 'all' });
    if (returnFocus.current) {
      returnFocus.current = false;
      toggle.current?.focus();
    }
  }, [state]);

  const onPick = (event: MouseEvent<HTMLAnchorElement>, index: number) => {
    event.preventDefault();
    const href = stationPath(JOURNEY[index]!);
    const go = () => {
      // La entrada de relleno del abanico se sustituye por la de destino.
      if (historyPushed.current && fanInHistory()) router.replace(href);
      else router.push(href);
      historyPushed.current = false;
      returnFocus.current = true;
      setTapped(null);
      setState((s) => (s === 'open' ? 'closing' : s));
    };
    if (!motionAllowed) {
      go();
      return;
    }
    setTapped(index);
    const face = items.current[index]?.querySelector('.mnav__face, .mnav__hub');
    if (face) {
      gsap.fromTo(
        face,
        { scale: 1 },
        {
          keyframes: [
            { scale: 1.18, duration: 0.16, ease: 'power2.out' },
            { scale: 1, duration: 0.4, ease: 'spring' },
          ],
        },
      );
    }
    window.setTimeout(go, PICK_DELAY);
  };

  const onFanKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
      return;
    }
    const links = items.current
      .map((li) => li.querySelector<HTMLElement>('a'))
      .filter((link): link is HTMLElement => link !== null);
    if (event.key === 'Tab') {
      const first = links[0];
      const last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (moveFocus(event.key, links)) event.preventDefault();
  };

  return (
    <div className="mnav">
      <div className="mnav__bar">
        <button
          ref={toggle}
          type="button"
          className="mnav__toggle"
          aria-expanded={state === 'open'}
          aria-controls={fanId}
          aria-label={state === 'open' ? t('close') : t('open')}
          onClick={() => (state === 'open' ? dismiss() : openFan())}
        >
          <span
            ref={track}
            className="mnav__track"
            aria-hidden="true"
            style={{ '--s0': currentIndex } as CSSProperties}
          >
            {JOURNEY.map((station, i) => (
              <span
                key={station.slug}
                ref={(node) => {
                  if (node) stops.current[i] = node;
                }}
                className={i === 0 ? 'mnav__stone mnav__stone--home' : 'mnav__stone'}
                style={{ '--t': i / RAIL_LAST, '--accent': station.palette.accent } as CSSProperties}
              >
                {i === 0 ? (
                  station.kanji.charAt(0)
                ) : (
                  <svg viewBox="-1 -1 2 2" focusable="false">
                    <path d={STONES[i]} />
                  </svg>
                )}
              </span>
            ))}
            <span ref={marker} className="mnav__marker" />
          </span>
        </button>
        <AmbientControls variant="bar" />
      </div>

      <div
        id={fanId}
        ref={fan}
        className="mnav__fan"
        role="dialog"
        aria-modal="true"
        aria-label={t('label')}
        hidden={state === 'closed'}
        onKeyDown={onFanKeyDown}
      >
        <div className="mnav__veil" onClick={dismiss} />
        <nav aria-label={t('label')}>
          <ol className="mnav__arc">
            {JOURNEY.map((station, i) => (
              <li
                key={station.slug}
                ref={(node) => {
                  if (node) items.current[i] = node;
                }}
                className="mnav__item"
                style={{ '--halo': station.palette.halo, '--accent': station.palette.accent } as CSSProperties}
              >
                <Link
                  href={stationPath(station)}
                  className="mnav__link"
                  aria-current={station.slug === current ? 'page' : undefined}
                  onClick={(event) => onPick(event, i)}
                >
                  {station.inSidebar && isIconName(station.icon) ? (
                    <span className="mnav__face" aria-hidden="true">
                      <StationIcon icon={station.icon} active={false} className="mnav__icon" />
                      <span className="mnav__kanji" data-shown={tapped === i ? '' : undefined}>
                        {station.kanji}
                      </span>
                    </span>
                  ) : (
                    <span className="mnav__hub" aria-hidden="true">
                      {station.kanji}
                    </span>
                  )}
                  <span className="mnav__name">{names(`${station.slug}.name`)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: `JourneyNav` con las dos presentaciones**

Reemplazar el cuerpo de `src/components/nav/JourneyNav.tsx` (el comentario de cabecera no cambia):

```tsx
'use client';

import { stationFromPathname } from '@/config/journey';
import { usePathname } from '@/i18n/navigation';

import { MobileNav } from './MobileNav';
import { useNavLayout } from './navQuery';
import { RadialSidebar } from './RadialSidebar';

export function JourneyNav() {
  const pathname = usePathname();
  const current = stationFromPathname(pathname)?.slug ?? null;
  const layout = useNavLayout();

  return (
    <>
      <RadialSidebar current={current} active={layout === 'desktop'} />
      <MobileNav current={current} active={layout === 'mobile'} />
    </>
  );
}
```

- [ ] **Paso 3: Los estilos de la barra y el abanico**

En `src/styles/globals.css`, al final de `@layer components`, después de los estilos del riel:

```css
  /* La navegación móvil: una píldora flotante con el riel en horizontal y los
     mandos; al tocarla, el abanico. Fuera del corte de móvil no se ve. */
  .mnav {
    display: none;
  }

  .mnav__bar {
    position: fixed;
    right: 0.75rem;
    bottom: calc(0.75rem + env(safe-area-inset-bottom));
    left: 0.75rem;
    z-index: 40;
    display: flex;
    height: 52px;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.25rem 0 0.75rem;
    border: 1px solid var(--border-hairline);
    border-radius: 9999px;
    background: color-mix(in srgb, var(--surface-paper) 78%, transparent);
    backdrop-filter: blur(6px);
    box-shadow: var(--shadow-paper);
  }

  .mnav__toggle {
    display: flex;
    height: 44px;
    min-width: 0;
    flex: 1;
    align-items: center;
    padding: 0 0.6rem;
    border-radius: 9999px;
  }

  .mnav__track {
    position: relative;
    height: 100%;
    flex: 1;
  }

  .mnav__track::before {
    content: '';
    position: absolute;
    top: 50%;
    right: 0;
    left: 0;
    border-top: 1px dashed var(--color-sumi-faint);
    opacity: 0.7;
  }

  .mnav__stone {
    position: absolute;
    top: 50%;
    left: calc(var(--t) * 100%);
    width: 12px;
    height: 12px;
    translate: -50% -50%;
  }

  .mnav__stone svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .mnav__stone path {
    fill: var(--color-washi);
    stroke: var(--color-sumi-faint);
    stroke-width: 0.22;
  }

  .mnav__stone[data-walked] path {
    fill: var(--accent);
    stroke: var(--accent);
  }

  .mnav__stone--home {
    width: auto;
    height: auto;
    padding: 0 0.15rem;
    font-family: var(--font-kanji);
    font-size: 1rem;
    line-height: 1;
    color: var(--color-shu);
    background: color-mix(in srgb, var(--surface-paper) 78%, transparent);
  }

  .mnav__marker {
    position: absolute;
    top: 50%;
    left: 0;
    width: 10px;
    height: 10px;
    margin: -5px 0 0 -5px;
    border: 2px solid var(--color-shu);
    border-radius: 9999px;
    background: var(--color-washi);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-shu) 18%, transparent);
    pointer-events: none;
    will-change: transform;
  }

  .mnav__marker:not([data-live]) {
    left: calc(var(--s0) / 6 * 100%);
  }

  .mnav__fan {
    position: fixed;
    inset: 0;
    z-index: 50;
  }

  .mnav__fan[hidden] {
    display: none;
  }

  .mnav__veil {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--color-washi) 60%, transparent);
    backdrop-filter: blur(3px);
  }

  .mnav__arc {
    position: absolute;
    bottom: calc(6rem + env(safe-area-inset-bottom));
    left: 50%;
    width: 0;
    height: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .mnav__item {
    position: absolute;
    top: 0;
    left: 0;
  }

  .mnav__link {
    position: absolute;
    top: -26px;
    left: -26px;
    display: flex;
    width: 52px;
    flex-direction: column;
    align-items: center;
    border-radius: 1rem;
  }

  .mnav__face,
  .mnav__hub {
    position: relative;
    display: grid;
    width: 52px;
    height: 52px;
    place-items: center;
    border-radius: 9999px;
  }

  .mnav__face {
    border: 1px solid color-mix(in srgb, var(--color-sumi) 22%, transparent);
    background: var(--halo);
    box-shadow: var(--shadow-paper);
  }

  .mnav__hub {
    font-family: var(--font-kanji);
    font-size: 1.3rem;
    color: var(--color-shu);
  }

  .mnav__link[aria-current='page'] .mnav__face {
    box-shadow:
      0 0 0 2px var(--accent),
      var(--shadow-paper);
  }

  .mnav__icon {
    width: 76%;
    height: 76%;
    overflow: visible;
  }

  .mnav__name {
    max-width: 5.5rem;
    margin-top: 0.3rem;
    font-family: var(--font-display);
    font-size: 0.8rem;
    line-height: 1.1;
    text-align: center;
  }

  .mnav__kanji {
    position: absolute;
    bottom: calc(100% + 0.3rem);
    font-family: var(--font-kanji);
    font-size: 1.1rem;
    white-space: nowrap;
    color: var(--accent);
    opacity: 0;
    transition: opacity var(--dur-rapido) var(--ease-washi);
  }

  .mnav__kanji[data-shown] {
    opacity: 1;
  }

  /* Con el abanico abierto la página no se mueve debajo. */
  .nav-locked {
    overflow: hidden;
  }
```

Y la consulta de móvil del final del archivo queda:

```css
@media (max-width: 767px), (hover: none) and (pointer: coarse) {
  .rail,
  .ambient-corner {
    display: none;
  }

  .mnav {
    display: block;
  }

  /* Que lo último de la página nunca quede debajo de la barra flotante. */
  body {
    padding-bottom: calc(52px + 2.25rem + env(safe-area-inset-bottom));
  }
}
```

- [ ] **Paso 4: Verificar**

Ejecutar: `bun run typecheck`
Esperado: sin errores.

Ejecutar: `bun run check:path`
Esperado: todo `✓`.

Ejecutar: `bun run build`
Esperado: termina sin errores.

Ejecutar:

```powershell
bun -e "const h = await Bun.file('out/es/eventos/index.html').text(); console.log('mnav__link:', [...h.matchAll(/mnav__link/g)].length, '· aria-current:', [...h.matchAll(/aria-current=\"page\"/g)].length, '· dialog oculto:', /role=\"dialog\"[^>]*hidden|hidden[^>]*role=\"dialog\"/.test(h));"
```

Esperado: `mnav__link: 7 · aria-current: 2 · dialog oculto: true` (2 = el del riel y el del abanico).

**Comprobación manual (el usuario, a 390×844 y en una tablet o con la emulación táctil):** abrir y cerrar el abanico por las cinco vías; tras «atrás», que la URL y la cámara no cambien y que un segundo «atrás» lleve a la página anterior de verdad; elegir una estación lejana (pulso, kanji y viaje), y que «atrás» después vuelva a la estación de partida; elegir la estación actual; rotar o redimensionar con el abanico abierto (se cierra y el scroll vuelve); con 静, fundidos sin vuelo.

- [ ] **Paso 5: Commit**

```powershell
git add src/components/nav/MobileNav.tsx src/components/nav/JourneyNav.tsx src/styles/globals.css
git commit -m @'
Fase 3C: la barra móvil y el abanico

Una píldora flotante con el riel en horizontal y los tres mandos; al
tocarla, los seis círculos salen del centro recorriendo un semicírculo.
Modal: foco atrapado, Lenis detenido, y se cierra al elegir, con el velo,
Escape o «atrás» (una entrada de historial con la misma URL que
router.replace sustituye al navegar).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Tarea 9: La fauna en vertical

**Archivos:**
- Modificar: `src/scene/systems/fauna/behaviors.ts` (`FaunaAct`, `kiteFit`, `planearEnCirculos`)
- Modificar: `src/scene/systems/fauna/casting.ts:291`
- Modificar: `scripts/check-fauna.ts` (`buildAct`, la comprobación del milano y el informe)

**Interfaces:**
- Produce `FaunaAct.viewAspect: number` (el aspecto real al nacer, sin acotar).
- Produce `kiteFit(viewAspect: number): number`, exportada desde `behaviors.ts`.

- [ ] **Paso 1: Endurecer la comprobación y añadir el informe (falla)**

En `scripts/check-fauna.ts`, dentro de `buildAct`, después de `aspect: Math.max(aspect, 16 / 9),`:

```ts
    viewAspect: aspect,
```

Sustituir el bloque de `KITE_MIN_SEEN` (de `const KITE_MIN_SEEN = 0.5;` hasta el `check(…)` que lo cierra) por:

```ts
  // Entrar y salir por arriba no puede comerse el acto: se le ve dar vueltas.
  // También en vertical: sus círculos se ajustan al cuadro real (Fase 3C).
  const KITE_MIN_SEEN = 0.5;
  const leastSeen = ASPECTS.map(() => 1);
  for (const { act, viewer } of sweep) {
    if (act.behavior !== 'planearEnCirculos') continue;
    const aspect = ASPECTS.indexOf(act.viewAspect);
    const samples = range(0, act.duration, 0.25);
    const seen = samples.filter((seconds) => memberSeen(act, 0, seconds, viewer)).length;
    leastSeen[aspect] = Math.min(leastSeen[aspect]!, seen / samples.length);
  }
  check(
    `el milano se ve al menos el ${KITE_MIN_SEEN * 100} % de su acto, también en vertical`,
    leastSeen.every((share) => share >= KITE_MIN_SEEN),
    ASPECTS.map((aspect, i) => `${aspect.toFixed(2)}: ${(leastSeen[i]! * 100).toFixed(0)} %`).join(' · '),
  );
  check(
    'sus círculos se estrechan con el cuadro, sin bajar de la mitad',
    kiteFit(9 / 16) === 0.5 &&
      kiteFit(16 / 9) === 1 &&
      kiteFit(21 / 9) === 1 &&
      Math.abs(kiteFit(4 / 3) - 0.75) < 1e-12,
  );
```

Añadir `kiteFit` al import existente de `../src/scene/systems/fauna/behaviors`.

Justo después del bloque `{ … }` del milano (antes de `// …y pasa **por encima** de las piedras`), añadir el informe:

```ts
// Fauna en vertical: qué fracción de su acto se ve cada conducta en 9:16 y en
// 16:9. No falla: es la línea base de la Fase 3C. Si alguna queda por debajo
// del 40 % en vertical, se le enseña al usuario antes de tocarla (spec §8.2).
{
  const PORTRAIT_FLOOR = 0.4;
  const shares = new Map<string, { portrait: number[]; landscape: number[] }>();
  for (const { act, viewer } of bodies) {
    const key = act.viewAspect === 9 / 16 ? 'portrait' : act.viewAspect === 16 / 9 ? 'landscape' : null;
    if (!key) continue;
    const samples = range(0, act.duration, 0.5);
    const seen = samples.filter((s) => members(act).some((m) => memberSeen(act, m, s, viewer))).length;
    const entry = shares.get(act.behavior) ?? { portrait: [], landscape: [] };
    entry[key].push(seen / samples.length);
    shares.set(act.behavior, entry);
  }
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  console.log('\n— Fauna en vertical (informe: fracción del acto a la vista)');
  const weak: string[] = [];
  for (const [behavior, { portrait, landscape }] of shares) {
    const p = mean(portrait);
    console.log(`  ${behavior}: 9:16 ${(p * 100).toFixed(0)} % · 16:9 ${(mean(landscape) * 100).toFixed(0)} %`);
    if (p < PORTRAIT_FLOOR) weak.push(behavior);
  }
  console.log(
    weak.length > 0
      ? `  ⚠ por debajo del ${PORTRAIT_FLOOR * 100} % en 9:16: ${weak.join(', ')} — revisar con el usuario antes de tocarlas`
      : `  ✓ ninguna conducta por debajo del ${PORTRAIT_FLOOR * 100} % en 9:16`,
  );
}
```

- [ ] **Paso 2: Ejecutarla para ver que falla**

Ejecutar: `bun run scripts/check-fauna.ts`
Esperado: errores de tipo o de ejecución (`viewAspect` no existe en `FaunaAct`, `kiteFit` no exportada); con eso arreglado, `✗ el milano se ve al menos el 50 % … (0.56: 36 % …)`.

- [ ] **Paso 3: Implementar**

En `src/scene/systems/fauna/behaviors.ts`, en `FaunaAct`, después de `readonly aspect: number;`:

```ts
  /**
   * El aspecto real de la pantalla al nacer, sin acotar. Con él ajusta el
   * milano sus círculos a un cuadro vertical (Fase 3C). Se fija al nacer: si se
   * gira el móvil a mitad de un acto, el acto no se recalcula —lo
   * teletransportaría—.
   */
  readonly viewAspect: number;
```

Después de las constantes del milano (`KITE_DRIFT`):

```ts
/** Lo más que se estrechan los círculos del milano en un cuadro vertical. */
const KITE_FIT_FLOOR = 0.5;

/**
 * Cuánto se estrechan los círculos del milano con el cuadro: el medio ancho
 * visible es proporcional al aspecto, así que el cociente con el de 16:9 no
 * depende de la profundidad. Con un suelo: por debajo de la mitad los círculos
 * se cierran tanto que parece que gira sobre sí mismo (Fase 3C).
 */
export function kiteFit(viewAspect: number): number {
  return clamp(viewAspect / (16 / 9), KITE_FIT_FLOOR, 1);
}
```

En `planearEnCirculos.place`:

```ts
    const fit = kiteFit(act.viewAspect);
    const radius = (5 + jitter(act.seed, member, 1) * (KITE_RADIUS_MAX - 5)) * fit;
```

y

```ts
    const center = act.direction * KITE_DRIFT * fit * (s - act.duration / 2);
```

(sustituyendo las líneas de `radius` y `center` existentes; el resto de la conducta no cambia).

En `src/scene/systems/fauna/casting.ts`, después de `aspect: Math.max(camera.aspect, 16 / 9),`:

```ts
    viewAspect: camera.aspect,
```

- [ ] **Paso 4: Ejecutar y decidir**

Ejecutar: `bun run check:path`
Esperado: todo `✓`, incluido `el milano se ve al menos el 50 % … también en vertical`, con 0.56 por encima de 50 %. Anotar el informe de conductas.

**Paradas obligatorias (spec §12):**
- Si el milano **no** llega al 50 % en 9:16 con el suelo de 0,5: **parar**, no tocar más, y enseñar al usuario los números con tres opciones: bajar el suelo, alejar el milano o aceptar menos.
- Si el informe marca alguna conducta por debajo del 40 % en 9:16: **no tocarla**. Se le enseña al usuario en el informe final de la fase.

Ejecutar: `bun run typecheck`
Esperado: sin errores.

- [ ] **Paso 5: Commit**

```powershell
git add src/scene/systems/fauna/behaviors.ts src/scene/systems/fauna/casting.ts scripts/check-fauna.ts
git commit -m @'
Fase 3C: el milano ajusta sus círculos al cuadro vertical

Cada acto guarda también el aspecto real al nacer; el radio y la deriva
del milano se estrechan con él (nunca por debajo de la mitad). La
exigencia de verlo el 50 % de su acto cubre ya los cuatro aspectos, y
check-fauna informa de cuánto se ve cada conducta en 9:16 y 16:9.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Tarea 10: Documentación y verificación final

**Archivos:**
- Modificar: `CLAUDE.md`
- Modificar: `docs/PLAN.md`

- [ ] **Paso 1: `CLAUDE.md`**

- En «Comandos», después de `bun run models`:

```bash
bun run geo          # Natural Earth → icons/japan.generated.ts (Japón del ícono)
```

  y la línea de `check:path` pasa a `# comprobaciones puras del camino, el terreno, la cámara, el scroll, la fauna y la navegación`.
- En «Arquitectura», después de la línea de `store/useKyotoStore.ts`:

```
├─ components/nav/             ← ★ la navegación (Fase 3C)
│   ├─ JourneyNav.tsx          ← persistente en el layout; estación actual desde la URL
│   ├─ RadialSidebar.tsx       ← el riel de piedras del escritorio
│   ├─ MobileNav.tsx           ← la barra y el abanico
│   ├─ railProgress.ts         ← profundidad → riel, barra y abanico (puro)
│   ├─ useRailProgress.ts      ← la marca «tú», desde gsap.ticker (fuera de React)
│   └─ icons/                  ← los seis íconos calculados + sus microanimaciones
```

  y la línea `├─ components/sections/ ← StationShell, PathTramo (el tramo), ContentArrival` se queda como está.
- En «Cómo se conectan las piezas», un punto nuevo al final:

```markdown
- **La navegación lee la cámara, no la ruta.** `JourneyNav` vive en el layout
  y no se desmonta; la estación actual sale de la URL (`stationFromPathname`)
  para que `aria-current` sea correcto en el HTML estático, y la marca del
  riel la mueve un callback de `gsap.ticker` que lee `PATH.d` (con
  `PATH.live` falso, sin WebGL, se queda en la estación de la URL).
```

- En «Trampas que ya nos mordieron», dos entradas nuevas:

```markdown
- **La consulta de móvil vive dos veces.** `(max-width: 767px), (hover: none)
  and (pointer: coarse)` está en `globals.css` (qué se ve) y en
  `components/nav/navQuery.ts` (qué se enciende). Si cambia en uno y no en el
  otro, queda encendida la navegación que no se ve.
- **Un acto de fauna fija su aspecto al nacer.** Si se gira el móvil a mitad de
  un acto, el cuadro se ensancha y un animal puede verse en el margen por el
  que iba a entrar. Recalcularlo al girar lo teletransportaría, que es peor.
```

  Si en la Tarea 8 «atrás» con `pushState` dio guerra y se cambió, documentar aquí lo que pasó.
- En «Estado de las fases», la fila 3C pasa a `✅ pendiente de revisión`.

- [ ] **Paso 2: `docs/PLAN.md`**

- Cabecera: «Estado: **Fase 3 en curso** — 3A (el mundo), 3B (la fauna en el camino) y 3C (la navegación) implementadas, pendientes de revisión.»
- §5.4: añadir, después del párrafo existente:

```markdown
**Cómo está hecho (Fase 3C).** En escritorio, un **riel de piedras** en el borde
derecho: siete paradas —京都 y las seis estaciones— equiespaciadas sobre un arco.
Plegado es un camino de piedrecitas con la marca «tú», que sigue a la cámara
(lee `PATH.d` desde `gsap.ticker`, fuera de React): en un salto se la ve
recorrer el riel y cada estación por la que pasa destella. Al acercar el cursor
al borde, o con el foco de teclado, se despliega en los seis círculos de
`13.png`, con un pulso *spring*, el kanji y una microanimación por ícono. Los
íconos son **geometría calculada** (`components/nav/icons/`): Japón sale de
Natural Earth (`bun run geo`), la sakura del mismo pétalo que cae en la escena,
y el torii, la pagoda, el farol y el naruto, de sus proporciones. En móvil, y
en cualquier pantalla táctil sin hover, una **barra flotante** con el riel en
horizontal y los mandos; al tocarla, un **abanico** modal que se cierra al
elegir, con el velo, Escape o «atrás». Cada estación tiene su `<title>`
(«Ubicación · Kyoto»). Detalle: `docs/superpowers/specs/2026-10-05-fase-3c-la-navegacion-design.md`.
```
- §10: la fila 3C pasa a `✅ pendiente de revisión`.
- §11, fila «Fauna en vertical»: el estado y los números reales de la Tarea 9 (milano en 9:16 antes y después) y, si el informe marcó conductas por debajo del 40 %, cuáles quedan para revisar con el usuario.

- [ ] **Paso 3: Verificación completa**

Ejecutar: `bun run typecheck`
Esperado: sin errores.

Ejecutar: `bun run check:path`
Esperado: termina con `✓ Todo el camino en orden.`, el `✓` de la fauna y `✓ La navegación en orden.`

Ejecutar: `bun run build`
Esperado: termina sin errores.

Volver a ejecutar las comprobaciones del HTML de las Tareas 5, 7 y 8.

Ejecutar: `git status`
Esperado: limpio salvo la documentación de este paso. Si `next dev` reescribió `AGENTS.md`, comprobar que el diff es solo su bloque, que por convención va en el commit.

- [ ] **Paso 4: Commit**

```powershell
git add CLAUDE.md docs/PLAN.md
git commit -m @'
Fase 3C: documentación de la navegación

CLAUDE.md y el PLAN recogen el riel, la barra con abanico, los íconos
calculados, bun run geo, las dos trampas nuevas y los números de la
fauna en vertical. La 3C queda pendiente de revisión.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

- [ ] **Paso 5: Parar y reportar**

Se acaba la fase: **parar y reportar al usuario**, sin seguir con la Fase 4. El informe incluye:
- qué se hizo y los resultados de `check:path` (el milano en 9:16 y el informe de conductas);
- la lista de comprobaciones manuales de las Tareas 7 y 8 y del «Foco de revisión», para su revisión en el navegador;
- el ajuste del presupuesto de la sakura (6 KB) y cualquier otra desviación del spec.
