'use client';

import { useEffect, useRef, type RefObject } from 'react';

import type { StationSlug } from '@/config/journey';
import { clamp } from '@/lib/procedural';

import { getLenis, gsap, ScrollTrigger } from './gsap';
import { createArrivalGate, passTramo, resetScrollPath, SCROLL_PATH } from './journeyScroll';
import { registerPresets, TRAMO_EASE } from './presets';

/**
 * El puente entre el scroll de una página de estación y la cámara.
 *
 * Crea dos ScrollTrigger sobre la página que se está viendo: uno para el
 * contenido (de arriba hasta que el tramo asoma) y otro para el tramo (hasta
 * el final). Los dos escriben en `SCROLL_PATH`, que es todo lo que el rig de
 * cámara necesita saber del DOM. Así el scroll y la escena siguen sin llamarse
 * directamente.
 *
 * **La llegada automática.** Al terminar el tramo con scroll hacia abajo se
 * llama a `onArrive`, una sola vez por página y sólo si el tramo estaba armado
 * (`passTramo`, comprobado en `bun run check:path`).
 *
 * Cada estación empieza arriba: al montar, el scroll vuelve a cero. «Atrás»
 * significa desandar el camino, no volver al fondo del tramo.
 */

function unit(value: number): number {
  return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
}

interface JourneyScrollOptions {
  station: StationSlug;
  /** La sección del tramo; vacía en la última estación, que no tiene. */
  tramo: RefObject<HTMLElement | null>;
  /** Falso con modo 静 o movimiento reducido: el scroll no mueve la cámara. */
  enabled: boolean;
  onArrive: () => void;
}

export function useJourneyScroll({ station, tramo, enabled, onArrive }: JourneyScrollOptions): void {
  const arrive = useRef(onArrive);
  useEffect(() => {
    arrive.current = onArrive;
  });

  // Al llegar a una estación, y sólo entonces, el scroll vuelve a cero. Va
  // aparte del efecto de abajo a propósito: activar el modo 静 a mitad de
  // lectura no puede mandar la página arriba.
  useEffect(() => {
    // Con la restauración automática, al volver con «atrás» el navegador
    // devuelve el scroll a donde estaba **después** de que esta página lo
    // ponga a cero: la cámara quedaría en la estación siguiente con la URL de
    // ésta. En este sitio el scroll de cada estación lo gestiona el camino.
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

    resetScrollPath(station);
    getLenis()?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
  }, [station]);

  useEffect(() => {
    if (!enabled) {
      // Sin movimiento el scroll no mueve la cámara: se queda en la estación,
      // no donde la dejó el último avance.
      SCROLL_PATH.content = 0;
      SCROLL_PATH.tramo = 0;
      return;
    }

    // ScrollTrigger guarda el valor que había al registrarse ('auto') y lo
    // repone en cada refresh —que el motor pide en cada cambio de ruta—: el
    // 'manual' de arriba no duraría ni una navegación. Hay que decírselo a él.
    ScrollTrigger.clearScrollMemory('manual');

    registerPresets();
    const ease = gsap.parseEase(TRAMO_EASE);
    const section = tramo.current;

    const content = ScrollTrigger.create({
      start: 0,
      // Hasta que el tramo asoma por abajo. `Math.max(1, …)` evita un rango
      // vacío cuando el contenido cabe en la pantalla.
      end: section ? () => Math.max(1, section.offsetTop - window.innerHeight) : 'max',
      onUpdate: (self) => {
        SCROLL_PATH.content = unit(self.progress);
      },
    });

    const gate = createArrivalGate();

    const walk = section
      ? ScrollTrigger.create({
          trigger: section,
          start: 'top bottom',
          end: 'bottom bottom',
          onUpdate: (self) => {
            const progress = unit(self.progress);
            SCROLL_PATH.tramo = ease(progress);
            // El cartel de la siguiente estación se lee de esta variable en CSS.
            section.style.setProperty('--tramo', progress.toFixed(3));
            if (passTramo(gate, progress, self.direction)) arrive.current();
          },
        })
      : null;

    return () => {
      content.kill();
      walk?.kill();
    };
  }, [station, enabled, tramo]);
}
