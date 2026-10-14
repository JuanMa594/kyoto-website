'use client';

import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';

import { MAQUETA } from '@/scene/objects/maqueta/input';
import { PREFECTURE_NAMES } from '@/scene/objects/maqueta/names.generated';

import { cursorAnchor, cursorRect, layoutLabels, type LabelBox, type LabelRect } from './labelLayout';

/** Media anchura del pin en px, por cada px de alto (la gota es más alta que ancha). */
const PIN_ASPECT = 0.36;

/**
 * Los nombres de las prefecturas sobre la maqueta (Fase 5A): el de la que
 * está bajo el cursor y, en el zoom, los de Kinki. Son DOM —Gaze Nozarashi,
 * no texto en el canvas—, pero decorativos (`aria-hidden`): lo que importa se
 * lee en el cartel.
 *
 * Cada frame, un callback de `gsap.ticker` (fuera de React) toma lo que la
 * escena proyecta en `MAQUETA` y reparte las etiquetas con `layoutLabels`: la
 * que está bajo el cursor manda, ninguna pisa a otra ni al pin, y la que queda
 * lejos de su prefectura se une a ella con una línea de tinta.
 */
export function PrefectureLabels() {
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const leaders = useRef<(SVGLineElement | null)[]>([]);

  useEffect(() => {
    const count = PREFECTURE_NAMES.length;
    const shown = new Uint8Array(count);
    const slots = new Int8Array(count).fill(-1);
    const sizes: ({ w: number; h: number } | null)[] = Array.from({ length: count }, () => null);

    const tick = () => {
      const active: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const label = labels.current[i];
        if (!label) continue;
        const on = MAQUETA.labelOn[i] ?? 0;
        if (on !== shown[i]) {
          shown[i] = on;
          label.dataset.on = on ? 'true' : 'false';
          if (!on) slots[i] = -1;
        }
        if (on) active.push(i);
        else leaders.current[i]?.setAttribute('visibility', 'hidden');
      }
      if (active.length === 0) return;

      // Manda la que está bajo el cursor; después, de arriba abajo.
      active.sort((a, b) =>
        a === MAQUETA.hover ? -1 : b === MAQUETA.hover ? 1 : MAQUETA.labelY[a]! - MAQUETA.labelY[b]!,
      );
      // Con ratón, la de la prefectura bajo el cursor cuelga del cursor, por
      // debajo de la flecha; y la flecha no la pisa ninguna otra.
      const pointer = MAQUETA.pointer.present
        ? {
            x: ((MAQUETA.pointer.x + 1) / 2) * window.innerWidth,
            y: ((1 - MAQUETA.pointer.y) / 2) * window.innerHeight,
          }
        : null;
      const boxes: LabelBox[] = active.map((i) => {
        const label = labels.current[i]!;
        sizes[i] ??= { w: label.offsetWidth, h: label.offsetHeight };
        const anchor =
          pointer && i === MAQUETA.hover
            ? cursorAnchor(pointer.x, pointer.y)
            : { ax: MAQUETA.labelX[i]!, ay: MAQUETA.labelY[i]! };
        return { ...anchor, w: sizes[i].w, h: sizes[i].h };
      });
      const obstacles: LabelRect[] = pointer ? [cursorRect(pointer.x, pointer.y)] : [];
      if (MAQUETA.pin.on) {
        const height = MAQUETA.pin.bottom - MAQUETA.pin.top;
        const half = height * PIN_ASPECT;
        obstacles.push({ x: MAQUETA.pin.x - half, y: MAQUETA.pin.top, w: half * 2, h: height });
      }
      const placed = layoutLabels(
        boxes,
        obstacles,
        active.map((i) => slots[i]!),
      );

      placed.forEach((place, k) => {
        const i = active[k]!;
        const box = boxes[k]!;
        slots[i] = place.slot;
        labels.current[i]!.style.transform = `translate3d(${place.x}px, ${place.y}px, 0)`;
        const leader = leaders.current[i];
        if (!leader) return;
        // La que cuelga del cursor no lleva línea: su punto es el cursor.
        if (!place.leader || (pointer && i === MAQUETA.hover)) {
          leader.setAttribute('visibility', 'hidden');
          return;
        }
        // Del punto al borde más cercano de la etiqueta.
        const ex = Math.min(Math.max(box.ax, place.x), place.x + box.w);
        const ey = Math.min(Math.max(box.ay, place.y), place.y + box.h);
        leader.setAttribute('x1', String(box.ax));
        leader.setAttribute('y1', String(box.ay));
        leader.setAttribute('x2', String(ex));
        leader.setAttribute('y2', String(ey));
        leader.setAttribute('visibility', 'visible');
      });
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  return (
    <div className="pref-labels" aria-hidden="true">
      <svg className="pref-labels__leaders">
        {PREFECTURE_NAMES.map((prefecture, i) => (
          <line
            key={prefecture.name}
            ref={(element) => {
              leaders.current[i] = element;
            }}
            visibility="hidden"
          />
        ))}
      </svg>
      {PREFECTURE_NAMES.map((prefecture, i) => (
        <span
          key={prefecture.name}
          ref={(element) => {
            labels.current[i] = element;
          }}
          className="pref-label"
          data-on="false"
        >
          {prefecture.name}
          <span lang="ja" className="pref-label__ja">
            {prefecture.nameJa}
          </span>
        </span>
      ))}
    </div>
  );
}
