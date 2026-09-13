'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';

import { getStation } from '@/config/journey';
import { scenePalette } from '@/lib/css-vars';
import { FoundationScene } from '@/scene/FoundationScene';
import {
  selectMotionAllowed,
  selectProfile,
  useKyotoStore,
} from '@/store/useKyotoStore';

/**
 * Sin esto, la cámara del `<Canvas>` mira perfectamente horizontal (rotación
 * identidad, eje -Z) en vez de inclinarse hacia el camino, y el horizonte
 * queda a media pantalla. Un `lookAt` hacia un punto delante y por debajo del
 * origen da una inclinación suave (~7°) hacia el camino.
 *
 * Dos mandos que conviene no confundir:
 *   · **la altura de la cámara** decide dónde cae el camino en el cuadro
 *     (más alta = las piedras bajan y los objetos altos entran mejor),
 *   · **la inclinación** decide dónde cae el horizonte.
 *
 * Con `y = 4.2` y una inclinación de ~6°, el horizonte queda al 32 % desde
 * arriba: el tercio superior entero libre para copas, hojas y garzas; el medio
 * para el texto y las bases de los objetos; el camino en el tercio inferior.
 *
 * Ojo con inclinarla más: pasados los ~17° el horizonte se sale por el borde
 * superior y se pierde el cielo — y con él, el sitio donde va la decoración.
 * Por eso el `lookAt` apunta lejos (z = −9) y no al origen. En la Fase 3 el rig
 * de scroll hereda estos mismos límites.
 */
function CameraAim() {
  const camera = useThree((state) => state.camera);

  useLayoutEffect(() => {
    camera.lookAt(0, 1.9, -9);
  }, [camera]);

  return null;
}

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
      camera={{ fov: 34, near: 0.1, far: 400, position: [0, 4.2, 13] }}
    >
      <CameraAim />
      <FoundationScene station={station} palette={palette} profile={profile} />
    </Canvas>
  );
}
