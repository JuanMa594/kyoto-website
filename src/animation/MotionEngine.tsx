'use client';

import { useEffect } from 'react';

import { usePathname } from '@/i18n/navigation';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { refreshMotionEngine, startMotionEngine, stopMotionEngine } from './gsap';

/**
 * Arranca y apaga el motor de movimiento. No pinta nada.
 *
 * Vive en el layout persistente, junto a `<EnvironmentProbe>` y `<SceneRoot>`,
 * y se enciende o se apaga con una sola pregunta: ¿está permitido el
 * movimiento? Con el modo 静 o con `prefers-reduced-motion` el motor no se
 * queda dando vueltas en vacío — se destruye, y el navegador recupera su scroll
 * de siempre. Es la misma regla que ya apaga el bucle de render del `<Canvas>`.
 *
 * El puente entre el scroll y la cámara no vive aquí sino en cada página de
 * estación (`PathTramo` → `useJourneyScroll`), porque depende de su tramo.
 */
export function MotionEngine() {
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const pathname = usePathname();

  useEffect(() => {
    if (!motionAllowed) return;

    startMotionEngine();
    return () => stopMotionEngine();
  }, [motionAllowed]);

  useEffect(() => {
    if (!motionAllowed) return;

    // El App Router cambia el contenido sin recargar la página, así que la
    // altura del documento cambia sin que Lenis ni ScrollTrigger se enteren.
    // Se mide en el frame siguiente, ya con el DOM nuevo pintado.
    const frame = window.requestAnimationFrame(refreshMotionEngine);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, motionAllowed]);

  return null;
}
