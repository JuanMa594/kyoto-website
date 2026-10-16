/**
 * La alfombra de pétalos caídos (5B). Módulo puro.
 *
 * Una estación la declara en `journey.ts` (`environment.petalCarpet`): el suelo
 * se va cubriendo de rosa al acercarse a ella y se despeja después. No hay
 * geometría: los pétalos los dibuja el shader del terreno y del camino
 * (`scene/shaders/petalCarpet.ts`) con estos mismos números, que llegan como
 * uniforms. Aquí está la cobertura en cada `d`, para las comprobaciones.
 *
 * Sólo una estación puede llevarla: el shader recibe un único tramo
 * (`check:path` lo comprueba). Si en otra fase hiciera falta otra, serían
 * arrays de uniforms.
 */

import { JOURNEY } from '@/config/journey';
import { smoothstep } from '@/lib/procedural';
import { STATION_DEPTHS } from '@/scene/path/journeyPath';

export interface CarpetSpan {
  /** d donde empieza (cobertura 0), donde llega al máximo, donde deja de estarlo y donde se acaba. */
  readonly start: number;
  readonly full: number;
  readonly holdEnd: number;
  readonly end: number;
  /** La cobertura máxima, 0–1. */
  readonly cover: number;
}

function carpetSpan(): CarpetSpan | null {
  const index = JOURNEY.findIndex((station) => station.environment.petalCarpet);
  const carpet = JOURNEY[index]?.environment.petalCarpet;
  const d = STATION_DEPTHS[index];
  if (!carpet || d === undefined) return null;
  return {
    start: d - carpet.before,
    full: d,
    holdEnd: d + carpet.hold,
    end: d + carpet.hold + carpet.fade,
    cover: carpet.cover,
  };
}

/** El tramo de la alfombra, o null si ninguna estación la declara. */
export const PETAL_CARPET: CarpetSpan | null = carpetSpan();

/**
 * Cuánto del suelo cubren los pétalos en `d` (0–1). La misma curva que el
 * shader: sube con un smoothstep, se mantiene y baja con otro.
 */
export function petalCarpetAt(d: number, span: CarpetSpan | null = PETAL_CARPET): number {
  if (!span) return 0;
  const up = smoothstep(span.start, span.full, d);
  const down = 1 - smoothstep(span.holdEnd, span.end, d);
  return span.cover * Math.min(up, down);
}
