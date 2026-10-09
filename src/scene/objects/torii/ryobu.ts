/**
 * Las medidas del torii ryōbu (`1.png`), como números puros.
 *
 * Viven aparte de la geometría para que las comprobaciones y las huellas de la
 * fauna no carguen three. Origen: la base del pilar más cercano al camino;
 * las vigas se extienden hacia +x; z es el eje del camino. Unidades de mundo.
 *
 * El ryōbu es el torii con **pilares de apoyo** (sode-bashira) delante y
 * detrás de cada pilar principal, con su tejadillo: el de Itsukushima, y el
 * que se ve en primer plano en la referencia.
 */
export const RYOBU = {
  /** Entre los ejes de los dos pilares. */
  span: 5.6,
  /** La base negra (kamebara). */
  baseHeight: 0.7,
  /** Radio del pilar, abajo y arriba: ligeramente cónico. */
  pillarRadius: [0.38, 0.33] as const,
  /** Uchikorobi: cuánto se acerca la cabeza de cada pilar al centro (~1,5°). */
  lean: 0.16,
  /** Donde termina el pilar y empieza el shimaki. */
  shimakiBottom: 6.74,
  shimakiHeight: 0.3,
  shimakiDepth: 0.72,
  shimakiOverhang: 1.05,
  kasagiHeight: 0.36,
  kasagiDepth: 0.9,
  kasagiOverhang: 1.25,
  /** Sorimashi: cuánto se levantan las puntas del kasagi. */
  sori: 0.42,
  nukiY: 5.3,
  nukiHeight: 0.38,
  nukiDepth: 0.42,
  nukiOverhang: 0.75,
  sode: {
    /** Distancia al pilar principal, a lo largo del camino. */
    offset: 1.5,
    size: 0.26,
    height: 4.6,
    /** Alturas de las dos vigas que lo unen al pilar. */
    beams: [2.4, 3.9] as const,
  },
} as const;

/** Lo que se levanta una viga curva a la fracción `t` (−1…1) de su media luz. */
export function soriLift(t: number, amount: number): number {
  return amount * Math.min(1, Math.abs(t)) ** 3.2;
}

/** Lo que se levanta el kasagi —y el shimaki, que lo acompaña— en la x local. */
export function kasagiLift(x: number): number {
  const half = RYOBU.span / 2 + RYOBU.kasagiOverhang;
  return soriLift((x - RYOBU.span / 2) / half, RYOBU.sori);
}

/** Cara de abajo y de arriba del kasagi en la x local. */
export function kasagiProfile(x: number): { bottom: number; top: number } {
  const bottom = RYOBU.shimakiBottom + RYOBU.shimakiHeight + kasagiLift(x);
  return { bottom, top: bottom + RYOBU.kasagiHeight };
}

/** Lo que ocupa en el suelo: los dos pilares y los cuatro de apoyo, con su altura. */
export const RYOBU_FOOTPRINTS: readonly { x: number; z: number; r: number; top: number }[] = [
  { x: 0, z: 0, r: 0.55, top: 7.9 },
  { x: RYOBU.span, z: 0, r: 0.55, top: 7.9 },
  ...[0, RYOBU.span].flatMap((x) =>
    [RYOBU.sode.offset, -RYOBU.sode.offset].map((z) => ({ x, z, r: 0.32, top: RYOBU.sode.height + 0.45 })),
  ),
];
