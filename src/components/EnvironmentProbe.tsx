'use client';

import { useEffect } from 'react';

import { clamp } from '@/lib/procedural';
import { detectTier } from '@/scene/quality/tiers';
import { useKyotoStore } from '@/store/useKyotoStore';

/**
 * iOS expone `DeviceOrientationEvent.requestPermission()`; el resto de
 * navegadores, no. Su presencia es la forma estándar de detectar que hace falta
 * un permiso explícito, y la lib del DOM no la declara.
 */
interface DeviceOrientationConstructor {
  requestPermission?: () => Promise<PermissionState>;
}

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

    // 4b. Giroscopio: en un móvil no hay cursor, así que el parallax lo mueve la
    //     inclinación del aparato. Escribe en el mismo sitio que el puntero, de
    //     modo que el rig de cámara no se entera de cuál de los dos manda.
    //
    //     En iOS haría falta `DeviceOrientationEvent.requestPermission()`, que
    //     exige un gesto y abre un diálogo del sistema. Pedirlo en el primer
    //     toque sería una ventana emergente sin contexto, así que allí el giro
    //     queda apagado hasta que haya un interruptor explícito (PLAN §11).
    const orientation = window.DeviceOrientationEvent as unknown as
      | DeviceOrientationConstructor
      | undefined;
    const gyroAvailable = Boolean(orientation) && typeof orientation?.requestPermission !== 'function';

    const onOrientation = (event: DeviceOrientationEvent) => {
      // gamma: giro izquierda/derecha. beta: inclinación adelante/atrás, con el
      // centro en 45°, que es como se sostiene un teléfono al leer.
      pendingX = clamp((event.gamma ?? 0) / 25, -1, 1);
      pendingY = clamp(((event.beta ?? 45) - 45) / 25, -1, 1);
      frame ||= window.requestAnimationFrame(flushPointer);
    };

    if (gyroAvailable) {
      window.addEventListener('deviceorientation', onOrientation, { passive: true });
    }

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
      if (gyroAvailable) window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('scroll', onScroll);
      for (const type of unlockEvents) window.removeEventListener(type, unlockAudio);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
