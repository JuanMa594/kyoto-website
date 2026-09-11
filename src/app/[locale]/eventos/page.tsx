import { StationShell } from '@/components/sections/StationShell';
import { staticLocale } from '@/i18n/params';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await staticLocale(params);

  return <StationShell slug="eventos" locale={locale} />;
}
