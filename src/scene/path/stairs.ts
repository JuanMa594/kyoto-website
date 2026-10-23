/**
 * Las gradas de la subida a Fushimi Inari (Fase 6A), como función pura.
 *
 * Un tramo que declara `tramo.stairs` se sube por gradas: huellas llanas de
 * piedra y tierra con su contrahuella de `riser` u. No se cuantiza la malla
 * del terreno —su rejilla es de 2 u, y un escalón de 0,35 se dibujaría como
 * una rampa—: las gradas son una malla aparte (`systems/Stairs.tsx`) **encima
 * del terreno liso**. Cada huella está a `riser · ceil(pathY / riser)`, así que
 * nunca queda por debajo de la ladera: por delante asoma su contrahuella
 * entera y por detrás se funde con la cuesta, como unas gradas talladas en el
 * monte. A lo ancho, pasado el pasillo (`STAIR_HALF`), la huella baja hasta la
 * ladera en un bisel: no hay paredes laterales.
 *
 * Los rellanos no son cosa de aquí: los pone `pathY` (una meseta en cada
 * parada con cartel), y una meseta cuantizada es una huella larga.
 *
 * Tres alturas, para tres usuarios:
 *   · `stairTop`: la cara de arriba, tal cual. La pisan las piedras y la
 *     decoración (`groundY`).
 *   · `stairWalk`: la de la fauna, con cada contrahuella convertida en una
 *     rampa corta por delante. Subir un escalón de golpe sería saltar 0,35 u
 *     en un frame (la trampa de las piedras del camino); con la rampa, el
 *     animal sube el peldaño en un palmo y se inclina al hacerlo.
 *   · Ninguna para la cámara: sigue el terreno liso (`terrainY`), que es lo
 *     que hace que suba sin saltos.
 *
 * Alturas relativas a `GROUND_Y`, como `terrainHeight`. No importa
 * `elevation.ts` (que las importa a ellas).
 */

import { JOURNEY } from '@/config/journey';
import { smoothstep } from '@/lib/procedural';

import { pathX, pathY, STATION_DEPTHS } from './journeyPath';

/** Semiancho de la huella llana, desde el eje. Las piedras van por el centro. */
export const STAIR_HALF = 3.1;
/** Lo que tarda la huella en bajar hasta la ladera, a cada lado. */
export const STAIR_BEVEL = 0.7;
/** Lo que se hunde el borde del bisel bajo la ladera: sin esto, una rendija. */
const BEVEL_SINK = 0.05;
/** El largo de la rampa de la fauna delante de cada contrahuella. */
export const STAIR_WALK_RAMP = 0.3;

/** Una grada: dónde empieza (su contrahuella) y a qué altura está su huella. */
export interface Step {
  /** Profundidad de la contrahuella que la sube. */
  readonly d: number;
  /** Altura de la huella, relativa a `GROUND_Y`. */
  readonly y: number;
}

/** Las gradas de un tramo: de dónde a dónde y la lista de huellas. */
export interface Flight {
  readonly from: number;
  readonly to: number;
  readonly riser: number;
  /** La altura de lo que hay antes de la primera contrahuella. */
  readonly base: number;
  readonly steps: readonly Step[];
}

/** La huella en la que cae una altura de la ladera. */
function quantize(y: number, riser: number): number {
  return riser * Math.ceil(y / riser - 1e-9);
}

function buildFlight(i: number): Flight | null {
  const station = JOURNEY[i];
  const next = STATION_DEPTHS[i + 1];
  const riser = station?.tramo.stairs?.riser;
  if (!station || next === undefined || !riser) return null;
  const from = STATION_DEPTHS[i]! + (station.tramo.flat ?? 0);
  const to = next;
  const base = pathY(from);
  const steps: Step[] = [];
  // Se busca cada contrahuella donde la huella cuantizada cambia, y se afina
  // con bisección: el borde queda donde la ladera cruza la altura de la huella
  // anterior.
  const COARSE = 0.05;
  let level = quantize(base, riser);
  for (let d = from + COARSE; d <= to + 1e-9; d += COARSE) {
    const here = quantize(pathY(Math.min(d, to)), riser);
    if (here <= level + 1e-9) continue;
    let lo = d - COARSE;
    let hi = Math.min(d, to);
    for (let k = 0; k < 40; k += 1) {
      const mid = (lo + hi) / 2;
      if (quantize(pathY(mid), riser) > level + 1e-9) hi = mid;
      else lo = mid;
    }
    // Una sola contrahuella por cruce, aunque en un tramo empinado la ladera
    // suba más de una huella en un paso grueso (no pasa con 0,05 u, pero así
    // la cuenta es la de las huellas, no la de los pasos).
    level += riser;
    steps.push({ d: hi, y: level });
    d = hi;
  }
  return { from, to, riser, base, steps };
}

const FLIGHTS: (Flight | null)[] = JOURNEY.map(() => null);
const BUILT: boolean[] = JOURNEY.map(() => false);

/** Las gradas del tramo que sale de la estación `i`, o `null` si sube en rampa. */
export function tramoFlight(i: number): Flight | null {
  if (!BUILT[i]) {
    FLIGHTS[i] = buildFlight(i);
    BUILT[i] = true;
  }
  return FLIGHTS[i] ?? null;
}

let flights: Flight[] | null = null;

/** Todas las gradas del camino. */
export function allFlights(): Flight[] {
  flights ??= JOURNEY.flatMap((_, i) => {
    const flight = tramoFlight(i);
    return flight ? [flight] : [];
  });
  return flights;
}

/**
 * Las gradas en cuyo tramo cae `d`. Se consulta en cada muestra de la fauna y
 * en cada vértice del terreno: casi siempre la respuesta es «ninguna», y sale
 * en una comparación.
 */
function flightAt(d: number): Flight | null {
  for (const flight of allFlights()) {
    if (d >= flight.from && d <= flight.to) return flight;
  }
  return null;
}

/** El índice de la última contrahuella antes de `d` (−1 si ninguna). */
function stepIndex(flight: Flight, d: number): number {
  let lo = 0;
  let hi = flight.steps.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (flight.steps[mid]!.d <= d) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** La altura de la huella llana en `d`, sin el bisel. `null` fuera de las gradas. */
export function treadHeight(d: number): number | null {
  const flight = flightAt(d);
  if (!flight) return null;
  const k = stepIndex(flight, d);
  return k < 0 ? flight.base : flight.steps[k]!.y;
}

/** Cuánto de la huella hay a `|u|` del eje: 1 en el pasillo, 0 pasado el bisel. */
export function stairCover(u: number): number {
  return 1 - smoothstep(STAIR_HALF, STAIR_HALF + STAIR_BEVEL, Math.abs(u));
}

/** La altura con el bisel: la huella en el pasillo, la ladera un poco por debajo pasado el bisel. */
function beveled(tread: number, d: number, u: number): number {
  const cover = stairCover(u);
  const slope = pathY(d) - BEVEL_SINK;
  return slope + (tread - slope) * cover;
}

/**
 * La cara de arriba de las gradas en (x, z) del mundo, relativa a `GROUND_Y`,
 * o −∞ si ahí no hay gradas.
 */
export function stairTop(x: number, z: number): number {
  const d = -z;
  const tread = treadHeight(d);
  if (tread === null) return Number.NEGATIVE_INFINITY;
  const u = x - pathX(d);
  if (Math.abs(u) >= STAIR_HALF + STAIR_BEVEL) return Number.NEGATIVE_INFINITY;
  return beveled(tread, d, u);
}

/**
 * Lo que pisa la fauna: la cara de arriba con una rampa corta por delante de
 * cada contrahuella. Nunca queda por debajo de la grada (la rampa sube sobre
 * la huella de abajo, no corta la de arriba).
 */
export function stairWalk(x: number, z: number): number {
  const d = -z;
  const flight = flightAt(d);
  if (!flight) return Number.NEGATIVE_INFINITY;
  const u = x - pathX(d);
  if (Math.abs(u) >= STAIR_HALF + STAIR_BEVEL) return Number.NEGATIVE_INFINITY;
  const k = stepIndex(flight, d);
  let tread = k < 0 ? flight.base : flight.steps[k]!.y;
  const upcoming = flight.steps[k + 1];
  if (upcoming && upcoming.d - d < STAIR_WALK_RAMP) {
    tread += (upcoming.y - tread) * smoothstep(upcoming.d - STAIR_WALK_RAMP, upcoming.d, d);
  }
  return beveled(tread, d, u);
}

/**
 * Lo que hay de (x, z) a la contrahuella más cercana, en profundidad, si el
 * punto está sobre las gradas; +∞ si no. Lo que se tiende plano (el musgo) no
 * puede quedar a caballo de un escalón: flotaría sobre el canto.
 */
export function riserGap(x: number, z: number): number {
  const d = -z;
  const flight = flightAt(d);
  if (!flight || Math.abs(x - pathX(d)) >= STAIR_HALF + STAIR_BEVEL) return Number.POSITIVE_INFINITY;
  const k = stepIndex(flight, d);
  const before = k >= 0 ? d - flight.steps[k]!.d : Number.POSITIVE_INFINITY;
  const after = flight.steps[k + 1] ? flight.steps[k + 1]!.d - d : Number.POSITIVE_INFINITY;
  return Math.min(before, after);
}

/** Si `d` cae en un tramo con gradas: lo usan las piedras para dejar de serpentear. */
export function stairWeight(d: number, fade = 6): number {
  let weight = 0;
  for (const flight of allFlights()) {
    weight = Math.max(weight, smoothstep(flight.from - fade, flight.from, d) * (1 - smoothstep(flight.to, flight.to + fade, d)));
  }
  return weight;
}
