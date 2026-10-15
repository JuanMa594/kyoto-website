import { JOURNEY, type HillProfile, type Side } from '@/config/journey';
import { lerp, smoothstep } from '@/lib/procedural';
import { pathX, pathY, zoneBlend } from '@/scene/path/journeyPath';

/**
 * El relieve del terreno, como función pura y **global**.
 *
 * Desde la Fase 3A el terreno ya no depende de la estación activa: es un solo
 * mundo, y la altura de cada punto es la del camino a esa profundidad más las
 * colinas de sus costados. La misma función la usan la malla del suelo, las
 * piedras, la cámara y la fauna, así que nada flota ni se hunde.
 *
 * La regla dura de composición vive aquí: las colinas se miden desde el **eje
 * del camino** (`u = x − pathX(d)`), no desde x = 0, y `sideMask()` vale 0 en
 * |u| < 7. Ninguna colina puede invadir el pasillo por donde va el sujeto —
 * tampoco en las curvas—, y no depende de acordarse: es imposible por
 * construcción.
 *
 * Lo que había en la Fase 1 para que el relieve no apareciera en primer plano
 * (una máscara por z) era relativo a una cámara quieta. Con la cámara
 * avanzando, las colinas pasan a los lados, casi siempre fuera de cuadro.
 */

/** Altura del plano base. Todo lo que pisa el suelo parte de aquí. */
export const GROUND_Y = -1;

/** Semiancho del pasillo central que el relieve nunca invade. */
export const CENTER_CLEAR = 7;

/** Cuánto tarda el relieve en alcanzar su amplitud plena a partir del pasillo. */
const CENTER_FADE = 11;

const HILL_AMPLITUDE: Record<HillProfile, number> = {
  ninguna: 0,
  suaves: 2.6,
  montanosa: 9,
};

/** Amplitud de cada costado en cada estación, precalculada. */
const SIDE_AMPLITUDE: readonly Record<Side, number>[] = JOURNEY.map((station) => {
  const env = station.environment;
  const amplitude = HILL_AMPLITUDE[env.hills];
  return {
    izquierda: env.hillSides.includes('izquierda') ? amplitude : 0,
    derecha: env.hillSides.includes('derecha') ? amplitude : 0,
  };
});

/**
 * Amplitud del relieve de un costado en `d`: la de cada estación, mezclada por
 * pesos de zona. Al ir de Eventos a Fushimi Inari las lomas suaves crecen
 * hasta montaña poco a poco, sin escalón.
 */
export function hillAmplitude(d: number, side: Side): number {
  const zone = zoneBlend(d);
  return lerp(SIDE_AMPLITUDE[zone.from]![side], SIDE_AMPLITUDE[zone.to]![side], zone.t);
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
 * Altura del terreno en (x, z), relativa a `GROUND_Y`: la del camino a esa
 * profundidad, más las colinas si el punto cae fuera del pasillo.
 */
export function terrainHeight(x: number, z: number): number {
  const d = -z;
  const u = x - pathX(d);
  const amplitude = hillAmplitude(d, u < 0 ? 'izquierda' : 'derecha');
  const hills =
    amplitude === 0
      ? 0
      : amplitude * smoothstep(CENTER_CLEAR, CENTER_CLEAR + CENTER_FADE, Math.abs(u)) * ridge(x, z);

  return pathY(d) + hills;
}

/** La y del mundo en la que está el suelo. */
export function groundY(x: number, z: number): number {
  return GROUND_Y + terrainHeight(x, z);
}
