'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { TRAVEL } from '@/animation/travel';

/**
 * La entrada del contenido de una estación.
 *
 * La primera página de la visita se ve tal cual llega del HTML estático: nada
 * se esconde a quien entra, ni a los buscadores, ni a quien no tiene JS. Las
 * siguientes entran con un fundido; y si la cámara viene de lejos, el
 * contenido **espera a que el viaje entre en su último tramo**, para que el
 * recorrido se vea limpio y no tapado por el texto que llega.
 *
 * Va con `key={slug}` en cada página: así se monta de nuevo en cada estación,
 * también entre dos lugares que comparten plantilla. (Un `template.tsx` no
 * serviría: sólo se vuelve a montar cuando cambia su propio segmento, y
 * `/lugares/fushimi-inari` y `/lugares/gion` comparten `lugares`.)
 */

/** Falso hasta que la primera página de la visita ha montado. */
let hydrated = false;

/** El contenido aparece cuando al viaje le queda menos de esta fracción. */
const REVEAL_AT = 0.4;
/** Por si algo se queda colgado: nunca más de esto sin contenido. */
const REVEAL_TIMEOUT = 4500;

export function ContentArrival({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'shown' | 'pending'>(() => (hydrated ? 'pending' : 'shown'));

  useEffect(() => {
    hydrated = true;
  }, []);

  useEffect(() => {
    if (state !== 'pending') return;

    const started = performance.now();
    let frames = 0;
    let raf = 0;

    const check = () => {
      frames += 1;
      // Dos frames de gracia: el viaje lo arranca el rig cuando ve la estación
      // nueva, un instante después de que esta página monte.
      const traveling = TRAVEL.span > 0 && Math.abs(TRAVEL.offset) > TRAVEL.span * REVEAL_AT;
      if (frames > 2 && (!traveling || performance.now() - started > REVEAL_TIMEOUT)) {
        setState('shown');
        return;
      }
      raf = window.requestAnimationFrame(check);
    };

    raf = window.requestAnimationFrame(check);
    return () => window.cancelAnimationFrame(raf);
  }, [state]);

  return (
    <div className="content-arrival" data-arrival={state}>
      {children}
    </div>
  );
}
