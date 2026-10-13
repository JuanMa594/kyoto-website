import { PREFECTURE_NAMES } from './names.generated';

/**
 * El puente entre el DOM y la maqueta (Fase 5A). El canvas no captura el
 * puntero (regla dura 5): lo escucha `MaquetaInput` en `window` y lo deja
 * aquí; la escena hace el raycast y publica lo que hay bajo el cursor, el
 * zoom en curso y dónde caen las etiquetas, que lee el DOM desde
 * `gsap.ticker`. Cambia a 60 fps: por eso no vive en Zustand.
 *
 * **Un único escritor por campo**: el puntero y los clics, `MaquetaInput`; el
 * resto, `MaquetaJapon`.
 */

export interface MaquetaClick {
  /** En −1…1, como el puntero. */
  readonly x: number;
  readonly y: number;
  /** Un toque (sin hover): muestra el nombre unos segundos. */
  readonly touch: boolean;
}

const COUNT = PREFECTURE_NAMES.length;

export const MAQUETA = {
  /** Escribe `MaquetaInput`. En −1…1, la y hacia arriba. */
  pointer: { x: 0, y: 0, present: false, moved: false },
  /** Escribe `MaquetaInput`; los consume `MaquetaJapon`. */
  clicks: [] as MaquetaClick[],

  /**
   * Pide un frame. Con movimiento reducido el canvas sólo pinta a demanda
   * (`frameloop="demand"`): sin esto, ni el cursor ni el zoom se verían. Lo
   * pone `MaquetaJapon`; lo llama `MaquetaInput` en cada gesto.
   */
  wake: () => {},

  /** Si la cámara está en la estación: sólo entonces se puede tocar. */
  active: false,
  /** La prefectura bajo el cursor (índice en `PREFECTURES`), −1 si ninguna. */
  hover: -1,
  /** Si el cursor está sobre Kyoto: el DOM pone la mano. */
  overKyoto: false,
  /** 0 = Japón, 1 = Kinki. Lo lleva una tween de GSAP en `MaquetaJapon`. */
  zoomT: 0,
  /**
   * El pin en la ventana, en px: su centro, lo alto y lo bajo. Las etiquetas
   * lo esquivan.
   */
  pin: { x: 0, top: 0, bottom: 0, on: false },
  /** Dónde cae el nombre de cada prefectura, en px de la ventana, y si se ve. */
  labelX: new Float32Array(COUNT),
  labelY: new Float32Array(COUNT),
  labelOn: new Uint8Array(COUNT),
};
