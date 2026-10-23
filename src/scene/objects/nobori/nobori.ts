/**
 * Los nobori (幟) de la explanada de Fushimi Inari (Fase 6A), como números
 * puros: estandartes altos y estrechos en su mástil, los de los santuarios de
 * Inari. La tela es roja, con el borde blanco y **la greca de `6.png`** —el
 * raimon, la greca de rayos— impresa a lo largo del borde, en el shader.
 *
 * Origen: el pie del mástil, en el suelo. La tela cuelga hacia +x desde el
 * mástil y mira a +z; `placement.ts` la gira para que se aleje del camino.
 */
export const NOBORI = {
  /** El mástil: alto y radio. */
  poleHeight: 7.4,
  poleRadius: 0.06,
  /** La tela: ancho, largo y cuánto queda por debajo de la punta del mástil. */
  clothWidth: 0.95,
  clothHeight: 5.2,
  clothTop: 0.35,
  /** El borde blanco con la greca, en unidades. */
  band: 0.16,
} as const;

/** Lo alto del nobori, del suelo a la punta del mástil. */
export const NOBORI_HEIGHT = NOBORI.poleHeight;
