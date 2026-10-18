import { BufferAttribute, IcosahedronGeometry, Vector3, type BufferGeometry } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { directionalWobble } from '@/lib/procedural';

/**
 * Una piedra de río, generada por código (5B, pulido): un icosaedro con un
 * poco de ruido direccional —redondeada por el agua, no tallada—, aplanada y
 * con la base plana. Mide 1 de radio en planta y 1 de alto, con la base en
 * y = 0: cada instancia la escala a su radio y su alto. Facetada como las
 * piedras del camino (el material lleva `flatShading`).
 */
export function pebbleGeometry(seed: number): BufferGeometry {
  const ico = new IcosahedronGeometry(1, 1);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const geometry = mergeVertices(ico);
  ico.dispose();

  const position = geometry.getAttribute('position') as BufferAttribute;
  const v = new Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).normalize();
    const wobble = 1 + directionalWobble(v.x, v.y, v.z, seed) * 0.35;
    // Más alta por arriba que por abajo, y la base plana: apoyada, no rodando.
    const y = Math.max(-0.35, v.y) * wobble;
    position.setXYZ(i, v.x * wobble, (y + 0.35) / 1.35, v.z * wobble);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
