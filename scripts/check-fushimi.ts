/**
 * Comprobaciones puras de Fushimi Inari (Fase 6A): las paradas con llano, los
 * rellanos y las gradas de la subida, las galerías de toriis, el bambú de
 * arriba, las ema, la explanada, el rōmon, el paneo y el kitsune. Las de la
 * decoración en general (piedras, cámara, fauna) siguen en check-decor.ts y
 * cubren también lo de aquí.
 *
 * Uso: bun run check:path (corre la última)
 */

import {
  cardStopD,
  stationTrechos,
  tramoCardOpacity,
  tramoFraction,
  tramoHeightVh,
  tramoWalkVh,
  scrollTargetDepth,
  TRAMO_STOP_VH,
} from '../src/animation/journeyScroll';
import { PerspectiveCamera, Vector3 } from 'three';

import { cubicBezierEase } from '../src/animation/presets';
import { travelDuration } from '../src/animation/travel';
import { BLOCK_PX, BODY_PX } from '../src/components/sections/kosatsuFit';
import { GALLERY_SPACING, getStation, JOURNEY } from '../src/config/journey';
import { damp, mulberry32 } from '../src/lib/procedural';
import messagesEn from '../src/messages/en.json';
import messagesEs from '../src/messages/es.json';
import { PAN_YAW, stepPan } from '../src/scene/camera/pan';
import { CAMERA_BACK, createRig, RIG_LIMITS, snapRig, stepRig } from '../src/scene/camera/pathRig';
import { decorFootprints, insideFootprint } from '../src/scene/decor/footprints';
import {
  CAMERA_CLEARANCE,
  GALLERY_FREE_AFTER,
  GALLERY_FREE_BEFORE,
  GALLERY_RAMP,
  GALLERY_REVEAL,
  galleryDepths,
  galleryPillars,
  LIFT_SLOPE,
  TORII_FADE_SPEED,
} from '../src/scene/decor/gallery';
import { objectToWorld, stationDecorLayout } from '../src/scene/decor/placement';
import { emaWriting } from '../src/scene/objects/ema/ema';
import { ROMON, ROMON_FOXES, ROMON_HEIGHT } from '../src/scene/objects/romon/romon';
import { INARI, INARI_NUKI_BOTTOM, inariLift } from '../src/scene/objects/torii/inari';
import { dominantZone, pathX, pathY, STATION_DEPTHS, stationIndex, tramoLandings } from '../src/scene/path/journeyPath';
import { komorebiAt } from '../src/scene/shaders/komorebi';
import { speciesSpec } from '../src/scene/systems/fauna/bestiary';
import { clearOfDecor, createAct, DECOR_RETRIES, type CameraState } from '../src/scene/systems/fauna/casting';

import { STAIR_HALF, stairTop, stairWalk, tramoFlight, treadHeight } from '../src/scene/path/stairs';
import { STAIR_STONE_MARGIN, stoneExtents, stoneLayout } from '../src/scene/path/stones';
import { GROUND_Y, groundY, terrainY } from '../src/scene/systems/elevation';
import { check, finish, range, section } from './check-kit';

const DEG = Math.PI / 180;
const EVENTOS = 'eventos' as const;
const EV = stationIndex(EVENTOS);
const FUSHIMI = stationIndex('fushimi-inari');
const eventosD = STATION_DEPTHS[EV]!;
const fushimiD = STATION_DEPTHS[FUSHIMI]!;
const flatEnd = eventosD + (getStation(EVENTOS).tramo.flat ?? 0);

/* ── 1. Las paradas ────────────────────────────────────────────────────── */

section('Las paradas de la subida');

const cards = getStation(EVENTOS).tramo.cards;
const stops = cards.map((_, i) => cardStopD(EVENTOS, i));
check('el tramo de Eventos lleva tres ema', cards.length === 3 && cards.every((c) => c.sign?.board === 'ema'));
check(
  'ninguna parada cae en el llano de los cerezos',
  stops.every((d) => d > flatEnd + 10),
  stops.map((d) => d.toFixed(1)).join(' · '),
);
check(
  'las paradas se reparten por igual sobre la subida (±1 u)',
  (() => {
    const gaps = [stops[0]! - flatEnd, stops[1]! - stops[0]!, stops[2]! - stops[1]!, fushimiD - stops[2]!];
    return Math.max(...gaps) - Math.min(...gaps) < 4;
  })(),
);
{
  const walkVh = tramoWalkVh(EVENTOS);
  const shares = stationTrechos(EVENTOS);
  const n = cards.length;
  const height = tramoHeightVh(n, walkVh);
  // Caminar va igual de rápido en cada trecho: u por vh, comparadas.
  const speeds: number[] = [];
  let cursor = 0;
  for (let k = 0; k <= n; k += 1) {
    const walk = (walkVh * shares[k]!) / shares.reduce((a, b) => a + b, 0);
    const a = scrollTargetDepth(EVENTOS, { station: EVENTOS, content: 1, tramo: tramoFraction(cursor / height, n, walkVh, shares) });
    const b = scrollTargetDepth(EVENTOS, {
      station: EVENTOS,
      content: 1,
      tramo: tramoFraction((cursor + walk) / height, n, walkVh, shares),
    });
    speeds.push((b - a) / walk);
    cursor += walk + TRAMO_STOP_VH;
  }
  check(
    'caminando, la cámara va igual de rápido en el llano y en cada trecho de la subida (±5 %)',
    Math.max(...speeds) / Math.min(...speeds) <= 1.05,
    speeds.map((s) => s.toFixed(3)).join(' · '),
  );
  // Cada parada, en mitad de su lectura, es la d de su ema.
  cursor = 0;
  const mids: number[] = [];
  for (let k = 0; k < n; k += 1) {
    cursor += (walkVh * shares[k]!) / shares.reduce((a, b) => a + b, 0);
    mids.push((cursor + TRAMO_STOP_VH / 2) / height);
    cursor += TRAMO_STOP_VH;
  }
  check(
    'cada parada es la profundidad del scroll en mitad de su lectura',
    mids.every((p, i) => {
      const d = scrollTargetDepth(EVENTOS, { station: EVENTOS, content: 1, tramo: tramoFraction(p, n, walkVh, shares) });
      return Math.abs(d - stops[i]!) < 0.05 && tramoCardOpacity(p, n, i, walkVh, shares) === 1;
    }),
  );
}

/* ── 2. Los rellanos ───────────────────────────────────────────────────── */

section('Los rellanos');

const landings = tramoLandings(EV);
check('un rellano por ema', landings.length === cards.length);
const gradeAt = (d: number) => (pathY(d + 0.02) - pathY(d - 0.02)) / 0.04;
check(
  'cada rellano es llano (< 1 %)',
  landings.every((l) => range(l.from, l.to, 0.25).every((d) => Math.abs(gradeAt(d)) < 0.01)),
);
check('cada parada cae en su rellano', stops.every((d, i) => d >= landings[i]!.from && d <= landings[i]!.to));
let steepest = 0;
let previousGrade = gradeAt(flatEnd);
let gradeJump = 0;
for (const d of range(flatEnd, fushimiD, 0.05)) {
  const grade = gradeAt(d);
  steepest = Math.max(steepest, Math.atan(grade));
  gradeJump = Math.max(gradeJump, Math.abs(grade - previousGrade));
  previousGrade = grade;
}
check('la subida no pasa de 12°', steepest <= 12 * DEG, `${(steepest / DEG).toFixed(1)}°`);
check('la pendiente no da saltos al entrar o salir de un rellano', gradeJump < 0.01, gradeJump.toFixed(4));
check(
  'llega exacta a la altura de Fushimi y empieza en la de Eventos',
  Math.abs(pathY(fushimiD) - getStation('fushimi-inari').environment.altitude) < 1e-9 && Math.abs(pathY(flatEnd)) < 1e-9,
);
check(
  'los demás tramos no tienen rellanos',
  JOURNEY.every((_, i) => i === EV || tramoLandings(i).length === 0),
);

/* ── 3. Las gradas ─────────────────────────────────────────────────────── */

section('Las gradas');

const flight = tramoFlight(EV)!;
check('la subida de Eventos tiene gradas', flight !== null && flight.steps.length > 20, `${flight?.steps.length ?? 0} huellas`);
check('sólo ella', JOURNEY.every((_, i) => i === EV || tramoFlight(i) === null));
const riser = getStation(EVENTOS).tramo.stairs!.riser;
check(
  'cada contrahuella sube lo mismo',
  flight.steps.every((s, k) => Math.abs(s.y - (k === 0 ? flight.base : flight.steps[k - 1]!.y) - riser) < 1e-9),
);
check(
  'monótonas y dentro del tramo',
  flight.steps.every((s, k) => s.d > flatEnd && s.d <= fushimiD && (k === 0 || s.d > flight.steps[k - 1]!.d)),
);
check(
  'la huella nunca queda por debajo de la ladera, ni más de una contrahuella por encima',
  range(flatEnd, fushimiD - 0.05, 0.1).every((d) => {
    const tread = treadHeight(d)!;
    return tread >= pathY(d) - 1e-9 && tread - pathY(d) < riser + 1e-9;
  }),
);
check(
  'arriba, la última huella es la explanada: a la altura de Fushimi',
  Math.abs(flight.steps[flight.steps.length - 1]!.y - pathY(fushimiD)) < 1e-9,
);
const shortest = Math.min(...flight.steps.map((s, k) => (flight.steps[k + 1]?.d ?? fushimiD) - s.d));
check('ninguna huella más corta que 1,6 u', shortest >= 1.6, shortest.toFixed(2));
check(
  'en el pasillo el suelo es la grada; fuera, la ladera',
  range(flatEnd + 1, fushimiD - 1, 0.5).every((d) => {
    const z = -d;
    const axis = groundY(pathX(d), z);
    const out = groundY(pathX(d) + 5, z);
    return Math.abs(axis - (GROUND_Y + treadHeight(d)!)) < 1e-9 && Math.abs(out - terrainY(pathX(d) + 5, z)) < 1e-9;
  }),
);
check(
  'fuera de la subida no cambia nada',
  range(-50, 800, 0.5).every((d) => (d >= flatEnd && d <= fushimiD) || stairTop(pathX(d), -d) === Number.NEGATIVE_INFINITY),
);
check(
  'la fauna sube cada contrahuella por una rampa: nunca por debajo de la grada ni a saltos',
  (() => {
    let previous = stairWalk(pathX(flatEnd + 0.01), -(flatEnd + 0.01));
    for (const d of range(flatEnd + 0.01, fushimiD - 0.01, 0.01)) {
      const walk = stairWalk(pathX(d), -d);
      const top = stairTop(pathX(d), -d);
      if (walk < top - 1e-9 || Math.abs(walk - previous) > 0.06) return false;
      previous = walk;
    }
    return true;
  })(),
);

// La cámara sube lisa: su altura sigue la ladera, no los escalones.
{
  const rig = createRig();
  let worst = 0;
  let previous: number | null = null;
  for (const d of range(flatEnd - 10, fushimiD + 10, 0.05)) {
    snapRig(rig, d);
    if (previous !== null) worst = Math.max(worst, Math.abs(rig.camera.y - previous));
    previous = rig.camera.y;
  }
  check('la cámara sube lisa: ningún salto de altura (≤ 0,02 u cada 0,05 u)', worst <= 0.02, worst.toFixed(4));
}

/* ── 4. Las piedras de las gradas ──────────────────────────────────────── */

section('Las piedras de las gradas');

const climbStones = stoneLayout().filter((s) => !s.flatten && -s.z >= flight.steps[0]!.d - 0.2 && -s.z <= fushimiD);
let onEdge = 0;
let offAxis = 0;
for (const stone of climbStones) {
  const d = -stone.z;
  const extent = stoneExtents(stone.variant);
  // La mitad del lado corto, que va a lo largo del camino.
  const half = Math.min(extent.x, extent.z) * stone.scale;
  const nearest = Math.min(...flight.steps.map((s) => Math.abs(s.d - d)), Math.abs(fushimiD - d));
  if (nearest < half + STAIR_STONE_MARGIN * 0.5) onEdge += 1;
  if (Math.abs(stone.x - pathX(d)) > 0.5) offAxis += 1;
}
check('hay una piedra por huella, al menos', climbStones.length >= flight.steps.length, `${climbStones.length} piedras`);
check('ninguna sobre el canto de una contrahuella', onEdge === 0, `${onEdge}`);
check('todas por el eje (≤ 0,5 u), sin serpentear', offAxis === 0, `${offAxis}`);
check(
  'todas dentro de la huella llana',
  climbStones.every((s) => Math.abs(s.x - pathX(-s.z)) + 0.6 < STAIR_HALF),
);

/* ── 5. Las galerías ───────────────────────────────────────────────────── */

section('Las galerías de toriis');

const evLayout = stationDecorLayout(EV, false);
const galleries = evLayout.galleries;
const variants = galleries.map((g) => g.item.variant).join(' / ');
check('cuatro galerías: abierta / densa / abierta / densa', variants === 'abierta / densa / abierta / densa', variants);
check('igual en vertical', stationDecorLayout(EV, true).galleries.length === galleries.length);
const gapsOf = (g: (typeof galleries)[number]) => g.toriis.slice(1).map((t, k) => t.d - g.toriis[k]!.d);
const lastGallery = galleries[galleries.length - 1]!;
for (const g of galleries) {
  const gaps = gapsOf(g);
  const ramp = GALLERY_RAMP - 1;
  const inner = g.item.variant === 'densa' ? gaps.slice(ramp, gaps.length - (g === lastGallery ? 0 : ramp)) : gaps;
  const target = GALLERY_SPACING[g.item.variant];
  const label = `${g.item.variant} ${g.from.toFixed(0)}–${g.to.toFixed(0)} (${g.toriis.length} toriis)`;
  check(
    `${label}: a su separación (${target} u, hasta un 25 % más)`,
    inner.length > 0 && inner.every((gap) => gap >= target - 1e-9 && gap <= target * 1.25),
    inner.map((gap) => gap.toFixed(2)).slice(0, 4).join(' · '),
  );
  const air = Math.min(...gaps) - 2 * INARI.pillarRadius[0];
  check(`${label}: entre pilar y pilar queda aire (≥ 0,25 u)`, air >= 0.25, air.toFixed(2));
  if (g.item.variant === 'densa') {
    check(`${label}: se abre en su entrada, paso a paso`, gaps[0]! > gaps[1]! && gaps[1]! > gaps[2]!);
  }
}
const lastGaps = gapsOf(lastGallery);
check(
  'la última, densa, termina de golpe en la explanada (sin abrirse al final)',
  lastGallery.item.variant === 'densa' &&
    Math.abs(lastGaps[lastGaps.length - 1]! - GALLERY_SPACING.densa) < GALLERY_SPACING.densa * 0.2,
);
check(
  'y termina 5 u por delante de la cámara de Fushimi',
  Math.abs(lastGallery.to - (fushimiD - CAMERA_BACK + GALLERY_REVEAL)) < 1e-6,
  lastGallery.to.toFixed(1),
);
check(
  'ningún torii en la zona libre de una parada (lo que tapa su ema)',
  stops.every((stop) =>
    galleries.every((g) =>
      g.toriis.every((t) => t.d < stop - GALLERY_FREE_BEFORE + 1e-6 || t.d > stop + GALLERY_FREE_AFTER - 1e-6),
    ),
  ),
);
{
  // El mando: con las densas más abiertas, salen menos toriis y a su nueva separación.
  const before = GALLERY_SPACING.densa;
  const g = galleries[1]!;
  const tight = galleryDepths('densa', g.from, g.to).length;
  GALLERY_SPACING.densa = 1.2;
  const loose = galleryDepths('densa', g.from, g.to);
  const looseGaps = loose
    .slice(1)
    .map((d, k) => d - loose[k]!)
    .slice(GALLERY_RAMP - 1, -(GALLERY_RAMP - 1));
  GALLERY_SPACING.densa = before;
  check(
    'el mando de las densas: con 1,2 u salen menos toriis, a 1,2 u',
    loose.length < tight && looseGaps.every((gap) => gap >= 1.2 - 1e-9 && gap <= 1.2 * 1.15),
    `${tight} → ${loose.length}`,
  );
}

// La cámara pasa por debajo: el nuki, 1,5 u por encima de ella.
{
  const rig = createRig();
  let worst = Number.POSITIVE_INFINITY;
  let where = '';
  for (const g of galleries) {
    for (const t of g.toriis) {
      const nuki = t.y + inariLift(INARI_NUKI_BOTTOM, t.lift);
      for (let focus = t.d + CAMERA_BACK - 3; focus <= t.d + CAMERA_BACK + 3; focus += 0.1) {
        snapRig(rig, focus);
        if (Math.abs(-rig.camera.z - t.d) > 0.6) continue;
        const room = nuki - rig.camera.y;
        if (room < worst) {
          worst = room;
          where = `torii en ${t.d.toFixed(1)}`;
        }
      }
    }
  }
  check('caminando, el nuki pasa ≥ 1,5 u por encima de la cámara', worst >= CAMERA_CLEARANCE, `${worst.toFixed(2)} u, ${where}`);
}
{
  // La alzada cambia despacio: como mucho 0,15 u por unidad de camino.
  let steepest = 0;
  for (const g of galleries) {
    g.toriis.forEach((t, k) => {
      if (k > 0) steepest = Math.max(steepest, Math.abs(t.lift - g.toriis[k - 1]!.lift) / (t.d - g.toriis[k - 1]!.d));
    });
  }
  check('la alzada es suave: ≤ 0,15 u por unidad de camino', steepest <= LIFT_SLOPE + 0.03, steepest.toFixed(3));
}

// Viajando, el encuadre recorta las curvas: lo que pase a menos de 1,5 u de
// un pilar lo hace a velocidad de viaje, con el tramado de cerca encendido.
{
  const piedra = cubicBezierEase(0.65, 0, 0.35, 1);
  const pillars = galleries.flatMap((g) => g.toriis.flatMap((t) => galleryPillars(t).map((p) => ({ ...p, t }))));
  let slowest = Number.POSITIVE_INFINITY;
  let closest = Number.POSITIVE_INFINITY;
  let nukiRoom = Number.POSITIVE_INFINITY;
  const ubiD = STATION_DEPTHS[stationIndex('ubicacion')]!;
  for (const [from, to] of [
    [eventosD, fushimiD],
    [fushimiD, eventosD],
    [ubiD, fushimiD],
    [fushimiD, ubiD],
  ] as const) {
    const rig = createRig();
    snapRig(rig, from);
    const duration = travelDuration(Math.abs(to - from));
    let velocity = 0;
    let previous = rig.d;
    for (let time = 0; time <= duration + 1; time += 1 / 60) {
      stepRig(rig, from + (to - from) * piedra(Math.min(1, time / duration)), 1 / 60);
      // Como PATH.velocity: amortiguada.
      velocity = damp(velocity, (rig.d - previous) * 60, 8, 1 / 60);
      previous = rig.d;
      for (const pillar of pillars) {
        if (Math.abs(pillar.z - rig.camera.z) > 3) continue;
        const gap = Math.hypot(pillar.x - rig.camera.x, pillar.z - rig.camera.z) - INARI.baseRadius[0];
        closest = Math.min(closest, gap);
        if (gap < CAMERA_CLEARANCE) slowest = Math.min(slowest, Math.abs(velocity));
        if (Math.abs(pillar.z - rig.camera.z) < 0.6) {
          nukiRoom = Math.min(nukiRoom, pillar.t.y + inariLift(INARI_NUKI_BOTTOM, pillar.t.lift) - rig.camera.y);
        }
      }
    }
  }
  check(
    'viajando (Eventos ↔ Fushimi, Ubicación ↔ Fushimi), lo que roza un pilar va con el tramado encendido',
    slowest >= TORII_FADE_SPEED[1],
    `lo más cerca: ${closest.toFixed(2)} u; ahí, ${Number.isFinite(slowest) ? `${slowest.toFixed(0)} u/s` : 'nunca'}`,
  );
  check('viajando, el nuki sigue por encima de la cámara (≥ 1,5 u)', nukiRoom >= CAMERA_CLEARANCE, `${nukiRoom.toFixed(2)} u`);
}

/* ── 6. El bambú de arriba ─────────────────────────────────────────────── */

section('El bambú de arriba');

const canopy = evLayout.groves.filter((g) => g.item.canopy);
check('hay dosel a los dos lados de la subida', new Set(canopy.map((g) => g.area.side)).size === 2, `${canopy.length} macizos`);
check(
  'más alto que el nuki y fuera de los pilares',
  canopy.every((g) => g.item.height[1] > INARI_NUKI_BOTTOM && g.area.inner > INARI.span / 2 + 1),
);
check('inclinado hacia el camino', canopy.every((g) => (g.item.lean ?? 0) > 0));
const middle = (g: (typeof galleries)[number]) => (g.from + g.to) / 2;
check(
  'el moteado, sólo en los tramos de galería',
  komorebiAt(eventosD + 20) === 0 && komorebiAt(fushimiD + 20) === 0 && komorebiAt(middle(galleries[1]!)) === 1,
);
check('y más marcado en las densas', komorebiAt(middle(galleries[0]!)) < komorebiAt(middle(galleries[1]!)));
check(
  'delante de cada ema, en su costado, un claro del dosel',
  cards.every((card, i) => {
    const stop = stops[i]!;
    return canopy
      .filter((g) => g.area.side === card.side)
      .every((g) => g.stationD + g.area.to <= stop - 12 + 1e-6 || g.stationD + g.area.from >= stop + 3 - 1e-6);
  }),
);

/* ── 7. Las ema ────────────────────────────────────────────────────────── */

section('Las ema');

const emas = evLayout.objects.filter((o) => o.item.kind === 'ema');
check('tres ema-kake en la subida, uno por tarjeta', emas.length === cards.length);
for (const o of emas) {
  if (o.item.kind !== 'ema') continue;
  const card = cards[o.item.card]!;
  const stop = stops[o.item.card]!;
  const landing = landings[o.item.card]!;
  const d = -o.z;
  const u = o.x - pathX(d);
  const label = `«${card.id}»`;
  check(
    `${label}: en su lado y en su rellano`,
    Math.sign(u) === (card.side === 'izquierda' ? -1 : 1) && d >= landing.from - 1 && d <= landing.to + 1,
    `d ${d.toFixed(1)}, u ${u.toFixed(1)}`,
  );
  for (const [width, height, strict] of [
    [1600, 900, true],
    [1366, 657, false],
  ] as const) {
    const camera = cameraAt(stop, width / height);
    const w = emaWriting(o);
    const corners: [number, number, number][] = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        corners.push([w.center[0] + (w.right[0] * sx * w.w) / 2, w.center[1] + (sy * w.h) / 2, w.center[2] + (w.right[2] * sx * w.w) / 2]);
      }
    }
    const box = screenBox(camera, corners);
    const body = (((box.x1 - box.x0) * width) / BLOCK_PX) * BODY_PX;
    const left = card.side === 'izquierda';
    const inHalf = left ? box.x0 >= 0.01 && box.x1 <= 0.5 : box.x0 >= 0.5 && box.x1 <= 1 - 76 / width;
    const tag = `${label} ${width}×${height}`;
    if (strict) {
      check(`${tag}: el cuerpo del texto, a ≥ 15 px`, body >= 15, `${body.toFixed(1)} px`);
      check(`${tag}: lo escrito cabe en su mitad`, inHalf, `x ${(box.x0 * 100).toFixed(0)}–${(box.x1 * 100).toFixed(0)} %`);
    } else {
      check(`${tag}: lo escrito se ve entero`, box.x0 >= 0 && box.x1 <= 1 - 76 / width);
    }
    // Ningún pilar de una galería entre la cámara de la parada y la tabla.
    const covering = galleries
      .flatMap((g) => g.toriis)
      .filter((t) => {
        if (t.d >= d || t.d <= -camera.position.z) return false;
        return galleryPillars(t).some((pillar) => {
          const screen = onScreen(camera, pillar.x, t.y + 2.5, pillar.z);
          return screen.x >= box.x0 - 0.02 && screen.x <= box.x1 + 0.02;
        });
      });
    check(`${tag}: ningún torii tapa la tabla`, covering.length === 0, `${covering.length}`);
  }
}

/* ── 8. La explanada y el rōmon ────────────────────────────────────────── */

section('La explanada y el rōmon');

const slabs = stoneLayout().filter((st) => st.flatten);
const plaza = getStation('fushimi-inari').environment.plaza!;
const slabU = (st: (typeof slabs)[number]) => Math.abs(st.x - pathX(-st.z));
check('hay losas en la explanada', slabs.length > 40, `${slabs.length}`);
check(
  'dentro de la explanada y de su ancho',
  slabs.every((st) => -st.z >= fushimiD + plaza.from - 1 && -st.z <= fushimiD + plaza.to + 1 && slabU(st) <= plaza.half + 0.5),
);
check('se aclaran hacia el borde', slabs.filter((st) => slabU(st) < 2).length > slabs.filter((st) => slabU(st) > 4).length);
check('ninguna losa en las gradas', slabs.every((st) => -st.z >= lastGallery.to - 1));

const fuLayout = stationDecorLayout(FUSHIMI, false);
const romon = fuLayout.objects.find((o) => o.item.kind === 'romon')!;
{
  const camera = cameraAt(fushimiD, 16 / 9);
  // Su silueta: la planta del tejado bajo en el suelo, las esquinas de los
  // dos tejados (levantadas por la sori) y la cumbrera con sus remates.
  const corners: [number, number, number][] = [];
  const point = { x: 0, z: 0 };
  const add = (lx: number, ly: number, lz: number) => {
    objectToWorld(romon, lx, lz, point);
    corners.push([point.x, romon.y + ly * romon.scale, point.z]);
  };
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(sx * ROMON.lowerRoof.halfW, 0, sz * ROMON.lowerRoof.halfD);
      add(sx * ROMON.lowerRoof.halfW, ROMON.lowerRoof.eave + ROMON.lowerRoof.sori, sz * ROMON.lowerRoof.halfD);
      add(sx * ROMON.upperRoof.halfW, ROMON.upperRoof.eave + ROMON.upperRoof.sori, sz * ROMON.upperRoof.halfD);
    }
    add(sx * (ROMON.upperRoof.ridgeHalf + 0.35), ROMON_HEIGHT, 0);
  }
  const box = screenBox(camera, corners);
  check('16:9 · el rōmon, en la mitad izquierda', box.x1 <= 0.52, `x ${(box.x0 * 100).toFixed(0)}–${(box.x1 * 100).toFixed(0)} %`);
  check('16:9 · entero y con aire arriba', box.y0 >= 0.01 && box.x0 >= -0.02, `y ${(box.y0 * 100).toFixed(0)} %`);
  check('16:9 · y no pequeño: un tercio del ancho o más', box.x1 - box.x0 >= 0.3, `${((box.x1 - box.x0) * 100).toFixed(0)} %`);
  // La zona del título: la mitad derecha, del 12 al 80 % del alto.
  const intruders = fuLayout.objects.filter((o) => {
    if (o.item.kind === 'romon' || o.item.kind === 'nobori') return false;
    const screen = onScreen(camera, o.x, o.y + 1, o.z);
    const distance = Math.hypot(o.x - camera.position.x, o.z - camera.position.z);
    return distance < 70 && screen.x > 0.56 && screen.x < 0.94 && screen.y > 0.12 && screen.y < 0.8;
  });
  check('16:9 · nada plantado bajo el título', intruders.length === 0, intruders.map((o) => o.item.kind).join(', '));
}
check(
  'dos zorros de piedra, uno con la llave y otro con la joya',
  ROMON_FOXES.length === 2 && new Set(ROMON_FOXES.map((f) => f.holding)).size === 2,
);
check(
  'el rōmon le cierra el paso a la fauna',
  decorFootprints(false).some((f) => f.faunaMargin > 0 && insideFootprint(f, romon.x, romon.y + 1, romon.z, 0)),
);

/* ── 9. El paneo ───────────────────────────────────────────────────────── */

section('El paneo hacia el rōmon');

{
  const dt = 1 / 60;
  let value = 0;
  let fastest = 0;
  let monotonic = true;
  let previous = 0;
  for (let t = 0; t < 3; t += dt) {
    value = stepPan(value, -1, true, dt);
    fastest = Math.max(fastest, (Math.abs(value - previous) * PAN_YAW) / dt);
    if (value > previous + 1e-12) monotonic = false;
    previous = value;
  }
  check('entra hasta su tope (6°) sin pasarse', value === -1 && monotonic, value.toFixed(3));
  check('nunca más deprisa que el giro máximo del rig', fastest <= RIG_LIMITS.maxYawRate + 1e-9, `${(fastest / DEG).toFixed(1)}°/s`);
  let back = value;
  let time = 0;
  while (back !== 0 && time < 5) {
    back = stepPan(back, 0, true, dt);
    time += dt;
  }
  check('al cerrar, vuelve a cero en ≤ 2 s', back === 0 && time <= 2, `${time.toFixed(2)} s`);
  check('si la cámara no está asentada, no hay paneo', stepPan(0, -1, false, 0.5) === 0);
}

/* ── 10. El kitsune ────────────────────────────────────────────────────── */

section('El kitsune');

check('tiene cuerpo y una sola conducta, senda', speciesSpec('kitsune')?.behaviors.join() === 'senda');
check('sale en la zona de Fushimi', getStation('fushimi-inari').ambient.fauna.includes('kitsune'));
{
  const random = mulberry32(6161);
  const climb = [...stops, ...galleries.map(middle), fushimiD];
  let viable = 0;
  let total = 0;
  for (const portrait of [false, true]) {
    for (const d of climb) {
      const rig = createRig();
      snapRig(rig, d);
      const camera: CameraState = { d, velocity: 0, frame: rig.frame, aspect: portrait ? 9 / 16 : 16 / 9, traveling: false };
      for (const kind of JOURNEY[dominantZone(d)]!.ambient.fauna) {
        const spec = speciesSpec(kind);
        if (!spec) continue;
        for (const behavior of spec.behaviors) {
          for (let n = 0; n < 12; n += 1) {
            total += 1;
            if (clearOfDecor(createAct({ kind, behavior }, n, 0, camera, random), decorFootprints(portrait), d)) viable += 1;
          }
        }
      }
    }
  }
  const single = viable / total;
  const effective = 1 - (1 - single) ** DECOR_RETRIES;
  check(
    'la fauna sigue saliendo en la subida, contadas las densas (≥ 20 % de los repartos)',
    effective >= 0.2,
    `${Math.round(effective * 100)} % (un sorteo: ${Math.round(single * 100)} %)`,
  );
}

/* ── 11. Los textos ────────────────────────────────────────────────────── */

section('Los textos');

type Texts = { tramos: Record<string, Record<string, { title?: string; body?: string }>>; lugares?: Record<string, Record<string, unknown>> };
for (const [lang, messages] of [
  ['es', messagesEs as unknown as Texts],
  ['en', messagesEn as unknown as Texts],
] as const) {
  for (const card of cards) {
    const text = messages.tramos.eventos?.[card.id];
    const words = text?.body?.split(/\s+/).length ?? 0;
    check(`${lang} · ema «${card.id}»: título y texto de ≤ 60 palabras`, Boolean(text?.title) && words > 0 && words <= 60, `${words}`);
  }
  const place = messages.lugares?.['fushimi-inari'];
  const temple = place?.temple as { title?: string; body?: string; ficha?: Record<string, { label?: string; value?: string }> } | undefined;
  check(
    `${lang} · el cartel de Fushimi y la tarjeta del templo`,
    ['romaji', 'tagline', 'summary', 'behold', 'beholdLabel', 'close'].every((key) => typeof place?.[key] === 'string') &&
      Boolean(temple?.title && temple.body) &&
      ['fundacion', 'deidad', 'toriis', 'santuarios', 'romon', 'monte'].every((key) => temple?.ficha?.[key]?.label && temple.ficha[key]?.value),
  );
}

finish('Fushimi Inari, en orden.');

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
  const v = new Vector3(x, y, z).project(camera);
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
}

/** La caja proyectada (fracciones de pantalla) de unos puntos del mundo. */
function screenBox(camera: PerspectiveCamera, points: readonly [number, number, number][]) {
  const box = { x0: 1, x1: 0, y0: 1, y1: 0 };
  for (const [x, y, z] of points) {
    const v = onScreen(camera, x, y, z);
    box.x0 = Math.min(box.x0, v.x);
    box.x1 = Math.max(box.x1, v.x);
    box.y0 = Math.min(box.y0, v.y);
    box.y1 = Math.max(box.y1, v.y);
  }
  return box;
}
