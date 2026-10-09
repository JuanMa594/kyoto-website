/**
 * Cómo se doblan el bambú y los arbustos con el viento.
 *
 * La flexión **no es una función del viento**: es un oscilador amortiguado al
 * que el viento empuja. Si arrecia, la caña se arquea más y se pasa un poco
 * antes de asentarse; si amaina, rebota hacia su sitio, cruza un poco al otro
 * lado y se asienta en dos o tres vaivenes; si sopla parejo, se queda arqueada
 * y oscila alrededor de esa curva. Es lo que pidió el usuario al diseñar la
 * Fase 4.
 *
 * Hay siete muelles: tres rigideces de caña (altas y delgadas, blandas y
 * lentas; bajas, rígidas) con dos retardos cada una, para que un macizo nunca
 * se mueva como un bloque, y uno para los arbustos. Se integran **aquí, en la
 * CPU**: al shader le llega la flexión ya integrada (uBend), que es continua
 * por construcción —la lección de los pétalos: nada de tiempo × velocidad—.
 *
 * Mismo criterio que WIND: objeto de módulo con **un solo escritor**,
 * WindDriver, que llama a updateSway después de updateWind.
 */

import { WIND } from './WindField';

export interface Spring {
  /** Frecuencia propia, rad/s. */
  readonly omega: number;
  /** Amortiguación: más baja, más rebote. */
  readonly zeta: number;
  /** Flexión en la punta, en fracción del alto, por unidad de fuerza del viento. */
  readonly gain: number;
  /** Con cuánto retraso le llega el viento, en segundos. */
  readonly delay: number;
}

export const SPRINGS: readonly Spring[] = [
  { omega: 2.4, zeta: 0.32, gain: 0.16, delay: 0 },
  { omega: 2.4, zeta: 0.32, gain: 0.16, delay: 0.35 },
  { omega: 3.2, zeta: 0.38, gain: 0.12, delay: 0.1 },
  { omega: 3.2, zeta: 0.38, gain: 0.12, delay: 0.5 },
  { omega: 4.2, zeta: 0.45, gain: 0.08, delay: 0.2 },
  { omega: 4.2, zeta: 0.45, gain: 0.08, delay: 0.6 },
  { omega: 7, zeta: 0.55, gain: 0.05, delay: 0.15 },
];

/** El muelle de los arbustos. */
export const SHRUB_SPRING = 6;

/** El muelle de una caña: por su alto, y una moneda para el retardo. */
export function culmSpring(height: number, coin: number): number {
  const stiffness = height > 8 ? 0 : height > 6.2 ? 2 : 4;
  return stiffness + (coin < 0.5 ? 0 : 1);
}

export interface SpringState {
  x: number;
  v: number;
}

/** Un paso del oscilador, semi-implícito: estable con dt ≤ 1/30. */
export function stepSpring(state: SpringState, target: number, spring: Spring, dt: number): void {
  const accel = spring.omega * spring.omega * (target - state.x) - 2 * spring.zeta * spring.omega * state.v;
  state.v += accel * dt;
  state.x += state.v * dt;
}

/** Lo que leen los shaders. Se comparte el objeto: actualizarlo basta. */
export const SWAY_UNIFORMS = {
  uBend: { value: new Float32Array(SPRINGS.length * 2) },
  uSwayTime: { value: 0 },
  uSwayStrength: { value: 0 },
};

/* ── El viento de hace un momento ───────────────────────────────────────── */

const HISTORY = 128;
const times = new Float64Array(HISTORY);
const windX = new Float32Array(HISTORY);
const windZ = new Float32Array(HISTORY);
let head = 0;
let filled = 0;

function remember(time: number, x: number, z: number): void {
  head = (head + 1) % HISTORY;
  times[head] = time;
  windX[head] = x;
  windZ[head] = z;
  filled = Math.min(HISTORY, filled + 1);
}

const past = { x: 0, z: 0 };

/** El viento en `time`, interpolado del historial (el más viejo si no llega). */
function windAt(time: number): { x: number; z: number } {
  past.x = windX[head]!;
  past.z = windZ[head]!;
  for (let k = 0; k < filled - 1; k += 1) {
    const newer = (head - k + HISTORY) % HISTORY;
    const older = (newer - 1 + HISTORY) % HISTORY;
    const t1 = times[newer]!;
    const t0 = times[older]!;
    if (time <= t1 && time >= t0) {
      const f = t1 > t0 ? (time - t0) / (t1 - t0) : 1;
      past.x = windX[older]! + (windX[newer]! - windX[older]!) * f;
      past.z = windZ[older]! + (windZ[newer]! - windZ[older]!) * f;
      return past;
    }
    past.x = windX[older]!;
    past.z = windZ[older]!;
  }
  return past;
}

const states = SPRINGS.map(() => ({ x: { x: 0, v: 0 }, z: { x: 0, v: 0 } }));

/** Pasos internos de 1/120 s: el muelle más rígido no se vuelve inestable a 30 fps. */
const SUBSTEP = 1 / 120;

/** Un paso de todos los muelles. Lo llama WindDriver, después de updateWind. */
export function updateSway(delta: number): void {
  remember(WIND.time, WIND.x, WIND.z);
  const steps = Math.max(1, Math.ceil(delta / SUBSTEP));
  const dt = delta / steps;
  const bend = SWAY_UNIFORMS.uBend.value;

  SPRINGS.forEach((spring, i) => {
    const wind = windAt(WIND.time - spring.delay);
    const state = states[i]!;
    for (let k = 0; k < steps; k += 1) {
      stepSpring(state.x, wind.x * spring.gain, spring, dt);
      stepSpring(state.z, wind.z * spring.gain, spring, dt);
    }
    bend[i * 2] = state.x.x;
    bend[i * 2 + 1] = state.z.x;
  });

  SWAY_UNIFORMS.uSwayTime.value = WIND.time;
  SWAY_UNIFORMS.uSwayStrength.value = WIND.strength;
}

/** Todo quieto. Lo llama WindDriver al apagarse el movimiento. */
export function resetSway(): void {
  for (const state of states) {
    state.x.x = 0;
    state.x.v = 0;
    state.z.x = 0;
    state.z.v = 0;
  }
  SWAY_UNIFORMS.uBend.value.fill(0);
  SWAY_UNIFORMS.uSwayStrength.value = 0;
  filled = 0;
}
