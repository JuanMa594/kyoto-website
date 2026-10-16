'use client';

import { gsap } from 'gsap';
import { useEffect, type RefObject } from 'react';

import { NAV_MOBILE_QUERY } from '@/components/nav/navQuery';
import { KOSATSU } from '@/scene/objects/kosatsu/kosatsu';
import { PATH } from '@/scene/path/journeyPath';

import { boardFit } from './kosatsuFit';

/**
 * El texto de cada tarjeta con cartel, encajado sobre la tabla de su kōsatsu
 * (Fase 5B). Un callback de `gsap.ticker` (fuera de React) lee lo que la escena
 * proyecta en `KOSATSU.rects` y, si la tabla se ve entera y la letra sale a un
 * tamaño legible (`boardFit`), lleva el bloque encima con `translate` + `scale`
 * y lo marca `data-board="on"`; si no, `off`, y el CSS lo deja como la tarjeta
 * de papel de siempre. La opacidad la sigue llevando el tramo (`--card`).
 *
 * Sin movimiento (`enabled` falso) no hace nada: el tramo es la lista.
 */
export function useKosatsuFit(section: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-sign]'));
    if (nodes.length === 0) return;

    const clear = () => {
      for (const node of nodes) {
        delete node.dataset.board;
        node.style.removeProperty('transform');
      }
    };
    if (!enabled) {
      clear();
      return;
    }

    const compactQuery = window.matchMedia(NAV_MOBILE_QUERY);
    const last = nodes.map(() => '');
    const heights = nodes.map(() => 0);
    // Al cambiar el tamaño de la ventana (o las fuentes), se vuelve a medir.
    const remeasure = () => heights.fill(0);
    window.addEventListener('resize', remeasure);
    void document.fonts?.ready.then(remeasure);

    const tick = () => {
      const compact = compactQuery.matches || window.innerHeight >= window.innerWidth;
      nodes.forEach((node, k) => {
        const index = Number(node.dataset.sign);
        const rect = KOSATSU.rects[index];
        // El alto del bloque sin escalar: sólo se mide sobre la tabla (en la
        // tarjeta de papel tiene otro ancho), y una vez.
        if (node.dataset.board === 'on' && heights[k] === 0) heights[k] = node.offsetHeight;
        const place = rect
          ? boardFit({ rect, viewportWidth: window.innerWidth, blockHeight: heights[k]!, live: PATH.live, compact })
          : null;
        const next = place ? `${place.x.toFixed(1)},${place.y.toFixed(1)},${place.scale.toFixed(4)}` : 'off';
        if (next === last[k]) return;
        last[k] = next;
        if (!place) {
          node.dataset.board = 'off';
          node.style.removeProperty('transform');
          return;
        }
        node.dataset.board = 'on';
        node.style.transform = `translate3d(${place.x.toFixed(1)}px, ${place.y.toFixed(1)}px, 0) scale(${place.scale.toFixed(4)})`;
      });
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', remeasure);
      clear();
    };
  }, [section, enabled]);
}
