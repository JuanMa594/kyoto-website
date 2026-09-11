'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { directionalWobble, mulberry32 } from '@/lib/procedural';

/**
 * Piedra del camino.
 *
 * Icosaedro deformado por ruido direccional y renderizado con flat shading: da
 * las caras planas y el aire tallado de las referencias, y cada `seed` produce
 * una piedra distinta. Ninguna se repite y ninguna se dibujó a mano.
 *
 * En la Fase 3 estas mismas piedras se instancian a lo largo del spline del
 * camino; aquí sirven para calibrar luz, escala y niebla.
 */

export function useStoneGeometry(seed: number, detail = 1): THREE.BufferGeometry {
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, detail);
    const position = geo.attributes.position as THREE.BufferAttribute;
    const random = mulberry32(seed);

    // Proporciones de canto rodado: ancha, poco alta.
    const squash = 0.3 + random() * 0.16;
    const stretchX = 0.95 + random() * 0.4;
    const stretchZ = 0.95 + random() * 0.4;

    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i).normalize();
      const radius = 1 + directionalWobble(v.x, v.y, v.z, seed);
      position.setXYZ(i, v.x * radius * stretchX, v.y * radius * squash, v.z * radius * stretchZ);
    }

    position.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [seed, detail]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return geometry;
}

interface StoneProps {
  seed: number;
  position: [number, number, number];
  scale?: number;
  rotation?: number;
  color: string;
  /** Baja a 0 en tier bajo: la piedra se ve igual de lejos con menos triángulos. */
  detail?: number;
}

export function Stone({
  seed,
  position,
  scale = 1,
  rotation = 0,
  color,
  detail = 1,
}: StoneProps) {
  const geometry = useStoneGeometry(seed, detail);

  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={[0, rotation, 0]}
      scale={scale}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} flatShading roughness={0.95} metalness={0} />
    </mesh>
  );
}
