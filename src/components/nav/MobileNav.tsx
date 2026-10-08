'use client';

import { gsap } from 'gsap';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

import { getLenis } from '@/animation/gsap';
import { motionDurations, registerPresets } from '@/animation/presets';
import { AmbientControls } from '@/components/ui/AmbientControls';
import { JOURNEY, stationPath, type StationSlug } from '@/config/journey';
import { Link, useRouter } from '@/i18n/navigation';
import { stationIndex } from '@/scene/path/journeyPath';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { fanPickAction } from './fanHistory';
import { isIconName } from './icons';
import { stoneOutline } from './icons/stone';
import { moveFocus } from './navKeys';
import { barPoint, fanPose, RAIL_LAST, type RailPoint } from './railProgress';
import { StationIcon } from './StationIcon';
import { useRailProgress } from './useRailProgress';

/** La marca del historial con la que «atrás» cierra el abanico. */
const FAN_HISTORY_KEY = 'kyotoFan';
/** Lo que se deja ver el pulso y el kanji antes de navegar, en ms. */
const PICK_DELAY = 320;

const STONES = JOURNEY.map((_, i) => stoneOutline(i));

/** Radio del abanico: el 40 % del ancho, nunca más de 160 px. */
const fanRadius = () => Math.min(window.innerWidth * 0.4, 160);

type FanState = 'closed' | 'open' | 'closing';

const fanInHistory = () =>
  Boolean((window.history.state as Record<string, unknown> | null)?.[FAN_HISTORY_KEY]);

/**
 * La navegación móvil (Fase 3C): una píldora flotante con el riel en
 * horizontal —las mismas piedras, la misma marca— y los tres mandos. Al
 * tocarla se abre el abanico: 京都 en el centro y los seis círculos en un
 * semicírculo, que salen del centro recorriendo el arco.
 *
 * El abanico es modal: el foco no sale de él, Lenis se detiene (el scroll de
 * detrás no mueve la cámara) y se cierra al elegir, al tocar el velo, con
 * Escape y con «atrás» del sistema. Para eso último, al abrir se apila una
 * entrada de historial con la **misma URL**; si se cierra de otra forma se
 * consume con `history.back()`, y al elegir una estación se navega con
 * `router.replace`, que la sustituye: el historial queda como tras una
 * navegación normal.
 */
export function MobileNav({ current, active }: { current: StationSlug | null; active: boolean }) {
  const t = useTranslations('nav');
  const names = useTranslations('stations');
  const router = useRouter();
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const fanId = useId();

  const toggle = useRef<HTMLButtonElement>(null);
  const track = useRef<HTMLSpanElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const stops = useRef<HTMLElement[]>([]);
  const fan = useRef<HTMLDivElement>(null);
  const items = useRef<HTMLLIElement[]>([]);
  const width = useRef(0);
  const currentRef = useRef(current);
  const historyPushed = useRef(false);
  const ignorePop = useRef(false);
  const returnFocus = useRef(false);

  const [state, setState] = useState<FanState>('closed');
  const [tapped, setTapped] = useState<number | null>(null);

  const currentIndex = current ? stationIndex(current) : 0;

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const place = useCallback((s: number, out: RailPoint) => barPoint(s, width.current, out), []);
  useRailProgress({ marker, stops, place, current, enabled: active });

  useEffect(() => {
    const node = track.current;
    if (!node || !active) return;
    const measure = () => {
      width.current = node.clientWidth;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  const openFan = () => {
    window.history.pushState({ [FAN_HISTORY_KEY]: true }, '');
    historyPushed.current = true;
    setState('open');
  };

  /** Cierra sin navegar: velo, botón, Escape o un cambio de presentación. */
  const dismiss = useCallback(() => {
    returnFocus.current = Boolean(fan.current?.contains(document.activeElement));
    if (historyPushed.current && fanInHistory()) {
      ignorePop.current = true;
      window.history.back();
    }
    historyPushed.current = false;
    setState((s) => (s === 'open' ? 'closing' : s));
  }, []);

  // «Atrás» del sistema con el abanico abierto.
  useEffect(() => {
    const onPop = () => {
      if (ignorePop.current) {
        ignorePop.current = false;
        return;
      }
      if (!historyPushed.current) return;
      historyPushed.current = false;
      returnFocus.current = Boolean(fan.current?.contains(document.activeElement));
      setState((s) => (s === 'open' ? 'closing' : s));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Si la pantalla pasa a escritorio con el abanico abierto, se cierra.
  useEffect(() => {
    if (!active && state === 'open') dismiss();
  }, [active, state, dismiss]);

  // Abrir y cerrar.
  useEffect(() => {
    const root = fan.current;
    if (!root || state === 'closed') return;
    registerPresets();
    const { medio, rapido } = motionDurations();
    const list = items.current;
    const hub = list[0];
    const arc = list.slice(1);
    const veil = root.querySelector('.mnav__veil');
    const radius = fanRadius();
    const point = { x: 0, y: 0 };
    const placeItem = (li: HTMLElement, index: number, k: number) => {
      fanPose(index, k, radius, point);
      li.style.translate = `${point.x}px ${point.y}px`;
    };

    if (state === 'open') {
      getLenis()?.stop();
      document.documentElement.classList.add('nav-locked');
      const tl = gsap.timeline();
      if (motionAllowed) {
        arc.forEach((li, j) => placeItem(li, j + 1, 0));
        tl.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: rapido, ease: 'washi' }, 0);
        tl.fromTo(hub ?? [], { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: rapido, ease: 'washi' }, 0);
        arc.forEach((li, j) => {
          const proxy = { k: 0 };
          const at = 0.05 + j * 0.035;
          tl.to(proxy, { k: 1, duration: medio, ease: 'spring', onUpdate: () => placeItem(li, j + 1, proxy.k) }, at);
          tl.fromTo(li, { opacity: 0 }, { opacity: 1, duration: rapido }, at);
        });
      } else {
        arc.forEach((li, j) => placeItem(li, j + 1, 1));
        tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.15 });
      }
      const target = currentRef.current ? stationIndex(currentRef.current) : 0;
      list[target]?.querySelector('a')?.focus();
      return () => {
        tl.kill();
      };
    }

    // state === 'closing'
    const tl = gsap.timeline({ onComplete: () => setState('closed') });
    if (motionAllowed) {
      tl.to(arc, { opacity: 0, scale: 0.6, duration: rapido, ease: 'washi', stagger: 0.02 }, 0)
        .to(hub ?? [], { opacity: 0, duration: rapido }, 0)
        .to(veil, { opacity: 0, duration: rapido }, 0);
    } else {
      tl.to(root, { opacity: 0, duration: 0.15 });
    }
    return () => {
      tl.kill();
    };
  }, [state, motionAllowed]);

  // Cerrado: el scroll vuelve, se limpia lo animado y el foco vuelve al botón.
  useEffect(() => {
    if (state !== 'closed') return;
    getLenis()?.start();
    document.documentElement.classList.remove('nav-locked');
    // Sólo lo que animó GSAP o `placeItem`: `clearProps: 'all'` vaciaría el
    // `style` entero y se llevaría el `--halo` y el `--accent` que pone React
    // en cada <li>, que React no vuelve a escribir (no cambian).
    const root = fan.current;
    const veil = root?.querySelector('.mnav__veil');
    gsap.set(items.current, { clearProps: 'opacity,transform,translate' });
    gsap.set([veil, root].filter(Boolean), { clearProps: 'opacity' });
    if (returnFocus.current) {
      returnFocus.current = false;
      toggle.current?.focus();
    }
  }, [state]);

  const onPick = (event: MouseEvent<HTMLAnchorElement>, index: number) => {
    event.preventDefault();
    const href = stationPath(JOURNEY[index]!);
    const action = fanPickAction(index, currentIndex, historyPushed.current && fanInHistory());
    if (action === 'dismiss') {
      dismiss();
      return;
    }
    const go = () => {
      // La entrada de relleno del abanico se sustituye por la de destino.
      if (action === 'replace') router.replace(href);
      else router.push(href);
      historyPushed.current = false;
      returnFocus.current = true;
      setTapped(null);
      setState((s) => (s === 'open' ? 'closing' : s));
    };
    if (!motionAllowed) {
      go();
      return;
    }
    setTapped(index);
    const face = items.current[index]?.querySelector('.mnav__face, .mnav__hub');
    if (face) {
      gsap.fromTo(
        face,
        { scale: 1 },
        {
          keyframes: [
            { scale: 1.18, duration: 0.16, ease: 'power2.out' },
            { scale: 1, duration: 0.4, ease: 'spring' },
          ],
        },
      );
    }
    window.setTimeout(go, PICK_DELAY);
  };

  const onFanKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
      return;
    }
    const links = items.current
      .map((li) => li.querySelector<HTMLElement>('a'))
      .filter((link): link is HTMLElement => link !== null);
    if (event.key === 'Tab') {
      const first = links[0];
      const last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (moveFocus(event.key, links)) event.preventDefault();
  };

  return (
    <div className="mnav">
      <div className="mnav__bar">
        <button
          ref={toggle}
          type="button"
          className="mnav__toggle"
          aria-expanded={state === 'open'}
          aria-controls={fanId}
          aria-label={state === 'open' ? t('close') : t('open')}
          onClick={() => (state === 'open' ? dismiss() : openFan())}
        >
          <span
            ref={track}
            className="mnav__track"
            aria-hidden="true"
            style={{ '--s0': currentIndex } as CSSProperties}
          >
            {JOURNEY.map((station, i) => (
              <span
                key={station.slug}
                ref={(node) => {
                  if (node) stops.current[i] = node;
                }}
                className={i === 0 ? 'mnav__stone mnav__stone--home' : 'mnav__stone'}
                style={{ '--t': i / RAIL_LAST, '--accent': station.palette.accent } as CSSProperties}
              >
                {i === 0 ? (
                  station.kanji.charAt(0)
                ) : (
                  <svg viewBox="-1 -1 2 2" focusable="false">
                    <path d={STONES[i]} />
                  </svg>
                )}
              </span>
            ))}
            <span ref={marker} className="mnav__marker" />
          </span>
        </button>
        <AmbientControls variant="bar" />
      </div>

      <div
        id={fanId}
        ref={fan}
        className="mnav__fan"
        role="dialog"
        aria-modal="true"
        aria-label={t('label')}
        hidden={state === 'closed'}
        onKeyDown={onFanKeyDown}
      >
        <div className="mnav__veil" onClick={dismiss} />
        <nav aria-label={t('label')}>
          <ol className="mnav__arc" role="list">
            {JOURNEY.map((station, i) => (
              <li
                key={station.slug}
                ref={(node) => {
                  if (node) items.current[i] = node;
                }}
                className="mnav__item"
                style={{ '--halo': station.palette.halo, '--accent': station.palette.accent } as CSSProperties}
              >
                <Link
                  href={stationPath(station)}
                  className="mnav__link"
                  aria-current={station.slug === current ? 'page' : undefined}
                  onClick={(event) => onPick(event, i)}
                >
                  {station.inSidebar && isIconName(station.icon) ? (
                    <span className="mnav__face" aria-hidden="true">
                      <StationIcon icon={station.icon} active={false} className="mnav__icon" />
                      <span className="mnav__kanji" data-shown={tapped === i ? '' : undefined}>
                        {station.kanji}
                      </span>
                    </span>
                  ) : (
                    <span className="mnav__hub" aria-hidden="true">
                      {station.kanji}
                    </span>
                  )}
                  <span className="mnav__name">{names(`${station.slug}.name`)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </div>
  );
}
