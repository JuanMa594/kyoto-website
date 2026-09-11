'use client';

import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';

import { getStation } from '@/config/journey';
import { scenePalette } from '@/lib/css-vars';
import { FoundationScene } from '@/scene/FoundationScene';
import {
  selectMotionAllowed,
  selectProfile,
  useKyotoStore,
} from '@/store/useKyotoStore';

/**
 * El único contexto WebGL del sitio. Regla dura del proyecto: nunca dos vivos a
 * la vez (por eso la página de gastronomía, si acaba siendo PIXI, tendrá que
 * desmontar éste antes).
 *
 * La cámara es **observadora, en perspectiva**. Observadora porque la
 * composición es frontal, de cartel; en perspectiva porque es lo que permite
 * parallax real entre las capas en Z. Nunca primera persona.
 */
export default function SceneCanvas() {
  const profile = useKyotoStore(selectProfile);
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const activeStation = useKyotoStore((s) => s.activeStation);

  const station = getStation(activeStation);
  const palette = useMemo(() => scenePalette(), []);

  return (
    <Canvas
      dpr={[profile.dpr[0], profile.dpr[1]]}
      shadows={profile.shadows}
      // Sin movimiento no hay nada que redibujar: en modo 静 o con
      // prefers-reduced-motion el bucle se apaga y la GPU descansa.
      frameloop={motionAllowed ? 'always' : 'demand'}
      gl={{
        antialias: profile.antialias,
        alpha: false,
        powerPreference: 'high-performance',
      }}
      camera={{ fov: 34, near: 0.1, far: 400, position: [0, 1.1, 9.5] }}
    >
      <FoundationScene station={station} palette={palette} profile={profile} />
    </Canvas>
  );
}
