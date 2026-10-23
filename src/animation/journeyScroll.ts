/**
 * Del scroll de la página a la profundidad de la cámara, en puro.
 *
 * Cada página de estación tiene dos partes:
 *
 *   · **contenido**: mientras se lee, la cámara avanza como mucho
 *     `READING_DRIFT` unidades, menos si el contenido es corto
 *     (`readingProgress`). Se sigue «en» la estación;
 *   · **tramo**: la sección del final (`PathTramo`), cuyo scroll lleva la
 *     cámara de la estación a la siguiente con la curva del tramo.
 *
 * `SCROLL_PATH` lo escribe `useJourneyScroll` (un solo escritor) y lo lee el
 * rig de cámara en cada frame. Lleva la estación que lo escribió: si la página
 * que hay ahora no es de ninguna estación (`/diagnostico`), la cámara se queda
 * donde estaba en vez de volver a cero.
 */

import type { StationSlug } from '@/config/journey';
import { clamp, smoothstep } from '@/lib/procedural';
import { STATION_DEPTHS, stationIndex } from '@/scene/path/journeyPath';
import { cardStopDepth, READING_DRIFT, STOP_DRIFT, trechoShares, tramoTrechos } from '@/scene/path/tramoStops';

export { READING_DRIFT };

export interface ScrollPath {
  station: StationSlug | null;
  /** Lo hecho del desvío de lectura, 0–1 (`readingProgress`). */
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

/**
 * Cuánto del desvío de lectura lleva hecho la cámara (0–1).
 *
 * Antes era el progreso del contenido, tal cual. Con un contenido corto —hoy,
 * 96 px antes de que asome el tramo— las 4 u cabían en el primer golpe de rueda
 * y, como el tramo arranca desde velocidad cero, la cámara daba un tirón y casi
 * se paraba. Dos cambios:
 *
 *   · **Con la curva del caminar** (`walkEase`) sobre el contenido: arranca
 *     parada y llega parada al tramo, que arranca también desde cero. Sin
 *     escalón de velocidad en ninguno de los dos empalmes.
 *   · **Tanto desvío como contenido haya**: nada con una pantalla o menos, todo
 *     desde dos. Así su velocidad nunca pasa de la del caminar: en un contenido
 *     corto, comprimir las 4 u es el tirón de antes.
 */
export function readingProgress(scrolledPx: number, contentPx: number, viewportPx: number): number {
  const content = Math.max(1, contentPx);
  const viewport = Math.max(1, viewportPx);
  const share = clamp((content - viewport) / viewport, 0, 1);
  return walkEase(unit(scrolledPx / content)) * share;
}

/** Un NaN o un infinito en la cámara es un cuadro en blanco: se sanea aquí. */
function unit(value: number): number {
  return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
}

/* ── El tramo: caminar y leer ──────────────────────────────────────────── */

/**
 * Lo que mide el caminar de un tramo de referencia (~133 u de camino), en vh.
 * Cada tramo camina en proporción a su distancia (`tramoWalkVh`): la cámara
 * avanza igual de rápido por cada movimiento de la rueda en todos, y un tramo
 * corto —el de la Home a Ubicación, la mitad— dura la mitad.
 */
export const TRAMO_WALK_VH = 440;

/** vh de caminar por cada unidad de camino. */
const WALK_VH_PER_UNIT = 3.3;

/** Lo que suma cada tarjeta del tramo: su parada de lectura. */
export const TRAMO_STOP_VH = 80;

/** En cuántos vh entra una tarjeta antes de su parada, y sale después. */
const CARD_FADE_VH = 30;

/** Lo que camina el tramo que sale de esta estación, en vh: su distancia. */
export function tramoWalkVh(station: StationSlug): number {
  const i = stationIndex(station);
  const next = STATION_DEPTHS[i + 1];
  if (next === undefined) return 0;
  return Math.round((next - STATION_DEPTHS[i]!) * WALK_VH_PER_UNIT);
}

/** Alto del tramo: el caminar más una parada por tarjeta. */
export function tramoHeightVh(cards: number, walkVh = TRAMO_WALK_VH): number {
  return walkVh + Math.max(0, Math.floor(cards)) * TRAMO_STOP_VH;
}

/**
 * La curva del caminar: la misma que `power2.inOut` de GSAP. Cada trecho
 * arranca con peso, cruza a buen paso y frena al llegar —a una tarjeta o a la
 * siguiente estación—. Escrita aquí, y no pedida a GSAP, para que el reparto
 * del tramo sea puro y se pueda comprobar.
 */
export function walkEase(t: number): number {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
}

/**
 * El reparto de un tramo. `shares` es lo que avanza cada trecho, en fracción
 * del tramo (`tramoStops.ts`); sin él, todos iguales. **El vh de cada trecho es
 * proporcional a lo que avanza**: la cámara camina igual de rápido en todos,
 * también en el primero, que con un llano de salida (`tramo.flat`) es más
 * largo que los demás.
 */
function tramoLayout(cards: number, walkVh: number, shares?: readonly number[]) {
  const count = Math.max(0, Math.floor(cards));
  const parts = shares && shares.length === count + 1 ? shares : trechoShares(count);
  const total = parts.reduce((sum, share) => sum + share, 0) || 1;
  const walks = parts.map((share) => (walkVh * share) / total);
  /** Dónde empieza la parada `index`, en vh. */
  const stopStart = (index: number) => {
    let at = index * TRAMO_STOP_VH;
    for (let k = 0; k <= index; k += 1) at += walks[k]!;
    return at;
  };
  return { count, walks, shares: parts, height: tramoHeightVh(count, walkVh), stopStart };
}

/** Lo que avanza cada trecho del tramo que sale de `station`: para pasarlo a las funciones de abajo. */
export function stationTrechos(station: StationSlug): number[] {
  return tramoTrechos(stationIndex(station));
}

/**
 * Cuánto del tramo lleva recorrido la cámara (0–1) para un progreso de scroll
 * (0–1). El caminar se parte en `cards + 1` trechos y, entre ellos, una parada
 * por tarjeta en la que la cámara casi se detiene. Sin tarjetas es la curva del
 * caminar de punta a punta.
 */
export function tramoFraction(
  progress: number,
  cards: number,
  walkVh = TRAMO_WALK_VH,
  shares?: readonly number[],
): number {
  const layout = tramoLayout(cards, walkVh, shares);
  const x = unit(progress) * layout.height;
  let cursor = 0;
  let before = 0;
  for (let k = 0; k <= layout.count; k += 1) {
    const walk = layout.walks[k]!;
    const share = layout.shares[k]!;
    if (k === layout.count || x <= cursor + walk) {
      return before + share * walkEase(walk > 0 ? (x - cursor) / walk : 1);
    }
    cursor += walk;
    before += share;
    if (x <= cursor + TRAMO_STOP_VH) return before + STOP_DRIFT * smoothstep(0, 1, (x - cursor) / TRAMO_STOP_VH);
    cursor += TRAMO_STOP_VH;
    before += STOP_DRIFT;
  }
  return 1;
}

/**
 * Lo visible que está la tarjeta `index` (0–1): entra un poco antes de su
 * parada, se lee entera mientras la cámara está detenida y sale un poco
 * después. Nunca coinciden dos.
 */
export function tramoCardOpacity(
  progress: number,
  cards: number,
  index: number,
  walkVh = TRAMO_WALK_VH,
  shares?: readonly number[],
): number {
  const layout = tramoLayout(cards, walkVh, shares);
  if (index < 0 || index >= layout.count) return 0;

  const x = unit(progress) * layout.height;
  const start = layout.stopStart(index);
  const end = start + TRAMO_STOP_VH;
  return smoothstep(start - CARD_FADE_VH, start, x) * (1 - smoothstep(end, end + CARD_FADE_VH, x));
}

/** Cuánto antes de su parada empieza a bajar el rollo de un mapa, y cuánto antes termina, en vh. */
const UNROLL_FROM_VH = 60;
const UNROLL_TO_VH = 10;

/**
 * Cuánto está desenrollado el mapa de la tarjeta `index` (0–1, Fase 5B): baja
 * antes de que el texto aparezca, se queda abajo mientras se lee y vuelve a
 * subir al irse. Continua y monótona a cada lado de la parada: al desandar el
 * tramo, sube por el mismo camino.
 */
export function tramoUnroll(
  progress: number,
  cards: number,
  index: number,
  walkVh = TRAMO_WALK_VH,
  shares?: readonly number[],
): number {
  const layout = tramoLayout(cards, walkVh, shares);
  if (index < 0 || index >= layout.count) return 0;

  const x = unit(progress) * layout.height;
  const start = layout.stopStart(index);
  const end = start + TRAMO_STOP_VH;
  const down = smoothstep(start - UNROLL_FROM_VH, start - UNROLL_TO_VH, x);
  const up = 1 - smoothstep(end + UNROLL_TO_VH, end + UNROLL_FROM_VH, x);
  return Math.min(down, up);
}

/**
 * La d (absoluta) del punto de interés de la cámara en mitad de la parada
 * `index` del tramo que sale de `station`. Los kōsatsu y las ema se plantan
 * respecto de ella (`scene/decor/placement.ts`), y los rellanos de las gradas
 * caen en ella: si el tramo cambia de largo o de tarjetas, todo se mueve solo.
 */
export function cardStopD(station: StationSlug, index: number): number {
  return cardStopDepth(stationIndex(station), index);
}

/**
 * Lo visible que está el cartel de la siguiente estación (0–1). Sin tarjetas,
 * gana nitidez desde el 30 % del tramo; con tarjetas, sólo después de la
 * última: primero se lee lo de aquí, y luego se ve lo que viene.
 */
export function tramoSignOpacity(
  progress: number,
  cards: number,
  walkVh = TRAMO_WALK_VH,
  shares?: readonly number[],
): number {
  const layout = tramoLayout(cards, walkVh, shares);
  const p = unit(progress);
  if (layout.count === 0) return clamp((p - 0.3) * 2.2, 0, 1);

  const from = layout.stopStart(layout.count - 1) + TRAMO_STOP_VH + CARD_FADE_VH;
  return smoothstep(from, from + layout.walks[layout.count]! * 0.6, p * layout.height);
}

/* ── La llegada automática ─────────────────────────────────────────────── */

/** A partir de aquí el tramo se da por recorrido. */
const ARRIVE_AT = 0.995;
/** Por debajo de aquí el tramo queda armado: hubo recorrido de verdad. */
const ARM_BELOW = 0.9;

/** El estado de la llegada de una página: se crea uno por página montada. */
export interface ArrivalGate {
  armed: boolean;
  arrived: boolean;
}

export function createArrivalGate(): ArrivalGate {
  return { armed: false, arrived: false };
}

/**
 * ¿Esta actualización del tramo es la llegada? Sólo si se termina **hacia
 * abajo**, sólo **una vez**, y sólo si el tramo estaba **armado** —si se pasó
 * antes por debajo del 90 %—. Sin esto último, una página que aparece ya al
 * fondo (un scroll restaurado al volver con «atrás», un cambio de tamaño)
 * dispararía un cambio de página que nadie pidió.
 */
export function passTramo(gate: ArrivalGate, progress: number, direction: number): boolean {
  if (progress < ARM_BELOW) gate.armed = true;
  if (!gate.armed || gate.arrived || progress < ARRIVE_AT || direction !== 1) return false;
  gate.arrived = true;
  return true;
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
