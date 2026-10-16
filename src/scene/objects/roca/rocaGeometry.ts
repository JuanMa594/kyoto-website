import { BufferAttribute, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { directionalWobble, mulberry32 } from '@/lib/procedural';

import { ROCA_SIZE } from './roca';

/**
 * La roca pintada, generada por código (Fase 5B).
 *
 * Una esfera llevada a un cubo redondeado (superelipsoide de exponente 4) con
 * las medidas de `ROCA_SIZE`, algo más estrecha arriba —una piedra puesta en
 * pie—, la base plana y enterrada, y ruido direccional como el de las piedras
 * del camino: poco en la cara pintada (+z), que es casi plana, y más en el
 * resto. Normales suaves sobre la malla soldada (sin la costura de la esfera).
 *
 * Atributo `aFace` (por vértice): xy, la posición en la cara en unidades
 * (centrada, de ±ancho/2 y ±alto/2); z, sin uso; w, cuánto mira la superficie
 * al frente (0–1). Con eso el shader pinta sólo la cara y deja que la pintura
 * ceda donde la piedra se tuerce.
 */
export function rocaGeometry(seed: number): BufferGeometry {
  const random = mulberry32(seed);
  const sphere = new SphereGeometry(1, 72, 48);
  sphere.deleteAttribute('uv');
  sphere.deleteAttribute('normal');
  const geometry = mergeVertices(sphere);
  sphere.dispose();

  const { width, height, depth } = ROCA_SIZE;
  const position = geometry.getAttribute('position') as BufferAttribute;
  const v = new Vector3();
  const lean = (random() - 0.5) * 0.12;
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).normalize();
    // Al cubo redondeado: |x|⁴ + |y|⁴ + |z|⁴ = 1.
    const k = Math.pow(v.x ** 4 + v.y ** 4 + v.z ** 4, -0.25);
    let x = v.x * k;
    let y = v.y * k;
    let z = v.z * k;
    // El ruido: la cara (+z) casi plana; el resto, tallado.
    const front = Math.max(0, v.z);
    const wobble = directionalWobble(v.x, v.y, v.z, seed) * (0.85 - 0.75 * front ** 2);
    x *= 1 + wobble;
    y *= 1 + wobble * 0.6;
    z *= 1 + wobble;
    // La cara, plana: una piedra puesta en pie, no un cojín. Y la cabeza,
    // cortada en sesgo, como un tateishi.
    z = Math.min(z, 0.78 + wobble * 0.15);
    y = Math.min(y, 0.82 + x * 0.12 + wobble * 0.3);
    // Más estrecha arriba, y un poco ladeada.
    const up = (y + 1) / 2;
    x *= 1 - 0.12 * up;
    z *= 1 - 0.22 * up;
    x += lean * up;
    position.setXYZ(i, (x * width) / 2, Math.max(-1, y) * (height / 2) + height / 2 - 0.1, (z * depth) / 2);
  }
  // La base, plana y enterrada.
  for (let i = 0; i < position.count; i += 1) {
    if (position.getY(i) < 0) position.setY(i, -0.1);
  }
  position.needsUpdate = true;

  // Ajusta a las medidas exactas (el ruido las mueve un poco).
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const sx = width / (box.max.x - box.min.x);
  const sy = height / (box.max.y - box.min.y);
  const sz = depth / (box.max.z - box.min.z);
  for (let i = 0; i < position.count; i += 1) {
    position.setXYZ(
      i,
      (position.getX(i) - (box.max.x + box.min.x) / 2) * sx,
      (position.getY(i) - box.min.y) * sy - 0.1,
      (position.getZ(i) - (box.max.z + box.min.z) / 2) * sz,
    );
  }
  geometry.computeVertexNormals();

  const normal = geometry.getAttribute('normal') as BufferAttribute;
  const face = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i += 1) {
    const facing = normal.getZ(i);
    face[i * 4] = position.getX(i);
    face[i * 4 + 1] = position.getY(i) - (height / 2 - 0.1);
    face[i * 4 + 2] = 0;
    face[i * 4 + 3] = Math.min(1, Math.max(0, (facing - 0.35) / 0.5));
  }
  geometry.setAttribute('aFace', new BufferAttribute(face, 4));
  return geometry;
}
