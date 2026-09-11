'use client';

import { useEffect } from 'react';

import { detectTier } from '@/scene/quality/tiers';
import { useKyotoStore } from '@/store/useKyotoStore';

/**
 * Puente entre el navegador y el store. No pinta nada.
 *
 * Se monta una sola vez en el layout persistente y se encarga de:
 *   · rehidratar las preferencias guardadas (después del primer render, para
 *     que el HTML estático y el cliente coincidan),
 *   · detectar el tier de calidad,
 *   · seguir `prefers-reduced-motion` en vivo,
 *   · alimentar el parallax de cursor y el detector de inactividad,
 *   · desbloquear el audio en el primer gesto real de la persona.
 */
export function EnvironmentProbe() {
  useEffect(() => {
    const store = useKyotoStore;

    // 1. Preferencias guardadas. Va primero: un override manual de calidad
    //    debe ganarle a la detección automática.
    void store.persist.rehydrate();

    // 2. Tier de calidad.
    store.getState().setDetectedTier(detectTier());

    // 3. prefers-reduced-motion, escuchado en vivo (se puede cambiar sin recargar).
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => store.getState().setSystemReducedMotion(motionQuery.matches);
    syncMotion();
    motionQuery.addEventListener('change', syncMotion);

    // 4. Cursor, normalizado a −1…1 y limitado a una lectura por frame.
    let frame = 0;
    let pendingX = 0;
    let pendingY = 0;
    const flushPointer = () => {
      frame = 0;
      store.getState().setPointer(pendingX, pendingY);
    };
    const onPointerMove = (event: PointerEvent) => {
      pendingX = (event.clientX / window.innerWidth) * 2 - 1;
      pendingY = (event.clientY / window.innerHeight) * 2 - 1;
      frame ||= window.requestAnimationFrame(flushPointer);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    // 5. Inactividad de scroll: a los ~20 s el director de fauna se anima a
    //    soltar una garza o una ardilla (Fase 2).
    const onScroll = () => store.getState().markScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // 6. Audio. Ningún navegador deja sonar nada antes de un gesto; lo único
    //    honesto es esperarlo y no fingir autoplay.
    const unlockAudio = () => store.getState().setAudioUnlocked(true);
    const unlockEvents: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    for (const type of unlockEvents) {
      window.addEventListener(type, unlockAudio, { once: true, passive: true });
    }

    return () => {
      motionQuery.removeEventListener('change', syncMotion);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      for (const type of unlockEvents) window.removeEventListener(type, unlockAudio);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
