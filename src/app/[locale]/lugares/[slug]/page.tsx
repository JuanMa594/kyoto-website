import { notFound } from 'next/navigation';

import { StationShell } from '@/components/sections/StationShell';
import { isStationSlug, PLACE_STATIONS } from '@/config/journey';
import { staticLocale } from '@/i18n/params';

/**
 * Los tres lugares comparten plantilla, y la lista sale de `journey.ts`: añadir
 * un cuarto lugar es añadir una entrada a ese array, no crear una carpeta.
 */
export function generateStaticParams() {
  return PLACE_STATIONS.map((station) => ({ slug: station.slug }));
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const locale = await staticLocale(params);

  if (!isStationSlug(slug)) notFound();

  return <StationShell slug={slug} locale={locale} />;
}
