/**
 * Utilidades para escribir paths de SVG a partir de geometría calculada. Todo
 * en el viewBox −1…1 de los íconos, con la y hacia abajo.
 */

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Un número del path: 3 decimales y nunca «-0». */
export function num(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded === 0 ? 0 : rounded);
}

const pair = (p: Pt) => `${num(p.x)} ${num(p.y)}`;

/** Polígono cerrado. */
export function polygon(points: readonly Pt[]): string {
  return `M${points.map(pair).join('L')}Z`;
}

/** Trazo abierto. */
export function polyline(points: readonly Pt[]): string {
  return `M${points.map(pair).join('L')}`;
}

export function rect(x: number, y: number, width: number, height: number): string {
  return polygon([
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]);
}

/** Círculo como dos arcos: un path, sin `<circle>`, para tratarlo como cualquier capa. */
export function circle(cx: number, cy: number, r: number): string {
  const a = `${num(cx - r)} ${num(cy)}`;
  const b = `${num(cx + r)} ${num(cy)}`;
  return `M${a}A${num(r)} ${num(r)} 0 1 0 ${b}A${num(r)} ${num(r)} 0 1 0 ${a}Z`;
}

export function ellipsePoints(cx: number, cy: number, rx: number, ry: number, steps = 32): Pt[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * Math.PI * 2;
    return { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry };
  });
}

/** Escala, gira (radianes) y traslada, en ese orden. */
export function place(
  points: readonly Pt[],
  { x = 0, y = 0, rotate = 0, scale = 1 }: { x?: number; y?: number; rotate?: number; scale?: number },
): Pt[] {
  const cos = Math.cos(rotate);
  const sin = Math.sin(rotate);
  return points.map((p) => ({
    x: x + (p.x * cos - p.y * sin) * scale,
    y: y + (p.x * sin + p.y * cos) * scale,
  }));
}

/** Encaja un conjunto de puntos en ±`extent`, centrado y sin deformar. */
export function fitter(points: readonly Pt[], extent: number) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = (2 * extent) / Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const point = (p: Pt): Pt => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale });
  return { scale, point, points: (list: readonly Pt[]) => list.map(point) };
}

/** Todos los números de un path: para comprobar que son finitos y caben. */
export function pathNumbers(d: string): number[] {
  return (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
}
