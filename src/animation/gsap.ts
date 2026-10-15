/**
 * El motor de movimiento: GSAP y Lenis, una sola vez y bajo un solo reloj.
 *
 * Dos detalles que son la razón de que este archivo exista:
 *
 * 1. **Un único `requestAnimationFrame`.** Lenis trae su propio bucle y GSAP
 *    tiene el suyo (`gsap.ticker`). Dejar los dos vivos significa dos rAF por
 *    frame y, peor, que el scroll suave se actualice *después* de que GSAP haya
 *    leído la posición — que es el clásico temblor de un píxel en el scroll.
 *    Por eso Lenis arranca con `autoRaf: false` y lo hace avanzar el ticker de
 *    GSAP. El `<Canvas>` de R3F conserva su propio bucle: es otra capa (WebGL)
 *    y se sincroniza sola con el navegador.
 *
 * 2. **`lagSmoothing(0)`.** Por defecto GSAP finge que un frame lento duró lo
 *    normal, para que las animaciones no den saltos. Con un scroll atado al
 *    tiempo real eso desincroniza la posición de la página respecto de la
 *    escena, así que se desactiva mientras el motor está vivo y se restaura al
 *    apagarlo.
 *
 * El motor se apaga entero con el modo 静 o con `prefers-reduced-motion`: no se
 * queda corriendo en vacío, se destruye y vuelve el scroll nativo del
 * navegador.
 */

import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { registerPresets } from './presets';

/** Valores por defecto de GSAP, para restaurarlos al apagar el motor. */
const DEFAULT_LAG_SMOOTHING: readonly [number, number] = [500, 33];

let plugins = false;
let lenis: Lenis | null = null;
let tick: ((time: number) => void) | null = null;

function registerPlugins(): void {
  if (plugins) return;
  gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
  registerPresets();
  plugins = true;
}

/**
 * Arranca el motor. Idempotente: en desarrollo, StrictMode monta los efectos
 * dos veces y este módulo es un singleton.
 */
export function startMotionEngine(): Lenis | null {
  if (typeof window === 'undefined') return null;
  if (lenis) return lenis;

  registerPlugins();

  lenis = new Lenis({
    // Interpolación por frame en vez de duración fija: responde al instante a
    // un gesto nuevo en lugar de terminar el anterior. Es lo que hace que el
    // scroll se sienta pesado pero no perezoso.
    lerp: 0.1,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.2,
    // Lo maneja el ticker de GSAP (ver cabecera).
    autoRaf: false,
    // Al cambiar de ruta, la inercia sobrante llevaría el scroll de la página
    // nueva a un sitio arbitrario.
    stopInertiaOnNavigate: true,
  });

  lenis.on('scroll', ScrollTrigger.update);

  tick = (time: number) => {
    // El ticker de GSAP cuenta en segundos; Lenis espera milisegundos.
    lenis?.raf(time * 1000);
  };

  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

/** Apaga el motor y devuelve el scroll nativo. */
export function stopMotionEngine(): void {
  if (tick) {
    gsap.ticker.remove(tick);
    tick = null;
  }

  gsap.ticker.lagSmoothing(DEFAULT_LAG_SMOOTHING[0], DEFAULT_LAG_SMOOTHING[1]);

  lenis?.destroy();
  lenis = null;
}

/** La instancia viva, o `null` si el motor está apagado. */
export function getLenis(): Lenis | null {
  return lenis;
}

/**
 * Vuelve a medir la página. El App Router cambia el contenido sin recargar, así
 * que la altura del documento cambia bajo los pies de Lenis y de ScrollTrigger.
 */
export function refreshMotionEngine(): void {
  lenis?.resize();
  ScrollTrigger.refresh();
}

export { gsap, ScrollTrigger, MotionPathPlugin };
