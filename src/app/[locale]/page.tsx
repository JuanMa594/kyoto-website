import { getTranslations } from 'next-intl/server';

import { ActiveStation } from '@/components/ActiveStation';
import { StationLinks } from '@/components/nav/StationLinks';
import { getStation } from '@/config/journey';
import { staticLocale } from '@/i18n/params';

/**
 * Home 京都 — versión de la Fase 1.
 *
 * La composición definitiva (torii 3D, bambú, hero de cartel) es de la Fase 4.
 * Lo que sí es definitivo aquí es la estructura: título tipográfico a un lado,
 * el objeto protagonista al otro, y todo el texto como DOM real por encima del
 * canvas.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await staticLocale(params);

  const t = await getTranslations({ locale, namespace: 'home' });
  const scaffold = await getTranslations({ locale, namespace: 'scaffold' });
  const station = getStation('inicio');

  return (
    <>
      <ActiveStation slug="inicio" />

      <main id="contenido" className="mx-auto min-h-dvh max-w-6xl px-6 py-[14vh]">
        <p className="brush text-sm tracking-[0.3em] uppercase opacity-60">{t('eyebrow')}</p>

        {/* El título y el kanji son el otro protagonista del cuadro, junto al
            objeto 3D. De ahí el tamaño: es un cartel, no un encabezado. */}
        <h1 className="mt-4">
          <span
            className="block"
            style={{
              fontSize: 'var(--text-hero)',
              lineHeight: 'var(--text-hero--line-height)',
              color: 'var(--color-shu)',
            }}
          >
            {t('title')}
          </span>
          <span className="kanji mt-2 block opacity-90">{station.kanji}</span>
        </h1>

        <p className="mt-8 max-w-prose text-xl">{t('subtitle')}</p>

        <p className="paper mt-10 inline-block px-4 py-3 text-sm opacity-80">
          <strong>{scaffold('phase')}</strong> — {scaffold('sceneLabel')}
        </p>

        <StationLinks locale={locale} current="inicio" />
      </main>
    </>
  );
}
