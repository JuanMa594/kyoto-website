import { JAPAN_ISLANDS, KYOTO_POINT } from './japan.generated';
import { circle, polygon } from './svg';
import type { IconShape } from './types';

/**
 * Ubicación: Japón de Kyushu a Hokkaido (Natural Earth, `bun run geo`) y un
 * punto en Kyoto, del que sale una onda al pasar por encima.
 */
export function buildMapa(): IconShape {
  const [kx, ky] = KYOTO_POINT;
  return [
    { d: JAPAN_ISLANDS.map((ring) => polygon(ring.map(([x, y]) => ({ x, y })))).join(''), fill: 'var(--color-shu)' },
    { d: circle(kx, ky, 0.13), stroke: 'var(--color-sumi)', strokeWidth: 0.03, opacity: 0, part: 'ripple' },
    { d: circle(kx, ky, 0.055), fill: 'var(--color-kohaku)', stroke: 'var(--color-sumi)', strokeWidth: 0.025 },
  ];
}

export const MAPA = buildMapa();
