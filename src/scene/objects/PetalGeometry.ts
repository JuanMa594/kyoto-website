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
 *
 * Los contornos viven en `lib/petalOutlines.ts`: el ícono de Eventos del
 * sidebar los comparte sin cargar three (Fase 3C).
 */

import { BufferGeometry, Float32BufferAttribute } from 'three';

import type { PetalKind } from '@/config/journey';
import { bambuOutline, momijiOutline, sakuraOutline, type OutlinePoint } from '@/lib/petalOutlines';

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
export function outlineGeometry(outline: readonly OutlinePoint[], cup: number, sizeFactor: number): BufferGeometry {
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

/**
 * La geometría de una hoja. El tamaño relativo entre familias es real: una hoja
 * de arce es bastante mayor que un pétalo de cerezo.
 */
export function petalGeometry(kind: PetalKind): BufferGeometry {
  switch (kind) {
    case 'sakura':
      return outlineGeometry(sakuraOutline(), 0.13, 1);
    case 'momiji':
      return outlineGeometry(momijiOutline(), 0.1, 1.3);
    case 'bambu':
      return outlineGeometry(bambuOutline(), 0.07, 1.15);
    case 'ninguna':
      return new BufferGeometry();
  }
}
