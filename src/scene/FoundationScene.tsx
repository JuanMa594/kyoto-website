'use client';

import { useMemo } from 'react';

import type { Station } from '@/config/journey';
import { mulberry32 } from '@/lib/procedural';
import type { ScenePalette } from '@/lib/css-vars';
import { Stone } from '@/scene/objects/Stone';
import type { QualityProfile } from '@/scene/quality/tiers';

/**
 * Escena de calibración de la Fase 1.
 *
 * No es la escena definitiva: es la prueba de que los cimientos funcionan —
 * cámara en perspectiva, niebla que traga el horizonte, luz rasante, piedras
 * procedurales y recorte por tier de calidad.
 *
 * En la Fase 3 la sustituye el camino real sobre el spline; la técnica de las
 * piedras y el tratamiento de la niebla se quedan tal cual.
 */

interface FoundationSceneProps {
  station: Station;
  palette: ScenePalette;
  profile: QualityProfile;
}

interface StoneSpec {
  seed: number;
  position: [number, number, number];
  scale: number;
  rotation: number;
}

export function FoundationScene({ station, palette, profile }: FoundationSceneProps) {
  // El camino se aleja en diagonal: las piedras encogen y se hunden en la
  // niebla, que es lo que hace legible la profundidad sin mover la cámara.
  const stones = useMemo<StoneSpec[]>(() => {
    const random = mulberry32(1204);
    const count = profile.tier === 'low' ? 7 : 12;

    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      return {
        seed: 100 + i * 37,
        position: [
          -3.4 + t * 7 + (random() - 0.5) * 0.7,
          -0.78 + random() * 0.06,
          2.2 - t * 26,
        ],
        scale: 1.15 - t * 0.35 + (random() - 0.5) * 0.18,
        rotation: random() * Math.PI * 2,
      };
    });
  }, [profile.tier]);

  const detail = profile.tier === 'low' ? 0 : 1;
  const fogNear = station.ambient.fog.near * profile.fogScale;
  const fogFar = station.ambient.fog.far * profile.fogScale;

  return (
    <>
      {/* El fondo es el mismo washi del DOM: el canvas no debe notarse como
          una ventana pegada encima de la página, sino como su continuación. */}
      <color attach="background" args={[palette.washi]} />
      <fog attach="fog" args={[palette.washiFog, fogNear, fogFar]} />

      {/* Luz rasante desde la izquierda, como en las referencias: da relieve a
          las caras planas de las piedras sin necesidad de postproceso. */}
      <hemisphereLight args={[palette.washi, palette.ishiDeep, 1.5]} />
      <directionalLight
        position={[-6, 7, 4]}
        intensity={1.9}
        color={palette.washi}
        castShadow={profile.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />

      {/* Suelo. Un plano enorme para que el horizonte lo cierre la niebla y no
          un borde de geometría. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={station.palette.ground} roughness={1} metalness={0} />
      </mesh>

      {stones.map((stone) => (
        <Stone
          key={stone.seed}
          seed={stone.seed}
          position={stone.position}
          scale={stone.scale}
          rotation={stone.rotation}
          color={palette.ishi}
          detail={detail}
        />
      ))}

      {/* Tres bandas de silueta al fondo. Con la niebla encima dan la escala
          del valle a coste casi cero: es el truco de la capa "Fondo" del §5.1. */}
      {[
        { z: -38, height: 7, color: palette.bambu, scale: 1 },
        { z: -58, height: 11, color: palette.ishiDeep, scale: 1.4 },
        { z: -82, height: 16, color: palette.washiFog, scale: 2 },
      ].map((band) => (
        <mesh key={band.z} position={[0, band.height / 2 - 1, band.z]}>
          <cylinderGeometry args={[0, 26 * band.scale, band.height, 5, 1]} />
          <meshBasicMaterial color={band.color} fog />
        </mesh>
      ))}
    </>
  );
}
