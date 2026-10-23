/**
 * Las medidas del torii inari (Fase 6A), como números puros.
 *
 * El de las galerías de Fushimi: un **myōjin** —el kasagi curvado sobre el
 * shimaki, el nuki que atraviesa los pilares— con el **daiwa**, el anillo
 * donde el pilar se junta con el shimaki, que es lo que distingue al Inari
 * torii. Sin pilares de apoyo. Bermellón, con el pie negro (*nemaki*) y la
 * cara de arriba del kasagi negra, como en `5.png`.
 *
 * **Tamaño por la cámara, no por el original**: la cámara va a 5,2 u sobre el
 * suelo y pasa por debajo, así que el *nuki* está a 6,8 u en el llano —1,5 u
 * por encima de ella— y la luz es de 8 u. Cuesta arriba la cámara va más
 * alta (el tope de inclinación la sube): cada torii lleva su **alzada**, que
 * estira los pilares sin tocar las vigas (`inariLift`, en el shader).
 *
 * Origen: en el suelo, en el eje del camino, entre los dos pilares; las vigas
 * a lo largo de x; z es el eje del camino. Unidades de mundo.
 */
export const INARI = {
  /** Entre los ejes de los dos pilares: cada uno a 4 u del eje del camino. */
  span: 8,
  /** El pie negro (nemaki): alto y radio, abajo y arriba. */
  baseHeight: 0.75,
  baseRadius: [0.4, 0.37] as const,
  /** Radio del pilar, abajo y arriba: ~0,64 u de diámetro. */
  pillarRadius: [0.32, 0.29] as const,
  /** Uchikorobi: cuánto se acerca la cabeza de cada pilar al centro. */
  lean: 0.1,
  /** El nuki: su centro, su alto, su fondo y lo que asoma por fuera. */
  nukiY: 7,
  nukiHeight: 0.4,
  nukiDepth: 0.34,
  nukiOverhang: 0.85,
  /** El daiwa, en lo alto del pilar. */
  daiwaHeight: 0.22,
  daiwaRadius: 0.37,
  /** El shimaki, sobre los pilares. */
  shimakiBottom: 8.05,
  shimakiHeight: 0.34,
  shimakiDepth: 0.48,
  shimakiOverhang: 1,
  /** El kasagi: la viga bermellón y su tapa negra, curvados. */
  kasagiHeight: 0.26,
  kasagiCap: 0.16,
  kasagiDepth: 0.62,
  kasagiOverhang: 1.35,
  /** Sorimashi: cuánto se levantan las puntas. */
  sori: 0.5,
  /** El gakuzuka, entre el nuki y el shimaki. */
  strut: 0.3,
} as const;

/** La cara de abajo del nuki, sin alzada: lo que tiene que quedar sobre la cámara. */
export const INARI_NUKI_BOTTOM = INARI.nukiY - INARI.nukiHeight / 2;

/**
 * Lo que se estira con la alzada: los pilares, entre el pie negro y un poco
 * por debajo del nuki. Por encima, todo sube entero —nuki, gakuzuka, daiwa,
 * shimaki, kasagi—; por debajo, nada.
 */
export const INARI_STRETCH: readonly [number, number] = [INARI.baseHeight, INARI_NUKI_BOTTOM - 0.05];

/** Lo que se levanta el kasagi en la x local (−span/2…span/2 más el vuelo). */
export function inariSori(x: number): number {
  const half = INARI.span / 2 + INARI.kasagiOverhang;
  return INARI.sori * Math.min(1, Math.abs(x) / half) ** 3.2;
}

/** Lo alto del torii sin alzada: la tapa del kasagi en sus puntas. */
export const INARI_HEIGHT = INARI.shimakiBottom + INARI.shimakiHeight + INARI.kasagiHeight + INARI.kasagiCap + INARI.sori;

/** La altura a la que queda un punto de la geometría con la alzada `lift` (la cuenta del shader). */
export function inariLift(y: number, lift: number): number {
  const [from, to] = INARI_STRETCH;
  return y + lift * Math.min(1, Math.max(0, (y - from) / (to - from)));
}

/** Lo que ocupa en el suelo: los dos pilares, con su pie. */
export const INARI_FOOTPRINTS: readonly { x: number; r: number }[] = [
  { x: -INARI.span / 2, r: INARI.baseRadius[0] },
  { x: INARI.span / 2, r: INARI.baseRadius[0] },
];
