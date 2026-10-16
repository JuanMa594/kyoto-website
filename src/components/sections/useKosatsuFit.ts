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
 * proyecta en `KOSATSU.rects` y, si con la cámara de su parada la tabla se ve
 * entera y la letra sale a un tamaño legible (`boardFit`), lleva el bloque encima con `translate` + `scale`
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
    // El alto de cada bloque tal como va sobre la tabla, medido antes de
    // ponerlo: con el alto sin medir, el primer frame se escalaba sólo por el
    // ancho, el siguiente lo medía, la letra bajaba del mínimo y el texto
    // saltaba de la tabla al papel y vuelta. Se mide en una copia invisible,
    // con los estilos de la tabla (el ancho fijo de BLOCK_REM).
    const heights = nodes.map(() => 0);
    const measure = () => {
      nodes.forEach((node, k) => {
        const probe = node.cloneNode(true) as HTMLElement;
        probe.dataset.board = 'on';
        probe.removeAttribute('data-tramo-card');
        probe.removeAttribute('data-sign');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'visibility: hidden; transform: none;';
        node.parentElement?.appendChild(probe);
        heights[k] = probe.offsetHeight;
        probe.remove();
      });
      last.fill('');
    };
    measure();
    // Al cambiar el tamaño de la ventana (o al llegar las fuentes), se vuelve a medir.
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);

    const tick = () => {
      const compact = compactQuery.matches || window.innerHeight >= window.innerWidth;
      nodes.forEach((node, k) => {
        const index = Number(node.dataset.sign);
        const rect = KOSATSU.rects[index];
        // Mientras no se ve, en su sitio de papel: si siguiera a una tabla que
        // queda fuera de la ventana, la página podría desbordar de lado.
        const shown = Number.parseFloat(node.style.getPropertyValue('--card')) > 0.001;
        const place = rect && shown
          ? boardFit({ rect, stop: rect.stop, viewportWidth: window.innerWidth, blockHeight: heights[k]!, live: PATH.live, compact })
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
      window.removeEventListener('resize', measure);
      clear();
    };
  }, [section, enabled]);
}
