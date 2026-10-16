/**
 * Cuándo y cómo va el texto de una tarjeta sobre la tabla de su kōsatsu
 * (Fase 5B). Módulo puro: lo usa `useKosatsuFit` en cada frame y lo comprueba
 * `check:path`.
 *
 * El bloque DOM mide `BLOCK_REM` de ancho y se escala para cubrir la zona de
 * escritura proyectada. Como el campo de visión vertical de la escena es fijo,
 * lo que mide la tabla en px crece y decrece con el alto de la ventana: en una
 * pantalla baja el cuerpo de letra resultante puede quedar pequeño. Si en la
 * parada queda por debajo de `MIN_BODY_PX` —o si la tabla no cabe, o la pantalla es vertical o táctil,
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
  /** Pantalla vertical o táctil: ahí no hay tabla legible junto al camino. */
  readonly compact: boolean;
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
 * ¿El texto se lee sobre la tabla? Se decide **en la parada**, con la cámara
 * quieta: la tabla entera a la vista (sin meterse bajo el riel) y la letra a
 * `MIN_BODY_PX` o más. Como sólo depende de la ventana, una tarjeta se lee
 * entera en un solo sitio: antes se decidía con la cámara de cada frame y, al
 * pasar junto a la tabla, ésta crecía y el texto saltaba del papel a la tabla
 * a mitad del fundido de salida.
 */
export function boardReadable({ stop, viewportWidth, blockHeight, live, compact }: BoardFitInput): boolean {
  if (!live || compact || !stop.on || stop.w <= 0 || stop.h <= 0) return false;
  if (stop.boardX < 0 || stop.boardX + stop.boardW > viewportWidth - RAIL_PX) return false;
  return BODY_PX * blockScale(stop, blockHeight) >= MIN_BODY_PX;
}

/**
 * `null`: va en la tarjeta de papel. Si no, dónde va el bloque ahora y a qué
 * escala: la mayor que cabe en la zona, centrado en lo que sobre (la tabla sin
 * mapa es ancha: ahí manda el alto). Al entrar y al salir la tabla es más
 * pequeña o más grande que en la parada, y el texto la sigue.
 */
export function boardFit(input: BoardFitInput): BoardPlacement | null {
  const { rect, blockHeight } = input;
  if (!boardReadable(input) || !rect.on || rect.w <= 0 || rect.h <= 0) return null;
  const scale = blockScale(rect, blockHeight);
  return {
    x: rect.x + (rect.w - BLOCK_PX * scale) / 2,
    y: rect.y + (blockHeight > 0 ? (rect.h - blockHeight * scale) / 2 : 0),
    scale,
  };
}
