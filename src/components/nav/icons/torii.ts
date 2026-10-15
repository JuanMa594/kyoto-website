import { polygon, rect } from './svg';
import type { IconShape } from './types';

/**
 * Fushimi Inari: un torii por proporciones —kasagi con las puntas alzadas,
 * shimaki, nuki, gakuzuka, hashira con un leve ahusado y nemaki oscuro al
 * pie— y, debajo, dos líneas de agua discontinuas.
 */
export function buildTorii(): IconShape {
  const shu = 'var(--color-shu)';
  const sumi = 'var(--color-sumi)';
  // El kasagi: arriba y abajo, curvas que dejan las puntas más altas que el centro.
  const kasagi = 'M-0.82 -0.66Q0 -0.5 0.82 -0.66L0.76 -0.54Q0 -0.4 -0.76 -0.54Z';
  const pillar = (side: 1 | -1) =>
    polygon([
      { x: side * 0.34, y: -0.44 },
      { x: side * 0.44, y: -0.44 },
      { x: side * 0.47, y: 0.46 },
      { x: side * 0.35, y: 0.46 },
    ]);
  return [
    { d: kasagi, fill: shu },
    { d: rect(-0.68, -0.48, 1.36, 0.07), fill: shu },
    { d: rect(-0.62, -0.26, 1.24, 0.08), fill: shu },
    { d: rect(-0.07, -0.42, 0.14, 0.17), fill: shu },
    { d: rect(-0.045, -0.39, 0.09, 0.1), fill: 'var(--color-kami)' },
    { d: pillar(-1), fill: shu },
    { d: pillar(1), fill: shu },
    { d: rect(-0.49, 0.4, 0.16, 0.09), fill: sumi },
    { d: rect(0.33, 0.4, 0.16, 0.09), fill: sumi },
    { d: 'M-0.74 0.62L0.74 0.62', stroke: shu, strokeWidth: 0.035, dash: '0.22 0.1', part: 'water' },
    { d: 'M-0.56 0.74L0.56 0.74', stroke: shu, strokeWidth: 0.035, dash: '0.16 0.12', part: 'water' },
  ];
}

export const TORII = buildTorii();
