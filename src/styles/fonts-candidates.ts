import { Baloo_2, Rubik } from 'next/font/google';
import localFont from 'next/font/local';

/**
 * Candidatas a comparar en `/tipografia/` (decisión de la Fase 1).
 *
 * Este módulo lo importa **sólo** la página de muestrario. En cuanto se elija
 * la latina de lectura y la japonesa de titulares, este archivo se borra y la
 * ganadora pasa a `fonts.ts` y al pipeline de subsetting.
 */

/** Alternativa japonesa: trazo de pincel en lugar de mincho clásico. */
export const yujiSyuku = localFont({
  src: './generated/yuji-syuku.woff2',
  variable: '--font-yuji-syuku',
  display: 'swap',
  weight: '400',
  fallback: ['Yu Mincho', 'serif'],
});

export const rubik = Rubik({
  subsets: ['latin'],
  variable: '--font-cand-rubik',
  display: 'swap',
});

export const baloo = Baloo_2({
  subsets: ['latin'],
  variable: '--font-cand-baloo',
  display: 'swap',
});

export const candidateVariables = [yujiSyuku.variable, rubik.variable, baloo.variable].join(' ');
