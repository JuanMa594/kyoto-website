'use client';

import { useEffect, useMemo } from 'react';

import type { ScenePalette } from '@/lib/css-vars';
import type { PlacedObject } from '@/scene/decor/placement';
import type { QualityProfile } from '@/scene/quality/tiers';

import { rocaGeometry } from './rocaGeometry';
import { createRocaMaterial } from './rocaMaterial';

interface RocaPintadaProps {
  placed: PlacedObject;
  palette: ScenePalette;
  profile: QualityProfile;
}

/** Semilla de la forma: la misma roca en cada carga. */
const SEED = 7;

/**
 * La roca pintada del tramo de Ubicación (Fase 5B), colocada por
 * `StationDecor`. No se mueve. Geometría y material se crean al montar y se
 * liberan al desmontar.
 */
export default function RocaPintada({ placed, palette, profile }: RocaPintadaProps) {
  const geometry = useMemo(() => rocaGeometry(SEED), []);
  const material = useMemo(
    () =>
      createRocaMaterial({
        stone: palette.ishiDeep,
        sun: palette.shu,
        ink: palette.sumi,
        snow: palette.kami,
        washi: palette.washi,
      }),
    [palette],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[placed.x, placed.y, placed.z]}
      rotation={[0, placed.yaw, 0]}
      scale={placed.scale}
      castShadow={profile.shadows}
      receiveShadow={profile.shadows}
    />
  );
}
