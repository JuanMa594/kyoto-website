/**
 * La roca pintada del tramo de Ubicación (Fase 5B), como números puros: un
 * tateishi (立石), una piedra grande puesta en pie, más ancha que alta, con la
 * esquina de `2.png` pintada en su cara —el sol rojo, el Fuji y el torii—.
 * Se sacó del cartel de Ubicación para no sobrecargarlo; aquí es lo primero
 * que se ve al echar a andar, difusa por la niebla desde la vista inicial.
 *
 * Origen: el centro de la base, en el suelo. La cara pintada mira a +z.
 */

export const ROCA_SIZE = {
  width: 3.8,
  height: 2.8,
  depth: 1.1,
} as const;

/** La planta de la roca para la fauna, el musgo y las sombras: tres círculos a lo largo de su ancho. */
export const ROCA_FOOTPRINTS: readonly { x: number; r: number; foot: number }[] = [
  { x: -1.2, r: 0.75, foot: 0.65 },
  { x: 0, r: 0.8, foot: 0.7 },
  { x: 1.2, r: 0.75, foot: 0.65 },
];
