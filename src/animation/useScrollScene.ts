'use client';

import { useEffect } from 'react';

import { useKyotoStore } from '@/store/useKyotoStore';

import { ScrollTrigger } from './gsap';

/**
 * Puente entre el scroll y el estado del viaje.
 *
 * Es deliberadamente delgado: lo único que hace es escribir `pathProgress` en
 * el store. Quien decide qué significa ese número es la escena — hoy nadie, en
 * la Fase 3 la cámara, que lo usará para avanzar por el spline del camino. Así
 * el scroll y la escena nunca se llaman directamente: hablan por el store.
 *
 * Se usa un único ScrollTrigger sobre el scroller de la página (`start: 0`,
 * `end: 'max'`) en vez de uno por sección: el camino es continuo, no una lista
 * de tramos, y con un solo trigger no hay que recalcular nada al navegar.
 */
export function useScrollScene(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      // Con el motor apagado el avance deja de tener sentido: se vuelve al
      // punto de partida en vez de dejar un valor viejo congelado.
      useKyotoStore.getState().setPathProgress(0);
      return;
    }

    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        // En una página que no llega a desplazarse, `end` y `start` coinciden y
        // el progreso puede llegar como NaN.
        const progress = Number.isFinite(self.progress) ? self.progress : 0;
        useKyotoStore.getState().setPathProgress(progress);
      },
    });

    return () => trigger.kill();
  }, [enabled]);
}
