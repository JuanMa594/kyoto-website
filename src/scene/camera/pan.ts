/**
 * El paneo hacia el monumento de un lugar (Fase 6A): al tocar el rōmon, la
 * cámara se vuelve **un poco** hacia él, y al cerrar la tarjeta del templo
 * vuelve sola. Es el primer movimiento de cámara que no pide el scroll, así
 * que va acotado por todos lados:
 *
 *   · como mucho `PAN_YAW` de giro (~6°), y un desplazamiento lateral pequeño
 *     de la cámara hacia el mismo lado;
 *   · entra en ~1,6 s y sale en ~1,2 s, con una exponencial (sin escalones de
 *     velocidad) y nunca más deprisa que `RIG_LIMITS.maxYawRate`;
 *   · **sólo con la cámara asentada en la estación**: si se viaja o se camina,
 *     no hay paneo (la tarjeta sí se abre);
 *   · con 静 o movimiento reducido, ninguno.
 *
 * Objeto de módulo con **un único escritor por campo**, como `PARALLAX`:
 * `wanted` lo escribe la tarjeta del templo; `value`, `CameraRig`, que lo suma
 * al encuadre después del rig (y sigue siendo el único escritor de `PATH`).
 * Módulo puro: `check:path` lo comprueba.
 */

import { clamp } from '@/lib/procedural';

import { RIG_LIMITS } from './pathRig';

const DEG = Math.PI / 180;

/** El giro máximo, en radianes. */
export const PAN_YAW = 6 * DEG;
/** Lo que se aparta la cámara hacia el monumento, en unidades. */
export const PAN_SHIFT = 0.9;
/** En cuánto entra y sale (el 95 % de la exponencial), en segundos. */
export const PAN_IN = 1.6;
export const PAN_OUT = 1.2;

export const PAN = {
  /** −1: hacia la izquierda; 1: hacia la derecha; 0: de frente. */
  wanted: 0,
  /** Lo hecho del paneo, −1…1 (con su signo). */
  value: 0,
};

/**
 * Un paso del paneo hacia `wanted`, o hacia 0 si la cámara no está asentada.
 * Devuelve el nuevo valor. La velocidad de giro resultante (`PAN_YAW` por la
 * del valor) nunca pasa de `RIG_LIMITS.maxYawRate`.
 */
export function stepPan(value: number, wanted: number, settled: boolean, dt: number): number {
  const target = settled ? clamp(wanted, -1, 1) : 0;
  const into = Math.abs(target) > Math.abs(value);
  // 3/τ: el 95 % de una exponencial en τ segundos.
  const lambda = 3 / (into ? PAN_IN : PAN_OUT);
  let next = value + (target - value) * (1 - Math.exp(-lambda * Math.max(0, dt)));
  const maxStep = (RIG_LIMITS.maxYawRate * Math.max(0, dt)) / PAN_YAW;
  next = value + clamp(next - value, -maxStep, maxStep);
  // La cola de la exponencial, fuera: a un 1 % del final, ya está.
  return Math.abs(next - target) < 0.01 ? target : next;
}
