import { IcosahedronGeometry, Vector3, type BufferAttribute, type BufferGeometry } from 'three';

import { directionalWobble, mulberry32 } from '@/lib/procedural';

/**
 * Piedra del camino.
 *
 * Icosaedro deformado por ruido direccional y dibujado con flat shading: da
 * las caras planas y el aire tallado de las referencias, y cada `seed` produce
 * una piedra distinta. Ninguna se dibujó a mano.
 *
 * Desde la Fase 3A no hay un mesh por piedra: el camino usa doce formas y las
 * instancia a lo largo de todo el recorrido (`systems/StonePath.tsx`).
 */
export function stoneGeometry(seed: number, detail = 1): BufferGeometry {
  const geo = new IcosahedronGeometry(1, detail);
  const position = geo.attributes.position as BufferAttribute;
  const random = mulberry32(seed);

  // Proporciones de canto rodado: ancha, poco alta.
  const squash = 0.3 + random() * 0.16;
  const stretchX = 0.95 + random() * 0.4;
  const stretchZ = 0.95 + random() * 0.4;

  const v = new Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).normalize();
    const radius = 1 + directionalWobble(v.x, v.y, v.z, seed);
    position.setXYZ(i, v.x * radius * stretchX, v.y * radius * squash, v.z * radius * stretchZ);
  }

  position.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
