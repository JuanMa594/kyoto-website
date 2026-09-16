'use client';

import { useEffect } from 'react';

import { getStation } from '@/config/journey';
import { selectAudioAudible, useKyotoStore } from '@/store/useKyotoStore';

import { setAudioLayers, setAudioVolume, startAudio, stopAudio, updateAudio } from './engine';

/**
 * El puente entre el store y el motor de sonido. No pinta nada.
 *
 * Tres reglas, y las tres vienen del §9 del PLAN:
 *
 *   · **nunca suena antes de un gesto.** No es una elección de diseño, es que
 *     ningún navegador lo permite: el `AudioContext` nace suspendido hasta que
 *     la persona toca, teclea o hace scroll. La preferencia queda en «sí» desde
 *     el principio y el ambiente entra solo en cuanto hay ese primer gesto;
 *   · **el modo 静 lo apaga entero**, igual que apaga el bucle de render;
 *   · **con la pestaña de fondo se suspende.** Un jardín que sigue sonando
 *     mientras se trabaja en otra ventana es exactamente lo que hace que la
 *     gente silencie una web para siempre.
 *
 * El latido va por `requestAnimationFrame` propio y no por el bucle de la
 * escena, a propósito: con `prefers-reduced-motion` la escena se detiene, pero
 * quien pidió menos movimiento no pidió menos sonido.
 */
export function AmbientAudio() {
  const audible = useKyotoStore(selectAudioAudible);
  const volume = useKyotoStore((s) => s.volume);
  const activeStation = useKyotoStore((s) => s.activeStation);

  useEffect(() => {
    if (!audible) {
      stopAudio();
      return;
    }

    if (!startAudio()) return;

    let frame = 0;
    const tick = () => {
      updateAudio();
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    const onVisibility = () => {
      if (document.hidden) stopAudio();
      else startAudio();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // La rueda del ratón marca intención pero **no cuenta como activación** para
    // los navegadores: quien sólo hace scroll tiene el `AudioContext` creado y
    // suspendido. Al primer clic o tecla de verdad se reanuda.
    const onGesture = () => startAudio();
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      stopAudio();
    };
  }, [audible]);

  useEffect(() => {
    setAudioVolume(volume);
  }, [volume]);

  // Cada zona tiene su paisaje sonoro, declarado en `journey.ts` junto al resto
  // de su ambiente: Gion suena a ciudad y a fuego, Kiyomizu a agua.
  useEffect(() => {
    setAudioLayers(getStation(activeStation).ambient.sounds);
  }, [activeStation]);

  return null;
}
