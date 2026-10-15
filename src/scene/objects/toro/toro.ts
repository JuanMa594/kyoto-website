/**
 * Las medidas de los faroles de piedra (tōrō), como números puros.
 *
 * Viven aparte de la geometría para que las huellas de la fauna, el musgo y
 * las comprobaciones no carguen three. Origen: el centro de la base, en el
 * suelo. Unidades de mundo: el torii de la Home mide 7,9.
 *
 *   · **Kasuga-dōrō**: el farol alto de los caminos de los santuarios. De abajo
 *     arriba: base (kiso), poste con su anillo (sao), plataforma (chūdai),
 *     cámara del fuego con sus ventanas de papel (hibukuro), tejado de puntas
 *     levantadas (kasa) y la joya del remate (hōju). Todo hexagonal salvo el
 *     poste.
 *   · **Yukimi-dōrō**: el de «mirar la nieve», de jardín. Bajo, sobre tres
 *     patas curvas, con un tejado muy ancho.
 */

export type LanternVariant = 'kasuga' | 'yukimi';

export interface LanternSize {
  /** Radio de lo que ocupa en planta, contando el vuelo del tejado. */
  readonly radius: number;
  /** Alto total, del suelo a la punta de la joya. */
  readonly height: number;
  /** Radio de lo que toca el suelo: donde crece el musgo. */
  readonly foot: number;
  /** Centro y alto de la cámara del fuego: de ahí saldrá la luz de noche. */
  readonly fireY: number;
}

export const LANTERN_SIZE: Record<LanternVariant, LanternSize> = {
  kasuga: { radius: 0.62, height: 2.24, foot: 0.44, fireY: 1.48 },
  yukimi: { radius: 0.92, height: 1.3, foot: 0.55, fireY: 0.73 },
};
