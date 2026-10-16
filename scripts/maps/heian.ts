/**
 * El plano de Heian-kyō en 794, como dato (Fase 5B). Metros, con el origen en
 * la esquina noroeste del recinto: x hacia el este, y hacia el sur.
 *
 * Es el plano bien documentado de la capital, simplificado para un mapa
 * antiguo pintado: unos 4,5 km de este a oeste por 5,2 km de norte a sur; el
 * recinto del palacio (大内裏) al norte, entre Ichijō y Nijō, y algo más de un
 * kilómetro de ancho; la avenida Suzaku (朱雀大路), de 85 m, por el centro,
 * hasta la puerta de Rashōmon (羅城門), entre los templos del Este y del Oeste
 * (東寺, 西寺). Al este corre el Kamo y al oeste el Katsura.
 */

export const HEIAN = {
  width: 4500,
  height: 5200,
  /** Las grandes avenidas este–oeste, de norte a sur: 一条 … 九条. Entre 一条 y 二条, el palacio. */
  jo: [0, 1400, 1940, 2480, 3020, 3560, 4100, 4640, 5200],
  /** Las avenidas norte–sur, de oeste a este; la del centro (2250) es Suzaku. */
  bo: [0, 560, 1120, 1690, 2250, 2810, 3380, 3940, 4500],
  suzaku: { x: 2250, width: 85 },
  palace: { x0: 1690, x1: 2810, y0: 0, y1: 1400 },
  rashomon: { x: 2250, y: 5200 },
  /** Los dos templos oficiales, a cada lado de Rashōmon (su recinto, en m). */
  toji: { x: 2810, y: 4880, size: 250 },
  saiji: { x: 1690, y: 4880, size: 250 },
  /** Los ríos, como polilíneas suaves de norte a sur. */
  kamo: [
    [4980, -350],
    [4870, 900],
    [4930, 2200],
    [4820, 3500],
    [4900, 4700],
    [4760, 5650],
  ],
  katsura: [
    [-520, -350],
    [-430, 1100],
    [-500, 2400],
    [-330, 3700],
    [-200, 4800],
    [120, 5650],
  ],
} as const;

/** Lo que abarca el dibujo, con los ríos y un margen, en metros. */
export const HEIAN_EXTENT = { x0: -700, x1: 5200, y0: -450, y1: 5750 } as const;

export const JO_NAMES = ['一条', '二条', '三条', '四条', '五条', '六条', '七条', '八条', '九条'] as const;
