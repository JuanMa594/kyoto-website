import { circle, num, rect } from './svg';
import type { IconLayer, IconShape } from './types';

/**
 * Kiyomizu-dera: tres tejados, cada uno al 78 % del anterior y con los aleros
 * curvados hacia arriba, y el sōrin —la aguja— en kohaku.
 */

const TIERS = 3;
const SHRINK = 0.78;
/** Distancia vertical entre tejados. */
const RISE = 0.34;
/** La línea del alero del tejado de abajo. */
const BASE = 0.6;

/** Un tejado: `y` es la línea del alero, `w` el medio ancho de punta a punta y `h` su alto. */
function roof(y: number, w: number, h: number): string {
  const p = (x: number, yy: number) => `${num(x)} ${num(yy)}`;
  return (
    `M${p(-0.4 * w, y - h)}L${p(0.4 * w, y - h)}` +
    `Q${p(0.58 * w, y - 0.25 * h)} ${p(w, y - 0.4 * h)}` +
    `Q${p(0.9 * w, y)} ${p(0.76 * w, y)}` +
    `L${p(-0.76 * w, y)}` +
    `Q${p(-0.9 * w, y)} ${p(-w, y - 0.4 * h)}` +
    `Q${p(-0.58 * w, y - 0.25 * h)} ${p(-0.4 * w, y - h)}Z`
  );
}

export function buildPagoda(): IconShape {
  const body = 'var(--color-shu-deep)';
  const tile = 'var(--color-shu-soft)';
  const bodies: IconLayer[] = [{ d: rect(-0.24, BASE, 0.48, 0.16), fill: body }];
  const roofs: IconLayer[] = [];

  let previousTop = BASE;
  for (let i = 0; i < TIERS; i += 1) {
    const w = 0.8 * SHRINK ** i;
    const h = 0.24 * 0.88 ** i;
    const y = BASE - i * RISE;
    // El cuerpo de este piso: del tejado de abajo a la línea de este alero.
    if (i > 0) bodies.push({ d: rect(-0.3 * w, y, 0.6 * w, previousTop - y), fill: body });
    roofs.push({ d: roof(y, w, h), fill: tile, part: 'roof' });
    previousTop = y - h;
  }

  // El sōrin: aguja, tres anillos y la joya (hōju) en lo alto.
  const top = previousTop;
  const gold = 'var(--color-kohaku)';
  const edge = 'var(--color-sumi-soft)';
  const sorin: IconLayer[] = [
    { d: rect(-0.02, top - 0.34, 0.04, 0.34), fill: edge },
    { d: rect(-0.07, top - 0.1, 0.14, 0.035), fill: gold, stroke: edge, strokeWidth: 0.015 },
    { d: rect(-0.06, top - 0.18, 0.12, 0.035), fill: gold, stroke: edge, strokeWidth: 0.015 },
    { d: rect(-0.05, top - 0.26, 0.1, 0.035), fill: gold, stroke: edge, strokeWidth: 0.015 },
    {
      d: `M0 ${num(top - 0.52)}Q0.07 ${num(top - 0.4)} 0 ${num(top - 0.34)}Q-0.07 ${num(top - 0.4)} 0 ${num(top - 0.52)}Z`,
      fill: gold,
      stroke: edge,
      strokeWidth: 0.02,
    },
    { d: circle(0, top - 0.42, 0.1), fill: 'var(--color-kami)', opacity: 0, part: 'glint' },
  ];

  return [...bodies, ...roofs, ...sorin];
}

export const PAGODA = buildPagoda();
