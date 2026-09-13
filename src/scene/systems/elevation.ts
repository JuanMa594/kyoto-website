import type { StationEnvironment, HillProfile } from '@/config/journey';

/**
 * El relieve del terreno, como función pura.
 *
 * La misma función la usan el mesh del suelo y las piedras del camino, así que
 * una piedra nunca flota ni se hunde: apoya exactamente sobre el terreno que se
 * está dibujando.
 *
 * La regla dura de composición vive aquí: `sideMask()` vale 0 en el pasillo
 * central, así que **ninguna colina puede invadir el centro del cuadro** —
 * donde van el torii, el cerezo o la pagoda. No depende de acordarse al colocar
 * cada colina a mano; es imposible por construcción.
 */

/** Altura del plano base. Todo lo que pisa el suelo parte de aquí. */
export const GROUND_Y = -1;

/** Semiancho del pasillo central que el relieve nunca invade. */
const CENTER_CLEAR = 7;

/** Cuánto tarda el relieve en alcanzar su amplitud plena a partir del pasillo. */
const CENTER_FADE = 11;

const HILL_AMPLITUDE: Record<HillProfile, number> = {
  ninguna: 0,
  suaves: 2.6,
  montanosa: 9,
};

/** El relieve tampoco aparece en primer plano: arranca al fondo del camino. */
const HILL_START_Z = -6;
const HILL_FULL_Z = -26;

/** Distancia en la que el camino termina de ganar toda su pendiente. */
const SLOPE_FULL_Z = -22;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 0 en el centro, 1 en los costados — y sólo en los costados que la estación
 * activa. Ésta es la garantía de que el sujeto siempre tiene el cuadro libre.
 */
function sideMask(x: number, env: StationEnvironment): number {
  const side = x < 0 ? 'izquierda' : 'derecha';
  if (!env.hillSides.includes(side)) return 0;

  return smoothstep(CENTER_CLEAR, CENTER_CLEAR + CENTER_FADE, Math.abs(x));
}

/**
 * Ondulación del relieve. Suma de senos en vez de ruido: es continua, barata y
 * no deja costuras entre vértices vecinos.
 */
function ridge(x: number, z: number): number {
  return (
    0.55 * Math.sin(x * 0.11 + 1.7) +
    0.3 * Math.sin(z * 0.085 - 0.4) +
    0.22 * Math.sin((x + z) * 0.05 + 2.3) +
    0.62
  );
}

/**
 * Altura del terreno en (x, z), relativa a `GROUND_Y`.
 *
 * Dos términos que no se estorban:
 *   · las colinas, sólo a los costados y sólo al fondo,
 *   · la pendiente del camino, que sube parejo en todo el ancho (si la
 *     estación la pide) para que el camino se sienta cuesta arriba.
 */
export function terrainHeight(x: number, z: number, env: StationEnvironment): number {
  const hills =
    HILL_AMPLITUDE[env.hills] *
    sideMask(x, env) *
    smoothstep(HILL_START_Z, HILL_FULL_Z, z) *
    ridge(x, z);

  const slope = env.slope * smoothstep(0, SLOPE_FULL_Z, z);

  return hills + slope;
}
