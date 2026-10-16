/**
 * Cuándo y cómo va el texto de una tarjeta sobre la tabla de su kōsatsu
 * (Fase 5B). Módulo puro: lo usa `useKosatsuFit` en cada frame y lo comprueba
 * `check:path`.
 *
 * El bloque DOM mide `BLOCK_REM` de ancho y se escala para cubrir la zona de
 * escritura proyectada. Como el campo de visión vertical de la escena es fijo,
 * lo que mide la tabla en px crece y decrece con el alto de la ventana: en una
 * pantalla baja la letra sale pequeña. Por eso un clic en la tabla abre la
 * tarjeta de lectura (`KosatsuReader`), con el texto y el mapa en grande: el
 * texto va sobre la tabla siempre que en la parada se vea entera. Si no —la
 * tabla cortada por un borde o bajo el riel, la pantalla vertical, sin
 * escena—, no hay tabla que tocar y vuelve a la tarjeta de papel.
 */

/** Ancho del bloque de texto sobre la tabla, en rem y en px (a 16 px/rem). */
export const BLOCK_REM = 19;
export const BLOCK_PX = BLOCK_REM * 16;
/** El cuerpo del texto sobre la tabla: 1,1 rem. */
export const BODY_PX = 17.6;
/** Lo que ocupa a la derecha el riel de la navegación (4,5 rem): la tabla no se mete debajo. */
export const RAIL_PX = 72;

/** Una tabla proyectada en la ventana, en px (`KosatsuProjection`). */
export interface BoardRect {
  /** La zona de escritura. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** La tabla entera, de lado a lado (con el mapa): tiene que verse entera. */
  readonly boardX: number;
  readonly boardW: number;
  readonly on: boolean;
}

export interface BoardFitInput {
  /** La tabla con la cámara de ahora (`KOSATSU.rects`): dónde va el bloque. */
  readonly rect: BoardRect;
  /** La misma tabla con la cámara de su parada: si el texto va encima. */
  readonly stop: BoardRect;
  readonly viewportWidth: number;
  /** El alto del bloque sin escalar, en px (lo mide el DOM). Sin medir, 0: manda el ancho. */
  readonly blockHeight: number;
  /** Si la escena está viva (`PATH.live`). */
  readonly live: boolean;
  /** Pantalla vertical: los kōsatsu quedan a los lados, fuera del cuadro, y son sólo escenario. */
  readonly portrait: boolean;
}

export interface BoardPlacement {
  /** Esquina superior izquierda del bloque, en px. */
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** La mayor escala del bloque que cabe en la zona a lo ancho y a lo alto. */
function blockScale(rect: BoardRect, blockHeight: number): number {
  return Math.min(rect.w / BLOCK_PX, blockHeight > 0 ? rect.h / blockHeight : Number.POSITIVE_INFINITY);
}

/**
 * ¿El texto va sobre la tabla? Se decide **en la parada**, con la cámara
 * quieta: la tabla entera a la vista, sin meterse bajo el riel. Como sólo
 * depende de la ventana, una tarjeta se lee entera en un solo sitio: decidido
 * con la cámara de cada frame, al pasar junto a la tabla ésta crecía y el
 * texto saltaba del papel a la tabla a mitad del fundido de salida.
 */
export function boardVisible({ stop, viewportWidth, live, portrait }: BoardFitInput): boolean {
  if (!live || portrait || !stop.on || stop.w <= 0 || stop.h <= 0) return false;
  return stop.boardX >= 0 && stop.boardX + stop.boardW <= viewportWidth - RAIL_PX;
}

/** El cuerpo de letra que tendría el texto sobre la tabla en la parada, en px: para las comprobaciones. */
export function boardBodyPx(stop: BoardRect, blockHeight: number): number {
  return BODY_PX * blockScale(stop, blockHeight);
}

/**
 * `null`: va en la tarjeta de papel. Si no, dónde va el bloque ahora y a qué
 * escala: la mayor que cabe en la zona, centrado en lo que sobre (la tabla sin
 * mapa es ancha: ahí manda el alto). Al entrar y al salir la tabla es más
 * pequeña o más grande que en la parada, y el texto la sigue.
 */
export function boardFit(input: BoardFitInput): BoardPlacement | null {
  const { rect, blockHeight } = input;
  if (!boardVisible(input) || !rect.on || rect.w <= 0 || rect.h <= 0) return null;
  const scale = blockScale(rect, blockHeight);
  return {
    x: rect.x + (rect.w - BLOCK_PX * scale) / 2,
    y: rect.y + (blockHeight > 0 ? (rect.h - blockHeight * scale) / 2 : 0),
    scale,
  };
}
