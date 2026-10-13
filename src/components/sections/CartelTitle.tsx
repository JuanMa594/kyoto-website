'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

import { gsap } from '@/animation/gsap';
import { InkKanji } from '@/components/kanji/InkKanji';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

interface CartelTitleProps {
  /** La palabra grande, en romaji («Ichi»). */
  romaji: string;
  kanji: string;
  /** Lo que lee el lector de pantalla: «Ubicación — Ichi». El kanji se añade solo. */
  srTitle: string;
  /** El color de la estación (`palette.accent`). */
  accent: string;
}

/** Todos los trazos juntos, en segundos: un kanji corto, para cada llegada. */
const STROKES_TOTAL = 1.2;
const STROKE_MIN = 0.05;
const STROKE_GAP = 0.03;
/** Espera tras aparecer el contenido: que el fundido vaya por delante. */
const DRAW_DELAY = 0.25;

/**
 * El título de cartel de una estación (Fase 5A): el romaji grande y, debajo,
 * el kanji dibujado con `<InkKanji>`. Lo estrena Ubicación y lo usarán
 * Eventos y los tres Lugares; la Home no, que tiene su entrada propia.
 *
 * El kanji se dibuja trazo a trazo **cada vez que se llega** a la estación: al
 * pasar de `pending` a `shown` la `.content-arrival` que lo contiene. La
 * primera página de la visita ya llega `shown` del HTML estático y no se
 * dibuja —sería borrar y volver a pintar lo que ya se veía—. Sin movimiento,
 * tampoco.
 */
export function CartelTitle({ romaji, kanji, srTitle, accent }: CartelTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const title = ref.current;
    const arrival = title?.closest<HTMLElement>('.content-arrival');
    if (!title || !arrival || arrival.dataset.arrival !== 'pending') return;
    if (!selectMotionAllowed(useKyotoStore.getState())) return;

    const strokes = [...title.querySelectorAll<SVGPathElement>('[data-ink-stroke]')];
    const glyphs = [...title.querySelectorAll<SVGTextElement>('[data-ink-mask]')];
    let timeline: ReturnType<typeof gsap.timeline> | null = null;

    // Mientras el contenido espera, invisible, el kanji se queda sin trazos.
    for (const glyph of glyphs) glyph.setAttribute('mask', `url(#${glyph.dataset.inkMask})`);
    gsap.set(strokes, { strokeDashoffset: 1 });

    const finish = () => {
      timeline?.kill();
      timeline = null;
      for (const glyph of glyphs) glyph.removeAttribute('mask');
      gsap.set(strokes, { clearProps: 'strokeDashoffset' });
    };

    const draw = () => {
      const lengths = strokes.map((stroke) => stroke.getTotalLength());
      const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
      const share = Math.max(0, STROKES_TOTAL - strokes.length * (STROKE_MIN + STROKE_GAP));
      const tl = gsap.timeline({ onComplete: finish });
      let at = DRAW_DELAY;
      strokes.forEach((stroke, i) => {
        const duration = STROKE_MIN + share * ((lengths[i] ?? 0) / total);
        tl.to(stroke, { strokeDashoffset: 0, duration, ease: 'power1.inOut' }, at);
        at += duration + STROKE_GAP;
      });
      timeline = tl;
    };

    const observer = new MutationObserver(() => {
      if (arrival.dataset.arrival !== 'shown') return;
      observer.disconnect();
      draw();
    });
    observer.observe(arrival, { attributes: true, attributeFilter: ['data-arrival'] });

    return () => {
      observer.disconnect();
      finish();
    };
  }, []);

  return (
    <h1 ref={ref} className="cartel-title" style={{ '--cartel-accent': accent } as CSSProperties}>
      <span className="sr-only">
        {srTitle} <span lang="ja">{kanji}</span>
      </span>
      <span className="cartel-title__word" aria-hidden="true">
        {romaji}
      </span>
      <InkKanji text={kanji} className="cartel-title__kanji" />
    </h1>
  );
}
