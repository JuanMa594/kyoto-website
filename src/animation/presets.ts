/**
 * Curvas y duraciones — un solo vocabulario de ritmo para el DOM y la escena.
 *
 * Las cuatro curvas viven en `tokens.css` como `cubic-bezier(...)` porque el
 * CSS es quien las necesita en su sintaxis nativa. GSAP no entiende ese
 * formato, así que aquí se parsean y se registran como easings con nombre: a
 * partir de ese momento `ease: 'washi'` en una tween y `var(--ease-washi)` en
 * una transición CSS son **exactamente la misma curva**. Sin esto acabaríamos
 * con dos juegos de curvas parecidas pero distintas, que es justo lo que hace
 * que un sitio se sienta descosido.
 *
 * Se importa `gsap` del paquete y no de `./gsap` a propósito: así no hay ciclo
 * de imports con el motor, que es quien llama a `registerPresets()`. El módulo
 * de GSAP es un singleton, de modo que es la misma instancia.
 */

import { gsap } from 'gsap';

import { readCssSeconds, readCssVar } from '@/lib/css-vars';

export type EaseName = 'washi' | 'viento' | 'piedra' | 'spring';

/** Coordenadas de respaldo, copia literal de `tokens.css`. */
const FALLBACK_CURVES: Record<EaseName, readonly [number, number, number, number]> = {
  washi: [0.22, 0.61, 0.36, 1],
  viento: [0.33, 0, 0.15, 1],
  piedra: [0.65, 0, 0.35, 1],
  spring: [0.34, 1.56, 0.64, 1],
};

const FALLBACK_DURATIONS = {
  rapido: 0.28,
  medio: 0.6,
  largo: 1.2,
  viaje: 1.8,
} as const;

export type DurationName = keyof typeof FALLBACK_DURATIONS;

/**
 * Evalúa una curva cúbica de Bézier con extremos fijos en (0,0) y (1,1), que
 * es la forma que tiene `cubic-bezier()` en CSS.
 *
 * El detalle que no es obvio: la curva da *x* e *y* en función de un parámetro
 * `t` que **no es el tiempo**. Para animar hace falta lo contrario — dado el
 * tiempo (x), encontrar el progreso (y) —, así que hay que invertir x(t). Se
 * hace con Newton-Raphson, que converge en cuatro o cinco vueltas, y con
 * bisección de respaldo por si la pendiente se aplana (le pasa a las curvas muy
 * horizontales al principio, como `--ease-viento`).
 */
function cubicBezierEase(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (progress: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) return sampleY(t);
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }

    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < 24 && high - low > 1e-6; i += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) break;
      if (error > 0) high = t;
      else low = t;
      t = (low + high) / 2;
    }

    return sampleY(t);
  };
}

const CUBIC_BEZIER = /cubic-bezier\(([^)]+)\)/;

function curveFromToken(name: EaseName): (progress: number) => number {
  const raw = readCssVar(`--ease-${name}`, '');
  const match = CUBIC_BEZIER.exec(raw);
  const parsed = match?.[1]?.split(',').map((part) => Number.parseFloat(part)) ?? [];

  const points =
    parsed.length === 4 && parsed.every((value) => Number.isFinite(value))
      ? (parsed as [number, number, number, number])
      : FALLBACK_CURVES[name];

  return cubicBezierEase(points[0], points[1], points[2], points[3]);
}

let registered = false;

/**
 * Registra las cuatro curvas en GSAP. Idempotente: en desarrollo React monta
 * dos veces con StrictMode y el motor puede arrancar más de una vez.
 */
export function registerPresets(): void {
  if (registered || typeof window === 'undefined') return;

  for (const name of Object.keys(FALLBACK_CURVES) as EaseName[]) {
    gsap.registerEase(name, curveFromToken(name));
  }

  registered = true;
}

let durations: Record<DurationName, number> | null = null;

/** Las duraciones del sitio, en segundos. Se leen una vez y se cachean. */
export function motionDurations(): Record<DurationName, number> {
  durations ??= {
    rapido: readCssSeconds('--dur-rapido', FALLBACK_DURATIONS.rapido),
    medio: readCssSeconds('--dur-medio', FALLBACK_DURATIONS.medio),
    largo: readCssSeconds('--dur-largo', FALLBACK_DURATIONS.largo),
    viaje: readCssSeconds('--dur-viaje', FALLBACK_DURATIONS.viaje),
  };

  return durations;
}
