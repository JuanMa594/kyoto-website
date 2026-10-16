/**
 * El cerezo (桜), como crecimiento puro (Fase 5B): el árbol de los últimos
 * metros del tramo de Ubicación, que anuncia Eventos. Es el **asset base de la
 * Fase 7**: su bosque será este mismo árbol con otras semillas.
 *
 * Forma de somei-yoshino: un tronco corto que se abre pronto en tres o cuatro
 * ramas principales muy tendidas, y éstas en otras cada vez más cortas y
 * finas, hasta una copa ancha y baja. Las puntas cargan los racimos de flor.
 * Todo sale de la semilla: el mismo árbol en cada carga, ninguno igual a otro.
 *
 * Origen: la base del tronco, en el suelo. Unidades de mundo.
 */

import { lerp, mulberry32 } from '@/lib/procedural';

export const CEREZO_SIZE = {
  /** Alto total, de la base a lo más alto de la copa. */
  height: [5, 7] as const,
  /** Diámetro de la copa: más ancha que alta. */
  spread: [6, 10] as const,
} as const;

export type Vec3 = [number, number, number];

export interface Branch {
  readonly from: Vec3;
  readonly to: Vec3;
  /** Radio en su base y en su punta. */
  readonly r0: number;
  readonly r1: number;
}

export interface Cluster {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
}

export interface CerezoTree {
  readonly branches: readonly Branch[];
  readonly clusters: readonly Cluster[];
  /** De la base a lo más alto de la copa. */
  readonly height: number;
  /** Diámetro de la copa en planta. */
  readonly spread: number;
  readonly trunkRadius: number;
}

const LEVELS = 5;

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

/** Una dirección a `tilt` radianes de la vertical, con rumbo `azimuth`. */
function direction(tilt: number, azimuth: number): Vec3 {
  return [Math.sin(tilt) * Math.cos(azimuth), Math.cos(tilt), Math.sin(tilt) * Math.sin(azimuth)];
}

const cache = new Map<number, CerezoTree>();

export function growCerezo(seed: number): CerezoTree {
  const cached = cache.get(seed);
  if (cached) return cached;

  const random = mulberry32(seed * 131 + 7);
  const branches: Branch[] = [];
  const clusters: Cluster[] = [];

  const trunkRadius = lerp(0.2, 0.27, random());
  const trunkHeight = lerp(1.4, 1.9, random());
  const lean = direction(lerp(0.02, 0.1, random()), random() * Math.PI * 2);
  const trunkTop: Vec3 = [lean[0] * trunkHeight, trunkHeight, lean[2] * trunkHeight];
  branches.push({ from: [0, 0, 0], to: trunkTop, r0: trunkRadius * 1.15, r1: trunkRadius * 0.85 });

  /** Una rama, partida en dos tramos con un quiebro suave, y sus hijas. */
  const grow = (from: Vec3, dir: Vec3, length: number, radius: number, level: number) => {
    const bend = normalize([dir[0] + (random() - 0.5) * 0.35, dir[1] + (random() - 0.5) * 0.2 + 0.05, dir[2] + (random() - 0.5) * 0.35]);
    const mid: Vec3 = [from[0] + dir[0] * length * 0.5, from[1] + dir[1] * length * 0.5, from[2] + dir[2] * length * 0.5];
    const end: Vec3 = [mid[0] + bend[0] * length * 0.5, mid[1] + bend[1] * length * 0.5, mid[2] + bend[2] * length * 0.5];
    const tip = radius * 0.62;
    branches.push({ from, to: mid, r0: radius, r1: lerp(radius, tip, 0.5) });
    branches.push({ from: mid, to: end, r0: lerp(radius, tip, 0.5), r1: tip });

    if (level >= LEVELS) {
      clusters.push({ x: end[0], y: end[1], z: end[2], radius: lerp(0.5, 0.85, random()) });
      return;
    }
    // Una flor a media rama en los niveles altos: la copa se llena por dentro.
    if (level >= LEVELS - 1 && random() < 0.6) {
      clusters.push({ x: mid[0], y: mid[1] + 0.1, z: mid[2], radius: lerp(0.4, 0.65, random()) });
    }
    const children = 2 + (random() < 0.45 ? 1 : 0);
    const baseAzimuth = Math.atan2(bend[2], bend[0]);
    const baseTilt = Math.acos(Math.max(-1, Math.min(1, bend[1])));
    for (let k = 0; k < children; k += 1) {
      const spread = (k / Math.max(1, children - 1) - 0.5) * lerp(0.9, 1.4, random());
      // Las hijas se tienden un poco más que la madre, sin llegar a colgar.
      const tilt = Math.min(1.35, baseTilt + lerp(-0.1, 0.25, random()));
      const child = direction(tilt, baseAzimuth + spread);
      grow(end, child, length * lerp(0.62, 0.78, random()), tip, level + 1);
    }
  };

  const primaries = 3 + (random() < 0.5 ? 1 : 0);
  const offset = random() * Math.PI * 2;
  for (let k = 0; k < primaries; k += 1) {
    const azimuth = offset + (k / primaries) * Math.PI * 2 + (random() - 0.5) * 0.5;
    const tilt = lerp(0.75, 1.05, random());
    grow(trunkTop, direction(tilt, azimuth), lerp(1.5, 1.95, random()), trunkRadius * 0.62, 2);
  }

  let height = 0;
  let reach = 0;
  for (const c of clusters) {
    height = Math.max(height, c.y + c.radius * 0.7);
    reach = Math.max(reach, Math.hypot(c.x, c.z) + c.radius);
  }
  const tree: CerezoTree = { branches, clusters, height, spread: reach * 2, trunkRadius };
  cache.set(seed, tree);
  return tree;
}

/** Flores por racimo, según su tamaño y la densidad del tier. */
export function clusterBlossoms(cluster: Cluster, densityScale: number): number {
  return Math.max(4, Math.round(cluster.radius * cluster.radius * 58 * densityScale));
}

/** Cuántas flores lleva el árbol con esa densidad. */
export function blossomCount(tree: CerezoTree, densityScale: number): number {
  return tree.clusters.reduce((sum, cluster) => sum + clusterBlossoms(cluster, densityScale), 0);
}
