'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Euler,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type InstancedMesh,
} from 'three';

import { stoneGeometry } from '@/scene/objects/stoneGeometry';
import { STONE_VARIANTS, stoneLayout, stoneSeed, type StoneInstance } from '@/scene/path/stones';
import type { QualityProfile } from '@/scene/quality/tiers';

/**
 * El camino de piedras, entero.
 *
 * Unas trescientas piedras de la Home a Gastronomía, en **doce
 * `InstancedMesh`** —una por forma—: doce llamadas de dibujo en vez de
 * trescientas. Dónde va cada una lo decide `scene/path/stones.ts`, que es puro
 * y está comprobado por `bun run check:path`: todas dentro del pasillo y
 * apoyadas en el mismo terreno que se dibuja.
 */

interface StonePathProps {
  color: string;
  profile: QualityProfile;
}

export function StonePath({ color, profile }: StonePathProps) {
  // En tier bajo la piedra se ve igual de lejos con menos triángulos.
  const detail = profile.tier === 'low' ? 0 : 1;

  const geometries = useMemo(
    () =>
      Array.from({ length: STONE_VARIANTS }, (_, variant) => stoneGeometry(stoneSeed(variant), detail)),
    [detail],
  );
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);

  const material = useMemo(
    () => new MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0 }),
    [color],
  );
  useEffect(() => () => material.dispose(), [material]);

  const batches = useMemo(() => {
    const groups = Array.from({ length: STONE_VARIANTS }, () => [] as StoneInstance[]);
    for (const stone of stoneLayout()) groups[stone.variant]!.push(stone);
    return groups;
  }, []);

  return (
    <>
      {batches.map((instances, variant) =>
        instances.length > 0 ? (
          <StoneBatch
            key={variant}
            geometry={geometries[variant]!}
            material={material}
            instances={instances}
          />
        ) : null,
      )}
    </>
  );
}

interface StoneBatchProps {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  instances: readonly StoneInstance[];
}

function StoneBatch({ geometry, material, instances }: StoneBatchProps) {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;

    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const euler = new Euler();

    instances.forEach((stone, i) => {
      position.set(stone.x, stone.y, stone.z);
      rotation.setFromEuler(euler.set(0, stone.rotation, 0));
      scale.setScalar(stone.scale);
      node.setMatrixAt(i, matrix.compose(position, rotation, scale));
    });

    node.instanceMatrix.needsUpdate = true;
    // La caja de un InstancedMesh cubre todas sus instancias sólo si se le
    // pide: sin esto, el frustum lo recortaría con la caja de una sola piedra.
    node.computeBoundingSphere();
  }, [instances, geometry]);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, instances.length]}
      castShadow
      receiveShadow
    />
  );
}
