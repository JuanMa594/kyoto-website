import { CylinderGeometry, Float32BufferAttribute, Matrix4, PlaneGeometry, Quaternion, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { lerp, mulberry32 } from '@/lib/procedural';

import { clusterBlossoms, type CerezoTree } from './cerezo';

/**
 * La geometría del cerezo (Fase 5B): el tronco y las ramas como tubos de seis
 * lados fusionados en una geometría, y las flores como tarjetas instanciadas
 * repartidas por cada racimo (la flor la dibuja `blossomMaterial`).
 */

const SIDES = 6;
const UP = new Vector3(0, 1, 0);

/** El tronco y las ramas, en el sistema del árbol (la base en el origen). Con `aSway` por vértice. */
export function cerezoTrunkGeometry(tree: CerezoTree): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const from = new Vector3();
  const to = new Vector3();
  const dir = new Vector3();
  const rotation = new Quaternion();
  for (const branch of tree.branches) {
    from.set(...branch.from);
    to.set(...branch.to);
    dir.subVectors(to, from);
    // Un poco más largo: así los tramos se solapan y no se ven las juntas.
    const length = dir.length() + branch.r1;
    const tube = new CylinderGeometry(branch.r1, branch.r0, length, SIDES, 1, true);
    tube.translate(0, length / 2, 0);
    rotation.setFromUnitVectors(UP, dir.normalize());
    tube.applyQuaternion(rotation);
    tube.translate(from.x, from.y, from.z);
    tube.deleteAttribute('uv');
    parts.push(tube.index ? tube.toNonIndexed() : tube);
  }
  const geometry = mergeGeometries(parts)!;
  for (const part of parts) part.dispose();
  return geometry;
}

/** Una flor: una tarjeta de 1 × 1 con la base en el origen y las uv de three. */
export function blossomGeometry(): BufferGeometry {
  const geometry = new PlaneGeometry(1, 1);
  geometry.translate(0, 0.5, 0);
  return geometry;
}

/** Dónde va cada flor: repartidas en cada racimo, más densas por fuera, mirando a cualquier lado. */
export function blossomMatrices(tree: CerezoTree, densityScale: number, seed: number): Matrix4[] {
  const random = mulberry32(seed * 977 + 3);
  const out: Matrix4[] = [];
  const position = new Vector3();
  const rotation = new Quaternion();
  const axis = new Vector3();
  for (const cluster of tree.clusters) {
    const count = clusterBlossoms(cluster, densityScale);
    for (let k = 0; k < count; k += 1) {
      // Un punto en un elipsoide achatado, empujado hacia la superficie.
      const u = random() * 2 - 1;
      const theta = random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const reach = cluster.radius * lerp(0.55, 1, Math.sqrt(random()));
      position.set(cluster.x + s * Math.cos(theta) * reach, cluster.y + u * reach * 0.7, cluster.z + s * Math.sin(theta) * reach);
      axis.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
      rotation.setFromAxisAngle(axis, random() * Math.PI * 2);
      const size = lerp(0.22, 0.32, random());
      out.push(new Matrix4().compose(position, rotation, new Vector3(size, size, size)));
    }
  }
  return out;
}

/** El atributo de viento de todo el árbol: se mece entero, despacio, desde la base. */
export function treeSway(count: number, height: number, phase: number, spring: number): Float32BufferAttribute {
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) data.set([0, height, phase, spring], i * 4);
  return new Float32BufferAttribute(data, 4);
}
