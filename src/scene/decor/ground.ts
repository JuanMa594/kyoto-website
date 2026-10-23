/**
 * Cómo se tiende algo plano sobre el terreno: su altura y la normal de la
 * pendiente. Módulo puro. Lo usan el musgo y las sombras de contacto, que son
 * cuadrados acostados en el suelo.
 */

import { stairTop } from '@/scene/path/stairs';
import { groundY, terrainHeight } from '@/scene/systems/elevation';

/** Cuánto se levanta del terreno: sin esto, el parche parpadea con él. */
export const DECAL_LIFT = 0.012;

export interface GroundPose {
  readonly y: number;
  readonly normal: readonly [number, number, number];
}

/**
 * La altura del suelo (más el despegue) y su normal, por diferencias. Sobre
 * las gradas (Fase 6A) la huella es llana a lo largo del camino: la diferencia
 * en z cruzaría una contrahuella y tumbaría el parche, así que sólo cuenta la
 * de x (el bisel de los lados).
 */
export function groundPose(x: number, z: number, lift = DECAL_LIFT): GroundPose {
  const onStairs = stairTop(x, z) > terrainHeight(x, z);
  const dx = groundY(x + 0.25, z) - groundY(x - 0.25, z);
  const dz = onStairs ? 0 : groundY(x, z + 0.25) - groundY(x, z - 0.25);
  const nx = -dx / 0.5;
  const nz = -dz / 0.5;
  const length = Math.hypot(nx, 1, nz);
  return { y: groundY(x, z) + lift, normal: [nx / length, 1 / length, nz / length] };
}
