import localFont from 'next/font/local';

/**
 * Candidata a comparar en `/tipografia/` (decisión de la Fase 1 pendiente:
 * qué fuente lleva los kanji decorativos).
 *
 * Este módulo lo importa **sólo** la página de muestrario. En cuanto se elija
 * entre Zen Old Mincho y esta, este archivo se borra y la ganadora queda como
 * única entrada de kanji en `fonts.ts` y en el pipeline de subsetting.
 */

/** Alternativa japonesa: trazo de pincel en lugar de mincho clásico. */
export const yujiSyuku = localFont({
  src: './generated/yuji-syuku.woff2',
  variable: '--font-yuji-syuku',
  display: 'swap',
  weight: '400',
  fallback: ['Yu Mincho', 'serif'],
});

export const candidateVariables = yujiSyuku.variable;
