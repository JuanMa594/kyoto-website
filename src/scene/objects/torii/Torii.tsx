'use client';

import { useEffect, useMemo } from 'react';

import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';
import type { PlacedObject } from '@/scene/decor/placement';
import type { QualityProfile } from '@/scene/quality/tiers';

import { ryobuToriiGeometry } from './toriiGeometry';

interface ToriiProps {
  placed: PlacedObject;
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * Un torii ryōbu, colocado por `StationDecor`. No se mueve con el viento: es
 * el ancla del cuadro. La geometría es compartida y no se libera; los
 * materiales, sí, al desmontar.
 */
export function Torii({ placed, palette, profile }: ToriiProps) {
  const parts = useMemo(ryobuToriiGeometry, []);
  const materials = useMemo(() => {
    const common = { key: 'torii', washi: palette.washi, ink: palette.sumi };
    return {
      shu: createDecorMaterial({ ...common, color: palette.shu, roughness: 0.62 }),
      sumi: createDecorMaterial({ ...common, color: palette.sumi, roughness: 0.8 }),
      placa: createDecorMaterial({ ...common, color: palette.washi, roughness: 0.9, rim: 0 }),
    };
  }, [palette]);

  useEffect(
    () => () => {
      for (const material of Object.values(materials)) material.dispose();
    },
    [materials],
  );

  return (
    <group position={[placed.x, placed.y, placed.z]} rotation={[0, placed.yaw, 0]} scale={placed.scale}>
      <mesh
        geometry={parts.shu}
        material={materials.shu}
        castShadow={profile.shadows}
        receiveShadow={profile.shadows}
      />
      <mesh
        geometry={parts.sumi}
        material={materials.sumi}
        castShadow={profile.shadows}
        receiveShadow={profile.shadows}
      />
      <mesh geometry={parts.placa} material={materials.placa} />
    </group>
  );
}
