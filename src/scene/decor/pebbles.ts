/**
 * Las piedras de río al pie de lo plantado (5B, pulido). Módulo puro.
 *
 * Como el musgo, no se declaran una a una: crecen donde crecerían, en grupos
 * asimétricos alrededor de la base de cada farol y de cada poste de los
 * kōsatsu (`objectBases`). Cada grupo es una piedra mayor y unas pocas chicas
 * a un costado, sobre todo hacia fuera del camino; nunca un anillo. Cuántas,
 * lo dice `environment.pebbles` en `journey.ts`; la semilla es fija, así que
 * cada carga es el mismo jardín.
 *
 * Los corros declarados en `journey.ts` (`kind: 'corro'`) llevan además su
 * propio grupo, en terreno abierto, sin base que rodear.
 *
 * Nunca pisan las piedras del camino ni se meten en otra base, y cuentan como
 * obstáculo para la fauna (`decorFootprints`): son piedras, no hierba.
 */

import { JOURNEY } from '@/config/journey';
import { lerp, mulberry32 } from '@/lib/procedural';
import { pathX } from '@/scene/path/journeyPath';
import { stoneLayout, type StoneInstance } from '@/scene/path/stones';
import { groundY } from '@/scene/systems/elevation';

import { objectBases, type ObjectBase } from './footprints';
import { stationDecorLayout } from './placement';

export interface Pebble {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Radio en planta y alto, en unidades. */
  readonly radius: number;
  readonly height: number;
  readonly yaw: number;
  /** 0–1: de la piedra clara a la de río, mojada y oscura. */
  readonly tone: number;
  /** La mayor del grupo: lleva sombra de contacto propia. */
  readonly anchor: boolean;
}

/** Cuántas piedras por grupo (de–a) según qué hay plantado, con `pebbles` 1. */
const PER_GROUP = { farol: [3, 5], kosatsu: [2, 4] } as const;

/** Lo que se aparta de una piedra del camino: su radio (0,45) y un respiro. */
const PATH_STONE_CLEAR = 0.55;
/** Cuánto se hunde cada piedra en la tierra, como fracción de su alto. */
const SINK = 0.25;

let pathStones: readonly StoneInstance[] | null = null;

/** Las piedras de río de la estación `index` y su tramo, para un aspecto. */
export function stationPebbles(index: number, portrait: boolean): Pebble[] {
  const station = JOURNEY[index];
  const amount = station?.environment.pebbles ?? 0;
  if (!station || amount <= 0) return [];
  pathStones ??= stoneLayout();

  const layout = stationDecorLayout(index, portrait);
  const allBases = layout.objects.flatMap((o) => objectBases(o));
  const random = mulberry32(7300 + index * 151 + (portrait ? 11 : 0));
  const pebbles: Pebble[] = [];

  const fits = (x: number, z: number, radius: number, own: ObjectBase) => {
    for (const stone of pathStones!) {
      if (Math.abs(stone.z - z) > 2) continue;
      if (Math.hypot(stone.x - x, stone.z - z) - radius < PATH_STONE_CLEAR) return false;
    }
    for (const base of allBases) {
      // La propia, por su pie (bajo el sombrerete de un farol caben piedras);
      // se compara por sitio: objectBases crea objetos nuevos en cada llamada.
      const reach = base.x === own.x && base.z === own.z ? base.foot : base.r;
      if (Math.hypot(base.x - x, base.z - z) < reach + radius * 0.9) return false;
    }
    return pebbles.every((p) => Math.hypot(p.x - x, p.z - z) >= (p.radius + radius) * 0.85);
  };

  // Un corro: un grupo suelto alrededor de su punto, la mayor cerca del centro.
  const loose: ObjectBase = { kind: 'circulo', x: 0, z: 0, r: 0, foot: 0, top: 0, faunaMargin: 0 };
  for (const o of layout.objects) {
    if (o.item.kind !== 'corro') continue;
    const wanted = Math.round(o.item.pebbles * amount);
    const heading = random() * Math.PI * 2;
    let placed = 0;
    for (let attempt = 0; placed < wanted && attempt < wanted * 14; attempt += 1) {
      const anchor = placed === 0;
      // La escala del corro lo extiende (y agranda su musgo), no sus piedras.
      const radius = anchor ? lerp(0.18, 0.28, random()) : lerp(0.07, 0.15, random());
      const angle = heading + (random() - 0.5) * (anchor ? 1 : 2.6);
      const reach = (anchor ? random() * 0.15 : 0.25 + random() * 0.45) * o.scale;
      const x = o.x + Math.cos(angle) * reach;
      const z = o.z + Math.sin(angle) * reach;
      if (!fits(x, z, radius, loose)) continue;
      const height = radius * lerp(0.55, 0.85, random());
      pebbles.push({ x, y: groundY(x, z) - height * SINK, z, radius, height, yaw: random() * Math.PI * 2, tone: random(), anchor });
      placed += 1;
    }
  }

  for (const o of layout.objects) {
    const kind = o.item.kind;
    if (kind !== 'farol' && kind !== 'kosatsu') continue;
    const [least, most] = PER_GROUP[kind];
    for (const base of objectBases(o)) {
      const wanted = Math.round(lerp(least, most, random()) * amount);
      if (wanted <= 0) continue;
      // Hacia fuera del camino, con holgura: un grupo a un costado, no un anillo.
      const outward = base.x - pathX(-base.z) >= 0 ? 0 : Math.PI;
      const heading = outward + (random() - 0.5) * 2.2;
      let placed = 0;
      for (let attempt = 0; placed < wanted && attempt < wanted * 14; attempt += 1) {
        const anchor = placed === 0;
        const radius = anchor ? lerp(0.2, 0.3, random()) : lerp(0.07, 0.16, random());
        const angle = heading + (anchor ? (random() - 0.5) * 0.5 : (random() - 0.5) * 2.4);
        const reach = base.foot + radius * (anchor ? 0.85 : 1) + random() * (anchor ? 0.08 : 0.3);
        const x = base.x + Math.cos(angle) * reach;
        const z = base.z + Math.sin(angle) * reach;
        if (!fits(x, z, radius, base)) continue;
        const height = radius * lerp(0.55, 0.85, random());
        pebbles.push({
          x,
          y: groundY(x, z) - height * SINK,
          z,
          radius,
          height,
          yaw: random() * Math.PI * 2,
          tone: random(),
          anchor,
        });
        placed += 1;
      }
    }
  }
  return pebbles;
}
