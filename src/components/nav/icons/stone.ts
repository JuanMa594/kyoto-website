import { mulberry32 } from '@/lib/procedural';

import { polygon, type Pt } from './svg';

/**
 * Una piedrecita del riel plegado: un contorno de 7–9 vértices con ruido en el
 * radio, algo apaisado. Es el mismo lenguaje que las piedras del camino, a
 * 10 px. Determinista: misma semilla, misma piedra.
 */
export function stoneOutline(seed: number): string {
  const random = mulberry32(seed * 7919 + 17);
  const count = 7 + Math.floor(random() * 3);
  const turn = random() * Math.PI * 2;
  const points: Pt[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = turn + ((i + (random() - 0.5) * 0.5) / count) * Math.PI * 2;
    const radius = 0.78 + random() * 0.2;
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.8 });
  }
  return polygon(points);
}
