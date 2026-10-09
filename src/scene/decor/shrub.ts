/**
 * El arbusto podado en nube (o-karikomi), como datos y geometría. Puro.
 *
 * Dos o tres esferas solapadas y deformadas con ruido hacen de **masa**: un
 * interior oscuro, para que entre las hojas no se vea a través, y la
 * superficie sobre la que se apoyan las hojas. Las hojas, cientos, se orientan
 * según esa superficie.
 */

import { Float32BufferAttribute, IcosahedronGeometry, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { OutlinePoint } from '@/lib/petalOutlines';
import { directionalWobble, lerp, mulberry32 } from '@/lib/procedural';
import { outlineGeometry } from '@/scene/objects/PetalGeometry';
import type { QualityTier } from '@/scene/quality/tiers';
import { SHRUB_SPRING } from '@/scene/systems/sway';

import { SHRUB_SIZE } from './placement';

export interface Blob {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly r: number;
}

/** Cuántas hojas por arbusto según el tier. En el bajo, sólo la masa. */
export const SHRUB_LEAVES: Record<QualityTier, number> = { high: 900, medium: 540, low: 0 };

export function shrubBlobs(seed: number): Blob[] {
  const random = mulberry32(seed * 31 + 7);
  const blobs: Blob[] = [{ x: 0, y: 0.62, z: 0, r: 0.74 }];
  const count = 2 + Math.floor(random() * 2);
  const turn = random() * Math.PI * 2;
  for (let i = 0; i < count; i += 1) {
    const angle = turn + (i / count) * Math.PI * 2 + (random() - 0.5) * 0.6;
    const distance = lerp(0.38, 0.48, random());
    blobs.push({
      x: Math.cos(angle) * distance,
      y: lerp(0.42, 0.55, random()),
      z: Math.sin(angle) * distance,
      r: lerp(0.42, 0.55, random()),
    });
  }
  return blobs;
}

/** El radio de la superficie de una esfera en una dirección: ruido suave, siempre cerrado. */
function surface(blob: Blob, dir: Vector3, seed: number): number {
  return blob.r * (1 + 0.2 * directionalWobble(dir.x, dir.y, dir.z, seed));
}

const DETAIL = 3;
/** Triángulos de una esfera de detalle 3, por las cuatro esferas de la masa más grande. */
export const MASS_TRIANGLES_MAX = 20 * 4 ** DETAIL * 4;

/** La masa: las esferas deformadas, con un sombreado gris en el color de vértice y su aSway. */
export function shrubMassGeometry(seed: number): BufferGeometry {
  const parts = shrubBlobs(seed).map((blob, b) => {
    const geometry = new IcosahedronGeometry(1, DETAIL);
    const position = geometry.getAttribute('position');
    const shade: number[] = [];
    const dir = new Vector3();
    for (let i = 0; i < position.count; i += 1) {
      dir.set(position.getX(i), position.getY(i), position.getZ(i)).normalize();
      const r = surface(blob, dir, seed + b) * 0.94;
      position.setXYZ(i, blob.x + dir.x * r, Math.max(0.02, blob.y + dir.y * r), blob.z + dir.z * r);
      const s = 0.72 + 0.28 * (0.5 + directionalWobble(dir.x * 3, dir.y * 3, dir.z * 3, seed));
      shade.push(s, s, s);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(shade, 3));
    geometry.deleteAttribute('uv');
    geometry.computeVertexNormals();
    return geometry;
  });

  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('arbusto: no se pudo fusionar la masa');

  const count = merged.getAttribute('position').count;
  const sway = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) sway.set([0, SHRUB_SIZE.height, (seed * 0.173) % 1, SHRUB_SPRING], i * 4);
  merged.setAttribute('aSway', new Float32BufferAttribute(sway, 4));
  return merged;
}

export interface ShrubLeaf {
  readonly matrix: Matrix4;
  /** 0–1: del verde medio al claro. */
  readonly tone: number;
}

/** Las hojas, sobre la superficie y fuera de las otras esferas. */
export function shrubLeaves(seed: number, count: number): ShrubLeaf[] {
  const random = mulberry32(seed * 131 + 3);
  const blobs = shrubBlobs(seed);
  const weights = blobs.map((b) => b.r * b.r);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const leaves: ShrubLeaf[] = [];
  const dir = new Vector3();
  const up = new Vector3(0, 0, 1);

  for (let attempt = 0; leaves.length < count && attempt < count * 4; attempt += 1) {
    let ticket = random() * total;
    let index = 0;
    while (index < blobs.length - 1 && ticket > weights[index]!) {
      ticket -= weights[index]!;
      index += 1;
    }
    const blob = blobs[index]!;
    dir.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1);
    if (dir.lengthSq() < 1e-4) continue;
    dir.normalize();
    const r = surface(blob, dir, seed + index);
    const point = new Vector3(blob.x + dir.x * r, blob.y + dir.y * r, blob.z + dir.z * r);
    if (point.y < 0.08) continue;
    // Dentro de otra esfera no se ve: se descarta.
    const hidden = blobs.some((other, o) => {
      if (o === index) return false;
      return point.distanceTo(new Vector3(other.x, other.y, other.z)) < other.r * 0.92;
    });
    if (hidden) continue;

    const facing = new Quaternion().setFromUnitVectors(up, dir);
    const roll = new Quaternion().setFromAxisAngle(dir, random() * Math.PI * 2);
    const size = lerp(0.16, 0.22, random());
    leaves.push({
      matrix: new Matrix4().compose(point, roll.multiply(facing), new Vector3(size * 0.7, size, size)),
      tone: random(),
    });
  }
  return leaves;
}

/** Una hoja de azalea: un óvalo con punta, de largo 1, base en el origen. */
function azaleaOutline(): OutlinePoint[] {
  const points: OutlinePoint[] = [];
  const steps = 10;
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const tip = Math.sin(a) > 0 ? 1 + 0.25 * Math.sin(a) ** 4 : 1;
    points.push({ x: Math.cos(a) * 0.32, y: 0.5 + Math.sin(a) * 0.5 * tip });
  }
  return points;
}

export const SHRUB_LEAF_TRIANGLES = 10;

export function shrubLeafGeometry(): BufferGeometry {
  const geometry = outlineGeometry(azaleaOutline(), 0.05, 1);
  geometry.translate(0, 0.5, 0);
  return geometry;
}
