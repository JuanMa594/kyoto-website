/**
 * Las galerías de toriis de Fushimi Inari (Fase 6A), como función pura.
 *
 * Una galería se declara por **trecho** del tramo (`DecorGallery`): el trecho
 * 0 va del principio de la subida a la primera parada, el último de la última
 * parada a la estación siguiente. Aquí se convierte en toriis:
 *
 *   · **Dónde empieza y acaba.** Cada parada deja libre
 *     `[parada − 16, parada + 3]`: desde la cámara de la parada (22 u por
 *     detrás), los pilares que caen entre ~9 y 20 u por delante de ella tapan
 *     la ema del costado (los más cercanos se salen del cuadro por el lado, y
 *     los de más allá de la ema quedan detrás de ella); y unas unidades de
 *     margen, porque la cámara llega a la parada desde atrás. La última
 *     galería acaba 5 u por delante de la cámara de la estación siguiente: al
 *     llegar, la cámara sale de ella y la plaza se abre (la revelación). Más
 *     cerca de la cámara que eso, un torii no se ve: sus pilares caen fuera
 *     del cuadro por los lados y su nuki por arriba.
 *   · **El ritmo.** `abierta`: toriis a `GALLERY_SPACING.abierta`, repartidos
 *     a partes iguales. `densa`: casi se tocan (`GALLERY_SPACING.densa`), y en
 *     sus primeros y últimos pasos la separación va abriéndose hacia la
 *     de las abiertas, para que la galería no empiece como un muro.
 *   · **La alzada.** La cámara va a 5,2 u sobre la ladera, pero cuesta arriba
 *     el tope de inclinación la sube hasta ~8 u (mira a un punto 22 u por
 *     delante y más alto). Cada torii se estira lo justo para que su *nuki*
 *     quede `CAMERA_CLEARANCE` por encima de la cámara que pasa por debajo; es
 *     una función suave de la profundidad, así que dos vecinos casi no se
 *     distinguen.
 *
 * Lo usan `ToriiGallery` (que los dibuja), las huellas, el musgo y las
 * comprobaciones: todos ven los mismos toriis.
 */

import { GALLERY_SPACING, JOURNEY, type DecorGallery, type GalleryVariant } from '@/config/journey';
import { lerp, mulberry32 } from '@/lib/procedural';
import { CAMERA_BACK, createRig, snapRig } from '@/scene/camera/pathRig';
import { INARI, INARI_NUKI_BOTTOM } from '@/scene/objects/torii/inari';
import { pathX, STATION_DEPTHS } from '@/scene/path/journeyPath';
import { tramoFlight } from '@/scene/path/stairs';
import { cardStopDepth } from '@/scene/path/tramoStops';
import { terrainY } from '@/scene/systems/elevation';

/** Lo que queda el *nuki* por encima de la cámara, como mínimo. */
export const CAMERA_CLEARANCE = 1.5;
/** Lo que deja libre cada parada antes y después de su punto de interés. */
export const GALLERY_FREE_BEFORE = 16;
export const GALLERY_FREE_AFTER = 3;
/** Desde la primera contrahuella hasta el primer torii. */
const GALLERY_START = 2;
/** Lo que pasa la última galería por delante de la cámara de la estación siguiente. */
export const GALLERY_REVEAL = 5;
/** En cuántos pasos se abre una galería densa en cada extremo. */
export const GALLERY_RAMP = 3;
/**
 * Entre estas velocidades de la cámara (u/s) se enciende el tramado de cerca
 * de los toriis (`ToriiGallery`): en un viaje rápido el encuadre recorta las
 * curvas y puede rozar un pilar durante un frame.
 */
export const TORII_FADE_SPEED: readonly [number, number] = [30, 60];

/** Margen de la alzada sobre lo justo. */
const LIFT_MARGIN = 0.15;

export interface GalleryTorii {
  /** Profundidad de su eje. */
  readonly d: number;
  readonly x: number;
  /** El suelo al pie de sus pilares. */
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  /** Lo que se estiran sus pilares (`inariLift`). */
  readonly lift: number;
  /** 0–1: del bermellón recién pintado al más apagado. */
  readonly tone: number;
}

export interface PlacedGallery {
  readonly item: DecorGallery;
  readonly from: number;
  readonly to: number;
  readonly toriis: readonly GalleryTorii[];
}

/** Las paradas de un tramo, en orden. */
function stops(i: number): number[] {
  return (JOURNEY[i]?.tramo.cards ?? []).map((_, k) => cardStopDepth(i, k));
}

/** De dónde a dónde va la galería del trecho `trecho` del tramo que sale de `i`. `null` si no cabe. */
export function gallerySpan(i: number, trecho: number): { from: number; to: number } | null {
  const next = STATION_DEPTHS[i + 1];
  if (next === undefined) return null;
  const list = stops(i);
  const flight = tramoFlight(i);
  const climb = flight?.steps[0]?.d ?? STATION_DEPTHS[i]! + (JOURNEY[i]!.tramo.flat ?? 0);
  const from = trecho === 0 ? climb + GALLERY_START : list[trecho - 1]! + GALLERY_FREE_AFTER;
  const to = trecho >= list.length ? next - CAMERA_BACK + GALLERY_REVEAL : list[trecho]! - GALLERY_FREE_BEFORE;
  if (trecho < 0 || trecho > list.length || to - from < 2) return null;
  return { from, to };
}

/**
 * Las profundidades de los toriis de una galería entre `from` y `to`. Con
 * `openEnd` falso, la densa no se abre al final (la que llega a la estación).
 */
export function galleryDepths(variant: GalleryVariant, from: number, to: number, openEnd = true): number[] {
  const length = to - from;
  const open = GALLERY_SPACING.abierta;
  const dense = GALLERY_SPACING[variant];
  if (variant === 'abierta' || length < 4 * open) {
    // Nunca más juntos que su separación: con lo que sobre, un poco más abiertos.
    const count = Math.max(1, Math.floor(length / (variant === 'abierta' ? open : dense)));
    return Array.from({ length: count + 1 }, (_, k) => from + (length * k) / count);
  }
  // La densa se abre en sus extremos: de la separación de las abiertas a la suya.
  const ramp = Array.from({ length: GALLERY_RAMP - 1 }, (_, k) => lerp(open, dense, (k + 1) / GALLERY_RAMP));
  const rampLength = ramp.reduce((sum, step) => sum + step, 0);
  const inner = length - (openEnd ? 2 : 1) * rampLength;
  const innerCount = Math.max(1, Math.floor(inner / dense));
  const innerStep = inner / innerCount;
  const gaps = [...ramp, ...Array.from({ length: innerCount }, () => innerStep), ...(openEnd ? [...ramp].reverse() : [])];
  const depths = [from];
  for (const gap of gaps) depths.push(depths[depths.length - 1]! + gap);
  return depths;
}

const rig = createRig();

/** Lo que le falta al nuki de un torii en `d` para quedar sobre la cámara que pasa por debajo. */
function neededLift(d: number): number {
  const base = terrainY(pathX(d) + INARI.span / 2, -d);
  let highest = Number.NEGATIVE_INFINITY;
  // La cámara está 22 u por detrás de su punto de interés (algo menos si
  // gira): se mira en una ventana de puntos de interés y se toma lo peor.
  for (let focus = d + CAMERA_BACK - 2.5; focus <= d + CAMERA_BACK + 2.5; focus += 0.5) {
    snapRig(rig, focus);
    highest = Math.max(highest, rig.camera.y);
  }
  return Math.max(0, highest + CAMERA_CLEARANCE + LIFT_MARGIN - (base + INARI_NUKI_BOTTOM));
}

/** Lo más que cambia la alzada por unidad de camino: dos vecinos casi no se distinguen. */
export const LIFT_SLOPE = 0.12;
/** Hasta dónde mira la envolvente a cada lado. */
const LIFT_REACH = 32;

/**
 * La alzada de un torii en `d`: lo que necesita (`neededLift`) y lo que
 * necesitan sus vecinos, rebajado con la distancia —una envolvente de pendiente
 * `LIFT_SLOPE`—. Nunca menos de lo que necesita; nunca un escalón entre dos
 * toriis seguidos, ni siquiera junto a un rellano, donde la cámara cambia de
 * altura deprisa.
 */
export function toriiLift(d: number): number {
  let lift = 0;
  for (let other = d - LIFT_REACH; other <= d + LIFT_REACH; other += 0.5) {
    lift = Math.max(lift, neededLift(other) - LIFT_SLOPE * Math.abs(other - d));
  }
  return lift;
}

/** El rumbo del eje en `d` (el del camino, sin acotar). */
function tangentYaw(d: number): number {
  return -Math.atan(pathX(d + 0.5) - pathX(d - 0.5));
}

const PLACED = new Map<string, PlacedGallery | null>();

/**
 * Una galería declarada, ya en el mundo: sus toriis. Se calcula una vez por
 * galería: la alzada mira la cámara en muchos puntos, y la colocación la piden
 * la escena, las huellas, el musgo y las sombras.
 */
export function placeGallery(i: number, item: DecorGallery): PlacedGallery | null {
  const key = `${i}:${item.trecho}:${item.variant}:${GALLERY_SPACING[item.variant]}`;
  if (!PLACED.has(key)) PLACED.set(key, buildGallery(i, item));
  return PLACED.get(key)!;
}

function buildGallery(i: number, item: DecorGallery): PlacedGallery | null {
  const span = gallerySpan(i, item.trecho);
  if (!span) return null;
  const random = mulberry32(8801 + i * 97 + item.trecho * 13);
  const last = item.trecho >= (JOURNEY[i]?.tramo.cards.length ?? 0);
  const toriis = galleryDepths(item.variant, span.from, span.to, !last).map((d): GalleryTorii => {
    const x = pathX(d);
    const z = -d;
    return {
      d,
      x,
      y: terrainY(x + INARI.span / 2, z),
      z,
      yaw: tangentYaw(d),
      lift: toriiLift(d),
      tone: random(),
    };
  });
  return { item, from: span.from, to: span.to, toriis };
}

/** Los dos pilares de un torii de galería, en el mundo (x, z). */
export function galleryPillars(t: GalleryTorii): [{ x: number; z: number }, { x: number; z: number }] {
  const cos = Math.cos(t.yaw);
  const sin = Math.sin(t.yaw);
  const half = INARI.span / 2;
  return [
    { x: t.x - half * cos, z: t.z + half * sin },
    { x: t.x + half * cos, z: t.z - half * sin },
  ];
}
