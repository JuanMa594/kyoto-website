/**
 * El riel de la navegación, en puro: de la profundidad del camino a una
 * posición sobre el riel, y de ahí a píxeles. Lo usan el riel de escritorio, la
 * barra móvil y el abanico (Fase 3C), y lo comprueba `scripts/check-nav.ts`.
 *
 * El riel tiene una parada por estación de `JOURNEY` —京都 y las seis del
 * sidebar—, **equiespaciadas**: en proporción a la distancia real, el primer
 * tramo (64 u de 786) dejaría los dos primeros círculos montados al
 * desplegarse. La distancia real se nota en la velocidad: la marca cruza más
 * deprisa los tramos cortos.
 */

import { lerp } from '@/lib/procedural';
import { STATION_DEPTHS } from '@/scene/path/journeyPath';

/** Índice de la última parada (京料理). La primera, 0, es 京都. */
export const RAIL_LAST = STATION_DEPTHS.length - 1;

export interface RailPoint {
  x: number;
  y: number;
}

/**
 * Posición en el riel, de 0 a `RAIL_LAST`: exactamente `i` en la profundidad
 * de la estación `i` y lineal entre dos estaciones. Fuera del camino se queda
 * en sus extremos.
 */
export function railPosition(d: number): number {
  if (d <= STATION_DEPTHS[0]!) return 0;
  for (let i = 1; i < STATION_DEPTHS.length; i += 1) {
    const from = STATION_DEPTHS[i - 1]!;
    const to = STATION_DEPTHS[i]!;
    if (d <= to) return i - 1 + (d - from) / (to - from);
  }
  return RAIL_LAST;
}

/**
 * Cuánto se separa del borde la parada en `t` (0–1), relativo a la flecha del
 * arco: 0 en los extremos y 1 en medio. Es una parábola: con flechas de 8–40 px
 * sobre 400–560 px de cuerda no se distingue de un arco de círculo.
 */
export function railBend(t: number): number {
  const u = 2 * t - 1;
  return 1 - u * u;
}

/**
 * El riel vertical de escritorio. `y` va de 0 (京都) a `height` (京料理); `x` es
 * ≤ 0 —hacia la izquierda, lejos del borde— y vale `-bulge` a media altura.
 */
export function railPoint(s: number, height: number, bulge: number, out: RailPoint): RailPoint {
  const t = s / RAIL_LAST;
  out.x = -bulge * railBend(t);
  out.y = t * height;
  return out;
}

/** La barra móvil: el mismo riel, recto y en horizontal, de 0 a `width`. */
export function barPoint(s: number, width: number, out: RailPoint): RailPoint {
  out.x = (s / RAIL_LAST) * width;
  out.y = 0;
  return out;
}

/** Ángulo final de la parada `index` (1…RAIL_LAST) en el abanico: de π (izquierda) a 0 (derecha). */
export function fanAngle(index: number): number {
  return Math.PI * (1 - (index - 1) / (RAIL_LAST - 1));
}

/**
 * El abanico móvil, desplegándose. Con `k` = 0 todo está en el centro (京都);
 * con `k` = 1, cada círculo en su sitio del semicírculo de radio `radius`. Por
 * el camino el ángulo barre desde la izquierda, así que los círculos
 * **recorren el arco** en vez de salir en línea recta. La `y` hacia arriba es
 * negativa, como en CSS. Con un *spring* `k` pasa un momento de 1: el círculo
 * se pasa un poco y vuelve.
 */
export function fanPose(index: number, k: number, radius: number, out: RailPoint): RailPoint {
  const angle = lerp(Math.PI, fanAngle(index), k);
  out.x = Math.cos(angle) * radius * k;
  out.y = -Math.sin(angle) * radius * k;
  return out;
}
