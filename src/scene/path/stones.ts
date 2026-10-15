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
 */

import { PATH_LENGTH } from '@/config/journey';
import { mulberry32 } from '@/lib/procedural';
import { groundY } from '@/scene/systems/elevation';

import { pathX } from './journeyPath';

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

export interface StoneInstance {
  readonly variant: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
  readonly rotation: number;
}

/** Seed de cada una de las doce formas. */
export function stoneSeed(variant: number): number {
  return 100 + variant * 37;
}

export function stoneLayout(): StoneInstance[] {
  // Semilla fija: el camino es el mismo en cada carga.
  const random = mulberry32(1204);
  const stones: StoneInstance[] = [];

  for (let d = STONE_FROM; d <= STONE_TO; d += STONE_SPACING) {
    // Un poco de desorden: un camino real no está alineado a hilo.
    const along = d + (random() - 0.5) * 0.35;
    const meander = STONE_MEANDER * Math.sin((2 * Math.PI * (along + 10.4)) / STONE_WAVE + Math.PI / 2);
    const x = pathX(along) + meander + (random() - 0.5) * 0.55;
    const z = -along;
    const scale = STONE_SCALE * (0.88 + random() * 0.24);

    stones.push({
      variant: Math.floor(random() * STONE_VARIANTS),
      x,
      y: groundY(x, z) - STONE_SINK * scale,
      z,
      scale,
      rotation: random() * Math.PI * 2,
    });
  }

  return stones;
}
