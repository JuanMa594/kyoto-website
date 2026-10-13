import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ActiveStation } from '@/components/ActiveStation';
import { CartelTitle } from '@/components/sections/CartelTitle';
import { ContentArrival } from '@/components/sections/ContentArrival';
import { PathTramo } from '@/components/sections/PathTramo';
import { KyotoFicha } from '@/components/ubicacion/KyotoFicha';
import { MaquetaInput } from '@/components/ubicacion/MaquetaInput';
import { MaquetaToggle } from '@/components/ubicacion/MaquetaToggle';
import { PrefectureLabels } from '@/components/ubicacion/PrefectureLabels';
import { getStation } from '@/config/journey';
import { staticLocale } from '@/i18n/params';
import { stationMetadata } from '@/i18n/stationMetadata';

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return stationMetadata(params, 'ubicacion');
}

const FICHA = ['prefectura', 'region', 'coords', 'poblacion', 'distancias'] as const;

/**
 * Ubicación 位置 — el cartel de `2.png` (Fase 5A).
 *
 * La maqueta de Japón está en la escena, a la izquierda del camino (la
 * decoración de `journey.ts`); aquí, a la derecha, *Ichi* / 位置 y lo que se
 * lee. `MaquetaInput` lleva la mano a la maqueta y `PrefectureLabels` pone sus
 * nombres; el botón y la ficha son DOM real. En vertical, el título arriba y
 * el resto por debajo de la maqueta.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await staticLocale(params);
  const t = await getTranslations({ locale, namespace: 'ubicacion' });
  const station = getStation('ubicacion');

  return (
    <>
      <ActiveStation slug="ubicacion" />

      <ContentArrival key="ubicacion">
        <main id="contenido" tabIndex={-1} className="ubicacion-cartel">
          <div className="ubicacion-cartel__text paper-halo">
            <div className="ubicacion-cartel__title">
              <CartelTitle
                romaji={t('romaji')}
                kanji={station.kanji}
                srTitle={t('srTitle')}
                accent={station.palette.accent}
              />
              <p className="ubicacion-cartel__tagline brush">{t('tagline')}</p>
            </div>

            <div className="ubicacion-cartel__details">
              <p className="ubicacion-cartel__summary">{t('summary')}</p>
              <MaquetaToggle zoomIn={t('zoomIn')} zoomOut={t('zoomOut')} />
              <KyotoFicha
                label={t('fichaLabel')}
                items={FICHA.map((key) => ({ label: t(`ficha.${key}.label`), value: t(`ficha.${key}.value`) }))}
              />
            </div>
          </div>
        </main>
      </ContentArrival>

      <MaquetaInput />
      <PrefectureLabels />

      <PathTramo station="ubicacion" />
    </>
  );
}
