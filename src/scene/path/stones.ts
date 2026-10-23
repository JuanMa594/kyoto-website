/**
 * Dónde va cada piedra del camino, como función pura.
 *
 * El camino entero, de antes de la Home a después de Gastronomía, con una
 * piedra cada ~1,45 unidades. Doce formas procedurales repartidas al azar
 * (`stoneSeed`), cada una con su giro y su escala.
 *
 * Dos decisiones:
 *
 *   · **La S de `3.png`.** La hilera serpentea ±3 unidades alrededor del eje,
 *     con una onda de ~34, siempre dentro del pasillo. La cámara sigue el eje,
 *     no la S: una cámara que zigzagueara con cada piedra marearía.
 *   · **Tamaño de mundo real.** En la Fase 1 las piedras lejanas eran más
 *     pequeñas a propósito (0,86 → 0,52), un truco que sólo funciona con la
 *     cámara quieta: con la cámara avanzando crecerían al acercarse. Ahora todas
 *     miden ~0,7 con un ±12 % de variación.
 *
 * **En las gradas** (Fase 6A, `stairs.ts`) la piedra hace de peldaño: una por
 * huella, en su centro, por el eje y con su lado largo de través; en una huella
 * larga (un rellano) cada ~1,45 u. Nunca sobre el canto de una contrahuella: si
 * la huella es corta, la piedra es más pequeña.
 */

import { JOURNEY, PATH_LENGTH } from '@/config/journey';
import { mulberry32, smoothstep } from '@/lib/procedural';
import { ROMON_FOOTPRINT } from '@/scene/objects/romon/romon';
import { stoneGeometry } from '@/scene/objects/stoneGeometry';
import { groundY } from '@/scene/systems/elevation';

import { pathX, STATION_DEPTHS } from './journeyPath';
import { allFlights, stairWeight } from './stairs';

export const STONE_VARIANTS = 12;
/** Cuánto se entierra cada piedra, en fracción de su escala: pisaderas, no peñascos. */
export const STONE_SINK = 0.12;
/** Amplitud de la S alrededor del eje. */
export const STONE_MEANDER = 3;

const STONE_SPACING = 1.45;
const STONE_WAVE = 34;
const STONE_SCALE = 0.7;
/** Desde bajo la cámara de la Home hasta pasado el final del camino. */
const STONE_FROM = -30;
const STONE_TO = PATH_LENGTH + 20;
/** Lo que deja libre una piedra de las gradas hasta cada contrahuella, en unidades. */
export const STAIR_STONE_MARGIN = 0.22;

export interface StoneInstance {
  readonly variant: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
  readonly rotation: number;
  /** Cuánto se aplana en alto (1 si nada): las losas de una explanada, ~0,35. */
  readonly flatten?: number;
}

/** Seed de cada una de las doce formas. */
export function stoneSeed(variant: number): number {
  return 100 + variant * 37;
}

/** Medio largo de cada forma a lo largo de su x y de su z locales, a escala 1. */
let extents: { x: number; z: number }[] | null = null;
export function stoneExtents(variant: number): { x: number; z: number } {
  extents ??= Array.from({ length: STONE_VARIANTS }, (_, v) => {
    const geometry = stoneGeometry(stoneSeed(v), 1);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    geometry.dispose();
    return { x: Math.max(-box.min.x, box.max.x), z: Math.max(-box.min.z, box.max.z) };
  });
  return extents[variant]!;
}

/** Las explanadas del camino, en d absolutas. */
export function plazas(): { from: number; to: number; half: number }[] {
  return JOURNEY.flatMap((station, i) => {
    const plaza = station.environment.plaza;
    const d = STATION_DEPTHS[i]!;
    return plaza ? [{ from: d + plaza.from, to: d + plaza.to, half: plaza.half }] : [];
  });
}

/**
 * Lo que la explanada deja libre: la planta del rōmon con su escalinata y sus
 * pedestales (en horizontal y en vertical), más un margen. Las losas llegan
 * hasta su escalinata, no se meten debajo.
 */
function landmarkRects(): { x: number; z: number; yaw: number; hx: number; hz: number }[] {
  const rects: { x: number; z: number; yaw: number; hx: number; hz: number }[] = [];
  JOURNEY.forEach((station, i) => {
    for (const item of station.environment.decor) {
      if (item.kind !== 'romon') continue;
      for (const at of [item.at, item.portrait]) {
        if (!at) continue;
        const d = STATION_DEPTHS[i]! + at.d;
        const scale = (at.scale ?? 1) * (item.scale ?? 1);
        const yaw = -Math.atan(pathX(d + 0.5) - pathX(d - 0.5)) + (item.yaw ?? 0);
        const cz = ROMON_FOOTPRINT.cz * scale;
        rects.push({
          x: pathX(d) + at.u + Math.sin(yaw) * cz,
          z: -d + Math.cos(yaw) * cz,
          yaw,
          hx: ROMON_FOOTPRINT.hx * scale + 1.2,
          hz: ROMON_FOOTPRINT.hz * scale + 1.2,
        });
      }
    }
  });
  return rects;
}

function insideRect(r: { x: number; z: number; yaw: number; hx: number; hz: number }, x: number, z: number): boolean {
  const dx = x - r.x;
  const dz = z - r.z;
  const cos = Math.cos(r.yaw);
  const sin = Math.sin(r.yaw);
  return Math.abs(dx * cos - dz * sin) < r.hx && Math.abs(dx * sin + dz * cos) < r.hz;
}

/** Cuánto se aplanan las losas, y su separación (a lo largo y de través). */
const SLAB_FLATTEN = 0.34;
const SLAB_STEP = 2.05;

export function stoneLayout(): StoneInstance[] {
  // Semilla fija: el camino es el mismo en cada carga.
  const random = mulberry32(1204);
  const stones: StoneInstance[] = [];
  const flights = allFlights().filter((f) => f.steps.length > 0);
  const squares = plazas();
  // En una explanada, las losas (abajo).
  const onPlaza = (d: number) => squares.some((p) => d >= p.from - 0.6 && d <= p.to + 0.6);
  // Las piedras de las gradas van de la primera contrahuella al final del tramo.
  const onStairs = (d: number) => flights.some((f) => d >= f.steps[0]!.d - 0.5 && d <= f.to + 0.5);

  for (let d = STONE_FROM; d <= STONE_TO; d += STONE_SPACING) {
    // Un poco de desorden: un camino real no está alineado a hilo.
    const along = d + (random() - 0.5) * 0.35;
    // La S se recoge al llegar a las gradas, que suben por el eje, y vuelve después.
    const meander =
      STONE_MEANDER *
      (1 - stairWeight(along, 14)) *
      Math.sin((2 * Math.PI * (along + 10.4)) / STONE_WAVE + Math.PI / 2);
    const x = pathX(along) + meander + (random() - 0.5) * 0.55;
    const z = -along;
    const scale = STONE_SCALE * (0.88 + random() * 0.24);
    const variant = Math.floor(random() * STONE_VARIANTS);
    const rotation = random() * Math.PI * 2;
    // En las gradas, las piedras las pone la escalera; en una explanada, sus losas (abajo).
    if (onStairs(along) || onPlaza(along)) continue;

    stones.push({ variant, x, y: groundY(x, z) - STONE_SINK * scale, z, scale, rotation });
  }

  for (const flight of flights) {
    stones.push(...stairStones(flight, mulberry32(4711 + Math.round(flight.from))).filter((s) => !onPlaza(-s.z)));
  }
  for (const plaza of squares) stones.push(...plazaSlabs(plaza, mulberry32(5813 + Math.round(plaza.from))));
  stones.sort((a, b) => b.z - a.z);
  return stones;
}

/** Las piedras de unas gradas: una por huella, o cada ~1,45 u en las largas. */
function stairStones(flight: ReturnType<typeof allFlights>[number], random: () => number): StoneInstance[] {
  const stones: StoneInstance[] = [];
  const edges = [...flight.steps.map((s) => s.d), flight.to];
  for (let k = 0; k + 1 < edges.length; k += 1) {
    const start = edges[k]!;
    const end = edges[k + 1]!;
    const length = end - start;
    const count = Math.max(1, Math.round(length / STONE_SPACING));
    const slot = length / count;
    for (let n = 0; n < count; n += 1) {
      const variant = Math.floor(random() * STONE_VARIANTS);
      const extent = stoneExtents(variant);
      // El lado largo de través: así la piedra cabe en la huella.
      const across = extent.x >= extent.z;
      const alongHalf = across ? extent.z : extent.x;
      const wanted = STONE_SCALE * (0.88 + random() * 0.24);
      const scale = Math.min(wanted, Math.max(0.3, (slot / 2 - STAIR_STONE_MARGIN) / alongHalf));
      const d = start + slot * (n + 0.5) + (random() - 0.5) * Math.max(0, slot - 2 * (alongHalf * scale + STAIR_STONE_MARGIN)) * 0.8;
      const x = pathX(d) + (random() - 0.5) * 0.6;
      const z = -d;
      // Con el rumbo del camino y un poco de juego: la x local de través.
      const yaw = -Math.atan(pathX(d + 0.5) - pathX(d - 0.5));
      const rotation = yaw + (across ? 0 : Math.PI / 2) + (random() - 0.5) * 0.3;
      stones.push({ variant, x, y: groundY(x, z) - STONE_SINK * scale, z, scale, rotation });
    }
  }
  return stones;
}

/**
 * Las losas de una explanada (Fase 6A): una rejilla suelta de piedras grandes y
 * planas, cada una desplazada y girada un poco, que se aclara hacia el borde
 * —cerca del eje casi no hay huecos; a `half`, casi todo es suelo—. Son las
 * mismas doce formas del camino, más grandes y aplanadas.
 */
function plazaSlabs(plaza: { from: number; to: number; half: number }, random: () => number): StoneInstance[] {
  const slabs: StoneInstance[] = [];
  const free = landmarkRects();
  for (let d = plaza.from + SLAB_STEP / 2; d <= plaza.to; d += SLAB_STEP) {
    // Las filas, al tresbolillo.
    const shift = (Math.round((d - plaza.from) / SLAB_STEP) % 2) * SLAB_STEP * 0.5;
    for (let u = -plaza.half + shift; u <= plaza.half; u += SLAB_STEP) {
      const keep = 1 - smoothstep(plaza.half * 0.4, plaza.half, Math.abs(u));
      const variant = Math.floor(random() * STONE_VARIANTS);
      const scale = 0.78 + random() * 0.14;
      const along = d + (random() - 0.5) * 0.4;
      const across = u + (random() - 0.5) * 0.4;
      const rotation = (random() - 0.5) * 0.5 + (random() < 0.5 ? 0 : Math.PI / 2);
      if (random() > keep * 0.95 + 0.05) continue;
      const x = pathX(along) + across;
      const z = -along;
      if (free.some((r) => insideRect(r, x, z))) continue;
      slabs.push({ variant, x, y: groundY(x, z) - STONE_SINK * scale * SLAB_FLATTEN, z, scale, rotation, flatten: SLAB_FLATTEN });
    }
  }
  return slabs;
}
