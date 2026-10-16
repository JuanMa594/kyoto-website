'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef } from 'react';

import { tramoHeightVh, tramoWalkVh } from '@/animation/journeyScroll';
import { useJourneyScroll } from '@/animation/useJourneyScroll';
import { getStation, neighbours, stationPath, type StationSlug } from '@/config/journey';
import { Link, useRouter } from '@/i18n/navigation';
import { MAP_SIZE } from '@/scene/objects/kosatsu/kosatsu';

import { isIconName } from '@/components/nav/icons';
import { CaminoFace, useCaminoHover } from '@/components/ui/CaminoButton';

import { KosatsuReader } from './KosatsuReader';
import { useKosatsuFit } from './useKosatsuFit';
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

  // Las tarjetas con cartel se leen sobre la tabla de su kōsatsu (Fase 5B).
  useKosatsuFit(section, motionAllowed);
  // Y tocando la tabla se leen de cerca, con el mapa en grande.
  const [reading, setReading] = useState<number | null>(null);
  const onward = useCaminoHover();

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
        {cards.map((card, index) => (
          <article
            key={card.id}
            className="tramo-card paper"
            data-tramo-card=""
            data-side={card.side}
            data-kind={card.kind}
            data-sign={card.sign ? index : undefined}
          >
            {card.sign?.map && (
              // El mapa antiguo, para cuando el texto no va sobre la tabla del
              // kōsatsu: la lista de 静, la tarjeta en vertical, los buscadores.
              // Lo genera `bun run maps`; las rutas de `public` no llevan idioma.
              <div className="tramo-card__map">
                <img
                  src={`/maps/${card.sign.map}.svg`}
                  alt={t(`maps.${card.sign.map}`)}
                  width={MAP_SIZE[card.sign.map].width}
                  height={MAP_SIZE[card.sign.map].height}
                  loading="lazy"
                />
              </div>
            )}
            <h2 className="text-2xl leading-tight">{cardText(card.id, 'title')}</h2>
            <p className="tramo-card__body mt-2">{cardText(card.id, 'body')}</p>
          </article>
        ))}

        {/* Sobre cada kōsatsu, un botón del tamaño de su tabla (lo coloca
            useKosatsuFit): abre la tarjeta de lectura. Sin movimiento no hace
            falta: las tarjetas ya son una lista con sus mapas. */}
        {motionAllowed &&
          cards.map((card, index) =>
            card.sign ? (
              <button
                key={card.id}
                type="button"
                className="kosatsu-hit"
                data-hit={index}
                data-on="off"
                tabIndex={-1}
                aria-label={t('readLabel', { title: cardText(card.id, 'title') })}
                onClick={() => setReading(index)}
              >
                <span className="kosatsu-hit__hint" aria-hidden="true">
                  {t('read')}
                </span>
              </button>
            ) : null,
          )}

        <KosatsuReader
          card={
            reading !== null && cards[reading]
              ? {
                  title: cardText(cards[reading].id, 'title'),
                  body: cardText(cards[reading].id, 'body'),
                  map: cards[reading].sign?.map,
                  mapAlt: cards[reading].sign?.map ? t(`maps.${cards[reading].sign.map}`) : undefined,
                }
              : null
          }
          onClose={() => setReading(null)}
          closeLabel={t('close')}
        />

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

          <Link href={stationPath(next)} className="paper camino-button mt-6" {...onward.props}>
            {isIconName(next.icon) ? (
              <CaminoFace icon={next.icon} label={`${t('continue')} → ${name}`} active={onward.active} />
            ) : (
              `${t('continue')} → ${name}`
            )}
          </Link>

          {motionAllowed && <p className="brush mt-4 opacity-60">{t('hint')}</p>}
        </div>
      </div>
    </section>
  );
}
