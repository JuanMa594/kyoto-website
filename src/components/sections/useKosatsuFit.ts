'use client';

import { gsap } from 'gsap';
import { useEffect, type RefObject } from 'react';

import { KOSATSU } from '@/scene/objects/kosatsu/kosatsu';
import { PATH } from '@/scene/path/journeyPath';

import { boardFit } from './kosatsuFit';

/**
 * El texto de cada tarjeta con cartel, encajado sobre la tabla de su kōsatsu
 * (Fase 5B). Un callback de `gsap.ticker` (fuera de React) lee lo que la escena
 * proyecta en `KOSATSU.rects` y, si con la cámara de su parada la tabla se ve
 * entera (`boardFit`), lleva el bloque encima con `translate` + `scale` y lo
 * marca `data-board="on"`; si no, `off`, y el CSS lo deja como la tarjeta de
 * papel de siempre. La opacidad la sigue llevando el tramo (`--card`).
 *
 * Mientras el texto va sobre la tabla, su botón (`[data-hit]`) la cubre entera,
 * con el mapa: un clic abre la tarjeta de lectura (`KosatsuReader`). El canvas
 * no captura el puntero; lo que se toca es DOM.
 *
 * Sin movimiento (`enabled` falso) no hace nada: el tramo es la lista.
 */
export function useKosatsuFit(section: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-sign]'));
    if (nodes.length === 0) return;
    const hits = nodes.map((node) => root.querySelector<HTMLElement>(`[data-hit="${node.dataset.sign}"]`));

    const hideHit = (hit: HTMLElement | null) => {
      if (!hit) return;
      hit.dataset.on = 'off';
      hit.tabIndex = -1;
    };
    const clear = () => {
      nodes.forEach((node, k) => {
        delete node.dataset.board;
        node.style.removeProperty('transform');
        hideHit(hits[k]!);
      });
    };
    if (!enabled) {
      clear();
      return;
    }

    const last = nodes.map(() => '');
    // El alto de cada bloque tal como va sobre la tabla, medido antes de
    // ponerlo: con el alto sin medir, el primer frame se escalaba sólo por el
    // ancho, el siguiente lo medía y el bloque cambiaba de tamaño. Se mide en
    // una copia invisible, con los estilos de la tabla (el ancho de BLOCK_REM).
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
      const portrait = window.innerHeight >= window.innerWidth;
      nodes.forEach((node, k) => {
        const index = Number(node.dataset.sign);
        const rect = KOSATSU.rects[index];
        const hit = hits[k]!;
        const card = node.style.getPropertyValue('--card');
        // Mientras no se ve, en su sitio de papel: si siguiera a una tabla que
        // queda fuera de la ventana, la página podría desbordar de lado.
        const shown = Number.parseFloat(card) > 0.001;
        const place = rect && shown
          ? boardFit({ rect, stop: rect.stop, viewportWidth: window.innerWidth, blockHeight: heights[k]!, live: PATH.live, portrait })
          : null;
        const next = place && rect
          ? `${place.x.toFixed(1)},${place.y.toFixed(1)},${place.scale.toFixed(4)},${rect.boardY.toFixed(1)},${card}`
          : 'off';
        if (next === last[k]) return;
        last[k] = next;
        if (!place || !rect) {
          node.dataset.board = 'off';
          node.style.removeProperty('transform');
          hideHit(hit);
          return;
        }
        node.dataset.board = 'on';
        node.style.transform = `translate3d(${place.x.toFixed(1)}px, ${place.y.toFixed(1)}px, 0) scale(${place.scale.toFixed(4)})`;
        if (hit) {
          // La tabla entera, con el marco y el mapa: lo que se puede tocar.
          hit.dataset.on = 'on';
          hit.tabIndex = 0;
          hit.style.transform = `translate3d(${rect.boardX.toFixed(1)}px, ${rect.boardY.toFixed(1)}px, 0)`;
          hit.style.width = `${rect.boardW.toFixed(1)}px`;
          hit.style.height = `${rect.boardH.toFixed(1)}px`;
          hit.style.setProperty('--card', card);
        }
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
