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
 * Uso: bun run geo
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
