/**
 * El rōmon (楼門) de Fushimi Inari (Fase 6A), como números puros: la puerta de
 * dos pisos que levantó Toyotomi Hideyoshi en 1589, la de `6.png`.
 *
 * Una base de piedra (*kidan*) con su escalinata; abajo, tres vanos de
 * pilares bermellón —el del centro abierto, los de los lados con paños
 * blancos— y dos chōchin grandes colgando delante; encima, el tejado bajo, el
 * balcón con su barandilla y el piso de arriba con su tejado de cuatro aguas.
 * Las ménsulas (*tokyō*) se simplifican en bloques; los tejados son de
 * corteza oscura, con los aleros curvados hacia arriba en las esquinas.
 *
 * Origen: el centro de la base, en el suelo. El frente mira a +z; el ancho va
 * por x. Lo coloca `journey.ts` en tres cuartos, girado hacia el camino.
 */

export const ROMON = {
  /** La base de piedra. */
  base: { width: 11.2, depth: 7.6, height: 0.9 },
  /** La escalinata, delante del vano central. */
  steps: { width: 3.8, count: 4, rise: 0.225, run: 0.4 },
  /** Los pilares de abajo: sus x, sus z, su radio y hasta dónde llegan. */
  columnsX: [-4.5, -1.5, 1.5, 4.5] as const,
  columnsZ: [-2.6, 0, 2.6] as const,
  columnRadius: 0.3,
  lowerTop: 5.3,
  /** Las ménsulas sobre cada pilar. */
  bracketTop: 5.85,
  /** El tejado de abajo: el alero, lo alto donde se junta con el piso de arriba, y su planta. */
  lowerRoof: { halfW: 7, halfD: 5, innerHalfW: 4.3, innerHalfD: 2.75, eave: 5.85, top: 6.95, sori: 0.55 },
  /** El balcón. */
  balcony: { halfW: 4.5, halfD: 2.95, floor: 6.95, railHeight: 0.75 },
  /** Los pilares de arriba. */
  upperX: [-3.3, -1.1, 1.1, 3.3] as const,
  upperZ: [-1.85, 1.85] as const,
  upperTop: 9.1,
  upperBracketTop: 9.55,
  /** El tejado de arriba, a cuatro aguas con su cumbrera. */
  upperRoof: { halfW: 6.1, halfD: 4.3, ridgeHalf: 1.8, eave: 9.55, top: 11.35, sori: 0.6 },
  /** Los dos chōchin: x, z, centro en y, radio y alto. */
  lanterns: { x: 3, z: 2.75, y: 3.65, radius: 0.78, height: 2 },
  /** Grosor de los tejados. */
  roofThickness: 0.28,
} as const;

/** Alto total, del suelo a la cumbrera (con las tejas de los extremos). */
export const ROMON_HEIGHT = ROMON.upperRoof.top + 0.45;

/** Lo que ocupa en el suelo: la base de piedra con su escalinata. */
export const ROMON_FOOTPRINT = {
  hx: ROMON.base.width / 2,
  hz: (ROMON.base.depth + ROMON.steps.count * ROMON.steps.run) / 2,
  cz: (ROMON.steps.count * ROMON.steps.run) / 2,
} as const;

/** Las dos estatuas de zorro: a los lados de la escalinata, sobre su pedestal. */
export const ROMON_FOXES = [
  { x: -3.2, z: 4.7, yaw: 0.35, holding: 'llave' },
  { x: 3.2, z: 4.7, yaw: -0.35, holding: 'tama' },
] as const;

/** El pedestal de una estatua: medio ancho, medio fondo y alto. */
export const PEDESTAL = { half: 0.62, depth: 0.5, height: 1.25 } as const;

/** La estatua: largo del zorro (morro a cola) sobre su pedestal. */
export const STATUE_SIZE = 1.9;

/**
 * La altura de un tejado en (x, z) locales, sin la curva de las esquinas: alto
 * en la cumbrera (o donde se junta con el piso de arriba), bajando hacia el
 * alero, más tendido abajo que arriba, como los tejados japoneses.
 */
export function roofHeight(
  roof: { halfW: number; halfD: number; eave: number; top: number; sori: number; ridgeHalf?: number; innerHalfW?: number; innerHalfD?: number },
  x: number,
  z: number,
): number {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  let tx: number;
  let tz: number;
  if (roof.innerHalfW !== undefined && roof.innerHalfD !== undefined) {
    tx = (ax - roof.innerHalfW) / (roof.halfW - roof.innerHalfW);
    tz = (az - roof.innerHalfD) / (roof.halfD - roof.innerHalfD);
  } else {
    const ridge = roof.ridgeHalf ?? 0;
    tx = (ax - ridge) / (roof.halfW - ridge);
    tz = az / roof.halfD;
  }
  const t = Math.min(1, Math.max(0, Math.max(tx, tz)));
  // La sori: las esquinas se levantan, nada en mitad del alero.
  const corner = Math.min(1, Math.max(0, Math.min(tx, tz)));
  return roof.eave + (roof.top - roof.eave) * (1 - t) ** 1.35 + roof.sori * corner ** 2 * t ** 3;
}
