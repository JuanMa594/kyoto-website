'use client';

import { useId } from 'react';

import { KANJI_STROKES } from './strokes.generated';

/**
 * Un kanji que se puede dibujar trazo a trazo (Fase 4).
 *
 * Cada carácter es un SVG con el glifo real de Zen Old Mincho (`<text>`) y,
 * en sus defs, una máscara hecha con los trazos de KanjiVG, gruesos, en orden.
 * **La máscara no se aplica por defecto**: el HTML estático y cualquier visita
 * sin entrada ven el texto tal cual. Quien quiera dibujarlo (HomeIntro) pone
 * `mask="url(#…)"` en el `<text>` —el id está en `data-ink-mask`—, lleva el
 * `stroke-dashoffset` de cada trazo de 1 a 0 y al terminar quita la máscara:
 * queda el glifo exacto, sin depender de que la máscara cuadre al píxel.
 *
 * Decorativo: va `aria-hidden`. El texto que se lee está al lado, oculto a la
 * vista (ver la Home).
 */

/**
 * Dónde cae el glifo en la caja de 109 de KanjiVG. Calibrado con los trazos
 * visibles encima: si se cambia de fuente, se recalibra.
 */
const GLYPH = { x: 54.5, y: 92.5, size: 100 } as const;

export function InkKanji({ text, className }: { text: string; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <span className={`ink-kanji${className ? ` ${className}` : ''}`} aria-hidden="true">
      {[...text].map((char, i) => {
        const maskId = `ink-${id}-${i}`;
        return (
          <svg key={i} className="ink-kanji__char" viewBox="0 0 109 109" data-ink-char="">
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="109" height="109">
                {(KANJI_STROKES[char] ?? []).map((d, k) => (
                  <path key={k} d={d} pathLength={1} className="ink-kanji__stroke" data-ink-stroke="" />
                ))}
              </mask>
            </defs>
            <text
              x={GLYPH.x}
              y={GLYPH.y}
              fontSize={GLYPH.size}
              textAnchor="middle"
              className="ink-kanji__glyph"
              data-ink-mask={maskId}
            >
              {char}
            </text>
          </svg>
        );
      })}
    </span>
  );
}
