/**
 * ★ El sendero del viaje, como matemática pura.
 *
 * Las siete estaciones de `journey.ts` son puntos de un único camino que avanza
 * siempre hacia el fondo (−Z). El parámetro es la **profundidad recorrida** `d`
 * (con z = −d): cada estación está en `d = pathT × PATH_LENGTH`, y entre dos
 * estaciones el camino se desvía de lado (`lateral`) y sube o baja hacia la
 * altura de la siguiente (`altitude`).
 *
 * Dos decisiones sostienen todo lo demás:
 *
 *   · **El camino nunca vuelve atrás.** A cada profundidad le corresponde un
 *     solo punto del eje, así que el terreno, las colinas y la mezcla de
 *     ambientes se consultan en O(1), sin buscar el punto más cercano de una
 *     curva. El precio es no tener curvas en U, que una cámara observadora
 *     tampoco querría tomar.
 *   · **La tangente es nula en cada estación.** El desvío y la altura van de
 *     una estación a la siguiente con un `smoothstep`, así que la vista de cada
 *     estación es frontal y llana, de cartel, y las curvas y las cuestas
 *     ocurren entre ellas.
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
import { lerp, smoothstep } from '@/lib/procedural';

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
 * Dónde empieza a cambiar el tramo que sale de la estación `i`: en la propia
 * estación o, si el tramo declara un llano (`tramo.flat`), al terminarlo. Hasta
 * ahí el camino sigue recto, a la misma altura y en la misma zona.
 */
function segmentStart(i: number): number {
  return STATION_DEPTHS[i]! + (JOURNEY[i]!.tramo.flat ?? 0);
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
  return lerp(from, to, smoothstep(segmentStart(i), STATION_DEPTHS[i + 1]!, d));
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
  const d0 = segmentStart(i);
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
 * Altura del eje del camino en `d`, relativa a la Home.
 *
 * Cada estación declara su altura y el camino va de una a otra con el mismo
 * `smoothstep` que el desvío lateral: las cuestas —la subida a Fushimi Inari,
 * la bajada a Gion— ocurren **en los tramos**, y en cada estación el camino
 * queda llano, con la vista frontal de cartel.
 */
export function pathY(d: number): number {
  const i = segmentAt(d);
  const from = JOURNEY[i]!.environment.altitude;
  const to = JOURNEY[i + 1]!.environment.altitude;
  return lerp(from, to, smoothstep(segmentStart(i), STATION_DEPTHS[i + 1]!, d));
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
  /**
   * Avance de la cámara con signo, suavizado, en u/s; 0 tras un salto seco.
   * La fauna decide con él si nace por delante o no nace (Fase 3B).
   */
  velocity: number;
  frame: PathFrame;
  /** Punto al que mira la cámara, en mundo. */
  focus: Point3;
} = {
  d: 0,
  progress: 0,
  advance: 0,
  offset: 0,
  velocity: 0,
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
