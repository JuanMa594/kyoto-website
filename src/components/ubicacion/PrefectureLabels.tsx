'use client';

import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';

import { MAQUETA } from '@/scene/objects/maqueta/input';
import { PREFECTURE_NAMES } from '@/scene/objects/maqueta/names.generated';

import {
  cursorAnchor,
  cursorRect,
  layoutLabels,
  nearestOnRect,
  ringLayout,
  type RingItem,
  type LabelBox,
  type LabelRect,
} from './labelLayout';

/** Media anchura del pin en px, por cada px de alto (la gota es más alta que ancha). */
const PIN_ASPECT = 0.36;

/**
 * Retoques a ojo del corro del zoom (revisión de la 5A): Ōsaka, un poco más
 * abajo; Wakayama, junto a su prefectura, hacia el mar del oeste, para que no
 * quede a la altura de Nara.
 */
const RING_TOUCH: Partial<Record<number, Pick<RingItem, 'aim' | 'turn' | 'near'>>> = Object.fromEntries(
  (
    [
      ['Ōsaka', { aim: Math.PI - 0.12 }],
      ['Wakayama', { turn: 0.85, near: true }],
    ] as const
  ).map(([name, touch]) => [PREFECTURE_NAMES.findIndex((p) => p.name === name), touch]),
);

/**
 * Los nombres de las prefecturas sobre la maqueta (Fase 5A): el de la que
 * está bajo el cursor y, en el zoom, los de Kinki. Son DOM —Gaze Nozarashi,
 * no texto en el canvas—, pero decorativos (`aria-hidden`): lo que importa se
 * lee en el cartel.
 *
 * Cada frame, un callback de `gsap.ticker` (fuera de React) toma lo que la
 * escena proyecta en `MAQUETA` y reparte las etiquetas: ninguna pisa a otra
 * ni al pin, y la que queda lejos de su prefectura se une a ella con una línea
 * de tinta. Las de Kinki en el zoom van en corro alrededor del grupo
 * (`ringLayout`), todas con su línea; no atienden al cursor y, terminado el
 * zoom, se quedan en su sitio.
 */
export function PrefectureLabels() {
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const leaders = useRef<(SVGLineElement | null)[]>([]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    const count = PREFECTURE_NAMES.length;
    const shown = new Uint8Array(count);
    const slots = new Int8Array(count).fill(-1);
    // El corro del zoom, fijado al terminar el zoom: lo que se aparta cada
    // nombre de su punto. Desde ahí ya no se recalcula —ni el pin, que flota,
    // lo empuja—; sólo sigue al mapa.
    const offsetX = new Float32Array(count);
    const offsetY = new Float32Array(count);
    const locked = { on: false, w: 0, h: 0 };
    const sizes: ({ w: number; h: number } | null)[] = Array.from({ length: count }, () => null);

    const hideLeader = (i: number) => {
      leaders.current[i]?.setAttribute('visibility', 'hidden');
      dots.current[i]?.setAttribute('visibility', 'hidden');
    };
    const box = (i: number, anchor = { ax: MAQUETA.labelX[i]!, ay: MAQUETA.labelY[i]! }): LabelBox => {
      const label = labels.current[i]!;
      sizes[i] ??= { w: label.offsetWidth, h: label.offsetHeight };
      return { ...anchor, w: sizes[i].w, h: sizes[i].h };
    };
    const draw = (i: number, item: LabelBox, x: number, y: number, leader: boolean) => {
      labels.current[i]!.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const line = leaders.current[i];
      const dot = dots.current[i];
      if (!line || !dot) return;
      if (!leader) {
        hideLeader(i);
        return;
      }
      // Del punto al borde más cercano de la etiqueta, con el punto marcado.
      const [ex, ey] = nearestOnRect({ x, y, w: item.w, h: item.h }, item.ax, item.ay);
      line.setAttribute('x1', String(item.ax));
      line.setAttribute('y1', String(item.ay));
      line.setAttribute('x2', String(ex));
      line.setAttribute('y2', String(ey));
      line.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', String(item.ax));
      dot.setAttribute('cy', String(item.ay));
      dot.setAttribute('visibility', 'visible');
    };

    const tick = () => {
      const zoom: number[] = [];
      const loose: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const label = labels.current[i];
        if (!label) continue;
        const on = MAQUETA.labelOn[i] ?? 0;
        if (on !== shown[i]) {
          if (!on !== !shown[i]) label.dataset.on = on ? 'true' : 'false';
          shown[i] = on;
          slots[i] = -1;
        }
        if (on === 2) zoom.push(i);
        else if (on === 1) loose.push(i);
        else hideLeader(i);
      }

      const obstacles: LabelRect[] = [];
      if (MAQUETA.pin.on) {
        const height = MAQUETA.pin.bottom - MAQUETA.pin.top;
        const half = height * PIN_ASPECT;
        obstacles.push({ x: MAQUETA.pin.x - half, y: MAQUETA.pin.top, w: half * 2, h: height });
      }

      // Los de Kinki en el zoom, en corro alrededor del grupo: no les importa
      // el cursor, así que pasar el ratón no los mueve. Se fijan al terminar el
      // zoom y se sueltan al salir de él o si cambia la ventana.
      const ringRects: LabelRect[] = [];
      if (zoom.length > 0) {
        const settled = MAQUETA.zoomT === 1;
        if (!settled || locked.w !== window.innerWidth || locked.h !== window.innerHeight) locked.on = false;
        const items = zoom.map((i) => ({ ...box(i), seed: i, ...RING_TOUCH[i] }));
        const at = (k: number, x: number, y: number) => {
          const i = zoom[k]!;
          draw(i, items[k]!, x, y, true);
          ringRects.push({ x, y, w: items[k]!.w, h: items[k]!.h });
        };
        if (locked.on) {
          items.forEach((item, k) => at(k, item.ax + offsetX[zoom[k]!]!, item.ay + offsetY[zoom[k]!]!));
        } else {
          ringLayout(items, obstacles, MAQUETA.frame).forEach((place, k) => {
            const i = zoom[k]!;
            offsetX[i] = place.x - items[k]!.ax;
            offsetY[i] = place.y - items[k]!.ay;
            at(k, place.x, place.y);
          });
          if (settled) Object.assign(locked, { on: true, w: window.innerWidth, h: window.innerHeight });
        }
      } else {
        locked.on = false;
      }
      if (loose.length === 0) return;

      // El de la prefectura bajo el cursor. Fuera del zoom, con ratón, cuelga
      // del cursor por debajo de la flecha, sin línea: su punto es el cursor.
      // En el zoom (Kyoto) va quieto junto a su prefectura, con su línea, sin
      // apartar al corro; esquiva el cursor sólo al aparecer, y luego se queda.
      const inZoom = zoom.length > 0;
      const pointer = MAQUETA.pointer.present
        ? {
            x: ((MAQUETA.pointer.x + 1) / 2) * window.innerWidth,
            y: ((1 - MAQUETA.pointer.y) / 2) * window.innerHeight,
          }
        : null;
      const hang = pointer !== null && !inZoom;
      const arriving = loose.some((i) => slots[i]! < 0);
      if (pointer && (hang || arriving)) obstacles.push(cursorRect(pointer.x, pointer.y));
      const items = loose.map((i) => box(i, hang ? cursorAnchor(pointer.x, pointer.y) : undefined));
      const placed = layoutLabels(
        items,
        [...obstacles, ...ringRects],
        loose.map((i) => slots[i]!),
      );
      placed.forEach((place, k) => {
        const i = loose[k]!;
        slots[i] = place.slot;
        draw(i, items[k]!, place.x, place.y, inZoom || (place.leader && !hang));
      });
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  return (
    <div className="pref-labels" aria-hidden="true">
      <svg className="pref-labels__leaders">
        {PREFECTURE_NAMES.map((prefecture, i) => (
          <g key={prefecture.name}>
            <line
              ref={(element) => {
                leaders.current[i] = element;
              }}
              visibility="hidden"
            />
            <circle
              ref={(element) => {
                dots.current[i] = element;
              }}
              r={2.6}
              visibility="hidden"
            />
          </g>
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
