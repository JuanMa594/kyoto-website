import { getTranslations } from 'next-intl/server';

import { ActiveStation } from '@/components/ActiveStation';
import { HomeIntro } from '@/components/home/HomeIntro';
import { WalkHint } from '@/components/home/WalkHint';
import { InkKanji } from '@/components/kanji/InkKanji';
import { ContentArrival } from '@/components/sections/ContentArrival';
import { PathTramo } from '@/components/sections/PathTramo';
import { getStation } from '@/config/journey';
import { staticLocale } from '@/i18n/params';

/**
 * Home 京都 — el cartel de `1.png` (Fase 4).
 *
 * KYOTO / 京都 a la izquierda y el torii a la derecha, en la escena (la
 * decoración de `journey.ts`). Todo el texto es DOM real: las letras animadas y
 * el kanji dibujable van `aria-hidden`, y al lado está el título que se lee.
 * La entrada (`HomeIntro`) anima lo marcado con `data-cartel-*`.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await staticLocale(params);
  const t = await getTranslations({ locale, namespace: 'home' });
  const station = getStation('inicio');
  const title = t('title');

  return (
    <>
      <ActiveStation slug="inicio" />
      <HomeIntro />

      <ContentArrival key="inicio">
        <main id="contenido" tabIndex={-1} className="home-cartel">
          <div className="home-cartel__text">
            <h1 className="home-cartel__title">
              <span className="sr-only">
                {title} <span lang="ja">{station.kanji}</span>
              </span>
              <span className="home-cartel__word" data-cartel-word="" aria-hidden="true">
                {[...title].map((letter, i) => (
                  <span key={i} className="home-cartel__letter" data-cartel-letter="">
                    {letter}
                  </span>
                ))}
              </span>
              <InkKanji text={station.kanji} className="home-cartel__kanji" />
            </h1>

            <p className="home-cartel__tagline brush" data-cartel-late="">
              {t('tagline')}
            </p>

            <WalkHint label={t('walk')} />
          </div>
        </main>
      </ContentArrival>

      <PathTramo station="inicio" />
    </>
  );
}
