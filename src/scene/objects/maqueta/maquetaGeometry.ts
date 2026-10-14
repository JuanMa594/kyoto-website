/**
 * La geometría de la maqueta de Japón (Fase 5A), generada por código.
 *
 * Cada prefectura se extruye dos veces: completa y fina para la **base** de
 * costa, y encogida encima para la **losa**. Las 46 de cada capa van fundidas
 * en una geometría con el atributo `aPref` (su índice en `PREFECTURES`), que
 * el shader usa para levantar cada losa o fundirla con el mar: una draw call
 * por material. De cada extrusión se quitan las tapas de abajo —descansan
 * sobre la bandeja y nunca se ven— y los triángulos de área cero, cuya normal
 * nula sería un punto negro (ver CLAUDE.md). Las normales son por cara, como
 * las piedras y los faroles.
 *
 * Los espacios: la bandeja, la base y las losas van en el de la bandeja (cara
 * de arriba en y = 0, x al este, z al sur); el atril, en el del objeto; el pin,
 * en el suyo (la punta en el origen, de frente hacia +z). Se calcula una vez y
 * se comparte.
 */

import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Path,
  Shape,
  ShapeGeometry,
  Sphere,
  ShapeUtils,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { MAQUETA_SIZE } from './maqueta';
import { LAKE_BIWA, PREFECTURES, type FlatPolygon, type FlatRing } from './prefectures.generated';
import { WAVE_LIFT, waveStrokes } from './waves';

export interface MaquetaParts {
  /** La bandeja y la ménsula que la une al atril (espacio de la bandeja). */
  readonly tray: BufferGeometry;
  /** Grupo 0: caras de arriba (sumi); grupo 1: cantos (koke). Con `aPref`. */
  readonly base: BufferGeometry;
  /** Grupo 0: caras (washi); grupo 1: cantos. Con `aPref`. */
  readonly slabs: BufferGeometry;
  /** El atril, en el espacio del objeto. */
  readonly column: BufferGeometry;
  /** Grupo 0: las caras (blancas); grupo 1: el bisel y el canto (shu). */
  readonly pinFace: BufferGeometry;
  /** El disco rojo del pin, delante de la cara. */
  readonly pinDisc: BufferGeometry;
  /** El agua del lago Biwa, en el espacio del contenido: no sube con Shiga. */
  readonly lake: BufferGeometry;
  /**
   * Las olas: cintas planas sobre el mar, con `aBrush` (a lo largo, a lo ancho,
   * semilla) y `aWave` (el sitio del mapa que siguen y su juego).
   */
  readonly waves: BufferGeometry;
}

/** Alto del pin, de la punta a lo alto de su cabeza. */
export const PIN_HEIGHT = 0.5;
const PIN_HEAD = { y: 0.33, r: 0.17 } as const;

/** Lo alto del atril: el capitel queda escondido dentro de la ménsula. */
const COLUMN_TOP = MAQUETA_SIZE.pivotY - 0.6;
/** La ménsula bajo la bandeja: medio lado y hasta dónde baja (espacio de la bandeja). */
const BRACKET = { half: 0.48, depth: 0.75 } as const;

interface Bucket {
  position: number[];
  normal: number[];
  pref: number[];
}

const newBuckets = (): [Bucket, Bucket] => [
  { position: [], normal: [], pref: [] },
  { position: [], normal: [], pref: [] },
];

const a = new Vector3();
const b = new Vector3();
const c = new Vector3();
const ab = new Vector3();
const ac = new Vector3();

/**
 * Pasa los triángulos de una geometría a los cubos de sus grupos, con normal
 * por cara. Sin los de área cero y, si se pide, sin los que miran abajo.
 */
function collect(geometry: BufferGeometry, buckets: readonly Bucket[], pref: number, dropBottom: boolean): void {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = flat.getAttribute('position');
  const groups = flat.groups.length > 0 ? flat.groups : [{ start: 0, count: position.count, materialIndex: 0 }];
  for (const group of groups) {
    const bucket = buckets[Math.min(group.materialIndex ?? 0, buckets.length - 1)]!;
    const end = Math.min(group.start + group.count, position.count);
    for (let i = group.start; i + 2 < end + 0; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      ab.cross(ac);
      const length = ab.length();
      if (length < 1e-10) continue;
      ab.divideScalar(length);
      if (dropBottom && ab.y < -0.5) continue;
      bucket.position.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      for (let k = 0; k < 3; k += 1) {
        bucket.normal.push(ab.x, ab.y, ab.z);
        bucket.pref.push(pref);
      }
    }
  }
  if (flat !== geometry) flat.dispose();
  geometry.dispose();
}

function build(buckets: readonly Bucket[], withPref: boolean): BufferGeometry {
  const geometry = new BufferGeometry();
  const position = buckets.flatMap((bucket) => bucket.position);
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(buckets.flatMap((bucket) => bucket.normal), 3));
  if (withPref) geometry.setAttribute('aPref', new Float32BufferAttribute(buckets.flatMap((bucket) => bucket.pref), 1));
  let start = 0;
  buckets.forEach((bucket, index) => {
    const count = bucket.position.length / 3;
    geometry.addGroup(start, count, index);
    start += count;
  });
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Un anillo plano a puntos de la forma: (x, −z), para que tras girarla la z sea la del sur. */
function ringPoints(ring: FlatRing): Vector2[] {
  const points: Vector2[] = [];
  for (let k = 0; k < ring.length; k += 2) points.push(new Vector2(ring[k]!, -ring[k + 1]!));
  return points;
}

/**
 * Una forma con sus agujeros, orientados como espera la extrusión (el
 * exterior en sentido horario, los agujeros al revés). `ExtrudeGeometry` sólo
 * corrige los agujeros cuando tiene que dar la vuelta al exterior.
 */
function polygonShape(polygon: FlatPolygon): Shape {
  const [outerRing, ...holeRings] = polygon;
  let outer = ringPoints(outerRing!);
  if (!ShapeUtils.isClockWise(outer)) outer = outer.reverse();
  const shape = new Shape(outer);
  for (const ring of holeRings) {
    let hole = ringPoints(ring);
    if (ShapeUtils.isClockWise(hole)) hole = hole.reverse();
    shape.holes.push(new Path(hole));
  }
  return shape;
}

/** Una capa del mapa: cada prefectura extruida `depth` desde `y0`. */
function layer(which: 'base' | 'slab', y0: number, depth: number): BufferGeometry {
  const buckets = newBuckets();
  PREFECTURES.forEach((prefecture, index) => {
    const shapes = prefecture[which].map(polygonShape);
    const extruded = new ExtrudeGeometry(shapes, { depth, bevelEnabled: false, steps: 1 });
    extruded.rotateX(-Math.PI / 2);
    extruded.translate(0, y0, 0);
    collect(extruded, buckets, index, true);
  });
  return build(buckets, true);
}

function trayGeometry(): BufferGeometry {
  const { tray, trayThickness } = MAQUETA_SIZE;
  const buckets = [{ position: [], normal: [], pref: [] }] as Bucket[];
  const box = new RoundedBoxGeometry(tray, trayThickness, tray, 2, 0.05);
  box.translate(0, -trayThickness / 2, 0);
  collect(box, buckets, 0, false);
  // La ménsula: gira con la bandeja y esconde el capitel del atril.
  const bracket = new BoxGeometry(BRACKET.half * 2, BRACKET.depth, BRACKET.half * 2);
  bracket.translate(0, -trayThickness - BRACKET.depth / 2 + 0.01, 0);
  collect(bracket, buckets, 0, false);
  const geometry = build(buckets, false);
  // El mar va pintado en la cara de arriba (`aSea`), no en una capa encima: dos
  // superficies a milímetros se pelean en el buffer de profundidad a lo lejos,
  // y la maqueta destellaba vista desde el tramo de la Home.
  const normal = geometry.getAttribute('normal');
  const position = geometry.getAttribute('position');
  const sea = new Float32Array(position.count);
  for (let i = 0; i < position.count; i += 1) sea[i] = normal.getY(i) > 0.99 && position.getY(i) > -0.001 ? 1 : 0;
  geometry.setAttribute('aSea', new Float32BufferAttribute(sea, 1));
  return geometry;
}

/**
 * El atril: un pie ancho, tres tambores con sus anillos y un capitel, en un
 * torno de doce lados. El perfil va del eje, por fuera, de abajo arriba.
 */
function columnGeometry(): BufferGeometry {
  const r = MAQUETA_SIZE.columnRadius;
  const profile: [number, number][] = [
    [0, 0],
    [0.62, 0],
    [0.62, 0.12],
    [0.52, 0.2],
    [r, 0.24],
    [r, 0.72],
    [r + 0.05, 0.76],
    [r + 0.05, 0.82],
    [r - 0.03, 0.86],
    [r - 0.03, 1.32],
    [r + 0.04, 1.36],
    [r + 0.04, 1.42],
    [r - 0.06, 1.46],
    [r - 0.06, COLUMN_TOP - 0.3],
    [r + 0.08, COLUMN_TOP - 0.18],
    [r + 0.08, COLUMN_TOP - 0.1],
    // El cuello se estrecha: con la bandeja más inclinada no asoma por ella.
    [0.3, COLUMN_TOP - 0.05],
    [0.3, COLUMN_TOP],
    [0, COLUMN_TOP],
  ];
  const lathe = new LatheGeometry(
    profile.map(([x, y]) => new Vector2(x, y)),
    12,
  );
  const buckets = [{ position: [], normal: [], pref: [] }] as Bucket[];
  collect(lathe, buckets, 0, false);
  return build(buckets, false);
}

/** La gota del pin, con la punta en el origen: el círculo de la cabeza y las dos tangentes. */
function pinGeometry(): { face: BufferGeometry; disc: BufferGeometry } {
  const { y, r } = PIN_HEAD;
  // Desde la punta, las tangentes tocan el círculo a ±(90° − asin(r / y)) de la vertical.
  const beta = Math.PI / 2 - Math.asin(r / y);
  const right = -Math.PI / 2 + beta;
  const left = -Math.PI / 2 - beta + Math.PI * 2;
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(Math.cos(right) * r, y + Math.sin(right) * r);
  shape.absarc(0, y, r, right, left, false);
  shape.lineTo(0, 0);

  const depth = 0.05;
  const bevel = 0.02;
  const extruded = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: 0.028,
    bevelSegments: 2,
    curveSegments: 24,
  });
  extruded.translate(0, 0, -depth / 2);
  const buckets = newBuckets();
  collect(extruded, buckets, 0, false);
  const face = build(buckets, false);

  const circle = new CircleGeometry(0.075, 24);
  circle.translate(0, y, depth / 2 + bevel + 0.003);
  const discBuckets = [{ position: [], normal: [], pref: [] }] as Bucket[];
  collect(circle, discBuckets, 0, false);
  return { face, disc: build(discBuckets, false) };
}

/** Lo alto del agua del lago: entre la bandeja (0) y la cara de la base. */
const LAKE_Y = 0.022;

function lakeGeometry(): BufferGeometry {
  const shape = new Shape(ringPoints(LAKE_BIWA));
  const geometry = new ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, LAKE_Y, 0);
  const buckets = [{ position: [], normal: [], pref: [] }] as Bucket[];
  collect(geometry, buckets, 0, false);
  return build(buckets, false);
}

/**
 * Cada pincelada, una cinta: dos vértices por punto, a cada lado de la curva,
 * separados por su ancho. `aBrush` lleva al shader dónde está cada fragmento
 * del trazo (a lo largo 0–1, a lo ancho −1…1) y la semilla del pincel; `aWave`,
 * el sitio del mapa que sigue (contenido) y su juego (0 Japón, 1 Kinki). La
 * posición es la del trazo respecto de ese sitio: el shader la suma a donde
 * caiga el sitio con el zoom.
 */
function wavesGeometry(): BufferGeometry {
  const position: number[] = [];
  const brush: number[] = [];
  const wave: number[] = [];
  for (const stroke of waveStrokes()) {
    const set = stroke.set === 'kinki' ? 1 : 0;
    const points = stroke.points;
    const side = points.map((p, i) => {
      const prev = points[Math.max(0, i - 1)]!;
      const next = points[Math.min(points.length - 1, i + 1)]!;
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const length = Math.hypot(dx, dz) || 1;
      // La normal en el plano, hacia la izquierda del avance.
      return { nx: -dz / length, nz: dx / length };
    });
    for (let i = 0; i + 1 < points.length; i += 1) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const sa = side[i]!;
      const sb = side[i + 1]!;
      const al = [a.x + (sa.nx * a.width) / 2, WAVE_LIFT, a.z + (sa.nz * a.width) / 2];
      const ar = [a.x - (sa.nx * a.width) / 2, WAVE_LIFT, a.z - (sa.nz * a.width) / 2];
      const bl = [b.x + (sb.nx * b.width) / 2, WAVE_LIFT, b.z + (sb.nz * b.width) / 2];
      const br = [b.x - (sb.nx * b.width) / 2, WAVE_LIFT, b.z - (sb.nz * b.width) / 2];
      // Dos triángulos con la cara hacia arriba.
      position.push(...al, ...bl, ...ar, ...ar, ...bl, ...br);
      brush.push(a.along, 1, stroke.seed, b.along, 1, stroke.seed, a.along, -1, stroke.seed);
      brush.push(a.along, -1, stroke.seed, b.along, 1, stroke.seed, b.along, -1, stroke.seed);
      for (let k = 0; k < 6; k += 1) wave.push(stroke.center.x, stroke.center.z, set);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(Array.from({ length: position.length / 3 }, () => [0, 1, 0]).flat(), 3));
  geometry.setAttribute('aBrush', new Float32BufferAttribute(brush, 3));
  geometry.setAttribute('aWave', new Float32BufferAttribute(wave, 3));
  // Las olas se mueven en el shader: la esfera tiene que cubrir la bandeja entera.
  geometry.boundingSphere = new Sphere(new Vector3(), MAQUETA_SIZE.tray);
  return geometry;
}

let cached: MaquetaParts | null = null;

export function maquetaGeometry(): MaquetaParts {
  if (cached) return cached;
  const { baseHeight, slabHeight } = MAQUETA_SIZE;
  const pin = pinGeometry();
  cached = {
    tray: trayGeometry(),
    base: layer('base', 0, baseHeight),
    slabs: layer('slab', baseHeight, slabHeight),
    column: columnGeometry(),
    pinFace: pin.face,
    pinDisc: pin.disc,
    lake: lakeGeometry(),
    waves: wavesGeometry(),
  };
  return cached;
}
