/**
 * Cuándo y cómo va el texto de una tarjeta sobre la tabla de su kōsatsu
 * (Fase 5B). Módulo puro: lo usa `useKosatsuFit` en cada frame y lo comprueba
 * `check:path`.
 *
 * El bloque DOM mide `BLOCK_REM` de ancho y se escala para cubrir la zona de
 * escritura proyectada. Como el campo de visión vertical de la escena es fijo,
 * lo que mide la tabla en px crece y decrece con el alto de la ventana: en una
 * pantalla baja el cuerpo de letra resultante puede quedar pequeño. Por debajo
 * de `MIN_BODY_PX` —o si la tabla no cabe, o la pantalla es vertical o táctil,
 * o no hay escena—, el texto vuelve a la tarjeta de papel (spec 5B, §15).
 */

/** Ancho del bloque de texto sobre la tabla, en rem y en px (a 16 px/rem). */
export const BLOCK_REM = 19;
export const BLOCK_PX = BLOCK_REM * 16;
/** El cuerpo del texto sobre la tabla: 1,1 rem. */
export const BODY_PX = 17.6;
/** Por debajo de este cuerpo, el texto va en la tarjeta de papel. */
export const MIN_BODY_PX = 14;
/** Lo que ocupa a la derecha el riel de la navegación (4,5 rem): la tabla no se mete debajo. */
export const RAIL_PX = 72;

export interface BoardFitInput {
  /** La zona de escritura en la ventana, en px (`KOSATSU.rects`). */
  readonly rect: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    /** La tabla entera, de lado a lado (con el mapa): tiene que verse entera. */
    readonly boardX: number;
    readonly boardW: number;
    readonly on: boolean;
  };
  readonly viewportWidth: number;
  /** El alto del bloque sin escalar, en px (lo mide el DOM). Sin medir, 0: manda el ancho. */
  readonly blockHeight: number;
  /** Si la escena está viva (`PATH.live`). */
  readonly live: boolean;
  /** Pantalla vertical o táctil: ahí no hay tabla legible junto al camino. */
  readonly compact: boolean;
}

export interface BoardPlacement {
  /** Esquina superior izquierda del bloque, en px. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/**
 * `null`: va en la tarjeta de papel. Si no, dónde va el bloque y a qué escala:
 * la mayor que cabe en la zona a lo ancho y a lo alto, centrado en lo que
 * sobre (la tabla sin mapa es ancha: ahí manda el alto).
 */
export function boardFit({ rect, viewportWidth, blockHeight, live, compact }: BoardFitInput): BoardPlacement | null {
  if (!live || compact || !rect.on || rect.w <= 0 || rect.h <= 0) return null;
  if (rect.boardX < 0 || rect.boardX + rect.boardW > viewportWidth - RAIL_PX) return null;
  const scale = Math.min(rect.w / BLOCK_PX, blockHeight > 0 ? rect.h / blockHeight : Number.POSITIVE_INFINITY);
  if (BODY_PX * scale < MIN_BODY_PX) return null;
  return {
    x: rect.x + (rect.w - BLOCK_PX * scale) / 2,
    y: rect.y + (blockHeight > 0 ? (rect.h - blockHeight * scale) / 2 : 0),
    scale,
  };
}
