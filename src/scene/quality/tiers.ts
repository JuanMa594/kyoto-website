/**
 * Tiers de calidad (§9 del PLAN).
 *
 * La cámara del sitio es observadora, no de primera persona: nunca hace falta
 * geometría creíble en 360°, sólo lo que entra en cuadro. Eso abarata mucho el
 * presupuesto y permite que el tier bajo siga viéndose bien, no "roto".
 */

export type QualityTier = 'high' | 'medium' | 'low';
export type QualitySetting = QualityTier | 'auto';

export interface QualityProfile {
  readonly tier: QualityTier;
  /** Rango de device pixel ratio que se le pasa al <Canvas>. */
  readonly dpr: readonly [number, number];
  readonly antialias: boolean;
  readonly shadows: boolean;
  /** Bloom, profundidad de campo, god rays (Fase 2). */
  readonly postprocessing: boolean;
  /** Multiplicador sobre la densidad nominal de pétalos, hojas y bambú. */
  readonly particleScale: number;
  /** Multiplicador sobre la distancia de niebla: más bajo = horizonte más corto. */
  readonly fogScale: number;
  /** Si el fondo usa geometría o se resuelve con billboards 2.5D. */
  readonly backgroundAsBillboards: boolean;
}

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  high: {
    tier: 'high',
    dpr: [1, 2],
    antialias: true,
    shadows: true,
    postprocessing: true,
    particleScale: 1,
    fogScale: 1,
    backgroundAsBillboards: false,
  },
  medium: {
    tier: 'medium',
    dpr: [1, 1.5],
    antialias: true,
    shadows: false,
    postprocessing: false,
    particleScale: 0.5,
    fogScale: 0.8,
    backgroundAsBillboards: true,
  },
  low: {
    tier: 'low',
    dpr: [0.75, 1],
    antialias: false,
    shadows: false,
    postprocessing: false,
    particleScale: 0.2,
    fogScale: 0.55,
    backgroundAsBillboards: true,
  },
};

/** Renderers por software: aunque la máquina sea potente, el 3D irá a rastras. */
const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|software|basic render|microsoft basic/i;

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

/**
 * Detecta el tier una sola vez, al arrancar. Es heurística a propósito: no
 * vale la pena un benchmark que retrase el primer render. Si se equivoca, la
 * persona tiene el override manual en la UI.
 */
export function detectTier(): QualityTier {
  if (typeof window === 'undefined') return 'medium';

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!gl) return 'low';

  let renderer = '';
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? '');
  }

  // Liberamos el contexto de prueba: la regla dura del proyecto es no tener
  // nunca dos contextos WebGL vivos a la vez.
  gl.getExtension('WEBGL_lose_context')?.loseContext();

  if (SOFTWARE_RENDERERS.test(renderer)) return 'low';

  const nav = navigator as NavigatorWithMemory;
  const memory = nav.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency || 4;
  const pixels = window.screen.width * window.screen.height * window.devicePixelRatio ** 2;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  let score = 0;
  score += memory >= 8 ? 2 : memory >= 4 ? 1 : 0;
  score += cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
  score += gl instanceof WebGL2RenderingContext ? 1 : 0;
  // Pantallas enormes castigan: hay que rellenar muchos más píxeles.
  score -= pixels > 8_300_000 ? 1 : 0;
  // Un táctil suele ser móvil: presupuesto térmico y de batería más ajustado.
  score -= coarsePointer ? 1 : 0;

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

export function resolveTier(setting: QualitySetting, detected: QualityTier | null): QualityTier {
  if (setting !== 'auto') return setting;
  return detected ?? 'medium';
}
