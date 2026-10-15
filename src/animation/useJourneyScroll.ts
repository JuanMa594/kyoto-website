'use client';

import { useEffect, useRef, type RefObject } from 'react';

import type { StationSlug } from '@/config/journey';
import { clamp } from '@/lib/procedural';

import { getLenis, ScrollTrigger } from './gsap';
import {
  createArrivalGate,
  passTramo,
  readingProgress,
  resetScrollPath,
  SCROLL_PATH,
  tramoCardOpacity,
  tramoFraction,
  tramoSignOpacity,
} from './journeyScroll';

/**
 * El puente entre el scroll de una página de estación y la cámara.
 *
 * Crea dos ScrollTrigger sobre la página que se está viendo: uno para el
 * contenido (de arriba hasta que el tramo asoma) y otro para el tramo (hasta
 * el final). Los dos escriben en `SCROLL_PATH`, que es todo lo que el rig de
 * cámara necesita saber del DOM. Así el scroll y la escena siguen sin llamarse
 * directamente.
 *
 * **El tramo se camina y se lee.** Cómo avanza la cámara, cuándo aparece cada
 * tarjeta y cuándo el cartel de la siguiente estación lo deciden funciones
 * puras de `journeyScroll.ts` (comprobadas en `bun run check:path`); aquí sólo
 * se escriben sus resultados: en `SCROLL_PATH`, en la opacidad de cada tarjeta
 * (`--card`) y en la del cartel (`--llegada`).
 *
 * **La llegada automática.** Al terminar el tramo con scroll hacia abajo se
 * llama a `onArrive`, una sola vez por página y sólo si el tramo estaba armado
 * (`passTramo`).
 *
 * Cada estación empieza arriba: al llegar, el scroll vuelve a cero. «Atrás»
 * significa desandar el camino, no volver al fondo del tramo.
 */

function unit(value: number): number {
  return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
}

interface JourneyScrollOptions {
  station: StationSlug;
  /** La sección del tramo; vacía en la última estación, que no tiene. */
  tramo: RefObject<HTMLElement | null>;
  /** Cuántas tarjetas tiene el tramo: cada una es una parada de lectura. */
  cards: number;
  /** Lo que se camina en el tramo, en vh (`tramoWalkVh`). */
  walkVh: number;
  /** Falso con modo 静 o movimiento reducido: el scroll no mueve la cámara. */
  enabled: boolean;
  onArrive: () => void;
}

export function useJourneyScroll({
  station,
  tramo,
  cards,
  walkVh,
  enabled,
  onArrive,
}: JourneyScrollOptions): void {
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
    const section = tramo.current;
    const cardNodes = section
      ? Array.from(section.querySelectorAll<HTMLElement>('[data-tramo-card]'))
      : [];

    if (!enabled) {
      // Sin movimiento el scroll no mueve la cámara: se queda en la estación,
      // no donde la dejó el último avance. Y las tarjetas se ven todas, como
      // una lista: se borra la opacidad que les hubiera puesto el scroll.
      SCROLL_PATH.content = 0;
      SCROLL_PATH.tramo = 0;
      cardNodes.forEach((node) => node.style.removeProperty('--card'));
      section?.style.removeProperty('--llegada');
      return;
    }

    // ScrollTrigger guarda el valor que había al registrarse ('auto') y lo
    // repone en cada refresh —que el motor pide en cada cambio de ruta—: el
    // 'manual' de arriba no duraría ni una navegación. Hay que decírselo a él.
    ScrollTrigger.clearScrollMemory('manual');

    const content = ScrollTrigger.create({
      start: 0,
      // Hasta que el tramo asoma por abajo. `Math.max(1, …)` evita un rango
      // vacío cuando el contenido cabe en la pantalla.
      end: section ? () => Math.max(1, section.offsetTop - window.innerHeight) : 'max',
      onUpdate: (self) => {
        // Lo leído se mide dentro del rango del contenido: un salto que lo pasa
        // de largo lo deja en su final, no más allá.
        const range = self.end - self.start;
        const scrolled = clamp(self.scroll() - self.start, 0, range);
        SCROLL_PATH.content = readingProgress(scrolled, range, window.innerHeight);
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
            SCROLL_PATH.tramo = tramoFraction(progress, cards, walkVh);
            cardNodes.forEach((node, index) => {
              node.style.setProperty('--card', tramoCardOpacity(progress, cards, index, walkVh).toFixed(3));
            });
            section.style.setProperty('--llegada', tramoSignOpacity(progress, cards, walkVh).toFixed(3));
            if (passTramo(gate, progress, self.direction)) arrive.current();
          },
        })
      : null;

    return () => {
      content.kill();
      walk?.kill();
    };
  }, [station, enabled, tramo, cards, walkVh]);
}
