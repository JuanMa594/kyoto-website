/**
 * El kōsatsu (高札) del tramo de Ubicación (Fase 5B), como números puros: el
 * tablón de avisos de Edo, plantado junto al camino, con la historia escrita en
 * su tabla y, en dos de ellos, un mapa antiguo que se desenrolla.
 *
 * Vive aparte de la geometría para que la colocación, las huellas y las
 * comprobaciones no carguen three, y para que `bun run maps` y el DOM compartan
 * el tamaño de los mapas.
 *
 * Origen: el centro de la base, en el suelo. La tabla está en el plano XY y
 * mira a +z (a la cámara de su parada: el giro lo pone `placement.ts`). Del
 * lado de fuera del camino cuelga el kakejiku con el mapa; del lado del
 * camino queda la **zona de escritura**, donde se encaja el texto DOM
 * (`useKosatsuFit`).
 *
 * Es grande —8 × 4 u de tabla, del tamaño del torii de la Home— porque en su
 * parada la tabla tiene que ocupar en pantalla lo que ocupaba la tarjeta de
 * papel, para que el texto se lea a buen tamaño (spec 5B, §15).
 */

import type { OldMap, Side, StationSlug } from '@/config/journey';

export const KOSATSU_SIZE = {
  /** La tabla: ancho (con mapa: sin él, `boardWidth()`), alto, grosor y a qué altura empieza. */
  boardWidth: 6.6,
  boardHeight: 3.95,
  boardBottom: 0.6,
  boardDepth: 0.14,
  /** El listón del marco alrededor de la tabla. */
  frame: 0.12,
  /** Los postes, de sección cuadrada, metidos desde los extremos: la tabla vuela hacia el camino. */
  postSize: 0.26,
  postInset: 1,
  /** El tejadillo a dos aguas: vuelo a cada lado, fondo y lo que sube la cumbrera. */
  roofOverhang: 0.35,
  roofDepth: 1,
  roofRise: 0.55,
  /** El kakejiku, del lado de fuera: ancho del papel. */
  scrollWidth: 1.75,
  /** Margen entre lo que va en la tabla y su borde. */
  margin: 0.25,
  /** Distancia en profundidad de la cámara de su parada a la tabla. */
  depthFromCamera: 20,
  /** |u| de la esquina del tejadillo más cercana al eje del camino (las piedras serpentean hasta ~2,1). */
  innerU: 2,
} as const;

/**
 * La escala a la que se planta: las medidas de arriba son las de un tablón a
 * 20 u de la cámara. Más lejos y más grande se ve igual en pantalla, pero su
 * canto interior —fijo en el mundo por las piedras— queda más cerca del
 * centro del cuadro, y la tabla cabe también en pantallas de 16:10.
 */
export const KOSATSU_SCALE = KOSATSU_SIZE.depthFromCamera / 20;

/** Lo alto de la tabla. */
export const KOSATSU_BOARD_TOP = KOSATSU_SIZE.boardBottom + KOSATSU_SIZE.boardHeight;

/** Alto total, del suelo a la cumbrera del tejadillo. */
export const KOSATSU_HEIGHT = KOSATSU_BOARD_TOP + KOSATSU_SIZE.frame + KOSATSU_SIZE.roofRise + 0.15;

/** El lienzo de cada mapa antiguo, en px del SVG: lo comparten el script, el `<img>` y el rollo. */
export const MAP_SIZE: Record<OldMap, { readonly width: number; readonly height: number }> = {
  japon: { width: 900, height: 1750 },
  heian: { width: 900, height: 1750 },
};

/**
 * Hacia qué x local queda el lado de fuera del camino. La tabla mira a la
 * cámara, que está casi en el eje: el camino queda a +x para un kōsatsu de la
 * izquierda.
 */
export function outerSign(side: Side): 1 | -1 {
  return side === 'izquierda' ? -1 : 1;
}

/** El papel del kakejiku, en coordenadas locales: centro en x, ancho y el alto del mapa. */
export function scrollLayout(side: Side, map: OldMap): { x: number; top: number; width: number; height: number } {
  const { boardWidth, scrollWidth, margin } = KOSATSU_SIZE;
  const size = MAP_SIZE[map];
  return {
    x: outerSign(side) * (boardWidth / 2 - margin - scrollWidth / 2),
    top: KOSATSU_BOARD_TOP - margin,
    width: scrollWidth,
    height: (scrollWidth * size.height) / size.width,
  };
}

/**
 * El ancho de la tabla: la que lleva mapa tiene sitio para el kakejiku; la que
 * no, es más estrecha (sólo lo escrito y sus márgenes).
 */
export function boardWidth(map: OldMap | undefined): number {
  const { boardWidth: wide, scrollWidth, margin } = KOSATSU_SIZE;
  return map ? wide : wide - scrollWidth - margin;
}

/** La zona de escritura en coordenadas locales: centro y medidas. */
export function writingLayout(side: Side, map: OldMap | undefined): { x: number; y: number; w: number; h: number } {
  const { boardWidth, boardBottom, boardHeight, scrollWidth, margin } = KOSATSU_SIZE;
  const h = boardHeight - 2 * margin;
  const y = boardBottom + boardHeight / 2;
  if (!map) return { x: 0, y, w: boardWidth - scrollWidth - 3 * margin, h };
  const w = boardWidth - scrollWidth - 3 * margin;
  // Del lado del camino: el contrario al del rollo.
  return { x: -outerSign(side) * (boardWidth / 2 - margin - w / 2), y, w, h };
}

/** Un kōsatsu colocado, lo justo para llevar su tabla al mundo (sin importar `placement.ts`). */
interface PlacedKosatsu {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly scale: number;
  readonly item: { readonly kind: string; readonly side?: Side; readonly map?: OldMap };
}

/**
 * La zona de escritura en el mundo: su centro, su eje «a la derecha» (en
 * pantalla, para la cámara de la parada) y su alto y ancho. La usan la escena,
 * para proyectarla, y las comprobaciones.
 */
export function kosatsuWriting(o: PlacedKosatsu): {
  center: [number, number, number];
  right: [number, number, number];
  w: number;
  h: number;
} {
  const side = o.item.side ?? 'izquierda';
  const local = writingLayout(side, o.item.map);
  const cos = Math.cos(o.yaw);
  const sin = Math.sin(o.yaw);
  // Delante de la tabla: su cara está en z = boardDepth / 2.
  const lx = local.x;
  const lz = KOSATSU_SIZE.boardDepth / 2;
  return {
    center: [o.x + (lx * cos + lz * sin) * o.scale, o.y + local.y * o.scale, o.z + (-lx * sin + lz * cos) * o.scale],
    right: [cos, 0, -sin],
    w: local.w * o.scale,
    h: local.h * o.scale,
  };
}

/** Las x locales de los dos postes. */
export function kosatsuPosts(map: OldMap | undefined): readonly [number, number] {
  const half = boardWidth(map) / 2 - KOSATSU_SIZE.postInset;
  return [-half, half];
}

/** La z local de los postes: detrás de la tabla. */
export const KOSATSU_POST_Z = -(KOSATSU_SIZE.boardDepth / 2 + KOSATSU_SIZE.postSize / 2);

/** Cuánto está desenrollado el mapa de la tarjeta `card` del tramo de `station`. */
export function unrollOf(station: StationSlug, card: number): number {
  if (KOSATSU.unrollFor === 'todas') return 1;
  return KOSATSU.unrollFor === station ? (KOSATSU.unroll[card] ?? 0) : 0;
}

/** Cuántos kōsatsu puede haber a la vez: uno por tarjeta del tramo. */
const MAX_SIGNS = 8;

export interface KosatsuRect {
  /** Esquina superior izquierda y medidas, en px de la ventana. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** La tabla entera, de lado a lado, en px: el texto sólo va encima si se ve entera. */
  boardX: number;
  boardW: number;
  /** Si la escena la está proyectando (el kōsatsu montado y delante de la cámara). */
  on: boolean;
}

/**
 * El puente entre el tramo (DOM) y los kōsatsu (escena). Cambia a 60 fps: por
 * eso no vive en Zustand. Indexado por la tarjeta del tramo.
 *
 * **Un único escritor por campo**: `rects` y `wake`, `Kosatsu`; `unroll`,
 * `useJourneyScroll`.
 */
export const KOSATSU = {
  /** La zona de escritura de cada tablón en la ventana. */
  rects: Array.from({ length: MAX_SIGNS }, (): KosatsuRect => ({ x: 0, y: 0, w: 0, h: 0, boardX: 0, boardW: 0, on: false })),
  /** Cuánto está desenrollado cada mapa, 0–1 (`tramoUnroll`), por tarjeta… */
  unroll: new Float32Array(MAX_SIGNS),
  /**
   * …del tramo de qué estación: los índices son de tarjeta, y el tramo de la
   * Home también tiene una tarjeta 0. `'todas'`: sin movimiento, todos
   * desplegados. Lo lee `unrollOf`.
   */
  unrollFor: null as StationSlug | 'todas' | null,
  /** Pide un frame (con movimiento reducido el canvas pinta a demanda). */
  wake: () => {},
};
