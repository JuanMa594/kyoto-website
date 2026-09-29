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
