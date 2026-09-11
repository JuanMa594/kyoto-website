import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import type { Locale } from '@/config/journey';

import { routing } from './routing';

/**
 * Lo que toda página bajo `[locale]` tiene que hacer, en una sola línea:
 * validar el idioma de la URL, marcar la ruta como estática (sin esto el export
 * estático falla) y devolver el idioma ya tipado como `Locale`.
 */
export async function staticLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  return locale;
}
