import { getTranslations } from 'next-intl/server';

import { JOURNEY, type Locale, type StationSlug, stationPath } from '@/config/journey';
import { Link } from '@/i18n/navigation';

/**
 * Navegación provisional de la Fase 1.
 *
 * Deriva de `JOURNEY`, igual que derivará el sidebar radial de la Fase 3: el
 * orden, los kanji y las rutas salen del mismo array. Cuando lleguen los 6
 * círculos de `13.png`, este componente desaparece — pero la fuente de datos no
 * cambia.
 */
export async function StationLinks({
  locale,
  current,
}: {
  locale: Locale;
  current: StationSlug;
}) {
  const t = await getTranslations({ locale, namespace: 'stations' });
  const nav = await getTranslations({ locale, namespace: 'nav' });

  return (
    <nav aria-label={nav('label')} className="mt-12">
      <ol className="flex flex-wrap gap-2">
        {JOURNEY.map((station) => {
          const isCurrent = station.slug === current;
          return (
            <li key={station.slug}>
              <Link
                href={stationPath(station)}
                aria-current={isCurrent ? 'page' : undefined}
                className="paper flex items-baseline gap-2 px-3 py-2 text-sm transition-transform duration-200 hover:-translate-y-0.5"
                style={{
                  borderLeft: `3px solid ${station.palette.accent}`,
                  opacity: isCurrent ? 1 : 0.82,
                }}
              >
                <span className="kanji text-[1.05rem] leading-none">{station.kanji}</span>
                <span>{t(`${station.slug}.name`)}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
