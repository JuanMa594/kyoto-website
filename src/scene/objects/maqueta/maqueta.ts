/**
 * Las medidas de la maqueta de Japón de Ubicación (Fase 5A), como números
 * puros.
 *
 * Viven aparte de la geometría para que las huellas, el musgo y `check:path`
 * no carguen three. Origen: el centro del pie del atril, en el suelo.
 * Unidades del mundo: el torii de la Home mide 7,9.
 *
 * La maqueta es una **bandeja** de piedra (el mar) sostenida por un **atril**
 * de tambores, inclinada hacia la cámara. Encima, Japón en dos capas: la
 * **base** de costa (cara sumi, cantos koke) y las **losas** de las
 * prefecturas (cara washi), encogidas un pelo para que entre ellas asome la
 * base: las juntas de tinta de `2.png`. El espacio de la bandeja tiene la
 * cara de arriba en y = 0, x al este y z al sur.
 */

export const MAQUETA_SIZE = {
  /** Lado de la bandeja (cuadrada). El mapa mide `MAP_SPAN` de lado mayor. */
  tray: 5,
  trayThickness: 0.14,
  /** Altura del centro de la cara de la bandeja sobre el suelo: el eje del giro. */
  pivotY: 3.9,
  /** Radio de los tambores del atril. */
  columnRadius: 0.42,
  /** Grosor de la base de costa y de las losas. */
  baseHeight: 0.05,
  slabHeight: 0.09,
  /**
   * Lo que se ve del contenido: la fracción de la bandeja dentro de los
   * planos de recorte (el borde redondeado queda fuera).
   */
  clip: 0.95,
  /** Radio de lo que toca el suelo: donde crece el musgo. */
  foot: 0.6,
  /** Alto máximo, con el pin y lo que sube una losa. */
  top: 7.2,
} as const;

/** El zoom a Kyoto: de la pose de Japón (`t = 0`) a la de Kinki (`t = 1`). */
export const MAQUETA_ZOOM = {
  /** Inclinación de la bandeja hacia la cámara, en radianes. */
  tiltJapon: (48 * Math.PI) / 180,
  /** Sin cámara a la que mirar; con ella, la de `faceCamera` (de frente). */
  tiltKyoto: (80 * Math.PI) / 180,
  /** Aumento del contenido alrededor de Kyoto. */
  scale: 4.2,
  /** Lo que crece el grosor de las losas en el zoom (menos que el plano). */
  heightScale: 1.5,
  /** Dónde cae Kyoto en la bandeja al terminar: al norte del centro, para que Kinki quede centrada. */
  kyotoAt: [0.18, -0.5] as readonly [number, number],
  /** Lo que se adelanta la bandeja, de pie, para quedar delante de la columna. */
  forward: 0.8,
  /** Segundos de la línea de tiempo. */
  duration: 1.6,
} as const;

/**
 * La bandeja en planta, en el espacio del objeto: medio ancho (x) y media
 * profundidad (z). La profundidad es la de la pose más tumbada (Japón), con
 * el grosor de la bandeja y un margen.
 */
export const MAQUETA_PLAN = {
  hx: MAQUETA_SIZE.tray / 2 + 0.05,
  hz:
    (MAQUETA_SIZE.tray / 2) * Math.cos(MAQUETA_ZOOM.tiltJapon) +
    MAQUETA_SIZE.trayThickness * Math.sin(MAQUETA_ZOOM.tiltJapon) +
    0.05,
} as const;

/** Cuánto suben o bajan las losas, en unidades, y cuánto se funden con el mar. */
export const MAQUETA_LIFT = {
  /** Kyoto, elevada desde el principio. */
  kyoto: 0.08,
  /** La prefectura bajo el cursor. */
  hover: 0.12,
  /** Lo que se hunde lo de fuera de Kinki en el zoom. */
  sunk: -0.035,
  /** Cuánto se funde con el color del mar lo de fuera de Kinki (no del todo: queda la silueta). */
  sea: 0.88,
} as const;
