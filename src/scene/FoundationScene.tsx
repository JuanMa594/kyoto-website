'use client';

import { useMemo } from 'react';
import { Color } from 'three';

import type { Station } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import type { QualityProfile } from '@/scene/quality/tiers';
import { PetalSystem } from '@/scene/systems/PetalSystem';
import { StonePath } from '@/scene/systems/StonePath';
import { Terrain } from '@/scene/systems/Terrain';

/**
 * Escena de calibración de la Fase 1.
 *
 * No es la escena definitiva: es la prueba de que los cimientos funcionan —
 * cámara en perspectiva, niebla, luz rasante, geometría procedural, relieve por
 * estación y recorte por tier de calidad.
 *
 * **Composición (regla de tercios).** El encuadre está calibrado para que:
 *   · el tercio inferior sea del camino de piedras (y del musgo, en la Fase 2),
 *   · el tercio medio lleve el texto y la base de los objetos —troncos, pies de
 *     torii, faroles—,
 *   · el tercio superior quede despejado para la copa de los cerezos, las hojas
 *     al viento, las nubes y las garzas.
 *
 * El relieve es **modular por estación** (`station.environment`) y sale siempre
 * a los costados: el centro pertenece al sujeto. Ver `systems/elevation.ts`.
 */

interface FoundationSceneProps {
  station: Station;
  palette: ScenePalette;
  profile: QualityProfile;
}

/** Mezcla un color base con el tinte de cielo de la estación, si lo tiene. */
function tinted(base: string, station: Station): Color {
  const color = new Color(base);
  const tint = station.environment.skyTint;
  return tint ? color.lerp(new Color(tint.color), tint.amount) : color;
}

export function FoundationScene({ station, palette, profile }: FoundationSceneProps) {
  const fogNear = station.ambient.fog.near * profile.fogScale;
  const fogFar = station.ambient.fog.far * profile.fogScale;

  // El fondo y la niebla llevan el tinte de la estación: es lo que hace que
  // Fushimi Inari se sienta cálido y Gion al anochecer, sin cambiar de escena.
  const skyColor = useMemo(() => tinted(palette.washi, station), [palette.washi, station]);
  const fogColor = useMemo(() => tinted(palette.washiFog, station), [palette.washiFog, station]);

  // El suelo casi desaparece en el fondo: sólo un 30 % del tinte de la
  // estación sobre el washi. Ninguna referencia tiene un "piso" a color pleno.
  const groundColor = useMemo(
    () => new Color(palette.washi).lerp(new Color(station.palette.ground), 0.3),
    [palette.washi, station.palette.ground],
  );

  return (
    <>
      {/* El fondo es el mismo washi del DOM: el canvas no debe notarse como
          una ventana pegada encima de la página, sino como su continuación. */}
      <color attach="background" args={[skyColor]} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

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

      <Terrain
        environment={station.environment}
        color={`#${groundColor.getHexString()}`}
        profile={profile}
      />

      <StonePath environment={station.environment} color={palette.ishi} profile={profile} />

      {/* Lo que cae del cielo en esta zona, según `station.ambient`: sakura en
          eventos, momiji en los templos, hojas de bambú en la home. Cruzan por
          delante y por detrás del sujeto — es la capa que da la profundidad. */}
      <PetalSystem station={station} palette={palette} />
    </>
  );
}
