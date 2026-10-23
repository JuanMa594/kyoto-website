import { getTranslations } from 'next-intl/server';

import { ActiveStation } from '@/components/ActiveStation';
import { CartelTitle } from '@/components/sections/CartelTitle';
import { ContentArrival } from '@/components/sections/ContentArrival';
import { PathTramo } from '@/components/sections/PathTramo';
import { getStation, type Locale, type StationSlug } from '@/config/journey';

import { TempleCard } from './TempleCard';

/** Los datos de la ficha del templo, en orden. */
const FICHA = ['fundacion', 'deidad', 'toriis', 'santuarios', 'romon', 'monte'] as const;

/**
 * El cartel de un lugar (Fase 6A), con la estructura de `6.png`: el monumento
 * en la escena a un lado (`station.place.side`) y, al otro, el título —romaji
 * y el kanji dibujado—, el lema, el resumen y el botón del monumento, que
 * abre la tarjeta del templo. Los mismos pasos que el cartel de Ubicación:
 * `ContentArrival`, el halo de papel y el tramo al final. En vertical, el
 * título arriba y el resto debajo.
 *
 * Los textos viven en `messages`, bajo `lugares.<slug>`: añadir Kiyomizu-dera
 * o Gion es declarar su `place` en `journey.ts` y rellenar su entrada.
 */
export async function PlaceCartel({ slug, locale }: { slug: StationSlug; locale: Locale }) {
  const station = getStation(slug);
  const place = station.place!;
  const t = await getTranslations({ locale, namespace: 'lugares' });
  // La clave se arma con el slug: el tipo de next-intl no puede seguirla. Que
  // existan en los dos idiomas lo comprueba `bun run check:path`.
  const text = (key: string) => t(`${slug}.${key}` as Parameters<typeof t>[0]);

  return (
    <>
      <ActiveStation slug={slug} />

      <ContentArrival key={slug}>
        <main id="contenido" tabIndex={-1} className="place-cartel" data-side={place.side}>
          <div className="place-cartel__text paper-halo">
            <div className="place-cartel__title">
              <CartelTitle romaji={text('romaji')} kanji={station.kanji} srTitle={text('srTitle')} accent={station.palette.accent} />
              <p className="place-cartel__tagline brush">{text('tagline')}</p>
            </div>
            <div className="place-cartel__details">
              <p className="place-cartel__summary">{text('summary')}</p>
              <TempleCard
                station={slug}
                side={place.side}
                accent={station.palette.accent}
                texts={{
                  behold: text('behold'),
                  beholdLabel: text('beholdLabel'),
                  close: text('close'),
                  kicker: text('temple.kicker'),
                  title: text('temple.title'),
                  body: text('temple.body'),
                  fichaLabel: text('temple.fichaLabel'),
                  ficha: FICHA.map((key) => ({ label: text(`temple.ficha.${key}.label`), value: text(`temple.ficha.${key}.value`) })),
                  greca: t('greca'),
                }}
              />
            </div>
          </div>
        </main>
      </ContentArrival>

      <PathTramo station={slug} />
    </>
  );
}
