'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';

import { resetWind, updateWind } from './WindField';

/**
 * El único que hace avanzar el viento. Va dentro del `<Canvas>` para compartir
 * el reloj de la escena: así el viento que empuja una hoja es exactamente el
 * mismo que dibujó ese frame, sin desfase de un frame entre sistemas.
 *
 * Con el bucle en `demand` (modo 静 o `prefers-reduced-motion`) `useFrame` no
 * se ejecuta, de modo que el aire se queda quieto solo. El efecto se encarga
 * además de borrar la ráfaga que hubiera a medias.
 */
export function WindDriver({ base, enabled }: { base: number; enabled: boolean }) {
  useFrame((_, delta) => {
    if (!enabled) return;
    // Al volver de una pestaña en segundo plano el delta puede valer varios
    // segundos; sin tope, la máquina de ráfagas saltaría medio ciclo de golpe.
    updateWind(Math.min(delta, 0.1), base);
  });

  useEffect(() => {
    if (!enabled) resetWind();
  }, [enabled]);

  return null;
}
