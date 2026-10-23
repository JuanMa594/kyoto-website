import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PlaceCartel } from '@/components/lugares/PlaceCartel';
import { StationShell } from '@/components/sections/StationShell';
import { getStation, isStationSlug, PLACE_STATIONS } from '@/config/journey';
import { staticLocale } from '@/i18n/params';
import { stationMetadata } from '@/i18n/stationMetadata';

/**
 * Los tres lugares comparten plantilla, y la lista sale de `journey.ts`: añadir
 * un cuarto lugar es añadir una entrada a ese array, no crear una carpeta. La
 * plantilla del lugar (`PlaceCartel`, Fase 6A) se usa si la estación declara
 * su `place`; si no, todavía el andamio.
 */
export function generateStaticParams() {
  return PLACE_STATIONS.map((station) => ({ slug: station.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return isStationSlug(slug) ? stationMetadata(params, slug) : {};
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const locale = await staticLocale(params);

  if (!isStationSlug(slug)) notFound();

  if (getStation(slug).place) return <PlaceCartel slug={slug} locale={locale} />;
  return <StationShell slug={slug} locale={locale} />;
}
