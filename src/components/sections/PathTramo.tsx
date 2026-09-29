'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';

import { useJourneyScroll } from '@/animation/useJourneyScroll';
import { neighbours, stationPath, type StationSlug } from '@/config/journey';
import { Link, useRouter } from '@/i18n/navigation';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

/**
 * El tramo: la parte de cada página que es camino.
 *
 * Una sección de 220vh al final de la página. Su scroll lleva la cámara desde
 * esta estación hasta la siguiente (`useJourneyScroll`), y mientras tanto
 * aparece, cada vez más nítido, lo que hay al final: el kanji, el nombre y el
 * lema de la siguiente estación. Al terminarlo se llega: la URL cambia sola.
 *
 * El enlace «Seguir el camino» está siempre, y es la única forma de avanzar con
 * modo 静 o movimiento reducido: ahí no hay llegada automática, porque un
 * cambio de página provocado por el scroll sorprende a quien pidió menos
 * movimiento.
 *
 * Es DOM real, con un enlace de verdad, dentro de un `<nav>`: se llega por
 * teclado y lo leen los lectores de pantalla.
 *
 * Queda el hueco para los carteles con datos de `3/7/9/11.png`, que llegarán
 * con el contenido de cada estación.
 */
export function PathTramo({ station }: { station: StationSlug }) {
  const t = useTranslations('tramo');
  const names = useTranslations('stations');
  const router = useRouter();
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const section = useRef<HTMLElement>(null);
  const next = neighbours(station).next;

  useJourneyScroll({
    station,
    tramo: section,
    enabled: motionAllowed,
    onArrive: () => {
      if (next) router.push(stationPath(next));
    },
  });

  // La última estación no tiene tramo, pero su scroll sí mueve la cámara (el
  // avance de lectura): por eso el hook va antes de este return.
  if (!next) return null;

  const name = names(`${next.slug}.name`);

  return (
    <nav
      ref={section}
      aria-label={t('label', { station: name })}
      className="path-tramo"
      data-motion={motionAllowed ? 'on' : 'off'}
    >
      <div className="path-tramo__stage">
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
          className="paper mt-6 inline-flex items-baseline gap-2 px-4 py-2 text-sm transition-transform duration-200 hover:-translate-y-0.5"
          style={{ borderLeft: `3px solid ${next.palette.accent}` }}
        >
          {t('continue')} → {name}
        </Link>

        {motionAllowed && <p className="brush mt-4 text-sm opacity-60">{t('hint')}</p>}
      </div>
    </nav>
  );
}
