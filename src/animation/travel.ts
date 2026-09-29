/**
 * El viaje: cómo llega la cámara a una estación cuando no la lleva el scroll.
 *
 * La posición de la cámara es siempre **objetivo del scroll + desfase de
 * viaje**. Cuando el objetivo salta —un enlace, «atrás», un clic en el
 * sidebar—, el salto no se aplica: se guarda entero en el desfase, de modo que
 * en ese frame la cámara no se mueve, y GSAP lleva el desfase a cero con la
 * curva `piedra`. El scroll durante el viaje se suma sin saltos, porque los dos
 * términos son independientes; y un segundo salto a mitad de viaje se acumula
 * en el desfase igual que el primero.
 *
 * Mismo criterio que `WIND`: objeto de módulo, un solo escritor (este archivo,
 * a petición del rig), leído dentro de `useFrame`.
 */

import { gsap } from 'gsap';

import { JOURNEY, PATH_LENGTH } from '@/config/journey';
import { clamp } from '@/lib/procedural';

import { motionDurations, registerPresets } from './presets';

export const TRAVEL = {
  /** Lo que le falta a la cámara para llegar a su objetivo. */
  offset: 0,
  /** |desfase| al empezar el viaje en curso (0 en reposo). */
  span: 0,
};

/**
 * A partir de cuántas unidades en un frame un cambio del objetivo se trata
 * como salto. El scroll suave de Lenis nunca llega a tanto.
 */
export const JUMP_THRESHOLD = 6;

/** Una estación, en profundidad media. */
const SEGMENT = PATH_LENGTH / (JOURNEY.length - 1);
const SHORTEST = 0.6;
const LONGEST = 4;

/**
 * Cuánto dura un viaje: `--dur-viaje` (1,8 s) para una estación, y crece con
 * la raíz de la distancia hasta 4 s para el camino entero. Más lejos es más
 * tiempo, pero no proporcionalmente: nadie quiere diez segundos de travelling.
 */
export function travelDuration(distance: number, base = 1.8): number {
  return clamp(base * Math.sqrt(Math.abs(distance) / SEGMENT), SHORTEST, LONGEST);
}

/** El desfase nuevo tras un salto del objetivo: la cámara no se mueve. */
export function jumpOffset(offset: number, previousTarget: number, target: number): number {
  return offset + previousTarget - target;
}

/** Absorbe un salto del objetivo y arranca (o reanuda) el viaje. */
export function absorbJump(previousTarget: number, target: number): void {
  // `piedra` se registra con el motor de movimiento, pero el viaje puede
  // ocurrir antes de que el motor arranque. Es idempotente.
  registerPresets();
  gsap.killTweensOf(TRAVEL);

  TRAVEL.offset = jumpOffset(TRAVEL.offset, previousTarget, target);
  TRAVEL.span = Math.abs(TRAVEL.offset);

  gsap.to(TRAVEL, {
    offset: 0,
    duration: travelDuration(TRAVEL.span, motionDurations().viaje),
    ease: 'piedra',
    onComplete: () => {
      TRAVEL.span = 0;
    },
  });
}

/** Sin viaje: la cámara salta. Primera llegada, modo 静, movimiento reducido. */
export function cancelTravel(): void {
  gsap.killTweensOf(TRAVEL);
  TRAVEL.offset = 0;
  TRAVEL.span = 0;
}

export function isTraveling(): boolean {
  return Math.abs(TRAVEL.offset) > 0.05;
}
