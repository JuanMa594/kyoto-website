/**
 * Los dos mapas antiguos del tramo de Ubicación (Fase 5B): `bun run maps`.
 *
 * Japón a la manera de Edo —con el mismo dato de Natural Earth que la maqueta
 * (`prefectures.generated.ts`) y los mismos tonos por región— y el plano de
 * Heian-kyō en 794 (`maps/heian.ts`). Cada uno es un kakejiku: un rollo alto y
 * estrecho (`MAP_SIZE`), con su cartucho de título arriba.
 *
 * Salen dos archivos por mapa en `public/maps/`:
 *   · el **SVG**, que es el `<img>` de la tarjeta de papel y de la lista de 静
 *     (lo leen también los buscadores);
 *   · el **WebP**, la textura del rollo en la escena.
 *
 * El SVG sólo lleva tinta y colores planos, con el fondo transparente: el papel
 * envejecido lo ponen el shader del rollo y el CSS de la tarjeta. Las etiquetas
 * son trazos de KanjiVG (`maps/kanji.ts`): un `<img>` no carga fuentes.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { MAP_SIZE } from '../src/scene/objects/kosatsu/kosatsu';
import {
  KYOTO_CITY,
  LAKE_BIWA,
  PREFECTURES,
  type FlatPolygon,
  type FlatRing,
} from '../src/scene/objects/maqueta/prefectures.generated';
import { REGION_TONE } from '../src/scene/objects/maqueta/regions';
import { waveStrokes } from '../src/scene/objects/maqueta/waves';
import { HEIAN, HEIAN_EXTENT, JO_NAMES } from './maps/heian';
import { horizontalLabel, verticalLabel, verticalLength, type KanjiStyle } from './maps/kanji';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'maps');

/* ── La paleta, de tokens.css (no se duplica) ──────────────────────────── */

const tokens = await readFile(join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8');
function token(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens);
  if (!match?.[1]) throw new Error(`tokens.css no tiene --color-${name}`);
  return match[1].toLowerCase();
}
/** De camelCase (`ScenePalette`) a kebab-case (`tokens.css`). */
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const SUMI = token('sumi');
const SUMI_FAINT = token('sumi-faint');
const SHU = token('shu');
const AI = token('ai');
const WASHI_DEEP = token('washi-deep');
const KOHAKU = token('kohaku');
const WHITE = '#ffffff';

/* ── Piezas comunes ────────────────────────────────────────────────────── */

function svgDocument(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>\n`;
}

/** El cartucho del título, en vertical, con doble filete: el daisen de un rollo. */
async function cartouche(title: string, x: number, y: number): Promise<string> {
  const style: KanjiStyle = { size: 62, color: SUMI, weight: 4.2, gap: 0.12 };
  const length = verticalLength(title, style);
  const w = 104;
  const h = length + 64;
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${WASHI_DEEP}" stroke="${SUMI}" stroke-width="3"/>`,
    `<rect x="${x + 7}" y="${y + 7}" width="${w - 14}" height="${h - 14}" fill="none" stroke="${SUMI}" stroke-width="1.2"/>`,
    await verticalLabel(title, x + w / 2, y + 32, style),
  ].join('');
}

/** Un sello shu cuadrado con un kanji en blanco: la firma del cartógrafo. */
async function seal(char: string, x: number, y: number, size: number): Promise<string> {
  return [
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.08}" fill="${SHU}"/>`,
    await horizontalLabel(char, x + size / 2, y + size * 0.14, { size: size * 0.72, color: WHITE, weight: size * 0.06 }),
  ].join('');
}

function ringPath(ring: FlatRing, at: (x: number, z: number) => [number, number]): string {
  let d = '';
  for (let i = 0; i < ring.length; i += 2) {
    const [px, py] = at(ring[i]!, ring[i + 1]!);
    d += `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`;
  }
  return `${d}Z`;
}

function polygonPath(polygons: readonly FlatPolygon[], at: (x: number, z: number) => [number, number]): string {
  return polygons.map((polygon) => polygon.map((ring) => ringPath(ring, at)).join('')).join('');
}

/** Un trazo de ancho variable (una pincelada), como contorno relleno. */
function ribbon(points: readonly { x: number; y: number; w: number }[]): string {
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(points.length - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    left.push(`${(p.x + nx * p.w).toFixed(1)} ${(p.y + ny * p.w).toFixed(1)}`);
    right.push(`${(p.x - nx * p.w).toFixed(1)} ${(p.y - ny * p.w).toFixed(1)}`);
  }
  return `M${left.join('L')}L${right.reverse().join('L')}Z`;
}

/** Una polilínea suave (Catmull-Rom → Bézier) por unos puntos. */
function smoothPath(points: readonly (readonly [number, number])[]): string {
  let d = `M${points[0]![0].toFixed(1)} ${points[0]![1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/* ── 1. Japón, a la manera de Edo ──────────────────────────────────────── */

async function japon(): Promise<string> {
  const { width, height } = MAP_SIZE.japon;
  const parts: string[] = [];

  parts.push(await cartouche('大日本國圖', width - 150, 46));

  // El mapa: el contorno de todas las losas, encajado en el ancho del rollo.
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let z0 = Number.POSITIVE_INFINITY;
  let z1 = Number.NEGATIVE_INFINITY;
  for (const prefecture of PREFECTURES) {
    for (const polygon of prefecture.base) {
      const ring = polygon[0]!;
      for (let i = 0; i < ring.length; i += 2) {
        x0 = Math.min(x0, ring[i]!);
        x1 = Math.max(x1, ring[i]!);
        z0 = Math.min(z0, ring[i + 1]!);
        z1 = Math.max(z1, ring[i + 1]!);
      }
    }
  }
  const margin = 50;
  const top = 560;
  const scale = Math.min((width - 2 * margin) / (x1 - x0), (height - top - 90) / (z1 - z0));
  const offsetX = (width - (x1 - x0) * scale) / 2;
  const offsetY = top + (height - top - 90 - (z1 - z0) * scale) / 2;
  const at = (x: number, z: number): [number, number] => [offsetX + (x - x0) * scale, offsetY + (z - z0) * scale];

  // Las olas, primero: van en el mar.
  for (const stroke of waveStrokes().filter((s) => s.set === 'japon')) {
    const points = stroke.points.map((p) => {
      const [px, py] = at(stroke.center.x + p.x, stroke.center.z + p.z);
      return { x: px, y: py, w: Math.max(0.6, p.width * scale * 0.55) };
    });
    parts.push(`<path d="${ribbon(points)}" fill="${AI}" fill-opacity="0.78"/>`);
  }

  // La costa: un trazo grueso de todas las prefecturas; los rellenos de encima
  // tapan la mitad de dentro, y en las fronteras, las dos mitades.
  const all = PREFECTURES.map((p) => polygonPath(p.base, at)).join('');
  parts.push(`<path d="${all}" fill="none" stroke="${SUMI}" stroke-width="5.5" stroke-linejoin="round"/>`);
  for (const prefecture of PREFECTURES) {
    const tone = REGION_TONE[prefecture.region];
    const color = tone.token === 'kami' ? WHITE : mix(token(kebab(tone.token)), WHITE, tone.white);
    parts.push(`<path d="${polygonPath(prefecture.base, at)}" fill="${color}" fill-rule="evenodd"/>`);
  }
  // Las fronteras, finas.
  parts.push(`<path d="${all}" fill="none" stroke="${SUMI}" stroke-width="1.1" stroke-opacity="0.85" stroke-linejoin="round"/>`);
  // El lago Biwa.
  parts.push(`<path d="${ringPath(LAKE_BIWA, at)}" fill="${mix(AI, WHITE, 0.55)}" stroke="${SUMI}" stroke-width="1"/>`);

  // Kyoto: el sello shu y 京.
  const [kx, ky] = at(KYOTO_CITY[0], KYOTO_CITY[1]);
  parts.push(`<circle cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" r="10" fill="${SHU}" stroke="${SUMI}" stroke-width="1.5"/>`);
  parts.push(`<path d="M${(kx - 12).toFixed(1)} ${(ky - 14).toFixed(1)}L${(kx - 52).toFixed(1)} ${(ky - 74).toFixed(1)}" stroke="${SUMI}" stroke-width="1.6"/>`);
  parts.push(
    `<rect x="${(kx - 90).toFixed(1)}" y="${(ky - 152).toFixed(1)}" width="76" height="80" fill="${WASHI_DEEP}" stroke="${SUMI}" stroke-width="2"/>`,
  );
  parts.push(await horizontalLabel('京', kx - 52, ky - 146, { size: 66, color: SHU, weight: 5.5 }));

  // El sello del cartógrafo, abajo a la izquierda.
  parts.push(await seal('京', 54, height - 150, 88));

  return svgDocument(width, height, parts.join(''));
}

/* ── 2. Heian-kyō, 794 ─────────────────────────────────────────────────── */

async function heian(): Promise<string> {
  const { width, height } = MAP_SIZE.heian;
  const parts: string[] = [];

  parts.push(await cartouche('平安京圖', width - 150, 46));

  const extentW = HEIAN_EXTENT.x1 - HEIAN_EXTENT.x0;
  const extentH = HEIAN_EXTENT.y1 - HEIAN_EXTENT.y0;
  const top = 470;
  const scale = Math.min((width - 60) / extentW, (height - top - 60) / extentH);
  const offsetX = (width - extentW * scale) / 2;
  const offsetY = top + (height - top - 60 - extentH * scale) / 2;
  const at = (x: number, y: number): [number, number] => [
    offsetX + (x - HEIAN_EXTENT.x0) * scale,
    offsetY + (y - HEIAN_EXTENT.y0) * scale,
  ];
  const [gx0, gy0] = at(0, 0);
  const [gx1, gy1] = at(HEIAN.width, HEIAN.height);

  // Los ríos.
  for (const river of [HEIAN.kamo, HEIAN.katsura]) {
    const points = river.map(([x, y]) => at(x, y));
    parts.push(`<path d="${smoothPath(points)}" fill="none" stroke="${mix(AI, WHITE, 0.35)}" stroke-width="15" stroke-linecap="round"/>`);
    parts.push(`<path d="${smoothPath(points)}" fill="none" stroke="${AI}" stroke-width="3" stroke-linecap="round"/>`);
  }

  // Las manzanas: la ciudad entera en un tono pálido.
  parts.push(`<rect x="${gx0.toFixed(1)}" y="${gy0.toFixed(1)}" width="${(gx1 - gx0).toFixed(1)}" height="${(gy1 - gy0).toFixed(1)}" fill="${mix(KOHAKU, WHITE, 0.62)}"/>`);

  // Las calles menores: cuatro por manzana grande, fuera del palacio.
  const minor: string[] = [];
  for (let j = 1; j < HEIAN.jo.length - 1; j += 1) {
    const a = HEIAN.jo[j]!;
    const b = HEIAN.jo[j + 1]!;
    for (let k = 1; k < 4; k += 1) {
      const y = a + ((b - a) * k) / 4;
      const [sx, sy] = at(0, y);
      const [ex] = at(HEIAN.width, y);
      minor.push(`M${sx.toFixed(1)} ${sy.toFixed(1)}H${ex.toFixed(1)}`);
    }
  }
  for (let i = 0; i < HEIAN.bo.length - 1; i += 1) {
    const a = HEIAN.bo[i]!;
    const b = HEIAN.bo[i + 1]!;
    for (let k = 1; k < 4; k += 1) {
      const x = a + ((b - a) * k) / 4;
      const inPalace = x > HEIAN.palace.x0 && x < HEIAN.palace.x1;
      const [sx, sy] = at(x, inPalace ? HEIAN.palace.y1 : 0);
      const [, ey] = at(x, HEIAN.height);
      minor.push(`M${sx.toFixed(1)} ${sy.toFixed(1)}V${ey.toFixed(1)}`);
    }
  }
  parts.push(`<path d="${minor.join('')}" stroke="${SUMI_FAINT}" stroke-width="0.9" stroke-opacity="0.75"/>`);

  // Las grandes avenidas.
  const major: string[] = [];
  for (const y of HEIAN.jo) {
    const [sx, sy] = at(0, y);
    const [ex] = at(HEIAN.width, y);
    major.push(`M${sx.toFixed(1)} ${sy.toFixed(1)}H${ex.toFixed(1)}`);
  }
  for (const x of HEIAN.bo) {
    if (x === HEIAN.suzaku.x) continue;
    const inPalace = x > HEIAN.palace.x0 && x < HEIAN.palace.x1;
    const [sx, sy] = at(x, inPalace ? HEIAN.palace.y1 : 0);
    const [, ey] = at(x, HEIAN.height);
    major.push(`M${sx.toFixed(1)} ${sy.toFixed(1)}V${ey.toFixed(1)}`);
  }
  parts.push(`<path d="${major.join('')}" stroke="${SUMI}" stroke-width="2.4"/>`);

  // Suzaku: la avenida ancha, del palacio a Rashōmon.
  const [sx0, sy0] = at(HEIAN.suzaku.x - HEIAN.suzaku.width / 2, HEIAN.palace.y1);
  const [sx1, sy1] = at(HEIAN.suzaku.x + HEIAN.suzaku.width / 2, HEIAN.height);
  parts.push(`<rect x="${sx0.toFixed(1)}" y="${sy0.toFixed(1)}" width="${(sx1 - sx0).toFixed(1)}" height="${(sy1 - sy0).toFixed(1)}" fill="${WASHI_DEEP}" stroke="${SUMI}" stroke-width="2"/>`);

  // El palacio.
  const [px0, py0] = at(HEIAN.palace.x0, HEIAN.palace.y0);
  const [px1, py1] = at(HEIAN.palace.x1, HEIAN.palace.y1);
  parts.push(`<rect x="${px0.toFixed(1)}" y="${py0.toFixed(1)}" width="${(px1 - px0).toFixed(1)}" height="${(py1 - py0).toFixed(1)}" fill="${mix(SHU, WHITE, 0.82)}" stroke="${SUMI}" stroke-width="3"/>`);
  const palaceStyle: KanjiStyle = { size: 44, color: SUMI, weight: 3.4 };
  parts.push(await verticalLabel('大内裏', (px0 + px1) / 2, (py0 + py1) / 2 - verticalLength('大内裏', palaceStyle) / 2, palaceStyle));

  // Rashōmon y los dos templos.
  const [rx, ry] = at(HEIAN.rashomon.x, HEIAN.rashomon.y);
  parts.push(`<rect x="${(rx - 22).toFixed(1)}" y="${(ry - 10).toFixed(1)}" width="44" height="20" fill="${SHU}" stroke="${SUMI}" stroke-width="2"/>`);
  parts.push(`<path d="M${(rx - 30).toFixed(1)} ${(ry - 10).toFixed(1)}L${rx.toFixed(1)} ${(ry - 24).toFixed(1)}L${(rx + 30).toFixed(1)} ${(ry - 10).toFixed(1)}Z" fill="${SUMI}"/>`);
  const small: KanjiStyle = { size: 26, color: SUMI, weight: 2.4 };
  parts.push(await horizontalLabel('羅城門', rx, ry + 16, small));
  for (const [temple, name] of [
    [HEIAN.toji, '東寺'],
    [HEIAN.saiji, '西寺'],
  ] as const) {
    const [tx0, ty0] = at(temple.x - temple.size / 2, temple.y - temple.size / 2);
    const [tx1, ty1] = at(temple.x + temple.size / 2, temple.y + temple.size / 2);
    parts.push(`<rect x="${tx0.toFixed(1)}" y="${ty0.toFixed(1)}" width="${(tx1 - tx0).toFixed(1)}" height="${(ty1 - ty0).toFixed(1)}" fill="${mix(SHU, WHITE, 0.55)}" stroke="${SUMI}" stroke-width="1.6"/>`);
    parts.push(await horizontalLabel(name, (tx0 + tx1) / 2, ty0 - 30, small));
  }

  // Las dos mitades: 左京 al este (a la izquierda del emperador, que mira al sur).
  const half: KanjiStyle = { size: 50, color: SUMI_FAINT, weight: 3.6 };
  const [lx] = at(HEIAN.width * 0.78, 0);
  const [wx] = at(HEIAN.width * 0.22, 0);
  const midY = at(0, 2900)[1];
  parts.push(await verticalLabel('左京', lx, midY, half));
  parts.push(await verticalLabel('右京', wx, midY, half));

  // Los nombres de las avenidas grandes, en el margen oeste.
  const jo: KanjiStyle = { size: 20, color: SUMI, weight: 1.9, gap: 0.02 };
  for (const [k, y] of HEIAN.jo.entries()) {
    const [, ly] = at(0, y);
    parts.push(await verticalLabel(JO_NAMES[k]!, gx0 - 16, ly - 20, jo));
  }

  // Los ríos, con su nombre en la franja entre el río y la ciudad: en el
  // borde del papel lo comería el envejecido.
  const river: KanjiStyle = { size: 26, color: AI, weight: 2.4 };
  const [kmx, kmy] = at(HEIAN.kamo[3]![0], HEIAN.kamo[3]![1]);
  parts.push(await verticalLabel('鴨川', (gx1 + kmx) / 2, kmy - 40, river));
  const [ktx, kty] = at(HEIAN.katsura[3]![0], HEIAN.katsura[3]![1]);
  parts.push(await verticalLabel('桂川', (ktx + gx0 - 26) / 2, kty - 40, river));

  parts.push(await seal('京', 54, height - 150, 88));

  return svgDocument(width, height, parts.join(''));
}

/* ── Salida ────────────────────────────────────────────────────────────── */

await mkdir(OUT, { recursive: true });
for (const [name, build] of [
  ['japon', japon],
  ['heian', heian],
] as const) {
  const svg = await build();
  await writeFile(join(OUT, `${name}.svg`), svg);
  await sharp(Buffer.from(svg)).resize({ width: MAP_SIZE[name].width }).webp({ quality: 88 }).toFile(join(OUT, `${name}.webp`));
  console.log(`✓ ${name}: ${Math.round(svg.length / 1024)} KB de SVG → public/maps/${name}.{svg,webp}`);
}
