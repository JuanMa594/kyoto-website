import localFont from 'next/font/local';

/**
 * Las tres familias del sitio. Los .woff2 de `./generated/` los produce
 * `bun run fonts` a partir de `assets/fonts/source/`; no se editan a mano.
 *
 * Cada fuente declara una variable CSS que `src/styles/tokens.css` recoge en
 * los tokens `--font-display`, `--font-brush`, `--font-kanji` y `--font-body`.
 * Los componentes usan siempre los tokens, nunca estas variables directamente.
 *
 * Todas pasan por el subsetting propio, ninguna por `next/font/google`: las
 * familias que cubren japonés se sirven troceadas en ~80 archivos por peso y
 * next/font los precarga todos. Con el pipeline local, las tres juntas pesan
 * menos de 100 KB y son tres peticiones.
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

/**
 * Párrafos y texto de lectura, además de frases sueltas y apoyos (`.brush`).
 * Sólo trae peso 400: la negrita, si hace falta, la sintetiza el navegador
 * con `font-weight` desde CSS — no hay un archivo Bold que subsetear.
 */
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

/** Todas las variables de fuente, para colgarlas del <html>. */
export const fontVariables = [oneJinja.variable, gazeNozarashi.variable, zenOldMincho.variable].join(
  ' ',
);
