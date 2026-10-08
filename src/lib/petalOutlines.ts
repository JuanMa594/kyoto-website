/**
 * Los contornos de las hojas y los pétalos, en puro: sin three.
 *
 * Los usan dos sitios: la escena, que los triangula en abanico para las
 * partículas (`scene/objects/PetalGeometry.ts`), y el ícono de Eventos del
 * sidebar, que dibuja sus flores con el mismo pétalo que cae (Fase 3C). Viven
 * fuera de `PetalGeometry` para que el ícono no meta three en el bundle de la
 * navegación, que carga en todas las páginas antes que el canvas.
 *
 * Coordenadas propias: la base de la hoja en el origen y la punta hacia +y.
 */

import { smoothstep } from '@/lib/procedural';

export interface OutlinePoint {
  x: number;
  y: number;
}

/** Cierra un contorno simétrico a partir de su mitad derecha. */
export function mirrorHalf(half: readonly OutlinePoint[]): OutlinePoint[] {
  const outline = [...half];
  for (let i = half.length - 2; i >= 1; i -= 1) {
    const point = half[i]!;
    outline.push({ x: -point.x, y: point.y });
  }
  return outline;
}

/** Vértices de media hoja en la escena. */
const SEGMENTS = 14;

/**
 * Pétalo de cerezo. La clave está en la muesca: el borde sube por los dos
 * lóbulos y **baja** al llegar al centro. Sin ese hundimiento la silueta es una
 * lágrima y podría ser cualquier cosa.
 *
 * `segments` baja la resolución sin cambiar la forma: en el ícono del sidebar,
 * a 56 px, el pétalo mide unos 3 px y se conforma con 3.
 */
export function sakuraOutline(segments = SEGMENTS): OutlinePoint[] {
  const width = 0.42;
  const notch = 0.34;

  const half: OutlinePoint[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    half.push({
      x: width * Math.sin(Math.PI * u) ** 0.55,
      y: u ** 0.9 - notch * smoothstep(0.72, 1, u),
    });
  }

  return mirrorHalf(half);
}

/**
 * Hoja de arce. Cinco lóbulos en coordenadas polares: `|cos(2.5θ)|` tiene
 * exactamente cinco máximos en una vuelta, y el exponente los afila.
 */
export function momijiOutline(): OutlinePoint[] {
  const points: OutlinePoint[] = [];
  const steps = 60;

  for (let i = 0; i < steps; i += 1) {
    // El desfase deja un lóbulo apuntando hacia arriba.
    const angle = (i / steps) * Math.PI * 2 + Math.PI / 2;
    const lobes = Math.abs(Math.cos(2.5 * (angle - Math.PI / 2)));
    const radius = 0.5 * (0.42 + 0.58 * lobes ** 0.4);
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }

  return points;
}

/** Hoja de bambú: lanceolada, larga y con una curva suave hacia un lado. */
export function bambuOutline(): OutlinePoint[] {
  const width = 0.16;
  const bend = 0.14;

  const half: OutlinePoint[] = [];
  for (let i = 0; i <= SEGMENTS; i += 1) {
    const u = i / SEGMENTS;
    half.push({ x: bend * u * u + width * Math.sin(Math.PI * u) ** 0.8, y: u });
  }

  const outline = [...half];
  for (let i = SEGMENTS - 1; i >= 1; i -= 1) {
    const u = i / SEGMENTS;
    outline.push({ x: bend * u * u - width * Math.sin(Math.PI * u) ** 0.8, y: u });
  }

  return outline;
}
