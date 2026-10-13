/**
 * Japón para el ícono de Ubicación (Fase 3C), desde Natural Earth.
 *
 *   1. Descarga una vez los países a 1:50 m de Natural Earth —dominio
 *      público— en `assets/geo/source/`, que no se versiona.
 *   2. Se queda con Japón y lo recorta de Kyushu a Hokkaido: sin Ryukyu ni
 *      Ogasawara, que alejarían el resto hasta hacerlo diminuto (`13.png`
 *      tampoco los dibuja).
 *   3. Lo proyecta —equirrectangular con la longitud corregida a 37°N, que a
 *      esta escala no se distingue de una cónica— y descarta los islotes.
 *   4. Simplifica cada isla con Visvalingam hasta unos 300 vértices en total.
 *   5. Lo encaja en el viewBox −1…1 de los íconos y escribe
 *      `src/components/nav/icons/japan.generated.ts`, que sí se versiona.
 *
 * Guarda polígonos y no un path ya hecho: el mapa extruido de la Fase 5 puede
 * partir del mismo dato.
 *
 * Y un segundo producto, la **maqueta de Ubicación** (Fase 5A): las
 * prefecturas de Natural Earth (*admin-1*, 1:10 m) y el lago Biwa (*lakes*),
 * con la misma proyección y los mismos límites (sin Okinawa), simplificadas
 * con **topología compartida** —la frontera entre dos vecinas es la misma
 * línea para las dos— y, para las losas, **encogidas** un pelo: el hueco es la
 * junta de tinta. Escribe `src/scene/objects/maqueta/prefectures.generated.ts`.
 *
 * Uso: bun run geo
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ClipperLib from 'clipper-lib';
import type { Feature as GeoFeature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';
import type { Objects, Topology } from 'topojson-specification';
import { presimplify, quantile, simplify as simplifyTopology } from 'topojson-simplify';

const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
// Como los demás scripts: `tsc` también revisa `scripts/` y no hay tipos de Bun.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'assets/geo/source/ne_50m_admin_0_countries.geojson');
const OUTPUT = join(ROOT, 'src/components/nav/icons/japan.generated.ts');

/** De Kyushu a Hokkaido, en grados. */
const BOUNDS = { lonMin: 128.5, lonMax: 146.5, latMin: 30.8, latMax: 46 };
/** Latitud de referencia de la proyección. */
const LAT_REF = 37;
const KYOTO = { lon: 135.768, lat: 35.012 };
/** Islotes por debajo de esta fracción del área de la isla mayor: fuera. */
const MIN_AREA = 0.0025;
const TARGET_VERTICES = 300;
const MIN_VERTICES = 6;
/** Hasta dónde llega el mapa dentro del viewBox −1…1. */
const EXTENT = 0.82;

type Point = [number, number];

interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

async function loadSource(): Promise<{ features: Feature[] }> {
  if (!existsSync(SOURCE)) {
    console.log(`Descargando ${SOURCE_URL}…`);
    const response = await fetch(SOURCE_URL);
    if (!response.ok) throw new Error(`Natural Earth respondió ${response.status}`);
    mkdirSync(dirname(SOURCE), { recursive: true });
    writeFileSync(SOURCE, await response.text());
  }
  return JSON.parse(readFileSync(SOURCE, 'utf8')) as { features: Feature[] };
}

/** Los anillos exteriores de un Polygon o un MultiPolygon, en [lon, lat]. */
function outerRings(geometry: Feature['geometry']): Point[][] {
  if (geometry.type === 'Polygon') return [(geometry.coordinates as Point[][])[0]!];
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as Point[][][]).map((polygon) => polygon[0]!);
  }
  throw new Error(`Geometría inesperada: ${geometry.type}`);
}

/** Equirrectangular con la longitud corregida a `LAT_REF`; la y hacia abajo, como en SVG. */
function project([lon, lat]: Point): Point {
  return [lon * Math.cos((LAT_REF * Math.PI) / 180), -lat];
}

function area(ring: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function perimeter(ring: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += Math.hypot(x2 - x1, y2 - y1);
  }
  return sum;
}

function centroid(ring: readonly Point[]): Point {
  const n = ring.length;
  return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
}

/**
 * Visvalingam–Whyatt: quita una y otra vez el vértice que forma el triángulo
 * más pequeño con sus vecinos, hasta quedarse con `keep`. A tan pocos vértices
 * conserva la silueta mucho mejor que Douglas-Peucker.
 */
function simplify(ring: readonly Point[], keep: number): Point[] {
  const points = [...ring];
  // GeoJSON cierra el anillo repitiendo el primer punto.
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (points.length > 1 && first[0] === last[0] && first[1] === last[1]) points.pop();

  const triangle = (i: number) => {
    const a = points[(i - 1 + points.length) % points.length]!;
    const b = points[i]!;
    const c = points[(i + 1) % points.length]!;
    return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  };

  while (points.length > keep) {
    let smallest = 0;
    let best = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      const size = triangle(i);
      if (size < best) {
        best = size;
        smallest = i;
      }
    }
    points.splice(smallest, 1);
  }
  return points;
}

const round = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded === 0 ? 0 : rounded;
};

const source = await loadSource();
const japan = source.features.find((feature) => feature.properties.ADM0_A3 === 'JPN');
if (!japan) throw new Error('Japón no aparece en el archivo de Natural Earth');

const rings = outerRings(japan.geometry)
  .filter((ring) => {
    const [lon, lat] = centroid(ring);
    return lon >= BOUNDS.lonMin && lon <= BOUNDS.lonMax && lat >= BOUNDS.latMin && lat <= BOUNDS.latMax;
  })
  .map((ring) => ring.map(project));

const largest = Math.max(...rings.map(area));
const islands = rings.filter((ring) => area(ring) >= largest * MIN_AREA);
const totalPerimeter = islands.reduce((sum, ring) => sum + perimeter(ring), 0);
const simplified = islands.map((ring) =>
  simplify(ring, Math.max(MIN_VERTICES, Math.round((TARGET_VERTICES * perimeter(ring)) / totalPerimeter))),
);

const xs = simplified.flat().map((p) => p[0]);
const ys = simplified.flat().map((p) => p[1]);
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);
const scale = (2 * EXTENT) / Math.max(maxX - minX, maxY - minY);
const fit = ([x, y]: Point): Point => [round((x - (minX + maxX) / 2) * scale), round((y - (minY + maxY) / 2) * scale)];

const islandsOut = simplified.map((ring) => ring.map(fit));
const kyoto = fit(project([KYOTO.lon, KYOTO.lat]));
const vertexCount = islandsOut.reduce((sum, ring) => sum + ring.length, 0);

const body = islandsOut.map((ring) => `  ${JSON.stringify(ring)},`).join('\n');
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(
  OUTPUT,
  `// Generado por scripts/build-geo.ts (\`bun run geo\`) desde Natural Earth,
// dominio público. No editar a mano.

/** Las islas de Japón, de Kyushu a Hokkaido, en el viewBox −1…1 (y hacia abajo). */
export const JAPAN_ISLANDS: readonly (readonly (readonly [number, number])[])[] = [
${body}
];

/** Kyoto, en las mismas coordenadas. */
export const KYOTO_POINT: readonly [number, number] = ${JSON.stringify(kyoto)};
`,
);

console.log(`✓ ${islandsOut.length} islas, ${vertexCount} vértices → ${OUTPUT}`);

/* ── La maqueta de Ubicación (Fase 5A) ─────────────────────────────────── */

const NE_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const MAP_OUTPUT = join(ROOT, 'src/scene/objects/maqueta/prefectures.generated.ts');
/** Lado mayor del mapa en la maqueta, en unidades del mundo. */
const MAP_SPAN = 4.5;
/** Vértices que conserva la simplificación (cada frontera, una vez: en la salida cuenta doble). */
const TARGET_POINTS = 1800;
/** Islotes por debajo de esta área (u²) se descartan, salvo el mayor de cada prefectura. */
const MIN_PART = 0.0015;
/** Cuánto se encoge cada losa: el doble es el ancho de la junta de tinta. */
const JOINT = 0.01;
/** Si al encogerla una parte pierde más de esto, se queda sin encoger. */
const MAX_INSET_LOSS = 0.6;
/** Enteros de Clipper por unidad. */
const CLIP_SCALE = 1e5;

type Ring = Point[];
type Poly = Ring[];

async function loadNaturalEarth(name: string): Promise<{ features: Feature[] }> {
  const path = join(ROOT, `assets/geo/source/${name}.geojson`);
  if (!existsSync(path)) {
    console.log(`Descargando ${name}…`);
    const response = await fetch(`${NE_BASE}${name}.geojson`);
    if (!response.ok) throw new Error(`Natural Earth respondió ${response.status}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, await response.text());
  }
  return JSON.parse(readFileSync(path, 'utf8')) as { features: Feature[] };
}

/** Los polígonos (con agujeros) de un Polygon o MultiPolygon. */
function polygonsOf(geometry: Feature['geometry']): Poly[] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as Poly];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as Poly[];
  throw new Error(`Geometría inesperada: ${geometry.type}`);
}

/** Sin el punto repetido con que GeoJSON cierra cada anillo. */
function open(ring: readonly Point[]): Ring {
  const points = ring.map((p) => [p[0], p[1]] as Point);
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) points.pop();
  return points;
}

const toClip = (ring: Ring): ClipperLib.Path =>
  ring.map(([x, y]) => ({ X: Math.round(x * CLIP_SCALE), Y: Math.round(y * CLIP_SCALE) }));
const fromClip = (path: ClipperLib.Path): Ring => path.map((p) => [p.X / CLIP_SCALE, p.Y / CLIP_SCALE]);

function exPolygons(tree: ClipperLib.PolyTree): Poly[] {
  return ClipperLib.JS.PolyTreeToExPolygons(tree).map((ex) => [fromClip(ex.outer), ...ex.holes.map(fromClip)]);
}

function difference(subject: Poly, clip: Poly): Poly[] {
  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(subject.map(toClip), ClipperLib.PolyType.ptSubject, true);
  clipper.AddPaths(clip.map(toClip), ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  clipper.Execute(
    ClipperLib.ClipType.ctDifference,
    tree,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  return exPolygons(tree);
}

function inset(poly: Poly, amount: number): Poly[] {
  const offset = new ClipperLib.ClipperOffset(2, 0.25);
  offset.AddPaths(poly.map(toClip), ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const tree = new ClipperLib.PolyTree();
  offset.Execute(tree, -amount * CLIP_SCALE);
  return exPolygons(tree);
}

const polyArea = (poly: Poly) => poly.reduce((sum, ring, i) => sum + (i === 0 ? area(ring) : -area(ring)), 0);
const round4 = (value: number) => {
  const rounded = Math.round(value * 10000) / 10000;
  return rounded === 0 ? 0 : rounded;
};
const flatRing = (ring: Ring) => ring.flatMap(([x, y]) => [round4(x), round4(y)]);

const admin = await loadNaturalEarth('ne_10m_admin_1_states_provinces');
const lakes = await loadNaturalEarth('ne_10m_lakes');

const inBounds = (poly: Poly) => {
  const [lon, lat] = centroid(open(poly[0]!));
  return lon >= BOUNDS.lonMin && lon <= BOUNDS.lonMax && lat >= BOUNDS.latMin && lat <= BOUNDS.latMax;
};

interface RawPrefecture {
  code: number;
  name: string;
  nameJa: string;
  kinki: boolean;
  region: string;
  polys: Poly[];
}

const raw: RawPrefecture[] = admin.features
  .filter((f) => f.properties.adm0_a3 === 'JPN' && f.properties.iso_3166_2 !== 'JP-47')
  .map((f) => ({
    code: Number(String(f.properties.iso_3166_2).replace('JP-', '')),
    name: String(f.properties.name),
    nameJa: String(f.properties.name_ja),
    kinki: f.properties.region === 'Kinki',
    // Natural Earth deja sin región a Saga y Nagasaki: son de Kyushu.
    region: String(f.properties.region ?? 'Kyushu'),
    polys: polygonsOf(f.geometry)
      .filter(inBounds)
      .map((poly) => poly.map((ring) => open(ring).map(project))),
  }))
  .sort((a, b) => a.code - b.code);

// Encaje: la caja de todo Japón, centrada en 0 y con su lado mayor en MAP_SPAN.
const allPoints = raw.flatMap((p) => p.polys.flatMap((poly) => poly[0]!));
const boxMinX = Math.min(...allPoints.map((p) => p[0]));
const boxMaxX = Math.max(...allPoints.map((p) => p[0]));
const boxMinY = Math.min(...allPoints.map((p) => p[1]));
const boxMaxY = Math.max(...allPoints.map((p) => p[1]));
const mapScale = MAP_SPAN / Math.max(boxMaxX - boxMinX, boxMaxY - boxMinY);
const mapFit = ([x, y]: Point): Point => [
  (x - (boxMinX + boxMaxX) / 2) * mapScale,
  (y - (boxMinY + boxMaxY) / 2) * mapScale,
];

for (const prefecture of raw) {
  prefecture.polys = prefecture.polys.map((poly) => poly.map((ring) => ring.map(mapFit)));
  const largest = Math.max(...prefecture.polys.map((poly) => area(poly[0]!)));
  prefecture.polys = prefecture.polys.filter((poly) => area(poly[0]!) >= MIN_PART || area(poly[0]!) === largest);
}

// Topología compartida: cada frontera es un solo arco para las dos vecinas.
const collection: FeatureCollection<MultiPolygon> = {
  type: 'FeatureCollection',
  features: raw.map(
    (p): GeoFeature<MultiPolygon> => ({
      type: 'Feature',
      properties: { code: p.code },
      geometry: { type: 'MultiPolygon', coordinates: p.polys.map((poly) => poly.map((ring) => [...ring, ring[0]!])) },
    }),
  ),
};
const topo = presimplify(topology({ prefs: collection }, 1e5) as Topology<Objects<{ code: number }>>);
const totalPoints = topo.arcs.reduce((sum, arc) => sum + arc.length, 0);
const simplifiedPrefs = feature(
  simplifyTopology(topo, quantile(topo, TARGET_POINTS / totalPoints)),
  topo.objects.prefs!,
) as unknown as FeatureCollection<MultiPolygon | Polygon>;

// El lago Biwa: un agujero en Shiga.
const biwa = lakes.features.find((f) => f.properties.name === 'Biwa Ko');
if (!biwa) throw new Error('El lago Biwa no aparece en el archivo de lagos');
const lake: Poly = [simplify(open(polygonsOf(biwa.geometry)[0]![0]!).map(project).map(mapFit), 40)];

let baseVertices = 0;
let slabVertices = 0;
const prefectures = raw.map((prefecture, index) => {
  const geometry = simplifiedPrefs.features[index]!.geometry;
  let polys = polygonsOf(geometry as Feature['geometry'])
    .map((poly) => poly.map(open).filter((ring) => ring.length >= 3))
    .filter((poly) => poly.length > 0 && poly[0]!.length >= 3);
  if (prefecture.code === 25) polys = polys.flatMap((poly) => difference(poly, lake));

  const slab = polys.flatMap((poly) => {
    const shrunk = inset(poly, JOINT);
    const kept = shrunk.reduce((sum, p) => sum + polyArea(p), 0);
    return shrunk.length > 0 && kept >= polyArea(poly) * (1 - MAX_INSET_LOSS) ? shrunk : [poly];
  });

  const largest = slab.reduce((best, poly) => (area(poly[0]!) > area(best[0]!) ? poly : best), slab[0]!);
  baseVertices += polys.reduce((sum, poly) => sum + poly.reduce((s, r) => s + r.length, 0), 0);
  slabVertices += slab.reduce((sum, poly) => sum + poly.reduce((s, r) => s + r.length, 0), 0);
  const [cx, cz] = centroid(largest[0]!);
  return {
    code: prefecture.code,
    name: prefecture.name,
    nameJa: prefecture.nameJa,
    kinki: prefecture.kinki,
    region: prefecture.region,
    base: polys.map((poly) => poly.map(flatRing)),
    slab: slab.map((poly) => poly.map(flatRing)),
    center: [round4(cx), round4(cz)],
  };
});

const kyotoCity = mapFit(project([KYOTO.lon, KYOTO.lat]));
mkdirSync(dirname(MAP_OUTPUT), { recursive: true });
writeFileSync(
  MAP_OUTPUT,
  `// Generado por scripts/build-geo.ts (\`bun run geo\`) desde Natural Earth
// (admin-1 y lakes, 1:10 m), dominio público. No editar a mano.

export type Region = 'Hokkaido' | 'Tohoku' | 'Kanto' | 'Chubu' | 'Kinki' | 'Chugoku' | 'Shikoku' | 'Kyushu';

/** Un anillo plano: x0, z0, x1, z1… en u de la maqueta (x al este, z al sur). */
export type FlatRing = readonly number[];
/** [exterior, ...agujeros]. */
export type FlatPolygon = readonly FlatRing[];

export interface PrefectureData {
  /** Código JIS de la prefectura: 26 es Kyoto. */
  readonly code: number;
  readonly name: string;
  readonly nameJa: string;
  readonly kinki: boolean;
  /** La región: las prefecturas se pintan por región, como los mapas de Edo. */
  readonly region: Region;
  /** Los polígonos completos: la base de costa. */
  readonly base: readonly FlatPolygon[];
  /** Los mismos, encogidos: la losa. Entre losas asoma la base. */
  readonly slab: readonly FlatPolygon[];
  /** Centro del mayor trozo de la losa: ahí va su nombre. */
  readonly center: readonly [number, number];
}

/** Lado mayor del mapa, en unidades. */
export const MAP_SPAN = ${MAP_SPAN};

/** La ciudad de Kyoto: ahí va el pin. */
export const KYOTO_CITY: readonly [number, number] = [${round4(kyotoCity[0])}, ${round4(kyotoCity[1])}];

/** Las 46 prefecturas de Kyushu a Hokkaido (sin Okinawa), por código. */
export const PREFECTURES: readonly PrefectureData[] = ${JSON.stringify(prefectures)};
`,
);

// Los nombres, aparte: el DOM (las etiquetas) los necesita sin cargar los polígonos.
const NAMES_OUTPUT = join(ROOT, 'src/scene/objects/maqueta/names.generated.ts');
writeFileSync(
  NAMES_OUTPUT,
  `// Generado por scripts/build-geo.ts (\`bun run geo\`) desde Natural Earth,
// dominio público. No editar a mano.

/**
 * Los nombres de las prefecturas de la maqueta, en el mismo orden que
 * \`PREFECTURES\`. Van aparte para que el DOM no cargue los polígonos.
 */
export const PREFECTURE_NAMES: readonly { readonly name: string; readonly nameJa: string }[] = ${JSON.stringify(
    prefectures.map((p) => ({ name: p.name, nameJa: p.nameJa })),
  )};
`,
);

console.log(`✓ ${prefectures.length} prefecturas, ${baseVertices} vértices de base, ${slabVertices} de losa → ${MAP_OUTPUT}`);
