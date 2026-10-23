/**
 * La geometría del ema-kake, generada por código (Fase 6A).
 *
 * Postes, travesaños y viga de cajas redondeadas (el canto atrapa la luz, como
 * en el torii y el kōsatsu), el tejadillo a dos aguas extruido a lo largo del
 * bastidor, la ema grande —un pentágono extruido— con sus dos cordones rojos,
 * y la ema de zorro, una sola pieza pequeña que se instancia en los
 * travesaños. Cinco geometrías, una por material.
 *
 * Origen y medidas: `ema.ts`. Se calculan una vez y se comparten.
 */

import { BufferGeometry, CylinderGeometry, ExtrudeGeometry, Quaternion, Shape, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { Side } from '@/config/journey';

import { EMA_SIZE, emaPosts, plaqueX } from './ema';

export interface EmaParts {
  /** Madera oscura: postes, travesaños y la viga de arriba. */
  readonly wood: BufferGeometry;
  /** El tejadillo. */
  readonly roof: BufferGeometry;
  /** La ema grande, de madera clara: su veta la pone el shader con la posición local. */
  readonly plaque: BufferGeometry;
  /** Los cordones rojos de la ema grande. */
  readonly cord: BufferGeometry;
}

function prepared(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  if (flat.getAttribute('uv')) flat.deleteAttribute('uv');
  if (!flat.getAttribute('normal')) flat.computeVertexNormals();
  return flat;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, radius = 0.02): BufferGeometry {
  const geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2.5, h / 2.5, d / 2.5));
  geometry.translate(x, y, z);
  return prepared(geometry);
}

/** Un cilindro fino entre dos puntos (los cordones). */
function rod(from: Vector3, to: Vector3, radius: number): BufferGeometry {
  const length = from.distanceTo(to);
  const geometry = new CylinderGeometry(radius, radius, length, 6, 1, false);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dir = to.clone().sub(from).normalize();
  // El cilindro va por +y: se gira hasta la dirección del cordón.
  geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir));
  geometry.translate(mid.x, mid.y, mid.z);
  return prepared(geometry);
}

function build(side: Side): EmaParts {
  const { frameWidth, postSize, postHeight, rails, railHeight, railDepth, roofOverhang, roofDepth, roofRise } = EMA_SIZE;
  const wood: BufferGeometry[] = [];

  // Los postes, un poco enterrados.
  for (const x of emaPosts()) wood.push(box(postSize, postHeight + 0.1, postSize, x, postHeight / 2 - 0.05, 0));
  // Los travesaños de las ema de zorro, entre los postes.
  for (const y of rails) wood.push(box(frameWidth, railHeight, railDepth, 0, y, 0, 0.015));
  // La viga de arriba, de la que cuelga la ema grande.
  wood.push(box(frameWidth + 0.3, 0.2, 0.26, 0, postHeight - 0.1, 0, 0.02));

  // El tejadillo a dos aguas, a lo largo del bastidor.
  const half = roofDepth / 2;
  const shape = new Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(half, 0.06);
  shape.lineTo(0, roofRise);
  shape.lineTo(-half, 0.06);
  shape.closePath();
  const length = frameWidth + 2 * roofOverhang;
  const roof = new ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  roof.rotateY(Math.PI / 2);
  roof.translate(-length / 2, postHeight, 0);

  // La ema grande: un pentágono —el tejadito de la ema— extruido.
  const { plaqueWidth, plaqueHeight, plaquePeak, plaqueDepth, plaqueBottom, plaqueFront } = EMA_SIZE;
  const w = plaqueWidth / 2;
  const plaqueShape = new Shape();
  plaqueShape.moveTo(-w, 0);
  plaqueShape.lineTo(w, 0);
  plaqueShape.lineTo(w, plaqueHeight);
  plaqueShape.lineTo(0, plaqueHeight + plaquePeak);
  plaqueShape.lineTo(-w, plaqueHeight);
  plaqueShape.closePath();
  const plaque = new ExtrudeGeometry(plaqueShape, {
    depth: plaqueDepth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.03,
    bevelSegments: 1,
  });
  const x = plaqueX(side);
  plaque.translate(x, plaqueBottom, plaqueFront - plaqueDepth / 2);

  // Los dos cordones rojos, de la viga a las esquinas de arriba de la ema.
  const beam = postHeight - 0.2;
  const cordZ = plaqueFront - plaqueDepth / 2;
  const cords = [-1, 1].map((s) =>
    rod(new Vector3(x + s * (w - 0.35), beam, 0.05), new Vector3(x + s * (w - 0.25), plaqueBottom + plaqueHeight - 0.05, cordZ), 0.03),
  );

  return {
    wood: mergeGeometries(wood)!,
    roof: prepared(roof),
    plaque: prepared(plaque),
    cord: mergeGeometries(cords)!,
  };
}

const cache = new Map<Side, EmaParts>();

/** Las partes del ema-kake de un lado del camino (la ema grande va del lado del camino). */
export function emaGeometry(side: Side): EmaParts {
  let parts = cache.get(side);
  if (!parts) {
    parts = build(side);
    cache.set(side, parts);
  }
  return parts;
}

/**
 * La ema de zorro: una cabeza de zorro —dos orejas, la frente entre ellas, las
 * mejillas y la barbilla en punta— extruida en una tablilla. El origen es el
 * punto de donde cuelga, arriba en el centro; la cara mira a +z.
 */
export function foxEmaGeometry(): BufferGeometry {
  const { foxWidth, foxHeight } = EMA_SIZE;
  const w = foxWidth / 2;
  const h = foxHeight;
  const shape = new Shape();
  shape.moveTo(-w * 0.85, -h * 0.02);
  shape.lineTo(-w * 0.4, -h * 0.18);
  shape.lineTo(0, -h * 0.13);
  shape.lineTo(w * 0.4, -h * 0.18);
  shape.lineTo(w * 0.85, -h * 0.02);
  shape.lineTo(w, -h * 0.34);
  shape.lineTo(w * 0.62, -h * 0.66);
  shape.lineTo(0, -h);
  shape.lineTo(-w * 0.62, -h * 0.66);
  shape.lineTo(-w, -h * 0.34);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
  if (geometry.getAttribute('uv')) geometry.deleteAttribute('uv');
  geometry.computeVertexNormals();
  return geometry;
}
