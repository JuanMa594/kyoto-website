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
