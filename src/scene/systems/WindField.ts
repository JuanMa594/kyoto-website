/**
 * El viento de la escena.
 *
 * Un solo viento para todo el sitio, leído por todos: los pétalos y las hojas
 * (Fase 2B), el bambú, la deriva de las aves y el volumen del ruido de viento
 * (Fase 2C). Que sea uno solo es el punto — si cada sistema improvisara el
 * suyo, la ráfaga que despeina un cerezo no sería la que arrastra los pétalos
 * ni la que se oye, y el cuadro dejaría de sentirse como un mismo lugar.
 *
 * No es un hook ni vive en el store a propósito: cambia sesenta veces por
 * segundo y meterlo en React provocaría sesenta renders por segundo. Es un
 * objeto mutable de módulo que **sólo escribe `<WindDriver>`**; los demás lo
 * leen dentro de su propio `useFrame` o lo vuelcan a un uniform de shader.
 *
 * El viento no sopla parejo: el PLAN pide que "de un momento a otro sople". De
 * ahí la máquina de ráfagas —espera, sube, sostiene, baja— con los tiempos en
 * `tokens.css`.
 */

import { readCssSeconds } from '@/lib/css-vars';
import { clamp, damp, lerp, mulberry32, smoothstep } from '@/lib/procedural';

export interface WindReading {
  /** Dirección sobre el plano XZ, en radianes. 0 = hacia +X (de izquierda a derecha). */
  angle: number;
  /** Intensidad total: la base de la estación más la ráfaga. */
  strength: number;
  /** Sólo la base de la estación, ya amortiguada al cambiar de zona. */
  base: number;
  /** Sólo la ráfaga, 0–1. El sonido la usa para el crescendo. */
  gust: number;
  /** El vector ya resuelto, listo para sumarse a una velocidad. */
  x: number;
  z: number;
  /** Segundos acumulados de escena. Sirve de reloj a los shaders. */
  time: number;
}

/**
 * Sopla de izquierda a derecha y ligeramente hacia la cámara, en la misma
 * dirección que la luz rasante de la escena: así las partículas cruzan el
 * cuadro en diagonal en vez de en horizontal, que se lee plano.
 */
const BASE_ANGLE = 0.3;

/** Lo que cuesta que el viento adopte la base de la estación nueva. */
const BASE_LAMBDA = 0.6;

export const WIND: WindReading = {
  angle: BASE_ANGLE,
  strength: 0,
  base: 0,
  gust: 0,
  x: 0,
  z: 0,
  time: 0,
};

type GustPhase = 'espera' | 'sube' | 'sostiene' | 'baja';

interface GustTiming {
  minGap: number;
  maxGap: number;
  attack: number;
  release: number;
}

let timing: GustTiming | null = null;

function gustTiming(): GustTiming {
  timing ??= {
    minGap: readCssSeconds('--gust-min-gap', 8),
    maxGap: readCssSeconds('--gust-max-gap', 20),
    attack: readCssSeconds('--gust-attack', 1.1),
    release: readCssSeconds('--gust-release', 3.2),
  };

  return timing;
}

// Semilla fija: dos cargas de la misma página producen el mismo viento, que es
// lo que permite comparar capturas al calibrar.
const random = mulberry32(9137);

let phase: GustPhase = 'espera';
let phaseTime = 0;
let phaseDuration = 0;
let peak = 0;

function enterPhase(next: GustPhase, duration: number): void {
  phase = next;
  phaseTime = 0;
  phaseDuration = Math.max(0.001, duration);
}

function beginWait(): void {
  const { minGap, maxGap } = gustTiming();
  enterPhase('espera', lerp(minGap, maxGap, random()));
}

beginWait();

/** Avanza la máquina de ráfagas y devuelve su valor actual, 0–1. */
function advanceGust(delta: number): number {
  const { attack, release } = gustTiming();
  phaseTime += delta;

  const progress = clamp(phaseTime / phaseDuration, 0, 1);

  switch (phase) {
    case 'espera':
      if (progress >= 1) {
        // Ráfagas desiguales: unas apenas se notan, otras despeinan el cuadro.
        peak = 0.45 + random() * 0.55;
        enterPhase('sube', attack * (0.7 + random() * 0.6));
      }
      return 0;

    case 'sube':
      if (progress >= 1) enterPhase('sostiene', 0.4 + random() * 1.6);
      return smoothstep(0, 1, progress) * peak;

    case 'sostiene':
      if (progress >= 1) enterPhase('baja', release * (0.8 + random() * 0.5));
      // Un temblor pequeño mientras aguanta: una racha sostenida y perfectamente
      // plana no existe, y se nota enseguida.
      return peak * (0.93 + 0.07 * Math.sin(WIND.time * 6.3));

    case 'baja':
      if (progress >= 1) {
        beginWait();
        return 0;
      }
      return (1 - smoothstep(0, 1, progress)) * peak;
  }
}

/**
 * Un paso del viento. Lo llama `<WindDriver>` una vez por frame con la
 * intensidad base de la estación activa (`station.ambient.wind`).
 */
export function updateWind(delta: number, baseTarget: number): void {
  WIND.time += delta;
  WIND.base = damp(WIND.base, baseTarget, BASE_LAMBDA, delta);
  WIND.gust = advanceGust(delta);

  // La ráfaga pesa más donde ya hay viento: en Gion, con la base en 0.15, una
  // racha es una corriente de callejón; en la sakura, con 0.5, es un vendaval
  // de pétalos.
  WIND.strength = WIND.base + WIND.gust * (0.45 + WIND.base * 0.5);

  // La dirección deriva despacio, y la ráfaga la tuerce un poco al pasar.
  WIND.angle =
    BASE_ANGLE +
    0.42 * Math.sin(WIND.time * 0.07) +
    0.18 * Math.sin(WIND.time * 0.031 + 1.3) +
    WIND.gust * 0.22;

  WIND.x = Math.cos(WIND.angle) * WIND.strength;
  WIND.z = Math.sin(WIND.angle) * WIND.strength;
}

/** Deja el aire quieto. Lo llama el driver cuando se apaga el movimiento. */
export function resetWind(): void {
  WIND.strength = 0;
  WIND.base = 0;
  WIND.gust = 0;
  WIND.x = 0;
  WIND.z = 0;
  beginWait();
}
