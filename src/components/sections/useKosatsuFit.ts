'use client';

import { useEffect, type RefObject } from 'react';

import { KOSATSU } from '@/scene/objects/kosatsu/kosatsu';
import { PATH } from '@/scene/path/journeyPath';

import { boardFit, boardInk, boardVisible } from './kosatsuFit';

/**
 * El texto de cada tarjeta con cartel, encajado sobre la tabla de su kōsatsu
 * (Fase 5B). Cada kōsatsu, justo después de proyectarse, llama a
 * `KOSATSU.place`: así el texto se mueve en el mismo frame que la tabla.
 *
 * Si con la cámara de su parada la tabla se ve entera (`boardVisible`), la
 * tarjeta va sobre ella (`data-board="on"`) durante todo el tramo: se lleva
 * encima con `translate` + `scale` y se ve según lo cerca que esté la tabla
 * (`--legible`, de `boardInk`), no según el scroll. Si no, `off`: la tarjeta de
 * papel de siempre, con la opacidad del tramo (`--card`).
 *
 * Mientras la letra se lee, su botón (`[data-hit]`) cubre la tabla entera, con
 * el mapa: un clic abre la tarjeta de lectura (`KosatsuReader`). El canvas no
 * captura el puntero; lo que se toca es DOM.
 *
 * Sin movimiento (`enabled` falso) no hace nada: el tramo es la lista.
 */

/** Por debajo de esto la letra apenas se ve: la tabla todavía no se toca. */
const HIT_FROM = 0.35;

export function useKosatsuFit(section: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const nodes = new Map<number, HTMLElement>();
    for (const node of root.querySelectorAll<HTMLElement>('[data-sign]')) nodes.set(Number(node.dataset.sign), node);
    if (nodes.size === 0) return;
    const hits = new Map<number, HTMLElement | null>();
    for (const index of nodes.keys()) hits.set(index, root.querySelector<HTMLElement>(`[data-hit="${index}"]`));

    const hideHit = (hit: HTMLElement | null | undefined) => {
      if (!hit || hit.dataset.on === 'off') return;
      hit.dataset.on = 'off';
      hit.tabIndex = -1;
    };
    const clear = () => {
      for (const [index, node] of nodes) {
        delete node.dataset.board;
        node.style.removeProperty('transform');
        node.style.removeProperty('--legible');
        hideHit(hits.get(index));
      }
    };
    if (!enabled) {
      clear();
      return;
    }

    const last = new Map<number, string>();
    // El alto de cada bloque tal como va sobre la tabla, medido antes de
    // ponerlo: con el alto sin medir, el primer frame se escalaba sólo por el
    // ancho, el siguiente lo medía y el bloque cambiaba de tamaño. Se mide en
    // una copia invisible, con los estilos de la tabla (el ancho de BLOCK_REM).
    const heights = new Map<number, number>();
    const measure = () => {
      for (const [index, node] of nodes) {
        const probe = node.cloneNode(true) as HTMLElement;
        probe.dataset.board = 'on';
        probe.removeAttribute('data-tramo-card');
        probe.removeAttribute('data-sign');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'visibility: hidden; transform: none;';
        node.parentElement?.appendChild(probe);
        heights.set(index, probe.offsetHeight);
        probe.remove();
      }
      last.clear();
      for (const index of nodes.keys()) place(index);
    };

    const place = (index: number) => {
      const node = nodes.get(index);
      const rect = KOSATSU.rects[index];
      if (!node || !rect) return;
      const hit = hits.get(index);
      const input = {
        rect,
        stop: rect.stop,
        viewportWidth: window.innerWidth,
        blockHeight: heights.get(index) ?? 0,
        live: PATH.live,
        portrait: window.innerHeight >= window.innerWidth,
      };

      if (!boardVisible(input)) {
        if (last.get(index) === 'off') return;
        last.set(index, 'off');
        node.dataset.board = 'off';
        node.style.removeProperty('transform');
        node.style.removeProperty('--legible');
        hideHit(hit);
        return;
      }

      // Sobre la tabla todo el tramo; lo que se ve lo dice la distancia.
      const placement = boardFit(input);
      const ink = placement && rect.on ? boardInk(rect.distance) : 0;
      const legible = ink.toFixed(3);
      const key = placement && ink > 0
        ? `${placement.x.toFixed(1)},${placement.y.toFixed(1)},${placement.scale.toFixed(4)},${rect.boardY.toFixed(1)},${legible}`
        : 'hidden';
      if (key === last.get(index)) return;
      last.set(index, key);
      node.dataset.board = 'on';
      node.style.setProperty('--legible', legible);
      if (!placement || ink <= 0) {
        hideHit(hit);
        return;
      }
      node.style.transform = `translate3d(${placement.x.toFixed(1)}px, ${placement.y.toFixed(1)}px, 0) scale(${placement.scale.toFixed(4)})`;
      if (!hit) return;
      if (ink < HIT_FROM) {
        hideHit(hit);
        return;
      }
      // La tabla entera, con el marco y el mapa: lo que se puede tocar.
      hit.dataset.on = 'on';
      hit.tabIndex = 0;
      hit.style.transform = `translate3d(${rect.boardX.toFixed(1)}px, ${rect.boardY.toFixed(1)}px, 0)`;
      hit.style.width = `${rect.boardW.toFixed(1)}px`;
      hit.style.height = `${rect.boardH.toFixed(1)}px`;
      hit.style.setProperty('--legible', legible);
    };

    KOSATSU.place = place;
    measure();
    // Al cambiar el tamaño de la ventana (o al llegar las fuentes), se vuelve a medir.
    window.addEventListener('resize', measure);
    let alive = true;
    void document.fonts?.ready.then(() => {
      if (alive) measure();
    });

    return () => {
      alive = false;
      if (KOSATSU.place === place) KOSATSU.place = null;
      window.removeEventListener('resize', measure);
      clear();
    };
  }, [section, enabled]);
}
