import { polygon, polyline, type Pt } from './svg';
import type { IconShape } from './types';

/**
 * Gastronomía: dos rodajas de naruto, la de atrás desplazada. El borde
 * festoneado es `r(θ) = R + a·sin(10θ)` y el remolino, una espiral de
 * Arquímedes `r = kθ`.
 */

/** La rodaja de delante: el centro sobre el que gira su espiral. */
export const NARUTO_FRONT = { x: -0.14, y: 0.12, r: 0.52 } as const;
const NARUTO_BACK = { x: 0.24, y: -0.16, r: 0.46 } as const;

const LOBES = 10;
const EDGE_STEPS = 70;
const SPIRAL_TURNS = 3.2 * Math.PI;
const SPIRAL_STEPS = 40;

function slice(cx: number, cy: number, r: number): Pt[] {
  return Array.from({ length: EDGE_STEPS }, (_, i) => {
    const t = (i / EDGE_STEPS) * Math.PI * 2;
    const radius = r + r * 0.09 * Math.sin(LOBES * t);
    return { x: cx + Math.cos(t) * radius, y: cy + Math.sin(t) * radius };
  });
}

function spiral(cx: number, cy: number, r: number): Pt[] {
  const k = (r * 0.62) / SPIRAL_TURNS;
  return Array.from({ length: SPIRAL_STEPS + 1 }, (_, i) => {
    const t = (i / SPIRAL_STEPS) * SPIRAL_TURNS;
    return { x: cx + Math.cos(t) * k * t, y: cy + Math.sin(t) * k * t };
  });
}

export function buildNaruto(): IconShape {
  const ink = 'var(--color-sumi)';
  const paper = 'var(--color-kami)';
  const { x: bx, y: by, r: br } = NARUTO_BACK;
  const { x: fx, y: fy, r: fr } = NARUTO_FRONT;
  return [
    { d: polygon(slice(bx, by, br)), fill: paper, stroke: ink, strokeWidth: 0.07 },
    { d: polyline(spiral(bx, by, br)), stroke: ink, strokeWidth: 0.06 },
    { d: polygon(slice(fx, fy, fr)), fill: paper, stroke: ink, strokeWidth: 0.07 },
    { d: polyline(spiral(fx, fy, fr)), stroke: ink, strokeWidth: 0.06, part: 'spiral' },
  ];
}

export const NARUTO = buildNaruto();
