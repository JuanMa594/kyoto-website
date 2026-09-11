import localFont from 'next/font/local';

/**
 * Las cuatro familias del sitio. Los .woff2 de `./generated/` los produce
 * `bun run fonts` a partir de `assets/fonts/source/`; no se editan a mano.
 *
 * Cada fuente declara una variable CSS que `src/styles/tokens.css` recoge en
 * los tokens `--font-display`, `--font-brush`, `--font-kanji` y `--font-body`.
 * Los componentes usan siempre los tokens, nunca estas variables directamente.
 *
 * Todas pasan por el subsetting propio, ninguna por `next/font/google`: las
 * familias que cubren japonés se sirven troceadas en ~80 archivos por peso y
 * next/font los precarga todos. Con el pipeline local, las cuatro juntas pesan
 * menos de 100 KB y son cuatro peticiones.
 */

/** Titulares. La cara de la marca: KYOTO, SAKURA, GION. */
export const oneJinja = localFont({
  src: './generated/one-jinja.woff2',
  variable: '--font-one-jinja',
  display: 'swap',
  weight: '400',
  style: 'normal',
  fallback: ['Trebuchet MS', 'system-ui', 'sans-serif'],
});

/** Pincelada. Para frases sueltas y apoyos, no para párrafos largos. */
export const gazeNozarashi = localFont({
  src: './generated/gaze-nozarashi.woff2',
  variable: '--font-gaze-nozarashi',
  display: 'swap',
  weight: '400',
  style: 'normal',
  fallback: ['Trebuchet MS', 'system-ui', 'sans-serif'],
});

/**
 * Kanji decorativo — 43 glifos, 11 KB. Ni One Jinja ni Gaze Nozarashi traen un
 * solo carácter japonés, así que sin esta fuente 京都 cae en la del sistema.
 */
export const zenOldMincho = localFont({
  src: './generated/zen-old-mincho.woff2',
  variable: '--font-zen-mincho',
  display: 'swap',
  weight: '400',
  style: 'normal',
  fallback: ['Yu Mincho', 'Hiragino Mincho ProN', 'serif'],
});

/**
 * Texto de lectura. Provisional hasta la revisión de la Fase 1: comparar en
 * `/es/tipografia/` con Rubik y Baloo 2 antes de cerrar la decisión.
 */
export const latin = localFont({
  src: [
    { path: './generated/mplus-rounded-400.woff2', weight: '400', style: 'normal' },
    { path: './generated/mplus-rounded-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-latin',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});

/** Todas las variables de fuente, para colgarlas del <html>. */
export const fontVariables = [
  oneJinja.variable,
  gazeNozarashi.variable,
  zenOldMincho.variable,
  latin.variable,
].join(' ');
