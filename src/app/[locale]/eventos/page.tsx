import type { Metadata } from 'next';

import { StationShell } from '@/components/sections/StationShell';
import { staticLocale } from '@/i18n/params';
import { stationMetadata } from '@/i18n/stationMetadata';

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return stationMetadata(params, 'eventos');
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await staticLocale(params);

  return <StationShell slug="eventos" locale={locale} />;
}
