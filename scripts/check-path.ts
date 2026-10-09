/**
 * Comprobaciones puras del camino (Fase 3A). La fauna tiene las suyas en check-fauna.ts.
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
  readingProgress,
  scrollTargetDepth,
  tramoCardOpacity,
  tramoFraction,
  tramoHeightVh,
  tramoSignOpacity,
  tramoWalkVh,
  walkEase,
} from '../src/animation/journeyScroll';
import { cubicBezierEase } from '../src/animation/presets';
import { jumpOffset, travelDuration } from '../src/animation/travel';
import { JOURNEY, PATH_LENGTH } from '../src/config/journey';
import messagesEn from '../src/messages/en.json';
import messagesEs from '../src/messages/es.json';
import { CAMERA_BASE } from '../src/scene/camera/framing';
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
import { check, finish, range, section } from './check-kit';

const DEG = Math.PI / 180;

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
  '|Δlateral| ≤ 20 entre estaciones consecutivas',
  Math.max(...lateralJumps) <= 20,
  `máx ${Math.max(...lateralJumps)}`,
);
const gaps = STATION_DEPTHS.slice(1).map((d, i) => d - STATION_DEPTHS[i]!);
check('de la Home a Ubicación, medio tramo (60–70 u)', gaps[0]! >= 60 && gaps[0]! <= 70, `${gaps[0]} u`);
// Sin contar el llano con que puede empezar un tramo: lo que hay después es
// el tramo de siempre.
const curved = gaps.map((gap, i) => gap - (JOURNEY[i]!.tramo.flat ?? 0));
check(
  'entre las demás estaciones hay espacio para caminar y leer (120–150 u)',
  curved.slice(1).every((gap) => gap >= 120 && gap <= 150),
  curved.slice(1).join(' · '),
);

const eventosAt = STATION_DEPTHS[stationIndex('eventos')]!;
const eventosFlat = JOURNEY[stationIndex('eventos')]!.tramo.flat ?? 0;
check('al salir de Eventos hay un llano de 40–60 u antes de la subida', eventosFlat >= 40 && eventosFlat <= 60, `${eventosFlat} u`);
let flatWorst = 0;
for (const d of range(eventosAt, eventosAt + eventosFlat, 0.5)) {
  flatWorst = Math.max(flatWorst, Math.abs(pathY(d)), Math.abs(pathX(d) - pathX(eventosAt)));
}
check('ese llano es llano y recto', flatWorst < 1e-9);
check(
  'la subida a Fushimi conserva su largo (144 u después del llano)',
  STATION_DEPTHS[stationIndex('fushimi-inari')]! - eventosAt - eventosFlat === 144,
);
check(
  'en ese llano sigue siendo la sakura (pesa 1 la zona de Eventos)',
  range(eventosAt, eventosAt + eventosFlat, 1).every((d) => zoneWeight(d, stationIndex('eventos')) === 1),
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

check(
  'el camino pasa por la altura de cada estación',
  JOURNEY.every((station, i) => Math.abs(pathY(STATION_DEPTHS[i]!) - station.environment.altitude) < 1e-9),
);
const gradeAt = (d: number) => (pathY(d + 0.01) - pathY(d - 0.01)) / 0.02;
check(
  'en cada estación el camino está llano (vista frontal)',
  STATION_DEPTHS.every((d) => Math.abs(gradeAt(d)) < 1e-3),
);

/** La cuesta más empinada de un tramo, en grados (con signo: + sube, − baja). */
function steepestIn(from: Parameters<typeof stationIndex>[0], to: Parameters<typeof stationIndex>[0]): number {
  let steepestGrade = 0;
  // Sólo dentro del tramo: en sus extremos la diferencia centrada toca el
  // tramo vecino.
  for (const d of range(STATION_DEPTHS[stationIndex(from)]! + 0.5, STATION_DEPTHS[stationIndex(to)]! - 0.5, 0.5)) {
    const grade = gradeAt(d);
    if (Math.abs(grade) > Math.abs(steepestGrade)) steepestGrade = grade;
  }
  return Math.atan(steepestGrade) / DEG;
}

const climb = steepestIn('eventos', 'fushimi-inari');
check('la subida a Fushimi Inari es más marcada que antes (> 6°)', climb > 6, `${climb.toFixed(1)}°`);
const descent = steepestIn('kiyomizu-dera', 'gion');
check('de Kiyomizu-dera a Gion el camino baja', descent < -2, `${descent.toFixed(1)}°`);
const lastStretch = steepestIn('gion', 'gastronomia');
check('de Gion a Gastronomía es llano', Math.abs(lastStretch) < 1e-6, `${lastStretch.toFixed(2)}°`);

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
const wholeTrip = travelDuration(PATH_LENGTH);
const fromEventos = STATION_DEPTHS[stationIndex('eventos')]!;
const toFushimi = STATION_DEPTHS[stationIndex('fushimi-inari')]!;
const shortTrip = travelDuration(toFushimi - fromEventos);
const trip = (from: number, to: number, seconds: number) => (t: number) =>
  from + (to - from) * piedra(Math.min(1, t / seconds));

// En el viaje largo (de punta a punta, ~350 u/s en el pico) seguir cada curva
// sería un zarandeo: el encuadre las recorta. Lo que se exige ahí es que el eje
// del camino no salga nunca del cuadro a 16:9, con margen: el 80 % del medio
// ancho visible a la distancia del punto de interés.
const inFrame = 0.8 * Math.tan((CAMERA_BASE.fov * Math.PI) / 360) * CAMERA_BACK * (16 / 9);

const runs: [string, RigRun, number][] = [
  ['scroll (16 u/s)', simulate((t) => 16 * t, PATH_LENGTH / 16), 0.6],
  [`viaje de ida (${wholeTrip.toFixed(1)} s)`, simulate(trip(0, PATH_LENGTH, wholeTrip), wholeTrip), inFrame],
  [`viaje de vuelta (${wholeTrip.toFixed(1)} s)`, simulate(trip(PATH_LENGTH, 0, wholeTrip), wholeTrip), inFrame],
  [
    `una estación, la subida a Fushimi (${shortTrip.toFixed(1)} s)`,
    simulate(trip(fromEventos, toFushimi, shortTrip), shortTrip),
    6,
  ],
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
    `${name}: el punto de interés no se aparta del eje más de ${deviationLimit.toFixed(1)} u`,
    run.maxDeviation <= deviationLimit,
    `máx ${run.maxDeviation.toFixed(2)}`,
  );
}

/* ── 4. Piedras, scroll y viaje ────────────────────────────────────────── */

section('Las piedras');

const stones = stoneLayout();
// Una piedra cada ~1,45 u, de 30 u antes de la Home a 20 u después de Gastronomía.
const expectedStones = (PATH_LENGTH + 50) / 1.45;
check(
  'una piedra cada ~1,45 u en todo el recorrido',
  Math.abs(stones.length - expectedStones) <= expectedStones * 0.03,
  `${stones.length}`,
);
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

// Al empezar a bajar, la cámara arranca suave: ningún golpe de rueda avanza
// mucho más que el siguiente. Con el contenido corto de hoy (96 px antes de que
// asome el tramo en una pantalla de 739) el desvío de lectura entero cabía en
// el primer golpe: 4 u de golpe y luego casi parada, porque el tramo arranca
// desde cero.
{
  const VIEWPORT = 739;
  const WHEEL = 100;
  let worst = '';
  for (const contentPx of [0, 96, 300, 739, 3000]) {
    for (const station of withNext) {
      const walkVh = tramoWalkVh(station.slug);
      const cards = station.tramo?.cards.length ?? 0;
      const tramoPx = (tramoHeightVh(cards, walkVh) / 100) * VIEWPORT;
      const depthAt = (y: number) =>
        scrollTargetDepth(station.slug, {
          station: station.slug,
          content: readingProgress(Math.min(y, contentPx), contentPx, VIEWPORT),
          tramo: tramoFraction(Math.max(0, y - contentPx) / tramoPx, cards, walkVh),
        });
      const ticks = Array.from({ length: 6 }, (_, k) => depthAt((k + 1) * WHEEL) - depthAt(k * WHEEL));
      for (let k = 0; k + 1 < ticks.length; k += 1) {
        if (ticks[k]! > 2 * ticks[k + 1]! + 0.1 && !worst) {
          worst = `${station.slug} con ${contentPx} px de contenido: golpe ${k + 1} avanza ${ticks[k]!.toFixed(2)} u y el siguiente ${ticks[k + 1]!.toFixed(2)} u`;
        }
      }
    }
  }
  check('al empezar a bajar no hay tirón: ningún golpe de rueda avanza mucho más que el siguiente', !worst, worst);
}

section('El tramo');

check('sin tarjetas el tramo mide 440vh', tramoHeightVh(0) === 440);
check('cada tarjeta suma 80vh', tramoHeightVh(3) === 680);
check(
  'sin tarjetas el avance es la curva del tramo (power2.inOut)',
  range(0, 1, 0.01).every((p) => Math.abs(tramoFraction(p, 0) - walkEase(p)) < 1e-12),
);

for (const cards of [1, 2, 3]) {
  const height = tramoHeightVh(cards);
  const steps = range(0, 1, 0.0005);
  const fractions = steps.map((p) => tramoFraction(p, cards));
  check(
    `${cards} tarjeta(s): empieza en la estación, termina en la siguiente y nunca retrocede`,
    fractions[0] === 0 &&
      Math.abs(fractions[fractions.length - 1]! - 1) < 1e-12 &&
      fractions.every((f, i) => i === 0 || f >= fractions[i - 1]! - 1e-12),
  );

  // Dónde está cada parada, en vh: el caminar se reparte en cards + 1 trechos.
  const walk = 440 / (cards + 1);
  let worstDrift = 0;
  let worstVisible = 0;
  let worstOverlap = 0;
  for (let k = 0; k < cards; k += 1) {
    const stopStart = (k + 1) * walk + k * 80;
    const fromP = stopStart / height;
    const toP = (stopStart + 80) / height;
    worstDrift = Math.max(worstDrift, tramoFraction(toP, cards) - tramoFraction(fromP, cards));
    worstVisible = Math.max(worstVisible, 1 - tramoCardOpacity((stopStart + 40) / height, cards, k));
  }
  for (const p of steps) {
    let total = 0;
    for (let k = 0; k < cards; k += 1) total += tramoCardOpacity(p, cards, k);
    worstOverlap = Math.max(worstOverlap, total);
  }
  check(`${cards} tarjeta(s): en cada parada la cámara casi se detiene (≤ 1 %)`, worstDrift <= 0.01, `${(worstDrift * 100).toFixed(2)} %`);
  check(`${cards} tarjeta(s): en el centro de su parada cada tarjeta se ve entera`, worstVisible < 1e-9);
  check(`${cards} tarjeta(s): nunca se ven dos tarjetas a la vez`, worstOverlap <= 1 + 1e-9, `máx ${worstOverlap.toFixed(2)}`);

  const middleOfWalk = (walk / 2) / height;
  check(
    `${cards} tarjeta(s): a mitad de un trecho no hay ninguna tarjeta`,
    Array.from({ length: cards }, (_, k) => tramoCardOpacity(middleOfWalk, cards, k)).every((o) => o === 0),
  );

  // Caminando, la cámara va a la misma velocidad que sin tarjetas.
  const walked = tramoFraction(walk / height, cards);
  const speedRatio = walked / walk / (1 / 440);
  check(`${cards} tarjeta(s): caminando, la misma velocidad que sin tarjetas (±5 %)`, Math.abs(speedRatio - 1) <= 0.05, `×${speedRatio.toFixed(3)}`);

  const lastStopEnd = cards * walk + cards * 80;
  check(
    `${cards} tarjeta(s): el cartel de la siguiente estación sale después de la última tarjeta`,
    tramoSignOpacity(lastStopEnd / height, cards) === 0 && tramoSignOpacity(1, cards) === 1,
  );
}

// El caminar de cada tramo sale de su distancia: la cámara avanza igual de
// rápido en todos, y el de la Home, que es la mitad de largo, dura la mitad.
const walkSpeeds = JOURNEY.slice(0, -1).map((s, i) => gaps[i]! / tramoWalkVh(s.slug));
check(
  'la cámara camina igual de rápido en todos los tramos (±2 %)',
  Math.max(...walkSpeeds) / Math.min(...walkSpeeds) <= 1.02,
  walkSpeeds.map((v) => v.toFixed(3)).join(' · '),
);
check(
  'el tramo de la Home mide la mitad que el siguiente (±10 %)',
  Math.abs(tramoWalkVh('inicio') / tramoWalkVh('ubicacion') - 0.5) <= 0.05,
  `${tramoWalkVh('inicio')}vh / ${tramoWalkVh('ubicacion')}vh`,
);
check(
  'el alto de un tramo es su caminar más sus paradas',
  tramoHeightVh(3, tramoWalkVh('ubicacion')) === tramoWalkVh('ubicacion') + 3 * 80,
);

const ubicacion = JOURNEY[stationIndex('ubicacion')]!;
check('el tramo de Ubicación lleva sus tres tarjetas provisionales', ubicacion.tramo.cards.length === 3);
const inicio = JOURNEY[stationIndex('inicio')]!;
check('el tramo de la Home lleva la tarjeta de bienvenida', inicio.tramo.cards.some((card) => card.id === 'bienvenida'));

// Las claves de las tarjetas se arman con la estación y el id de `journey.ts`,
// y el tipo de next-intl no puede seguirlas: lo que no comprueba el compilador
// se comprueba aquí, en los dos idiomas.
type Messages = { tramos?: Record<string, Record<string, { title?: string; body?: string }>> };
const missingTexts: string[] = [];
for (const [lang, messages] of [['es', messagesEs], ['en', messagesEn]] as [string, Messages][]) {
  for (const station of JOURNEY) {
    for (const card of station.tramo.cards) {
      const text = messages.tramos?.[station.slug]?.[card.id];
      if (!text?.title || !text.body) missingTexts.push(`${lang}:${station.slug}.${card.id}`);
    }
  }
}
check(
  'cada tarjeta de tramo tiene título y texto en español y en inglés',
  missingTexts.length === 0,
  missingTexts.join(', '),
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

const oneStation = PATH_LENGTH / (JOURNEY.length - 1);
check(
  'una estación de viaje dura ~1,8 s',
  Math.abs(travelDuration(oneStation) - 1.8) < 0.05,
  `${travelDuration(oneStation).toFixed(2)} s`,
);
check(
  'ningún viaje pasa de 160 u/s de media (el camino entero va justo al tope)',
  [0.5, 1, 2, 3, 4, 6].every((stations) => {
    const distance = stations * oneStation;
    return distance / travelDuration(distance) <= 160 + 1e-9;
  }) && Math.abs(travelDuration(PATH_LENGTH) - PATH_LENGTH / 160) < 1e-9,
  `${travelDuration(PATH_LENGTH).toFixed(2)} s`,
);
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

finish('Todo el camino en orden.');
