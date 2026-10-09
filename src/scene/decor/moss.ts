/**
 * Dónde crece el musgo (koke) de una estación. Módulo puro.
 *
 * El musgo no se declara parche a parche: crece donde crecería. Al pie de lo
 * que está plantado —cada pilar del torii, cada farol, cada arbusto, según
 * `objectBases`—, a lo largo del borde interior de los macizos de bambú (que
 * es donde la sombra y la humedad lo dejan), al pie de las cañas —también las
 * del fondo—, en corros por el terreno abierto entre el camino y el bambú y,
 * a trechos, junto a las piedras del camino. Cuánto, lo dice `environment.moss` en `journey.ts`; la semilla
 * es fija, así que cada carga es el mismo jardín.
 *
 * Nunca hace un césped: son corros sueltos que se solapan, con el borde
 * deshecho (lo dibuja `MossPatches`). El terreno sigue siendo el cartel crema.
 */

import { JOURNEY } from '@/config/journey';
import { lerp, mulberry32 } from '@/lib/procedural';
import { pathX, STATION_DEPTHS } from '@/scene/path/journeyPath';
import { stoneLayout } from '@/scene/path/stones';
import { groundY } from '@/scene/systems/elevation';

import { groveCulms } from './bamboo';
import { objectBases } from './footprints';
import { areaU, stationDecorLayout } from './placement';

export interface MossPatch {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  /** Medidas del parche en planta (es un cuadrado de 1 escalado). */
  readonly width: number;
  readonly length: number;
  /** La normal del terreno: el parche se tiende sobre la pendiente. */
  readonly normal: readonly [number, number, number];
  /** 0–1: su dibujo (el contorno y el moteado salen de aquí). */
  readonly seed: number;
  /** 0–1: del verde hondo al medio. */
  readonly tone: number;
}

/** Cuánto se levanta del terreno: sin esto, el parche parpadea con él. */
const LIFT = 0.012;

/** Parches al pie de cada clase de objeto (con musgo 1 y tier alto). */
const PER_BASE = { torii: 3, farol: 6, arbusto: 4 } as const;

/** Probabilidad de que una piedra tenga musgo al lado (con musgo 1). */
const STONE_CHANCE = 0.35;

/** Cada cuánto, a lo largo del borde de un macizo, se intenta un parche. */
const GROVE_STEP = 1.2;

/** Probabilidad de que una caña tenga musgo al pie (con musgo 1). */
const CULM_CHANCE = 0.5;

/** El terreno abierto: desde dónde (pasado el cartel), cada cuánto y con qué probabilidad hay un corro. */
const OPEN_FROM = 0;
const OPEN_STEP = 2.2;
const OPEN_CHANCE = 0.85;

/** El musgo de la estación `index` y su tramo, para un aspecto. */
export function stationMoss(index: number, portrait: boolean, densityScale: number): MossPatch[] {
  const station = JOURNEY[index];
  const stationD = STATION_DEPTHS[index];
  const amount = station?.environment.moss ?? 0;
  if (!station || stationD === undefined || amount <= 0) return [];

  const random = mulberry32(9100 + index * 131 + (portrait ? 7 : 0));
  const keep = amount * densityScale;
  const patches: MossPatch[] = [];

  const add = (x: number, z: number, size: number) => {
    const y0 = groundY(x, z);
    // La normal del terreno, por diferencias.
    const dx = groundY(x + 0.25, z) - groundY(x - 0.25, z);
    const dz = groundY(x, z + 0.25) - groundY(x, z - 0.25);
    const nx = -dx / 0.5;
    const nz = -dz / 0.5;
    const length = Math.hypot(nx, 1, nz);
    const aspect = lerp(0.6, 1, random());
    patches.push({
      x,
      y: y0 + LIFT,
      z,
      yaw: random() * Math.PI * 2,
      width: size * aspect,
      length: size,
      normal: [nx / length, 1 / length, nz / length],
      seed: random(),
      tone: random(),
    });
  };

  /** Una cuenta fraccionaria: 2,4 son dos parches y un 40 % de tener tres. */
  const count = (expected: number) => Math.floor(expected) + (random() < expected % 1 ? 1 : 0);

  /**
   * Un corro: varios parches solapados alrededor de un punto. Juntos se leen
   * como una mata de musgo con forma propia; sueltos, como manchas.
   */
  const drift = (x: number, z: number, n: number, spread: number, small: number, large: number) => {
    for (let k = 0; k < n; k += 1) {
      const angle = random() * Math.PI * 2;
      const reach = spread * Math.sqrt(random());
      add(x + Math.cos(angle) * reach, z + Math.sin(angle) * reach, lerp(small, large, random()));
    }
  };

  const layout = stationDecorLayout(index, portrait);

  // Al pie de lo plantado.
  for (const o of layout.objects) {
    for (const base of objectBases(o)) {
      const n = count(PER_BASE[o.item.kind] * keep * (base.foot > 0.4 ? 1 : 0.7));
      for (let k = 0; k < n; k += 1) {
        const angle = random() * Math.PI * 2;
        const reach = base.foot * lerp(0.5, 1.4, random());
        add(base.x + Math.cos(angle) * reach, base.z + Math.sin(angle) * reach, lerp(0.5, 1.2, random()) * Math.max(0.7, base.foot * 1.6));
      }
    }
  }

  // El borde interior de los macizos: sobre todo hacia dentro, donde hay sombra.
  for (const grove of layout.groves) {
    const [u0, u1] = areaU(grove.area);
    const inward = grove.area.side === 'izquierda' ? -1 : 1;
    const edge = inward < 0 ? u1 : u0;
    const taper = grove.item.taper ?? 1;
    for (let along = 0; along <= 1; along += GROVE_STEP / (grove.area.to - grove.area.from)) {
      if (random() > 0.75 * keep * lerp(1, taper, along)) continue;
      const d = grove.stationD + grove.area.from + along * (grove.area.to - grove.area.from) + (random() - 0.5);
      const u = edge + inward * lerp(-0.4, 1.8, random());
      add(pathX(d) + u, -d, lerp(0.8, 1.8, random()));
    }
    // Y al pie de las cañas de dentro, también las del fondo: si no, el musgo
    // se queda en la orilla del macizo y el bosque de atrás está pelado.
    for (const culm of groveCulms(grove, densityScale)) {
      if (random() > CULM_CHANCE * amount) continue;
      drift(culm.x, culm.z, 1 + (random() < 0.4 ? 1 : 0), 0.5, 0.7, 1.5);
    }
  }

  // A trechos, junto a las piedras: de un poco antes de la estación hasta
  // antes de la siguiente, que tendrá el suyo.
  const next = STATION_DEPTHS[index + 1] ?? stationD + 64;
  const stones = stoneLayout().filter((s) => -s.z >= stationD - 22 && -s.z <= next);

  // El terreno abierto entre el camino y el bambú, a los dos lados: corros
  // sueltos, más cerca del camino que del bambú (donde la orilla ya tiene el
  // suyo), nunca encima de una piedra. Empieza en la estación: lo de delante
  // del cartel se queda como 1.png.
  for (let d = stationD + OPEN_FROM; d <= next - 8; d += OPEN_STEP) {
    for (const side of [-1, 1]) {
      if (random() > OPEN_CHANCE * keep) continue;
      const along = d + random() * OPEN_STEP;
      const x = pathX(along) + side * lerp(0.6, 7.5, random() ** 1.6);
      const z = -along;
      if (stones.some((s) => Math.hypot(s.x - x, s.z - z) < 1.1)) continue;
      drift(x, z, 3 + Math.floor(random() * 3), 1.3, 0.6, 1.4);
    }
  }

  for (const stone of stones) {
    const d = -stone.z;
    if (d < stationD - 20 || d > next - 8) continue;
    if (random() > STONE_CHANCE * keep) continue;
    const n = random() < 0.4 ? 2 : 1;
    for (let k = 0; k < n; k += 1) {
      const angle = random() * Math.PI * 2;
      const reach = stone.scale * lerp(0.55, 1.05, random());
      add(stone.x + Math.cos(angle) * reach, stone.z + Math.sin(angle) * reach, lerp(0.35, 0.75, random()));
    }
  }

  return patches;
}
