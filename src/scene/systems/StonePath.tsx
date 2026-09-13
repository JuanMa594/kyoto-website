'use client';

import { useMemo } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';

import type { StationEnvironment } from '@/config/journey';
import { mulberry32 } from '@/lib/procedural';
import { Stone } from '@/scene/objects/Stone';
import type { QualityProfile } from '@/scene/quality/tiers';

import { GROUND_Y, terrainHeight } from './elevation';

/**
 * El camino de piedras.
 *
 * No es una fuga recta hacia el punto de fuga: es una **curva en S** que entra
 * por la esquina inferior derecha, cruza hacia la izquierda y vuelve al centro
 * al fondo, como en `3.png`. Una recta perfecta delata la geometría; la S se
 * lee como un sendero.
 *
 * Cada piedra se apoya sobre `terrainHeight()`, la misma función que dibuja el
 * suelo, así que en las estaciones con pendiente (Fushimi Inari) el camino sube
 * de verdad en vez de flotar.
 *
 * En la Fase 3 esta curva local la reemplaza el spline del viaje completo —el
 * que recorre las siete estaciones y por el que viaja la cámara—, pero la
 * técnica (curva → muestreo → instancias apoyadas en el terreno) se queda.
 */

/** Puntos de control de la S, en XZ. La Y la pone el terreno. */
const CONTROL_POINTS = [
  new Vector3(4.6, 0, 1.4),
  new Vector3(2.6, 0, -2.4),
  new Vector3(-1.2, 0, -5.2),
  new Vector3(-2.8, 0, -8.6),
  new Vector3(-1.0, 0, -12.0),
  new Vector3(1.2, 0, -15.4),
];

/** Escala de la piedra más cercana y de la más lejana. */
const SCALE_NEAR = 0.86;
const SCALE_FAR = 0.52;

interface StonePathProps {
  environment: StationEnvironment;
  color: string;
  profile: QualityProfile;
}

interface StoneSpec {
  seed: number;
  position: [number, number, number];
  scale: number;
  rotation: number;
}

export function StonePath({ environment, color, profile }: StonePathProps) {
  const stones = useMemo<StoneSpec[]>(() => {
    const curve = new CatmullRomCurve3(CONTROL_POINTS, false, 'catmullrom', 0.5);
    const random = mulberry32(1204);
    const count = profile.tier === 'low' ? 9 : 14;

    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      const point = curve.getPointAt(t);

      // Un poco de desorden lateral: un camino real no está alineado a hilo.
      const x = point.x + (random() - 0.5) * 0.55;
      const z = point.z + (random() - 0.5) * 0.35;

      const scale = (SCALE_NEAR + (SCALE_FAR - SCALE_NEAR) * t) * (0.88 + random() * 0.24);

      return {
        seed: 100 + i * 37,
        // Ligeramente enterradas: pisaderas, no peñascos apoyados encima.
        position: [x, GROUND_Y + terrainHeight(x, z, environment) - 0.12 * scale, z],
        scale,
        rotation: random() * Math.PI * 2,
      };
    });
  }, [environment, profile.tier]);

  const detail = profile.tier === 'low' ? 0 : 1;

  return (
    <>
      {stones.map((stone) => (
        <Stone
          key={stone.seed}
          seed={stone.seed}
          position={stone.position}
          scale={stone.scale}
          rotation={stone.rotation}
          color={color}
          detail={detail}
        />
      ))}
    </>
  );
}
