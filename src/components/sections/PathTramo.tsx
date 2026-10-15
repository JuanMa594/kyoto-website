'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';

import { tramoHeightVh, tramoWalkVh } from '@/animation/journeyScroll';
import { useJourneyScroll } from '@/animation/useJourneyScroll';
import { getStation, neighbours, stationPath, type StationSlug } from '@/config/journey';
import { Link, useRouter } from '@/i18n/navigation';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

/**
 * El tramo: la parte de cada página que es camino.
 *
 * Una sección al final de la página cuyo scroll lleva la cámara desde esta
 * estación hasta la siguiente (`useJourneyScroll`). **Se camina y se lee**: si
 * la estación declara tarjetas en `journey.ts` (`tramo.cards`), la cámara se
 * detiene en cada una mientras aparece a su lado del camino, y cada tarjeta
 * alarga el tramo con su parada (`tramoHeightVh`). Al final se ve, cada vez
 * más nítido, lo que viene —el kanji, el nombre y el lema de la siguiente
 * estación— y, al terminar, se llega: la URL cambia sola.
 *
 * El enlace «Seguir el camino» está siempre, y es la única forma de avanzar con
 * modo 静 o movimiento reducido: ahí no hay llegada automática, el tramo se
 * reduce a su contenido y las tarjetas se leen como una lista.
 *
 * Todo es DOM real —tarjetas con su encabezado, un enlace de verdad—: se llega
 * por teclado y lo leen los buscadores y los lectores de pantalla.
 */
export function PathTramo({ station }: { station: StationSlug }) {
  const t = useTranslations('tramo');
  const names = useTranslations('stations');
  const texts = useTranslations('tramos');
  const router = useRouter();
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const section = useRef<HTMLElement>(null);
  const next = neighbours(station).next;
  const cards = getStation(station).tramo.cards;
  // Lo que se camina sale de la distancia real del tramo: el de la Home, que
  // es la mitad de largo, dura la mitad.
  const walkVh = tramoWalkVh(station);

  useJourneyScroll({
    station,
    tramo: section,
    cards: cards.length,
    walkVh,
    enabled: motionAllowed,
    onArrive: () => {
      if (next) router.push(stationPath(next));
    },
  });

  // La última estación no tiene tramo, pero su scroll sí mueve la cámara (el
  // avance de lectura): por eso el hook va antes de este return.
  if (!next) return null;

  const name = names(`${next.slug}.name`);

  // La clave se arma con la estación y el id que declara `journey.ts`: el tipo
  // de next-intl no puede seguirla. Que existan los textos en los dos idiomas
  // lo comprueba `bun run check:path`.
  const cardText = (id: string, part: 'title' | 'body') =>
    texts(`${station}.${id}.${part}` as Parameters<typeof texts>[0]);

  return (
    <section
      ref={section}
      aria-label={t('label', { station: name })}
      className="path-tramo"
      data-motion={motionAllowed ? 'on' : 'off'}
      style={motionAllowed ? { height: `${tramoHeightVh(cards.length, walkVh)}vh` } : undefined}
    >
      <div className="path-tramo__stage">
        {cards.map((card) => (
          <article
            key={card.id}
            className="tramo-card paper"
            data-tramo-card=""
            data-side={card.side}
            data-kind={card.kind}
          >
            {card.kind === 'mapa' && (
              <div className="tramo-card__map" role="img" aria-label={t('mapPlaceholder')}>
                <span>{t('mapPlaceholder')}</span>
              </div>
            )}
            <h2 className="text-2xl leading-tight">{cardText(card.id, 'title')}</h2>
            <p className="tramo-card__body mt-2">{cardText(card.id, 'body')}</p>
          </article>
        ))}

        <div className="path-tramo__arrival">
          <p
            className="path-tramo__sign kanji"
            style={{ color: next.palette.accent }}
            aria-hidden="true"
          >
            {next.kanji}
          </p>
          <p className="path-tramo__sign mt-2 text-2xl">{name}</p>
          <p className="path-tramo__sign mt-1 max-w-prose opacity-80">
            {names(`${next.slug}.tagline`)}
          </p>

          <Link
            href={stationPath(next)}
            className="paper mt-6 inline-flex items-baseline gap-2 px-4 py-2 transition-transform duration-200 hover:-translate-y-0.5"
            style={{ borderLeft: `3px solid ${next.palette.accent}` }}
          >
            {t('continue')} → {name}
          </Link>

          {motionAllowed && <p className="brush mt-4 opacity-60">{t('hint')}</p>}
        </div>
      </div>
    </section>
  );
}
