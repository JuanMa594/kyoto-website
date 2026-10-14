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
import { stationContacts } from '../src/scene/decor/contact';
import { stationMoss } from '../src/scene/decor/moss';
import { MASS_TRIANGLES_MAX, SHRUB_LEAF_TRIANGLES, SHRUB_LEAVES, shrubBlobs, shrubLeaves } from '../src/scene/decor/shrub';
import { LANTERN_SIZE } from '../src/scene/objects/toro/toro';
import { lanternGeometry } from '../src/scene/objects/toro/toroGeometry';
import { MAQUETA_LIFT, MAQUETA_PLAN, MAQUETA_SIZE, MAQUETA_ZOOM } from '../src/scene/objects/maqueta/maqueta';
import { PREFECTURE_NAMES } from '../src/scene/objects/maqueta/names.generated';
import { KYOTO_CITY, LAKE_BIWA, PREFECTURES } from '../src/scene/objects/maqueta/prefectures.generated';
import { cursorAnchor, cursorRect, layoutLabels, type LabelRect } from '../src/components/ubicacion/labelLayout';
import { maquetaGeometry } from '../src/scene/objects/maqueta/maquetaGeometry';
import { REGION_TONE } from '../src/scene/objects/maqueta/regions';
import { WAVE_LIFT, waveStrokes } from '../src/scene/objects/maqueta/waves';
import { contentToTray, faceCamera, KINKI, KYOTO_INDEX, slabTargets, trayPose, trayToObject } from '../src/scene/objects/maqueta/zoom';
import { kasagiProfile, RYOBU } from '../src/scene/objects/torii/ryobu';
import { ryobuToriiGeometry } from '../src/scene/objects/torii/toriiGeometry';
import { STATION_DEPTHS, stationIndex } from '../src/scene/path/journeyPath';
import { stoneLayout } from '../src/scene/path/stones';
import { groundY } from '../src/scene/systems/elevation';
import { speciesSpec } from '../src/scene/systems/fauna/bestiary';
import { clearOfDecor, createAct, DECOR_RETRIES, type CameraState } from '../src/scene/systems/fauna/casting';
import { SPRINGS, stepSpring } from '../src/scene/systems/sway';
import { requestGust, updateWind, WIND } from '../src/scene/systems/WindField';
import messagesEn from '../src/messages/en.json';
import messagesEs from '../src/messages/es.json';
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

section('Las sombras de contacto');

const contacts = stationContacts(HOME, false, 1);
const contactBases = homeLand.objects.flatMap(objectBases).length + homeCulms.length;
check('una por cada pilar, farol, arbusto y caña', contacts.length === contactBases, `${contacts.length} / ${contactBases}`);
check(
  'cada una pegada al terreno, por debajo del musgo',
  contacts.every((c) => c.y > groundY(c.x, c.z) && c.y < groundY(c.x, c.z) + 0.012),
);
const contactTriangles = contacts.length * 2;

const totalTriangles =
  toriiTriangles + bambooTriangles + shrubTriangles + lanternTriangles + mossTriangles + contactTriangles;
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
          // Con la misma regla que el reparto: lo que anda prueba su línea un
          // poco más cerca o más lejos antes de darse por perdido.
          if (clearOfDecor(act, decorFootprints(portrait), d)) viable += 1;
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

// Y el arbusto: la garza lo atravesaba a la vista.
const homeShrub = homeLand.objects.find((o) => o.item.kind === 'arbusto')!;
check(
  'el arbusto cierra el paso',
  decorFootprints(false).some(
    (f) => f.faunaMargin > 0 && insideFootprint(f, homeShrub.x, homeShrub.y + 0.8, homeShrub.z, 0),
  ),
);

// Probar otras líneas no puede costar un frame: el peor reparto, cronometrado.
const timingRandom = mulberry32(77);
let worstCast = 0;
for (let n = 0; n < 40; n += 1) {
  const rig = createRig();
  snapRig(rig, 32);
  const camera: CameraState = { d: 32, velocity: 0, frame: rig.frame, aspect: 16 / 9, traveling: false };
  const started = performance.now();
  for (let attempt = 0; attempt < DECOR_RETRIES; attempt += 1) {
    if (clearOfDecor(createAct({ kind: 'garza', behavior: 'vadear' }, n, 0, camera, timingRandom), decorFootprints(false), 32)) break;
  }
  worstCast = Math.max(worstCast, performance.now() - started);
}
check('el reparto más caro de la garza cabe en 8 ms', worstCast <= 8, `${worstCast.toFixed(1)} ms`);

/* ── 9b. El cartel de Ubicación (Fase 5A) ──────────────────────────────── */

section('El cartel de Ubicación');

const UBI = stationIndex('ubicacion');
const maquetaOf = (layout: DecorLayout) => layout.objects.filter((o) => o.item.kind === 'maqueta');
check(
  'Ubicación tiene una maqueta, en horizontal y en vertical',
  maquetaOf(stationDecorLayout(UBI, false)).length === 1 && maquetaOf(stationDecorLayout(UBI, true)).length === 1,
);
check('46 prefecturas, sin Okinawa', PREFECTURES.length === 46 && !PREFECTURES.some((p) => p.code === 47));
check('Kinki tiene las siete y Kyoto es una de ellas', KINKI.length === 7 && KINKI.includes(KYOTO_INDEX));
const shiga = PREFECTURES.find((p) => p.code === 25);
check('el lago Biwa es un agujero en Shiga', !!shiga && shiga.base.some((poly) => poly.length >= 2));
check(
  'todos los anillos con ≥ 3 vértices y pares x, z',
  PREFECTURES.every((p) => [...p.base, ...p.slab].every((poly) => poly.every((r) => r.length >= 6 && r.length % 2 === 0))),
);

// El zoom se lee de frente: la maqueta se gira y se endereza hacia la cámara
// de la estación (la cámara no se mueve). Se mide con la colocación real.
const ubiPlaced = maquetaOf(stationDecorLayout(UBI, false))[0]!;
const ubiRig = createRig();
snapRig(ubiRig, STATION_DEPTHS[UBI]!);
const face = faceCamera(ubiPlaced, ubiRig.camera);
{
  const zoomed = trayPose(1, face);
  const yaw = ubiPlaced.yaw + zoomed.yaw;
  const normal = {
    x: Math.sin(yaw) * Math.sin(zoomed.tilt),
    y: Math.cos(zoomed.tilt),
    z: Math.cos(yaw) * Math.sin(zoomed.tilt),
  };
  const pivotY = ubiPlaced.y + MAQUETA_SIZE.pivotY * ubiPlaced.scale;
  const toCamera = { x: ubiRig.camera.x - ubiPlaced.x, y: ubiRig.camera.y - pivotY, z: ubiRig.camera.z - ubiPlaced.z };
  const length = Math.hypot(toCamera.x, toCamera.y, toCamera.z);
  const angle =
    (Math.acos((normal.x * toCamera.x + normal.y * toCamera.y + normal.z * toCamera.z) / length) * 180) / Math.PI;
  check('zoom: la bandeja queda de frente a la cámara (≤ 8°)', angle <= 8, `${angle.toFixed(1)}°`);
  // De frente y girada, sigue lejos de la cámara y del camino.
  const local = { x: 0, y: 0, z: 0 };
  const corner = { x: 0, z: 0 };
  const h = MAQUETA_SIZE.tray / 2;
  let nearest = Number.POSITIVE_INFINITY;
  for (const [x, z] of [
    [-h, -h],
    [h, -h],
    [-h, h],
    [h, h],
  ] as const) {
    trayToObject(x, 0, z, zoomed.tilt, local, zoomed.forward);
    objectToWorld({ ...ubiPlaced, yaw: yaw }, local.x, local.z, corner);
    nearest = Math.min(nearest, Math.hypot(corner.x - ubiRig.camera.x, corner.z - ubiRig.camera.z));
  }
  check('zoom: la bandeja girada queda a ≥ 1,5 u de la cámara', nearest >= 1.5, `${nearest.toFixed(2)} u`);
}

// La sombra de la bandeja sobre el suelo es una penumbra de contacto, suave;
// ni la bandeja ni las losas proyectan sombra dura.
const ubiContacts = stationContacts(UBI, false, 1);
check(
  'la bandeja deja una penumbra amplia y suave al pie del atril',
  ubiContacts.some((c) => Math.hypot(c.x - ubiPlaced.x, c.z - ubiPlaced.z) < 0.01 && c.radius >= 2 && c.strength <= 0.6),
);

// Las dos poses: la bandeja nunca toca el suelo, cabe en su huella y no pasa de su alto.
for (const t of [0, 1]) {
  const pose = trayPose(t, face);
  const out = { x: 0, y: 0, z: 0 };
  const h = MAQUETA_SIZE.tray / 2;
  let lowest = Number.POSITIVE_INFINITY;
  let outside = 0;
  let top = Number.NEGATIVE_INFINITY;
  for (const [x, z] of [
    [-h, -h],
    [h, -h],
    [-h, h],
    [h, h],
  ] as const) {
    for (const y of [-MAQUETA_SIZE.trayThickness, 0]) {
      trayToObject(x, y, z, pose.tilt, out, pose.forward);
      lowest = Math.min(lowest, out.y);
      top = Math.max(top, out.y);
      outside = Math.max(outside, Math.abs(out.x) - MAQUETA_PLAN.hx, Math.abs(out.z) - MAQUETA_PLAN.hz);
    }
  }
  check(`pose ${t}: el borde de delante queda a ≥ 0,25 u del suelo`, lowest >= 0.25, lowest.toFixed(2));
  check(`pose ${t}: la bandeja cabe en su huella`, outside <= 0, `sobra ${Math.max(0, outside).toFixed(2)} u`);
  check(`pose ${t}: no pasa de su alto`, top + 0.3 <= MAQUETA_SIZE.top, `${top.toFixed(2)} + 0,3 ≤ ${MAQUETA_SIZE.top}`);
}

// En la pose de Japón, el mapa entero dentro de la bandeja; en el zoom, Kinki entera.
function polygonsInside(indices: readonly number[], t: number): boolean {
  const pose = trayPose(t);
  const point = { x: 0, z: 0 };
  const half = (MAQUETA_SIZE.tray / 2) * MAQUETA_SIZE.clip;
  return indices.every((i) =>
    PREFECTURES[i]!.slab.every((poly) => {
      const ring = poly[0]!;
      for (let k = 0; k < ring.length; k += 2) {
        contentToTray(ring[k]!, ring[k + 1]!, pose, point);
        if (Math.abs(point.x) > half || Math.abs(point.z) > half) return false;
      }
      return true;
    }),
  );
}
check('Japón entero dentro de la bandeja', polygonsInside(PREFECTURES.map((_, i) => i), 0));
check('zoom: Kinki entera dentro de la bandeja', polygonsInside(KINKI, 1));
const kyotoZoomed = { x: 0, z: 0 };
contentToTray(KYOTO_CITY[0], KYOTO_CITY[1], trayPose(1), kyotoZoomed);
check(
  'zoom: Kyoto cae donde dice MAQUETA_ZOOM.kyotoAt',
  Math.hypot(kyotoZoomed.x - MAQUETA_ZOOM.kyotoAt[0], kyotoZoomed.z - MAQUETA_ZOOM.kyotoAt[1]) < 1e-9,
);

// Los objetivos de las losas: Kyoto elevada, el resto de Japón se retira en el zoom.
const lift = new Float32Array(PREFECTURES.length);
const sea = new Float32Array(PREFECTURES.length);
slabTargets(0, -1, lift, sea);
check('en Japón, Kyoto elevada y nada fundido', lift[KYOTO_INDEX]! > 0 && sea.every((s) => s === 0));
slabTargets(1, -1, lift, sea);
const outside = PREFECTURES.map((_, i) => i).filter((i) => !KINKI.includes(i));
check(
  'en el zoom, lo de fuera de Kinki se hunde y se funde con el mar',
  outside.every((i) => lift[i]! < 0 && sea[i]! > 0.5) && KINKI.every((i) => sea[i] === 0),
);
slabTargets(0, 12, lift, sea);
check('la prefectura bajo el cursor sube', lift[12]! >= MAQUETA_LIFT.hover - 1e-6);

// La geometría: sin normales nulas (los puntos negros), con presupuesto y un aPref por losa.
const mapParts = maquetaGeometry();
let mapTriangles = 0;
let mapBad = 0;
for (const g of Object.values(mapParts)) {
  const position = g.getAttribute('position');
  const normal = g.getAttribute('normal');
  mapTriangles += (g.index ? g.index.count : position.count) / 3;
  for (let i = 0; i < normal.count; i += 1) {
    const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
    if (!Number.isFinite(length) || length < 0.5) mapBad += 1;
  }
}
check('maqueta: ninguna normal nula ni NaN', mapBad === 0, `${mapBad}`);
check('maqueta: menos de 40 000 triángulos', mapTriangles < 40000, `${mapTriangles}`);
const slabPrefs = new Set(Array.from(mapParts.slabs.getAttribute('aPref').array));
const basePrefs = new Set(Array.from(mapParts.base.getAttribute('aPref').array));
check('cada losa y cada base llevan su aPref', slabPrefs.size === PREFECTURES.length && basePrefs.size === PREFECTURES.length);
const slabBox = { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
const slabY = mapParts.slabs.getAttribute('position');
for (let i = 0; i < slabY.count; i += 1) {
  slabBox.min = Math.min(slabBox.min, slabY.getY(i));
  slabBox.max = Math.max(slabBox.max, slabY.getY(i));
}
check(
  'las losas van encima de la base',
  Math.abs(slabBox.min - MAQUETA_SIZE.baseHeight) < 1e-4 &&
    Math.abs(slabBox.max - MAQUETA_SIZE.baseHeight - MAQUETA_SIZE.slabHeight) < 1e-4,
  `${slabBox.min.toFixed(3)}–${slabBox.max.toFixed(3)}`,
);
check(
  'base y losas: sólo caras de arriba y cantos (sin tapas de abajo)',
  [mapParts.base, mapParts.slabs].every((g) => {
    const normal = g.getAttribute('normal');
    for (let i = 0; i < normal.count; i += 1) if (normal.getY(i) < -0.5) return false;
    return true;
  }),
);

check(
  'base y losas: las caras de arriba existen y miran arriba',
  [mapParts.base, mapParts.slabs].every((g) => {
    const caps = g.groups[0];
    if (!caps || caps.count < PREFECTURES.length * 3) return false;
    const normal = g.getAttribute('normal');
    for (let i = caps.start; i < caps.start + caps.count; i += 1) if (normal.getY(i) < 0.99) return false;
    return true;
  }),
);

check(
  'los nombres ligeros van en el mismo orden que las prefecturas',
  PREFECTURE_NAMES.length === PREFECTURES.length &&
    PREFECTURE_NAMES.every((n, i) => n.name === PREFECTURES[i]!.name && n.nameJa === PREFECTURES[i]!.nameJa),
);

// Las prefecturas, por región, como los mapas de Edo: ocho regiones con su tono.
const regions = new Set(PREFECTURES.map((p) => p.region));
check(
  'ocho regiones, todas con su tono',
  regions.size === 8 && [...regions].every((r) => r in REGION_TONE),
  [...regions].join(', '),
);
check('Kinki va en blanco (kami): Kyoto y el pin destacan', REGION_TONE.Kinki.token === 'kami');
check(
  'Kinki son las siete del zoom',
  PREFECTURES.every((p, i) => (p.region === 'Kinki') === KINKI.includes(i)),
);

// Las olas: pinceladas en el mar, dentro de la bandeja, nunca sobre tierra.
function pointInRing(ring: readonly number[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i]!;
    const zi = ring[i + 1]!;
    const xj = ring[j]!;
    const zj = ring[j + 1]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function ringDistance(ring: readonly number[], x: number, z: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const ax = ring[j]!;
    const az = ring[j + 1]!;
    const dx = ring[i]! - ax;
    const dz = ring[i + 1]! - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return best;
}
/** Distancia a la costa: negativa en tierra. */
function landDistance(x: number, z: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (const p of PREFECTURES) {
    for (const poly of p.base) {
      const outer = poly[0]!;
      const distance = ringDistance(outer, x, z);
      if (pointInRing(outer, x, z) && !poly.slice(1).some((hole) => pointInRing(hole, x, z))) return -distance;
      best = Math.min(best, distance);
    }
  }
  return best;
}
const strokes = waveStrokes();
const japanWaves = strokes.filter((s) => s.set === 'japon');
const kinkiWaves = strokes.filter((s) => s.set === 'kinki');
check('entre 8 y 16 pinceladas para Japón', japanWaves.length >= 8 && japanWaves.length <= 16, `${japanWaves.length}`);
check('y entre 4 y 10 para el zoom a Kinki', kinkiWaves.length >= 4 && kinkiWaves.length <= 10, `${kinkiWaves.length}`);
// Cada juego, en su pose: la pincelada sigue a su sitio del mapa (centro en el
// contenido) y conserva su tamaño (el trazo, en unidades de la bandeja).
const trayEdge = (MAQUETA_SIZE.tray / 2) * MAQUETA_SIZE.clip - 0.08;
for (const [set, t] of [
  ['japon', 0],
  ['kinki', 1],
] as const) {
  const pose = trayPose(t);
  const center = { x: 0, z: 0 };
  let shore = Number.POSITIVE_INFINITY;
  let offTray = 0;
  for (const stroke of strokes.filter((s) => s.set === set)) {
    contentToTray(stroke.center.x, stroke.center.z, pose, center);
    for (const p of stroke.points) {
      const x = center.x + p.x;
      const z = center.z + p.z;
      // A la costa, en unidades de la bandeja: el contenido está escalado.
      const land = landDistance((x - pose.offsetX) / pose.scale, (z - pose.offsetZ) / pose.scale) * pose.scale;
      shore = Math.min(shore, land - p.width / 2);
      if (Math.abs(x) > trayEdge || Math.abs(z) > trayEdge) offTray += 1;
    }
  }
  check(`${set}: ninguna pincelada toca tierra (≥ 0,05 u de la costa)`, shore >= 0.05, `${shore.toFixed(3)} u`);
  check(`${set}: todas dentro de la bandeja`, offTray === 0, `${offTray} puntos fuera`);
}
check('las olas flotan sobre la bandeja, sin pisarse con ella (≥ 1 cm)', WAVE_LIFT >= 0.01, `${WAVE_LIFT} u`);

// El lago Biwa: un agujero de verdad en la losa de Shiga, y su agua aparte.
const mapPartsForLake = maquetaGeometry;
const shigaIndex = PREFECTURES.findIndex((p) => p.code === 25);
const lakeRing = LAKE_BIWA;
const slabPosition = mapPartsForLake().slabs.getAttribute('position');
const slabPref = mapPartsForLake().slabs.getAttribute('aPref');
let wetTriangles = 0;
for (let i = 0; i < slabPosition.count; i += 3) {
  if (Math.round(slabPref.getX(i)) !== shigaIndex) continue;
  const cx = (slabPosition.getX(i) + slabPosition.getX(i + 1) + slabPosition.getX(i + 2)) / 3;
  const cz = (slabPosition.getZ(i) + slabPosition.getZ(i + 1) + slabPosition.getZ(i + 2)) / 3;
  if (pointInRing(lakeRing, cx, cz)) wetTriangles += 1;
}
check('ninguna parte de la losa de Shiga cae sobre el lago', wetTriangles === 0, `${wetTriangles} triángulos`);
check('el lago tiene su propia agua, sin aPref (no sube con Shiga)', !mapPartsForLake().lake.getAttribute('aPref'));
check(
  'el mar va pintado en la bandeja, no en una capa encima',
  !('sea' in mapPartsForLake()) && !!mapPartsForLake().tray.getAttribute('aSea'),
);
check(
  'cada pincelada se afina en las puntas',
  strokes.every((s) => s.points[0]!.width < 0.3 * Math.max(...s.points.map((p) => p.width))),
);

// Las etiquetas del zoom: Kinki apiñada no se pisa, ni tapa el pin.
const overlaps = (a: LabelRect, b: LabelRect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const crowd = [
  { x: 300, y: 300 },
  { x: 312, y: 306 },
  { x: 322, y: 322 },
  { x: 304, y: 332 },
  { x: 334, y: 300 },
  { x: 288, y: 344 },
].map((a) => ({ ax: a.x, ay: a.y, w: 92, h: 44 }));
const pinRect: LabelRect = { x: 296, y: 250, w: 30, h: 48 };
const laid = layoutLabels(crowd, [pinRect], []);
const rects = laid.map((l, i) => ({ x: l.x, y: l.y, w: crowd[i]!.w, h: crowd[i]!.h }));
check(
  'etiquetas: en un corro apretado, ninguna se pisa',
  rects.every((a, i) => rects.every((b, j) => i === j || !overlaps(a, b))),
);
check('etiquetas: ninguna tapa el pin', rects.every((r) => !overlaps(r, pinRect)));
check(
  'etiquetas: cada una cerca de su punto (≤ 130 px)',
  laid.every((l, i) => Math.hypot(l.x + crowd[i]!.w / 2 - crowd[i]!.ax, l.y + crowd[i]!.h / 2 - crowd[i]!.ay) <= 130),
);
const alone = layoutLabels([{ ax: 100, ay: 100, w: 80, h: 40 }], [], [])[0]!;
check('etiquetas: una sola va debajo de su punto, sin línea', alone.slot === 0 && !alone.leader && alone.y > 100);
// La del cursor va colgada de él, por debajo de la flecha: el cursor no la tapa.
const cursorAt = { x: 400, y: 300 };
const underCursor = layoutLabels([{ ...cursorAnchor(cursorAt.x, cursorAt.y), w: 90, h: 46 }], [], [])[0]!;
check(
  'etiquetas: la del cursor no queda bajo la flecha',
  !overlaps({ x: underCursor.x, y: underCursor.y, w: 90, h: 46 }, cursorRect(cursorAt.x, cursorAt.y)),
);
const again = layoutLabels(crowd, [pinRect], laid.map((l) => l.slot));
check('etiquetas: con la elección anterior libre, no saltan', again.every((l, i) => l.slot === laid[i]!.slot));

// Los textos del cartel, en los dos idiomas.
for (const messages of [messagesEs, messagesEn] as const) {
  const u = (messages as { ubicacion?: Record<string, unknown> }).ubicacion ?? {};
  const ficha = (u.ficha ?? {}) as Record<string, { label?: unknown; value?: unknown }>;
  const strings = ['romaji', 'srTitle', 'tagline', 'summary', 'zoomIn', 'zoomOut', 'fichaLabel'];
  check(
    `${messages === messagesEs ? 'es' : 'en'}: los textos del cartel de Ubicación`,
    strings.every((k) => typeof u[k] === 'string') &&
      ['prefectura', 'region', 'coords', 'poblacion', 'distancias'].every(
        (k) => typeof ficha[k]?.label === 'string' && typeof ficha[k]?.value === 'string',
      ),
  );
}

// La fauna de Ubicación sigue teniendo sitio con la maqueta.
const ubiRandom = mulberry32(5150);
for (const portrait of [false, true]) {
  for (const d of [STATION_DEPTHS[UBI]!, STATION_DEPTHS[UBI]! + 20]) {
    const rig = createRig();
    snapRig(rig, d);
    const camera: CameraState = { d, velocity: 0, frame: rig.frame, aspect: portrait ? 9 / 16 : 16 / 9, traveling: false };
    for (const kind of JOURNEY[UBI]!.ambient.fauna) {
      const spec = speciesSpec(kind)!;
      let viable = 0;
      let total = 0;
      for (const behavior of spec.behaviors) {
        for (let n = 0; n < 60; n += 1) {
          const act = createAct({ kind, behavior }, n, 0, camera, ubiRandom);
          total += 1;
          if (clearOfDecor(act, decorFootprints(portrait), d)) viable += 1;
        }
      }
      const effective = 1 - (1 - viable / total) ** DECOR_RETRIES;
      check(
        `${kind} en d=${d} (${portrait ? 'vertical' : 'horizontal'}): sale en ≥ 75 % de los repartos`,
        effective >= 0.75,
        `${Math.round(effective * 100)} %`,
      );
    }
  }
}

// El cartel: la maqueta en la mitad izquierda en 16:9, entera en cuadro en los dos aspectos.
function stationCamera(index: number, aspect: number): PerspectiveCamera {
  const rig = createRig();
  snapRig(rig, STATION_DEPTHS[index]!);
  const camera = new PerspectiveCamera(34, aspect, 0.1, 1000);
  camera.position.set(rig.camera.x, rig.camera.y, rig.camera.z);
  camera.lookAt(rig.focus.x, rig.focus.y, rig.focus.z);
  camera.updateMatrixWorld();
  return camera;
}
for (const [label, aspect, portrait] of [
  ['16:9', 16 / 9, false],
  // Un teléfono de hoy es más estrecho que 9:16.
  ['9:19,5', 0.45, true],
] as const) {
  const placed = maquetaOf(stationDecorLayout(UBI, portrait))[0]!;
  const camera = stationCamera(UBI, aspect);
  const local = { x: 0, y: 0, z: 0 };
  const world = { x: 0, z: 0 };
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  const h = MAQUETA_SIZE.tray / 2;
  for (const [x, z] of [
    [-h, -h],
    [h, -h],
    [-h, h],
    [h, h],
  ] as const) {
    trayToObject(x, 0, z, trayPose(0).tilt, local);
    objectToWorld(placed, local.x, local.z, world);
    const p = onScreen(camera, world.x, placed.y + local.y * placed.scale, world.z);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  check(
    `${label} · la bandeja entera en cuadro`,
    minX >= 0.01 && maxX <= 0.99 && minY >= 0.02 && maxY <= 0.98,
    `x ${(minX * 100).toFixed(0)}–${(maxX * 100).toFixed(0)} %, y ${(minY * 100).toFixed(0)}–${(maxY * 100).toFixed(0)} %`,
  );
  if (!portrait) check('16:9 · la bandeja en la mitad izquierda', maxX <= 0.52, `hasta el ${(maxX * 100).toFixed(0)} %`);
  else check('9:19,5 · la bandeja por debajo del título (desde el 33 % del alto)', minY >= 0.33, `${(minY * 100).toFixed(0)} %`);
}

/* ── 10. Los kanji ─────────────────────────────────────────────────────── */

section('Los trazos de los kanji');

const stationKanji = [...new Set(JOURNEY.flatMap((s) => [...s.kanji]))];
const missingStrokes = stationKanji.filter((ch) => !KANJI_STROKES[ch]?.length);
check('cada kanji de las estaciones tiene sus trazos', missingStrokes.length === 0, missingStrokes.join(''));
check('京 tiene 8 trazos y 都, 11', KANJI_STROKES['京']?.length === 8 && KANJI_STROKES['都']?.length === 11);

/* ── Resumen ───────────────────────────────────────────────────────────── */

finish('La decoración, en orden.');
