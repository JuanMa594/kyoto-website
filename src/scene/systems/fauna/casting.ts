/**
 * Las reglas del director, separadas de React.
 *
 * Quién sale y cuándo es **la** decisión de diseño de toda la fauna, así que
 * vive en un módulo puro: se puede razonar sobre ella leyéndola, y comprobarla
 * simulando diez minutos fuera del navegador en vez de quedarse mirando la
 * pantalla a ver si aparece algo raro.
 */

import type { FaunaKind, Station } from '@/config/journey';
import { lerp } from '@/lib/procedural';

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
  };
}

export interface AdvanceParams {
  memory: CastingMemory;
  acts: readonly FaunaAct[];
  now: number;
  /** Segundos desde el último scroll. */
  idleFor: number;
  station: Station;
  /** Especies de la estación que además tienen cuerpo. */
  cast: readonly FaunaKind[];
  config: CastingConfig;
  random: () => number;
}

export interface AdvanceResult {
  /** La misma referencia si no ha cambiado nada: así el componente no repinta. */
  acts: readonly FaunaAct[];
  spawned: FaunaAct | null;
}

/**
 * Lo que hay en escena ahora mismo, para `/diagnostico`. Mismo criterio que
 * `WIND` y `PARALLAX`: es una lectura, no estado del que dependa nadie, y sólo
 * la escribe el director.
 */
export const FAUNA_STAGE: {
  live: string[];
  /** Actos montados desde que se abrió la página. */
  total: number;
  /** Segundos que faltan para el siguiente, según el reloj de escena. */
  nextIn: number;
} = { live: [], total: 0, nextIn: 0 };

function describe(act: FaunaAct): string {
  return act.members > 1 ? `${act.species} ×${act.members} (${act.behavior})` : `${act.species} (${act.behavior})`;
}

/** Un paso del director. Retira lo que terminó y decide si monta algo nuevo. */
export function advanceCasting(params: AdvanceParams): AdvanceResult {
  const { memory, now, idleFor, station, cast, config, random } = params;

  const live = params.acts.filter((act) => now < act.startedAt + act.duration);
  const acts = live.length === params.acts.length ? params.acts : live;

  // Desde cuándo está el cuadro vacío de fauna.
  if (live.length > 0) memory.emptySince = null;
  else memory.emptySince ??= now;

  if (acts !== params.acts) FAUNA_STAGE.live = acts.map(describe);
  FAUNA_STAGE.nextIn = Math.max(0, memory.nextAt - now);

  if (cast.length === 0 || live.length >= config.maxActs) return { acts, spawned: null };

  // La recompensa por quedarse quieto: nadie hace scroll **y** hace un rato que
  // no pasa nada. Las dos condiciones importan — sin la segunda, la recompensa
  // dejaría de ser un premio y se convertiría en la cadencia normal, con el
  // cuadro lleno de bichos todo el rato.
  const quietFor = memory.emptySince === null ? 0 : now - memory.emptySince;
  const reward = idleFor > config.idleGap && quietFor > config.idleGap * 0.4;

  if (now < memory.nextAt && !reward) return { acts, spawned: null };

  const spawned = castAct(station, cast, live, now, memory, random);
  if (!spawned) return { acts, spawned: null };

  memory.lastSpawn = now;
  memory.nextAt = now + lerp(config.minGap, config.maxGap, random());

  const next = [...live, spawned];
  FAUNA_STAGE.live = next.map(describe);
  FAUNA_STAGE.total += 1;

  return { acts: next, spawned };
}

/** Monta un acto respetando las reglas de composición. */
function castAct(
  station: Station,
  cast: readonly FaunaKind[],
  live: readonly FaunaAct[],
  now: number,
  memory: CastingMemory,
  random: () => number,
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

  const spec = speciesSpec(chosen.kind)!;
  memory.counter += 1;
  memory.lastSpecies = chosen.kind;

  return {
    id: memory.counter,
    species: chosen.kind,
    spec,
    behavior: chosen.behavior,
    members: membersFor(chosen.behavior, random),
    duration: durationFor(chosen.behavior, random),
    startedAt: now,
    direction: random() < 0.5 ? -1 : 1,
    depth: lerp(spec.depth[0], spec.depth[1], random()),
    environment: station.environment,
    seed: Math.floor(random() * 10000),
  };
}
