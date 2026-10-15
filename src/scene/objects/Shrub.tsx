'use client';

import { useEffect, useMemo } from 'react';
import { Color, InstancedBufferAttribute, InstancedMesh, Mesh } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';
import { SHRUB_SIZE, type PlacedObject } from '@/scene/decor/placement';
import { SHRUB_LEAVES, shrubLeafGeometry, shrubLeaves, shrubMassGeometry } from '@/scene/decor/shrub';
import type { QualityProfile } from '@/scene/quality/tiers';
import { SHRUB_SPRING } from '@/scene/systems/sway';

interface ShrubProps {
  placed: PlacedObject;
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * Un arbusto podado en nube. La masa y las hojas se mecen con el muelle de
 * los arbustos: más rígido y con menos recorrido que el bambú. En tier bajo,
 * sólo la masa, con un verde más claro y su sombreado.
 */
export function Shrub({ placed, palette, profile }: ShrubProps) {
  const seed = placed.item.kind === 'arbusto' ? placed.item.seed : 1;

  const meshes = useMemo(() => {
    const look = { washi: palette.washi, ink: palette.sumi };
    const leafCount = SHRUB_LEAVES[profile.tier];
    const mass = new Mesh(
      shrubMassGeometry(seed),
      createDecorMaterial({
        ...look,
        key: 'arbusto-masa',
        color: leafCount > 0 ? palette.kokeDeep : palette.kokeMid,
        roughness: 0.9,
        vertexColors: true,
        sway: 'tallo',
      }),
    );
    mass.castShadow = profile.shadows;
    mass.receiveShadow = profile.shadows;

    if (leafCount === 0) return { mass, leaves: null };

    const placements = shrubLeaves(seed, leafCount);
    const leafGeo = shrubLeafGeometry();
    const leaves = new InstancedMesh(
      leafGeo,
      createDecorMaterial({
        ...look,
        key: 'arbusto-hoja',
        color: '#ffffff',
        roughness: 0.75,
        rim: 0.2,
        doubleSide: true,
        sway: 'hoja',
      }),
      placements.length,
    );
    const mid = new Color(palette.kokeMid);
    const light = new Color(palette.koke);
    const color = new Color();
    const sway = new Float32Array(placements.length * 4);
    placements.forEach((leaf, i) => {
      leaves.setMatrixAt(i, leaf.matrix);
      leaves.setColorAt(i, color.copy(mid).lerp(light, leaf.tone));
      sway.set([0, SHRUB_SIZE.height, (seed * 0.173 + leaf.tone * 0.2) % 1, SHRUB_SPRING], i * 4);
    });
    leafGeo.setAttribute('aSway', new InstancedBufferAttribute(sway, 4));
    return { mass, leaves };
  }, [seed, palette, profile.tier, profile.shadows]);

  useEffect(
    () => () => {
      for (const mesh of [meshes.mass, meshes.leaves]) {
        if (!mesh) continue;
        mesh.geometry.dispose();
        (mesh.material as { dispose(): void }).dispose();
      }
      meshes.leaves?.dispose();
    },
    [meshes],
  );

  // Sin giro: la flexión va en ejes del mundo (ver windSway.ts).
  return (
    <group position={[placed.x, placed.y, placed.z]} scale={placed.scale}>
      <primitive object={meshes.mass} />
      {meshes.leaves && <primitive object={meshes.leaves} />}
    </group>
  );
}
