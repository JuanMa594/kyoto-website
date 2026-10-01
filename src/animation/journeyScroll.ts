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
import { clamp, smoothstep } from '@/lib/procedural';
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

/**
 * Lo que avanza la cámara mientras se lee una tarjeta, en fracción del tramo.
 * Casi nada, pero algo: con la cámara clavada el scroll se sentiría muerto.
 */
const STOP_DRIFT = 0.008;

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

function tramoLayout(cards: number, walkVh: number) {
  const count = Math.max(0, Math.floor(cards));
  return {
    count,
    /** vh de cada trecho de caminar: el caminar se reparte entre tarjetas. */
    walk: walkVh / (count + 1),
    height: tramoHeightVh(count, walkVh),
    /** Fracción del tramo que avanza cada trecho. */
    distance: (1 - count * STOP_DRIFT) / (count + 1),
  };
}

/**
 * Cuánto del tramo lleva recorrido la cámara (0–1) para un progreso de scroll
 * (0–1). El caminar se parte en `cards + 1` trechos iguales y, entre ellos, una
 * parada por tarjeta en la que la cámara casi se detiene. Sin tarjetas es la
 * curva del caminar de punta a punta.
 */
export function tramoFraction(progress: number, cards: number, walkVh = TRAMO_WALK_VH): number {
  const { count, walk, height, distance } = tramoLayout(cards, walkVh);
  const x = unit(progress) * height;
  const period = walk + TRAMO_STOP_VH;
  const k = Math.min(count, Math.floor(x / period));
  const into = x - k * period;
  const before = k * (distance + STOP_DRIFT);

  if (k === count || into <= walk) return before + distance * walkEase(into / walk);
  return before + distance + STOP_DRIFT * smoothstep(0, 1, (into - walk) / TRAMO_STOP_VH);
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
): number {
  const { count, walk, height } = tramoLayout(cards, walkVh);
  if (index < 0 || index >= count) return 0;

  const x = unit(progress) * height;
  const start = (index + 1) * walk + index * TRAMO_STOP_VH;
  const end = start + TRAMO_STOP_VH;
  return smoothstep(start - CARD_FADE_VH, start, x) * (1 - smoothstep(end, end + CARD_FADE_VH, x));
}

/**
 * Lo visible que está el cartel de la siguiente estación (0–1). Sin tarjetas,
 * gana nitidez desde el 30 % del tramo; con tarjetas, sólo después de la
 * última: primero se lee lo de aquí, y luego se ve lo que viene.
 */
export function tramoSignOpacity(progress: number, cards: number, walkVh = TRAMO_WALK_VH): number {
  const { count, walk, height } = tramoLayout(cards, walkVh);
  const p = unit(progress);
  if (count === 0) return clamp((p - 0.3) * 2.2, 0, 1);

  const from = count * (walk + TRAMO_STOP_VH) + CARD_FADE_VH;
  return smoothstep(from, from + walk * 0.6, p * height);
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
