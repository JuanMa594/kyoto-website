/**
 * Comprobaciones puras de la fauna en el camino (Fase 3B).
 *
 * La fauna está anclada al mundo: al avanzar, la cámara se acerca a los
 * animales y los deja atrás. Lo que importa —que nada aparezca ni desaparezca a
 * la vista, que nada visible quede demasiado cerca, que lo que pisa pise el
 * terreno— se comprueba aquí, fuera del navegador, con una cámara de three
 * colocada por el mismo rig que la del sitio. Lo que sólo se ve en pantalla
 * (que se sienta vivo) es la revisión visual.
 *
 * Uso: bun run check:path (corre después de check-path.ts)
 */

import { Frustum, Matrix4, PerspectiveCamera, Sphere, Vector3 } from 'three';

import { cubicBezierEase } from '../src/animation/presets';
import { travelDuration } from '../src/animation/travel';
import { JOURNEY, PATH_LENGTH, type FaunaKind } from '../src/config/journey';
import { damp, lerp, mulberry32, smoothstep } from '../src/lib/procedural';
import { CAMERA_BASE } from '../src/scene/camera/framing';
import { createRig, snapRig, stepRig } from '../src/scene/camera/pathRig';
import {
  blendByZone,
  dominantZone,
  PATH,
  STATION_DEPTHS,
  stationIndex,
} from '../src/scene/path/journeyPath';
import { groundY } from '../src/scene/systems/elevation';
import {
  CAMERA_Z,
  createTrack,
  createViewer,
  faunaDistanceAt,
  fogFarAt,
  forwardDistance,
  HURRY_GAP,
  inView,
  leadFor,
  localToWorld,
  PASSED_ADVANCE,
  passedAdvance,
  retirement,
  SLIDE,
  slideStep,
  spawnAllowed,
  spawnDistance,
  spawnFloor,
  trackAct,
  updateViewer,
  viewRadius,
  type ActTrack,
  type Retirement,
  type Viewer,
} from '../src/scene/systems/fauna/anchoring';
import {
  createPose,
  OVERTIME_FADE,
  OVERTIME_LIMIT,
  placeAt,
  poseFor,
  type FaunaAct,
} from '../src/scene/systems/fauna/behaviors';
import {
  availableSpecies,
  durationFor,
  isAerial,
  membersFor,
  speciesSpec,
  type BehaviorName,
} from '../src/scene/systems/fauna/bestiary';
import {
  advanceCasting,
  newMemory,
  type CameraState,
  type CastingConfig,
} from '../src/scene/systems/fauna/casting';
import { check, finish, range, section } from './check-kit';

type Slug = Parameters<typeof stationIndex>[0];

/** Todas las conductas del bestiario: el `satisfies` obliga a añadir aquí las nuevas. */
const BEHAVIORS = Object.keys({
  cruzarVolando: true,
  planearEnCirculos: true,
  visitaAlSuelo: true,
  vadear: true,
  bandada: true,
  correrYParar: true,
  perseguir: true,
  deambular: true,
  callejear: true,
  revolotear: true,
  titilar: true,
} satisfies Record<BehaviorName, true>) as BehaviorName[];

/** Como el `<Canvas>` de `SceneCanvas.tsx`. */
const CAMERA_FAR = 400;

/** La cámara del sitio en `d`, como la coloca `CameraRig` (sin parallax). */
function cameraAt(d: number, aspect: number) {
  const rig = createRig();
  snapRig(rig, d);
  const camera = new PerspectiveCamera(CAMERA_BASE.fov, aspect, 0.1, CAMERA_FAR);
  camera.position.set(rig.camera.x, rig.camera.y, rig.camera.z);
  camera.lookAt(rig.focus.x, rig.focus.y, rig.focus.z);
  camera.updateMatrixWorld();
  const viewer = createViewer();
  updateViewer(viewer, camera);
  return { rig, camera, viewer };
}

let actIds = 0;

/** Un acto como lo montaría el director, a mano: especie, conducta, cámara y distancia. */
function buildAct(
  kind: FaunaKind,
  behavior: BehaviorName,
  d: number,
  aspect: number,
  distance: number,
  seed: number,
): { act: FaunaAct; viewer: Viewer } {
  const { rig, viewer } = cameraAt(d, aspect);
  const random = mulberry32(seed);
  const spec = speciesSpec(kind)!;
  const duration = durationFor(behavior, random);
  actIds += 1;
  const act: FaunaAct = {
    id: actIds,
    species: kind,
    spec,
    behavior,
    members: membersFor(behavior, random, spec, duration),
    duration,
    startedAt: 0,
    direction: random() < 0.5 ? -1 : 1,
    depth: CAMERA_Z - distance,
    seed: Math.floor(random() * 10000),
    origin: { ...rig.frame },
    anchor: { ...rig.frame },
    spawnD: d,
    aspect: Math.max(aspect, 16 / 9),
  };
  return { act, viewer };
}

const LOCAL = { x: 0, y: 0, z: 0 };
const WORLD = { x: 0, y: 0, z: 0 };

/** ¿Se ve el individuo `member` a los `seconds` de su acto? */
function memberSeen(act: FaunaAct, member: number, seconds: number, viewer: Viewer): boolean {
  placeAt(act, member, seconds, LOCAL);
  localToWorld(act.anchor, LOCAL.x, LOCAL.y, LOCAL.z, WORLD);
  return inView(viewer, WORLD.x, WORLD.y, WORLD.z, viewRadius(act.spec.size));
}

const members = (act: FaunaAct) => Array.from({ length: act.members }, (_, member) => member);

/** Coloca una cámara de three como la del rig (sin parallax). */
function placeCamera(camera: PerspectiveCamera, rig: ReturnType<typeof createRig>): void {
  camera.position.set(rig.camera.x, rig.camera.y, rig.camera.z);
  camera.lookAt(rig.focus.x, rig.focus.y, rig.focus.z);
  camera.updateMatrixWorld();
}

const PROBE_FRUSTUM = new Frustum();
const PROBE_MATRIX = new Matrix4();
const PROBE_SPHERE = new Sphere();
const PROBE_LOOK = new Vector3();
const PROBE_POINT = { x: 0, y: 0, z: 0 };

/** La niebla cercana de la zona en `d`, mezclada entre estaciones (la lejana es `fogFarAt`). */
const fogNearAt = (d: number) => blendByZone(d, (s) => s.ambient.fog.near);

/**
 * Una sonda independiente de la de `trackAct` para juzgar si un acto se retiró
 * a la vista: frustum propio, esfera centrada en el cuerpo (no en los pies) y
 * más grande, y la niebla tal como la dibuja three —`smoothstep(near, far,
 * profundidad)`—: cuenta como visto si le queda al menos un 1 % de contraste.
 * Si un acto se retira y esta sonda aún lo ve, ha desaparecido a la vista.
 */
function probeSeen(act: FaunaAct, seconds: number, camera: PerspectiveCamera, d: number): boolean {
  const fogNear = fogNearAt(d);
  const fogFar = fogFarAt(d);
  if (act.behavior === 'titilar' && seconds >= act.duration) return false; // apagadas
  PROBE_MATRIX.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  PROBE_FRUSTUM.setFromProjectionMatrix(PROBE_MATRIX);
  camera.getWorldDirection(PROBE_LOOK);
  const radius = act.spec.size * 0.8 + 0.1;
  for (const member of members(act)) {
    placeAt(act, member, seconds, PROBE_POINT);
    localToWorld(act.anchor, PROBE_POINT.x, PROBE_POINT.y + act.spec.size * 0.5, PROBE_POINT.z, WORLD);
    const depth =
      (WORLD.x - camera.position.x) * PROBE_LOOK.x +
      (WORLD.y - camera.position.y) * PROBE_LOOK.y +
      (WORLD.z - camera.position.z) * PROBE_LOOK.z;
    if (smoothstep(fogNear, fogFar, depth - radius) >= 0.99) continue;
    PROBE_SPHERE.center.set(WORLD.x, WORLD.y, WORLD.z);
    PROBE_SPHERE.radius = radius;
    if (PROBE_FRUSTUM.intersectsSphere(PROBE_SPHERE)) return true;
  }
  return false;
}

/** La curva de los viajes (`piedra`, en tokens.css). */
const piedra = cubicBezierEase(0.65, 0, 0.35, 1);

/* ── 1. La cercanía por estación ───────────────────────────────────────── */

section('La cercanía por estación');

check(
  'cada estación declara su faunaDistance (0,6–1,4)',
  JOURNEY.every((s) => s.ambient.faunaDistance >= 0.6 && s.ambient.faunaDistance <= 1.4),
);
const nearness = (slug: Slug) => JOURNEY[stationIndex(slug)]!.ambient.faunaDistance;
check('Gion, íntimo, nace más cerca que Ubicación, panorámica', nearness('gion') < nearness('ubicacion'));

let nearnessStep = 0;
let previousNearness = blendByZone(0, (s) => s.ambient.faunaDistance);
for (const d of range(0, PATH_LENGTH, 0.1)) {
  const now = blendByZone(d, (s) => s.ambient.faunaDistance);
  nearnessStep = Math.max(nearnessStep, Math.abs(now - previousNearness));
  previousNearness = now;
}
check(
  'la cercanía se funde entre estaciones, sin saltos',
  nearnessStep < 0.01,
  `máx ${nearnessStep.toFixed(4)} por 0,1 u`,
);
check('PATH lleva la velocidad de la cámara, en reposo a 0', PATH.velocity === 0);

/* ── 2. Cuándo y dónde nace ────────────────────────────────────────────── */

section('Cuándo y dónde nace');

check(
  'nace quieto, leyendo y caminando hasta 12 u/s',
  spawnAllowed(0, false) && spawnAllowed(-0.5, false) && spawnAllowed(6, false) && spawnAllowed(12, false),
);
check(
  'no nace caminando rápido, retrocediendo ni en un viaje',
  !spawnAllowed(12.5, false) && !spawnAllowed(-2, false) && !spawnAllowed(0, true) && !spawnAllowed(Number.NaN, false),
);
check(
  'ventaja: nada quieto, v · 2,5 s caminando, tope 18 u',
  leadFor(0) === 0 && leadFor(0.5) === 0 && leadFor(4) === 10 && leadFor(6) === 15 && leadFor(12) === 18,
);
check(
  'suelos de distancia: 15 u lo que no se desliza siempre; su mínimo + 1 lo demás',
  spawnFloor('vadear') === 15 &&
    spawnFloor('visitaAlSuelo') === 15 &&
    spawnFloor('revolotear') === 9 &&
    spawnFloor('bandada') === 11 &&
    spawnFloor('planearEnCirculos') === 23,
);
check('sin cercanía ni ventaja, la distancia de siempre', spawnDistance(20, 1, 15, 0, 90) === 20);
check('la cercanía acerca', spawnDistance(20, 0.8, 15, 0, 90) === 16);
check('…pero no por debajo del suelo', spawnDistance(17, 0.8, 15, 0, 90) === 15);
check('…salvo que la especie ya naciera más cerca', spawnDistance(12, 0.8, 15, 0, 90) === 12);
check('la ventaja se suma', spawnDistance(20, 1, 15, 10, 90) === 30);
check('con ventaja, nada más lejos que media niebla', spawnDistance(20, 1, 15, 18, 55) === 27.5);
check('…ni más cerca de lo que ya nacía', spawnDistance(30, 1, 15, 18, 55) === 30);

/* ── 3. El ancla que se desliza ────────────────────────────────────────── */

section('El ancla que se desliza');

check(
  'sólo se desliza lo que vuela (y los gorriones que se posan, en el aire)',
  BEHAVIORS.every((b) => SLIDE[b].mode === 'nunca' || isAerial(b) || b === 'visitaAlSuelo'),
);
check(
  'lo que anda y las luciérnagas no se deslizan nunca',
  (['vadear', 'correrYParar', 'perseguir', 'deambular', 'callejear', 'titilar'] as const).every(
    (b) => SLIDE[b].mode === 'nunca',
  ),
);

{
  // La cámara camina a 6 u/s hacia algo que vuela, nacido a 20 u, mínimo 10.
  const dt = 1 / 60;
  let push = 0;
  let walked = 0;
  let closest = Infinity;
  let biggestStep = 0;
  for (let i = 0; i < 600; i += 1) {
    walked += 6 * dt;
    const distance = 20 - walked + push;
    const next = slideStep(push, distance, 6 * dt, 10, dt);
    biggestStep = Math.max(biggestStep, next - push);
    push = next;
    closest = Math.min(closest, 20 - walked + push);
  }
  const final = 20 - walked + push;
  check('se deja alcanzar hasta su mínimo y no más', closest >= 10 - 1e-9, `mín ${closest.toFixed(3)} u`);
  check('después avanza con la cámara', Math.abs(final - 10) < 0.3, `a ${final.toFixed(2)} u`);
  check('nunca avanza más que la cámara', biggestStep <= 6 * dt + 1e-12);
}
check('con la cámara quieta no se mueve', slideStep(5, 15, 0, 10, 1 / 60) === 5);
check('si la cámara retrocede no vuelve atrás', slideStep(5, 12, -0.2, 10, 1 / 60) === 5);
{
  // Unos gorriones que alzan el vuelo a 6 u, mínimo 12, con la cámara quieta.
  const dt = 1 / 60;
  let push = 0;
  let biggestStep = 0;
  for (let i = 0; i < 120; i += 1) {
    const next = slideStep(push, 6 + push, 0, 12, dt);
    biggestStep = Math.max(biggestStep, next - push);
    push = next;
  }
  check(
    'lo que arranca a volar ya cerca se aparta hasta su mínimo, suave',
    6 + push > 11.5 && biggestStep < 0.35,
    `a ${(6 + push).toFixed(2)} u en 2 s; paso máx ${biggestStep.toFixed(2)} u`,
  );
}

/* ── 4. La cámara real ─────────────────────────────────────────────────── */

section('La cámara real');

{
  // En la Home el camino es llano: el suelo sale por abajo a 12,6 u. (El
  // rumbo no es exactamente 0 —promedia la tangente en ±10 u—: por eso los
  // puntos se toman a lo largo de la mirada real.)
  const { rig, viewer } = cameraAt(0, 16 / 9);
  const ahead = (distance: number) => ({
    x: viewer.position.x + viewer.forward.x * distance,
    z: viewer.position.z + viewer.forward.z * distance,
  });
  const groundAhead = (distance: number) => {
    const { x, z } = ahead(distance);
    return inView(viewer, x, groundY(x, z), z, 0.01);
  };
  check('el suelo a 18 u se ve', groundAhead(18));
  check('el suelo a 11 u ya no (salió por abajo)', !groundAhead(11));
  const point = ahead(18);
  const along = forwardDistance(viewer, point.x, point.z);
  check('la distancia se mide a lo largo de la mirada', Math.abs(along - 18) < 1e-6, `${along.toFixed(6)}`);
  const atCamera = localToWorld(rig.frame, 0, 0, CAMERA_Z, { x: 0, y: 0, z: 0 });
  check(
    'z local 13 es la posición de la cámara en su encuadre',
    Math.hypot(atCamera.x - rig.camera.x, atCamera.z - rig.camera.z) < 1e-9,
  );
}

/* ── 5. Las conductas en el mundo ──────────────────────────────────────── */

section('Las conductas en el mundo');

// Cada especie con cada conducta, en cada estación y a medio tramo (curvas y
// cuestas), con cuatro aspectos de pantalla, quieta y caminando.
const ASPECTS = [9 / 16, 4 / 3, 16 / 9, 21 / 9];
const SAMPLE_DEPTHS = STATION_DEPTHS.flatMap((d, i) => {
  const next = STATION_DEPTHS[i + 1];
  return next === undefined ? [d] : [d, (d + next) / 2];
});

const sweep: { act: FaunaAct; viewer: Viewer }[] = [];
for (const d of SAMPLE_DEPTHS) {
  const station = JOURNEY[dominantZone(d)]!;
  for (const kind of availableSpecies(station.ambient.fauna)) {
    const spec = speciesSpec(kind)!;
    for (const behavior of spec.behaviors) {
      for (const aspect of ASPECTS) {
        for (const velocity of [0, 6, 12]) {
          for (const pick of [0, 0.5, 1]) {
            const base = CAMERA_Z - lerp(spec.depth[0], spec.depth[1], pick);
            const lead = SLIDE[behavior].mode === 'siempre' ? 0 : leadFor(velocity);
            const distance = spawnDistance(
              base,
              station.ambient.faunaDistance,
              spawnFloor(behavior),
              lead,
              station.ambient.fog.far,
            );
            sweep.push(buildAct(kind, behavior, d, aspect, distance, sweep.length + 1));
          }
        }
      }
    }
  }
}

const label = (act: FaunaAct) => `${act.species} (${act.behavior}) en d=${act.spawnD.toFixed(0)}`;
const lights = sweep.filter(({ act }) => act.behavior === 'titilar');
const bodies = sweep.filter(({ act }) => act.behavior !== 'titilar');

const startsInView = bodies.filter(({ act, viewer }) => members(act).some((m) => memberSeen(act, m, 0, viewer)));
check(
  `todo lo que tiene cuerpo empieza fuera de cuadro (${bodies.length} actos)`,
  startsInView.length === 0,
  startsInView.slice(0, 3).map(({ act }) => label(act)).join('; '),
);
const endsInView = bodies.filter(({ act, viewer }) =>
  members(act).some((m) => memberSeen(act, m, act.duration, viewer)),
);
check(
  'y termina fuera de cuadro, con la cámara quieta (el milano también)',
  endsInView.length === 0,
  endsInView.slice(0, 3).map(({ act }) => label(act)).join('; '),
);

const fadeAt = (act: FaunaAct, seconds: number) => {
  const pose = createPose();
  poseFor(act, 0, seconds, pose);
  return pose.fade;
};
check(
  'las luciérnagas se encienden y se apagan: presencia 0 al empezar y al terminar, 1 a mitad',
  lights.length > 0 &&
    lights.every(
      ({ act }) => fadeAt(act, 0) === 0 && fadeAt(act, act.duration) === 0 && fadeAt(act, act.duration / 2) === 1,
    ),
);

const P = { x: 0, y: 0, z: 0 };
const Q = { x: 0, y: 0, z: 0 };
const gap = (act: FaunaAct, member: number, a: number, b: number) => {
  placeAt(act, member, a, P);
  placeAt(act, member, b, Q);
  return Math.hypot(Q.x - P.x, Q.z - P.z);
};

let slowestExit = Infinity;
for (const { act } of bodies) {
  for (const m of members(act)) {
    const span = act.duration * 0.15;
    slowestExit = Math.min(slowestExit, gap(act, m, act.duration - span, act.duration) / span);
  }
}
check('todo lo que sale de cuadro sale a más de 0,3 u/s', slowestExit > 0.3, `mín ${slowestExit.toFixed(2)} u/s`);
check(
  'más allá de su tiempo sigue su camino: sin salto en el empalme y sin pararse',
  bodies.every(({ act }) =>
    members(act).every(
      (m) => gap(act, m, act.duration, act.duration + 1e-3) < 1e-2 && gap(act, m, act.duration, act.duration + 5) > 1,
    ),
  ),
);
check(
  'las luciérnagas no siguen: se quedan donde se apagan',
  lights.every(({ act }) => gap(act, 0, act.duration, act.duration + 5) === 0),
);

const scaleAt = (act: FaunaAct, seconds: number) => {
  const pose = createPose();
  poseFor(act, 0, seconds, pose);
  return pose.scale;
};
check(
  'ya no se encoge al terminar',
  bodies.every(({ act }) => scaleAt(act, act.duration - 0.01) === 1),
);
check(
  'red de seguridad: 30 s después de su fin, fundido de 1 s',
  bodies.every(({ act }) => scaleAt(act, act.duration + OVERTIME_LIMIT + OVERTIME_FADE + 0.1) === 0),
);

// Lo que pisa, pisa el terreno del mundo: en cada muestra en que está en el
// suelo, su centro está a `ride · size` del terreno. «En el suelo» es lo mismo
// que para la propia conducta: `airborne` 0, que es estar a menos de 5 cm (los
// gorriones que se posan lo deducen de su altura).
const GROUND_CONTACT = 0.05;
let floating = 0;
let groundSamples = 0;
let firstFloat = '';
for (const { act } of bodies) {
  if (isAerial(act.behavior)) continue;
  for (const m of members(act)) {
    const pose = createPose();
    for (const seconds of range(0, act.duration + 3, 0.5)) {
      pose.heading = 0;
      poseFor(act, m, seconds, pose);
      if (pose.airborne > 0) continue;
      localToWorld(act.anchor, pose.x, pose.y, pose.z, WORLD);
      const expected = groundY(WORLD.x, WORLD.z) + act.spec.ride * act.spec.size;
      groundSamples += 1;
      if (Math.abs(WORLD.y - expected) > GROUND_CONTACT) {
        floating += 1;
        firstFloat ||= `${label(act)} a los ${seconds} s de ${act.duration.toFixed(1)}: ${(WORLD.y - expected).toFixed(3)} u`;
      }
    }
  }
}
check(
  'lo que pisa, pisa el terreno, también en las cuestas',
  floating === 0,
  `${floating} de ${groundSamples} muestras${firstFloat ? `; ${firstFloat}` : ''}`,
);

/* ── 6. El seguimiento y la retirada ───────────────────────────────────── */

section('El seguimiento y la retirada');

const depthOf = (slug: Slug) => STATION_DEPTHS[stationIndex(slug)]!;

{
  const { act } = buildAct('ardilla', 'correrYParar', depthOf('fushimi-inari'), 16 / 9, 20, 5);
  const tracked = (patch: Partial<ActTrack>): ActTrack => ({ ...createTrack(), distance: 20, ...patch });
  check(
    'a la vista no se retira, ni con el tiempo cumplido',
    retirement(act, tracked({ visible: true }), act.duration + 5, 0, 90) === null,
  );
  check(
    '…salvo la red de seguridad',
    retirement(act, tracked({ visible: true }), act.duration + OVERTIME_LIMIT + OVERTIME_FADE, 0, 90) === 'seguridad',
  );
  check('fuera de cuadro y con el tiempo cumplido, se retira', retirement(act, tracked({}), act.duration, 0, 90) === 'tiempo');
  check(
    'dejado atrás: tras 6 u de avance fuera de cuadro, no antes',
    retirement(act, tracked({ passedFrom: 100, distance: 5 }), 1, 106, 90) === 'dejado' &&
      retirement(act, tracked({ passedFrom: 100, distance: 5 }), 1, 105.9, 90) === null,
  );
  check('muy lejos al retroceder', retirement(act, tracked({ distance: 200 }), 1, 0, 90) === 'lejos');
  check(
    'los gorriones posados se retiran en cuanto salen de cuadro',
    passedAdvance('visitaAlSuelo') === 0 && passedAdvance('correrYParar') === PASSED_ADVANCE,
  );
}

{
  // Una ardilla a mitad de su acto, a 20 u; la cámara camina hacia ella.
  const start = depthOf('fushimi-inari');
  const { act } = buildAct('ardilla', 'correrYParar', start, 16 / 9, 20, 9);
  const track = createTrack();
  const middle = act.duration / 2;
  let seen = false;
  let reason: string | null = null;
  let retiredVisible = false;
  let retiredAfter = 0;
  for (const d of range(start, start + 40, 0.1)) {
    const { viewer } = cameraAt(d, 16 / 9);
    trackAct(act, track, middle, d, 1 / 60, viewer);
    seen ||= track.visible;
    const why = retirement(act, track, middle, d, 95);
    if (why) {
      reason = why;
      retiredVisible = track.visible;
      retiredAfter = d - start;
      break;
    }
  }
  check(
    'a una ardilla se la ve, se la deja atrás y se retira fuera de cuadro',
    seen && reason === 'dejado' && !retiredVisible,
    `retirada tras ${retiredAfter.toFixed(1)} u de avance`,
  );
  check('la ardilla no se mueve con la cámara', track.push === 0 && act.anchor.z === act.origin.z);
}

{
  // Una mariposa a 12 u; la cámara camina 30 u hacia ella.
  const start = depthOf('eventos');
  const { act } = buildAct('mariposa', 'revolotear', start, 16 / 9, 12, 4);
  const track = createTrack();
  let closest = Infinity;
  let worstJump = 0;
  let previous = { x: act.anchor.x, z: act.anchor.z };
  let previousD = start;
  for (const d of range(start, start + 30, 0.1)) {
    const { viewer } = cameraAt(d, 16 / 9);
    trackAct(act, track, 2, d, 1 / 60, viewer);
    closest = Math.min(closest, track.distance);
    worstJump = Math.max(
      worstJump,
      Math.hypot(act.anchor.x - previous.x, act.anchor.z - previous.z) - (d - previousD),
    );
    previous = { x: act.anchor.x, z: act.anchor.z };
    previousD = d;
  }
  check(
    'la mariposa se deja alcanzar hasta 8 u y luego avanza con la cámara',
    closest >= 8 - 0.3 && track.push > 15,
    `mín ${closest.toFixed(2)} u; se ha deslizado ${track.push.toFixed(1)} u`,
  );
  check('su ancla no da saltos', worstJump <= 0.05, `${worstJump.toFixed(3)} u`);
}

/* ── 7. El director ────────────────────────────────────────────────────── */

section('El director');

const DIRECTOR: CastingConfig = { minGap: 3, maxGap: 6, idleGap: 20, maxActs: 2 };

{
  const gionD = depthOf('gion');
  const at = (velocity: number, traveling = false): CameraState => ({
    d: gionD,
    velocity,
    frame: cameraAt(gionD, 16 / 9).rig.frame,
    aspect: 16 / 9,
    traveling,
  });
  const spawnWith = (camera: CameraState) => {
    const random = mulberry32(3);
    const memory = newMemory(0, random);
    return advanceCasting({
      memory,
      acts: [],
      now: 60,
      idleFor: 0,
      cast: ['gato'],
      config: DIRECTOR,
      random,
      camera,
      tracks: new Map(),
    }).spawned;
  };
  const still = spawnWith(at(0));
  const walking = spawnWith(at(6));
  check('quieto, nace', still !== null);
  check('caminando rápido no nace', spawnWith(at(13)) === null);
  check('retrocediendo no nace', spawnWith(at(-2)) === null);
  check('en un viaje no nace', spawnWith(at(0, true)) === null);
  check(
    'caminando, nace más al fondo (con ventaja)',
    still !== null && walking !== null && CAMERA_Z - walking.depth > CAMERA_Z - still.depth + 5,
    still && walking ? `${(CAMERA_Z - still.depth).toFixed(1)} → ${(CAMERA_Z - walking.depth).toFixed(1)} u` : '',
  );
  check(
    'nace con su ancla en la cámara, y su ancla es suya',
    walking !== null && walking.anchor !== walking.origin && walking.origin.z === at(6).frame.z,
  );
}

{
  const random = mulberry32(11);
  const memory = newMemory(0, random);
  memory.nextAt = 100;
  const fushimiD = depthOf('fushimi-inari');
  const { act } = buildAct('ardilla', 'correrYParar', fushimiD, 16 / 9, 20, 1);
  const track: ActTrack = { ...createTrack(), passedFrom: fushimiD - 10, distance: 3 };
  const result = advanceCasting({
    memory,
    acts: [act],
    now: 5,
    idleFor: 0,
    cast: [],
    config: DIRECTOR,
    random,
    camera: { d: fushimiD, velocity: 0, frame: act.origin, aspect: 16 / 9, traveling: false },
    tracks: new Map([[act.id, track]]),
  });
  check(
    'dejar atrás un acto lo retira y adelanta el siguiente',
    result.acts.length === 0 && memory.nextAt <= 5 + HURRY_GAP[1],
    `siguiente en ${(memory.nextAt - 5).toFixed(1)} s`,
  );
}

/* ── 8. El recorrido ───────────────────────────────────────────────────── */

section('El recorrido');

/** Nada visible a menos de esto de la cámara (u, al centro de cada individuo). */
const NEAR_LIMIT = 7;

type Move =
  | { kind: 'walk'; to: number; speed: number }
  | { kind: 'stop'; seconds: number }
  | { kind: 'travel'; to: number };

/**
 * Un paseo de la Home a Gastronomía: leer cada estación, caminar cada tramo a
 * tres ritmos con una parada de tarjeta cada 40 u, retroceder 8 u una vez por
 * tramo, y al final volver a la Home por enlace (un viaje a 160 u/s).
 */
function journeyScript(): Move[] {
  const moves: Move[] = [];
  const paces = [3, 6, 10];
  for (let i = 0; i < STATION_DEPTHS.length - 1; i += 1) {
    const from = STATION_DEPTHS[i]!;
    const to = STATION_DEPTHS[i + 1]!;
    moves.push({ kind: 'stop', seconds: 12 });
    let leg = 0;
    for (let at = from; at < to; leg += 1) {
      const next = Math.min(to, at + 40);
      moves.push({ kind: 'walk', to: next, speed: paces[(i + leg) % paces.length]! });
      if (leg === 1) {
        moves.push({ kind: 'walk', to: next - 8, speed: 4 }, { kind: 'walk', to: next, speed: 4 });
      }
      moves.push({ kind: 'stop', seconds: 6 });
      at = next;
    }
  }
  // La parada final es más larga que la red de seguridad (30 s tras el fin de
  // un acto): si algo se quedara «a la vista» lejos, saltaría aquí.
  moves.push({ kind: 'travel', to: 0 }, { kind: 'stop', seconds: 60 });
  return moves;
}

interface JourneyStats {
  spawned: number;
  seenFrames: number;
  retired: Record<Retirement, number>;
  vanished: Set<string>;
  startedInView: Set<string>;
  tooClose: Set<string>;
  floating: Set<string>;
  slideJumps: Set<string>;
  lingering: Set<string>;
  travelSpawns: number;
  closest: Map<BehaviorName, number>;
}

function simulateJourney(aspect: number, seed: number): JourneyStats {
  const DT = 1 / 30;
  const random = mulberry32(seed);
  const memory = newMemory(0, random);
  const rig = createRig();
  const camera = new PerspectiveCamera(CAMERA_BASE.fov, aspect, 0.1, CAMERA_FAR);
  const viewer = createViewer();
  const tracks = new Map<number, ActTrack>();
  const pose = createPose();
  const world = { x: 0, y: 0, z: 0 };
  const stats: JourneyStats = {
    spawned: 0,
    seenFrames: 0,
    retired: { tiempo: 0, dejado: 0, lejos: 0, seguridad: 0 },
    vanished: new Set(),
    startedInView: new Set(),
    tooClose: new Set(),
    floating: new Set(),
    slideJumps: new Set(),
    lingering: new Set(),
    travelSpawns: 0,
    closest: new Map(),
  };
  let acts: readonly FaunaAct[] = [];
  let target = 0;
  let velocity = 0;
  let now = 0;
  snapRig(rig, 0);

  const frame = (traveling: boolean) => {
    const before = rig.d;
    stepRig(rig, target, DT);
    const step = rig.d - before;
    velocity = damp(velocity, step / DT, 8, DT); // como CameraRig
    placeCamera(camera, rig);
    const fogFar = fogFarAt(rig.d);
    updateViewer(viewer, camera, fogFar);

    for (const act of acts) {
      const fresh = !tracks.has(act.id);
      const track = tracks.get(act.id) ?? createTrack();
      tracks.set(act.id, track);
      const anchorBefore = { x: act.anchor.x, z: act.anchor.z };
      trackAct(act, track, now, rig.d, DT, viewer);

      const name = `${act.species} (${act.behavior}) #${act.id}`;
      const seconds = now - act.startedAt;
      if (fresh && track.visible && act.behavior !== 'titilar') stats.startedInView.add(name);
      if (track.visible) stats.seenFrames += 1;

      const moved = Math.hypot(act.anchor.x - anchorBefore.x, act.anchor.z - anchorBefore.z);
      if (moved > Math.abs(step) + 0.15) stats.slideJumps.add(`${name}: ${moved.toFixed(2)} u`);

      for (let member = 0; member < act.members; member += 1) {
        pose.heading = 0;
        poseFor(act, member, seconds, pose);
        localToWorld(act.anchor, pose.x, pose.y, pose.z, world);
        const shown = act.behavior !== 'titilar' || pose.fade > 0;
        if (shown && inView(viewer, world.x, world.y, world.z, viewRadius(act.spec.size))) {
          const distance = Math.hypot(
            world.x - camera.position.x,
            world.y - camera.position.y,
            world.z - camera.position.z,
          );
          stats.closest.set(act.behavior, Math.min(stats.closest.get(act.behavior) ?? Infinity, distance));
          if (distance < NEAR_LIMIT) stats.tooClose.add(`${name}: ${distance.toFixed(1)} u`);
        }
        // «En el suelo» como para la propia conducta: airborne 0, a menos de 5 cm.
        if (!isAerial(act.behavior) && pose.airborne === 0) {
          const expected = groundY(world.x, world.z) + act.spec.ride * act.spec.size;
          if (Math.abs(world.y - expected) > GROUND_CONTACT) stats.floating.add(name);
        }
      }
      if (SLIDE[act.behavior].mode !== 'siempre' && track.distance < -30) stats.lingering.add(name);
    }

    const zone = JOURNEY[dominantZone(rig.d)]!;
    const result = advanceCasting({
      memory,
      acts,
      now,
      idleFor: 0,
      cast: availableSpecies(zone.ambient.fauna),
      config: DIRECTOR,
      random,
      camera: { d: rig.d, velocity, frame: rig.frame, aspect, traveling },
      tracks,
    });

    for (const act of acts) {
      if (result.acts.includes(act)) continue;
      const track = tracks.get(act.id);
      if (!track) continue;
      const why = retirement(act, track, now, rig.d, fogFar);
      if (why) stats.retired[why] += 1;
      if (track.visible || probeSeen(act, now - act.startedAt, camera, rig.d)) {
        stats.vanished.add(`${act.species} (${act.behavior}) #${act.id}: ${why}`);
      }
      tracks.delete(act.id);
    }
    if (result.spawned) {
      stats.spawned += 1;
      if (traveling) stats.travelSpawns += 1;
    }
    acts = result.acts;
    now += DT;
  };

  for (const move of journeyScript()) {
    if (move.kind === 'stop') {
      for (let t = 0; t < move.seconds; t += DT) frame(false);
      continue;
    }
    if (move.kind === 'travel') {
      // Como `travel.ts`: la curva `piedra`, que arranca y frena con peso.
      const from = target;
      const seconds = travelDuration(Math.abs(move.to - from));
      for (let t = DT; t < seconds; t += DT) {
        target = from + (move.to - from) * piedra(t / seconds);
        frame(true);
      }
      target = move.to;
      frame(false);
      continue;
    }
    while (Math.abs(target - move.to) > 1e-9) {
      target += Math.sign(move.to - target) * Math.min(move.speed * DT, Math.abs(move.to - target));
      frame(false);
    }
  }

  return stats;
}

const sample = (set: Set<string>) => [...set].slice(0, 3).join('; ');

for (const [name, aspect] of [
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
] as const) {
  const stats = simulateJourney(aspect, 20261001);
  const closest = [...stats.closest].map(([behavior, distance]) => `${behavior} ${distance.toFixed(1)}`).join(' · ');
  check(`${name}: la simulación pone fauna en escena`, stats.spawned >= 15 && stats.seenFrames > 0, `${stats.spawned} actos`);
  check(`${name}: ningún individuo desaparece a la vista`, stats.vanished.size === 0, sample(stats.vanished));
  check(`${name}: ningún acto empieza ya a la vista`, stats.startedInView.size === 0, sample(stats.startedInView));
  check(`${name}: nada visible a menos de ${NEAR_LIMIT} u`, stats.tooClose.size === 0, sample(stats.tooClose) || closest);
  check(`${name}: lo que pisa, pisa el terreno`, stats.floating.size === 0, sample(stats.floating));
  check(`${name}: el ancla que se desliza no da saltos`, stats.slideJumps.size === 0, sample(stats.slideJumps));
  check(
    `${name}: se dejan actos atrás y ninguno queda vivo muy por detrás`,
    stats.retired.dejado > 0 && stats.lingering.size === 0,
    `${stats.retired.dejado} dejados atrás, ${stats.retired.tiempo} por tiempo, ${stats.retired.lejos} lejos`,
  );
  check(`${name}: la red de seguridad no salta`, stats.retired.seguridad === 0);
  check(`${name}: nada nace en un viaje`, stats.travelSpawns === 0);
}

/* ── 9. Retrocesos largos y llegadas ───────────────────────────────────── */

section('Retrocesos largos y llegadas');

/**
 * Un acto nace con la cámara quieta en `spawnD`; a una fracción `when` de su
 * vida la cámara retrocede `back` u a 10 u/s y se queda ahí un minuto.
 * Devuelve por qué se retiró, y si la sonda independiente aún lo veía.
 */
function retreatRun(kind: FaunaKind, behavior: BehaviorName, spawnD: number, back: number, when: number, seed: number) {
  const spec = speciesSpec(kind)!;
  const base = CAMERA_Z - lerp(spec.depth[0], spec.depth[1], 0.5);
  const distance = spawnDistance(base, faunaDistanceAt(spawnD), spawnFloor(behavior), 0, fogFarAt(spawnD));
  const { act } = buildAct(kind, behavior, spawnD, 16 / 9, distance, seed);
  const rig = createRig();
  snapRig(rig, spawnD);
  const camera = new PerspectiveCamera(CAMERA_BASE.fov, 16 / 9, 0.1, CAMERA_FAR);
  const viewer = createViewer();
  const track = createTrack();
  const DT = 1 / 30;
  let d = spawnD;
  for (let t = 0; t < act.duration + 60; t += DT) {
    if (t > act.duration * when) d = Math.max(spawnD - back, d - 10 * DT);
    stepRig(rig, d, DT);
    placeCamera(camera, rig);
    const fogFar = fogFarAt(rig.d);
    updateViewer(viewer, camera, fogFar);
    trackAct(act, track, t, rig.d, DT, viewer);
    const why = retirement(act, track, t, rig.d, fogFar);
    if (why) return { why, seen: probeSeen(act, t, camera, rig.d) };
  }
  return { why: null, seen: false };
}

{
  const cases: [FaunaKind, BehaviorName, number][] = [
    ['garza', 'vadear', 150],
    ['garza', 'vadear', 470],
    ['tanuki', 'deambular', 620],
    ['gato', 'callejear', 620],
    ['ardilla', 'correrYParar', 470],
    ['ardilla', 'perseguir', 470],
    ['gorrion', 'visitaAlSuelo', 150],
    ['gorrion', 'bandada', 150],
    ['libelula', 'revolotear', 100],
    ['milano', 'planearEnCirculos', 470],
  ];
  let runs = 0;
  const safety: string[] = [];
  const vanished: string[] = [];
  const stuck: string[] = [];
  for (const [kind, behavior, spawnD] of cases) {
    for (const back of [40, 60, 100]) {
      for (const when of [0.3, 0.6, 0.9]) {
        for (let seed = 1; seed <= 4; seed += 1) {
          runs += 1;
          const { why, seen } = retreatRun(kind, behavior, spawnD, back, when, seed * 31 + back);
          const name = `${kind} (${behavior}) en d=${spawnD}, ${back} u atrás`;
          if (why === 'seguridad') safety.push(name);
          else if (why === null) stuck.push(name);
          if (seen) vanished.push(`${name}: ${why}`);
        }
      }
    }
  }
  check(
    `retrocediendo 40–100 u con fauna en cuadro, nada desaparece a la vista (${runs} casos)`,
    vanished.length === 0,
    vanished.slice(0, 3).join('; '),
  );
  check('…ni salta la red de seguridad', safety.length === 0, `${safety.length}: ${safety.slice(0, 3).join('; ')}`);
  check('…y todo acaba retirándose (nada se queda colgado un minuto)', stuck.length === 0, stuck.slice(0, 3).join('; '));
}

{
  // «Atrás» (o un enlace) a la estación anterior con un acto vivo: la cámara
  // viaja con la curva `piedra` y se queda un minuto. Lo que se queda lejos,
  // en la niebla, se retira; no ocupa el hueco ni se encoge a la vista.
  const cases: [FaunaKind, BehaviorName, Slug, Slug][] = [
    ['ardilla', 'correrYParar', 'fushimi-inari', 'eventos'],
    ['garza', 'vadear', 'kiyomizu-dera', 'fushimi-inari'],
    ['gato', 'callejear', 'gion', 'kiyomizu-dera'],
  ];
  const problems: string[] = [];
  let slowest = 0;
  for (const [kind, behavior, from, to] of cases) {
    for (let seed = 1; seed <= 3; seed += 1) {
      const fromD = depthOf(from);
      const toD = depthOf(to);
      const spec = speciesSpec(kind)!;
      const base = CAMERA_Z - lerp(spec.depth[0], spec.depth[1], 0.5);
      const distance = spawnDistance(base, faunaDistanceAt(fromD), spawnFloor(behavior), 0, fogFarAt(fromD));
      const { act } = buildAct(kind, behavior, fromD, 16 / 9, distance, seed);
      const rig = createRig();
      snapRig(rig, fromD);
      const camera = new PerspectiveCamera(CAMERA_BASE.fov, 16 / 9, 0.1, CAMERA_FAR);
      const viewer = createViewer();
      const track = createTrack();
      const DT = 1 / 30;
      const leaveAt = act.duration * 0.4;
      const seconds = travelDuration(fromD - toD);
      let outcome: string | null = null;
      for (let t = 0; t < act.duration + 60; t += DT) {
        const into = Math.min(1, Math.max(0, (t - leaveAt) / seconds));
        stepRig(rig, fromD + (toD - fromD) * piedra(into), DT);
        placeCamera(camera, rig);
        const fogFar = fogFarAt(rig.d);
        updateViewer(viewer, camera, fogFar);
        trackAct(act, track, t, rig.d, DT, viewer);
        const why = retirement(act, track, t, rig.d, fogFar);
        if (why) {
          const name = `${kind} de ${from} con la cámara en ${to}`;
          if (why === 'seguridad') problems.push(`${name}: red de seguridad`);
          if (probeSeen(act, t, camera, rig.d)) problems.push(`${name}: se retiró a la vista`);
          slowest = Math.max(slowest, t - (leaveAt + seconds));
          outcome = why;
          break;
        }
      }
      if (outcome === null) problems.push(`${kind} de ${from}: no se retiró en un minuto`);
    }
  }
  check(
    'con «atrás» a la estación anterior, lo que queda lejos se retira sin verse',
    problems.length === 0,
    problems.length > 0 ? problems.slice(0, 3).join('; ') : `el último, ${Math.max(0, slowest).toFixed(1)} s después de llegar`,
  );
}

{
  // Al llegar por un enlace la cámara aún frena (~11 u/s cuando el viaje se da
  // por terminado): hasta que se pare, no nace nada —si no, nacería con la
  // ventaja máxima, al doble de distancia—.
  const gionD = depthOf('gion');
  const frame = cameraAt(gionD, 16 / 9).rig.frame;
  const random = mulberry32(5);
  const memory = newMemory(0, random);
  const step = (velocity: number, traveling: boolean) =>
    advanceCasting({
      memory,
      acts: [],
      now: 60,
      idleFor: 0,
      cast: ['gato'],
      config: DIRECTOR,
      random,
      camera: { d: gionD, velocity, frame, aspect: 16 / 9, traveling },
      tracks: new Map(),
    }).spawned;
  const during = step(150, true);
  const braking = step(11, false);
  const settled = step(0.5, false);
  check(
    'tras un viaje no nace nada hasta que la cámara se para',
    during === null && braking === null && settled !== null,
  );
  const walking = step(6, false);
  check('…y después, caminando, vuelve a nacer con ventaja', walking === null || CAMERA_Z - walking.depth > 15);
}

/* ── Resumen ───────────────────────────────────────────────────────────── */

finish('La fauna, en orden.');
