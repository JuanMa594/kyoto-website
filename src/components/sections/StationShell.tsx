import { getTranslations } from 'next-intl/server';

import { ActiveStation } from '@/components/ActiveStation';
import { StationLinks } from '@/components/nav/StationLinks';
import { getStation, type Locale, type StationSlug } from '@/config/journey';

/**
 * Andamio de una estación mientras su fase no llega.
 *
 * Cumple dos funciones reales, no decorativas: demuestra que la escena WebGL
 * sobrevive a los cambios de ruta (el canvas no parpadea al navegar) y que el
 * ambiente de cada estación — niebla, color del suelo — se lee de `journey.ts`.
 */
export async function StationShell({
  slug,
  locale,
}: {
  slug: StationSlug;
  locale: Locale;
}) {
  const station = getStation(slug);
  const t = await getTranslations({ locale, namespace: 'stations' });
  const scaffold = await getTranslations({ locale, namespace: 'scaffold' });

  return (
    <>
      <ActiveStation slug={slug} />

      <main id="contenido" className="mx-auto min-h-dvh max-w-5xl px-6 py-[18vh]">
        <p className="brush text-sm tracking-[0.25em] uppercase opacity-60">{station.romaji}</p>

        <h1 className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="text-[clamp(2.5rem,8vw,6rem)] leading-none">
            {t(`${slug}.name`)}
          </span>
          <span className="kanji" style={{ color: station.palette.accent }}>
            {station.kanji}
          </span>
        </h1>

        <p className="mt-6 max-w-prose text-lg">{t(`${slug}.tagline`)}</p>
        <p className="mt-2 max-w-prose opacity-70">{t(`${slug}.summary`)}</p>

        <p className="paper mt-10 inline-block px-4 py-3 text-sm opacity-80">
          <strong>{scaffold('phase')}</strong> — {scaffold('note')}
        </p>

        <StationLinks locale={locale} current={slug} />
      </main>
    </>
  );
}
