'use client';

import { gsap } from 'gsap';
import { useEffect, useRef, type RefObject } from 'react';

import type { StationSlug } from '@/config/journey';
import { PATH, STATION_DEPTHS, stationIndex } from '@/scene/path/journeyPath';

import { railPosition, type RailPoint } from './railProgress';

/**
 * La marca «tú» y las piedras recorridas, al ritmo de la cámara.
 *
 * Cambia sesenta veces por segundo, así que no pasa por React ni por el store:
 * un callback de `gsap.ticker` —el reloj de Lenis— lee `PATH.d`, lo convierte
 * en posición de riel y toca el DOM sólo si algo cambió. Es la regla de `WIND`
 * y `PARALLAX`. En un salto la marca recorre el riel con la curva `piedra` del
 * viaje sin una línea de código: lee lo mismo que la cámara.
 *
 * Sin canvas (`PATH.live` falso, sin WebGL) la marca se queda en la estación
 * de la URL en vez de en la Home.
 *
 * Antes de arrancar, la marca se coloca por CSS con `--s0` (la estación del
 * HTML estático). Al arrancar se le pone `data-live` y desde entonces la
 * coloca sólo su `transform`.
 */
export function useRailProgress({
  marker,
  stops,
  place,
  current,
  enabled,
}: {
  marker: RefObject<HTMLElement | null>;
  stops: RefObject<HTMLElement[]>;
  place: (s: number, out: RailPoint) => void;
  current: StationSlug | null;
  enabled: boolean;
}): void {
  const fallback = useRef(0);

  useEffect(() => {
    fallback.current = current ? STATION_DEPTHS[stationIndex(current)]! : 0;
  }, [current]);

  useEffect(() => {
    const node = marker.current;
    if (!enabled || !node) return;

    const point = { x: 0, y: 0 };
    let lastX = Number.NaN;
    let lastY = Number.NaN;
    let lastWalked = -1;

    const tick = () => {
      const s = railPosition(PATH.live ? PATH.d : fallback.current);
      place(s, point);
      if (!(Math.abs(point.x - lastX) < 0.05 && Math.abs(point.y - lastY) < 0.05)) {
        node.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
        lastX = point.x;
        lastY = point.y;
      }
      const walked = Math.floor(s + 1e-6);
      if (walked !== lastWalked) {
        stops.current.forEach((stop, i) => stop.toggleAttribute('data-walked', i <= walked));
        lastWalked = walked;
      }
    };

    node.setAttribute('data-live', '');
    tick();
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      node.removeAttribute('data-live');
      node.style.transform = '';
    };
  }, [enabled, marker, stops, place]);
}
