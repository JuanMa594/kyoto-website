/**
 * Lo alto de las piedras del camino, para lo que las pisa.
 *
 * La fauna que anda se apoya en el suelo (`groundAt`), y el suelo era sólo el
 * terreno: las piedras sobresalen hasta ~0,3 u y una ardilla de 0,3 de alto
 * las cruzaba **por dentro**. Ahora el suelo de la fauna es lo más alto entre el
 * terreno y las piedras (`stoneTopY`).
 *
 * Cada una de las doce formas se mide una vez, sobre su propia geometría (la
 * misma de `stoneGeometry`, la que dibuja `StonePath`), en un mapa de alturas
 * local. Ese mapa no es la piedra tal cual, por dos motivos:
 *
 *   · **Se ensancha** (`STONE_FOOTPRINT`): el animal se apoya por el centro, pero
 *     tiene patas a los lados. Sin margen, en el borde la pata de delante ya
 *     está dentro de la piedra mientras el centro sigue en el terreno.
 *   · **Se suaviza** (`STONE_SOFTEN`): un canto es un escalón, y subir un
 *     escalón de golpe es teletransportarse 0,2 u en un frame. Con la rampa, el
 *     animal sube a la piedra en un par de palmos y se inclina al hacerlo (el
 *     cabeceo sale de la trayectoria). Se ensancha antes de suavizar y nunca
 *     más de lo ensanchado, así que el resultado nunca queda por debajo de la
 *     piedra real.
 */

import { stoneGeometry } from '@/scene/objects/stoneGeometry';

import { STONE_SINK, STONE_VARIANTS, stoneLayout, stoneSeed, type StoneInstance } from './stones';

/** Margen de pisada alrededor de cada piedra, en unidades de mundo. */
export const STONE_FOOTPRINT = 0.15;
/** Radio de la rampa que suaviza el canto (≤ `STONE_FOOTPRINT`). */
const STONE_SOFTEN = 0.15;
/** La piedra más pequeña: convierte los márgenes de mundo a unidades locales. */
const MIN_SCALE = 0.7 * 0.88;
/** Celdas por lado del mapa de alturas de cada forma. */
const GRID = 49;
/** Hasta dónde llega una piedra desde su centro, con margen, en mundo. */
const REACH = 1.8;

interface HeightMap {
  /** Medio lado del mapa, en unidades locales. */
  readonly half: number;
  readonly heights: Float32Array;
}

let maps: HeightMap[] | null = null;
let byZ: StoneInstance[] = [];

/** Lo alto de una forma en cada celda, ensanchado y suavizado. */
function measure(variant: number): HeightMap {
  const geometry = stoneGeometry(stoneSeed(variant), 1);
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const vertex = (i: number) => (index ? index.getX(i) : i);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const margin = (STONE_FOOTPRINT + STONE_SOFTEN) / MIN_SCALE;
  const half = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) + margin;
  const cell = (2 * half) / (GRID - 1);

  // Fuera de la piedra: la altura del terreno bajo su centro (la piedra está
  // hundida `STONE_SINK`). Así la rampa sale del suelo, no de debajo de él.
  const floor = STONE_SINK;
  const raw = new Float32Array(GRID * GRID).fill(floor);

  // Lo alto de la cara que hay encima de cada celda (proyección vertical).
  for (let t = 0; t < count; t += 3) {
    const a = vertex(t);
    const b = vertex(t + 1);
    const c = vertex(t + 2);
    const ax = position.getX(a), ay = position.getY(a), az = position.getZ(a);
    const bx = position.getX(b), by = position.getY(b), bz = position.getZ(b);
    const cx = position.getX(c), cy = position.getY(c), cz = position.getZ(c);
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-9) continue;

    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) + half) / cell));
    const i1 = Math.min(GRID - 1, Math.ceil((Math.max(ax, bx, cx) + half) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) + half) / cell));
    const j1 = Math.min(GRID - 1, Math.ceil((Math.max(az, bz, cz) + half) / cell));
    for (let j = j0; j <= j1; j += 1) {
      const z = -half + j * cell;
      for (let i = i0; i <= i1; i += 1) {
        const x = -half + i * cell;
        const wa = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const wb = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        const wc = 1 - wa - wb;
        if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
        const y = wa * ay + wb * by + wc * cy;
        const k = j * GRID + i;
        if (y > raw[k]!) raw[k] = y;
      }
    }
  }
  geometry.dispose();

  // Ensanchar: cada celda toma lo más alto de su disco de pisada… (una celda de
  // más cubre lo que la interpolación entre celdas pudiera dejar por debajo).
  const grow = Math.ceil(STONE_FOOTPRINT / MIN_SCALE / cell) + 1;
  const wide = new Float32Array(GRID * GRID);
  for (let j = 0; j < GRID; j += 1) {
    for (let i = 0; i < GRID; i += 1) {
      let top = floor;
      for (let dj = -grow; dj <= grow; dj += 1) {
        for (let di = -grow; di <= grow; di += 1) {
          if (di * di + dj * dj > grow * grow) continue;
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= GRID || jj >= GRID) continue;
          top = Math.max(top, raw[jj * GRID + ii]!);
        }
      }
      wide[j * GRID + i] = top;
    }
  }

  // …y suavizar con un promedio de radio menor que el ensanche: el promedio de
  // valores que ya cubren la piedra en un disco mayor nunca baja de ella.
  const soften = Math.floor(STONE_SOFTEN / MIN_SCALE / cell);
  const heights = new Float32Array(GRID * GRID);
  for (let j = 0; j < GRID; j += 1) {
    for (let i = 0; i < GRID; i += 1) {
      let sum = 0;
      let n = 0;
      for (let dj = -soften; dj <= soften; dj += 1) {
        for (let di = -soften; di <= soften; di += 1) {
          if (di * di + dj * dj > soften * soften) continue;
          const ii = Math.min(GRID - 1, Math.max(0, i + di));
          const jj = Math.min(GRID - 1, Math.max(0, j + dj));
          sum += wide[jj * GRID + ii]!;
          n += 1;
        }
      }
      heights[j * GRID + i] = sum / n;
    }
  }

  return { half, heights };
}

/**
 * Mide las doce formas ya. Cuesta unos 35 ms una sola vez: el director lo pide
 * en un momento ocioso al montarse para que no caiga en el frame en que nace el
 * primer animal.
 */
export function prepareStoneSurface(): void {
  ensureMaps();
}

function ensureMaps(): HeightMap[] {
  if (!maps) {
    maps = Array.from({ length: STONE_VARIANTS }, (_, variant) => measure(variant));
    byZ = stoneLayout().sort((a, b) => a.z - b.z);
  }
  return maps;
}

/** Interpolación bilineal en el mapa; `null` fuera de él. */
function sample(map: HeightMap, x: number, z: number): number | null {
  const cell = (2 * map.half) / (GRID - 1);
  const fx = (x + map.half) / cell;
  const fz = (z + map.half) / cell;
  if (fx < 0 || fz < 0 || fx > GRID - 1 || fz > GRID - 1) return null;
  const i = Math.min(GRID - 2, Math.floor(fx));
  const j = Math.min(GRID - 2, Math.floor(fz));
  const u = fx - i;
  const v = fz - j;
  const h = map.heights;
  const top = h[j * GRID + i]! * (1 - u) + h[j * GRID + i + 1]! * u;
  const bottom = h[(j + 1) * GRID + i]! * (1 - u) + h[(j + 1) * GRID + i + 1]! * u;
  return top * (1 - v) + bottom * v;
}

/**
 * Lo más alto de las piedras en (x, z) de mundo, ya ensanchado y suavizado para
 * lo que pisa, o −∞ si no hay ninguna cerca.
 */
export function stoneTopY(x: number, z: number): number {
  const shapes = ensureMaps();
  let top = Number.NEGATIVE_INFINITY;

  // Las piedras van ordenadas en z: sólo se miran las que quedan a su alcance.
  let low = 0;
  let high = byZ.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (byZ[mid]!.z < z - REACH) low = mid + 1;
    else high = mid;
  }

  for (let k = low; k < byZ.length && byZ[k]!.z <= z + REACH; k += 1) {
    const stone = byZ[k]!;
    const dx = x - stone.x;
    if (Math.abs(dx) > REACH) continue;
    const dz = z - stone.z;
    // Al marco de la piedra: deshacer su giro en Y y su escala.
    const cos = Math.cos(stone.rotation);
    const sin = Math.sin(stone.rotation);
    const lx = (dx * cos - dz * sin) / stone.scale;
    const lz = (dx * sin + dz * cos) / stone.scale;
    const local = sample(shapes[stone.variant]!, lx, lz);
    if (local !== null) top = Math.max(top, stone.y + local * stone.scale);
  }

  return top;
}
