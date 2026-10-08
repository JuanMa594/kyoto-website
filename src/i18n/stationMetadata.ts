import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { StationSlug } from '@/config/journey';

import { staticLocale } from './params';

/**
 * El título de una estación: «Ubicación · Kyoto». La plantilla `%s · Kyoto` la
 * pone el layout de `[locale]`.
 *
 * No es sólo SEO: el anunciador de rutas de Next lee el `<title>` para decirle
 * al lector de pantalla que la página cambió, y con un título compartido entre
 * estaciones no anunciaba nada (Fase 3C).
 */
export async function stationMetadata(
  params: Promise<{ locale: string }>,
  slug: StationSlug,
): Promise<Metadata> {
  const locale = await staticLocale(params);
  const t = await getTranslations({ locale, namespace: 'stations' });
  return { title: t(`${slug}.name`) };
}
