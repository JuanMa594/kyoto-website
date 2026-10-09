/**
 * Comprobaciones puras de la decoración (Fase 4).
 *
 * Lo que se puede comprobar sin navegador: que nada pise las piedras, que la
 * cámara nunca entre en un objeto, que el cartel de la Home caiga donde dice
 * el spec en 16:9 y en 9:16, que el muelle del bambú rebote como debe, que la
 * fauna siga teniendo sitio y que el presupuesto de triángulos se cumpla. Lo
 * que sólo se ve en pantalla es la revisión visual.
 *
 * Uso: bun run check:path (corre después de check-nav.ts)
 */

import { PerspectiveCamera, Vector3 } from 'three';

import { cubicBezierEase } from '../src/animation/presets';
import { travelDuration } from '../src/animation/travel';
import { KANJI_STROKES } from '../src/components/kanji/strokes.generated';
import { JOURNEY, PATH_LENGTH } from '../src/config/journey';
import { mulberry32 } from '../src/lib/procedural';
import { createRig, snapRig, stepRig, type RigState } from '../src/scene/camera/pathRig';
import { CULM_TRIANGLES, culmLeaves, groveCulms, LEAF_TRIANGLES } from '../src/scene/decor/bamboo';
import {
  crossesDecor,
  decorFootprints,
  footprintDistance,
  insideFootprint,
  objectBases,
  type Footprint,
} from '../src/scene/decor/footprints';
import {
  objectToWorld,
  SHRUB_SIZE,
  stationDecorLayout,
  type DecorLayout,
  type PlacedObject,
} from '../src/scene/decor/placement';
import { stationMoss } from '../src/scene/decor/moss';
import { MASS_TRIANGLES_MAX, SHRUB_LEAF_TRIANGLES, SHRUB_LEAVES, shrubBlobs, shrubLeaves } from '../src/scene/decor/shrub';
import { LANTERN_SIZE } from '../src/scene/objects/toro/toro';
import { lanternGeometry } from '../src/scene/objects/toro/toroGeometry';
import { kasagiProfile, RYOBU } from '../src/scene/objects/torii/ryobu';
import { ryobuToriiGeometry } from '../src/scene/objects/torii/toriiGeometry';
import { STATION_DEPTHS, stationIndex } from '../src/scene/path/journeyPath';
import { stoneLayout } from '../src/scene/path/stones';
import { groundY } from '../src/scene/systems/elevation';
import { speciesSpec } from '../src/scene/systems/fauna/bestiary';
import { createAct, DECOR_RETRIES, type CameraState } from '../src/scene/systems/fauna/casting';
import { SPRINGS, stepSpring } from '../src/scene/systems/sway';
import { requestGust, updateWind, WIND } from '../src/scene/systems/WindField';
import { check, finish, range, section } from './check-kit';

/** Radio de una piedra del camino en planta, con su escala máxima. */
const STONE_RADIUS = 0.45;
/** Lo más cerca que puede pasar la cámara de cualquier objeto. */
const CAMERA_CLEARANCE = 1.5;

const HOME = stationIndex('inicio');

/* ── 1. El modelo ──────────────────────────────────────────────────────── */

section('La decoración');

check('cada estación declara su decoración', JOURNEY.every((s) => Array.isArray(s.environment.decor)));
const homeLand = stationDecorLayout(HOME, false);
const homePort = stationDecorLayout(HOME, true);
const toriiOf = (layout: DecorLayout) => layout.objects.filter((o) => o.item.kind === 'torii');
check(
  'la Home tiene un torii, en horizontal y en vertical',
  toriiOf(homeLand).length === 1 && toriiOf(homePort).length === 1,
);
check('la Home tiene bambú', homeLand.groves.length >= 3);
check(
  'todo objeto se apoya en el terreno',
  [...homeLand.objects, ...homePort.objects].every((o) => Math.abs(o.y - groundY(o.x, o.z)) < 1e-9),
);

/* ── 2. Las piedras ────────────────────────────────────────────────────── */

section('Nada sobre las piedras');

const stones = stoneLayout();
function stoneHits(footprints: readonly Footprint[]): number {
  let hits = 0;
  for (const stone of stones) {
    for (const f of footprints) {
      if (footprintDistance(f, stone.x, stone.z) < STONE_RADIUS) hits += 1;
    }
  }
  return hits;
}
for (const portrait of [false, true]) {
  const hits = stoneHits(decorFootprints(portrait));
  check(`ninguna huella pisa una piedra (${portrait ? 'vertical' : 'horizontal'})`, hits === 0, `${hits} choques`);
}

/* ── 3. La cámara ──────────────────────────────────────────────────────── */

section('La cámara nunca entra');

/** Lo más cerca que la cámara pasa de una huella, sólo por debajo de su copa. */
function closestApproach(rig: RigState, footprints: readonly Footprint[]): number {
  let worst = Number.POSITIVE_INFINITY;
  for (const f of footprints) {
    if (rig.camera.y > f.top + 1) continue;
    worst = Math.min(worst, footprintDistance(f, rig.camera.x, rig.camera.z));
  }
  return worst;
}

const piedra = cubicBezierEase(0.65, 0, 0.35, 1);
for (const portrait of [false, true]) {
  const footprints = decorFootprints(portrait);
  const label = portrait ? 'vertical' : 'horizontal';

  // Caminando: la cámara asentada en cada punto del camino.
  const walker = createRig();
  let walking = Number.POSITIVE_INFINITY;
  for (const d of range(-5, PATH_LENGTH, 0.25)) {
    snapRig(walker, d);
    walking = Math.min(walking, closestApproach(walker, footprints));
  }
  check(
    `caminando, la cámara pasa a ≥ ${CAMERA_CLEARANCE} u de todo (${label})`,
    walking >= CAMERA_CLEARANCE,
    `${walking.toFixed(2)} u`,
  );

  // Viajando: de la Home a Ubicación y vuelta, con el filtro de viaje.
  let traveling = Number.POSITIVE_INFINITY;
  const legs: [number, number][] = [
    [STATION_DEPTHS[0]!, STATION_DEPTHS[1]!],
    [STATION_DEPTHS[1]!, STATION_DEPTHS[0]!],
  ];
  for (const [from, to] of legs) {
    const rig = createRig();
    snapRig(rig, from);
    const duration = travelDuration(Math.abs(to - from));
    for (let t = 0; t <= duration + 1; t += 1 / 60) {
      stepRig(rig, from + (to - from) * piedra(Math.min(1, t / duration)), 1 / 60);
      traveling = Math.min(traveling, closestApproach(rig, footprints));
    }
  }
  check(`viajando, también (${label})`, traveling >= CAMERA_CLEARANCE, `${traveling.toFixed(2)} u`);
}

/* ── 4. El cartel ──────────────────────────────────────────────────────── */

section('El cartel de la Home');

/** La cámara del sitio en la Home, con el aspecto pedido. */
function homeCamera(aspect: number): PerspectiveCamera {
  const rig = createRig();
  snapRig(rig, STATION_DEPTHS[HOME]!);
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

const world = { x: 0, z: 0 };
/** Dónde corta el kasagi el borde derecho: la y de su cara de abajo y de arriba. */
function kasagiAtEdge(camera: PerspectiveCamera, torii: PlacedObject): { bottom: number; top: number } | null {
  for (let lx = 0; lx <= RYOBU.span + RYOBU.kasagiOverhang; lx += 0.02) {
    objectToWorld(torii, lx, 0, world);
    const profile = kasagiProfile(lx);
    const bottom = onScreen(camera, world.x, torii.y + profile.bottom * torii.scale, world.z);
    if (bottom.x >= 1) {
      const top = onScreen(camera, world.x, torii.y + profile.top * torii.scale, world.z);
      return { bottom: bottom.y, top: top.y };
    }
  }
  return null;
}

const wide = homeCamera(16 / 9);
const toriiLand = toriiOf(homeLand)[0]!;
const base = onScreen(wide, toriiLand.x, toriiLand.y, toriiLand.z);
check('16:9 · el pilar cae al 76–80 % del ancho', base.x >= 0.76 && base.x <= 0.8, `${(base.x * 100).toFixed(1)} %`);
check('16:9 · su base, al 85–93 % del alto', base.y >= 0.85 && base.y <= 0.93, `${(base.y * 100).toFixed(1)} %`);
const edge = kasagiAtEdge(wide, toriiLand);
check(
  '16:9 · el kasagi sale por el borde derecho entre el 8 y el 20 % del alto',
  edge !== null && edge.top >= 0.08 && edge.bottom <= 0.2,
  edge ? `${(edge.top * 100).toFixed(1)}–${(edge.bottom * 100).toFixed(1)} %` : 'no llega al borde',
);

const tall = homeCamera(9 / 16);
const toriiPort = toriiOf(homePort)[0]!;
const basePort = onScreen(tall, toriiPort.x, toriiPort.y, toriiPort.z);
check(
  '9:16 · el pilar cae al 84–92 % del ancho',
  basePort.x >= 0.84 && basePort.x <= 0.92,
  `${(basePort.x * 100).toFixed(1)} %`,
);
check('9:16 · el kasagi también sale por el borde derecho', kasagiAtEdge(tall, toriiPort) !== null);

/* ── 5. El muelle ──────────────────────────────────────────────────────── */

section('El muelle del bambú');

const DT = 1 / 120;
for (const [i, spring] of SPRINGS.entries()) {
  // Arrecia: de 0 a 1 de golpe.
  const s = { x: 0, v: 0 };
  let peak = 0;
  let settled = Number.POSITIVE_INFINITY;
  for (let t = 0; t < 12; t += DT) {
    stepSpring(s, 1, spring, DT);
    peak = Math.max(peak, s.x);
    if (Math.abs(s.x - 1) > 0.03) settled = Number.POSITIVE_INFINITY;
    else if (settled === Number.POSITIVE_INFINITY) settled = t;
  }
  check(`muelle ${i}: al arreciar se pasa un poco (10–40 %)`, peak >= 1.1 && peak <= 1.4, `${((peak - 1) * 100).toFixed(0)} %`);
  check(`muelle ${i}: se asienta en ≤ 6 s`, settled <= 6, `${settled.toFixed(2)} s`);

  // Amaina: de 1 a 0. Tiene que cruzar al otro lado (el rebote) y asentarse.
  const r = { x: 1, v: 0 };
  let crossed = false;
  for (let t = 0; t < 12; t += DT) {
    stepSpring(r, 0, spring, DT);
    if (r.x < 0) crossed = true;
  }
  check(`muelle ${i}: al amainar rebota y vuelve a su sitio`, crossed && Math.abs(r.x) < 0.01);
}

// La ráfaga provocada arranca desde cero y sube sin escalones.
section('La ráfaga provocada');
for (let i = 0; i < 30; i += 1) updateWind(1 / 60, 0.35);
requestGust();
let gustJump = 0;
let gustPeak = 0;
let previousGust = WIND.gust;
for (let i = 0; i < 600; i += 1) {
  updateWind(1 / 60, 0.35);
  gustJump = Math.max(gustJump, Math.abs(WIND.gust - previousGust));
  gustPeak = Math.max(gustPeak, WIND.gust);
  previousGust = WIND.gust;
}
check('la ráfaga provocada llega fuerte (≥ 0,8)', gustPeak >= 0.8, gustPeak.toFixed(2));
check('y sube y baja sin escalones (≤ 0,03 por frame)', gustJump <= 0.03, gustJump.toFixed(3));

/* ── 6. El torii ───────────────────────────────────────────────────────── */

section('El torii');

const torii = ryobuToriiGeometry();
let toriiTriangles = 0;
let badNormals = 0;
let topY = Number.NEGATIVE_INFINITY;
for (const part of [torii.shu, torii.sumi, torii.placa]) {
  const position = part.getAttribute('position');
  const normal = part.getAttribute('normal');
  toriiTriangles += position.count / 3;
  for (let i = 0; i < position.count; i += 1) {
    topY = Math.max(topY, position.getY(i));
    const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
    if (!Number.isFinite(length) || length < 0.5) badNormals += 1;
  }
}
check('mide lo que dice RYOBU (7,7–8 de alto, con la sori)', topY >= 7.7 && topY <= 8, topY.toFixed(2));
check('ninguna normal nula ni NaN (los «puntos negros» de la fauna)', badNormals === 0, `${badNormals}`);
check('menos de 15 000 triángulos', toriiTriangles < 15000, `${toriiTriangles}`);

/* ── 7. El bambú ───────────────────────────────────────────────────────── */

section('El bambú');

const homeCulms = homeLand.groves.flatMap((g) => groveCulms(g, 1));
check(
  'la Home y su tramo tienen entre 60 y 160 cañas en tier alto',
  homeCulms.length >= 60 && homeCulms.length <= 160,
  `${homeCulms.length}`,
);
let culmHits = 0;
for (const portrait of [false, true]) {
  for (const grove of stationDecorLayout(HOME, portrait).groves) {
    for (const culm of groveCulms(grove, 1)) {
      for (const stone of stones) {
        if (Math.hypot(stone.x - culm.x, stone.z - culm.z) < STONE_RADIUS + culm.radius) culmHits += 1;
      }
    }
  }
}
check('ninguna caña sale de una piedra', culmHits === 0, `${culmHits}`);

// El macizo de delante asoma por la esquina inferior izquierda (1.png).
const front = homeLand.groves.find((g) => g.item.seed === 21)!;
const cornerTops = groveCulms(front, 1).filter((c) => {
  const top = onScreen(wide, c.x, c.y + c.height, c.z);
  return top.x >= 0 && top.x <= 0.16 && top.y >= 0.3 && top.y <= 0.75;
});
check('16:9 · el bambú de delante asoma por la esquina inferior izquierda', cornerTops.length >= 2, `${cornerTops.length} cañas`);

const homeLeaves = culmLeaves(homeCulms, 4021);
const bambooTriangles = homeCulms.length * CULM_TRIANGLES + homeLeaves.length * LEAF_TRIANGLES;
check('el bambú de la Home cabe en 90 000 triángulos', bambooTriangles <= 90000, `${bambooTriangles}`);

/* ── 8. Los arbustos ───────────────────────────────────────────────────── */

section('Los arbustos');

const shrubSeeds = [11, 12, 13];
check(
  'la masa de cada arbusto cabe en su huella (SHRUB_SIZE)',
  shrubSeeds.every((seed) => shrubBlobs(seed).every((b) => Math.hypot(b.x, b.z) + b.r * 1.08 <= SHRUB_SIZE.radius)),
);
check('las hojas se reparten por la superficie', shrubLeaves(11, SHRUB_LEAVES.high).length >= SHRUB_LEAVES.high * 0.8);

const shrubTriangles = shrubSeeds.length * (MASS_TRIANGLES_MAX + SHRUB_LEAVES.high * SHRUB_LEAF_TRIANGLES);

/* ── 8b. Los faroles ───────────────────────────────────────────────────── */

section('Los faroles');

const lanternsOf = (layout: DecorLayout) => layout.objects.filter((o) => o.item.kind === 'farol');
const homeLanterns = lanternsOf(homeLand);
const variants = new Set(homeLanterns.map((o) => (o.item.kind === 'farol' ? o.item.variant : '')));
check('el tramo de la Home tiene tres faroles, kasuga y yukimi', homeLanterns.length === 3 && variants.size === 2);

let lanternTriangles = 0;
for (const variant of ['kasuga', 'yukimi'] as const) {
  const parts = lanternGeometry(variant);
  const size = LANTERN_SIZE[variant];
  let top = Number.NEGATIVE_INFINITY;
  let reach = 0;
  let bad = 0;
  let triangles = 0;
  for (const part of [parts.stone, parts.paper]) {
    const position = part.getAttribute('position');
    const normal = part.getAttribute('normal');
    triangles += position.count / 3;
    for (let i = 0; i < position.count; i += 1) {
      top = Math.max(top, position.getY(i));
      reach = Math.max(reach, Math.hypot(position.getX(i), position.getZ(i)));
      const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
      if (!Number.isFinite(length) || length < 0.5) bad += 1;
    }
  }
  lanternTriangles += triangles * homeLanterns.filter((o) => o.item.kind === 'farol' && o.item.variant === variant).length;
  check(`${variant}: mide lo que dice LANTERN_SIZE`, Math.abs(top - size.height) < 0.02, top.toFixed(2));
  check(`${variant}: cabe en su huella`, reach <= size.radius, `${reach.toFixed(2)} ≤ ${size.radius}`);
  check(`${variant}: ninguna normal nula ni NaN`, bad === 0, `${bad}`);
  check(`${variant}: menos de 3 000 triángulos`, triangles < 3000, `${triangles}`);
}

// Fuera del cartel: en la Home, ninguno cae en el bloque de texto (8–48 % del
// ancho, tercio medio) a menos de 60 u, donde la niebla aún no lo borra.
const poster = homeCamera(16 / 9);
const underText = homeLanterns.filter((o) => {
  const distance = Math.hypot(o.x - poster.position.x, o.z - poster.position.z);
  const p = onScreen(poster, o.x, o.y + 1, o.z);
  return distance < 60 && p.x > 0.06 && p.x < 0.5 && p.y > 0.25 && p.y < 0.7;
});
check('16:9 · ningún farol cercano bajo el texto del cartel', underText.length === 0, `${underText.length}`);

let culmsInside = 0;
for (const portrait of [false, true]) {
  const layout = stationDecorLayout(HOME, portrait);
  const bases = layout.objects.filter((o) => o.item.kind !== 'arbusto').flatMap(objectBases);
  for (const grove of layout.groves) {
    for (const culm of groveCulms(grove, 1)) {
      if (bases.some((b) => Math.hypot(b.x - culm.x, b.z - culm.z) < b.r + culm.radius)) culmsInside += 1;
    }
  }
}
check('ninguna caña sale de un farol ni de un pilar', culmsInside === 0, `${culmsInside}`);

const lantern = homeLanterns[0]!;
check(
  'el pie de un farol cierra el paso',
  decorFootprints(false).some((f) => f.faunaMargin > 0 && insideFootprint(f, lantern.x, lantern.y + 0.5, lantern.z, 0)),
);

/* ── 8c. El musgo ──────────────────────────────────────────────────────── */

section('El musgo');

const moss = stationMoss(HOME, false, 1);
check('la Home tiene entre 120 y 700 parches de musgo (tier alto)', moss.length >= 120 && moss.length <= 700, `${moss.length}`);
check(
  'cada parche se apoya en el terreno',
  moss.every((p) => Math.abs(p.y - groundY(p.x, p.z)) < 0.05 && p.normal[1] > 0.8),
);
check(
  'sin musgo, ni un parche',
  JOURNEY.every((s, i) => (s.environment.moss ?? 0) > 0 || stationMoss(i, false, 1).length === 0),
);
const mossTriangles = moss.length * 2;

const totalTriangles = toriiTriangles + bambooTriangles + shrubTriangles + lanternTriangles + mossTriangles;
check('la Home entera cabe en 150 000 triángulos (tier alto)', totalTriangles <= 150000, `${totalTriangles}`);

/* ── 9. La fauna ───────────────────────────────────────────────────────── */

section('La fauna sigue teniendo sitio');

const faunaRandom = mulberry32(4242);
for (const portrait of [false, true]) {
  for (const d of [STATION_DEPTHS[HOME]!, 32]) {
    const rig = createRig();
    snapRig(rig, d);
    const camera: CameraState = {
      d,
      velocity: 0,
      frame: rig.frame,
      aspect: portrait ? 9 / 16 : 16 / 9,
      traveling: false,
    };
    for (const kind of JOURNEY[HOME]!.ambient.fauna) {
      const spec = speciesSpec(kind)!;
      let viable = 0;
      let total = 0;
      for (const behavior of spec.behaviors) {
        for (let n = 0; n < 60; n += 1) {
          const act = createAct({ kind, behavior }, n, 0, camera, faunaRandom);
          total += 1;
          if (!crossesDecor(act, decorFootprints(portrait))) viable += 1;
        }
      }
      // El reparto reintenta: lo que cuenta es la probabilidad de que salga
      // algo en una de sus tentativas, no la de un sorteo suelto.
      const single = viable / total;
      const effective = 1 - (1 - single) ** DECOR_RETRIES;
      check(
        `${kind} en d=${d} (${portrait ? 'vertical' : 'horizontal'}): sale en ≥ 75 % de los repartos`,
        effective >= 0.75,
        `${Math.round(effective * 100)} % (un sorteo: ${Math.round(single * 100)} %)`,
      );
    }
  }
}

// Un acto que pasa por el pie del torii cuenta como choque.
const homeTorii = toriiOf(homeLand)[0]!;
const blocked = decorFootprints(false).some(
  (f) => f.faunaMargin > 0 && insideFootprint(f, homeTorii.x, homeTorii.y + 1, homeTorii.z, 0),
);
check('el pie del torii cierra el paso', blocked);

/* ── 10. Los kanji ─────────────────────────────────────────────────────── */

section('Los trazos de los kanji');

const stationKanji = [...new Set(JOURNEY.flatMap((s) => [...s.kanji]))];
const missingStrokes = stationKanji.filter((ch) => !KANJI_STROKES[ch]?.length);
check('cada kanji de las estaciones tiene sus trazos', missingStrokes.length === 0, missingStrokes.join(''));
check('京 tiene 8 trazos y 都, 11', KANJI_STROKES['京']?.length === 8 && KANJI_STROKES['都']?.length === 11);

/* ── Resumen ───────────────────────────────────────────────────────────── */

finish('La decoración, en orden.');
