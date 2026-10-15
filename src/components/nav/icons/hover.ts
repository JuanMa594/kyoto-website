/**
 * Las microanimaciones de los íconos, al pasar por encima o con el foco de
 * teclado (Fase 3C). Van aparte de la geometría porque necesitan GSAP y el DOM;
 * la geometría es pura y la comprueba `check-nav.ts`.
 *
 * En reposo no se anima nada: son seis círculos permanentes y no deben competir
 * con el cuadro. Con modo 静 o movimiento reducido ni se crean (`StationIcon`).
 *
 * Las partes se buscan con `[data-part~="…"]`, y los giros usan `svgOrigin`, en
 * las coordenadas del viewBox −1…1.
 */

import { gsap } from 'gsap';

import { registerPresets } from '@/animation/presets';

import { LANTERN_PIVOT } from './farol';
import { KYOTO_POINT } from './japan.generated';
import { NARUTO_FRONT } from './naruto';
import { SAKURA_PIVOT } from './sakura';
import type { IconName } from './types';

export interface IconMotion {
  enter(): void;
  leave(): void;
  kill(): void;
}

const parts = (svg: SVGSVGElement, name: string) =>
  Array.from(svg.querySelectorAll<SVGElement>(`[data-part~="${name}"]`));
const origin = (x: number, y: number) => `${x} ${y}`;

const MOTIONS: Record<IconName, (svg: SVGSVGElement) => IconMotion> = {
  // Del punto de Kyoto sale una onda que se expande y se desvanece.
  mapa: (svg) => {
    const ripple = parts(svg, 'ripple');
    gsap.set(ripple, { svgOrigin: origin(KYOTO_POINT[0], KYOTO_POINT[1]) });
    let tween: gsap.core.Tween | null = null;
    return {
      enter: () => {
        tween?.kill();
        tween = gsap.fromTo(ripple, { scale: 0.4, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 1.1, ease: 'washi' });
      },
      leave: () => {},
      kill: () => tween?.kill(),
    };
  },

  // La rama se mece sobre su pie y un pétalo se suelta y cae girando.
  sakura: (svg) => {
    const branch = parts(svg, 'branch');
    const falling = parts(svg, 'falling');
    gsap.set(branch, { svgOrigin: origin(SAKURA_PIVOT.x, SAKURA_PIVOT.y) });
    gsap.set(falling, { transformOrigin: '50% 50%' });
    let timeline: gsap.core.Timeline | null = null;
    return {
      enter: () => {
        timeline?.kill();
        timeline = gsap
          .timeline()
          .to(branch, { rotation: 3, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0)
          .fromTo(
            falling,
            { x: 0, y: 0, rotation: 0, opacity: 1 },
            { x: 0.22, y: 0.7, rotation: 160, opacity: 0, duration: 1.4, ease: 'power1.in' },
            0.15,
          );
      },
      leave: () => {
        timeline?.kill();
        gsap.to(branch, { rotation: 0, duration: 0.3, ease: 'washi' });
        gsap.to(falling, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.4, delay: 0.2, ease: 'washi' });
      },
      kill: () => {
        timeline?.kill();
        gsap.killTweensOf([...branch, ...falling]);
      },
    };
  },

  // Las líneas de agua ondulan mientras dura el hover.
  torii: (svg) => {
    const water = parts(svg, 'water');
    let tween: gsap.core.Tween | null = null;
    return {
      enter: () => {
        tween?.kill();
        tween = gsap.to(water, { attr: { 'stroke-dashoffset': '-=0.64' }, duration: 1.6, ease: 'none', repeat: -1 });
      },
      leave: () => {
        tween?.kill();
        tween = gsap.to(water, { attr: { 'stroke-dashoffset': 0 }, duration: 0.4, ease: 'washi' });
      },
      kill: () => tween?.kill(),
    };
  },

  // Los tejados se asientan de abajo arriba y destella el sōrin.
  pagoda: (svg) => {
    const roofs = parts(svg, 'roof');
    const glint = parts(svg, 'glint');
    gsap.set(glint, { transformOrigin: '50% 50%' });
    let timeline: gsap.core.Timeline | null = null;
    return {
      enter: () => {
        timeline?.kill();
        timeline = gsap
          .timeline()
          .fromTo(roofs, { y: -0.05 }, { y: 0, duration: 0.6, ease: 'spring', stagger: 0.08 }, 0)
          .fromTo(
            glint,
            { opacity: 0, scale: 0.5 },
            { opacity: 0.9, scale: 1.3, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 },
            0.2,
          );
      },
      leave: () => {},
      kill: () => timeline?.kill(),
    };
  },

  // Se balancea como un péndulo amortiguado desde el cordón y se enciende por dentro.
  farol: (svg) => {
    const lantern = parts(svg, 'lantern');
    const glow = parts(svg, 'glow');
    gsap.set(lantern, { svgOrigin: origin(LANTERN_PIVOT.x, LANTERN_PIVOT.y) });
    let timeline: gsap.core.Timeline | null = null;
    return {
      enter: () => {
        timeline?.kill();
        timeline = gsap
          .timeline()
          .to(
            lantern,
            {
              keyframes: [
                { rotation: 7, duration: 0.35, ease: 'sine.out' },
                { rotation: -4.5, duration: 0.5, ease: 'sine.inOut' },
                { rotation: 2.2, duration: 0.45, ease: 'sine.inOut' },
                { rotation: 0, duration: 0.5, ease: 'sine.inOut' },
              ],
            },
            0,
          )
          .to(glow, { opacity: 0.4, duration: 0.4, ease: 'washi' }, 0);
      },
      leave: () => {
        gsap.to(glow, { opacity: 0, duration: 0.5, ease: 'washi' });
      },
      kill: () => {
        timeline?.kill();
        gsap.killTweensOf(lantern);
      },
    };
  },

  // La espiral de la rodaja de delante gira mientras dura el hover y frena al salir.
  naruto: (svg) => {
    const spiral = parts(svg, 'spiral');
    gsap.set(spiral, { svgOrigin: origin(NARUTO_FRONT.x, NARUTO_FRONT.y) });
    let tween: gsap.core.Tween | null = null;
    return {
      enter: () => {
        tween?.kill();
        tween = gsap.to(spiral, { rotation: '+=360', duration: 2.4, ease: 'none', repeat: -1 });
      },
      leave: () => {
        tween?.kill();
        tween = gsap.to(spiral, { rotation: '+=50', duration: 0.6, ease: 'power2.out' });
      },
      kill: () => tween?.kill(),
    };
  },
};

export function iconMotion(icon: IconName, svg: SVGSVGElement): IconMotion {
  registerPresets();
  return MOTIONS[icon](svg);
}
