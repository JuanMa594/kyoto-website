/**
 * Comprobaciones puras del camino (Fase 3A).
 *
 * Todo lo que se puede comprobar sin navegador —la forma del sendero, el
 * terreno, el encuadre de la cámara, las piedras, el scroll y el viaje— se
 * comprueba aquí, recorriendo el camino entero con paso fino. Lo que sólo se
 * ve en pantalla (que se sienta como caminar) es la revisión visual.
 *
 * Uso: bun run check:path
 */

import {
  createArrivalGate,
  passTramo,
  READING_DRIFT,
  scrollTargetDepth,
} from '../src/animation/journeyScroll';
import { cubicBezierEase } from '../src/animation/presets';
import { jumpOffset, travelDuration } from '../src/animation/travel';
import { JOURNEY, PATH_LENGTH } from '../src/config/journey';
import { CAMERA_BACK, createRig, RIG_LIMITS, stepRig } from '../src/scene/camera/pathRig';
import {
  dominantZone,
  pathX,
  pathY,
  STATION_DEPTHS,
  stationIndex,
  zoneWeight,
} from '../src/scene/path/journeyPath';
import { STONE_MEANDER, STONE_SINK, STONE_VARIANTS, stoneLayout } from '../src/scene/path/stones';
import {
  petalCountsAt,
  petalDrawCount,
  petalLayers,
  petalPresence,
  petalTotal,
} from '../src/scene/systems/petals';
import {
  CENTER_CLEAR,
  groundY,
  hillAmplitude,
  terrainHeight,
} from '../src/scene/systems/elevation';

const failures: string[] = [];
const DEG = Math.PI / 180;

function section(title: string): void {
  console.log(`\n— ${title}`);
}

function check(name: string, ok: boolean, detail = ''): void {
  const suffix = detail ? ` (${detail})` : '';
  console.log(`${ok ? '✓' : '✗'} ${name}${suffix}`);
  if (!ok) failures.push(name);
}

function range(from: number, to: number, step: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to + 1e-9; value += step) values.push(value);
  return values;
}

/** Pendiente del eje en `d`, por diferencia centrada. */
function slopeAt(d: number): number {
  return (pathX(d + 0.01) - pathX(d - 0.01)) / 0.02;
}

/* ── 1. El sendero ─────────────────────────────────────────────────────── */

section('El sendero');

check(
  'las estaciones avanzan siempre hacia el fondo',
  STATION_DEPTHS.every((d, i) => i === 0 || d > STATION_DEPTHS[i - 1]!),
);
check(
  'la Home está en 0 y Gastronomía en PATH_LENGTH',
  STATION_DEPTHS[0] === 0 && STATION_DEPTHS[STATION_DEPTHS.length - 1] === PATH_LENGTH,
);

const lateralJumps = JOURNEY.slice(1).map((station, i) =>
  Math.abs(station.environment.lateral - JOURNEY[i]!.environment.lateral),
);
check(
  '|Δlateral| ≤ 10 entre estaciones consecutivas',
  Math.max(...lateralJumps) <= 10,
  `máx ${Math.max(...lateralJumps)}`,
);

check(
  'el eje pasa por el lateral de cada estación',
  JOURNEY.every((station, i) => Math.abs(pathX(STATION_DEPTHS[i]!) - station.environment.lateral) < 1e-9),
);

const stationSlopes = STATION_DEPTHS.map((d) => Math.abs(slopeAt(d)));
check(
  'la tangente es nula en cada estación (vista frontal, de cartel)',
  Math.max(...stationSlopes) < 1e-3,
  `máx ${Math.max(...stationSlopes).toExponential(1)}`,
);

let steepest = 0;
for (const d of range(-50, PATH_LENGTH + 50, 0.25)) {
  steepest = Math.max(steepest, Math.atan(Math.abs(slopeAt(d))));
}
check('el rumbo del eje nunca pasa de 15°', steepest <= 15 * DEG, `máx ${(steepest / DEG).toFixed(1)}°`);

let worstSum = 0;
let outside = false;
for (const d of range(-50, PATH_LENGTH + 50, 0.5)) {
  let sum = 0;
  for (let i = 0; i < JOURNEY.length; i += 1) {
    const weight = zoneWeight(d, i);
    if (weight < 0 || weight > 1) outside = true;
    sum += weight;
  }
  worstSum = Math.max(worstSum, Math.abs(sum - 1));
}
check('los pesos de zona suman 1 en todo el camino', worstSum < 1e-9 && !outside);
check(
  'cada estación pesa 1 en su propio punto',
  JOURNEY.every((_, i) => Math.abs(zoneWeight(STATION_DEPTHS[i]!, i) - 1) < 1e-9),
);
check(
  'en cada estación domina ella misma',
  JOURNEY.every((_, i) => dominantZone(STATION_DEPTHS[i]!) === i),
);

let descends = false;
let previousY = pathY(-60);
for (const d of range(-60, PATH_LENGTH + 250, 0.5)) {
  const y = pathY(d);
  if (y < previousY - 1e-9) descends = true;
  previousY = y;
}
check('el camino nunca baja', !descends);
check('la Home está a ras (pathY(0) = 0)', Math.abs(pathY(0)) < 1e-9);

const fushimi = STATION_DEPTHS[stationIndex('fushimi-inari')]!;
const rise = pathY(fushimi + 11) - pathY(fushimi - 11);
check(
  'en Fushimi Inari el camino sube su slope (2,4) cada 22 unidades',
  Math.abs(rise - 2.4) < 0.05,
  `sube ${rise.toFixed(2)}`,
);

/* ── 2. El terreno ─────────────────────────────────────────────────────── */

section('El terreno');

let corridorWorst = 0;
for (const d of range(-60, PATH_LENGTH + 240, 1)) {
  for (const u of range(-CENTER_CLEAR, CENTER_CLEAR, 0.5)) {
    corridorWorst = Math.max(corridorWorst, Math.abs(terrainHeight(pathX(d) + u, -d) - pathY(d)));
  }
}
check(
  'el pasillo central (|u| ≤ 7) nunca tiene relieve, tampoco en las curvas',
  corridorWorst < 1e-9,
  `desvío máx ${corridorWorst.toExponential(1)}`,
);

const depthOf = (slug: Parameters<typeof stationIndex>[0]) => STATION_DEPTHS[stationIndex(slug)]!;
check(
  'Fushimi Inari levanta montaña a los dos lados',
  hillAmplitude(depthOf('fushimi-inari'), 'izquierda') === 9 &&
    hillAmplitude(depthOf('fushimi-inari'), 'derecha') === 9,
);
check(
  'Kiyomizu-dera sólo levanta relieve a la derecha',
  hillAmplitude(depthOf('kiyomizu-dera'), 'izquierda') === 0 &&
    hillAmplitude(depthOf('kiyomizu-dera'), 'derecha') === 9,
);
check(
  'Gastronomía es llana',
  hillAmplitude(depthOf('gastronomia'), 'izquierda') === 0 &&
    hillAmplitude(depthOf('gastronomia'), 'derecha') === 0,
);

let terrainStep = 0;
for (const d of range(-60, PATH_LENGTH + 240, 0.25)) {
  for (const u of [-40, -20, 20, 40]) {
    const x = pathX(d) + u;
    terrainStep = Math.max(terrainStep, Math.abs(terrainHeight(x, -d - 0.25) - terrainHeight(x, -d)));
  }
}
check(
  'el terreno no da escalones al pasar de una estación a otra',
  terrainStep < 1,
  `máx ${terrainStep.toFixed(3)} por cada 0,25 u`,
);

/* ── 3. La cámara ──────────────────────────────────────────────────────── */

section('La cámara');

interface RigRun {
  maxYaw: number;
  maxYawRate: number;
  minPitch: number;
  maxPitch: number;
  minClearance: number;
  maxDeviation: number;
}

/** Recorre el camino con el rig a 60 fps, siguiendo `depthAt(t)`. */
function simulate(depthAt: (t: number) => number, duration: number): RigRun {
  const rig = createRig();
  const dt = 1 / 60;
  const run: RigRun = {
    maxYaw: 0,
    maxYawRate: 0,
    minPitch: Infinity,
    maxPitch: -Infinity,
    minClearance: Infinity,
    maxDeviation: 0,
  };
  let previousYaw: number | null = null;

  for (let t = 0; t <= duration + 1e-9; t += dt) {
    stepRig(rig, depthAt(t), dt);
    if (previousYaw !== null) {
      run.maxYawRate = Math.max(run.maxYawRate, Math.abs(rig.yaw - previousYaw) / dt);
    }
    previousYaw = rig.yaw;

    const pitch = Math.atan2(rig.camera.y - rig.focus.y, CAMERA_BACK);
    run.maxYaw = Math.max(run.maxYaw, Math.abs(rig.yaw));
    run.minPitch = Math.min(run.minPitch, pitch);
    run.maxPitch = Math.max(run.maxPitch, pitch);
    run.minClearance = Math.min(run.minClearance, rig.camera.y - groundY(rig.camera.x, rig.camera.z));
    run.maxDeviation = Math.max(run.maxDeviation, Math.abs(rig.focus.x - pathX(rig.d)));
  }

  return run;
}

const piedra = cubicBezierEase(0.65, 0, 0.35, 1);
const TRAVEL_SECONDS = 4;

const runs: [string, RigRun, number][] = [
  ['scroll (16 u/s)', simulate((t) => 16 * t, PATH_LENGTH / 16), 0.6],
  ['viaje de ida (4 s)', simulate((t) => PATH_LENGTH * piedra(t / TRAVEL_SECONDS), TRAVEL_SECONDS), 6],
  ['viaje de vuelta (4 s)', simulate((t) => PATH_LENGTH * (1 - piedra(t / TRAVEL_SECONDS)), TRAVEL_SECONDS), 6],
];

const EPS = 1e-6;
for (const [name, run, deviationLimit] of runs) {
  check(`${name}: rumbo ≤ 15°`, run.maxYaw <= RIG_LIMITS.maxYaw + EPS, `máx ${(run.maxYaw / DEG).toFixed(1)}°`);
  check(
    `${name}: giro ≤ 12°/s`,
    run.maxYawRate <= RIG_LIMITS.maxYawRate + EPS,
    `máx ${(run.maxYawRate / DEG).toFixed(1)}°/s`,
  );
  check(
    `${name}: inclinación entre 3,5° y 8,7° (horizonte al 25–40 %)`,
    run.minPitch >= RIG_LIMITS.pitchMin - EPS && run.maxPitch <= RIG_LIMITS.pitchMax + EPS,
    `${(run.minPitch / DEG).toFixed(2)}° – ${(run.maxPitch / DEG).toFixed(2)}°`,
  );
  check(`${name}: la cámara nunca a menos de 3 u del suelo`, run.minClearance >= 3, `mín ${run.minClearance.toFixed(2)}`);
  check(
    `${name}: el punto de interés no se aparta del eje más de ${deviationLimit} u`,
    run.maxDeviation <= deviationLimit,
    `máx ${run.maxDeviation.toFixed(2)}`,
  );
}

/* ── 4. Piedras, scroll y viaje ────────────────────────────────────────── */

section('Las piedras');

const stones = stoneLayout();
check('unas 310 piedras en todo el recorrido', stones.length >= 290 && stones.length <= 330, `${stones.length}`);
check(
  'cubren de antes de la Home a después de Gastronomía',
  Math.max(...stones.map((s) => s.z)) >= 25 && Math.min(...stones.map((s) => s.z)) <= -(PATH_LENGTH + 15),
);
check('se usan las 12 formas', new Set(stones.map((s) => s.variant)).size === STONE_VARIANTS);
const worstLane = Math.max(...stones.map((s) => Math.abs(s.x - pathX(-s.z))));
check(
  'todas dentro del pasillo, serpenteando alrededor del eje',
  worstLane <= STONE_MEANDER + 0.3 && worstLane < CENTER_CLEAR,
  `máx ${worstLane.toFixed(2)} del eje`,
);
const worstRest = Math.max(...stones.map((s) => Math.abs(s.y + STONE_SINK * s.scale - groundY(s.x, s.z))));
check('todas apoyan en el terreno', worstRest < 1e-9);

section('El scroll');

const withNext = JOURNEY.slice(0, -1);
check(
  'al empezar una página la cámara está en su estación',
  withNext.every(
    (s, i) => scrollTargetDepth(s.slug, { station: s.slug, content: 0, tramo: 0 }) === STATION_DEPTHS[i],
  ),
);
check(
  `al terminar de leer avanzó ${READING_DRIFT} u`,
  withNext.every(
    (s, i) =>
      Math.abs(
        scrollTargetDepth(s.slug, { station: s.slug, content: 1, tramo: 0 }) - (STATION_DEPTHS[i]! + READING_DRIFT),
      ) < 1e-9,
  ),
);
check(
  'al terminar el tramo está exactamente en la siguiente estación',
  withNext.every(
    (s, i) =>
      Math.abs(scrollTargetDepth(s.slug, { station: s.slug, content: 1, tramo: 1 }) - STATION_DEPTHS[i + 1]!) <
      1e-9,
  ),
);
check(
  'el scroll de otra página no mueve la cámara',
  scrollTargetDepth('eventos', { station: 'gion', content: 1, tramo: 1 }) ===
    STATION_DEPTHS[stationIndex('eventos')],
);
check(
  'valores no finitos no llegan nunca a la cámara',
  scrollTargetDepth('eventos', {
    station: 'eventos',
    content: Number.NaN,
    tramo: Number.POSITIVE_INFINITY,
  }) === STATION_DEPTHS[stationIndex('eventos')],
);

section('La llegada');

/** Recorre el tramo con una lista de (progreso, dirección) y cuenta llegadas. */
function arrivals(steps: [number, 1 | -1][]): number {
  const gate = createArrivalGate();
  return steps.filter(([progress, direction]) => passTramo(gate, progress, direction)).length;
}

check(
  'recorrer el tramo hacia abajo hasta el final llega una vez',
  arrivals([
    [0.2, 1],
    [0.6, 1],
    [0.95, 1],
    [1, 1],
    [1, 1],
  ]) === 1,
);
check(
  'una página que aparece ya al fondo (scroll restaurado, «atrás») no llega',
  arrivals([
    [1, 1],
    [1, 1],
  ]) === 0,
);
check(
  'subir hasta el final no llega',
  arrivals([
    [0.5, 1],
    [1, -1],
  ]) === 0,
);
check(
  'quedarse a medio tramo no llega',
  arrivals([
    [0.3, 1],
    [0.9, 1],
    [0.5, -1],
  ]) === 0,
);

section('El viaje');

check(
  'una estación de viaje dura ~1,8 s',
  Math.abs(travelDuration(66.7) - 1.8) < 0.05,
  `${travelDuration(66.7).toFixed(2)} s`,
);
check('el camino entero dura 4 s', travelDuration(PATH_LENGTH) === 4, `${travelDuration(PATH_LENGTH)} s`);
check(
  'un salto corto no se hace eterno',
  travelDuration(5) >= 0.6 && travelDuration(5) < 1,
  `${travelDuration(5).toFixed(2)} s`,
);

// La cámara está en objetivo + desfase. Un salto del objetivo se absorbe en el
// desfase, así que la posición no cambia en ese frame —tampoco si el salto
// llega en mitad de otro viaje.
const cameraBefore = 100 + 0;
const offsetAfter = jumpOffset(0, 100, 300);
check('un salto del objetivo no mueve la cámara', 300 + offsetAfter === cameraBefore);
const midTravel = 300 + -120;
const offsetAgain = jumpOffset(-120, 300, 50);
check('un segundo salto en pleno viaje tampoco', 50 + offsetAgain === midTravel);

/* ── 5. Los pétalos entre zonas ────────────────────────────────────────── */

section('Los pétalos');

const eventos = JOURNEY[stationIndex('eventos')]!;
const frontLayer = petalLayers()[0]!;
check('una zona con peso 0 no dibuja nada', petalDrawCount(frontLayer, eventos, 1, 0, 0) === 0);
check(
  'a mitad de peso, la mitad de presencia',
  Math.abs(petalPresence(eventos, 0, 0.5) - petalPresence(eventos, 0) / 2) < 1e-12,
);
check(
  'en el punto de una estación se ve exactamente su lluvia',
  petalCountsAt(STATION_DEPTHS[stationIndex('eventos')]!, 1, 0).total === petalTotal(eventos, 1, 0),
);
// Un corte entre zonas sería un salto de cientos de pétalos en un paso; el
// fundido más empinado (de nada a los 300 de la sakura en 32 u) da ~1,5 por
// cada 0,1 u, más el redondeo de cada capa.
let petalJump = 0;
let previousPetals = petalCountsAt(-10, 1, 0).total;
for (const d of range(-10, PATH_LENGTH + 10, 0.1)) {
  const now = petalCountsAt(d, 1, 0).total;
  petalJump = Math.max(petalJump, Math.abs(now - previousPetals));
  previousPetals = now;
}
check('la lluvia se funde entre zonas, sin saltos', petalJump <= 6, `máx ${petalJump} pétalos por 0,1 u`);

/* ── Resumen ───────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} comprobación(es) fallaron.`);
  process.exit(1);
}

console.log('\n✓ Todo el camino en orden.');
