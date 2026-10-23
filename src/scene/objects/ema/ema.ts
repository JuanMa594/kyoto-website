/**
 * El ema-kake (絵馬掛け) de la subida a Fushimi Inari (Fase 6A), como números
 * puros: el bastidor de madera donde se cuelgan las ema, con las de zorro
 * apretadas en sus travesaños y, delante, **una ema grande**, pentagonal y de
 * madera clara, que es la zona de escritura de su tarjeta del tramo.
 *
 * Es el kōsatsu de la Fase 5B con otra forma: se planta igual —delante de la
 * cámara de su parada, en su lado, paralelo a la imagen—, proyecta su zona de
 * escritura en `KOSATSU.rects` y el texto DOM se encaja encima con el mismo
 * mecanismo (`useKosatsuFit`). Tan grande como haga falta para leer: más que
 * una real.
 *
 * Origen: el centro de la base, en el suelo. Las ema miran a +z; el camino
 * queda del lado contrario a `outerSign(side)` (el de `kosatsu.ts`).
 */

import type { Side } from '@/config/journey';

import { outerSign } from '@/scene/objects/kosatsu/kosatsu';

export const EMA_SIZE = {
  /** El bastidor: entre los ejes de los postes, su sección y su alto. */
  frameWidth: 7.4,
  postSize: 0.22,
  postHeight: 5.95,
  /** Los travesaños de donde cuelgan las ema de zorro. */
  rails: [0.75, 2.2, 3.65, 5.1] as const,
  railHeight: 0.1,
  railDepth: 0.1,
  /** El tejadillo a dos aguas. */
  roofOverhang: 0.35,
  roofDepth: 0.9,
  roofRise: 0.5,
  /** La ema grande: ancho, alto de la parte recta, la punta, grosor y a qué altura empieza. */
  plaqueWidth: 4.7,
  plaqueHeight: 3.9,
  plaquePeak: 0.7,
  plaqueDepth: 0.12,
  plaqueBottom: 1,
  /** Lo que la separa de los travesaños, hacia la cámara. */
  plaqueFront: 0.16,
  /** Margen entre lo escrito y el borde de la ema. */
  margin: 0.28,
  /** La ema de zorro: lo que mide y cada cuánto cuelga. */
  foxWidth: 0.42,
  foxHeight: 0.48,
  foxSpacing: 0.46,
  /**
   * Distancia de la cámara de su parada a la tabla, y |u| de su canto interior:
   * en las curvas de la subida la cámara se aparta del eje casi 1 u.
   */
  depthFromCamera: 20,
  innerU: 2.6,
} as const;

/** Alto total, del suelo a la cumbrera del tejadillo. */
export const EMA_HEIGHT = EMA_SIZE.postHeight + EMA_SIZE.roofRise + 0.1;

/** La x local del centro de la ema grande: del lado del camino. */
export function plaqueX(side: Side): number {
  const { frameWidth, plaqueWidth, postSize } = EMA_SIZE;
  return -outerSign(side) * (frameWidth / 2 - postSize - 0.12 - plaqueWidth / 2);
}

/** La zona de escritura en coordenadas locales: centro y medidas. */
export function emaWritingLayout(side: Side): { x: number; y: number; w: number; h: number } {
  const { plaqueWidth, plaqueHeight, plaqueBottom, margin } = EMA_SIZE;
  return {
    x: plaqueX(side),
    y: plaqueBottom + plaqueHeight / 2,
    w: plaqueWidth - 2 * margin,
    h: plaqueHeight - 2 * margin,
  };
}

/** La z local de la cara de la ema grande. */
export const EMA_PLAQUE_FACE = EMA_SIZE.plaqueFront + EMA_SIZE.plaqueDepth / 2;

/** Las x locales de los dos postes. */
export function emaPosts(): readonly [number, number] {
  const half = EMA_SIZE.frameWidth / 2;
  return [-half, half];
}

/** Un ema-kake colocado, lo justo para llevar su ema grande al mundo. */
interface PlacedEma {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly scale: number;
  readonly item: { readonly kind: string; readonly side?: Side };
}

/**
 * La zona de escritura en el mundo: su centro, su eje «a la derecha» y sus
 * medidas. La misma forma que `kosatsuWriting`, para que la escena y las
 * comprobaciones la traten igual.
 */
export function emaWriting(o: PlacedEma): {
  center: [number, number, number];
  right: [number, number, number];
  w: number;
  h: number;
} {
  const local = emaWritingLayout(o.item.side ?? 'izquierda');
  const cos = Math.cos(o.yaw);
  const sin = Math.sin(o.yaw);
  const lx = local.x;
  const lz = EMA_PLAQUE_FACE;
  return {
    center: [o.x + (lx * cos + lz * sin) * o.scale, o.y + local.y * o.scale, o.z + (-lx * sin + lz * cos) * o.scale],
    right: [cos, 0, -sin],
    w: local.w * o.scale,
    h: local.h * o.scale,
  };
}

/** La ema grande entera, de lado a lado y de arriba abajo (con la punta), en locales: lo que se toca. */
export function plaqueExtent(side: Side): { x0: number; x1: number; y0: number; y1: number } {
  const x = plaqueX(side);
  const { plaqueWidth, plaqueHeight, plaqueBottom, plaquePeak } = EMA_SIZE;
  return { x0: x - plaqueWidth / 2, x1: x + plaqueWidth / 2, y0: plaqueBottom, y1: plaqueBottom + plaqueHeight + plaquePeak };
}

/**
 * Dónde cuelga cada ema de zorro, en locales: x e y del punto de donde cuelga
 * (bajo su travesaño). Las que quedarían del todo detrás de la ema grande no
 * se cuelgan (no se verían); las de su borde, sí, asomando.
 */
export function foxSlots(side: Side): { x: number; y: number }[] {
  const { frameWidth, postSize, rails, foxSpacing, foxWidth, railHeight } = EMA_SIZE;
  const plaque = plaqueExtent(side);
  const slots: { x: number; y: number }[] = [];
  const half = frameWidth / 2 - postSize - foxWidth / 2;
  for (const [row, rail] of rails.entries()) {
    // Cada fila, un poco desplazada: no una cuadrícula.
    const offset = (row % 2) * foxSpacing * 0.5;
    for (let x = -half + offset; x <= half; x += foxSpacing) {
      const top = rail - railHeight / 2;
      const hidden =
        x - foxWidth / 2 > plaque.x0 + 0.05 &&
        x + foxWidth / 2 < plaque.x1 - 0.05 &&
        top < plaque.y1 - 0.2 &&
        top - EMA_SIZE.foxHeight > plaque.y0;
      if (!hidden) slots.push({ x, y: top });
    }
  }
  return slots;
}
