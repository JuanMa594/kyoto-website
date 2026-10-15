import { circle, ellipsePoints, polygon, polyline, rect } from './svg';
import type { IconLayer, IconShape } from './types';

/**
 * Gion: un chōchin. Nueve costillas cuya anchura sigue el perfil de una
 * elipse, alternando shu y shu oscuro, con tapas, cordón y borla. Todo cuelga
 * de `LANTERN_PIVOT`, que es sobre lo que se balancea.
 */

export const LANTERN_PIVOT = { x: 0, y: -0.84 } as const;

const CY = 0.04;
const H = 0.5;
const W = 0.5;
const RIBS = 9;
const MIN_HALF = 0.2;

const halfWidth = (y: number) => Math.max(MIN_HALF, W * Math.sqrt(Math.max(0, 1 - ((y - CY) / H) ** 2)));

export function buildFarol(): IconShape {
  const top = CY - H;
  const bottom = CY + H;
  const layers: IconLayer[] = [
    {
      d: polyline([
        { x: -0.16, y: top - 0.06 },
        LANTERN_PIVOT,
        { x: 0.16, y: top - 0.06 },
      ]),
      stroke: 'var(--color-shu-deep)',
      strokeWidth: 0.03,
      part: 'lantern',
    },
  ];

  for (let i = 0; i < RIBS; i += 1) {
    const y0 = top + (i / RIBS) * 2 * H;
    const y1 = top + ((i + 1) / RIBS) * 2 * H;
    const ym = (y0 + y1) / 2;
    const [w0, wm, w1] = [halfWidth(y0), halfWidth(ym), halfWidth(y1)];
    layers.push({
      d: polygon([
        { x: -w0, y: y0 },
        { x: w0, y: y0 },
        { x: wm, y: ym },
        { x: w1, y: y1 },
        { x: -w1, y: y1 },
        { x: -wm, y: ym },
      ]),
      fill: i % 2 === 0 ? 'var(--color-shu)' : 'var(--color-shu-deep)',
      part: 'lantern',
    });
  }

  layers.push(
    { d: polygon(ellipsePoints(0, CY, W * 0.7, H * 0.7)), fill: 'var(--color-kohaku)', opacity: 0, part: 'lantern glow' },
    { d: rect(-0.22, top - 0.08, 0.44, 0.09), fill: 'var(--color-sumi)', part: 'lantern' },
    { d: rect(-0.22, bottom - 0.01, 0.44, 0.09), fill: 'var(--color-sumi)', part: 'lantern' },
    { d: rect(-0.045, bottom + 0.08, 0.09, 0.22), fill: 'var(--color-shu)', part: 'lantern' },
    { d: circle(0, bottom + 0.09, 0.05), fill: 'var(--color-shu-deep)', part: 'lantern' },
  );

  return layers;
}

export const FAROL = buildFarol();
