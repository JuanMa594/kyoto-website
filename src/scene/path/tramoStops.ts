/**
 * Dónde se para la cámara en cada tramo, en profundidad. Módulo puro.
 *
 * Un tramo se camina en `cards + 1` trechos y, entre ellos, una parada de
 * lectura por tarjeta, en la que la cámara casi se detiene (`STOP_DRIFT`).
 * Aquí vive sólo la parte **de distancia** de ese reparto —qué fracción del
 * tramo avanza cada trecho y dónde cae cada parada—; la parte de scroll (los
 * vh) está en `animation/journeyScroll.ts`, que la importa.
 *
 * Vive aparte porque la necesitan dos módulos que no pueden depender uno del
 * otro: `journeyScroll` (que ya importa `journeyPath`) y `journeyPath`, que
 * pone un rellano en cada parada de los tramos con gradas (Fase 6A). Por eso
 * no importa `journeyPath`: las profundidades de las estaciones las saca de
 * `journey.ts` directamente.
 *
 * **El llano de salida** (`tramo.flat`, el de los cerezos de Eventos) se
 * camina entero en el primer trecho, antes de la primera parada: las paradas
 * se reparten **sobre lo que queda después** del llano. Sin llano, todos los
 * trechos avanzan lo mismo y el reparto es el de siempre.
 */

import { JOURNEY, PATH_LENGTH } from '@/config/journey';
import { clamp } from '@/lib/procedural';

/** Cuánto avanza la cámara mientras se lee el contenido de una estación. */
export const READING_DRIFT = 4;

/**
 * Lo que avanza la cámara mientras se lee una tarjeta, en fracción del tramo.
 * Casi nada, pero algo: con la cámara clavada el scroll se sentiría muerto.
 */
export const STOP_DRIFT = 0.008;

const DEPTHS: readonly number[] = JOURNEY.map((s) => s.pathT * PATH_LENGTH);

/**
 * La fracción del tramo que sale de la estación `i` que es llano: se camina
 * en el primer trecho, antes de cualquier parada. 0 sin llano.
 */
export function tramoLead(i: number): number {
  const here = DEPTHS[i];
  const next = DEPTHS[i + 1];
  if (here === undefined || next === undefined) return 0;
  const reading = here + READING_DRIFT;
  const flat = JOURNEY[i]!.tramo.flat ?? 0;
  return clamp((here + flat - reading) / (next - reading), 0, 1);
}

/**
 * Lo que avanza cada uno de los `cards + 1` trechos, en fracción del tramo. El
 * primero suma el llano (`lead`); el resto del tramo, quitadas las paradas, se
 * reparte a partes iguales. Suman `1 − cards · STOP_DRIFT`.
 */
export function trechoShares(cards: number, lead = 0): number[] {
  const count = Math.max(0, Math.floor(cards));
  const each = (1 - lead - count * STOP_DRIFT) / (count + 1);
  return Array.from({ length: count + 1 }, (_, k) => (k === 0 ? lead + each : each));
}

/** Los trechos del tramo que sale de la estación `i`. */
export function tramoTrechos(i: number): number[] {
  return trechoShares(JOURNEY[i]?.tramo.cards.length ?? 0, tramoLead(i));
}

/** La fracción del tramo en mitad de la parada `index` (la de su cámara quieta). */
export function cardStopFraction(shares: readonly number[], index: number): number {
  let fraction = 0;
  for (let k = 0; k <= index; k += 1) fraction += shares[k] ?? 0;
  return fraction + index * STOP_DRIFT + STOP_DRIFT / 2;
}

/**
 * La d absoluta del punto de interés de la cámara en mitad de la parada
 * `index` del tramo que sale de la estación `i`.
 */
export function cardStopDepth(i: number, index: number): number {
  const here = DEPTHS[i] ?? 0;
  const next = DEPTHS[i + 1];
  if (next === undefined) return here;
  const reading = here + READING_DRIFT;
  return reading + (next - reading) * cardStopFraction(tramoTrechos(i), index);
}
