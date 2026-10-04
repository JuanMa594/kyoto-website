/**
 * Las reglas del director, separadas de React.
 *
 * Quién sale y cuándo es **la** decisión de diseño de toda la fauna, así que
 * vive en un módulo puro: se puede razonar sobre ella leyéndola, y comprobarla
 * simulando diez minutos fuera del navegador en vez de quedarse mirando la
 * pantalla a ver si aparece algo raro.
 *
 * Desde la Fase 3B el director sabe dónde está la cámara y cómo se mueve: los
 * actos nacen por delante si se camina, a la distancia que pide la zona, con
 * su ancla en el mundo, y se retiran sólo fuera de cuadro (`anchoring.ts`).
 */

import type { FaunaKind } from '@/config/journey';
import { lerp } from '@/lib/procedural';
import type { PathFrame } from '@/scene/path/journeyPath';

import {
  CAMERA_Z,
  faunaDistanceAt,
  fogFarAt,
  HURRY_GAP,
  leadFor,
  retirement,
  SLIDE,
  SPAWN_STILL,
  spawnAllowed,
  spawnDistance,
  spawnFloor,
  type ActTrack,
} from './anchoring';
import type { FaunaAct } from './behaviors';
import {
  durationFor,
  isAerial,
  membersFor,
  speciesSpec,
  type BehaviorName,
} from './bestiary';

export interface CastingConfig {
  /** Hueco mínimo y máximo entre actos, en segundos. */
  readonly minGap: number;
  readonly maxGap: number;
  /** Tras tantos segundos sin scroll y con el cuadro vacío, sale uno extra. */
  readonly idleGap: number;
  /** Cuántos actos pueden convivir. Dos sólo en tier alto. */
  readonly maxActs: number;
}

export interface CastingMemory {
  nextAt: number;
  lastSpawn: number;
  lastSpecies: FaunaKind | null;
  counter: number;
  /** Desde cuándo no hay nada en cuadro. `null` = ahora mismo hay algo. */
  emptySince: number | null;
  /**
   * Hubo un viaje y la cámara aún no se ha parado. La curva `piedra` frena:
   * cuando el viaje se da por terminado la cámara va todavía a ~11 u/s, y un
   * acto que naciera ahí recibiría la ventaja máxima mientras la cámara se
   * detiene, al doble de distancia.
   */
  settling: boolean;
}

export function newMemory(now: number, random: () => number): CastingMemory {
  return {
    // La primera aparición llega pronto: esperar cuarenta segundos a que pase
    // algo la primera vez es, para quien acaba de entrar, no tener fauna.
    nextAt: now + 4 + random() * 5,
    lastSpawn: now,
    lastSpecies: null,
    counter: 0,
    emptySince: now,
    settling: false,
  };
}

/** Lo que el director sabe de la cámara en este frame. */
export interface CameraState {
  /** Profundidad de su punto de interés (`PATH.d`). */
  readonly d: number;
  /** `PATH.velocity`: avance con signo, u/s. */
  readonly velocity: number;
  /** `PATH.frame`. El acto que nace se queda con una copia: su ancla. */
  readonly frame: Readonly<PathFrame>;
  /** `VIEW.aspect`: el de la pantalla. */
  readonly aspect: number;
  /** Hay un viaje en curso: la cámara pasa de largo. */
  readonly traveling: boolean;
}

export interface AdvanceParams {
  memory: CastingMemory;
  acts: readonly FaunaAct[];
  now: number;
  /** Segundos desde el último scroll. */
  idleFor: number;
  /** Especies de la zona que además tienen cuerpo. */
  cast: readonly FaunaKind[];
  config: CastingConfig;
  random: () => number;
  camera: CameraState;
  /** El seguimiento de cada acto vivo en este frame (`trackAct`), por id. */
  tracks: ReadonlyMap<number, ActTrack>;
}

export interface AdvanceResult {
  /** La misma referencia si no ha cambiado nada: así el componente no repinta. */
  acts: readonly FaunaAct[];
  spawned: FaunaAct | null;
}

/**
 * Lo que hay en escena ahora mismo, para `/diagnostico`. Mismo criterio que
 * `WIND` y `PARALLAX`: es una lectura, no estado del que dependa nadie, y sólo
 * la escribe el director (`live`, cada frame, con `describeAct`).
 */
export const FAUNA_STAGE: {
  live: string[];
  /** Actos montados desde que se abrió la página. */
  total: number;
  /** Segundos que faltan para el siguiente, según el reloj de escena. */
  nextIn: number;
} = { live: [], total: 0, nextIn: 0 };

/** Cómo se lee un acto en `/diagnostico`: quién, a qué distancia y en qué está. */
export function describeAct(act: FaunaAct, track?: ActTrack): string {
  const who =
    act.members > 1
      ? `${act.species} ×${act.members} (${act.behavior})`
      : `${act.species} (${act.behavior})`;
  if (!track || !Number.isFinite(track.distance)) return who;
  return `${who} · ${Math.round(track.distance)} u · ${track.state}`;
}

/** Un paso del director. Retira lo que nadie ve y decide si monta algo nuevo. */
export function advanceCasting(params: AdvanceParams): AdvanceResult {
  const { memory, now, idleFor, cast, config, random, camera, tracks } = params;

  // Se retira sólo lo que ya no está en cuadro (`retirement`). Un acto sin
  // seguimiento todavía —acaba de nacer— sigue.
  const fogFar = fogFarAt(camera.d);
  let leftBehind = false;
  const live = params.acts.filter((act) => {
    const track = tracks.get(act.id);
    const why = track ? retirement(act, track, now, camera.d, fogFar) : null;
    if (why === 'dejado') leftBehind = true;
    return why === null;
  });
  const acts = live.length === params.acts.length ? params.acts : live;

  // Dejar atrás un acto sin terminar adelanta el siguiente: si no, un tramo
  // recorrido a buen paso se quedaría vacío.
  if (leftBehind) {
    memory.nextAt = Math.min(memory.nextAt, now + lerp(HURRY_GAP[0], HURRY_GAP[1], random()));
  }

  // Desde cuándo está el cuadro vacío de fauna.
  if (live.length > 0) memory.emptySince = null;
  else memory.emptySince ??= now;

  FAUNA_STAGE.nextIn = Math.max(0, memory.nextAt - now);

  // Tras un viaje no nace nada hasta que la cámara se para.
  if (camera.traveling) memory.settling = true;
  else if (Math.abs(camera.velocity) < SPAWN_STILL) memory.settling = false;

  if (
    memory.settling ||
    !spawnAllowed(camera.velocity, camera.traveling) ||
    cast.length === 0 ||
    live.length >= config.maxActs
  ) {
    return { acts, spawned: null };
  }

  // La recompensa por quedarse quieto: nadie hace scroll **y** hace un rato que
  // no pasa nada. Las dos condiciones importan — sin la segunda, la recompensa
  // dejaría de ser un premio y se convertiría en la cadencia normal, con el
  // cuadro lleno de bichos todo el rato.
  const quietFor = memory.emptySince === null ? 0 : now - memory.emptySince;
  const reward = idleFor > config.idleGap && quietFor > config.idleGap * 0.4;

  if (now < memory.nextAt && !reward) return { acts, spawned: null };

  const spawned = castAct(cast, live, now, memory, random, camera);
  if (!spawned) return { acts, spawned: null };

  memory.lastSpawn = now;
  memory.nextAt = now + lerp(config.minGap, config.maxGap, random());
  FAUNA_STAGE.total += 1;

  return { acts: [...live, spawned], spawned };
}

/** Una especie y una conducta, ya elegidas. */
export interface ActChoice {
  readonly kind: FaunaKind;
  readonly behavior: BehaviorName;
}

/** Elige quién sale respetando las reglas de composición, y lo monta. */
function castAct(
  cast: readonly FaunaKind[],
  live: readonly FaunaAct[],
  now: number,
  memory: CastingMemory,
  random: () => number,
  camera: CameraState,
): FaunaAct | null {
  // Si ya hay algo en el aire, lo siguiente va por el suelo y al revés: dos
  // garzas cruzando a la vez se leen como un bucle, no como un jardín.
  const busyAerial = live.some((act) => isAerial(act.behavior));
  const busyGround = live.some((act) => !isAerial(act.behavior));

  const options: { kind: FaunaKind; behavior: BehaviorName; weight: number }[] = [];

  for (const kind of cast) {
    const spec = speciesSpec(kind);
    if (!spec) continue;

    for (const behavior of spec.behaviors) {
      if (isAerial(behavior) ? busyAerial : busyGround) continue;
      // Repetir especie hace que el sitio parezca un zoológico de una jaula.
      const repeat = kind === memory.lastSpecies ? 0.12 : 1;
      options.push({ kind, behavior, weight: spec.weight * repeat });
    }
  }

  if (options.length === 0) return null;

  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let ticket = random() * total;
  let chosen = options[0]!;
  for (const option of options) {
    ticket -= option.weight;
    if (ticket <= 0) {
      chosen = option;
      break;
    }
  }

  memory.counter += 1;
  memory.lastSpecies = chosen.kind;
  return createAct(chosen, memory.counter, now, camera, random);
}

/**
 * Monta un acto ya elegido delante de la cámara (§4 del spec de 3B): cuánto
 * dura, cuántos son y, sobre todo, **dónde nace** —a la distancia de su
 * especie, acercada o alejada por la zona, con ventaja si se camina— y con qué
 * ancla.
 */
export function createAct(
  choice: ActChoice,
  id: number,
  now: number,
  camera: CameraState,
  random: () => number,
): FaunaAct {
  const spec = speciesSpec(choice.kind)!;
  // La duración va primero: el gato decide por ella si juega, y jugar es de dos.
  const duration = durationFor(choice.behavior, random);
  const base = CAMERA_Z - lerp(spec.depth[0], spec.depth[1], random());
  // Lo que vuela no necesita ventaja: se le adelanta a la cámara.
  const lead = SLIDE[choice.behavior].mode === 'siempre' ? 0 : leadFor(camera.velocity);
  const distance = spawnDistance(
    base,
    faunaDistanceAt(camera.d),
    spawnFloor(choice.behavior),
    lead,
    fogFarAt(camera.d),
  );

  return {
    id,
    species: choice.kind,
    spec,
    behavior: choice.behavior,
    members: membersFor(choice.behavior, random, spec, duration),
    duration,
    startedAt: now,
    direction: random() < 0.5 ? -1 : 1,
    depth: CAMERA_Z - distance,
    seed: Math.floor(random() * 10000),
    origin: { ...camera.frame },
    anchor: { ...camera.frame },
    spawnD: camera.d,
    aspect: Math.max(camera.aspect, 16 / 9),
  };
}
