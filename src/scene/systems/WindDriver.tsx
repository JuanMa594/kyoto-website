'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';

import { blendByZone, PATH } from '@/scene/path/journeyPath';

import { resetSway, updateSway } from './sway';
import { resetWind, updateWind } from './WindField';

/**
 * El único que hace avanzar el viento. Va dentro del `<Canvas>` para compartir
 * el reloj de la escena: así el viento que empuja una hoja es exactamente el
 * mismo que dibujó ese frame, sin desfase de un frame entre sistemas.
 *
 * El viento **base** es el de la zona en la que está la cámara, mezclado con la
 * vecina: al caminar hacia Gion la brisa se va calmando, no se corta.
 *
 * Con el bucle en `demand` (modo 静 o `prefers-reduced-motion`) `useFrame` no
 * se ejecuta, de modo que el aire se queda quieto solo. El efecto se encarga
 * además de borrar la ráfaga que hubiera a medias.
 */
export function WindDriver({ enabled }: { enabled: boolean }) {
  useFrame((_, delta) => {
    if (!enabled) return;
    // Al volver de una pestaña en segundo plano el delta puede valer varios
    // segundos; sin tope, la máquina de ráfagas saltaría medio ciclo de golpe.
    updateWind(Math.min(delta, 0.1), blendByZone(PATH.d, (station) => station.ambient.wind));
    // El bambú y los arbustos, con el viento que acaba de soplar.
    updateSway(Math.min(delta, 0.1));
  });

  useEffect(() => {
    if (!enabled) {
      resetWind();
      resetSway();
    }
  }, [enabled]);

  return null;
}
