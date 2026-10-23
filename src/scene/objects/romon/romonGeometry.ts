/**
 * La geometría del rōmon, generada por código (Fase 6A).
 *
 * Pilares cilíndricos, vigas y ménsulas de cajas redondeadas (el canto atrapa
 * la luz, como en el torii), paños blancos, la base y la escalinata de piedra,
 * y los dos tejados: superficies de altura (`roofHeight`) sobre una rejilla,
 * con su cara de abajo —oscura: los aleros se ven desde abajo, la cámara pasa
 * a su altura— y el canto del alero. Los chōchin son tornos.
 *
 * Se fusiona en una geometría por material. Origen y medidas: `romon.ts`.
 */

import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, LatheGeometry, Vector2 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { ROMON, roofHeight } from './romon';

export interface RomonParts {
  /** Bermellón: pilares, vigas, ménsulas, barandilla. */
  readonly shu: BufferGeometry;
  /** Los paños blancos. */
  readonly wall: BufferGeometry;
  /** Piedra: la base y la escalinata. */
  readonly stone: BufferGeometry;
  /** Corteza: la cara de arriba de los tejados. */
  readonly roof: BufferGeometry;
  /** Sumi: la cara de abajo de los aleros, sus cantos, la cumbrera y la puerta de arriba. */
  readonly dark: BufferGeometry;
  /** El papel de los chōchin. */
  readonly paper: BufferGeometry;
  /** Las tapas negras de los chōchin y sus cordones. */
  readonly caps: BufferGeometry;
}

function prepared(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  if (flat.getAttribute('uv')) flat.deleteAttribute('uv');
  if (!flat.getAttribute('normal')) flat.computeVertexNormals();
  return flat;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, radius = 0.03): BufferGeometry {
  const geometry = new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 2.5, h / 2.5, d / 2.5));
  geometry.translate(x, y, z);
  return prepared(geometry);
}

function cylinder(radius: number, from: number, to: number, x: number, z: number, segments = 16): BufferGeometry {
  const geometry = new CylinderGeometry(radius * 0.94, radius, to - from, segments, 1, true);
  geometry.translate(x, (from + to) / 2, z);
  return prepared(geometry);
}

type Roof = Parameters<typeof roofHeight>[0];

/**
 * Un tejado: su cara de arriba (corteza), su cara de abajo y el canto del
 * alero (oscuros). Rejilla de `nx × nz` sobre su planta; los vértices de la
 * cara de abajo bajan el grosor del tejado.
 */
function roofSurfaces(roof: Roof, thickness: number, nx = 30, nz = 22): { top: BufferGeometry; under: BufferGeometry } {
  const top: number[] = [];
  const under: number[] = [];
  const at = (i: number, j: number) => {
    const x = -roof.halfW + (2 * roof.halfW * i) / nx;
    const z = -roof.halfD + (2 * roof.halfD * j) / nz;
    return [x, roofHeight(roof, x, z), z] as const;
  };
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const a = at(i, j);
      const b = at(i + 1, j);
      const c = at(i, j + 1);
      const d = at(i + 1, j + 1);
      // Arriba, mirando a +y: x crece con i, z con j.
      top.push(...a, ...c, ...b, ...b, ...c, ...d);
      const down = (p: readonly [number, number, number]) => [p[0], p[1] - thickness, p[2]] as const;
      under.push(...down(a), ...down(b), ...down(c), ...down(b), ...down(d), ...down(c));
    }
  }
  // El canto del alero, alrededor: de la cara de arriba a la de abajo.
  const ring: (readonly [number, number, number])[] = [];
  for (let i = 0; i <= nx; i += 1) ring.push(at(i, 0));
  for (let j = 1; j <= nz; j += 1) ring.push(at(nx, j));
  for (let i = nx - 1; i >= 0; i -= 1) ring.push(at(i, nz));
  for (let j = nz - 1; j >= 0; j -= 1) ring.push(at(0, j));
  for (let k = 0; k + 1 < ring.length; k += 1) {
    const p = ring[k]!;
    const q = ring[k + 1]!;
    under.push(p[0], p[1], p[2], q[0], q[1], q[2], p[0], p[1] - thickness, p[2]);
    under.push(q[0], q[1], q[2], q[0], q[1] - thickness, q[2], p[0], p[1] - thickness, p[2]);
  }
  const toGeometry = (positions: number[]) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  };
  return { top: toGeometry(top), under: toGeometry(under) };
}

/** Un chōchin: un barril de papel con sus tapas. Centro en (x, y, z). */
function lantern(x: number, y: number, z: number): { paper: BufferGeometry; caps: BufferGeometry[] } {
  const { radius, height } = ROMON.lanterns;
  const points: Vector2[] = [];
  const rings = 14;
  for (let k = 0; k <= rings; k += 1) {
    const t = k / rings;
    // Abombado: estrecho arriba y abajo, ancho en medio.
    points.push(new Vector2(radius * (0.62 + 0.38 * Math.sin(Math.PI * t)), height * (t - 0.5)));
  }
  const paper = new LatheGeometry(points, 24);
  paper.translate(x, y, z);
  const capHeight = 0.16;
  const caps = [
    cylinder(radius * 0.66, y + height / 2 - 0.02, y + height / 2 + capHeight, x, z, 20),
    cylinder(radius * 0.66, y - height / 2 - capHeight, y - height / 2 + 0.02, x, z, 20),
    // El cordón, del alero a la tapa.
    cylinder(0.035, y + height / 2 + capHeight, ROMON.lowerRoof.eave - 0.1, x, z, 6),
  ];
  // Las tapas, cerradas por abajo y por arriba: un disco en cada extremo.
  for (const [cy, flip] of [
    [y + height / 2 + capHeight, false],
    [y - height / 2 - capHeight, true],
  ] as const) {
    const disc = new CylinderGeometry(radius * 0.66, radius * 0.66, 0.01, 20, 1, false);
    disc.translate(x, cy + (flip ? 0.005 : -0.005), z);
    caps.push(prepared(disc));
  }
  return { paper: prepared(paper), caps };
}

function build(): RomonParts {
  const shu: BufferGeometry[] = [];
  const wall: BufferGeometry[] = [];
  const stone: BufferGeometry[] = [];
  const dark: BufferGeometry[] = [];
  const caps: BufferGeometry[] = [];
  const paper: BufferGeometry[] = [];
  const { base, steps } = ROMON;
  const floor = base.height;

  // La base de piedra (kidan) y la escalinata delante del vano central.
  stone.push(box(base.width, base.height, base.depth, 0, base.height / 2, 0, 0.05));
  for (let k = 0; k < steps.count; k += 1) {
    const h = steps.rise * (k + 1);
    const depth = steps.run * (steps.count - k);
    stone.push(box(steps.width, h, depth, 0, h / 2, base.depth / 2 + depth / 2, 0.03));
  }

  // Abajo: los pilares, con su basa de piedra.
  for (const x of ROMON.columnsX) {
    for (const z of ROMON.columnsZ) {
      shu.push(cylinder(ROMON.columnRadius, floor, ROMON.lowerTop, x, z));
      stone.push(box(0.8, 0.12, 0.8, x, floor + 0.06, z, 0.03));
      // Las ménsulas: dos bloques escalonados sobre cada pilar.
      shu.push(box(0.8, 0.26, 0.8, x, ROMON.lowerTop + 0.13, z, 0.03));
      shu.push(box(1.2, 0.26, 1.0, x, ROMON.lowerTop + 0.39, z, 0.03));
    }
  }
  // Las vigas: a lo largo de cada fila y de cada eje, en dos alturas.
  const spanX = ROMON.columnsX[3] - ROMON.columnsX[0] + 0.8;
  const spanZ = ROMON.columnsZ[2] - ROMON.columnsZ[0] + 0.8;
  for (const y of [4.55, 5.1]) {
    for (const z of ROMON.columnsZ) shu.push(box(spanX, 0.3, 0.28, 0, y, z));
    for (const x of ROMON.columnsX) shu.push(box(0.28, 0.3, spanZ, x, y, 0));
  }
  // Los paños blancos de los vanos de los lados (en la fila de en medio) y de
  // los costados: el vano central queda abierto.
  const wallTop = 4.4;
  for (const sign of [-1, 1]) {
    wall.push(box(2.6, wallTop - floor, 0.16, sign * 3, (floor + wallTop) / 2, 0, 0.02));
    for (const z of [-1.3, 1.3]) wall.push(box(0.16, wallTop - floor, 2.3, sign * 4.5, (floor + wallTop) / 2, z, 0.02));
  }
  // Un zócalo bermellón bajo los paños.
  for (const sign of [-1, 1]) shu.push(box(2.8, 0.35, 0.2, sign * 3, floor + 0.18, 0));

  // El balcón: el suelo, los pies de la barandilla y sus dos listones.
  const { balcony } = ROMON;
  dark.push(box(balcony.halfW * 2, 0.18, balcony.halfD * 2, 0, balcony.floor + 0.09, 0, 0.03));
  const railTop = balcony.floor + balcony.railHeight;
  for (const z of [-balcony.halfD, balcony.halfD]) {
    for (let x = -balcony.halfW; x <= balcony.halfW + 1e-6; x += 1.125) shu.push(box(0.12, balcony.railHeight, 0.12, x, balcony.floor + balcony.railHeight / 2 + 0.18, z));
    shu.push(box(balcony.halfW * 2 + 0.12, 0.1, 0.14, 0, railTop + 0.15, z));
    shu.push(box(balcony.halfW * 2 + 0.12, 0.07, 0.1, 0, balcony.floor + 0.5, z));
  }
  for (const x of [-balcony.halfW, balcony.halfW]) {
    for (let z = -balcony.halfD; z <= balcony.halfD + 1e-6; z += 1.18) shu.push(box(0.12, balcony.railHeight, 0.12, x, balcony.floor + balcony.railHeight / 2 + 0.18, z));
    shu.push(box(0.14, 0.1, balcony.halfD * 2 + 0.12, x, railTop + 0.15, 0));
    shu.push(box(0.1, 0.07, balcony.halfD * 2 + 0.12, x, balcony.floor + 0.5, 0));
  }

  // Arriba: pilares, paños entre ellos, la puerta del centro y las ménsulas.
  const upperFloor = balcony.floor + 0.18;
  for (const x of ROMON.upperX) {
    for (const z of ROMON.upperZ) {
      shu.push(cylinder(0.24, upperFloor, ROMON.upperTop, x, z));
      shu.push(box(0.7, 0.22, 0.7, x, ROMON.upperTop + 0.11, z, 0.03));
      shu.push(box(1.0, 0.22, 0.85, x, ROMON.upperTop + 0.33, z, 0.03));
    }
  }
  const upperWallTop = ROMON.upperTop - 0.25;
  for (const z of ROMON.upperZ) {
    for (const [x0, x1] of [
      [-3.3, -1.1],
      [1.1, 3.3],
    ] as const) {
      wall.push(box(x1 - x0 - 0.4, upperWallTop - upperFloor, 0.14, (x0 + x1) / 2, (upperFloor + upperWallTop) / 2, z, 0.02));
    }
    // La puerta del vano central, oscura.
    dark.push(box(1.7, upperWallTop - upperFloor, 0.12, 0, (upperFloor + upperWallTop) / 2, z, 0.02));
  }
  for (const x of [-3.3, 3.3]) wall.push(box(0.14, upperWallTop - upperFloor, 3.3, x, (upperFloor + upperWallTop) / 2, 0, 0.02));
  for (const z of ROMON.upperZ) shu.push(box(7.2, 0.26, 0.26, 0, upperWallTop + 0.13, z));
  for (const x of ROMON.upperX) shu.push(box(0.26, 0.26, 4.2, x, upperWallTop + 0.13, 0));

  // Los dos tejados.
  const lower = roofSurfaces(ROMON.lowerRoof, ROMON.roofThickness);
  const upper = roofSurfaces(ROMON.upperRoof, ROMON.roofThickness);
  // La cumbrera y sus dos tejas de remate (onigawara).
  const ridgeY = ROMON.upperRoof.top;
  dark.push(box(ROMON.upperRoof.ridgeHalf * 2 + 0.6, 0.32, 0.42, 0, ridgeY + 0.12, 0, 0.06));
  for (const sign of [-1, 1]) dark.push(box(0.45, 0.6, 0.5, sign * (ROMON.upperRoof.ridgeHalf + 0.35), ridgeY + 0.25, 0, 0.08));
  dark.push(lower.under, upper.under);

  // Los chōchin, delante de los vanos de los lados.
  for (const sign of [-1, 1]) {
    const { lanterns } = ROMON;
    const piece = lantern(sign * lanterns.x, lanterns.y, lanterns.z);
    paper.push(piece.paper);
    caps.push(...piece.caps);
  }

  const merge = (parts: BufferGeometry[]): BufferGeometry => {
    const merged = mergeGeometries(parts.map((part) => (part.index ? prepared(part) : part)));
    for (const part of parts) part.dispose();
    if (!merged) throw new Error('rōmon: no se pudo fusionar la geometría');
    return merged;
  };

  return {
    shu: merge(shu),
    wall: merge(wall),
    stone: merge(stone),
    roof: merge([lower.top, upper.top]),
    dark: merge(dark),
    paper: merge(paper),
    caps: merge(caps),
  };
}

let cached: RomonParts | null = null;

/** La geometría del rōmon, calculada una vez. */
export function romonGeometry(): RomonParts {
  cached ??= build();
  return cached;
}
