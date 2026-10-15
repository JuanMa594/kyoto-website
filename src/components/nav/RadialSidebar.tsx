'use client';

import { gsap } from 'gsap';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';

import { motionDurations, registerPresets } from '@/animation/presets';
import { JOURNEY, stationPath, type StationSlug } from '@/config/journey';
import { Link } from '@/i18n/navigation';
import { stationIndex } from '@/scene/path/journeyPath';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { isIconName } from './icons';
import { stoneOutline } from './icons/stone';
import { moveFocus } from './navKeys';
import { RAIL_LAST, railBend, railPoint, type RailPoint } from './railProgress';
import { StationIcon } from './StationIcon';
import { useRailProgress } from './useRailProgress';

/** A cuántos px del borde derecho el cursor despliega el riel. */
const EDGE_ZONE = 96;
/** Lo que espera el riel antes de plegarse cuando el cursor se va, en ms. */
const FOLD_DELAY = 350;
/** Flecha del arco, plegado y desplegado, en px. */
const BULGE_FOLDED = 8;
const BULGE_OPEN = 40;
/** Escala de un círculo plegado: una piedrecita de ~11 px sobre 56. */
const FOLDED_SCALE = 0.2;

const STONES = JOURNEY.map((_, i) => stoneOutline(i));

/**
 * El riel de escritorio (Fase 3C): siete paradas —京都 y las seis estaciones
 * de `13.png`— sobre un arco pegado al borde derecho.
 *
 * Plegado es un camino de piedrecitas con la marca «tú». Se despliega al
 * acercar el cursor al borde, al pasar por encima o con el foco **de
 * teclado**: el arco se curva y cada piedra crece hasta su círculo, en una
 * onda que sale de la estación actual. Las piedras son los propios enlaces:
 * plegar y desplegar sólo cambia su tamaño.
 *
 * Al hacer clic se pliega al instante, para que el viaje se vea limpio, y la
 * marca recorre el riel al ritmo de la cámara (`useRailProgress`). Cada zona
 * por la que pasa la cámara hace destellar su piedra, y la de destino se
 * asienta al llegar.
 */
export function RadialSidebar({ current, active }: { current: StationSlug | null; active: boolean }) {
  const t = useTranslations('nav');
  const names = useTranslations('stations');
  const motionAllowed = useKyotoStore(selectMotionAllowed);

  const root = useRef<HTMLElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const line = useRef<SVGPathElement>(null);
  const stops = useRef<HTMLElement[]>([]);
  const geometry = useRef({ height: 0, bulge: BULGE_FOLDED });
  const timeline = useRef<gsap.core.Timeline | null>(null);

  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const openRef = useRef(false);
  const currentRef = useRef(current);
  const pointerNear = useRef(false);
  const keyboardInside = useRef(false);
  const suppressed = useRef(false);
  const foldTimer = useRef(0);

  const currentIndex = current ? stationIndex(current) : 0;

  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const place = useCallback(
    (s: number, out: RailPoint) => railPoint(s, geometry.current.height, geometry.current.bulge, out),
    [],
  );
  useRailProgress({ marker, stops, place, current, enabled: active });

  const applyBulge = useCallback(() => {
    root.current?.style.setProperty('--bulge', `${geometry.current.bulge}px`);
  }, []);

  /** Decide si el riel tiene que estar abierto. Plegarse espera un poco; abrirse no. */
  const evaluate = useCallback(() => {
    window.clearTimeout(foldTimer.current);
    if (suppressed.current) {
      setOpen(false);
      return;
    }
    if (pointerNear.current || keyboardInside.current) {
      setOpen(true);
      return;
    }
    foldTimer.current = window.setTimeout(() => setOpen(false), FOLD_DELAY);
  }, []);

  // Alto del riel y la línea de pisadas (plegada: con el riel abierto se oculta).
  useEffect(() => {
    const nav = root.current;
    if (!nav || !active) return;
    const point = { x: 0, y: 0 };
    const measure = () => {
      geometry.current.height = nav.clientHeight;
      let d = '';
      for (let s = 0; s <= RAIL_LAST + 1e-9; s += 0.125) {
        railPoint(s, geometry.current.height, BULGE_FOLDED, point);
        d += `${d ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      }
      line.current?.setAttribute('d', d);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [active]);

  // La timeline del despliegue. Se rehace al cambiar de estación (la onda sale
  // de la actual) o de modo de movimiento.
  useEffect(() => {
    const nav = root.current;
    if (!nav || !active) return;
    registerPresets();
    const { medio, rapido } = motionDurations();
    const circles = nav.querySelectorAll('.rail__circle');
    const stones = nav.querySelectorAll('.rail__stone');
    const faces = nav.querySelectorAll('.rail__face');
    const home = nav.querySelector('.rail__home');
    const lineNode = line.current;

    gsap.set(circles, { scale: FOLDED_SCALE });
    gsap.set(faces, { opacity: 0 });
    const tl = gsap.timeline({ paused: true });
    if (motionAllowed) {
      tl.to(geometry.current, { bulge: BULGE_OPEN, duration: medio, ease: 'washi', onUpdate: applyBulge }, 0)
        .to(
          circles,
          { scale: 1, duration: medio, ease: 'spring', stagger: { each: 0.04, from: Math.max(0, currentIndex - 1) } },
          0,
        )
        .to(stones, { opacity: 0, duration: rapido }, 0)
        .to(faces, { opacity: 1, duration: rapido }, 0.12)
        .to(home, { scale: 1.35, duration: medio, ease: 'spring' }, 0)
        .to(lineNode, { opacity: 0, duration: rapido }, 0);
    } else {
      // Sin movimiento: un fundido, sin spring, sin onda y sin curvarse.
      tl.to(circles, { scale: 1, duration: 0.001 }, 0)
        .to(stones, { opacity: 0, duration: 0.15 }, 0)
        .to(faces, { opacity: 1, duration: 0.15 }, 0)
        .to(lineNode, { opacity: 0, duration: 0.15 }, 0);
    }
    if (openRef.current) tl.progress(1);
    timeline.current = tl;

    return () => {
      tl.kill();
      timeline.current = null;
      geometry.current.bulge = BULGE_FOLDED;
      applyBulge();
      gsap.set([...circles, ...stones, ...faces, home, lineNode].filter(Boolean), { clearProps: 'all' });
    };
  }, [active, motionAllowed, currentIndex, applyBulge]);

  useEffect(() => {
    const tl = timeline.current;
    if (!tl) return;
    const { medio, rapido } = motionDurations();
    if (open) tl.timeScale(1).play();
    else tl.timeScale(motionAllowed ? medio / rapido : 1).reverse();
  }, [open, motionAllowed]);

  // El cursor cerca del borde.
  useEffect(() => {
    if (!active) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const inside = event.target instanceof Node && Boolean(root.current?.contains(event.target));
      const near = inside || event.clientX >= window.innerWidth - EDGE_ZONE;
      // Tras un clic el riel se queda plegado hasta que el cursor se va.
      if (!near) suppressed.current = false;
      if (near !== pointerNear.current) {
        pointerNear.current = near;
        evaluate();
      }
    };
    const onLeave = () => {
      pointerNear.current = false;
      suppressed.current = false;
      evaluate();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.clearTimeout(foldTimer.current);
      pointerNear.current = false;
      keyboardInside.current = false;
      suppressed.current = false;
      setOpen(false);
    };
  }, [active, evaluate]);

  // Pulso *spring* del círculo bajo el cursor o el foco.
  useEffect(() => {
    if (hovered === null || !motionAllowed || !open) return;
    const face = stops.current[hovered]?.querySelector('.rail__face');
    if (!face) return;
    const pulse = gsap.fromTo(
      face,
      { scale: 1 },
      {
        keyframes: [
          { scale: 1.14, duration: 0.16, ease: 'power2.out' },
          { scale: 1.06, duration: 0.45, ease: 'spring' },
        ],
      },
    );
    return () => {
      // Si el pulso sigue vivo, su segundo fotograma terminaría después de
      // esta vuelta y dejaría el círculo en 1,06 (pasar el cursor deprisa por
      // el arco dejaba varios agrandados).
      pulse.kill();
      gsap.to(face, { scale: 1, duration: 0.25, ease: 'washi', overwrite: 'auto' });
    };
  }, [hovered, motionAllowed, open]);

  // Destello de cada zona por la que pasa la cámara; la de destino se asienta.
  useEffect(() => {
    if (!active) return;
    return useKyotoStore.subscribe((state, previous) => {
      if (state.zone === previous.zone || !selectMotionAllowed(state)) return;
      const stop = stops.current[stationIndex(state.zone)];
      if (!stop) return;
      gsap.fromTo(stop, { '--glow': 1 }, { '--glow': 0, duration: 0.9, ease: 'washi' });
      if (state.zone === currentRef.current) {
        const stone = stop.querySelector('.rail__stone, .rail__home');
        if (stone) {
          gsap.fromTo(
            stone,
            { scale: 1 },
            {
              keyframes: [
                { scale: 1.7, duration: 0.18, ease: 'power2.out' },
                { scale: 1, duration: 0.55, ease: 'spring' },
              ],
            },
          );
        }
      }
    });
  }, [active]);

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    // Cada foco dice si es de teclado: si no, el de un clic dejaría a la vista
    // un estado de teclado anterior y el riel se quedaría abierto.
    keyboardInside.current = (event.target as HTMLElement).matches(':focus-visible');
    if (!keyboardInside.current) return;
    suppressed.current = false;
    evaluate();
  };

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (root.current?.contains(event.relatedTarget as Node | null)) return;
    keyboardInside.current = false;
    evaluate();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      keyboardInside.current = false;
      suppressed.current = true;
      evaluate();
      // Sin scroll: si se está en el tramo, enfocar <main> lo traería a la
      // vista y la cámara viajaría de vuelta a la estación.
      document.getElementById('contenido')?.focus({ preventScroll: true });
      return;
    }
    if (suppressed.current) {
      suppressed.current = false;
      keyboardInside.current = true;
      evaluate();
    }
    const links = Array.from(root.current?.querySelectorAll<HTMLElement>('.rail__link') ?? []);
    if (moveFocus(event.key, links)) event.preventDefault();
  };

  const onLinkClick = () => {
    // Tras un clic (o Enter) el riel se pliega; una tecla lo vuelve a abrir.
    suppressed.current = true;
    keyboardInside.current = false;
    setHovered(null);
    evaluate();
  };

  return (
    <nav
      ref={root}
      className="rail"
      aria-label={t('label')}
      data-open={open ? '' : undefined}
      style={{ '--s0': currentIndex } as CSSProperties}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <svg className="rail__line" aria-hidden="true" focusable="false">
        <path ref={line} />
      </svg>

      <ol className="rail__list" role="list">
        {JOURNEY.map((station, i) => {
          const isCurrent = station.slug === current;
          const style = {
            '--t': i / RAIL_LAST,
            '--bend': railBend(i / RAIL_LAST),
            '--halo': station.palette.halo,
            '--accent': station.palette.accent,
          } as CSSProperties;

          return (
            <li
              key={station.slug}
              ref={(node) => {
                if (node) stops.current[i] = node;
              }}
              className="rail__stop"
              style={style}
            >
              <Link
                href={stationPath(station)}
                className="rail__link"
                aria-current={isCurrent ? 'page' : undefined}
                onClick={onLinkClick}
                onPointerEnter={() => setHovered(i)}
                onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered((h) => (h === i ? null : h))}
              >
                {station.inSidebar && isIconName(station.icon) ? (
                  <span className="rail__circle" aria-hidden="true">
                    <svg className="rail__stone" viewBox="-1 -1 2 2" focusable="false">
                      <path d={STONES[i]} />
                    </svg>
                    <span className="rail__face">
                      <StationIcon icon={station.icon} active={open && hovered === i} className="rail__icon" />
                    </span>
                  </span>
                ) : (
                  <span className="rail__home" aria-hidden="true">
                    {station.kanji}
                  </span>
                )}
                <span className="rail__label">
                  <span className="rail__label-kanji" aria-hidden="true">
                    {station.kanji}
                  </span>
                  <span className="rail__label-name">{names(`${station.slug}.name`)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <span ref={marker} className="rail__marker" aria-hidden="true" />
    </nav>
  );
}
