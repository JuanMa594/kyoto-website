/**
 * La geometría del kōsatsu, generada por código (Fase 5B).
 *
 * Postes y listones de cajas redondeadas (como el torii: el canto atrapa la
 * luz rasante), la tabla de una pieza y el tejadillo a dos aguas extruido a lo
 * largo de la tabla. Tres geometrías, una por material: madera oscura, tabla y
 * tejado. El papel del kakejiku va aparte (`Kosatsu.tsx`): se desenrolla.
 *
 * Origen y medidas: `kosatsu.ts`. Se calcula una vez y se comparte.
 */

import { BoxGeometry, BufferGeometry, ExtrudeGeometry, Shape } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { OldMap } from '@/config/journey';

import { boardWidth as widthFor, KOSATSU_BOARD_TOP, KOSATSU_POST_Z, KOSATSU_SIZE, kosatsuPosts } from './kosatsu';

export interface KosatsuParts {
  /** Madera oscura: postes, listones del marco y el travesaño de abajo. */
  readonly wood: BufferGeometry;
  /** La tabla, pálida: su veta la pone el shader con la posición local. */
  readonly board: BufferGeometry;
  /** El tejadillo. */
  readonly roof: BufferGeometry;
}

/** Todo con los mismos atributos —posición y normal, sin índices— para fusionar. */
function prepared(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  if (flat.getAttribute('uv')) flat.deleteAttribute('uv');
  if (!flat.getAttribute('normal')) flat.computeVertexNormals();
  return flat;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, radius = 0.025): BufferGeometry {
  const geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2.5, h / 2.5, d / 2.5));
  geometry.translate(x, y, z);
  return prepared(geometry);
}

/** El tejadillo: un perfil de «^» con algo de grosor en el alero, extruido a lo largo de x. */
function roof(boardWidth: number): BufferGeometry {
  const { roofOverhang, roofDepth, roofRise, frame } = KOSATSU_SIZE;
  const half = roofDepth / 2;
  const shape = new Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(half, 0.07);
  shape.lineTo(0, roofRise);
  shape.lineTo(-half, 0.07);
  shape.closePath();
  const length = boardWidth + 2 * roofOverhang;
  const geometry = new ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  // La extrusión va por z: girada, va por x. El perfil (x del Shape) queda en z.
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-length / 2, KOSATSU_BOARD_TOP + frame, 0);
  return prepared(geometry);
}

function build(map: OldMap | undefined): KosatsuParts {
  const { boardHeight, boardBottom, boardDepth, frame, postSize } = KOSATSU_SIZE;
  const boardWidth = widthFor(map);
  const posts = kosatsuPosts(map);
  const wood: BufferGeometry[] = [];

  // Los postes, del suelo al tejado (un poco enterrados), **detrás** de la
  // tabla: metidos desde los extremos, delante cruzarían el texto.
  const postHeight = KOSATSU_BOARD_TOP + frame + 0.12;
  const postZ = KOSATSU_POST_Z;
  for (const x of posts) wood.push(box(postSize, postHeight, postSize, x, postHeight / 2 - 0.08, postZ));

  // El marco: dos listones horizontales y dos verticales, algo por delante de la tabla.
  const frameZ = boardDepth / 2 + 0.01;
  const frameDepth = boardDepth + 0.06;
  wood.push(box(boardWidth + frame * 2, frame, frameDepth, 0, KOSATSU_BOARD_TOP + frame / 2, frameZ - frameDepth / 2 + 0.03));
  wood.push(box(boardWidth + frame * 2, frame, frameDepth, 0, boardBottom - frame / 2, frameZ - frameDepth / 2 + 0.03));
  for (const sign of [-1, 1]) {
    wood.push(box(frame, boardHeight, frameDepth, sign * (boardWidth / 2 + frame / 2), boardBottom + boardHeight / 2, frameZ - frameDepth / 2 + 0.03));
  }
  // El travesaño de abajo, entre los postes, por detrás.
  const span = posts[1] - posts[0];
  wood.push(box(span, 0.14, 0.12, 0, boardBottom * 0.45, postZ));

  // La tabla, de una pieza. Sin aristas redondeadas: va dentro del marco.
  const board = new BoxGeometry(boardWidth, boardHeight, boardDepth);
  board.translate(0, boardBottom + boardHeight / 2, 0);

  return {
    wood: mergeGeometries(wood)!,
    board: prepared(board),
    roof: roof(boardWidth),
  };
}

const cache = new Map<boolean, KosatsuParts>();

/** Las tres partes del kōsatsu, con mapa o sin él. Se calculan una vez y se comparten. */
export function kosatsuGeometry(map?: OldMap): KosatsuParts {
  const key = Boolean(map);
  let parts = cache.get(key);
  if (!parts) {
    parts = build(map);
    cache.set(key, parts);
  }
  return parts;
}
