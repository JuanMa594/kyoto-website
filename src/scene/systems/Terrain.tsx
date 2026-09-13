'use client';

import { useEffect, useMemo } from 'react';
import { PlaneGeometry, type BufferAttribute } from 'three';

import type { StationEnvironment } from '@/config/journey';
import type { QualityProfile } from '@/scene/quality/tiers';

import { GROUND_Y, terrainHeight } from './elevation';

/**
 * El suelo, deformado según el ambiente de la estación activa.
 *
 * Sustituye al plano plano de la primera versión: ahora las colinas no son
 * meshes sueltos puestos a ojo, sino relieve del propio terreno — por eso
 * siempre caen a los costados y nunca en el centro (ver `elevation.ts`).
 *
 * El color se mezcla casi del todo con el fondo a propósito: ninguna de las
 * referencias tiene un "piso" a color pleno, y el suelo no debe competir por
 * espacio con lo que se construya encima.
 *
 * Pendiente para la Fase 2: el musgo y el pasto del tercio inferior se
 * instancian sobre esta misma superficie, muestreando `terrainHeight()`.
 */

/** Lado del plano. Con la niebla de cada estación, el borde nunca se ve. */
const SIZE = 300;

function segmentsFor(tier: QualityProfile['tier']): number {
  if (tier === 'low') return 56;
  return tier === 'medium' ? 96 : 128;
}

interface TerrainProps {
  environment: StationEnvironment;
  color: string;
  profile: QualityProfile;
}

export function Terrain({ environment, color, profile }: TerrainProps) {
  const segments = segmentsFor(profile.tier);

  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(SIZE, SIZE, segments, segments);
    const position = geo.attributes.position as BufferAttribute;

    // El mesh se rota −90° en X, así que el eje local Z es el "arriba" del
    // mundo y el local Y es el −Z del mundo. Deformamos en local Z.
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const worldZ = -position.getY(i);
      position.setZ(i, terrainHeight(x, worldZ, environment));
    }

    position.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [environment, segments]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, GROUND_Y, 0]}
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={1} metalness={0} />
    </mesh>
  );
}
