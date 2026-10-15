import { sakuraOutline } from '@/lib/petalOutlines';
import { lerp, mulberry32 } from '@/lib/procedural';

import { circle, ellipsePoints, fitter, place, polygon, type Pt } from './svg';
import type { IconShape } from './types';

/**
 * Eventos: una rama de cerezo por ramificación recursiva con semilla. El
 * tronco sube en diagonal, de abajo a la izquierda hacia arriba a la derecha;
 * dos niveles de ramas se van afinando, y las flores son cinco pétalos con el
 * **mismo contorno que cae en la escena** (`lib/petalOutlines.ts`), más
 * grueso: a 56 px el pétalo mide unos 3 px.
 */

/** Un pétalo con 3 segmentos por lado: 6 vértices, la muesca incluida. */
const PETAL = sakuraOutline(3);
const EXTENT = 0.84;

interface Layout {
  readonly twigs: Pt[][];
  readonly blossoms: Pt[][][];
  readonly centers: Pt[];
  readonly buds: Pt[][];
  readonly falling: Pt[];
  readonly base: Pt;
}

/** Una rama ahusada: un cuadrilátero que adelgaza hacia la punta. */
function twig(from: Pt, to: Pt, width: number): Pt[] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const end = width * 0.55;
  return [
    { x: from.x + (nx * width) / 2, y: from.y + (ny * width) / 2 },
    { x: to.x + (nx * end) / 2, y: to.y + (ny * end) / 2 },
    { x: to.x - (nx * end) / 2, y: to.y - (ny * end) / 2 },
    { x: from.x - (nx * width) / 2, y: from.y - (ny * width) / 2 },
  ];
}

function flower(center: Pt, size: number, turn: number): Pt[][] {
  return Array.from({ length: 5 }, (_, k) =>
    place(PETAL, { x: center.x, y: center.y, rotate: turn + (k * 2 * Math.PI) / 5, scale: size }),
  );
}

function layout(): Layout {
  const random = mulberry32(31);
  const base: Pt = { x: 0, y: 0 };
  const twigs: Pt[][] = [];
  const tips: Pt[] = [];
  const mids: Pt[] = [];

  const grow = (from: Pt, angle: number, length: number, width: number, depth: number) => {
    const to = { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
    twigs.push(twig(from, to, width));
    tips.push(to);
    if (depth === 0) {
      mids.push({ x: lerp(from.x, to.x, 0.5), y: lerp(from.y, to.y, 0.5) });
      return;
    }
    for (const [at, side] of [
      [0.38, -1],
      [0.68, 1],
    ] as const) {
      const start = { x: lerp(from.x, to.x, at), y: lerp(from.y, to.y, at) };
      grow(start, angle + side * (0.5 + random() * 0.3), length * (0.4 + random() * 0.12), width * 0.6, depth - 1);
    }
  };
  // En SVG la y va hacia abajo: «hacia arriba a la derecha» es un ángulo negativo.
  grow(base, -Math.PI / 4 - 0.08, 1, 0.05, 2);

  const blossoms: Pt[][][] = [];
  const centers: Pt[] = [];
  for (const tip of tips) {
    const spots = [tip];
    if (random() < 0.3) {
      const a = random() * Math.PI * 2;
      spots.push({ x: tip.x + Math.cos(a) * 0.13, y: tip.y + Math.sin(a) * 0.13 });
    }
    for (const spot of spots) {
      centers.push(spot);
      blossoms.push(flower(spot, 0.12 + random() * 0.03, random() * Math.PI * 2));
    }
  }

  const buds = mids.map((m) => ellipsePoints(m.x, m.y, 0.025, 0.035, 10));
  // Un pétalo suelto junto a la punta del tronco: es el que cae al pasar por encima.
  const falling = place(PETAL, { x: tips[0]!.x + 0.12, y: tips[0]!.y + 0.16, rotate: 0.6, scale: 0.12 });

  const fit = fitter([...twigs, ...blossoms.flat(), ...buds, falling].flat(), EXTENT);
  return {
    twigs: twigs.map(fit.points),
    blossoms: blossoms.map((f) => f.map(fit.points)),
    centers: centers.map(fit.point),
    buds: buds.map(fit.points),
    falling: fit.points(falling),
    base: fit.point(base),
  };
}

export function buildSakura(): IconShape {
  const { twigs, blossoms, centers, buds, falling } = layout();
  const petal = 'var(--color-sakura-pale)';
  const blush = 'var(--color-sakura)';
  return [
    { d: twigs.map(polygon).join(''), fill: 'var(--color-sumi-soft)', part: 'branch' },
    { d: buds.map(polygon).join(''), fill: blush, part: 'branch' },
    { d: blossoms.flat().map(polygon).join(''), fill: petal, stroke: blush, strokeWidth: 0.012, part: 'branch' },
    { d: centers.map((c) => circle(c.x, c.y, 0.024)).join(''), fill: blush, part: 'branch' },
    { d: polygon(falling), fill: petal, stroke: blush, strokeWidth: 0.012, part: 'falling' },
  ];
}

export const SAKURA = buildSakura();

/** El pie de la rama, ya encajado en el viewBox: el eje de su vaivén. */
export const SAKURA_PIVOT: Pt = layout().base;
