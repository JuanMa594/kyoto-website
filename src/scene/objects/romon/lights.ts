/**
 * Los faroles del rōmon (Fase 6A): apagados —papel con un brillo mínimo—
 * hasta que se toca la puerta; entonces se encienden en ~1 s y siguen así
 * mientras la tarjeta del templo está abierta. Al cerrarla, se apagan despacio.
 *
 * El puente entre el DOM (la tarjeta) y la escena: **un único escritor por
 * campo**. `lit` lo escribe la tarjeta del templo (`TempleReader`); `value` y
 * `wake`, el rōmon (`RomonGate.tsx`), que lleva `value` hacia `lit` cada frame.
 */
export const ROMON_LIGHTS = {
  /** Si la tarjeta del templo está abierta. */
  lit: false,
  /** Lo encendidos que están ahora, 0–1. */
  value: 0,
  /** Pide un frame: con movimiento reducido el canvas sólo pinta a demanda. */
  wake: () => {},
};

/** En cuánto se encienden y se apagan, en segundos (constantes de la exponencial). */
export const LIGHT_ON = 0.35;
export const LIGHT_OFF = 0.9;
