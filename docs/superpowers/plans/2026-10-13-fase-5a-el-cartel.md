# Fase 5A — Ubicación 位置, el cartel: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poner el cartel de `2.png` en Ubicación: una maqueta de Japón por prefecturas sobre un atril de piedra, con hover, zoom a Kyoto (Kinki y el lago Biwa) y el pin blanco con contorno shu, más *Ichi* / 位置 dibujado con `<InkKanji>` y la ficha de Kyoto.

**Architecture:** `bun run geo` genera, desde Natural Earth y con topología compartida, un `.generated.ts` con las prefecturas (completas para la base, encogidas para las losas) y el lago. La maqueta es un objeto más de `environment.decor` (`kind: 'maqueta'`), con huella, musgo y sombra de contacto. En la escena, base y losas son dos geometrías con atributo `aPref`. La elevación y el fundido al mar van en el shader con arrays de uniforms, integrados en CPU con muelles. El zoom es una línea de GSAP sobre `t ∈ [0,1]` que mueve el contenido dentro de la bandeja, con planos de recorte. El DOM habla con la escena por un objeto de módulo (`MAQUETA`). El store sólo guarda `mapZoom`.

**Tech Stack:** Next 16 (export estático) · React 19.2.8 · three 0.185.1 · @react-three/fiber 9.7 · GSAP 3.15 · Tailwind v4 · bun (sin Node) · topojson-server/simplify/client y clipper-lib (sólo desarrollo).

**Spec:** `docs/superpowers/specs/2026-10-13-fase-5a-el-cartel-design.md`

## Global Constraints

- Runtime y gestor de paquetes: **`bun` / `bunx`**. Nunca `npm` ni `npx`.
- **No hacer commits de código**: los decide el usuario. Sólo se versionan specs y planes.
- Idioma: comentarios, documentación y textos en **español**. Identificadores en inglés salvo los ya existentes en español (`maqueta`, `izquierda`…).
- Colores **sólo** en `src/styles/tokens.css`; la escena los lee con `scenePalette()`.
- Todo GLSL nuevo se compila en un **contexto WebGL2 real** (Chrome, consola sin «Shader Error»). **Dentro de un shader, nada de backticks.** En GLSL no se reutilizan nombres de un ámbito exterior.
- Nada de normales nulas: los triángulos de área cero se quitan antes de calcular normales.
- El canvas no captura el puntero. El contenido es DOM real. **Nunca dos contextos WebGL.**
- La cámara no se mueve por la maqueta: el zoom mueve la maqueta.
- Lo que cambia a 60 fps no vive en Zustand (objeto de módulo con un único escritor por campo).
- Gaze Nozarashi nunca por debajo de **1,2rem**.
- Verificación de cada tarea con `bun run typecheck` y `bun run check:path`.
- El botón DOM del zoom (`MaquetaToggle`) es **aislado**: quitarlo no rompe nada.

## Review Focus

1. **Irse de Ubicación con el zoom puesto** (riel, «atrás»). La maqueta tiene que volver a `japon` y no puede quedar el cursor de mano ni etiquetas flotando. Tarea 5: `MaquetaInput` restablece al desmontar. Tarea 7: paso «salir con zoom».
2. **Empezar a caminar con el zoom puesto.** Se deshace solo en cuanto la cámara deja la estación. Tarea 4: `useFrame` lo comprueba. Tarea 7: paso «caminar con zoom».
3. **Clic sobre el texto, el riel o un enlace**, encima de la maqueta. No hace zoom: `MaquetaInput` ignora los objetivos interactivos. Tarea 5.
4. **Girar el móvil con el zoom puesto.** `StationDecor` remonta la maqueta con la otra colocación y la pose sale de `t`, que vive en el módulo: no salta. Tarea 7: paso de rotación.
5. **Táctil: hacer scroll empezando sobre la maqueta.** No es un toque: se usa `click`, que el navegador no dispara al desplazar. Tarea 5.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `scripts/build-geo.ts` | + prefecturas, lago, topología, encogido → `prefectures.generated.ts` |
| `src/scene/objects/maqueta/prefectures.generated.ts` | El dato (generado, versionado) |
| `src/scene/objects/maqueta/maqueta.ts` | Medidas puras: bandeja, atril, huella, zoom |
| `src/scene/objects/maqueta/zoom.ts` | Poses puras: contenido → bandeja → objeto; objetivos por losa |
| `src/scene/objects/maqueta/maquetaGeometry.ts` | Geometrías (three): bandeja, base y losas con `aPref`, atril, pin |
| `src/scene/objects/maqueta/slabMaterial.ts` | Materiales de base y losas (+ profundidad), con el GLSL |
| `src/scene/objects/maqueta/input.ts` | `MAQUETA`: el puente DOM ↔ escena |
| `src/scene/objects/maqueta/Maqueta.tsx` | Montaje, raycast, muelles, recorte, zoom, etiquetas |
| `src/scene/objects/maqueta/Pin.tsx` | El pin que mira a la cámara |
| `src/components/sections/CartelTitle.tsx` | Romaji + `<InkKanji>` dibujado al llegar + halo + texto oculto |
| `src/components/ubicacion/MaquetaInput.tsx` | Puntero, clic, Escape, cursor de mano |
| `src/components/ubicacion/MaquetaToggle.tsx` | El botón aislado |
| `src/components/ubicacion/PrefectureLabels.tsx` | Etiquetas DOM colocadas desde `gsap.ticker` |
| `src/components/ubicacion/KyotoFicha.tsx` | La ficha (`aria-live`) |
| Modificados | `journey.ts`, `placement.ts`, `footprints.ts`, `contact.ts`, `moss.ts`, `StationDecor.tsx`, `useKyotoStore.ts`, `ubicacion/page.tsx`, `globals.css`, `messages/{es,en}.json`, `check-decor.ts`, `package.json`, `assets/geo/LICENSES.md`, `CLAUDE.md`, `docs/PLAN.md` |

---

### Task 1: El dato — prefecturas y lago en `bun run geo`

**Files:**
- Modify: `scripts/build-geo.ts` (añade un segundo producto al final, sin tocar el del ícono)
- Modify: `package.json` (devDependencies)
- Create (generado): `src/scene/objects/maqueta/prefectures.generated.ts`
- Modify: `assets/geo/LICENSES.md`

**Interfaces — Produces:**

```ts
/** Un anillo plano: x0, z0, x1, z1… en u de la maqueta (x al este, z al sur). */
export type FlatRing = readonly number[];
/** [exterior, ...agujeros]. */
export type FlatPolygon = readonly FlatRing[];
export interface PrefectureData {
  readonly code: number;          // JIS: 26 = Kyoto
  readonly name: string;          // «Kyōto»
  readonly nameJa: string;        // «京都府»
  readonly kinki: boolean;
  readonly base: readonly FlatPolygon[];  // completas (la base de costa)
  readonly slab: readonly FlatPolygon[];  // encogidas (las losas)
  readonly center: readonly [number, number];
}
export const MAP_SPAN: number;                       // lado mayor del mapa, en u
export const PREFECTURES: readonly PrefectureData[]; // 46, sin Okinawa
export const KYOTO_CITY: readonly [number, number];
```

- [ ] **Step 1: Dependencias de desarrollo**

Run: `bun add -d topojson-server topojson-simplify topojson-client clipper-lib @types/topojson-server @types/topojson-simplify @types/topojson-client @types/clipper-lib`

- [ ] **Step 2: El segundo producto de `build-geo.ts`**

Añadir al final del script (las funciones `project`, `area`, `centroid` y `BOUNDS`/`KYOTO` ya existen):

1. Cargar (descargando si falta, con `fetch` como el original) `ne_10m_admin_1_states_provinces.geojson` y `ne_10m_lakes.geojson` en `assets/geo/source/`.
2. Prefecturas: `adm0_a3 === 'JPN'`, fuera `JP-47` (Okinawa). De cada una, los polígonos cuya caja cae dentro de `BOUNDS`, proyectados con `project`. Fuera los islotes con área < `MIN_PART = 0.0015` en unidades finales (salvo el mayor de cada prefectura).
3. Topología compartida: `topology({ prefs })` sobre las coordenadas proyectadas → `presimplify` → `simplify(t, quantile(t, TARGET_POINTS / totalPoints))` con `TARGET_POINTS = 2500` → `feature()` de vuelta.
4. Encajar en `MAP_SPAN = 4.5` u (centro de la caja → 0; x al este; z = y proyectada, que ya crece hacia el sur).
5. Lago: el `Biwa Ko` de lagos, proyectado y encajado igual; con `clipper-lib` (escala 1e5), `Shiga = Shiga − lago` para la base.
6. Losas: `ClipperOffset` con `JOINT = −0.008` u (`jtMiter`) sobre la base de cada prefectura. Las partes que desaparecen o pierden más del 60 % del área se dejan **sin encoger**.
7. Por prefectura: `code` (de `iso_3166_2`), `name`, `nameJa` (de `name_ja`), `kinki` (`region === 'Kinki'`), `base`, `slab` y `center` (centroide del mayor anillo de la losa).
8. `KYOTO_CITY` = `KYOTO` proyectado y encajado.
9. Escribir el archivo con números a 4 decimales y anillos planos, y registrar en consola: prefecturas, vértices de base y de losa.

- [ ] **Step 3: Generar**

Run: `bun run geo`
Expected: `✓ 46 prefecturas, ~2500 vértices de base, ~2500 de losa → src/scene/objects/maqueta/prefectures.generated.ts`, y el ícono intacto (`git diff --stat src/components/nav/icons` vacío).

- [ ] **Step 4: Licencias**

Añadir a `assets/geo/LICENSES.md` las dos fuentes nuevas (`ne_10m_admin_1_states_provinces`, `ne_10m_lakes`): dominio público, uso en la maqueta de la Fase 5A.

- [ ] **Step 5: Typecheck** — `bun run typecheck` → sin errores.

---

### Task 2: El modelo — medidas, poses, decoración y comprobaciones

**Files:**
- Create: `src/scene/objects/maqueta/maqueta.ts`, `src/scene/objects/maqueta/zoom.ts`
- Modify: `src/config/journey.ts`, `src/scene/decor/placement.ts`, `footprints.ts`, `contact.ts`, `moss.ts`
- Test: `scripts/check-decor.ts` (sección «El cartel de Ubicación»)

**Interfaces — Produces:**

```ts
// maqueta.ts
export const MAQUETA_SIZE: {
  tray: number; trayThickness: number; pivotY: number; columnRadius: number;
  baseHeight: number; slabHeight: number; footprint: number; foot: number; top: number;
};
export const MAQUETA_ZOOM: { tiltJapon: number; tiltKyoto: number; scale: number; heightScale: number; kyotoAt: readonly [number, number]; duration: number };
export const MAQUETA_LIFT: { kyoto: number; hover: number; sunk: number; sea: number };
// zoom.ts
export interface TrayPose { tilt: number; scale: number; heightScale: number; offsetX: number; offsetZ: number }
export function trayPose(t: number): TrayPose;
export function contentToTray(x: number, z: number, pose: TrayPose, out: { x: number; z: number }): void;
export function trayToObject(x: number, y: number, z: number, tilt: number, out: { x: number; y: number; z: number }): void;
export function slabTargets(t: number, hover: number, lift: Float32Array, sea: Float32Array): void;
export const KYOTO_INDEX: number;
export const KINKI: readonly number[]; // índices en PREFECTURES
// journey.ts
export interface DecorMaqueta extends DecorObjectBase { readonly kind: 'maqueta' }
```

- [ ] **Step 1: Las comprobaciones primero** (`scripts/check-decor.ts`, nueva sección antes de «Los kanji»):

```ts
section('El cartel de Ubicación');

const UBI = stationIndex('ubicacion');
const maquetaOf = (layout: DecorLayout) => layout.objects.filter((o) => o.item.kind === 'maqueta');
check('Ubicación tiene una maqueta, en horizontal y en vertical',
  maquetaOf(stationDecorLayout(UBI, false)).length === 1 && maquetaOf(stationDecorLayout(UBI, true)).length === 1);
check('46 prefecturas, sin Okinawa', PREFECTURES.length === 46 && !PREFECTURES.some((p) => p.code === 47));
check('Kinki tiene las siete y Kyoto es una de ellas', KINKI.length === 7 && KINKI.includes(KYOTO_INDEX));
const shiga = PREFECTURES.find((p) => p.code === 25)!;
check('el lago Biwa es un agujero en Shiga', shiga.base.some((poly) => poly.length >= 2));
check('todos los anillos cerrados y con ≥ 3 vértices',
  PREFECTURES.every((p) => [...p.base, ...p.slab].every((poly) => poly.every((r) => r.length >= 6 && r.length % 2 === 0))));
// Las dos poses: la bandeja nunca toca el suelo y cabe en su huella.
for (const t of [0, 1]) {
  const pose = trayPose(t);
  const out = { x: 0, y: 0, z: 0 };
  const h = MAQUETA_SIZE.tray / 2;
  let lowest = Infinity; let reach = 0; let top = -Infinity;
  for (const [x, z] of [[-h, -h], [h, -h], [-h, h], [h, h]] as const) {
    trayToObject(x, -MAQUETA_SIZE.trayThickness, z, pose.tilt, out);
    lowest = Math.min(lowest, out.y); reach = Math.max(reach, Math.hypot(out.x, out.z)); top = Math.max(top, out.y);
    trayToObject(x, 0, z, pose.tilt, out);
    top = Math.max(top, out.y); reach = Math.max(reach, Math.hypot(out.x, out.z));
  }
  check(`pose ${t}: el borde de delante queda a ≥ 0,25 u del suelo`, lowest >= 0.25, lowest.toFixed(2));
  check(`pose ${t}: la bandeja cabe en su huella`, reach <= MAQUETA_SIZE.footprint, `${reach.toFixed(2)} ≤ ${MAQUETA_SIZE.footprint}`);
  check(`pose ${t}: no pasa de MAQUETA_SIZE.top`, top <= MAQUETA_SIZE.top, top.toFixed(2));
}
// En el zoom, las siete de Kinki dentro de la bandeja.
const zoomed = trayPose(1);
const inTray = { x: 0, z: 0 };
const half = MAQUETA_SIZE.tray / 2 * 0.94;
const kinkiInside = KINKI.every((i) => PREFECTURES[i]!.slab.every((poly) => {
  const ring = poly[0]!;
  for (let k = 0; k < ring.length; k += 2) {
    contentToTray(ring[k]!, ring[k + 1]!, zoomed, inTray);
    if (Math.abs(inTray.x) > half || Math.abs(inTray.z) > half) return false;
  }
  return true;
}));
check('zoom: Kinki entera dentro de la bandeja', kinkiInside);
```

Además: la sección de fauna repite su bucle para `UBI` (`d = STATION_DEPTHS[UBI]` y `d + 20`) con las especies de Ubicación, y la de cámara sigue cubriendo los viajes Home ↔ Ubicación, que ya pasan por la maqueta. Imports nuevos: `PREFECTURES` de `prefectures.generated`, `MAQUETA_SIZE` de `maqueta`, `trayPose`, `contentToTray`, `trayToObject`, `KINKI`, `KYOTO_INDEX` de `zoom`.

- [ ] **Step 2: Correr** — `bun run check:path` → FALLA (no existen los módulos).

- [ ] **Step 3: `maqueta.ts`** (puro, sin three). Valores de partida: `tray 5`, `trayThickness 0.14`, `pivotY 2.25`, `columnRadius 0.42`, `baseHeight 0.05`, `slabHeight 0.09`, `footprint 2.6`, `foot 0.55`, `top 4.4`. Zoom: `tiltJapon 40°`, `tiltKyoto 50°`, `scale 2.8`, `heightScale 1.5`, `kyotoAt [0.35, −0.75]`, `duration 1.6`. Lift: `kyoto 0.08`, `hover 0.12`, `sunk −0.035`, `sea 0.88`.

- [ ] **Step 4: `zoom.ts`** (puro). Con `K = KYOTO_CITY` y `s = lerp(1, scale, t)`:
  - `trayPose(t)`: `tilt = lerp(tiltJapon, tiltKyoto, t)`, `scale = s`, `heightScale = lerp(1, heightScale, t)`, `offset = lerp(K, kyotoAt, t) − K·s`. Así, con `t = 0`, el contenido queda tal cual, y con `t = 1`, Kyoto cae en `kyotoAt`.
  - `contentToTray(x, z, pose)` = `(x·s + offX, z·s + offZ)`.
  - `trayToObject(x, y, z, tilt)` = rotación en X por `+tilt` y traslación a `(0, pivotY, 0)`: `y' = pivotY + y·cos − z·sin`, `z' = y·sin + z·cos`. El borde sur (z > 0) baja y el norte sube.
  - `slabTargets(t, hover, lift, sea)`: Kyoto `kyoto`, Kinki 0, el resto `sunk·t`; más `hover` si `i === hover`. `sea`: fuera de Kinki `sea·t`, el resto 0.
  - `KYOTO_INDEX` (`code === 26`) y `KINKI`.

- [ ] **Step 5: `journey.ts`**: `DecorMaqueta` en la unión `DecorItem`. En Ubicación, `decor: [{ kind: 'maqueta', at: { d: 0, u: -4.6 }, yaw: 0.3, portrait: { d: 14, u: -3.4, yaw: 0.15, scale: 0.8 } }]`, `moss: 0.5` y `accent: '#306828'`. (`portrait` admite `yaw`/`scale` sólo si `DecorAt` se amplía; si no, `yaw` y `scale` van al objeto y valen para los dos aspectos. Elegir la segunda opción para no tocar `DecorAt`.)

- [ ] **Step 6: Decoración**:
  - `placement.ts`: sin volteo para la maqueta (`const flip = at.u < 0 && item.kind !== 'maqueta' ? Math.PI : 0`). La maqueta mira siempre a la cámara.
  - `footprints.ts` → `objectBases`: rama `maqueta`, un círculo en `(o.x, o.z)` con `r = footprint·scale`, `foot = foot·scale`, `top = o.y + top·scale` y `faunaMargin: SOLID_MARGIN`.
  - `contact.ts`: `SPREAD.maqueta = 1.7` y `STRENGTH.maqueta = 0.85`.
  - `moss.ts`: `PER_BASE.maqueta = 6`.

- [ ] **Step 7: Calibrar hasta verde** — `bun run check:path`. Si una piedra choca o la cámara pasa a < 1,5 u, alejar `u`. Si la fauna de Ubicación baja del 75 %, bajar `footprint` (sin que la bandeja deje de caber) o mover la maqueta. Expected: todo ✓.

---

### Task 3: Geometría y materiales

**Files:**
- Create: `src/scene/objects/maqueta/maquetaGeometry.ts`, `src/scene/objects/maqueta/slabMaterial.ts`
- Test: `scripts/check-decor.ts` (normales y presupuesto)

**Interfaces — Produces:**

```ts
export interface MaquetaParts {
  tray: BufferGeometry;      // bandeja, cara superior en y = 0 (espacio de la bandeja)
  base: BufferGeometry;      // grupos: 0 caras, 1 cantos; atributo aPref
  slabs: BufferGeometry;     // ídem, encima de la base
  column: BufferGeometry;    // el atril, en espacio del objeto
  pinFace: BufferGeometry;   // grupos: 0 cara blanca, 1 bisel y canto shu
  pinDisc: BufferGeometry;
}
export function maquetaGeometry(): MaquetaParts; // memo de módulo
export const PIN_HEIGHT: number;
export interface SlabUniforms { uLift: { value: Float32Array }; uSea: { value: Float32Array } }
export function createSlabUniforms(): SlabUniforms;
export function createMapMaterials(palette: ScenePalette, uniforms: SlabUniforms, clipping: Plane[]): {
  baseFace: MeshStandardMaterial; baseSide: MeshStandardMaterial;
  slabFace: MeshStandardMaterial; slabSide: MeshStandardMaterial; depth: MeshDepthMaterial;
};
```

- [ ] **Step 1: Comprobaciones** (en la sección de Ubicación):

```ts
const parts = maquetaGeometry();
let mapTriangles = 0; let mapBad = 0;
for (const g of [parts.tray, parts.base, parts.slabs, parts.column, parts.pinFace, parts.pinDisc]) {
  const position = g.getAttribute('position'); const normal = g.getAttribute('normal');
  mapTriangles += (g.index ? g.index.count : position.count) / 3;
  for (let i = 0; i < normal.count; i += 1) {
    const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
    if (!Number.isFinite(length) || length < 0.5) mapBad += 1;
  }
}
check('maqueta: ninguna normal nula ni NaN', mapBad === 0, `${mapBad}`);
check('maqueta: menos de 40 000 triángulos', mapTriangles < 40000, `${mapTriangles}`);
const prefIds = new Set(Array.from(parts.slabs.getAttribute('aPref').array as Float32Array));
check('cada losa lleva su aPref', prefIds.size === PREFECTURES.length);
```

- [ ] **Step 2: `maquetaGeometry.ts`**:
  - Cada polígono se convierte en `Shape(x, −z)` con sus agujeros como `Path`. Se extruye con `ExtrudeGeometry({ depth, bevelEnabled: false })` y `rotateX(−π/2)`, que lleva la forma (x, −z) a (x, y, z) con la extrusión en +y.
  - Se recorren los grupos de la extrusión: **fuera las tapas de abajo** (normal y < −0,9) y los triángulos de área cero. Se acumulan las caras y los cantos en dos listas con su `aPref`.
  - La base va de y = 0 a `baseHeight`; las losas, de `baseHeight` a `baseHeight + slabHeight`.
  - Bandeja: `RoundedBoxGeometry(tray, thickness, tray, 2, 0.05)` trasladada a `y = −thickness/2`.
  - Atril: un torno de doce lados con los tambores y el capitel hasta `pivotY − trayThickness`. Sin vértices en el eje: el pie y el capitel se cierran con un disco aparte, o el perfil empieza en r > 0.
  - Pin: una gota de 0,5 u de alto (`Shape`: círculo de r = 0,17 arriba y la punta abajo), `ExtrudeGeometry({ depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.028, bevelSegments: 2 })`, con la punta en el origen. El disco: `CircleGeometry(0.075, 24)` en el centro del círculo, delante de la cara.

- [ ] **Step 3: `slabMaterial.ts`**. Sobre `createDecorMaterial`, se encadena otro `onBeforeCompile`, como `withMoss`:

```glsl
// vertex: tras #include <common>
#define MAP_PREFS 46
attribute float aPref;
uniform float uLift[MAP_PREFS];
uniform float uSea[MAP_PREFS];
uniform float uKyoto;
varying float vSea;
varying float vKyoto;
// vertex: tras #include <begin_vertex>
int prefIndex = int(aPref + 0.5);
transformed.y += uLift[prefIndex];
vSea = uSea[prefIndex];
vKyoto = 1.0 - step(0.5, abs(aPref - uKyoto));
// fragment: tras #include <common>
uniform vec3 uSeaColor;
uniform vec3 uKyotoColor;
uniform float uKyotoTint;
varying float vSea;
varying float vKyoto;
// fragment: tras #include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, uKyotoColor, vKyoto * uKyotoTint);
diffuseColor.rgb = mix(diffuseColor.rgb, uSeaColor, vSea);
```

  - Colores. Cara de losa: washi, con Kyoto al 28 % hacia shu. Canto de losa: ishi. Cara de base: sumi. Canto de base: koke-deep. El mar es ishi. El tinte de Kyoto en la base es 0.
  - El material de profundidad (`MeshDepthMaterial` con `RGBADepthPacking`) lleva el mismo desplazamiento y los mismos planos de recorte.
  - Todos llevan `clippingPlanes = clipping` y `customProgramCacheKey` propio (`maqueta-base-cara`, …).

- [ ] **Step 4:** `bun run typecheck` y `bun run check:path` → ✓.

---

### Task 4: La maqueta en la escena

**Files:**
- Create: `src/scene/objects/maqueta/input.ts`, `Maqueta.tsx`, `Pin.tsx`
- Modify: `src/store/useKyotoStore.ts`, `src/scene/decor/StationDecor.tsx`

**Interfaces:**

```ts
// input.ts
export const MAQUETA: {
  // Escribe MaquetaInput (DOM):
  pointer: { x: number; y: number; present: boolean; moved: boolean };
  clicks: { x: number; y: number; touch: boolean }[];
  // Escribe Maqueta (escena):
  active: boolean;
  hover: number;            // índice en PREFECTURES, −1 si nada
  overKyoto: boolean;
  zoomT: number;            // 0 japon … 1 kyoto (lo tween-ea Maqueta)
  labelX: Float32Array; labelY: Float32Array; labelOn: Uint8Array;
};
// store
mapZoom: 'japon' | 'kyoto'; setMapZoom: (zoom: 'japon' | 'kyoto') => void;
```

- [ ] **Step 1: Store**: `mapZoom: 'japon'` y `setMapZoom`. No se persiste.

- [ ] **Step 2: `Maqueta.tsx`** (`export default`, para el `lazy`). Estructura:

```tsx
<group position={[placed.x, placed.y, placed.z]} rotation={[0, placed.yaw, 0]} scale={placed.scale}>
  <mesh geometry={parts.column} material={stone} castShadow receiveShadow />
  <group ref={tray} position={[0, MAQUETA_SIZE.pivotY, 0]}>          {/* rotation.x = tilt */}
    <mesh geometry={parts.tray} material={trayMat} receiveShadow />
    <group ref={content}>                                             {/* pose: escala y desplazamiento */}
      <mesh geometry={parts.base} material={[baseFace, baseSide]} receiveShadow />
      <mesh ref={slabs} geometry={parts.slabs} material={[slabFace, slabSide]} customDepthMaterial={depth} castShadow receiveShadow />
    </group>
  </group>
</group>
<Pin …/>
```

`useFrame(({ camera }, delta) => …)`:
1. `MAQUETA.active = |PATH.d − D_ubicacion| < 0.6 && |PATH.offset| < 0.5`. Si hay zoom y la cámara se ha ido a más de 0.6 u, `setMapZoom('japon')`.
2. Pose desde `MAQUETA.zoomT`: `tray.rotation.x = tilt`, `content.scale = (s, hs, s)`, `content.position = (offX, 0, offZ)`.
3. Planos de recorte: cuatro planos locales (`x = ±h`, `z = ±h`, con `h = tray/2 · 0.96`) llevados al mundo con `tray.matrixWorld`.
4. Raycast (sólo si `active` y el puntero se movió o hay clics): `Raycaster.setFromCamera(ndc, camera)` contra `slabs`. Se descartan los impactos fuera de la bandeja (con `worldToLocal`) y, en el zoom, los de fuera de Kinki. `hover = aPref` de `face.a`. Al hacer clic sobre Kyoto, `setMapZoom` alterna; con un toque sobre otra prefectura, `touchHover = i` durante 2,5 s.
5. Muelles: `slabTargets` y luego `stepSpring` por losa (`{ omega: 10, zeta: 0.55, gain: 0, delay: 0 }`), con subpasos de 1/60 como mucho. Los resultados van a `uLift`. `uSea` sale directo de los objetivos.
6. Etiquetas: el centro de cada losa (contenido → bandeja → mundo, a la altura de su cara) se proyecta con `camera` y se escribe en px en `labelX`/`labelY`. `labelOn = active && (i === hover || (zoomT > 0.6 && kinki))`.

El zoom: al montar, una suscripción al store; con cada cambio de `mapZoom`, `gsap.to(MAQUETA, { zoomT, duration, ease: 'piedra' })`. Con `selectMotionAllowed` falso, `gsap.set`. Al montar, `gl.localClippingEnabled = true`. Al desmontar, `dispose()` de los materiales y `MAQUETA.active = false`.

- [ ] **Step 3: `Pin.tsx`**. Grupo en el mundo. En cada frame: la punta en Kyoto (contenido → bandeja → mundo, a la altura de la losa de Kyoto + 0,06), elevada `0.04 + 0.03·sin(1.4·t)`. El cuaternión es el de la cámara: siempre de frente. La escala es `1 + 0.25·zoomT`. Materiales: cara washi, bisel/canto shu y disco shu, todos con `cartelLook`. Proyecta sombra en el tier alto.

- [ ] **Step 4: `StationDecor.tsx`**: `const Maqueta = lazy(() => import('@/scene/objects/maqueta/Maqueta'))` y, en `DecorSet`, para `kind === 'maqueta'`, `<Suspense fallback={null}><Maqueta placed={placed} palette={palette} profile={profile} /></Suspense>`.

- [ ] **Step 5:** `bun run typecheck` → ✓.

---

### Task 5: El DOM — cartel, entrada, botón, etiquetas y ficha

**Files:**
- Create: `src/components/sections/CartelTitle.tsx`, `src/components/ubicacion/{MaquetaInput,MaquetaToggle,PrefectureLabels,KyotoFicha}.tsx`
- Modify: `src/app/[locale]/ubicacion/page.tsx`, `src/styles/globals.css`, `src/messages/{es,en}.json`
- Test: `scripts/check-decor.ts` (textos en los dos idiomas)

- [ ] **Step 1: Comprobación de textos**:

```ts
for (const locale of ['es', 'en'] as const) {
  const m = (await import(`../src/messages/${locale}.json`)).default as { ubicacion?: Record<string, unknown> };
  const u = m.ubicacion ?? {};
  const fichaKeys = ['prefectura', 'region', 'coords', 'poblacion', 'distancias'];
  check(`${locale}: textos del cartel de Ubicación`,
    ['romaji', 'srTitle', 'tagline', 'summary', 'zoomIn', 'zoomOut', 'fichaLabel'].every((k) => typeof u[k] === 'string') &&
    fichaKeys.every((k) => typeof (u.ficha as Record<string, { label?: string; value?: string }>)?.[k]?.value === 'string'));
}
```

- [ ] **Step 2: Mensajes** (`ubicacion`):
  - es: `romaji «Ichi»`, `srTitle «Ubicación — Ichi»`, `tagline «Ubicación · dónde queda Kyoto»`, `summary «En el corazón de Honshū, al oeste de Japón. Recorre el mapa: cada prefectura dice su nombre. Toca Kyoto para acercarte.»`, `zoomIn «Acercarse a Kyoto»`, `zoomOut «Ver todo Japón»` y `fichaLabel «Kyoto en datos»`.
  - La `ficha`, cada entrada con su etiqueta y su valor: prefectura «Kyoto (京都府)»; región «Kansai (Kinki)»; coordenadas «35,0° N · 135,8° E»; población «~1,46 millones de habitantes»; distancias «Ōsaka ~45 km · Nara ~35 km · Tokio ~370 km (2 h 15 en shinkansen)».
  - en: los mismos en inglés.

- [ ] **Step 3: `CartelTitle`** (cliente).
  - Marcado: `<h1 className="cartel-title">` con `<span className="sr-only">{srTitle} <span lang="ja">{kanji}</span></span>`, la palabra romaji `aria-hidden` y `<InkKanji>`. Color: `--cartel-accent` = acento de la estación.
  - Al llegar dibuja los trazos con la misma técnica que `HomeIntro`: máscara, `strokeDashoffset` de 1 a 0 por trazo (~1,2 s en total) y, al terminar, se quita la máscara y se limpian sólo las propiedades animadas.
  - «Al llegar» significa que la `.content-arrival` que lo contiene pasa de `pending` a `shown` (un `MutationObserver`). Si ya estaba `shown` al montar —la primera página de la visita—, no se dibuja, para no borrar y redibujar lo que el HTML estático ya mostró.
  - Sin movimiento, nada.

- [ ] **Step 4: `MaquetaInput`** (cliente, sin marcado):
  - `pointermove` → `MAQUETA.pointer` (NDC, `moved = true`). `pointerleave` en `document` → `present = false`.
  - `click` → si el objetivo no está dentro de `a, button, input, select, textarea, label, summary, [role=button], .tramo-card, .rail`, se empuja a `MAQUETA.clicks` con `touch = event.pointerType !== 'mouse'`.
  - `keydown` Escape → `setMapZoom('japon')`.
  - Un callback de `gsap.ticker` pone `document.documentElement.style.cursor = 'pointer'` cuando `MAQUETA.overKyoto` y lo quita al dejar de estarlo.
  - Al desmontar: quita los oyentes, restablece el cursor, `setMapZoom('japon')` y vacía `clicks`.

- [ ] **Step 5: `MaquetaToggle`** (cliente): `<button type="button" className="paper cartel-button" aria-pressed={zoom === 'kyoto'} onClick={() => setMapZoom(zoom === 'kyoto' ? 'japon' : 'kyoto')}>`. Nada más depende de él.

- [ ] **Step 6: `PrefectureLabels`** (cliente):
  - Una `<span className="pref-label" aria-hidden>` por prefectura, con `{name} · <span lang="ja">{nameJa}</span>`.
  - Un callback de `gsap.ticker` les pone `translate` desde `MAQUETA.labelX/Y` y `data-on` desde `labelOn`, escribiendo sólo cuando cambia.
  - Contenedor `position: fixed; inset: 0; pointer-events: none`.

- [ ] **Step 7: `KyotoFicha`** (cliente):
  - `<div aria-live="polite">` siempre presente.
  - Dentro, un `<dl className="kyoto-ficha">` que sólo se rinde con `mapZoom === 'kyoto'`. Sin JS no aparece nunca.

- [ ] **Step 8: Página**: `ActiveStation`, luego `ContentArrival key="ubicacion"` con `<main id="contenido" className="ubicacion-cartel">`. Dentro, `<div className="ubicacion-cartel__text paper-halo">` con `CartelTitle`, el tagline (`brush`), el resumen, `MaquetaToggle` y `KyotoFicha`. Después, `<MaquetaInput />`, `<PrefectureLabels />` y `<PathTramo station="ubicacion" />`.

- [ ] **Step 9: CSS** (`globals.css`, junto al cartel de la Home):
  - `.ubicacion-cartel`: grid, `min-height: 100dvh`, `align-items: center`, `justify-items: end`.
  - `__text`: `width: min(36vw, 34rem)` y `margin-right: 8vw`.
  - `.cartel-title__word`: `--text-cartel`, color `--cartel-accent`. El kanji, `margin-top: 0.3em`.
  - Tagline: 1,35rem. Resumen: ≥ 1,2rem.
  - `.cartel-button` con borde koke-deep a la izquierda.
  - `.kyoto-ficha`: grid de dos columnas, Gaze ≥ 1,2rem.
  - `.pref-label`: papel translúcido, 1,2rem, `opacity` con transición por `data-on`.
  - Vertical: `align-items: start`, `padding-top: 14dvh`, texto a la izquierda, `width: min(84vw, 30rem)`.

- [ ] **Step 10:** `bun run typecheck`, `bun run check:path` y `bun run build` → ✓.

---

### Task 6: Revisión en el navegador y calibración

- [ ] **Step 1:** `bun run dev`. Abrir `/es/ubicacion/` en Chrome. En la consola no tiene que aparecer ningún «Shader Error» ni ningún error.
- [ ] **Step 2: 16:9.**
  - La maqueta a la izquierda, entera, inclinada; Hokkaido puede rozar el tercio superior.
  - El texto a la derecha, en verde.
  - El pin blanco con contorno shu, legible.
  - Las juntas de tinta se ven, sin parpadeos.
- [ ] **Step 3: Hover.** Cada prefectura sube con peso y dice su nombre. La mano aparece sólo sobre Kyoto.
- [ ] **Step 4: Zoom.**
  - Ida y vuelta, con clic y con el botón; también Escape.
  - Al caminar se deshace solo.
  - Kinki entera dentro de la bandeja, el lago Biwa visible y la ficha presente.
- [ ] **Step 5: 9:16** (emulación móvil). La maqueta entera, el texto arriba, el toque con nombre y el zoom.
- [ ] **Step 6: 静 / movimiento reducido.** Zoom inmediato y kanji sin dibujar.
- [ ] **Step 7: Llegada desde la Home.** El kanji se dibuja al llegar.
- [ ] **Step 8: Salir con zoom y rotación.** Sin restos (Review Focus 1 y 4).
- [ ] **Step 9: Rendimiento.** Draw calls y fps en el cartel, antes y después (`/es/diagnostico/` o `renderer.info`).
- [ ] **Step 10: Calibrar.** Ajustar en `maqueta.ts`/`journey.ts` lo que no cuadre (inclinación, tamaño, `kyotoAt`, tinte de Kyoto) y volver a correr `check:path`.

---

### Task 7: Documentación

- [ ] `CLAUDE.md`:
  - En el árbol, `scene/objects/maqueta/`, `components/ubicacion/` y `CartelTitle`.
  - `bun run geo` produce también las prefecturas.
  - La 5A en el estado de las fases y las trampas nuevas que hayan aparecido.
- [ ] `docs/PLAN.md`:
  - §5, una subsección «Ubicación (Fase 5A)».
  - §7, la fila del mapa de Japón actualizada.
  - §10, la 5A marcada al cerrar la revisión.
- [ ] El spec, con cualquier desviación que haya habido.
