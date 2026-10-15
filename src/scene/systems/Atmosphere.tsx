'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Fog, type DirectionalLight } from 'three';

import { JOURNEY, type Station } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import { lerp } from '@/lib/procedural';
import type { QualityProfile } from '@/scene/quality/tiers';
import { PATH, zoneBlend } from '@/scene/path/journeyPath';

import { INTRO } from './intro';

/**
 * El aire del camino: el fondo, la niebla y el sol.
 *
 * Lo decide **dónde está la cámara**, no la ruta: al viajar de la Home a Gion
 * la luz pasa por el rosa de la sakura y el rojo de Fushimi Inari antes de
 * llegar al ámbar del anochecer. Todo se mezcla por los mismos pesos de zona
 * que el relieve y el color del suelo, y se escribe cada frame directamente en
 * la escena, sin estado de React: son sesenta cambios por segundo.
 */

/** Mezcla un color base con el tinte de cielo de la estación, si lo tiene. */
function tinted(base: string, station: Station): Color {
  const color = new Color(base);
  const tint = station.environment.skyTint;
  return tint ? color.lerp(new Color(tint.color), tint.amount) : color;
}

interface AtmosphereProps {
  palette: ScenePalette;
  profile: QualityProfile;
}

export function Atmosphere({ palette, profile }: AtmosphereProps) {
  const scene = useThree((state) => state.scene);

  // El fondo y la niebla llevan el tinte de cada estación: es lo que hace que
  // Fushimi Inari se sienta cálido y Gion al anochecer, sin cambiar de escena.
  const tones = useMemo(
    () =>
      JOURNEY.map((station) => ({
        sky: tinted(palette.washi, station),
        fog: tinted(palette.washiFog, station),
      })),
    [palette],
  );
  const fog = useMemo(() => new Fog(palette.washiFog, 18, 90), [palette.washiFog]);
  const background = useMemo(() => new Color(palette.washi), [palette.washi]);

  // Antes del primer frame: los materiales se compilan sabiendo que hay niebla.
  useLayoutEffect(() => {
    scene.fog = fog;
    scene.background = background;
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene, fog, background]);

  useFrame(() => {
    const zone = zoneBlend(PATH.d);
    const from = JOURNEY[zone.from]!;
    const to = JOURNEY[zone.to]!;

    background.lerpColors(tones[zone.from]!.sky, tones[zone.to]!.sky, zone.t);
    fog.color.lerpColors(tones[zone.from]!.fog, tones[zone.to]!.fog, zone.t);
    // La entrada de la Home abre la bruma: INTRO.fog va de casi 0 a 1.
    const reveal = INTRO.fog;
    const near = lerp(from.ambient.fog.near, to.ambient.fog.near, zone.t) * profile.fogScale;
    const far = lerp(from.ambient.fog.far, to.ambient.fog.far, zone.t) * profile.fogScale;
    fog.near = near * reveal;
    fog.far = Math.max(fog.near + 0.5, far * reveal);
  });

  return null;
}

/** Desde dónde llega la luz, respecto del punto que ilumina: rasante, por la izquierda. */
const SUN_OFFSET: [number, number, number] = [-6, 7, 4];

/**
 * La luz rasante de las referencias, que da relieve a las caras planas de las
 * piedras. **Sigue a la cámara**: apunta siempre al origen del encuadre local,
 * que es donde apuntaba en la Fase 1, y su caja de sombras (±12) viaja con
 * ella. Fija en el origen del mundo, las sombras desaparecerían al avanzar.
 */
export function Sun({ palette, profile }: AtmosphereProps) {
  const light = useRef<DirectionalLight>(null);

  useFrame(() => {
    const node = light.current;
    if (!node) return;

    const frame = PATH.frame;
    node.target.position.set(frame.x, frame.y, frame.z);
    node.position.set(frame.x + SUN_OFFSET[0], frame.y + SUN_OFFSET[1], frame.z + SUN_OFFSET[2]);
    // El objetivo no cuelga de la escena: su matriz hay que actualizarla a mano.
    node.target.updateMatrixWorld();
  });

  return (
    <directionalLight
      ref={light}
      position={SUN_OFFSET}
      intensity={1.9}
      color={palette.washi}
      castShadow={profile.shadows}
      shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-12}
      shadow-camera-right={12}
      shadow-camera-top={12}
      shadow-camera-bottom={-12}
    />
  );
}
