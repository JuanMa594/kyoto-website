/**
 * Puente entre los design tokens y la escena 3D.
 *
 * La paleta vive una sola vez, en `src/styles/tokens.css`. Three.js no entiende
 * `var(--color-washi)`, así que aquí se resuelve el valor calculado del
 * documento y se cachea. Evita tener una segunda copia de la paleta en TS —
 * que es justo la clase de duplicado que hace que el DOM y el 3D se desincronicen.
 */

const cache = new Map<string, string>();

export function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;

  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const resolved = value || fallback;
  cache.set(name, resolved);
  return resolved;
}

export function readCssNumber(name: string, fallback: number): number {
  const raw = readCssVar(name, String(fallback));
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Duraciones en **segundos**, que es la unidad de GSAP y la del bucle de la
 * escena. El CSS puede escribirlas en `s` o en `ms` sin que nadie tenga que
 * acordarse de convertirlas a mano.
 */
export function readCssSeconds(name: string, fallback: number): number {
  const raw = readCssVar(name, `${fallback}s`).trim();
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return raw.endsWith('ms') ? parsed / 1000 : parsed;
}

/** Vacía la caché. Sólo hace falta si algún día la paleta cambia en caliente. */
export function clearCssVarCache(): void {
  cache.clear();
}

/**
 * Los colores que la escena necesita, con respaldo por si el CSS aún no cargó.
 * Los fallbacks son copia literal de `tokens.css` y sólo actúan en ese hueco.
 */
export function scenePalette() {
  return {
    washi: readCssVar('--color-washi', '#fffacd'),
    washiFog: readCssVar('--color-washi-fog', '#fdf7d4'),
    shu: readCssVar('--color-shu', '#d82609'),
    sumi: readCssVar('--color-sumi', '#300500'),
    sumiSoft: readCssVar('--color-sumi-soft', '#6f3300'),
    sumiFaint: readCssVar('--color-sumi-faint', '#96725a'),
    ishi: readCssVar('--color-ishi', '#ede6dd'),
    ishiDeep: readCssVar('--color-ishi-deep', '#c8bfaf'),
    bambu: readCssVar('--color-bambu', '#a3b58e'),
    bambuPale: readCssVar('--color-bambu-pale', '#b9d0a3'),
    sakura: readCssVar('--color-sakura', '#eb81a5'),
    sakuraPale: readCssVar('--color-sakura-pale', '#ffdde8'),
    kohaku: readCssVar('--color-kohaku', '#ffd699'),
  };
}

export type ScenePalette = ReturnType<typeof scenePalette>;
