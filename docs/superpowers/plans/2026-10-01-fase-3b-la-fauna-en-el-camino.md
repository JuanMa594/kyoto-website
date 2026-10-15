# Fase 3B — La fauna en el camino · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anclar la fauna al mundo: al avanzar por el camino uno se acerca a los animales, los ve crecer y los deja atrás, sin que ninguno desaparezca nunca a la vista ni la cámara entre entre ellos.

**Architecture:** Cada acto guarda al nacer una copia del encuadre de la cámara (`origin`) y se dibuja en un grupo propio en su `anchor`; las conductas siguen en coordenadas locales. Lo que vuela tiene un ancla que se desliza (se deja alcanzar hasta un mínimo y después avanza con la cámara). Un módulo puro nuevo, `fauna/anchoring.ts`, decide dónde nace cada acto, desliza las anclas, prueba si algo está en cuadro con la cámara real y decide cuándo se retira un acto: sólo fuera de cuadro.

**Tech Stack:** Next 16 (export estático), React 19.2.8, three 0.185.1 + R3F 9.7, Zustand 5, bun.

**Spec:** `docs/superpowers/specs/2026-10-01-fase-3b-la-fauna-en-el-camino-design.md`

## Global Constraints

- Runtime y gestor: **bun / bunx**. Nunca `npm` ni `npx`.
- Idioma: comentarios, documentación y textos en **español**; identificadores en inglés.
- `src/config/journey.ts` es la fuente única de verdad.
- La cámara **nunca entra en la escena**.
- Lo que cambia a 60 fps **no vive en el store**: `PATH` (escritor: `CameraRig`), `act.anchor` y los `ActTrack` (escritor: el seguimiento del director, `trackAct`).
- **Ningún animal se retira mientras alguno de sus individuos esté en cuadro** (cámara real, esfera de radio `0,6 · size + 0,3`).
- Valores del spec: `SPAWN_STILL` 1 u/s · `SPAWN_MAX_SPEED` 12 u/s · `LEAD_TIME` 2,5 s · `LEAD_MAX` 18 u · `FOG_CAP` 0,5 · suelo de distancia 15 u (lo que no se desliza siempre) o mínimo + 1 · mínimos de deslizamiento: revolotear 8, bandada 10, cruzarVolando 10, planearEnCirculos 22, visitaAlSuelo 12 (sólo en el aire) · `SLIDE_RANGE` 3 u · apartarse λ = 3/s · `PASSED_DISTANCE` 10 u · `PASSED_ADVANCE` 6 u (0 para los gorriones posados) · `FAR_EXTRA` 10 u · siguiente acto adelantado a 4–8 s · salida extrapolada con el último 15 % y `T₀` 0,6 s · `OVERTIME_LIMIT` 30 s + fundido 1 s · luciérnagas: 2 s de encendido y de apagado · `faunaDistance`: inicio 1, ubicacion 1,2, eventos 0,9, fushimi-inari 1, kiyomizu-dera 1,1, gion 0,8, gastronomia 0,9 · nada visible a menos de 7 u.
- Dentro de un shader no hay backticks. **Esta fase no toca GLSL**; si alguna tarea acabara tocándolo, se compila en un contexto WebGL2 real antes de darlo por bueno.
- **Sin commits**: el usuario revisa el bloque entero y commitea él.
- `tsconfig` incluye `scripts/`: los scripts de comprobación también tienen que pasar `typecheck` (con `noUncheckedIndexedAccess`).
- Entre las tareas 3 y 6 `bun run typecheck` falla a propósito (cambian `FaunaAct` y los parámetros del director antes que sus consumidores). La prueba de esas tareas es `bun run check:path`. Desde la tarea 6 typecheck y build tienen que pasar.
- Si una comprobación falla, se busca la causa (superpowers:systematic-debugging). **No se aflojan los umbrales del spec sin preguntar al usuario.**

## Review Focus

1. **Cambiar el tamaño de la ventana con un acto en escena** (de 16:9 a 21:9 o al revés): el acto conserva los márgenes con los que nació; lo que importa es que no desaparezca a la vista. Lo garantiza la regla de retirada (tarea 4), que mira la cámara real; se comprueba a mano en la revisión (tarea 7).
2. **Activar y desactivar 静 con fauna en escena**: el director se vacía, y al volver empieza de cero sin errores en consola. Revisión manual (tarea 7).
3. **`?fauna=<especie>` en desarrollo**: sigue sacando sólo esa especie con huecos de 3–6 s, ahora anclada. Revisión manual (tarea 7).
4. **Volver con «atrás» o con un enlace en mitad de un acto (viaje)**: lo anclado se queda atrás y se retira fuera de cuadro; lo que vuela acompaña al viaje; no nace nada durante el viaje. Lo cubre el recorrido simulado (tarea 5) y la revisión manual.
5. **Entrar directo a una URL profunda** (`/es/lugares/gion/`): la primera llegada es un aterrizaje sin viaje, `PATH.velocity` vale 0 y la fauna nace a la distancia de Gion. Lo garantiza el código de la tarea 1 (un salto seco deja la velocidad a 0; el script sólo comprueba el valor inicial) y se mira en la revisión manual.

---

### Task 1: Datos — cercanía por estación, velocidad de la cámara y el script de comprobaciones de la fauna

**Files:**
- Create: `scripts/check-kit.ts`
- Modify: `scripts/check-path.ts` (sus utilidades pasan a `check-kit.ts`)
- Create: `scripts/check-fauna.ts`
- Modify: `package.json` (`check:path` corre los dos)
- Modify: `src/config/journey.ts`
- Modify: `src/scene/path/journeyPath.ts`
- Modify: `src/scene/camera/CameraRig.tsx`

**Interfaces:**
- Produces:
  - `scripts/check-kit.ts`: `section(title: string): void`, `check(name: string, ok: boolean, detail?: string): void`, `range(from: number, to: number, step: number): number[]`, `finish(success: string): void`.
  - `StationAmbient.faunaDistance: number` (journey.ts).
  - `PATH.velocity: number` (journeyPath.ts), escrito sólo por `CameraRig`.
  - `scripts/check-fauna.ts`: las tareas siguientes **añaden sus secciones antes de la llamada final a `finish(...)`**.

- [ ] **Step 1: Sacar las utilidades de comprobación a un módulo compartido**

Crear `scripts/check-kit.ts`:

```ts
/**
 * Lo que comparten los scripts de comprobación: secciones, comprobaciones y el
 * resumen final. Sin dependencias: corre con bun, fuera del navegador.
 */

const failures: string[] = [];

export function section(title: string): void {
  console.log(`\n— ${title}`);
}

export function check(name: string, ok: boolean, detail = ''): void {
  const suffix = detail ? ` (${detail})` : '';
  console.log(`${ok ? '✓' : '✗'} ${name}${suffix}`);
  if (!ok) failures.push(name);
}

export function range(from: number, to: number, step: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to + 1e-9; value += step) values.push(value);
  return values;
}

/** Cierra el script: sale con error si algo falló. */
export function finish(success: string): void {
  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} comprobación(es) fallaron.`);
    process.exit(1);
  }
  console.log(`\n✓ ${success}`);
}
```

En `scripts/check-path.ts`, sustituir el bloque de las líneas 54–71:

```ts
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
```

por:

```ts
const DEG = Math.PI / 180;
```

añadir al final de los imports:

```ts
import { check, finish, range, section } from './check-kit';
```

y sustituir el bloque final:

```ts
/* ── Resumen ───────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} comprobación(es) fallaron.`);
  process.exit(1);
}

console.log('\n✓ Todo el camino en orden.');
```

por:

```ts
/* ── Resumen ───────────────────────────────────────────────────────────── */

finish('Todo el camino en orden.');
```

En la cabecera de `check-path.ts`, cambiar `* Comprobaciones puras del camino (Fase 3A).` por `* Comprobaciones puras del camino (Fase 3A). La fauna tiene las suyas en check-fauna.ts.`

- [ ] **Step 2: Comprobar que `check-path` sigue igual**

Run: `bun run scripts/check-path.ts`
Expected: la misma salida que antes, terminando en `✓ Todo el camino en orden.`

- [ ] **Step 3: Escribir las primeras comprobaciones de la fauna (fallan)**

Crear `scripts/check-fauna.ts`:

```ts
/**
 * Comprobaciones puras de la fauna en el camino (Fase 3B).
 *
 * La fauna está anclada al mundo: al avanzar, la cámara se acerca a los
 * animales y los deja atrás. Lo que importa —que nada aparezca ni desaparezca a
 * la vista, que nada visible quede demasiado cerca, que lo que pisa pise el
 * terreno— se comprueba aquí, fuera del navegador, con una cámara de three
 * colocada por el mismo rig que la del sitio. Lo que sólo se ve en pantalla
 * (que se sienta vivo) es la revisión visual.
 *
 * Uso: bun run check:path (corre después de check-path.ts)
 */

import { JOURNEY, PATH_LENGTH } from '../src/config/journey';
import { blendByZone, PATH, stationIndex } from '../src/scene/path/journeyPath';
import { check, finish, range, section } from './check-kit';

type Slug = Parameters<typeof stationIndex>[0];

/* ── 1. La cercanía por estación ───────────────────────────────────────── */

section('La cercanía por estación');

check(
  'cada estación declara su faunaDistance (0,6–1,4)',
  JOURNEY.every((s) => s.ambient.faunaDistance >= 0.6 && s.ambient.faunaDistance <= 1.4),
);
const nearness = (slug: Slug) => JOURNEY[stationIndex(slug)]!.ambient.faunaDistance;
check('Gion, íntimo, nace más cerca que Ubicación, panorámica', nearness('gion') < nearness('ubicacion'));

let nearnessStep = 0;
let previousNearness = blendByZone(0, (s) => s.ambient.faunaDistance);
for (const d of range(0, PATH_LENGTH, 0.1)) {
  const now = blendByZone(d, (s) => s.ambient.faunaDistance);
  nearnessStep = Math.max(nearnessStep, Math.abs(now - previousNearness));
  previousNearness = now;
}
check(
  'la cercanía se funde entre estaciones, sin saltos',
  nearnessStep < 0.01,
  `máx ${nearnessStep.toFixed(4)} por 0,1 u`,
);
check('PATH lleva la velocidad de la cámara, en reposo a 0', PATH.velocity === 0);

/* ── Resumen ───────────────────────────────────────────────────────────── */

finish('La fauna, en orden.');
```

En `package.json`, cambiar:

```json
    "check:path": "bun run scripts/check-path.ts"
```

por:

```json
    "check:path": "bun run scripts/check-path.ts && bun run scripts/check-fauna.ts"
```

- [ ] **Step 4: Ejecutar y ver que falla**

Run: `bun run scripts/check-fauna.ts`
Expected: FAIL — `✗ cada estación declara su faunaDistance`, `✗ PATH lleva la velocidad…`, y `✗ 3 comprobación(es) fallaron.` (o 4: la de Gion también, con `undefined`).

- [ ] **Step 5: `faunaDistance` en `journey.ts`**

En `interface StationAmbient`, después de `readonly fauna: readonly FaunaKind[];`, añadir:

```ts
  /**
   * A qué distancia de la cámara nace la fauna de esta zona, como factor de la
   * de cada especie: 1 = la de siempre, 0,8 = un 20 % más cerca. Se mezcla por
   * zonas a lo largo del tramo y nunca acerca nada por debajo del suelo de
   * distancia de `scene/systems/fauna/anchoring.ts` (Fase 3B).
   */
  readonly faunaDistance: number;
```

Y en cada estación, justo después de su línea `fauna: [...]`:

| Línea existente | Añadir debajo |
|---|---|
| `fauna: ['garza', 'gorrion'],` (inicio) | `faunaDistance: 1,` |
| `fauna: ['libelula', 'garza'],` (ubicacion) | `faunaDistance: 1.2,` |
| `fauna: ['mariposa', 'gorrion'],` (eventos) | `faunaDistance: 0.9,` |
| `fauna: ['milano', 'ardilla', 'gorrion'],` (fushimi-inari) | `faunaDistance: 1,` |
| `fauna: ['ardilla', 'garza', 'milano'],` (kiyomizu-dera) | `faunaDistance: 1.1,` |
| `fauna: ['gato', 'luciernaga', 'tanuki'],` (gion) | `faunaDistance: 0.8,` |
| `fauna: ['gorrion', 'carpa'],` (gastronomia) | `faunaDistance: 0.9,` |

De paso, ordenar los dos comentarios de tramo que quedaron cruzados en la sesión anterior. Sustituir:

```ts
/**
 * De Ubicación a la sakura: dónde está Kyoto y cómo es, antes de llegar a los
 * cerezos. Provisional: las dos tarjetas de mapa dejan el hueco del mapa
 * antiguo desplegable, que se hace en la Fase 5.
 */
/**
 * De la sakura a Fushimi Inari: 50 unidades llanas entre los cerezos antes de
 * que empiece la subida. Sin ellas, al llegar a Eventos ya se veía la cuesta.
 */
const TRAMO_EVENTOS: StationTramo = { cards: [], flat: 50 };

const TRAMO_UBICACION: StationTramo = {
```

por:

```ts
/**
 * De la sakura a Fushimi Inari: 50 unidades llanas entre los cerezos antes de
 * que empiece la subida. Sin ellas, al llegar a Eventos ya se veía la cuesta.
 */
const TRAMO_EVENTOS: StationTramo = { cards: [], flat: 50 };

/**
 * De Ubicación a la sakura: dónde está Kyoto y cómo es, antes de llegar a los
 * cerezos. Provisional: las dos tarjetas de mapa dejan el hueco del mapa
 * antiguo desplegable, que se hace en la Fase 5.
 */
const TRAMO_UBICACION: StationTramo = {
```

- [ ] **Step 6: `PATH.velocity`**

En `src/scene/path/journeyPath.ts`, en el tipo de `PATH`, después de `offset: number;` y su comentario, añadir:

```ts
  /**
   * Avance de la cámara con signo, suavizado, en u/s; 0 tras un salto seco.
   * La fauna decide con él si nace por delante o no nace (Fase 3B).
   */
  velocity: number;
```

y en el valor inicial, después de `offset: 0,`:

```ts
  velocity: 0,
```

En `src/scene/camera/CameraRig.tsx`, sustituir:

```ts
      if (wasReady && !snap) PATH.advance += rig.d - before;
```

por:

```ts
      if (wasReady && !snap) PATH.advance += rig.d - before;
      // Con la misma amortiguación que la velocidad del rig. Un salto seco no
      // es caminar: la velocidad vuelve a 0.
      PATH.velocity =
        wasReady && !snap && dt > 0 ? damp(PATH.velocity, (rig.d - before) / dt, 8, dt) : 0;
```

(`damp` ya está importado en ese archivo.)

- [ ] **Step 7: Ejecutar las comprobaciones y el typecheck**

Run: `bun run check:path`
Expected: PASS — termina en `✓ Todo el camino en orden.` y después `✓ La fauna, en orden.`

Run: `bun run typecheck`
Expected: sin errores.

---

### Task 2: `anchoring.ts` — dónde nace, el ancla que se desliza y la cámara real

**Files:**
- Create: `src/scene/systems/fauna/anchoring.ts`
- Modify: `scripts/check-fauna.ts`

**Interfaces:**
- Consumes: `StationAmbient.faunaDistance` (Task 1); `blendByZone`, `frameToWorld`, `PathFrame`, `Point3` (journeyPath.ts); `CAMERA_BASE` (framing.ts); `BehaviorName`, `isAerial` (bestiary.ts).
- Produces (anchoring.ts):
  - Constantes: `CAMERA_Z = 13`, `SPAWN_STILL`, `SPAWN_MAX_SPEED`, `LEAD_TIME`, `LEAD_MAX`, `FOG_CAP`, `MIN_DISTANCE`, `SLIDE_RANGE`, `SLIDE_RESTORE`.
  - `type SlideMode = 'siempre' | 'en vuelo' | 'nunca'`; `SLIDE: Readonly<Record<BehaviorName, { mode: SlideMode; min: number }>>`.
  - `spawnAllowed(velocity: number, traveling: boolean): boolean`
  - `leadFor(velocity: number): number`
  - `faunaDistanceAt(d: number): number`, `fogFarAt(d: number): number`
  - `spawnFloor(behavior: BehaviorName): number`
  - `spawnDistance(base: number, factor: number, floor: number, lead: number, fogFar: number): number`
  - `slideStep(push: number, distance: number, advance: number, min: number, dt: number): number`
  - `interface Viewer { frustum: Frustum; position: Vector3; forward: { x: number; z: number } }`, `createViewer(): Viewer`, `updateViewer(viewer: Viewer, camera: Camera): void`
  - `viewRadius(size: number): number`, `inView(viewer, x, y, z, radius): boolean`, `forwardDistance(viewer, x, z): number`, `localToWorld(frame: PathFrame, x, y, z, out: Point3): Point3`

- [ ] **Step 1: Escribir las comprobaciones (fallan: el módulo no existe)**

En `scripts/check-fauna.ts`, añadir a los imports:

```ts
import { PerspectiveCamera } from 'three';

import { CAMERA_BASE } from '../src/scene/camera/framing';
import { createRig, snapRig } from '../src/scene/camera/pathRig';
import { groundY } from '../src/scene/systems/elevation';
import {
  createViewer,
  forwardDistance,
  inView,
  leadFor,
  localToWorld,
  SLIDE,
  slideStep,
  spawnAllowed,
  spawnDistance,
  spawnFloor,
  updateViewer,
  CAMERA_Z,
} from '../src/scene/systems/fauna/anchoring';
import { isAerial, type BehaviorName } from '../src/scene/systems/fauna/bestiary';
```

Después de `type Slug = …`, añadir las utilidades comunes:

```ts
/** Todas las conductas del bestiario: el `satisfies` obliga a añadir aquí las nuevas. */
const BEHAVIORS = Object.keys({
  cruzarVolando: true,
  planearEnCirculos: true,
  visitaAlSuelo: true,
  vadear: true,
  bandada: true,
  correrYParar: true,
  perseguir: true,
  deambular: true,
  callejear: true,
  revolotear: true,
  titilar: true,
} satisfies Record<BehaviorName, true>) as BehaviorName[];

/** Como el `<Canvas>` de `SceneCanvas.tsx`. */
const CAMERA_FAR = 400;

/** La cámara del sitio en `d`, como la coloca `CameraRig` (sin parallax). */
function cameraAt(d: number, aspect: number) {
  const rig = createRig();
  snapRig(rig, d);
  const camera = new PerspectiveCamera(CAMERA_BASE.fov, aspect, 0.1, CAMERA_FAR);
  camera.position.set(rig.camera.x, rig.camera.y, rig.camera.z);
  camera.lookAt(rig.focus.x, rig.focus.y, rig.focus.z);
  camera.updateMatrixWorld();
  const viewer = createViewer();
  updateViewer(viewer, camera);
  return { rig, camera, viewer };
}
```

Antes del bloque `/* ── Resumen ── */`, añadir:

```ts
/* ── 2. Cuándo y dónde nace ────────────────────────────────────────────── */

section('Cuándo y dónde nace');

check(
  'nace quieto, leyendo y caminando hasta 12 u/s',
  spawnAllowed(0, false) && spawnAllowed(-0.5, false) && spawnAllowed(6, false) && spawnAllowed(12, false),
);
check(
  'no nace caminando rápido, retrocediendo ni en un viaje',
  !spawnAllowed(12.5, false) && !spawnAllowed(-2, false) && !spawnAllowed(0, true) && !spawnAllowed(Number.NaN, false),
);
check(
  'ventaja: nada quieto, v · 2,5 s caminando, tope 18 u',
  leadFor(0) === 0 && leadFor(0.5) === 0 && leadFor(4) === 10 && leadFor(6) === 15 && leadFor(12) === 18,
);
check(
  'suelos de distancia: 15 u lo que no se desliza siempre; su mínimo + 1 lo demás',
  spawnFloor('vadear') === 15 &&
    spawnFloor('visitaAlSuelo') === 15 &&
    spawnFloor('revolotear') === 9 &&
    spawnFloor('bandada') === 11 &&
    spawnFloor('planearEnCirculos') === 23,
);
check('sin cercanía ni ventaja, la distancia de siempre', spawnDistance(20, 1, 15, 0, 90) === 20);
check('la cercanía acerca', spawnDistance(20, 0.8, 15, 0, 90) === 16);
check('…pero no por debajo del suelo', spawnDistance(17, 0.8, 15, 0, 90) === 15);
check('…salvo que la especie ya naciera más cerca', spawnDistance(12, 0.8, 15, 0, 90) === 12);
check('la ventaja se suma', spawnDistance(20, 1, 15, 10, 90) === 30);
check('con ventaja, nada más lejos que media niebla', spawnDistance(20, 1, 15, 18, 55) === 27.5);
check('…ni más cerca de lo que ya nacía', spawnDistance(30, 1, 15, 18, 55) === 30);

/* ── 3. El ancla que se desliza ────────────────────────────────────────── */

section('El ancla que se desliza');

check(
  'sólo se desliza lo que vuela (y los gorriones que se posan, en el aire)',
  BEHAVIORS.every((b) => SLIDE[b].mode === 'nunca' || isAerial(b) || b === 'visitaAlSuelo'),
);
check(
  'lo que anda y las luciérnagas no se deslizan nunca',
  (['vadear', 'correrYParar', 'perseguir', 'deambular', 'callejear', 'titilar'] as const).every(
    (b) => SLIDE[b].mode === 'nunca',
  ),
);

{
  // La cámara camina a 6 u/s hacia algo que vuela, nacido a 20 u, mínimo 10.
  const dt = 1 / 60;
  let push = 0;
  let walked = 0;
  let closest = Infinity;
  let biggestStep = 0;
  for (let i = 0; i < 600; i += 1) {
    walked += 6 * dt;
    const distance = 20 - walked + push;
    const next = slideStep(push, distance, 6 * dt, 10, dt);
    biggestStep = Math.max(biggestStep, next - push);
    push = next;
    closest = Math.min(closest, 20 - walked + push);
  }
  const final = 20 - walked + push;
  check('se deja alcanzar hasta su mínimo y no más', closest >= 10 - 1e-9, `mín ${closest.toFixed(3)} u`);
  check('después avanza con la cámara', Math.abs(final - 10) < 0.3, `a ${final.toFixed(2)} u`);
  check('nunca avanza más que la cámara', biggestStep <= 6 * dt + 1e-12);
}
check('con la cámara quieta no se mueve', slideStep(5, 15, 0, 10, 1 / 60) === 5);
check('si la cámara retrocede no vuelve atrás', slideStep(5, 12, -0.2, 10, 1 / 60) === 5);
{
  // Unos gorriones que alzan el vuelo a 6 u, mínimo 12, con la cámara quieta.
  const dt = 1 / 60;
  let push = 0;
  let biggestStep = 0;
  for (let i = 0; i < 120; i += 1) {
    const next = slideStep(push, 6 + push, 0, 12, dt);
    biggestStep = Math.max(biggestStep, next - push);
    push = next;
  }
  check(
    'lo que arranca a volar ya cerca se aparta hasta su mínimo, suave',
    6 + push > 11.5 && biggestStep < 0.35,
    `a ${(6 + push).toFixed(2)} u en 2 s; paso máx ${biggestStep.toFixed(2)} u`,
  );
}

/* ── 4. La cámara real ─────────────────────────────────────────────────── */

section('La cámara real');

{
  // En la Home el camino es llano: el suelo sale por abajo a 12,6 u. (El
  // rumbo no es exactamente 0 —promedia la tangente en ±10 u—: por eso los
  // puntos se toman a lo largo de la mirada real.)
  const { rig, viewer } = cameraAt(0, 16 / 9);
  const ahead = (distance: number) => ({
    x: viewer.position.x + viewer.forward.x * distance,
    z: viewer.position.z + viewer.forward.z * distance,
  });
  const groundAhead = (distance: number) => {
    const { x, z } = ahead(distance);
    return inView(viewer, x, groundY(x, z), z, 0.01);
  };
  check('el suelo a 18 u se ve', groundAhead(18));
  check('el suelo a 11 u ya no (salió por abajo)', !groundAhead(11));
  const point = ahead(18);
  const along = forwardDistance(viewer, point.x, point.z);
  check('la distancia se mide a lo largo de la mirada', Math.abs(along - 18) < 1e-6, `${along.toFixed(6)}`);
  const atCamera = localToWorld(rig.frame, 0, 0, CAMERA_Z, { x: 0, y: 0, z: 0 });
  check(
    'z local 13 es la posición de la cámara en su encuadre',
    Math.hypot(atCamera.x - rig.camera.x, atCamera.z - rig.camera.z) < 1e-9,
  );
}
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `bun run scripts/check-fauna.ts`
Expected: FAIL — error de import: `Cannot find module '…/fauna/anchoring'`.

- [ ] **Step 3: Crear `anchoring.ts`**

Crear `src/scene/systems/fauna/anchoring.ts`:

```ts
/**
 * ★ Dónde vive cada acto de la fauna en el mundo (Fase 3B).
 *
 * Desde 3B la fauna está **anclada al mundo**, como las piedras. Al nacer, cada
 * acto guarda una copia del encuadre de la cámara (`act.origin`) y sus
 * conductas —escritas en coordenadas locales— quedan en ese sitio: al avanzar,
 * la cámara se acerca a los animales, los ve crecer y los deja atrás. Lo que
 * anda sale por el borde inferior a unas 10 u; la cámara pasa por encima, nunca
 * entre ellos.
 *
 * Lo que vuela no puede anclarse sin más: la franja alta, vista de cerca, baja
 * hasta la altura de la cámara, y una bandada anclada acabaría cruzando a un
 * par de unidades del objetivo. Por eso su ancla **se desliza**: se deja
 * alcanzar hasta un mínimo y a partir de ahí avanza con la cámara (`SLIDE`).
 *
 * Aquí viven también las reglas de dónde y cuándo nace un acto, la prueba de
 * cuadro con la cámara real y la regla que más importa de la fauna: **un acto
 * sólo se retira cuando ninguno de sus individuos está en cuadro**.
 *
 * Módulo puro —three sólo como matemática—: `bun run check:path` lo recorre.
 */

import { Frustum, Matrix4, Sphere, Vector3, type Camera } from 'three';

import { smoothstep } from '@/lib/procedural';
import { CAMERA_BASE } from '@/scene/camera/framing';
import { blendByZone, frameToWorld, type PathFrame, type Point3 } from '@/scene/path/journeyPath';

import type { BehaviorName } from './bestiary';

/**
 * z local de la cámara en `CAMERA_BASE`: algo a una distancia D de la cámara
 * está a la profundidad local `CAMERA_Z − D`.
 */
export const CAMERA_Z = CAMERA_BASE.position[2];

/* ── El ancla que se desliza ───────────────────────────────────────────── */

export type SlideMode = 'siempre' | 'en vuelo' | 'nunca';

interface Slide {
  readonly mode: SlideMode;
  /** Distancia mínima de su punto base a la cámara (u). */
  readonly min: number;
}

const NEVER: Slide = { mode: 'nunca', min: 0 };

/**
 * Qué se desliza y cuánto se deja alcanzar. Lo que anda, nunca: deslizarlo
 * sería hacerlo patinar, que es justo lo que arregla la Fase 3B. Los gorriones
 * que bajan a posarse, sólo mientras están en el aire.
 */
export const SLIDE: Readonly<Record<BehaviorName, Slide>> = {
  revolotear: { mode: 'siempre', min: 8 },
  bandada: { mode: 'siempre', min: 10 },
  cruzarVolando: { mode: 'siempre', min: 10 },
  planearEnCirculos: { mode: 'siempre', min: 22 },
  visitaAlSuelo: { mode: 'en vuelo', min: 12 },
  vadear: NEVER,
  correrYParar: NEVER,
  perseguir: NEVER,
  deambular: NEVER,
  callejear: NEVER,
  titilar: NEVER,
};

/** Entre `min + SLIDE_RANGE` y `min` el ancla pasa de quieta a avanzar con la cámara (u). */
export const SLIDE_RANGE = 3;
/** Con qué constante (1/s) se aparta hasta su mínimo lo que arranca a volar ya más cerca. */
export const SLIDE_RESTORE = 3;

/**
 * Un frame del ancla que se desliza: cuánto se ha deslizado después de que la
 * cámara avance `advance` u, estando su punto base a `distance` u.
 *
 *   · **Seguir**: avanza `advance · w`, con `w` de 0 (a `min + 3` o más) a 1
 *     (en `min`). La velocidad no da saltos, y con la cámara quieta no se mueve.
 *   · **Apartarse**: si ya está más cerca que su mínimo —unos gorriones que alzan
 *     el vuelo junto a la cámara—, se aleja suave hasta él.
 *   · Nunca retrocede: si la cámara vuelve atrás, se queda donde llegó.
 */
export function slideStep(
  push: number,
  distance: number,
  advance: number,
  min: number,
  dt: number,
): number {
  const follow = Math.max(0, advance) * smoothstep(min + SLIDE_RANGE, min, distance);
  const restore = Math.max(0, min - distance) * (1 - Math.exp(-SLIDE_RESTORE * Math.max(0, dt)));
  return push + follow + restore;
}

/* ── Cuándo y dónde nace ───────────────────────────────────────────────── */

/** Por debajo de esta velocidad (u/s, en valor absoluto) la cámara está quieta. */
export const SPAWN_STILL = 1;
/** Por encima no nace nada: se pasaría antes de que entrara en cuadro (~40vh/s). */
export const SPAWN_MAX_SPEED = 12;
/** La ventaja al caminar es lo que se avanza en este tiempo (s)… */
export const LEAD_TIME = 2.5;
/** …con este tope (u). */
export const LEAD_MAX = 18;
/** Con ventaja, nada nace más lejos que esta fracción de la niebla lejana. */
export const FOG_CAP = 0.5;
/** Suelo de distancia de lo que no se desliza siempre (u). */
export const MIN_DISTANCE = 15;

/**
 * ¿Puede nacer algo ahora? No en un viaje (la cámara pasa de largo), no
 * caminando rápido y no retrocediendo: el cuadro se ensancha y la entrada del
 * acto quedaría a la vista.
 */
export function spawnAllowed(velocity: number, traveling: boolean): boolean {
  if (traveling || !Number.isFinite(velocity)) return false;
  if (velocity < -SPAWN_STILL) return false;
  return velocity <= SPAWN_MAX_SPEED;
}

/** Ventaja con la que nace lo que no se desliza siempre si la cámara camina hacia delante. */
export function leadFor(velocity: number): number {
  if (!(velocity >= SPAWN_STILL)) return 0;
  return Math.min(velocity * LEAD_TIME, LEAD_MAX);
}

/** La cercanía de la zona en `d`, mezclada entre estaciones. */
export function faunaDistanceAt(d: number): number {
  return blendByZone(d, (station) => station.ambient.faunaDistance);
}

/** La niebla lejana de la zona en `d`, mezclada entre estaciones. */
export function fogFarAt(d: number): number {
  return blendByZone(d, (station) => station.ambient.fog.far);
}

/** Por debajo de qué distancia no puede acercarlo la cercanía de la zona. */
export function spawnFloor(behavior: BehaviorName): number {
  const slide = SLIDE[behavior];
  return slide.mode === 'siempre' ? slide.min + 1 : MIN_DISTANCE;
}

/**
 * A qué distancia de la cámara nace un acto (§4.3 del spec de 3B).
 *
 * `base` es la distancia sorteada en el rango de su especie. La cercanía de la
 * zona la escala, sin bajar del suelo —salvo que la especie ya naciera más
 * cerca—, y la ventaja la aleja, sin pasar de media niebla.
 */
export function spawnDistance(
  base: number,
  factor: number,
  floor: number,
  lead: number,
  fogFar: number,
): number {
  const near = Math.max(base * factor, Math.min(base, floor));
  if (lead <= 0) return near;
  return Math.min(near + lead, Math.max(near, FOG_CAP * fogFar));
}

/* ── La cámara real ────────────────────────────────────────────────────── */

/** Lo que hace falta de la cámara de este frame para saber qué se ve. */
export interface Viewer {
  readonly frustum: Frustum;
  readonly position: Vector3;
  /** Dirección de la mirada en el plano XZ, unitaria. */
  readonly forward: { x: number; z: number };
}

const PROJECTION = new Matrix4();
const LOOK = new Vector3();
const PROBE = new Sphere();

export function createViewer(): Viewer {
  return { frustum: new Frustum(), position: new Vector3(), forward: { x: 0, z: -1 } };
}

/** Copia la cámara de este frame. Sus matrices tienen que estar al día (`updateMatrixWorld()`). */
export function updateViewer(viewer: Viewer, camera: Camera): void {
  PROJECTION.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  viewer.frustum.setFromProjectionMatrix(PROJECTION);
  viewer.position.setFromMatrixPosition(camera.matrixWorld);
  camera.getWorldDirection(LOOK);
  const flat = Math.hypot(LOOK.x, LOOK.z) || 1;
  viewer.forward.x = LOOK.x / flat;
  viewer.forward.z = LOOK.z / flat;
}

/** Radio con el que se prueba si un individuo está en cuadro: su cuerpo y un margen. */
export function viewRadius(size: number): number {
  return 0.6 * size + 0.3;
}

/** ¿Toca el cuadro la esfera de radio `radius` en (x, y, z)? */
export function inView(viewer: Viewer, x: number, y: number, z: number, radius: number): boolean {
  PROBE.center.set(x, y, z);
  PROBE.radius = radius;
  return viewer.frustum.intersectsSphere(PROBE);
}

/** Distancia horizontal de la cámara a un punto, a lo largo de la mirada. Negativa: detrás. */
export function forwardDistance(viewer: Viewer, x: number, z: number): number {
  return (x - viewer.position.x) * viewer.forward.x + (z - viewer.position.z) * viewer.forward.z;
}

/** De las coordenadas locales de un encuadre al mundo. */
export function localToWorld(frame: PathFrame, x: number, y: number, z: number, out: Point3): Point3 {
  frameToWorld(frame, x, z, out);
  out.y = frame.y + y;
  return out;
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `bun run check:path`
Expected: PASS — las secciones nuevas en verde y `✓ La fauna, en orden.`

Run: `bun run typecheck`
Expected: sin errores.

---

### Task 3: Las conductas en el mundo — ancla, márgenes, salida, milano y luciérnagas

**Files:**
- Modify: `src/scene/systems/fauna/behaviors.ts`
- Modify: `src/scene/objects/fauna/FireflyRig.tsx`
- Modify: `scripts/check-fauna.ts`

**Interfaces:**
- Consumes: `CAMERA_Z`, `SLIDE`, `leadFor`, `spawnDistance`, `spawnFloor`, `createViewer`, `updateViewer`, `inView`, `viewRadius`, `localToWorld`, `type Viewer` (Task 2).
- Produces (behaviors.ts):
  - `FaunaAct` gana `origin: Readonly<PathFrame>`, `anchor: PathFrame` (mutable; escritor único: `trackAct`, Task 4), `spawnD: number`, `aspect: number` (ya acotado a ≥ 16:9).
  - `FaunaPose.fade: number` (presencia de una luz, 0–1; 1 en todo lo demás).
  - `groundAt(act: FaunaAct, x: number, z: number): number`
  - `placeAt(act: FaunaAct, member: number, seconds: number, out: Point3): void`
  - `extrapolates(behavior: BehaviorName): boolean`
  - `inFlight(act: FaunaAct, seconds: number): boolean`
  - `OVERTIME_LIMIT = 30`, `OVERTIME_FADE = 1`

- [ ] **Step 1: Escribir las comprobaciones (fallan)**

En `scripts/check-fauna.ts`, añadir a los imports:

```ts
import type { FaunaKind } from '../src/config/journey';
import { lerp, mulberry32 } from '../src/lib/procedural';
import { dominantZone, STATION_DEPTHS } from '../src/scene/path/journeyPath';
import { viewRadius, type Viewer } from '../src/scene/systems/fauna/anchoring';
import {
  createPose,
  OVERTIME_FADE,
  OVERTIME_LIMIT,
  placeAt,
  poseFor,
  type FaunaAct,
} from '../src/scene/systems/fauna/behaviors';
import {
  availableSpecies,
  durationFor,
  membersFor,
  speciesSpec,
} from '../src/scene/systems/fauna/bestiary';
```

(Juntar con los imports que ya existen de esos mismos módulos: un solo `import` por módulo.)

Después de `cameraAt`, añadir:

```ts
let actIds = 0;

/** Un acto como lo montaría el director, a mano: especie, conducta, cámara y distancia. */
function buildAct(
  kind: FaunaKind,
  behavior: BehaviorName,
  d: number,
  aspect: number,
  distance: number,
  seed: number,
): { act: FaunaAct; viewer: Viewer } {
  const { rig, viewer } = cameraAt(d, aspect);
  const random = mulberry32(seed);
  const spec = speciesSpec(kind)!;
  const duration = durationFor(behavior, random);
  actIds += 1;
  const act: FaunaAct = {
    id: actIds,
    species: kind,
    spec,
    behavior,
    members: membersFor(behavior, random, spec, duration),
    duration,
    startedAt: 0,
    direction: random() < 0.5 ? -1 : 1,
    depth: CAMERA_Z - distance,
    seed: Math.floor(random() * 10000),
    origin: { ...rig.frame },
    anchor: { ...rig.frame },
    spawnD: d,
    aspect: Math.max(aspect, 16 / 9),
  };
  return { act, viewer };
}

const LOCAL = { x: 0, y: 0, z: 0 };
const WORLD = { x: 0, y: 0, z: 0 };

/** ¿Se ve el individuo `member` a los `seconds` de su acto? */
function memberSeen(act: FaunaAct, member: number, seconds: number, viewer: Viewer): boolean {
  placeAt(act, member, seconds, LOCAL);
  localToWorld(act.anchor, LOCAL.x, LOCAL.y, LOCAL.z, WORLD);
  return inView(viewer, WORLD.x, WORLD.y, WORLD.z, viewRadius(act.spec.size));
}

const members = (act: FaunaAct) => Array.from({ length: act.members }, (_, member) => member);
```

Antes del bloque `/* ── Resumen ── */`, añadir:

```ts
/* ── 5. Las conductas en el mundo ──────────────────────────────────────── */

section('Las conductas en el mundo');

// Cada especie con cada conducta, en cada estación y a medio tramo (curvas y
// cuestas), con cuatro aspectos de pantalla, quieta y caminando.
const ASPECTS = [9 / 16, 4 / 3, 16 / 9, 21 / 9];
const SAMPLE_DEPTHS = STATION_DEPTHS.flatMap((d, i) => {
  const next = STATION_DEPTHS[i + 1];
  return next === undefined ? [d] : [d, (d + next) / 2];
});

const sweep: { act: FaunaAct; viewer: Viewer }[] = [];
for (const d of SAMPLE_DEPTHS) {
  const station = JOURNEY[dominantZone(d)]!;
  for (const kind of availableSpecies(station.ambient.fauna)) {
    const spec = speciesSpec(kind)!;
    for (const behavior of spec.behaviors) {
      for (const aspect of ASPECTS) {
        for (const velocity of [0, 6, 12]) {
          for (const pick of [0, 0.5, 1]) {
            const base = CAMERA_Z - lerp(spec.depth[0], spec.depth[1], pick);
            const lead = SLIDE[behavior].mode === 'siempre' ? 0 : leadFor(velocity);
            const distance = spawnDistance(
              base,
              station.ambient.faunaDistance,
              spawnFloor(behavior),
              lead,
              station.ambient.fog.far,
            );
            sweep.push(buildAct(kind, behavior, d, aspect, distance, sweep.length + 1));
          }
        }
      }
    }
  }
}

const label = (act: FaunaAct) => `${act.species} (${act.behavior}) en d=${act.spawnD.toFixed(0)}`;
const lights = sweep.filter(({ act }) => act.behavior === 'titilar');
const bodies = sweep.filter(({ act }) => act.behavior !== 'titilar');

const startsInView = bodies.filter(({ act, viewer }) => members(act).some((m) => memberSeen(act, m, 0, viewer)));
check(
  `todo lo que tiene cuerpo empieza fuera de cuadro (${bodies.length} actos)`,
  startsInView.length === 0,
  startsInView.slice(0, 3).map(({ act }) => label(act)).join('; '),
);
const endsInView = bodies.filter(({ act, viewer }) =>
  members(act).some((m) => memberSeen(act, m, act.duration, viewer)),
);
check(
  'y termina fuera de cuadro, con la cámara quieta (el milano también)',
  endsInView.length === 0,
  endsInView.slice(0, 3).map(({ act }) => label(act)).join('; '),
);

const fadeAt = (act: FaunaAct, seconds: number) => {
  const pose = createPose();
  poseFor(act, 0, seconds, pose);
  return pose.fade;
};
check(
  'las luciérnagas se encienden y se apagan: presencia 0 al empezar y al terminar, 1 a mitad',
  lights.length > 0 &&
    lights.every(({ act }) => fadeAt(act, 0) === 0 && fadeAt(act, act.duration) === 0 && fadeAt(act, act.duration / 2) === 1),
);

const P = { x: 0, y: 0, z: 0 };
const Q = { x: 0, y: 0, z: 0 };
const gap = (act: FaunaAct, member: number, a: number, b: number) => {
  placeAt(act, member, a, P);
  placeAt(act, member, b, Q);
  return Math.hypot(Q.x - P.x, Q.z - P.z);
};

let slowestExit = Infinity;
for (const { act } of bodies) {
  for (const m of members(act)) {
    const span = act.duration * 0.15;
    slowestExit = Math.min(slowestExit, gap(act, m, act.duration - span, act.duration) / span);
  }
}
check('todo lo que sale de cuadro sale a más de 0,3 u/s', slowestExit > 0.3, `mín ${slowestExit.toFixed(2)} u/s`);
check(
  'más allá de su tiempo sigue su camino: sin salto en el empalme y sin pararse',
  bodies.every(({ act }) =>
    members(act).every((m) => gap(act, m, act.duration, act.duration + 1e-3) < 1e-2 && gap(act, m, act.duration, act.duration + 5) > 1),
  ),
);
check(
  'las luciérnagas no siguen: se quedan donde se apagan',
  lights.every(({ act }) => gap(act, 0, act.duration, act.duration + 5) === 0),
);

const scaleAt = (act: FaunaAct, seconds: number) => {
  const pose = createPose();
  poseFor(act, 0, seconds, pose);
  return pose.scale;
};
check(
  'ya no se encoge al terminar',
  bodies.every(({ act }) => scaleAt(act, act.duration - 0.01) === 1),
);
check(
  'red de seguridad: 30 s después de su fin, fundido de 1 s',
  bodies.every(({ act }) => scaleAt(act, act.duration + OVERTIME_LIMIT + OVERTIME_FADE + 0.1) === 0),
);

// Lo que pisa, pisa el terreno del mundo: en cada muestra en que no está en el
// aire, su centro está a `ride · size` del suelo (2 cm de tolerancia: el gato
// que deambula lleva un desfase de 1 cm a propósito).
let floating = 0;
let groundSamples = 0;
for (const { act } of bodies) {
  if (isAerial(act.behavior)) continue;
  for (const m of members(act)) {
    const pose = createPose();
    for (const seconds of range(0, act.duration + 3, 0.5)) {
      pose.heading = 0;
      poseFor(act, m, seconds, pose);
      if (pose.airborne >= 0.05) continue;
      localToWorld(act.anchor, pose.x, pose.y, pose.z, WORLD);
      const expected = groundY(WORLD.x, WORLD.z) + act.spec.ride * act.spec.size;
      groundSamples += 1;
      if (Math.abs(WORLD.y - expected) > 0.02) floating += 1;
    }
  }
}
check('lo que pisa, pisa el terreno, también en las cuestas', floating === 0, `${floating} de ${groundSamples} muestras`);
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `bun run scripts/check-fauna.ts`
Expected: FAIL — `placeAt`, `OVERTIME_LIMIT` y `OVERTIME_FADE` no existen (`SyntaxError: Export named 'placeAt' not found`).

- [ ] **Step 3: El acto en el mundo (`behaviors.ts`)**

En los imports, sustituir:

```ts
import { frameToWorld, PATH } from '@/scene/path/journeyPath';
```

por:

```ts
import { frameToWorld, type PathFrame, type Point3 } from '@/scene/path/journeyPath';
```

y:

```ts
import { catPlan, type BehaviorName, type SpeciesSpec } from './bestiary';
```

por:

```ts
import { catPlan, isAerial, type BehaviorName, type SpeciesSpec } from './bestiary';
```

En `interface FaunaAct`, después de `readonly seed: number;`, añadir:

```ts
  /**
   * El encuadre de la cámara al nacer (`PATH.frame`): el sitio del mundo donde
   * vive el acto. Sus conductas están escritas en coordenadas locales de él.
   */
  readonly origin: Readonly<PathFrame>;
  /**
   * Dónde está ahora: `origin`, salvo que lo que vuela se haya deslizado
   * (`anchoring.ts`). Es lo único que cambia de un acto y tiene un solo
   * escritor, `trackAct`. Lo leen el suelo (`groundAt`) y el grupo que lo dibuja.
   */
  readonly anchor: PathFrame;
  /** Profundidad de la cámara (`PATH.d`) cuando nació. */
  readonly spawnD: number;
  /** Aspecto de sus márgenes: el mayor entre el de la pantalla al nacer y 16:9. */
  readonly aspect: number;
```

En `interface FaunaPose`, después de `stretching: number;` y su comentario, añadir:

```ts
  /**
   * Presencia de una luz, 0–1: las luciérnagas se encienden y se apagan en vez
   * de crecer y encogerse. 1 en todo lo demás.
   */
  fade: number;
```

y en `createPose()`, después de `stretching: 0,`:

```ts
    fade: 1,
```

Sustituir la interfaz interna:

```ts
interface Point {
  x: number;
  y: number;
  z: number;
}
```

por:

```ts
type Point = Point3;
```

Sustituir `groundAt` y su comentario:

```ts
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
```

por:

```ts
/**
 * Dónde está el suelo, en las coordenadas locales del acto.
 *
 * Desde la Fase 3B el acto vive en el mundo, en su ancla (`act.anchor`): el
 * suelo se lee en su posición real, del mismo terreno que se dibuja, así que
 * nada flota ni se hunde en las cuestas, tampoco después de deslizarse.
 */
export function groundAt(act: FaunaAct, x: number, z: number): number {
  const frame = act.anchor;
  frameToWorld(frame, x, z, WORLD);
  return groundY(WORLD.x, WORLD.z) - frame.y;
}
```

En `standingY`, sustituir `return groundAt(x, z) + act.spec.ride * act.spec.size;` por `return groundAt(act, x, z) + act.spec.ride * act.spec.size;`.

Sustituir `offscreenX`:

```ts
/** Margen por el que un animal entra y sale de cuadro sin que se le vea aparecer. */
function offscreenX(z: number, size: number): number {
  return halfWidthAt(z) + 2 + size * 2;
}
```

por:

```ts
/**
 * Margen por el que un animal entra y sale de cuadro sin que se le vea
 * aparecer. Se mide con el aspecto del acto: en una pantalla más ancha que
 * 16:9 el cuadro es más ancho y el margen también.
 */
function offscreenX(act: FaunaAct, z: number, size: number): number {
  return halfWidthAt(z, act.aspect) + 2 + size * 2;
}
```

Y actualizar sus llamadas (reemplazar todas las apariciones):

| Buscar | Reemplazar por | Veces |
|---|---|---|
| `offscreenX(z, act.spec.size)` | `offscreenX(act, z, act.spec.size)` | 3 |
| `offscreenX(act.depth, act.spec.size)` | `offscreenX(act, act.depth, act.spec.size)` | 4 |
| `offscreenX(depth, act.spec.size)` | `offscreenX(act, depth, act.spec.size)` | 1 |
| `offscreenX(z, 1.5)` | `offscreenX(act, z, 1.5)` | 1 |
| `offscreenX(z, 1)` | `offscreenX(act, z, 1)` | 1 |

Comprobar: `grep -c "offscreenX(act," src/scene/systems/fauna/behaviors.ts` → `10`.

En `titilar`, sustituir `groundAt(out.x, out.z) +` por `groundAt(act, out.x, out.z) +`.

- [ ] **Step 4: Gorriones que se posan, milano que entra y sale, luciérnagas que se apagan**

Antes de `/** Cruza el encuadre de lado a lado, con aleteos y planeos alternos. */`, añadir:

```ts
/** Cuándo tocan suelo los gorriones que bajan a posarse, y cuándo alzan el vuelo (fracción del acto). */
const VISIT_LANDED = 0.3;
const VISIT_TAKEOFF = 0.84;

/** El radio más grande de los círculos del milano, y cuánto se aplastan en profundidad. */
const KITE_RADIUS_MAX = 8.5;
const KITE_DEPTH_SQUASH = 0.55;
```

Sustituir el `place` de `planearEnCirculos`:

```ts
  place: (act, member, s, out) => {
    const radius = 5 + jitter(act.seed, member, 1) * 3.5;
    const angle = act.direction * (s * 0.2 + member * 2.1) + act.seed;

    out.x = Math.cos(angle) * radius;
    out.z = act.depth + Math.sin(angle) * radius * 0.55;
```

por:

```ts
  place: (act, member, s, out) => {
    const t = s / act.duration;
    const radius = 5 + jitter(act.seed, member, 1) * (KITE_RADIUS_MAX - 5);
    const angle = act.direction * (s * 0.2 + member * 2.1) + act.seed;

    // Entra y sale planeando: el centro de sus círculos llega desde un costado
    // en el primer 20 % del acto y se va por el otro en el último 20 %. El
    // margen suma el radio más grande y se mide en el punto más hondo de los
    // círculos, donde el cuadro es más ancho.
    const w =
      offscreenX(act, act.depth - KITE_RADIUS_MAX * KITE_DEPTH_SQUASH, act.spec.size) + KITE_RADIUS_MAX;
    const center = track(t, [
      [0, -act.direction * w],
      [0.2, 0],
      [0.8, 0],
      [1, act.direction * w],
    ]);

    out.x = center + Math.cos(angle) * radius;
    out.z = act.depth + Math.sin(angle) * radius * KITE_DEPTH_SQUASH;
```

(El resto de su `place` —la altura con la térmica— no cambia.)

En `visitaAlSuelo`, en el `track` de la altura, sustituir `[0.3, 0],` por `[VISIT_LANDED, 0],` y `[0.84, 0],` por `[VISIT_TAKEOFF, 0],`; en su `decorate`, sustituir `pose.effort = t > 0.84 ? 1 : 0.65 + 0.35 * Math.sin(s * 5);` por `pose.effort = t > VISIT_TAKEOFF ? 1 : 0.65 + 0.35 * Math.sin(s * 5);`.

En el `decorate` de `titilar`, después de `pose.airborne = 1;`, añadir:

```ts
    // Son luces: se encienden y se apagan en dos segundos, no crecen ni se
    // encogen (§5.3 del spec de 3B).
    pose.fade = smoothstep(0, 2, s) * (1 - smoothstep(act.duration - 2, act.duration, s));
    pose.scale = 1;
```

(Su firma ya es `decorate: (act, member, s, pose) => {`: no hay que cambiarla.)

- [ ] **Step 5: La salida extrapolada (`placeAt`) y `poseFor`**

Después de `const BEHAVIORS: Record<BehaviorName, Behavior> = { … };`, añadir:

```ts
/* ── Dónde está cada individuo ──────────────────────────────────────────── */

/** Re-aceleración al seguir más allá del final (s), y tramo final cuya velocidad se mantiene. */
const EXIT_RAMP = 0.6;
const EXIT_SPAN = 0.15;

/** Si un acto siguiera a la vista tanto tiempo (s) después de su fin, se funde en este otro. */
export const OVERTIME_LIMIT = 30;
export const OVERTIME_FADE = 1;

const exitFrom: Point = { x: 0, y: 0, z: 0 };
const exitTo: Point = { x: 0, y: 0, z: 0 };

/** ¿Sigue su camino al terminar su tiempo? Todo menos las luces, que se apagan. */
export function extrapolates(behavior: BehaviorName): boolean {
  return behavior !== 'titilar';
}

/**
 * ¿Está el acto en el aire? Lo que sólo vuela, siempre; los gorriones que bajan
 * a posarse, sólo al llegar y al irse. Lo usa el ancla que se desliza.
 */
export function inFlight(act: FaunaAct, seconds: number): boolean {
  if (act.behavior === 'visitaAlSuelo') {
    const t = seconds / act.duration;
    return t < VISIT_LANDED || t > VISIT_TAKEOFF;
  }
  return isAerial(act.behavior);
}

/**
 * Dónde está un individuo, en las coordenadas locales de su acto.
 *
 * Dentro de su tiempo es su conducta, tal cual. **Más allá**, si alguien lo
 * sigue viendo —la cámara retrocedió y el cuadro se ensanchó—, no se encoge ni
 * desaparece: **sigue su camino** con la velocidad media del último 15 % del
 * acto, re-acelerando suave desde donde terminó (derivada nula en el empalme)
 * hasta salir de cuadro. Quien camina sigue pegado al suelo; quien vuela, a su
 * altura.
 */
export function placeAt(act: FaunaAct, member: number, seconds: number, out: Point): void {
  const behavior = BEHAVIORS[act.behavior];
  const s = Math.max(0, seconds);
  if (s <= act.duration || !extrapolates(act.behavior)) {
    behavior.place(act, member, Math.min(s, act.duration), out);
    return;
  }

  const span = act.duration * EXIT_SPAN;
  behavior.place(act, member, act.duration - span, exitFrom);
  behavior.place(act, member, act.duration, exitTo);

  const tau = s - act.duration;
  const along = tau - EXIT_RAMP * (1 - Math.exp(-tau / EXIT_RAMP));
  out.x = exitTo.x + ((exitTo.x - exitFrom.x) / span) * along;
  out.z = exitTo.z + ((exitTo.z - exitFrom.z) / span) * along;
  const grounded = Math.abs(exitTo.y - standingY(act, exitTo.x, exitTo.z)) < 0.02;
  out.y = grounded ? standingY(act, out.x, out.z) : exitTo.y;
}
```

En `aheadHeading`, sustituir:

```ts
  const place = BEHAVIORS[act.behavior].place;
  const step = act.spec.size * 0.05;
  for (let lookAhead = 0.1; lookAhead <= 1.5; lookAhead += 0.1) {
    place(act, member, Math.min(act.duration, s + lookAhead), ahead);
```

por:

```ts
  const step = act.spec.size * 0.05;
  for (let lookAhead = 0.1; lookAhead <= 1.5; lookAhead += 0.1) {
    placeAt(act, member, s + lookAhead, ahead);
```

En `poseFor`, sustituir:

```ts
  const behavior = BEHAVIORS[act.behavior];
  const s = clamp(seconds, 0, act.duration);

  behavior.place(act, member, Math.max(0, s - DT), before);
  behavior.place(act, member, s, here);
  behavior.place(act, member, Math.min(act.duration, s + DT), after);
```

por:

```ts
  const behavior = BEHAVIORS[act.behavior];
  // Sin tope por arriba: más allá de su tiempo el individuo sigue su camino.
  const s = Math.max(0, seconds);
  const early = Math.max(0, s - DT);

  placeAt(act, member, early, before);
  placeAt(act, member, s, here);
  placeAt(act, member, s + DT, after);
```

sustituir:

```ts
  const span = Math.max(1e-4, Math.min(act.duration, s + DT) - Math.max(0, s - DT));
```

por:

```ts
  const span = Math.max(1e-4, s + DT - early);
```

y sustituir el final de `poseFor`:

```ts
  out.stretching = 0;

  const t = s / act.duration;
  out.scale = smoothstep(0, 0.03, t) * (1 - smoothstep(0.97, 1, t));

  behavior.decorate?.(act, member, s, out);
}
```

por:

```ts
  out.stretching = 0;
  out.fade = 1;

  // El reloj de la conducta no pasa de su duración: más allá, sólo se sigue el
  // camino (`placeAt`).
  const clock = Math.min(s, act.duration);
  const t = clock / act.duration;
  // Entra desde fuera de cuadro: crecer al empezar es sólo una red de
  // seguridad. Ya no se encoge al terminar —sale de cuadro—, salvo la red de
  // seguridad de la Fase 3B: si siguiera a la vista mucho después de su fin.
  const overtime = act.duration + OVERTIME_LIMIT;
  out.scale = smoothstep(0, 0.03, t) * (1 - smoothstep(overtime, overtime + OVERTIME_FADE, s));

  behavior.decorate?.(act, member, clock, out);
}
```

Si `clamp` deja de usarse en el archivo, no tocar el import: sigue usándose en otras conductas (comprobar con `grep -n "clamp(" src/scene/systems/fauna/behaviors.ts`).

- [ ] **Step 6: La presencia de las luciérnagas (`FireflyRig.tsx`)**

Sustituir:

```ts
  useFaunaFrame(act, member, group, (pose) => {
    // El pulso viene de la conducta: cada individuo lleva su propio ritmo.
    const glow = pose.glow;
    spark.current?.scale.setScalar(lerp(0.5, 1.15, glow));
    halo.current?.scale.setScalar(lerp(1.4, 3.4, glow));
    materials.spark.opacity = 0.35 + glow * 0.65;
    materials.halo.opacity = 0.05 + glow * 0.22;
  });
```

por:

```ts
  useFaunaFrame(act, member, group, (pose) => {
    // El pulso viene de la conducta: cada individuo lleva su propio ritmo. La
    // presencia (`fade`) las enciende al llegar y las apaga al irse.
    const glow = pose.glow;
    const fade = pose.fade;
    spark.current?.scale.setScalar(lerp(0.5, 1.15, glow));
    halo.current?.scale.setScalar(lerp(1.4, 3.4, glow));
    materials.spark.opacity = (0.35 + glow * 0.65) * fade;
    materials.halo.opacity = (0.05 + glow * 0.22) * fade;
    // Apagada del todo no se dibuja: un material transparente a opacidad 0
    // seguiría escribiendo profundidad y taparía los pétalos de detrás.
    const lit = fade > 0.001;
    if (spark.current) spark.current.visible = lit;
    if (halo.current) halo.current.visible = lit;
  });
```

- [ ] **Step 7: Ejecutar las comprobaciones**

Run: `bun run check:path`
Expected: PASS — sección «Las conductas en el mundo» en verde.

Run: `bun run typecheck`
Expected: FAIL **sólo** en `src/scene/systems/fauna/casting.ts` (el objeto `FaunaAct` que monta no tiene `origin`, `anchor`, `spawnD`, `aspect`). Es lo esperado hasta la tarea 6.

---

### Task 4: Seguimiento, retirada y el director (`anchoring.ts` + `casting.ts`)

**Files:**
- Modify: `src/scene/systems/fauna/anchoring.ts`
- Modify (reescritura completa): `src/scene/systems/fauna/casting.ts`
- Modify: `scripts/check-fauna.ts`

**Interfaces:**
- Consumes: `placeAt`, `extrapolates`, `inFlight`, `OVERTIME_LIMIT`, `OVERTIME_FADE`, `FaunaAct` (Task 3); todo lo de Task 2; `pathY` (journeyPath).
- Produces:
  - anchoring.ts: `PASSED_DISTANCE`, `PASSED_ADVANCE`, `FAR_EXTRA`, `HURRY_GAP`; `type ActState`; `interface ActTrack { push; lastD; visible; everSeen; passedFrom; distance; state }`; `createTrack(): ActTrack`; `slidAnchor(act, push): void`; `slidesNow(act, seconds, distance): boolean`; `trackAct(act, track, now, d, dt, viewer): void`; `type Retirement = 'tiempo' | 'dejado' | 'lejos' | 'seguridad'`; `passedAdvance(behavior): number`; `retirement(act, track, now, d, fogFar): Retirement | null`.
  - casting.ts: `interface CameraState { d; velocity; frame; aspect; traveling }`; `AdvanceParams` (sin `station` ni `canSpawn`; con `camera` y `tracks: ReadonlyMap<number, ActTrack>`); `advanceCasting(params): AdvanceResult`; `interface ActChoice { kind; behavior }`; `createAct(choice, id, now, camera, random): FaunaAct`; `describeAct(act, track?): string`; `FAUNA_STAGE`, `newMemory`, `CastingConfig`, `CastingMemory` (sin cambios de forma).

- [ ] **Step 1: Escribir las comprobaciones (fallan)**

En `scripts/check-fauna.ts`, añadir a los imports de anchoring: `createTrack`, `HURRY_GAP`, `PASSED_ADVANCE`, `passedAdvance`, `retirement`, `trackAct`, `type ActTrack`; y añadir:

```ts
import {
  advanceCasting,
  newMemory,
  type CameraState,
  type CastingConfig,
} from '../src/scene/systems/fauna/casting';
```

Antes del bloque `/* ── Resumen ── */`, añadir:

```ts
/* ── 6. El seguimiento y la retirada ───────────────────────────────────── */

section('El seguimiento y la retirada');

const depthOf = (slug: Slug) => STATION_DEPTHS[stationIndex(slug)]!;

{
  const { act } = buildAct('ardilla', 'correrYParar', depthOf('fushimi-inari'), 16 / 9, 20, 5);
  const tracked = (patch: Partial<ActTrack>): ActTrack => ({ ...createTrack(), distance: 20, ...patch });
  check(
    'a la vista no se retira, ni con el tiempo cumplido',
    retirement(act, tracked({ visible: true }), act.duration + 5, 0, 90) === null,
  );
  check(
    '…salvo la red de seguridad',
    retirement(act, tracked({ visible: true }), act.duration + OVERTIME_LIMIT + OVERTIME_FADE, 0, 90) === 'seguridad',
  );
  check('fuera de cuadro y con el tiempo cumplido, se retira', retirement(act, tracked({}), act.duration, 0, 90) === 'tiempo');
  check(
    'dejado atrás: tras 6 u de avance fuera de cuadro, no antes',
    retirement(act, tracked({ passedFrom: 100, distance: 5 }), 1, 106, 90) === 'dejado' &&
      retirement(act, tracked({ passedFrom: 100, distance: 5 }), 1, 105.9, 90) === null,
  );
  check('muy lejos al retroceder', retirement(act, tracked({ distance: 200 }), 1, 0, 90) === 'lejos');
  check(
    'los gorriones posados se retiran en cuanto salen de cuadro',
    passedAdvance('visitaAlSuelo') === 0 && passedAdvance('correrYParar') === PASSED_ADVANCE,
  );
}

{
  // Una ardilla a mitad de su acto, a 20 u; la cámara camina hacia ella.
  const start = depthOf('fushimi-inari');
  const { act } = buildAct('ardilla', 'correrYParar', start, 16 / 9, 20, 9);
  const track = createTrack();
  const middle = act.duration / 2;
  let seen = false;
  let reason: string | null = null;
  let retiredVisible = false;
  let retiredAfter = 0;
  for (const d of range(start, start + 40, 0.1)) {
    const { viewer } = cameraAt(d, 16 / 9);
    trackAct(act, track, middle, d, 1 / 60, viewer);
    seen ||= track.visible;
    const why = retirement(act, track, middle, d, 95);
    if (why) {
      reason = why;
      retiredVisible = track.visible;
      retiredAfter = d - start;
      break;
    }
  }
  check(
    'a una ardilla se la ve, se la deja atrás y se retira fuera de cuadro',
    seen && reason === 'dejado' && !retiredVisible,
    `retirada tras ${retiredAfter.toFixed(1)} u de avance`,
  );
  check('la ardilla no se mueve con la cámara', track.push === 0 && act.anchor.z === act.origin.z);
}

{
  // Una mariposa a 12 u; la cámara camina 30 u hacia ella.
  const start = depthOf('eventos');
  const { act } = buildAct('mariposa', 'revolotear', start, 16 / 9, 12, 4);
  const track = createTrack();
  let closest = Infinity;
  let worstJump = 0;
  let previous = { x: act.anchor.x, z: act.anchor.z };
  let previousD = start;
  for (const d of range(start, start + 30, 0.1)) {
    const { viewer } = cameraAt(d, 16 / 9);
    trackAct(act, track, 2, d, 1 / 60, viewer);
    closest = Math.min(closest, track.distance);
    worstJump = Math.max(worstJump, Math.hypot(act.anchor.x - previous.x, act.anchor.z - previous.z) - (d - previousD));
    previous = { x: act.anchor.x, z: act.anchor.z };
    previousD = d;
  }
  check(
    'la mariposa se deja alcanzar hasta 8 u y luego avanza con la cámara',
    closest >= 8 - 0.3 && track.push > 15,
    `mín ${closest.toFixed(2)} u; se ha deslizado ${track.push.toFixed(1)} u`,
  );
  check('su ancla no da saltos', worstJump <= 0.05, `${worstJump.toFixed(3)} u`);
}

/* ── 7. El director ────────────────────────────────────────────────────── */

section('El director');

const DIRECTOR: CastingConfig = { minGap: 3, maxGap: 6, idleGap: 20, maxActs: 2 };

{
  const gionD = depthOf('gion');
  const at = (velocity: number, traveling = false): CameraState => ({
    d: gionD,
    velocity,
    frame: cameraAt(gionD, 16 / 9).rig.frame,
    aspect: 16 / 9,
    traveling,
  });
  const spawnWith = (camera: CameraState) => {
    const random = mulberry32(3);
    const memory = newMemory(0, random);
    return advanceCasting({
      memory,
      acts: [],
      now: 60,
      idleFor: 0,
      cast: ['gato'],
      config: DIRECTOR,
      random,
      camera,
      tracks: new Map(),
    }).spawned;
  };
  const still = spawnWith(at(0));
  const walking = spawnWith(at(6));
  check('quieto, nace', still !== null);
  check('caminando rápido no nace', spawnWith(at(13)) === null);
  check('retrocediendo no nace', spawnWith(at(-2)) === null);
  check('en un viaje no nace', spawnWith(at(0, true)) === null);
  check(
    'caminando, nace más al fondo (con ventaja)',
    still !== null && walking !== null && CAMERA_Z - walking.depth > CAMERA_Z - still.depth + 5,
    still && walking ? `${(CAMERA_Z - still.depth).toFixed(1)} → ${(CAMERA_Z - walking.depth).toFixed(1)} u` : '',
  );
  check(
    'nace con su ancla en la cámara, y su ancla es suya',
    walking !== null && walking.anchor !== walking.origin && walking.origin.z === at(6).frame.z,
  );
}

{
  const random = mulberry32(11);
  const memory = newMemory(0, random);
  memory.nextAt = 100;
  const fushimiD = depthOf('fushimi-inari');
  const { act } = buildAct('ardilla', 'correrYParar', fushimiD, 16 / 9, 20, 1);
  const track: ActTrack = { ...createTrack(), passedFrom: fushimiD - 10, distance: 3 };
  const result = advanceCasting({
    memory,
    acts: [act],
    now: 5,
    idleFor: 0,
    cast: [],
    config: DIRECTOR,
    random,
    camera: { d: fushimiD, velocity: 0, frame: act.origin, aspect: 16 / 9, traveling: false },
    tracks: new Map([[act.id, track]]),
  });
  check(
    'dejar atrás un acto lo retira y adelanta el siguiente',
    result.acts.length === 0 && memory.nextAt <= 5 + HURRY_GAP[1],
    `siguiente en ${(memory.nextAt - 5).toFixed(1)} s`,
  );
}
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `bun run scripts/check-fauna.ts`
Expected: FAIL — `Export named 'createTrack' not found` (o el primero de los que faltan).

- [ ] **Step 3: El seguimiento y la retirada en `anchoring.ts`**

Sustituir los imports de `anchoring.ts`:

```ts
import { Frustum, Matrix4, Sphere, Vector3, type Camera } from 'three';

import { smoothstep } from '@/lib/procedural';
import { CAMERA_BASE } from '@/scene/camera/framing';
import { blendByZone, frameToWorld, type PathFrame, type Point3 } from '@/scene/path/journeyPath';

import type { BehaviorName } from './bestiary';
```

por:

```ts
import { Frustum, Matrix4, Sphere, Vector3, type Camera } from 'three';

import { smoothstep } from '@/lib/procedural';
import { CAMERA_BASE } from '@/scene/camera/framing';
import {
  blendByZone,
  frameToWorld,
  pathY,
  type PathFrame,
  type Point3,
} from '@/scene/path/journeyPath';

import {
  extrapolates,
  inFlight,
  OVERTIME_FADE,
  OVERTIME_LIMIT,
  placeAt,
  type FaunaAct,
} from './behaviors';
import type { BehaviorName } from './bestiary';
```

Y añadir al final del archivo:

```ts
/* ── El seguimiento de cada acto ───────────────────────────────────────── */

/** Su punto base, a menos de esto por delante de la cámara —o detrás—, cuenta como dejado atrás (u). */
export const PASSED_DISTANCE = 10;
/** …y se retira tras este avance de la cámara fuera de cuadro (u). */
export const PASSED_ADVANCE = 6;
/** Retrocediendo, se retira más allá de su distancia al nacer (o de media niebla) más esto (u). */
export const FAR_EXTRA = 10;
/** Dejar atrás un acto adelanta el siguiente a este rango (s). */
export const HURRY_GAP: readonly [number, number] = [4, 8];

export type ActState = 'entrando' | 'en cuadro' | 'fuera de cuadro' | 'dejado atrás' | 'saliendo';

/** Lo que el director sabe de un acto vivo. Lo escribe sólo `trackAct`. */
export interface ActTrack {
  /** Lo que su ancla se ha deslizado por el camino (u). Nunca decrece. */
  push: number;
  /** Profundidad de la cámara en el frame anterior. */
  lastD: number | null;
  /** Algún individuo está en cuadro en este frame. */
  visible: boolean;
  everSeen: boolean;
  /** Profundidad de la cámara desde la que cuenta como dejado atrás; null si no lo está. */
  passedFrom: number | null;
  /** Distancia de su punto base a la cámara, en horizontal y a lo largo de la mirada (u). */
  distance: number;
  state: ActState;
}

export function createTrack(): ActTrack {
  return {
    push: 0,
    lastD: null,
    visible: false,
    everSeen: false,
    passedFrom: null,
    distance: Number.POSITIVE_INFINITY,
    state: 'entrando',
  };
}

/**
 * Lleva el ancla del acto a lo que se ha deslizado: hacia donde miraba la
 * cámara cuando nació, subiendo o bajando lo que sube o baja el camino.
 */
export function slidAnchor(act: FaunaAct, push: number): void {
  const origin = act.origin;
  const anchor = act.anchor;
  anchor.x = origin.x - Math.sin(origin.yaw) * push;
  anchor.z = origin.z - Math.cos(origin.yaw) * push;
  anchor.y = origin.y + pathY(act.spawnD + push) - pathY(act.spawnD);
  anchor.yaw = origin.yaw;
}

/**
 * ¿Se desliza ahora? Lo que sólo vuela, siempre. Los gorriones que se posan,
 * sólo en el aire y si aún van por delante: si ya quedaron detrás, alzan el
 * vuelo donde están, fuera de cuadro.
 */
export function slidesNow(act: FaunaAct, seconds: number, distance: number): boolean {
  const mode = SLIDE[act.behavior].mode;
  if (mode === 'siempre') return true;
  return mode === 'en vuelo' && distance > 0 && inFlight(act, seconds);
}

const LOCAL: Point3 = { x: 0, y: 0, z: 0 };
const WORLD: Point3 = { x: 0, y: 0, z: 0 };

function baseDistance(act: FaunaAct, viewer: Viewer): number {
  localToWorld(act.anchor, 0, 0, act.depth, WORLD);
  return forwardDistance(viewer, WORLD.x, WORLD.z);
}

/**
 * Un frame de seguimiento: desliza el ancla si toca, mira con la cámara real si
 * algún individuo está en cuadro y lleva la cuenta de si se le ha dejado atrás.
 * Es el **único escritor** de `act.anchor` y de su `track`.
 */
export function trackAct(
  act: FaunaAct,
  track: ActTrack,
  now: number,
  d: number,
  dt: number,
  viewer: Viewer,
): void {
  const seconds = now - act.startedAt;
  const advance = track.lastD === null ? 0 : d - track.lastD;
  track.lastD = d;

  const before = baseDistance(act, viewer);
  if (slidesNow(act, seconds, before)) {
    const push = slideStep(track.push, before, advance, SLIDE[act.behavior].min, dt);
    if (push !== track.push) {
      track.push = push;
      slidAnchor(act, push);
    }
  }
  track.distance = baseDistance(act, viewer);

  // Una luz apagada no se ve: la luciérnaga que terminó su acto ya no cuenta.
  const lit = extrapolates(act.behavior) || seconds < act.duration;
  const radius = viewRadius(act.spec.size);
  let visible = false;
  for (let member = 0; lit && !visible && member < act.members; member += 1) {
    placeAt(act, member, seconds, LOCAL);
    localToWorld(act.anchor, LOCAL.x, LOCAL.y, LOCAL.z, WORLD);
    visible = inView(viewer, WORLD.x, WORLD.y, WORLD.z, radius);
  }
  track.visible = visible;
  track.everSeen ||= visible;

  // Dejado atrás: su punto base ya está a menos de PASSED_DISTANCE y nadie lo
  // ve. Cuenta en avance, desde lo más atrás que haya estado la cámara.
  if (SLIDE[act.behavior].mode === 'siempre' || visible || track.distance >= PASSED_DISTANCE) {
    track.passedFrom = null;
  } else {
    track.passedFrom = track.passedFrom === null ? d : Math.min(track.passedFrom, d);
  }

  track.state =
    seconds >= act.duration
      ? 'saliendo'
      : visible
        ? 'en cuadro'
        : track.passedFrom !== null
          ? 'dejado atrás'
          : track.everSeen
            ? 'fuera de cuadro'
            : 'entrando';
}

export type Retirement = 'tiempo' | 'dejado' | 'lejos' | 'seguridad';

/**
 * Cuánto tiene que avanzar la cámara, con el acto fuera de cuadro, para darlo
 * por dejado atrás. A los gorriones posados, nada: si siguieran ahí al alzar el
 * vuelo, pasarían junto a la cámara.
 */
export function passedAdvance(behavior: BehaviorName): number {
  return SLIDE[behavior].mode === 'en vuelo' ? 0 : PASSED_ADVANCE;
}

/**
 * Por qué se retira un acto en este frame, o null si sigue. **Nunca a la
 * vista**: con algún individuo en cuadro sólo lo retira la red de seguridad, y
 * no debería saltar nunca.
 */
export function retirement(
  act: FaunaAct,
  track: ActTrack,
  now: number,
  d: number,
  fogFar: number,
): Retirement | null {
  const seconds = now - act.startedAt;
  if (track.visible) {
    return seconds >= act.duration + OVERTIME_LIMIT + OVERTIME_FADE ? 'seguridad' : null;
  }
  if (seconds >= act.duration) return 'tiempo';
  if (track.passedFrom !== null && d - track.passedFrom >= passedAdvance(act.behavior)) return 'dejado';
  if (track.distance > Math.max(CAMERA_Z - act.depth, FOG_CAP * fogFar) + FAR_EXTRA) return 'lejos';
  return null;
}
```

- [ ] **Step 4: Reescribir `casting.ts`**

Sustituir el archivo entero por:

```ts
/**
 * Las reglas del director, separadas de React.
 *
 * Quién sale y cuándo es **la** decisión de diseño de toda la fauna, así que
 * vive en un módulo puro: se puede razonar sobre ella leyéndola, y comprobarla
 * simulando diez minutos fuera del navegador en vez de quedarse mirando la
 * pantalla a ver si aparece algo raro.
 *
 * Desde la Fase 3B el director sabe dónde está la cámara y cómo se mueve: los
 * actos nacen por delante si se camina, a la distancia que pide la zona, con
 * su ancla en el mundo, y se retiran sólo fuera de cuadro (`anchoring.ts`).
 */

import type { FaunaKind } from '@/config/journey';
import { lerp } from '@/lib/procedural';
import type { PathFrame } from '@/scene/path/journeyPath';

import {
  CAMERA_Z,
  faunaDistanceAt,
  fogFarAt,
  HURRY_GAP,
  leadFor,
  retirement,
  SLIDE,
  spawnAllowed,
  spawnDistance,
  spawnFloor,
  type ActTrack,
} from './anchoring';
import type { FaunaAct } from './behaviors';
import {
  durationFor,
  isAerial,
  membersFor,
  speciesSpec,
  type BehaviorName,
} from './bestiary';

export interface CastingConfig {
  /** Hueco mínimo y máximo entre actos, en segundos. */
  readonly minGap: number;
  readonly maxGap: number;
  /** Tras tantos segundos sin scroll y con el cuadro vacío, sale uno extra. */
  readonly idleGap: number;
  /** Cuántos actos pueden convivir. Dos sólo en tier alto. */
  readonly maxActs: number;
}

export interface CastingMemory {
  nextAt: number;
  lastSpawn: number;
  lastSpecies: FaunaKind | null;
  counter: number;
  /** Desde cuándo no hay nada en cuadro. `null` = ahora mismo hay algo. */
  emptySince: number | null;
}

export function newMemory(now: number, random: () => number): CastingMemory {
  return {
    // La primera aparición llega pronto: esperar cuarenta segundos a que pase
    // algo la primera vez es, para quien acaba de entrar, no tener fauna.
    nextAt: now + 4 + random() * 5,
    lastSpawn: now,
    lastSpecies: null,
    counter: 0,
    emptySince: now,
  };
}

/** Lo que el director sabe de la cámara en este frame. */
export interface CameraState {
  /** Profundidad de su punto de interés (`PATH.d`). */
  readonly d: number;
  /** `PATH.velocity`: avance con signo, u/s. */
  readonly velocity: number;
  /** `PATH.frame`. El acto que nace se queda con una copia: su ancla. */
  readonly frame: Readonly<PathFrame>;
  /** `VIEW.aspect`: el de la pantalla. */
  readonly aspect: number;
  /** Hay un viaje en curso: la cámara pasa de largo. */
  readonly traveling: boolean;
}

export interface AdvanceParams {
  memory: CastingMemory;
  acts: readonly FaunaAct[];
  now: number;
  /** Segundos desde el último scroll. */
  idleFor: number;
  /** Especies de la zona que además tienen cuerpo. */
  cast: readonly FaunaKind[];
  config: CastingConfig;
  random: () => number;
  camera: CameraState;
  /** El seguimiento de cada acto vivo en este frame (`trackAct`), por id. */
  tracks: ReadonlyMap<number, ActTrack>;
}

export interface AdvanceResult {
  /** La misma referencia si no ha cambiado nada: así el componente no repinta. */
  acts: readonly FaunaAct[];
  spawned: FaunaAct | null;
}

/**
 * Lo que hay en escena ahora mismo, para `/diagnostico`. Mismo criterio que
 * `WIND` y `PARALLAX`: es una lectura, no estado del que dependa nadie, y sólo
 * la escribe el director (`live`, cada frame, con `describeAct`).
 */
export const FAUNA_STAGE: {
  live: string[];
  /** Actos montados desde que se abrió la página. */
  total: number;
  /** Segundos que faltan para el siguiente, según el reloj de escena. */
  nextIn: number;
} = { live: [], total: 0, nextIn: 0 };

/** Cómo se lee un acto en `/diagnostico`: quién, a qué distancia y en qué está. */
export function describeAct(act: FaunaAct, track?: ActTrack): string {
  const who =
    act.members > 1
      ? `${act.species} ×${act.members} (${act.behavior})`
      : `${act.species} (${act.behavior})`;
  if (!track || !Number.isFinite(track.distance)) return who;
  return `${who} · ${Math.round(track.distance)} u · ${track.state}`;
}

/** Un paso del director. Retira lo que nadie ve y decide si monta algo nuevo. */
export function advanceCasting(params: AdvanceParams): AdvanceResult {
  const { memory, now, idleFor, cast, config, random, camera, tracks } = params;

  // Se retira sólo lo que ya no está en cuadro (`retirement`). Un acto sin
  // seguimiento todavía —acaba de nacer— sigue.
  const fogFar = fogFarAt(camera.d);
  let leftBehind = false;
  const live = params.acts.filter((act) => {
    const track = tracks.get(act.id);
    const why = track ? retirement(act, track, now, camera.d, fogFar) : null;
    if (why === 'dejado') leftBehind = true;
    return why === null;
  });
  const acts = live.length === params.acts.length ? params.acts : live;

  // Dejar atrás un acto sin terminar adelanta el siguiente: si no, un tramo
  // recorrido a buen paso se quedaría vacío.
  if (leftBehind) {
    memory.nextAt = Math.min(memory.nextAt, now + lerp(HURRY_GAP[0], HURRY_GAP[1], random()));
  }

  // Desde cuándo está el cuadro vacío de fauna.
  if (live.length > 0) memory.emptySince = null;
  else memory.emptySince ??= now;

  FAUNA_STAGE.nextIn = Math.max(0, memory.nextAt - now);

  if (!spawnAllowed(camera.velocity, camera.traveling) || cast.length === 0 || live.length >= config.maxActs) {
    return { acts, spawned: null };
  }

  // La recompensa por quedarse quieto: nadie hace scroll **y** hace un rato que
  // no pasa nada. Las dos condiciones importan — sin la segunda, la recompensa
  // dejaría de ser un premio y se convertiría en la cadencia normal, con el
  // cuadro lleno de bichos todo el rato.
  const quietFor = memory.emptySince === null ? 0 : now - memory.emptySince;
  const reward = idleFor > config.idleGap && quietFor > config.idleGap * 0.4;

  if (now < memory.nextAt && !reward) return { acts, spawned: null };

  const spawned = castAct(cast, live, now, memory, random, camera);
  if (!spawned) return { acts, spawned: null };

  memory.lastSpawn = now;
  memory.nextAt = now + lerp(config.minGap, config.maxGap, random());
  FAUNA_STAGE.total += 1;

  return { acts: [...live, spawned], spawned };
}

/** Una especie y una conducta, ya elegidas. */
export interface ActChoice {
  readonly kind: FaunaKind;
  readonly behavior: BehaviorName;
}

/** Elige quién sale respetando las reglas de composición, y lo monta. */
function castAct(
  cast: readonly FaunaKind[],
  live: readonly FaunaAct[],
  now: number,
  memory: CastingMemory,
  random: () => number,
  camera: CameraState,
): FaunaAct | null {
  // Si ya hay algo en el aire, lo siguiente va por el suelo y al revés: dos
  // garzas cruzando a la vez se leen como un bucle, no como un jardín.
  const busyAerial = live.some((act) => isAerial(act.behavior));
  const busyGround = live.some((act) => !isAerial(act.behavior));

  const options: { kind: FaunaKind; behavior: BehaviorName; weight: number }[] = [];

  for (const kind of cast) {
    const spec = speciesSpec(kind);
    if (!spec) continue;

    for (const behavior of spec.behaviors) {
      if (isAerial(behavior) ? busyAerial : busyGround) continue;
      // Repetir especie hace que el sitio parezca un zoológico de una jaula.
      const repeat = kind === memory.lastSpecies ? 0.12 : 1;
      options.push({ kind, behavior, weight: spec.weight * repeat });
    }
  }

  if (options.length === 0) return null;

  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let ticket = random() * total;
  let chosen = options[0]!;
  for (const option of options) {
    ticket -= option.weight;
    if (ticket <= 0) {
      chosen = option;
      break;
    }
  }

  memory.counter += 1;
  memory.lastSpecies = chosen.kind;
  return createAct(chosen, memory.counter, now, camera, random);
}

/**
 * Monta un acto ya elegido delante de la cámara (§4 del spec de 3B): cuánto
 * dura, cuántos son y, sobre todo, **dónde nace** —a la distancia de su
 * especie, acercada o alejada por la zona, con ventaja si se camina— y con qué
 * ancla.
 */
export function createAct(
  choice: ActChoice,
  id: number,
  now: number,
  camera: CameraState,
  random: () => number,
): FaunaAct {
  const spec = speciesSpec(choice.kind)!;
  // La duración va primero: el gato decide por ella si juega, y jugar es de dos.
  const duration = durationFor(choice.behavior, random);
  const base = CAMERA_Z - lerp(spec.depth[0], spec.depth[1], random());
  // Lo que vuela no necesita ventaja: se le adelanta a la cámara.
  const lead = SLIDE[choice.behavior].mode === 'siempre' ? 0 : leadFor(camera.velocity);
  const distance = spawnDistance(
    base,
    faunaDistanceAt(camera.d),
    spawnFloor(choice.behavior),
    lead,
    fogFarAt(camera.d),
  );

  return {
    id,
    species: choice.kind,
    spec,
    behavior: choice.behavior,
    members: membersFor(choice.behavior, random, spec, duration),
    duration,
    startedAt: now,
    direction: random() < 0.5 ? -1 : 1,
    depth: CAMERA_Z - distance,
    seed: Math.floor(random() * 10000),
    origin: { ...camera.frame },
    anchor: { ...camera.frame },
    spawnD: camera.d,
    aspect: Math.max(camera.aspect, 16 / 9),
  };
}
```

- [ ] **Step 5: Ejecutar las comprobaciones**

Run: `bun run check:path`
Expected: PASS — secciones «El seguimiento y la retirada» y «El director» en verde.

Run: `bun run typecheck`
Expected: FAIL **sólo** en `src/scene/systems/fauna/FaunaDirector.tsx` (sigue pasando `station` y `canSpawn`). Lo arregla la tarea 6.

---

### Task 5: El recorrido simulado

**Files:**
- Modify: `scripts/check-fauna.ts`

**Interfaces:**
- Consumes: todo lo anterior; `stepRig` (pathRig.ts); `damp` (procedural.ts).
- Produces: la sección «El recorrido» de `check-fauna.ts`. No cambia código de producción salvo que una comprobación descubra un fallo (ver Step 3).

- [ ] **Step 1: Escribir la simulación**

En `scripts/check-fauna.ts`, añadir `stepRig` al import de `pathRig`, `damp` al de `procedural`, `fogFarAt` y `type Retirement` al de `anchoring`. Antes del bloque `/* ── Resumen ── */`, añadir:

```ts
/* ── 8. El recorrido ───────────────────────────────────────────────────── */

section('El recorrido');

/** Nada visible a menos de esto de la cámara (u, al centro de cada individuo). */
const NEAR_LIMIT = 7;

type Move =
  | { kind: 'walk'; to: number; speed: number }
  | { kind: 'stop'; seconds: number }
  | { kind: 'travel'; to: number };

/**
 * Un paseo de la Home a Gastronomía: leer cada estación, caminar cada tramo a
 * tres ritmos con una parada de tarjeta cada 40 u, retroceder 8 u una vez por
 * tramo, y al final volver a la Home por enlace (un viaje a 160 u/s).
 */
function journeyScript(): Move[] {
  const moves: Move[] = [];
  const paces = [3, 6, 10];
  for (let i = 0; i < STATION_DEPTHS.length - 1; i += 1) {
    const from = STATION_DEPTHS[i]!;
    const to = STATION_DEPTHS[i + 1]!;
    moves.push({ kind: 'stop', seconds: 12 });
    let leg = 0;
    for (let at = from; at < to; leg += 1) {
      const next = Math.min(to, at + 40);
      moves.push({ kind: 'walk', to: next, speed: paces[(i + leg) % paces.length]! });
      if (leg === 1) {
        moves.push({ kind: 'walk', to: next - 8, speed: 4 }, { kind: 'walk', to: next, speed: 4 });
      }
      moves.push({ kind: 'stop', seconds: 6 });
      at = next;
    }
  }
  moves.push({ kind: 'travel', to: 0 }, { kind: 'stop', seconds: 15 });
  return moves;
}

interface JourneyStats {
  spawned: number;
  seenFrames: number;
  retired: Record<Retirement, number>;
  vanished: Set<string>;
  startedInView: Set<string>;
  tooClose: Set<string>;
  floating: Set<string>;
  slideJumps: Set<string>;
  lingering: Set<string>;
  travelSpawns: number;
  closest: Map<BehaviorName, number>;
}

function simulateJourney(aspect: number, seed: number): JourneyStats {
  const DT = 1 / 30;
  const random = mulberry32(seed);
  const memory = newMemory(0, random);
  const rig = createRig();
  const camera = new PerspectiveCamera(CAMERA_BASE.fov, aspect, 0.1, CAMERA_FAR);
  const viewer = createViewer();
  const tracks = new Map<number, ActTrack>();
  const pose = createPose();
  const world = { x: 0, y: 0, z: 0 };
  const stats: JourneyStats = {
    spawned: 0,
    seenFrames: 0,
    retired: { tiempo: 0, dejado: 0, lejos: 0, seguridad: 0 },
    vanished: new Set(),
    startedInView: new Set(),
    tooClose: new Set(),
    floating: new Set(),
    slideJumps: new Set(),
    lingering: new Set(),
    travelSpawns: 0,
    closest: new Map(),
  };
  let acts: readonly FaunaAct[] = [];
  let target = 0;
  let velocity = 0;
  let now = 0;
  snapRig(rig, 0);

  const frame = (traveling: boolean) => {
    const before = rig.d;
    stepRig(rig, target, DT);
    const step = rig.d - before;
    velocity = damp(velocity, step / DT, 8, DT); // como CameraRig
    camera.position.set(rig.camera.x, rig.camera.y, rig.camera.z);
    camera.lookAt(rig.focus.x, rig.focus.y, rig.focus.z);
    camera.updateMatrixWorld();
    updateViewer(viewer, camera);

    for (const act of acts) {
      const fresh = !tracks.has(act.id);
      const track = tracks.get(act.id) ?? createTrack();
      tracks.set(act.id, track);
      const anchorBefore = { x: act.anchor.x, z: act.anchor.z };
      trackAct(act, track, now, rig.d, DT, viewer);

      const name = `${act.species} (${act.behavior}) #${act.id}`;
      const seconds = now - act.startedAt;
      if (fresh && track.visible && act.behavior !== 'titilar') stats.startedInView.add(name);
      if (track.visible) stats.seenFrames += 1;

      const moved = Math.hypot(act.anchor.x - anchorBefore.x, act.anchor.z - anchorBefore.z);
      if (moved > Math.abs(step) + 0.15) stats.slideJumps.add(`${name}: ${moved.toFixed(2)} u`);

      for (let member = 0; member < act.members; member += 1) {
        pose.heading = 0;
        poseFor(act, member, seconds, pose);
        localToWorld(act.anchor, pose.x, pose.y, pose.z, world);
        const shown = act.behavior !== 'titilar' || pose.fade > 0;
        if (shown && inView(viewer, world.x, world.y, world.z, viewRadius(act.spec.size))) {
          const distance = Math.hypot(
            world.x - camera.position.x,
            world.y - camera.position.y,
            world.z - camera.position.z,
          );
          stats.closest.set(act.behavior, Math.min(stats.closest.get(act.behavior) ?? Infinity, distance));
          if (distance < NEAR_LIMIT) stats.tooClose.add(`${name}: ${distance.toFixed(1)} u`);
        }
        if (!isAerial(act.behavior) && pose.airborne < 0.05) {
          const expected = groundY(world.x, world.z) + act.spec.ride * act.spec.size;
          if (Math.abs(world.y - expected) > 0.02) stats.floating.add(name);
        }
      }
      if (SLIDE[act.behavior].mode !== 'siempre' && track.distance < -30) stats.lingering.add(name);
    }

    const zone = JOURNEY[dominantZone(rig.d)]!;
    const result = advanceCasting({
      memory,
      acts,
      now,
      idleFor: 0,
      cast: availableSpecies(zone.ambient.fauna),
      config: DIRECTOR,
      random,
      camera: { d: rig.d, velocity, frame: rig.frame, aspect, traveling },
      tracks,
    });

    for (const act of acts) {
      if (result.acts.includes(act)) continue;
      const track = tracks.get(act.id);
      if (!track) continue;
      const why = retirement(act, track, now, rig.d, fogFarAt(rig.d));
      if (why) stats.retired[why] += 1;
      if (track.visible) stats.vanished.add(`${act.species} (${act.behavior}) #${act.id}`);
      tracks.delete(act.id);
    }
    if (result.spawned) {
      stats.spawned += 1;
      if (traveling) stats.travelSpawns += 1;
    }
    acts = result.acts;
    now += DT;
  };

  for (const move of journeyScript()) {
    if (move.kind === 'stop') {
      for (let t = 0; t < move.seconds; t += DT) frame(false);
      continue;
    }
    const traveling = move.kind === 'travel';
    const speed = move.kind === 'travel' ? 160 : move.speed;
    while (Math.abs(target - move.to) > 1e-9) {
      target += Math.sign(move.to - target) * Math.min(speed * DT, Math.abs(move.to - target));
      frame(traveling);
    }
  }

  return stats;
}

const sample = (set: Set<string>) => [...set].slice(0, 3).join('; ');

for (const [name, aspect] of [
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
] as const) {
  const stats = simulateJourney(aspect, 20261001);
  const closest = [...stats.closest].map(([behavior, distance]) => `${behavior} ${distance.toFixed(1)}`).join(' · ');
  check(`${name}: la simulación pone fauna en escena`, stats.spawned >= 15 && stats.seenFrames > 0, `${stats.spawned} actos`);
  check(`${name}: ningún individuo desaparece a la vista`, stats.vanished.size === 0, sample(stats.vanished));
  check(`${name}: ningún acto empieza ya a la vista`, stats.startedInView.size === 0, sample(stats.startedInView));
  check(`${name}: nada visible a menos de ${NEAR_LIMIT} u`, stats.tooClose.size === 0, sample(stats.tooClose) || closest);
  check(`${name}: lo que pisa, pisa el terreno`, stats.floating.size === 0, sample(stats.floating));
  check(`${name}: el ancla que se desliza no da saltos`, stats.slideJumps.size === 0, sample(stats.slideJumps));
  check(
    `${name}: se dejan actos atrás y ninguno queda vivo muy por detrás`,
    stats.retired.dejado > 0 && stats.lingering.size === 0,
    `${stats.retired.dejado} dejados atrás, ${stats.retired.tiempo} por tiempo, ${stats.retired.lejos} lejos`,
  );
  check(`${name}: la red de seguridad no salta`, stats.retired.seguridad === 0);
  check(`${name}: nada nace en un viaje`, stats.travelSpawns === 0);
}
```

- [ ] **Step 2: Ejecutar**

Run: `bun run check:path`
Expected: PASS en todas, con el detalle del número de actos y de retiradas. Tarda unos segundos más que antes (simula dos paseos de ~6 minutos a 30 fps).

- [ ] **Step 3: Si algo falla, buscar la causa**

Con superpowers:systematic-debugging. Pistas por comprobación:
- *desaparece a la vista*: `retirement` devolvió algo con `track.visible` verdadero → sólo puede ser `'seguridad'`; mirar por qué el acto sigue a la vista 30 s después (¿una conducta que no sale de cuadro al extrapolar?).
- *empieza ya a la vista*: un margen de `offscreenX` que no cubre a esa conducta con ese aspecto, o un acto nacido retrocediendo (`spawnAllowed`).
- *a menos de 7 u*: el detalle lista la distancia mínima por conducta. Si es algo que anda, revisar la inclinación de la cámara en esa cuesta; si es algo que vuela, su `SLIDE`.
- *no pisa*: `groundAt` leyendo un ancla que no es `act.anchor`.
- *saltos*: `slideStep` o `slidAnchor`.

No se cambian los umbrales del spec (7 u, 0,15 u por frame) sin preguntar al usuario.

---

### Task 6: El director en la escena

**Files:**
- Modify (reescritura completa): `src/scene/systems/fauna/FaunaDirector.tsx`

**Interfaces:**
- Consumes: `createTrack`, `createViewer`, `trackAct`, `updateViewer`, `ActTrack` (anchoring.ts); `advanceCasting`, `describeAct`, `FAUNA_STAGE`, `newMemory`, `CastingConfig` (casting.ts); `PATH` (con `velocity`); `VIEW` (framing.ts); `isTraveling` (travel.ts).
- Produces: `FaunaDirector` con las mismas props (`station`, `palette`, `profile`); `FoundationScene.tsx` no cambia.

- [ ] **Step 1: Reescribir `FaunaDirector.tsx`**

Sustituir el archivo entero por:

```tsx
'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';

import { isTraveling } from '@/animation/travel';
import { playFauna } from '@/audio/engine';
import type { FaunaKind, Station } from '@/config/journey';
import { readCssSeconds, type ScenePalette } from '@/lib/css-vars';
import { mulberry32 } from '@/lib/procedural';
import { VIEW } from '@/scene/camera/framing';
import { FireflyRig } from '@/scene/objects/fauna/FireflyRig';
import { ModelCreature } from '@/scene/objects/fauna/ModelCreature';
import { SkinnedCreature } from '@/scene/objects/fauna/SkinnedCreature';
import { PATH } from '@/scene/path/journeyPath';
import type { QualityProfile } from '@/scene/quality/tiers';
import { WIND } from '@/scene/systems/WindField';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { createTrack, createViewer, trackAct, updateViewer, type ActTrack } from './anchoring';
import { availableSpecies, modelUrl, speciesSpec } from './bestiary';
import type { FaunaAct } from './behaviors';
import { advanceCasting, describeAct, FAUNA_STAGE, newMemory, type CastingConfig } from './casting';

/**
 * El director de fauna: pone en escena lo que decide `casting.ts`.
 *
 * Funciona como un director de casting, no como un reproductor. No tiene una
 * lista de animaciones que va lanzando: tiene un elenco —las especies que
 * declara la estación en `journey.ts`— y un repertorio de conductas, y cada
 * tanto monta un acto combinando las dos cosas. La estación dice **qué
 * especies** viven ahí; nunca qué hacen.
 *
 * Desde la Fase 3B cada acto vive **en el mundo**, en su ancla, y el director
 * lo sigue cada frame con la cámara real (`anchoring.ts`): desliza el ancla de
 * lo que vuela, sabe si algo está en cuadro y no retira nunca un acto a la
 * vista.
 *
 * Este componente es sólo la parte que React necesita: el reloj, el estado y
 * las mallas. Las reglas —cadencia, aforo, variedad, dónde nace, cuándo se
 * retira— viven aparte y en puro TypeScript para poder comprobarlas.
 */

interface FaunaDirectorProps {
  station: Station;
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * Sólo en desarrollo: `?fauna=garza` deja en escena una única especie, sea cual
 * sea la estación, y acorta las esperas a unos segundos. Sirve para revisar un
 * animal sin esperar a que el sorteo lo saque. En el build de producción
 * `process.env.NODE_ENV` vale 'production' y esto no existe.
 */
function devFocus(): FaunaKind | null {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
  const wanted = new URLSearchParams(window.location.search).get('fauna');
  return wanted && speciesSpec(wanted as FaunaKind) ? (wanted as FaunaKind) : null;
}

export function FaunaDirector({ station, palette, profile }: FaunaDirectorProps) {
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const [acts, setActs] = useState<readonly FaunaAct[]>([]);

  const focus = useMemo(devFocus, []);
  const cast = useMemo(
    () => (focus ? [focus] : availableSpecies(station.ambient.fauna)),
    [station, focus],
  );

  const config = useMemo<CastingConfig>(
    () => ({
      minGap: focus ? 3 : readCssSeconds('--fauna-min-gap', 20),
      maxGap: focus ? 6 : readCssSeconds('--fauna-max-gap', 40),
      idleGap: readCssSeconds('--idle-before-fauna', 20),
      // Dos actos a la vez sólo donde hay presupuesto para ellos.
      maxActs: profile.tier === 'high' ? 2 : 1,
    }),
    [profile.tier, focus],
  );

  const random = useRef(mulberry32(20260915));
  const memory = useRef(newMemory(0, random.current));
  const tracks = useRef(new Map<number, ActTrack>());
  const viewer = useMemo(createViewer, []);

  // Los modelos del elenco se piden en cuanto se llega a la estación. Pesan
  // decenas de KB, pero si se pidieran al empezar el acto la garza aparecería a
  // mitad de su paseo, cuando ya terminara de descargar.
  useEffect(() => {
    for (const kind of cast) {
      const spec = speciesSpec(kind);
      if (spec?.model) useGLTF.preload(modelUrl(spec.model), false, true);
      if (spec?.flightModel) useGLTF.preload(modelUrl(spec.flightModel), false, true);
    }
  }, [cast]);

  // Al apagar o encender el movimiento se empieza de cero. Al cambiar de zona
  // no: los actos vivos terminan su acto y la zona nueva sólo cuenta para el
  // siguiente reparto. Borrarlos de golpe se veía como un corte en mitad del
  // camino.
  useEffect(() => {
    setActs([]);
    tracks.current.clear();
    FAUNA_STAGE.live = [];
    memory.current = newMemory(WIND.time, random.current);
  }, [motionAllowed]);

  // Prioridad −0,5: después de CameraRig (−1), que mueve la cámara y escribe
  // PATH, y antes que los cuerpos (0), que leen el ancla de este mismo frame.
  // (Una prioridad positiva le quitaría a R3F el render automático.)
  useFrame((state, delta) => {
    if (!motionAllowed) return;

    const now = WIND.time;
    state.camera.updateMatrixWorld();
    updateViewer(viewer, state.camera);

    for (const act of acts) {
      let track = tracks.current.get(act.id);
      if (!track) {
        track = createTrack();
        tracks.current.set(act.id, track);
      }
      trackAct(act, track, now, PATH.d, Math.min(delta, 0.1), viewer);
    }

    const idleFor = (Date.now() - useKyotoStore.getState().lastScrollAt) / 1000;
    const result = advanceCasting({
      memory: memory.current,
      acts,
      now,
      idleFor,
      cast,
      config,
      random: random.current,
      camera: {
        d: PATH.d,
        velocity: PATH.velocity,
        frame: PATH.frame,
        aspect: VIEW.aspect,
        traveling: isTraveling(),
      },
      tracks: tracks.current,
    });

    if (result.acts !== acts) {
      const alive = new Set(result.acts.map((act) => act.id));
      for (const id of tracks.current.keys()) {
        if (!alive.has(id)) tracks.current.delete(id);
      }
      setActs(result.acts);
    }
    FAUNA_STAGE.live = result.acts.map((act) => describeAct(act, tracks.current.get(act.id)));

    // La voz del animal entra por el mismo lado que él, y sólo si esta zona
    // tiene pájaros declarados: el paisaje sonoro también sale de `journey.ts`.
    if (result.spawned?.spec.sound && station.ambient.sounds.includes('pajaros')) {
      playFauna(result.spawned.spec.sound, result.spawned.direction * 0.6);
    }
  }, -0.5);

  if (!motionAllowed) return null;

  return (
    <>
      {acts.map((act) => (
        <ActView key={act.id} act={act} palette={palette} />
      ))}
    </>
  );
}

/**
 * Un acto en escena: tantos individuos como pida su conducta, en el grupo de su
 * ancla. Lo anclado no se mueve; lo que vuela sigue a `act.anchor`, que el
 * director ha deslizado en este mismo frame.
 *
 * Va dentro de `Suspense` porque los modelos se cargan de red. Mientras llegan
 * no se pinta nada — nunca un hueco, nunca un marcador de posición: un animal
 * que aún no ha llegado simplemente no ha entrado todavía en cuadro.
 */
function ActView({ act, palette }: { act: FaunaAct; palette: ScenePalette }) {
  const place = useRef<Group>(null);
  const members = useMemo(
    () => Array.from({ length: act.members }, (_, index) => index),
    [act.members],
  );

  useFrame(() => {
    const node = place.current;
    if (!node) return;
    const anchor = act.anchor;
    node.position.set(anchor.x, anchor.y, anchor.z);
    node.rotation.set(0, anchor.yaw, 0);
  });

  const { anchor } = act;
  return (
    <group ref={place} position={[anchor.x, anchor.y, anchor.z]} rotation={[0, anchor.yaw, 0]}>
      <Suspense fallback={null}>
        {members.map((member) => {
          const key = `${act.id}-${member}`;

          switch (act.spec.rig) {
            case 'modelo':
              return <ModelCreature key={key} act={act} member={member} palette={palette} />;
            case 'animado':
              return <SkinnedCreature key={key} act={act} member={member} palette={palette} />;
            case 'luz':
              return <FireflyRig key={key} act={act} member={member} palette={palette} />;
          }
        })}
      </Suspense>
    </group>
  );
}
```

- [ ] **Step 2: Typecheck, comprobaciones y build**

Run: `bun run typecheck`
Expected: sin errores.

Run: `bun run check:path`
Expected: PASS.

Run: `bun run build`
Expected: código de salida 0.

- [ ] **Step 3: Revisar que nada más usaba lo que cambió**

Run: `grep -rn "canSpawn\|groundAt(\|FAUNA_STAGE.live" src`
Expected: `groundAt(` sólo en `behaviors.ts` (siempre con `act` como primer argumento); `FAUNA_STAGE.live` sólo en `FaunaDirector.tsx` (escritura) y `DiagnosticsPanel.tsx` (lectura); `canSpawn` en ningún sitio.

---

### Task 7: Documentación, verificación final y parada

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `CLAUDE.md`
- Modify: `src/scene/systems/README.md`
- Modify: `src/scene/camera/README.md`

- [ ] **Step 1: `docs/PLAN.md`**

Sustituir:

```md
> Estado: **Fase 3 en curso** — 3A (el mundo) implementada, pendiente de revisión; 3B y 3C se
> diseñan al llegar a ellas.
```

por:

```md
> Estado: **Fase 3 en curso** — 3A (el mundo) y 3B (la fauna en el camino) implementadas,
> pendientes de revisión; 3C se diseña al llegar a ella.
```

Sustituir la fila:

```md
| **3B** | · La fauna en el camino | Actos anclados al mundo · cercanía por estación · márgenes con la cámara real | ⏸ |
```

por:

```md
| **3B** | · La fauna en el camino | Actos anclados al mundo · lo que vuela se adelanta (ancla que se desliza) · nace por delante al caminar · cercanía por estación · márgenes con la cámara real · nunca desaparece a la vista | ✅ pendiente de revisión |
```

En §5.6, después de la línea `- con modo 静 o \`prefers-reduced-motion\`: **cero actos**.`, añadir:

```md

**En el camino (Fase 3B).** La fauna vive en el mundo, como las piedras
(`scene/systems/fauna/anchoring.ts`; diseño en
`docs/superpowers/specs/2026-10-01-fase-3b-la-fauna-en-el-camino-design.md`):

- cada acto nace con un **ancla**, una copia del encuadre de la cámara: al
  avanzar, uno se acerca a los animales, los ve crecer y los deja atrás (lo que
  anda sale por abajo a ~10 u);
- **lo que vuela se adelanta**: su ancla se deja alcanzar hasta un mínimo
  (mariposas 8 u, bandadas 10, milano 22) y después avanza con la cámara; los
  gorriones que bajan a posarse, sólo mientras están en el aire;
- al caminar, los actos **nacen por delante**, con una ventaja según la
  velocidad; caminando rápido o retrocediendo no nace nada, y dejar atrás un
  acto adelanta el siguiente;
- cada estación declara su **cercanía** (`ambient.faunaDistance`): Gion íntimo,
  Ubicación lejano;
- **ningún animal se retira a la vista**: sólo fuera de cuadro, comprobado cada
  frame con la cámara real. Si se le acaba el tiempo a la vista, sigue su
  camino hasta salir; el milano entra y sale planeando, y las luciérnagas se
  encienden y se apagan.
```

- [ ] **Step 2: `CLAUDE.md`**

Sustituir:

```
bun run check:path   # comprobaciones puras del camino, el terreno, la cámara y el scroll
```

por:

```
bun run check:path   # comprobaciones puras del camino, el terreno, la cámara, el scroll y la fauna
```

Sustituir:

```
│   ├─ systems/fauna/          ← ★ bestiario, conductas, casting y director
```

por:

```
│   ├─ systems/fauna/          ← ★ bestiario, conductas, anclaje, casting y director
```

En la trampa «**Lo que se mueve con la cámara tiene que decidir si está anclado al mundo o a ella.**», sustituir:

```
  y como ese borde en profundidad está en cuadro, se desvanecen en él. Fauna:
  en 3A viaja con el encuadre (y patina con el scroll); 3B la ancla al mundo.
```

por:

```
  y como ese borde en profundidad está en cuadro, se desvanecen en él. Fauna:
  anclada al mundo, un ancla por acto (3B); lo que vuela, con un ancla que se
  desliza (ver la trampa siguiente a la del viaje).
```

Después de la trampa «**Un viaje no puede ir más deprisa de lo que el encuadre puede seguir.**» (termina en `` camino vuelve a crecer, `check:path` lo dirá antes que la revisión. ``), añadir:

```md
- **Lo que vuela no se puede anclar al mundo sin más.** Lo que anda sale por el
  borde inferior a ~10 u de la cámara: anclarlo es gratis. La franja alta, en
  cambio, vista de cerca baja hasta la altura de la cámara: el gorrión más bajo
  de una bandada nacida a 18–27 u no sale de cuadro hasta estar a 0–5 u, y el
  milano en lo más bajo de su térmica, a 5 u. Anclados, la cámara acabaría entre
  ellos. Por eso lo que vuela tiene un **ancla que se desliza** (`SLIDE` en
  `fauna/anchoring.ts`): se deja alcanzar hasta un mínimo y después avanza con
  la cámara. Lo que anda **nunca** se desliza: deslizarlo es hacerlo patinar.
- **Ningún animal se retira a la vista.** Un acto sólo sale de escena cuando
  ninguno de sus individuos está en cuadro, comprobado cada frame con la
  cámara real (`retirement`). Por eso nada se encoge al terminar: si se le
  acaba el tiempo a la vista, sigue su camino (`placeAt` extrapola) hasta salir.
  Una conducta nueva tiene que **empezar y terminar fuera de cuadro** —o, si es
  una luz, encenderse y apagarse—; `check:path` lo comprueba con cuatro aspectos
  de pantalla y simula el recorrido entero.
```

Sustituir la fila de fases:

```
| 3B | · La fauna en el camino (anclada al mundo, cercanía por estación) | ⏸ |
```

por:

```
| 3B | · La fauna en el camino (anclada al mundo, cercanía por estación) | ✅ pendiente de revisión |
```

- [ ] **Step 3: READMEs**

En `src/scene/systems/README.md`, sustituir:

```md
- `fauna/` — **Fase 2C**. Cuatro piezas, tres de ellas puras y comprobables sin
  navegador:
```

por:

```md
- `fauna/` — **Fase 2C**, anclada al mundo en la **3B**. Cinco piezas, cuatro de
  ellas puras y comprobables sin navegador:
```

y después del punto de `casting.ts` (`  - \`casting.ts\` — las reglas del director: cadencia, aforo, variedad.`), añadir:

```md
  - `anchoring.ts` — dónde vive cada acto en el mundo: dónde y cuándo nace
    (ventaja al caminar, cercanía por estación), el ancla que se desliza de lo
    que vuela, la prueba de cuadro con la cámara real y la regla de retirada:
    nunca a la vista.
```

En `src/scene/camera/README.md`, sustituir:

```md
  estación de la visita es un aterrizaje y con modo 静 no hay viaje. El
  parallax se suma encima, en los ejes locales.
```

por:

```md
  estación de la visita es un aterrizaje y con modo 静 no hay viaje. El
  parallax se suma encima, en los ejes locales. También escribe
  `PATH.velocity` (avance con signo, suavizado): con él decide la fauna si nace
  por delante o no nace (Fase 3B).
```

- [ ] **Step 4: Verificación final**

Run: `bun run check:path`
Expected: PASS, terminando en `✓ La fauna, en orden.`

Run: `bun run typecheck`
Expected: sin errores.

Run: `bun run build`
Expected: código de salida 0.

Run: `git status --short`
Expected: sólo los archivos de este plan (más los de 3A que ya estaban sin commitear). Sin commits.

- [ ] **Step 5: Parar y reportar**

Regla del proyecto: parada al final de cada bloque. Reportar al usuario:
- qué se hizo y qué comprobó `check:path` (número de actos simulados, retiradas por motivo, distancia mínima por conducta);
- el cambio respecto de lo hablado: lo que vuela se adelanta con un ancla que se desliza, y por qué (los números de §3.1 del spec);
- que la revisión visual es suya, con `bun run dev`. Puntos a mirar: caminar hacia una ardilla, una garza y un gato y dejarlos atrás; mariposas y gorriones que se adelantan; el milano que entra y sale; las luciérnagas de Gion; retroceder con un animal en cuadro; cambiar el tamaño de la ventana con fauna en escena; activar y desactivar 静; `?fauna=<especie>`; `/diagnostico` (distancia y estado de cada acto);
- los valores a calibrar (§10 del spec).
```
