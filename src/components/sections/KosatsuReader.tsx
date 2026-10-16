'use client';

import { useEffect, useRef } from 'react';

import { getLenis } from '@/animation/gsap';
import type { OldMap } from '@/config/journey';
import { MAP_SIZE } from '@/scene/objects/kosatsu/kosatsu';

export interface ReaderCard {
  readonly title: string;
  readonly body: string;
  readonly map?: OldMap;
  readonly mapAlt?: string;
}

/**
 * La tarjeta de lectura de un kōsatsu (Fase 5B): el texto y el mapa en grande,
 * cuando la persona toca la tabla. Lo de la tabla se ve en el camino; esto es
 * para leerlo con calma, y sólo si se pide.
 *
 * Es un `<dialog>` modal nativo: atrapa el foco, se cierra con Escape, con el
 * botón o tocando fuera, y al cerrarse devuelve el foco a la tabla. Mientras
 * está abierto el scroll se detiene (Lenis): el camino no avanza por detrás.
 */
export function KosatsuReader({
  card,
  onClose,
  closeLabel,
}: {
  card: ReaderCard | null;
  onClose: () => void;
  closeLabel: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (card && !node.open) {
      node.showModal();
      getLenis()?.stop();
    } else if (!card && node.open) {
      node.close();
    }
  }, [card]);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const closed = () => {
      getLenis()?.start();
      close.current();
    };
    node.addEventListener('close', closed);
    return () => {
      node.removeEventListener('close', closed);
      // Si la página se va con la lectura abierta, el scroll no puede quedar parado.
      if (node.open) node.close();
      getLenis()?.start();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="kosatsu-reader"
      aria-labelledby="kosatsu-reader-title"
      // Tocar el fondo (fuera de la hoja) cierra.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      {card && (
        <div className="kosatsu-reader__sheet paper" data-map={card.map ? 'on' : 'off'}>
          {card.map && (
            <div className="kosatsu-reader__map">
              <img
                src={`/maps/${card.map}.svg`}
                alt={card.mapAlt ?? ''}
                width={MAP_SIZE[card.map].width}
                height={MAP_SIZE[card.map].height}
              />
            </div>
          )}
          <div className="kosatsu-reader__text">
            <h2 id="kosatsu-reader-title" className="kosatsu-reader__title">
              {card.title}
            </h2>
            <p className="kosatsu-reader__body">{card.body}</p>
          </div>
          <button type="button" className="kosatsu-reader__close" onClick={() => dialog.current?.close()}>
            {closeLabel}
          </button>
        </div>
      )}
    </dialog>
  );
}
