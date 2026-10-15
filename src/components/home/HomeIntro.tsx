'use client';

import { useEffect } from 'react';

import { gsap } from '@/animation/gsap';
import { registerPresets } from '@/animation/presets';
import { PATH } from '@/scene/path/journeyPath';
import { INTRO } from '@/scene/systems/intro';
import { requestGust } from '@/scene/systems/WindField';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { INTRO_SESSION_KEY } from './introScript';

/**
 * La entrada de la Home: «el cartel se compone» (Fase 4, spec §6).
 *
 * Sólo corre si el script en línea marcó `<html data-intro="on">` —primera
 * carga de la pestaña, en la Home, con movimiento—. En ~4 s: la bruma se abre
 * (en cuanto la escena está viva), KYOTO se empapa, 京都 se dibuja trazo a
 * trazo y, al posarse el último trazo, llega una ráfaga de verdad. Cualquier
 * rueda, toque, tecla o clic la completa al instante. Al desmontarse —o si se
 * activa 静—, también.
 */

/** El dibujo del kanji: lo que dura entero, el mínimo de cada trazo y la pausa entre trazos. */
const STROKES_TOTAL = 1.9;
const STROKE_MIN = 0.03;
const STROKE_GAP = 0.012;

const SKIP_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/** El final de la entrada en curso, si hay una. Una sola por documento. */
let running: (() => void) | null = null;
let pendingStop = 0;

export function HomeIntro() {
  useEffect(() => {
    // En desarrollo, StrictMode monta, desmonta y vuelve a montar cada
    // efecto: ese desmontaje simulado no puede matar la entrada. El final se
    // aplaza un instante y se cancela si el componente vuelve enseguida.
    window.clearTimeout(pendingStop);
    if (!running && document.documentElement.dataset.intro === 'on') running = playIntro();
    return () => {
      pendingStop = window.setTimeout(() => running?.(), 0);
    };
  }, []);

  return null;
}

/** Arranca la entrada y devuelve cómo completarla al instante. */
function playIntro(): () => void {
  const html = document.documentElement;
  html.dataset.intro = 'playing';
  try {
    sessionStorage.setItem(INTRO_SESSION_KEY, '1');
  } catch {
    // Sin almacenamiento la entrada se repetiría al recargar: no es grave.
  }

  const word = document.querySelector<HTMLElement>('[data-cartel-word]');
  const letters = [...document.querySelectorAll<HTMLElement>('[data-cartel-letter]')];
  const kanji = document.querySelector<HTMLElement>('.home-cartel .ink-kanji');
  const strokes = [...document.querySelectorAll<SVGPathElement>('.home-cartel [data-ink-stroke]')];
  const glyphs = [...document.querySelectorAll<SVGTextElement>('.home-cartel [data-ink-mask]')];
  const late = [...document.querySelectorAll<HTMLElement>('[data-cartel-late]')];

  let timeline: ReturnType<typeof gsap.timeline> | null = null;
  let fog: ReturnType<typeof gsap.to> | null = null;
  let finished = false;
  let gusted = false;
  let raf = 0;

  const gust = () => {
    if (gusted) return;
    gusted = true;
    requestGust();
  };

  // Si se activa 静 a mitad, el cartel queda compuesto.
  const unsubscribe = useKyotoStore.subscribe((state) => {
    if (!selectMotionAllowed(state)) finish();
  });

  function finish() {
    if (finished) return;
    finished = true;
    running = null;
    window.cancelAnimationFrame(raf);
    timeline?.kill();
    fog?.kill();
    INTRO.playing = false;
    INTRO.fog = 1;
    for (const glyph of glyphs) glyph.removeAttribute('mask');
    delete html.dataset.intro;
    word?.style.removeProperty('--ink');
    gsap.set([...letters, ...late, ...(kanji ? [kanji] : []), ...strokes], {
      clearProps: 'opacity,filter,transform,strokeDashoffset',
    });
    for (const event of SKIP_EVENTS) window.removeEventListener(event, skip);
    unsubscribe();
  }

  function skip() {
    gust();
    finish();
  }

  if (!selectMotionAllowed(useKyotoStore.getState())) {
    finish();
    return finish;
  }

  registerPresets();
  INTRO.playing = true;
  INTRO.fog = 0.02;

  // El kanji: cada trazo dura según su largo; todos juntos, ~1,9 s.
  const lengths = strokes.map((stroke) => stroke.getTotalLength());
  const totalLength = lengths.reduce((sum, length) => sum + length, 0) || 1;
  const share = STROKES_TOTAL - strokes.length * (STROKE_MIN + STROKE_GAP);
  for (const glyph of glyphs) glyph.setAttribute('mask', `url(#${glyph.dataset.inkMask})`);
  gsap.set(strokes, { strokeDashoffset: 1 });

  const tl = gsap.timeline({ onComplete: finish });

  // KYOTO no se deletrea: se empapa de izquierda a derecha en un solo gesto.
  if (word) tl.fromTo(word, { '--ink': 0 }, { '--ink': 1, duration: 1.1, ease: 'washi' }, 0.9);
  tl.fromTo(
    letters,
    { filter: 'blur(6px)' },
    { filter: 'blur(0px)', duration: 0.8, ease: 'washi', stagger: 0.05 },
    0.9,
  );

  if (kanji) tl.set(kanji, { opacity: 1 }, 1.6);
  let at = 1.6;
  strokes.forEach((stroke, i) => {
    const duration = STROKE_MIN + share * ((lengths[i] ?? 0) / totalLength);
    tl.to(stroke, { strokeDashoffset: 0, duration, ease: 'power1.inOut' }, at);
    at += duration + STROKE_GAP;
  });

  // Al posarse el último trazo, el viento.
  tl.call(gust, [], at);
  tl.fromTo(late, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: 'washi', stagger: 0.1 }, at - 0.1);
  timeline = tl;

  for (const event of SKIP_EVENTS) window.addEventListener(event, skip, { passive: true });

  // El cartel no espera a la escena: el texto se compone ya. La bruma se abre
  // en cuanto la escena esté viva; si tarda más que la entrada, la escena
  // aparece como siempre.
  const wait = () => {
    if (finished) return;
    if (PATH.live) fog = gsap.to(INTRO, { fog: 1, duration: 1.6, ease: 'washi' });
    else raf = window.requestAnimationFrame(wait);
  };
  raf = window.requestAnimationFrame(wait);

  return finish;
}
