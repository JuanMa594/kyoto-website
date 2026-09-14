/**
 * Las hojas y los pétalos, generados por código.
 *
 * Ninguno es un dibujo ni una textura: los tres salen de una función de
 * contorno que se triangula en abanico. Eso es lo que permite que el shader los
 * voltee por vértices y que la misma malla sirva para trescientas instancias
 * con un solo draw call.
 *
 * Las tres formas son deliberadamente reconocibles por silueta, porque a esta
 * escala —entre 0,17 y 0,3 unidades— el color y el contorno es todo lo que se
 * ve: el pétalo de cerezo con su muesca en la punta, el arce de cinco lóbulos y
 * la hoja lanceolada del bambú.
 */

import { BufferGeometry, Float32BufferAttribute } from 'three';

import type { PetalKind } from '@/config/journey';
import { smoothstep } from '@/lib/procedural';

interface Point {
  x: number;
  y: number;
}

/**
 * Triangula un contorno cerrado en abanico desde su centro y le da una
 * curvatura: los bordes se van hacia atrás como una hoja acopada. Esa
 * curvatura no es un adorno — es lo que hace que la normal cambie a lo largo de
 * la superficie y que al voltear se vea un destello en vez de un rectángulo
 * plano que se enciende y se apaga.
 *
 * La malla se normaliza para que su lado mayor mida 1, de modo que la escala de
 * cada capa (`PetalLayer.scale`) se lea directamente en unidades de mundo.
 */
function fanFromOutline(outline: readonly Point[], cup: number, sizeFactor: number): BufferGeometry {
  const ys = outline.map((p) => p.y);
  const xs = outline.map((p) => p.x);
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const extent = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  const norm = (sizeFactor / extent) || 1;
  const halfWidth = Math.max(...outline.map((p) => Math.abs(p.x - midX))) || 1;

  const positions: number[] = [];
  const push = (x: number, y: number) => {
    const dx = x - midX;
    positions.push(dx * norm, (y - midY) * norm, -cup * (dx / halfWidth) ** 2 * norm);
  };

  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    push(midX, midY);
    push(a.x, a.y);
    push(b.x, b.y);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  // Sin índices, así que sale con normal por cara: el mismo *flat shading* de
  // las piedras del camino.
  geometry.computeVertexNormals();

  return geometry;
}

/** Cierra un contorno simétrico a partir de su mitad derecha. */
function mirrorHalf(half: readonly Point[]): Point[] {
  const outline = [...half];
  for (let i = half.length - 2; i >= 1; i -= 1) {
    const point = half[i]!;
    outline.push({ x: -point.x, y: point.y });
  }
  return outline;
}

const SEGMENTS = 14;

/**
 * Pétalo de cerezo. La clave está en la muesca: el borde sube por los dos
 * lóbulos y **baja** al llegar al centro. Sin ese hundimiento la silueta es una
 * lágrima y podría ser cualquier cosa.
 */
function sakuraOutline(): Point[] {
  const width = 0.42;
  const notch = 0.34;

  const half: Point[] = [];
  for (let i = 0; i <= SEGMENTS; i += 1) {
    const u = i / SEGMENTS;
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
function momijiOutline(): Point[] {
  const points: Point[] = [];
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
function bambuOutline(): Point[] {
  const width = 0.16;
  const bend = 0.14;

  const half: Point[] = [];
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

/**
 * La geometría de una hoja. El tamaño relativo entre familias es real: una hoja
 * de arce es bastante mayor que un pétalo de cerezo.
 */
export function petalGeometry(kind: PetalKind): BufferGeometry {
  switch (kind) {
    case 'sakura':
      return fanFromOutline(sakuraOutline(), 0.13, 1);
    case 'momiji':
      return fanFromOutline(momijiOutline(), 0.1, 1.3);
    case 'bambu':
      return fanFromOutline(bambuOutline(), 0.07, 1.15);
    case 'ninguna':
      return new BufferGeometry();
  }
}
