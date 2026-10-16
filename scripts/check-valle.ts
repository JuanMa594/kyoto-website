/**
 * Comprobaciones puras del tramo de Ubicación (Fase 5B): los kōsatsu y el
 * texto sobre su tabla, la roca pintada, la susuki, los cerezos y el reparto
 * del valle. Las de la decoración en general (piedras, cámara, fauna) siguen en
 * check-decor.ts y cubren también lo de aquí.
 *
 * Uso: bun run check:path (corre después de check-decor.ts)
 */

import { existsSync, readFileSync } from 'node:fs';

import sharp from 'sharp';
import { PerspectiveCamera, Vector3, type BufferGeometry } from 'three';

import { cardStopD } from '../src/animation/journeyScroll';
import { getStation } from '../src/config/journey';
import { createRig, snapRig } from '../src/scene/camera/pathRig';
import { decorFootprints, insideFootprint, objectBases } from '../src/scene/decor/footprints';
import { objectToWorld, stationDecorLayout, type PlacedObject } from '../src/scene/decor/placement';
import { BLOCK_PX, BODY_PX, boardFit } from '../src/components/sections/kosatsuFit';
import { boardWidth, KOSATSU, KOSATSU_BOARD_TOP, KOSATSU_HEIGHT, KOSATSU_SIZE, kosatsuWriting, MAP_SIZE, unrollOf } from '../src/scene/objects/kosatsu/kosatsu';
import { kosatsuGeometry } from '../src/scene/objects/kosatsu/kosatsuGeometry';
import { blossomCount, CEREZO_SIZE, growCerezo } from '../src/scene/objects/cerezo/cerezo';
import { cerezoTrunkGeometry } from '../src/scene/objects/cerezo/cerezoGeometry';
import { ROCA_SIZE } from '../src/scene/objects/roca/roca';
import { SUSUKI_TUFT_RADIUS, susukiTufts } from '../src/scene/decor/susuki';
import { stoneLayout } from '../src/scene/path/stones';
import { rocaGeometry } from '../src/scene/objects/roca/rocaGeometry';
import { pathX, STATION_DEPTHS, stationIndex } from '../src/scene/path/journeyPath';
import { mulberry32 } from '../src/lib/procedural';
import { speciesSpec } from '../src/scene/systems/fauna/bestiary';
import { clearOfDecor, createAct, DECOR_RETRIES, type CameraState } from '../src/scene/systems/fauna/casting';
import { check, finish, section } from './check-kit';

const UBI_SLUG = 'ubicacion' as const;
const UBI = stationIndex(UBI_SLUG);
const DEG = Math.PI / 180;

/** La cámara del sitio con el punto de interés en `d`, con el aspecto pedido. */
function cameraAt(d: number, aspect: number): PerspectiveCamera {
  const rig = createRig();
  snapRig(rig, d);
  const camera = new PerspectiveCamera(34, aspect, 0.1, 1000);
  camera.position.set(rig.camera.x, rig.camera.y, rig.camera.z);
  camera.lookAt(rig.focus.x, rig.focus.y, rig.focus.z);
  camera.updateMatrixWorld();
  return camera;
}

/** Fracción de pantalla (desde la izquierda, desde arriba) de un punto. */
function onScreen(camera: PerspectiveCamera, x: number, y: number, z: number): { x: number; y: number } {
  const p = new Vector3(x, y, z).project(camera);
  return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
}

/* ── 1. Los kōsatsu ────────────────────────────────────────────────────── */

section('Los kōsatsu');

const kosatsuOf = (portrait: boolean) =>
  stationDecorLayout(UBI, portrait).objects.filter((o) => o.item.kind === 'kosatsu');
const cards = getStation(UBI_SLUG).tramo.cards;
const signed = cards.filter((card) => card.sign).length;
check(
  'un kōsatsu por tarjeta con cartel, en horizontal y en vertical',
  signed === 3 && kosatsuOf(false).length === signed && kosatsuOf(true).length === signed,
);
check('cabe en el presupuesto de alto del cuadro (≤ 8,5 u)', KOSATSU_HEIGHT <= 8.5, KOSATSU_HEIGHT.toFixed(2));

const signs = kosatsuOf(false);
signs.forEach((o) => {
  if (o.item.kind !== 'kosatsu') return;
  const card = cards[o.item.card]!;
  const rig = createRig();
  snapRig(rig, cardStopD(UBI_SLUG, o.item.card));
  const label = `kōsatsu «${card.id}»`;

  const depth = -o.z - -rig.camera.z;
  check(
    `${label}: a ${KOSATSU_SIZE.depthFromCamera} u de la cámara de su parada`,
    Math.abs(depth - KOSATSU_SIZE.depthFromCamera) < 0.5,
    `${depth.toFixed(2)} u`,
  );

  const u = o.x - pathX(-o.z);
  check(`${label}: en su lado del camino`, card.side === 'izquierda' ? u < 0 : u > 0, `u ${u.toFixed(2)}`);
  const inner = Math.abs(u) - boardWidth(o.item.map) / 2;
  check(`${label}: su canto interior, a ≥ 1,9 u del eje`, inner >= 1.9, `${inner.toFixed(2)} u`);

  // La tabla mira a +z local: con el rumbo de la cámara, paralela a su imagen.
  const off = Math.abs(Math.atan2(Math.sin(rig.yaw - o.yaw), Math.cos(rig.yaw - o.yaw)));
  check(`${label}: paralela a la imagen de la cámara de su parada`, off < 1 * DEG, `${(off / DEG).toFixed(1)}°`);

  // La zona de escritura queda del lado del camino y el mapa, del de fuera.
  const writing = kosatsuWriting(o);
  const writingU = writing.center[0] - pathX(-writing.center[2]);
  check(
    `${label}: la zona de escritura, del lado del camino`,
    !card.sign?.map || Math.abs(writingU) < Math.abs(u),
    `u ${writingU.toFixed(2)}`,
  );

  const post = objectBases(o)[0]!;
  check(
    `${label}: sus postes cierran el paso a la fauna`,
    decorFootprints(false).some((f) => f.faunaMargin > 0 && insideFootprint(f, post.x, o.y + 0.5, post.z, 0)),
  );
});

/** Lo alto, lo bajo, lo que se aleja del origen en planta, triángulos y normales malas de unas geometrías. */
function measure(parts: readonly BufferGeometry[]) {
  let top = Number.NEGATIVE_INFINITY;
  let bottom = Number.POSITIVE_INFINITY;
  let reachX = 0;
  let reachZ = 0;
  let triangles = 0;
  let bad = 0;
  for (const part of parts) {
    const position = part.getAttribute('position');
    const normal = part.getAttribute('normal');
    triangles += (part.index ? part.index.count : position.count) / 3;
    for (let i = 0; i < position.count; i += 1) {
      top = Math.max(top, position.getY(i));
      bottom = Math.min(bottom, position.getY(i));
      reachX = Math.max(reachX, Math.abs(position.getX(i)));
      reachZ = Math.max(reachZ, Math.abs(position.getZ(i)));
      const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
      if (!Number.isFinite(length) || length < 0.5) bad += 1;
    }
  }
  return { top, bottom, reachX, reachZ, triangles, bad };
}

{
  const parts = kosatsuGeometry();
  const m = measure([parts.wood, parts.board, parts.roof]);
  check('kōsatsu: mide lo que dice KOSATSU_HEIGHT', m.top <= KOSATSU_HEIGHT && m.top >= KOSATSU_HEIGHT - 0.25, m.top.toFixed(2));
  check(
    'kōsatsu: cabe en la planta de su huella',
    m.reachX <= KOSATSU_SIZE.boardWidth / 2 + KOSATSU_SIZE.roofOverhang + 1e-6 && m.reachZ <= KOSATSU_SIZE.roofDepth / 2 + 1e-6,
    `x ${m.reachX.toFixed(2)}, z ${m.reachZ.toFixed(2)}`,
  );
  check('kōsatsu: ninguna normal nula ni NaN', m.bad === 0, `${m.bad}`);
  check('kōsatsu: menos de 4 000 triángulos', m.triangles < 4000, `${m.triangles}`);
}

/* ── 2. El texto sobre la tabla ────────────────────────────────────────── */

section('El texto sobre la tabla');

/** La caja proyectada (fracciones de pantalla) de unos puntos del mundo. */
function screenBox(camera: PerspectiveCamera, points: readonly [number, number, number][]) {
  const box = { x0: 1, x1: 0, y0: 1, y1: 0 };
  for (const [x, y, z] of points) {
    const p = onScreen(camera, x, y, z);
    box.x0 = Math.min(box.x0, p.x);
    box.x1 = Math.max(box.x1, p.x);
    box.y0 = Math.min(box.y0, p.y);
    box.y1 = Math.max(box.y1, p.y);
  }
  return box;
}

/** Las cuatro esquinas de la tabla entera (con el marco), en el mundo. */
function boardCorners(o: PlacedObject): [number, number, number][] {
  const half = boardWidth(o.item.kind === 'kosatsu' ? o.item.map : undefined) / 2 + KOSATSU_SIZE.frame;
  const out: [number, number, number][] = [];
  const point = { x: 0, z: 0 };
  for (const lx of [-half, half]) {
    objectToWorld(o, lx, KOSATSU_SIZE.boardDepth / 2, point);
    for (const ly of [KOSATSU_SIZE.boardBottom - KOSATSU_SIZE.frame, KOSATSU_BOARD_TOP + KOSATSU_SIZE.frame]) {
      out.push([point.x, o.y + ly * o.scale, point.z]);
    }
  }
  return out;
}

/** Las cuatro esquinas de la zona de escritura, en el mundo. */
function writingCorners(o: PlacedObject): [number, number, number][] {
  const w = kosatsuWriting(o);
  const out: [number, number, number][] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      out.push([w.center[0] + (w.right[0] * sx * w.w) / 2, w.center[1] + (sy * w.h) / 2, w.center[2] + (w.right[2] * sx * w.w) / 2]);
    }
  }
  return out;
}

for (const [width, height, strict] of [
  [1600, 900, true],
  [1440, 900, false],
  [1366, 657, false],
] as const) {
  const tag = `${width}×${height}`;
  for (const o of signs) {
    if (o.item.kind !== 'kosatsu') continue;
    const card = cards[o.item.card]!;
    const camera = cameraAt(cardStopD(UBI_SLUG, o.item.card), width / height);
    const board = screenBox(camera, boardCorners(o));
    const writing = screenBox(camera, writingCorners(o));
    const body = ((writing.x1 - writing.x0) * width / BLOCK_PX) * BODY_PX;
    const left = card.side === 'izquierda';
    // El riel de la navegación ocupa ~4,5 rem a la derecha.
    const inHalf = left ? board.x0 >= 0.01 && board.x1 <= 0.48 : board.x0 >= 0.52 && board.x1 <= 1 - 76 / width;
    const label = `${tag} · «${card.id}»`;
    if (strict) {
      check(`${label}: el cuerpo del texto, a ≥ 16 px`, body >= 16, `${body.toFixed(1)} px`);
      check(`${label}: la tabla cabe en su mitad`, inHalf, `x ${(board.x0 * 100).toFixed(0)}–${(board.x1 * 100).toFixed(0)} %`);
      check(`${label}: lo escrito, en el tercio medio`, writing.y0 >= 0.25 && writing.y1 <= 0.72, `y ${(writing.y0 * 100).toFixed(0)}–${(writing.y1 * 100).toFixed(0)} %`);
    } else {
      // Aquí puede no caber: entonces el texto va en la tarjeta de papel. Se
      // informa, con la misma regla que aplica la página (`boardFit`).
      const rect = {
        x: writing.x0 * width,
        y: writing.y0 * height,
        w: (writing.x1 - writing.x0) * width,
        h: (writing.y1 - writing.y0) * height,
        boardX: board.x0 * width,
        boardW: (board.x1 - board.x0) * width,
        on: true,
      };
      const onBoard = boardFit({ rect, viewportWidth: width, blockHeight: 0, live: true, compact: false }) !== null;
      check(`${label}: ${onBoard ? 'sobre la tabla' : 'en la tarjeta de papel'}`, true, `cuerpo ${body.toFixed(1)} px, x ${(board.x0 * 100).toFixed(0)}–${(board.x1 * 100).toFixed(0)} %`);
    }
  }
}

/* ── 3. Los mapas antiguos ─────────────────────────────────────────────── */

section('Los mapas antiguos');

for (const map of ['japon', 'heian'] as const) {
  const svgPath = `public/maps/${map}.svg`;
  const webpPath = `public/maps/${map}.webp`;
  const present = existsSync(svgPath) && existsSync(webpPath);
  check(`${map}: existen el SVG y el WebP (bun run maps)`, present);
  if (!present) continue;
  const svg = readFileSync(svgPath, 'utf8');
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const width = Number(/\bwidth="(\d+)"/.exec(root)?.[1]);
  const height = Number(/\bheight="(\d+)"/.exec(root)?.[1]);
  const size = MAP_SIZE[map];
  check(`${map}: el SVG mide lo que dice MAP_SIZE`, width === size.width && height === size.height, `${width}×${height}`);
  check(`${map}: sin <text> (un <img> no carga fuentes): las etiquetas son trazos`, !/<text\b/.test(svg));
  check(`${map}: sin referencias externas`, !/(href|src)="https?:/.test(svg));
  const meta = await sharp(webpPath).metadata();
  const ratio = (meta.height ?? 0) / (meta.width ?? 1);
  check(`${map}: el WebP tiene la proporción del SVG`, Math.abs(ratio - size.height / size.width) < 0.01, `${meta.width}×${meta.height}`);
  check(`${map}: el SVG pesa menos de 400 KB`, svg.length < 400_000, `${Math.round(svg.length / 1024)} KB`);
}

/* ── 4. La roca pintada ────────────────────────────────────────────────── */

section('La roca pintada');

/** Las ocho esquinas de la caja de un objeto (medidas locales), en el mundo. */
function boxCorners(o: PlacedObject, w: number, h: number, depth: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const point = { x: 0, z: 0 };
  for (const lx of [-w / 2, w / 2]) {
    for (const lz of [-depth / 2, depth / 2]) {
      objectToWorld(o, lx, lz, point);
      for (const ly of [0, h]) out.push([point.x, o.y + ly * o.scale, point.z]);
    }
  }
  return out;
}

function overlaps(a: { x0: number; x1: number; y0: number; y1: number }, b: { x0: number; x1: number; y0: number; y1: number }): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

const rocaOf = (portrait: boolean) => stationDecorLayout(UBI, portrait).objects.filter((o) => o.item.kind === 'roca');
check('Ubicación tiene una roca pintada, en horizontal y en vertical', rocaOf(false).length === 1 && rocaOf(true).length === 1);

{
  const geometry = rocaGeometry(7);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const w = box.max.x - box.min.x;
  const h = box.max.y - box.min.y;
  check('mide 3,5–4 u de ancho', w >= 3.5 && w <= 4, w.toFixed(2));
  check('y 2,5–3 u de alto', h >= 2.5 && h <= 3, h.toFixed(2));
  const m = measure([geometry]);
  check('ninguna normal nula ni NaN', m.bad === 0, `${m.bad}`);
  check('lleva la cara para la pintura (aFace)', geometry.getAttribute('aFace')?.itemSize === 4);
  check('menos de 8 000 triángulos', m.triangles < 8000, `${m.triangles}`);
}

const roca = rocaOf(false)[0];
if (roca) {
  const corners = boxCorners(roca, ROCA_SIZE.width, ROCA_SIZE.height, ROCA_SIZE.depth);
  // Desde la vista inicial de Ubicación, 16:9.
  const ubiD = STATION_DEPTHS[UBI]!;
  const rig = createRig();
  snapRig(rig, ubiD);
  const distance = Math.hypot(roca.x - rig.camera.x, roca.z - rig.camera.z);
  check('desde la vista inicial, a 45–60 u de la cámara (la niebla la vela)', distance >= 45 && distance <= 60, `${distance.toFixed(1)} u`);
  const initial = screenBox(cameraAt(ubiD, 16 / 9), corners);
  check(
    'desde la vista inicial, en cuadro',
    initial.x0 >= 0 && initial.x1 <= 1 && initial.y0 >= 0 && initial.y1 <= 1,
    `x ${(initial.x0 * 100).toFixed(0)}–${(initial.x1 * 100).toFixed(0)} %, y ${(initial.y0 * 100).toFixed(0)}–${(initial.y1 * 100).toFixed(0)} %`,
  );
  // El bloque del título (Ichi / 位置 y su texto) y la bandeja de la maqueta.
  const title = { x0: 0.56, x1: 0.92, y0: 0.18, y1: 0.74 };
  const tray = { x0: 0.02, x1: 0.34, y0: 0.25, y1: 0.68 };
  check('no toca el título', !overlaps(initial, title));
  check('ni la maqueta', !overlaps(initial, tray));

  // En la primera parada, no tapa la tabla del kōsatsu.
  const first = signs.find((o) => o.item.kind === 'kosatsu' && o.item.card === 0)!;
  const camera = cameraAt(cardStopD(UBI_SLUG, 0), 16 / 9);
  const rocaBox = screenBox(camera, corners);
  const boardBox = screenBox(camera, boardCorners(first));
  check('en la primera parada, no tapa la tabla', !overlaps(rocaBox, boardBox), `roca x ${(rocaBox.x0 * 100).toFixed(0)}–${(rocaBox.x1 * 100).toFixed(0)} %`);

  const base = objectBases(roca)[0]!;
  check(
    'cierra el paso a la fauna',
    decorFootprints(false).some((f) => f.faunaMargin > 0 && insideFootprint(f, base.x, roca.y + 0.5, base.z, 0)),
  );
}

const stones = stoneLayout();

/* ── 5. La susuki ──────────────────────────────────────────────────────── */

section('La susuki');

/** Si el punto (x, z) cae en el triángulo a–b–c, en planta. */
function inTriangle(px: number, pz: number, a: [number, number], b: [number, number], c: [number, number]): boolean {
  const sign = (p: [number, number], q: [number, number], r: [number, number]) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const pt: [number, number] = [px, pz];
  const d1 = sign(pt, a, b);
  const d2 = sign(pt, b, c);
  const d3 = sign(pt, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

const ubiLayout = stationDecorLayout(UBI, false);
const tufts = ubiLayout.susuki.flatMap((patch) => susukiTufts(patch, 1));
check('el valle tiene susuki (≥ 120 matas en tier alto)', tufts.length >= 120, `${tufts.length}`);

const tuftStones = tufts.filter((t) => stones.some((s) => Math.hypot(s.x - t.x, s.z - t.z) < 0.45 + SUSUKI_TUFT_RADIUS)).length;
check('ninguna mata sobre una piedra', tuftStones === 0, `${tuftStones}`);

let hiding = 0;
for (const o of signs) {
  if (o.item.kind !== 'kosatsu') continue;
  const rig = createRig();
  snapRig(rig, cardStopD(UBI_SLUG, o.item.card));
  const w = kosatsuWriting(o);
  const left: [number, number] = [w.center[0] - (w.right[0] * w.w) / 2, w.center[2] - (w.right[2] * w.w) / 2];
  const right: [number, number] = [w.center[0] + (w.right[0] * w.w) / 2, w.center[2] + (w.right[2] * w.w) / 2];
  const eye: [number, number] = [rig.camera.x, rig.camera.z];
  // Con 0,5 u de margen: se ensancha el triángulo por la base.
  const grow = 0.5;
  const leftOut: [number, number] = [left[0] - w.right[0] * grow, left[1] - w.right[2] * grow];
  const rightOut: [number, number] = [right[0] + w.right[0] * grow, right[1] + w.right[2] * grow];
  hiding += tufts.filter((t) => inTriangle(t.x, t.z, eye, leftOut, rightOut)).length;
}
check('ninguna mata entre la cámara de una parada y su tabla', hiding === 0, `${hiding}`);

const ubiStationD = STATION_DEPTHS[UBI]!;
const lastTuft = Math.max(...tufts.map((t) => -t.z)) - ubiStationD;
check('la susuki se acaba antes de d = 98 (los cerezos van después)', lastTuft < 98, `última en d ${lastTuft.toFixed(1)}`);

/* ── 6. Los cerezos ────────────────────────────────────────────────────── */

section('Los cerezos');

const cerezos = ubiLayout.objects.filter((o) => o.item.kind === 'cerezo');
check('2–3 cerezos al final del tramo', cerezos.length >= 2 && cerezos.length <= 3, `${cerezos.length}`);
for (const o of cerezos) {
  if (o.item.kind !== 'cerezo') continue;
  const d = -o.z - ubiStationD;
  const u = o.x - pathX(-o.z);
  check(`cerezo ${o.item.seed}: en los últimos 30 u (d ${d.toFixed(0)}) y a |u| 7–14 (${u.toFixed(1)})`, d >= 98 && d <= 128 && Math.abs(u) >= 7 && Math.abs(u) <= 14);
  const tree = growCerezo(o.item.seed);
  check(`cerezo ${o.item.seed}: mide ${CEREZO_SIZE.height[0]}–${CEREZO_SIZE.height[1]} u`, tree.height >= CEREZO_SIZE.height[0] && tree.height <= CEREZO_SIZE.height[1], tree.height.toFixed(2));
  check(`cerezo ${o.item.seed}: ninguna rama bajo el suelo`, tree.branches.every((b) => b.from[1] >= -0.01 && b.to[1] >= 0.2));
  check(`cerezo ${o.item.seed}: copa ancha (somei-yoshino)`, tree.spread >= CEREZO_SIZE.spread[0] && tree.spread <= CEREZO_SIZE.spread[1], tree.spread.toFixed(2));
  const trunk = cerezoTrunkGeometry(tree);
  const m = measure([trunk]);
  check(`cerezo ${o.item.seed}: tronco y ramas en < 8 000 triángulos, sin normales malas`, m.triangles < 8000 && m.bad === 0, `${m.triangles}`);
  check(`cerezo ${o.item.seed}: ≤ 2 500 flores en tier alto`, blossomCount(tree, 1) <= 2500, `${blossomCount(tree, 1)}`);
  check(
    `cerezo ${o.item.seed}: el tronco cierra el paso a lo que anda`,
    decorFootprints(false).some((f) => f.faunaMargin > 0 && insideFootprint(f, o.x, o.y + 0.5, o.z, 0)),
  );
}

// Desde la tercera parada, ninguna copa tapa la tabla.
{
  const third = signs.find((o) => o.item.kind === 'kosatsu' && o.item.card === 2)!;
  const camera = cameraAt(cardStopD(UBI_SLUG, 2), 16 / 9);
  const board = screenBox(camera, boardCorners(third));
  const boardDepth = Math.hypot(third.x - camera.position.x, third.z - camera.position.z);
  let covering = 0;
  for (const o of cerezos) {
    if (o.item.kind !== 'cerezo') continue;
    const tree = growCerezo(o.item.seed);
    const points: [number, number, number][] = tree.clusters.map((c) => {
      const p = { x: 0, z: 0 };
      objectToWorld(o, c.x, c.z, p);
      return [p.x, o.y + c.y * o.scale, p.z];
    });
    const crown = screenBox(camera, points);
    const nearer = Math.hypot(o.x - camera.position.x, o.z - camera.position.z) < boardDepth;
    if (nearer && overlaps(crown, board)) covering += 1;
  }
  check('desde la tercera parada, ningún cerezo por delante de la tabla la tapa', covering === 0, `${covering}`);
}

/* ── 7. El reparto del valle ───────────────────────────────────────────── */

section('El valle de Ubicación');

{
  const lanterns = ubiLayout.objects.filter((o) => o.item.kind === 'farol');
  const sideOf = (o: PlacedObject) => Math.sign(o.x - pathX(-o.z));
  const mixed = lanterns.some((a) =>
    lanterns.some(
      (b) =>
        a !== b &&
        a.item.kind === 'farol' &&
        b.item.kind === 'farol' &&
        a.item.variant !== b.item.variant &&
        sideOf(a) === sideOf(b) &&
        Math.hypot(a.x - b.x, a.z - b.z) < 3,
    ),
  );
  check('un grupo mezcla kasuga y yukimi en un mismo lado', mixed);
  const alone = lanterns.some((a) => lanterns.every((b) => a === b || Math.hypot(a.x - b.x, a.z - b.z) > 8));
  check('y hay algún farol solo', alone);

  const bases = ubiLayout.objects.flatMap((o) => objectBases(o));
  const crowded = tufts.filter((t) => bases.some((b) => Math.hypot(b.x - t.x, b.z - t.z) < b.r + SUSUKI_TUFT_RADIUS)).length;
  check('ninguna mata de susuki dentro de lo plantado', crowded === 0, `${crowded}`);

  // Nada de lo plantado delante de una tabla, visto desde la cámara de su parada.
  const blockers: string[] = [];
  for (const sign of signs) {
    if (sign.item.kind !== 'kosatsu') continue;
    const camera = cameraAt(cardStopD(UBI_SLUG, sign.item.card), 16 / 9);
    const board = screenBox(camera, boardCorners(sign));
    const boardDistance = Math.hypot(sign.x - camera.position.x, sign.z - camera.position.z);
    for (const o of ubiLayout.objects) {
      if (o.item.kind === 'kosatsu' || o.item.kind === 'maqueta' || o.item.kind === 'cerezo') continue;
      const distance = Math.hypot(o.x - camera.position.x, o.z - camera.position.z);
      if (distance >= boardDistance) continue;
      const height = o.item.kind === 'roca' ? ROCA_SIZE.height : o.item.kind === 'farol' ? 2.3 : 1.4;
      const box = screenBox(camera, boxCorners(o, 1.6, height, 1.6));
      if (overlaps(box, board)) blockers.push(`${o.item.kind} delante de «${cards[sign.item.card]!.id}»`);
    }
  }
  check('nada tapa una tabla desde la cámara de su parada', blockers.length === 0, blockers.join(', '));
}

{
  // La fauna de Ubicación sigue saliendo: en la estación y en cada parada.
  const random = mulberry32(5150);
  const depths = [ubiStationD, ...cards.map((_, i) => cardStopD(UBI_SLUG, i))];
  for (const portrait of [false, true]) {
    for (const d of depths) {
      const rig = createRig();
      snapRig(rig, d);
      const camera: CameraState = { d, velocity: 0, frame: rig.frame, aspect: portrait ? 9 / 16 : 16 / 9, traveling: false };
      for (const kind of getStation(UBI_SLUG).ambient.fauna) {
        const spec = speciesSpec(kind)!;
        let viable = 0;
        let total = 0;
        for (const behavior of spec.behaviors) {
          for (let n = 0; n < 50; n += 1) {
            const act = createAct({ kind, behavior }, n, 0, camera, random);
            total += 1;
            if (clearOfDecor(act, decorFootprints(portrait), d)) viable += 1;
          }
        }
        const effective = 1 - (1 - viable / total) ** DECOR_RETRIES;
        check(
          `${kind} en d=${(d - ubiStationD).toFixed(0)} (${portrait ? 'vertical' : 'horizontal'}): sale en ≥ 75 % de los repartos`,
          effective >= 0.75,
          `${Math.round(effective * 100)} %`,
        );
      }
    }
  }
}

/* ── 8. El desenrollado no se cruza entre estaciones ───────────────────── */

section('El rollo de cada kōsatsu');

{
  // El tramo de la Home escribe su tarjeta 0: el mapa del primer kōsatsu de
  // Ubicación no puede bajar por eso.
  KOSATSU.unrollFor = 'inicio';
  KOSATSU.unroll[0] = 1;
  check('el scroll de otra estación no desenrolla los mapas de Ubicación', unrollOf('ubicacion', 0) === 0);
  KOSATSU.unrollFor = 'ubicacion';
  KOSATSU.unroll[0] = 0.5;
  check('el de su estación, sí', unrollOf('ubicacion', 0) === 0.5);
  KOSATSU.unrollFor = 'todas';
  KOSATSU.unroll.fill(1);
  check('sin movimiento, todos desplegados', unrollOf('ubicacion', 1) === 1);
  KOSATSU.unrollFor = null;
}

finish('El valle de Ubicación, en orden.');

export type { PlacedObject };
