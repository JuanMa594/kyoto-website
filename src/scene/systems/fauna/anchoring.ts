/**
 * ★ Dónde vive cada acto de la fauna en el mundo (Fase 3B).
 *
 * Desde 3B la fauna está **anclada al mundo**, como las piedras. Al nacer, cada
 * acto guarda una copia del encuadre de la cámara (`act.origin`) y sus
 * conductas —escritas en coordenadas locales— quedan en ese sitio: al avanzar,
 * la cámara se acerca a los animales, los ve crecer y los deja atrás. Lo que
 * anda sale por el borde inferior a unas 10 u; la cámara pasa por encima, nunca
 * entre ellos.
 *
 * Lo que vuela no puede anclarse sin más: la franja alta, vista de cerca, baja
 * hasta la altura de la cámara, y una bandada anclada acabaría cruzando a un
 * par de unidades del objetivo. Por eso su ancla **se desliza**: se deja
 * alcanzar hasta un mínimo y a partir de ahí avanza con la cámara (`SLIDE`).
 *
 * Aquí viven también las reglas de dónde y cuándo nace un acto, la prueba de
 * cuadro con la cámara real y la regla que más importa de la fauna: **un acto
 * sólo se retira cuando ninguno de sus individuos está en cuadro**.
 *
 * Módulo puro —three sólo como matemática—: `bun run check:path` lo recorre.
 */

import { Frustum, Matrix4, Sphere, Vector3, type Camera } from 'three';

import { smoothstep } from '@/lib/procedural';
import { CAMERA_BASE } from '@/scene/camera/framing';
import {
  blendByZone,
  frameToWorld,
  pathY,
  type PathFrame,
  type Point3,
} from '@/scene/path/journeyPath';

import {
  extrapolates,
  inFlight,
  OVERTIME_FADE,
  OVERTIME_LIMIT,
  placeAt,
  type FaunaAct,
} from './behaviors';
import type { BehaviorName } from './bestiary';

/**
 * z local de la cámara en `CAMERA_BASE`: algo a una distancia D de la cámara
 * está a la profundidad local `CAMERA_Z − D`.
 */
export const CAMERA_Z = CAMERA_BASE.position[2];

/* ── El ancla que se desliza ───────────────────────────────────────────── */

export type SlideMode = 'siempre' | 'en vuelo' | 'nunca';

interface Slide {
  readonly mode: SlideMode;
  /** Distancia mínima de su punto base a la cámara (u). */
  readonly min: number;
}

const NEVER: Slide = { mode: 'nunca', min: 0 };

/**
 * Qué se desliza y cuánto se deja alcanzar. Lo que anda, nunca: deslizarlo
 * sería hacerlo patinar, que es justo lo que arregla la Fase 3B. Los gorriones
 * que bajan a posarse, sólo mientras están en el aire.
 */
export const SLIDE: Readonly<Record<BehaviorName, Slide>> = {
  revolotear: { mode: 'siempre', min: 8 },
  bandada: { mode: 'siempre', min: 10 },
  cruzarVolando: { mode: 'siempre', min: 10 },
  planearEnCirculos: { mode: 'siempre', min: 22 },
  visitaAlSuelo: { mode: 'en vuelo', min: 12 },
  vadear: NEVER,
  correrYParar: NEVER,
  perseguir: NEVER,
  deambular: NEVER,
  callejear: NEVER,
  titilar: NEVER,
};

/** Entre `min + SLIDE_RANGE` y `min` el ancla pasa de quieta a avanzar con la cámara (u). */
export const SLIDE_RANGE = 3;
/** Con qué constante (1/s) se aparta hasta su mínimo lo que arranca a volar ya más cerca. */
export const SLIDE_RESTORE = 3;

/**
 * Un frame del ancla que se desliza: cuánto se ha deslizado después de que la
 * cámara avance `advance` u, estando su punto base a `distance` u.
 *
 *   · **Seguir**: avanza `advance · w`, con `w` de 0 (a `min + 3` o más) a 1
 *     (en `min`). La velocidad no da saltos, y con la cámara quieta no se mueve.
 *   · **Apartarse**: si ya está más cerca que su mínimo —unos gorriones que alzan
 *     el vuelo junto a la cámara—, se aleja suave hasta él.
 *   · Nunca retrocede: si la cámara vuelve atrás, se queda donde llegó.
 */
export function slideStep(
  push: number,
  distance: number,
  advance: number,
  min: number,
  dt: number,
): number {
  const follow = Math.max(0, advance) * smoothstep(min + SLIDE_RANGE, min, distance);
  const restore = Math.max(0, min - distance) * (1 - Math.exp(-SLIDE_RESTORE * Math.max(0, dt)));
  return push + follow + restore;
}

/* ── Cuándo y dónde nace ───────────────────────────────────────────────── */

/** Por debajo de esta velocidad (u/s, en valor absoluto) la cámara está quieta. */
export const SPAWN_STILL = 1;
/** Por encima no nace nada: se pasaría antes de que entrara en cuadro (~40vh/s). */
export const SPAWN_MAX_SPEED = 12;
/** La ventaja al caminar es lo que se avanza en este tiempo (s)… */
export const LEAD_TIME = 2.5;
/** …con este tope (u). */
export const LEAD_MAX = 18;
/** Con ventaja, nada nace más lejos que esta fracción de la niebla lejana. */
export const FOG_CAP = 0.5;
/** Suelo de distancia de lo que no se desliza siempre (u). */
export const MIN_DISTANCE = 15;

/**
 * ¿Puede nacer algo ahora? No en un viaje (la cámara pasa de largo), no
 * caminando rápido y no retrocediendo: el cuadro se ensancha y la entrada del
 * acto quedaría a la vista.
 */
export function spawnAllowed(velocity: number, traveling: boolean): boolean {
  if (traveling || !Number.isFinite(velocity)) return false;
  if (velocity < -SPAWN_STILL) return false;
  return velocity <= SPAWN_MAX_SPEED;
}

/** Ventaja con la que nace lo que no se desliza siempre si la cámara camina hacia delante. */
export function leadFor(velocity: number): number {
  if (!(velocity >= SPAWN_STILL)) return 0;
  return Math.min(velocity * LEAD_TIME, LEAD_MAX);
}

/** La cercanía de la zona en `d`, mezclada entre estaciones. */
export function faunaDistanceAt(d: number): number {
  return blendByZone(d, (station) => station.ambient.faunaDistance);
}

/** La niebla lejana de la zona en `d`, mezclada entre estaciones. */
export function fogFarAt(d: number): number {
  return blendByZone(d, (station) => station.ambient.fog.far);
}

/** Por debajo de qué distancia no puede acercarlo la cercanía de la zona. */
export function spawnFloor(behavior: BehaviorName): number {
  const slide = SLIDE[behavior];
  return slide.mode === 'siempre' ? slide.min + 1 : MIN_DISTANCE;
}

/**
 * A qué distancia de la cámara nace un acto (§4.3 del spec de 3B).
 *
 * `base` es la distancia sorteada en el rango de su especie. La cercanía de la
 * zona la escala, sin bajar del suelo —salvo que la especie ya naciera más
 * cerca—, y la ventaja la aleja, sin pasar de media niebla.
 */
export function spawnDistance(
  base: number,
  factor: number,
  floor: number,
  lead: number,
  fogFar: number,
): number {
  const near = Math.max(base * factor, Math.min(base, floor));
  if (lead <= 0) return near;
  return Math.min(near + lead, Math.max(near, FOG_CAP * fogFar));
}

/* ── La cámara real ────────────────────────────────────────────────────── */

/** Lo que hace falta de la cámara de este frame para saber qué se ve. */
export interface Viewer {
  readonly frustum: Frustum;
  readonly position: Vector3;
  /** Dirección de la mirada, unitaria. */
  readonly look: Vector3;
  /** Dirección de la mirada en el plano XZ, unitaria. */
  readonly forward: { x: number; z: number };
  /**
   * Dónde termina la niebla que se dibuja (`scene.fog.far`, con el factor del
   * tier). Más allá todo es color de niebla: no se ve, aunque esté en el frustum.
   */
  fogFar: number;
}

const PROJECTION = new Matrix4();
const PROBE = new Sphere();

export function createViewer(): Viewer {
  return {
    frustum: new Frustum(),
    position: new Vector3(),
    look: new Vector3(0, 0, -1),
    forward: { x: 0, z: -1 },
    fogFar: Number.POSITIVE_INFINITY,
  };
}

/**
 * Copia la cámara de este frame, y la niebla que se dibuja. Las matrices de la
 * cámara tienen que estar al día (`updateMatrixWorld()`).
 */
export function updateViewer(viewer: Viewer, camera: Camera, fogFar = Number.POSITIVE_INFINITY): void {
  PROJECTION.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  viewer.frustum.setFromProjectionMatrix(PROJECTION);
  viewer.position.setFromMatrixPosition(camera.matrixWorld);
  camera.getWorldDirection(viewer.look);
  const flat = Math.hypot(viewer.look.x, viewer.look.z) || 1;
  viewer.forward.x = viewer.look.x / flat;
  viewer.forward.z = viewer.look.z / flat;
  viewer.fogFar = fogFar;
}

/** Radio con el que se prueba si un individuo está en cuadro: su cuerpo y un margen. */
export function viewRadius(size: number): number {
  return 0.6 * size + 0.3;
}

/** ¿Toca el cuadro la esfera de radio `radius` en (x, y, z)? Sólo geometría: sin niebla. */
export function inView(viewer: Viewer, x: number, y: number, z: number, radius: number): boolean {
  PROBE.center.set(x, y, z);
  PROBE.radius = radius;
  return viewer.frustum.intersectsSphere(PROBE);
}

/**
 * ¿Se ve de verdad? En cuadro **y** por delante del final de la niebla. La
 * niebla lineal de three mide la profundidad a lo largo de la mirada; pasado
 * su `far`, el animal es del color del fondo. Sin esto, lo que se queda lejos
 * al retroceder seguía «a la vista» para siempre, ocupando su hueco.
 */
export function seen(viewer: Viewer, x: number, y: number, z: number, radius: number): boolean {
  const p = viewer.position;
  const depth = (x - p.x) * viewer.look.x + (y - p.y) * viewer.look.y + (z - p.z) * viewer.look.z;
  return depth - radius < viewer.fogFar && inView(viewer, x, y, z, radius);
}

/** Distancia horizontal de la cámara a un punto, a lo largo de la mirada. Negativa: detrás. */
export function forwardDistance(viewer: Viewer, x: number, z: number): number {
  return (x - viewer.position.x) * viewer.forward.x + (z - viewer.position.z) * viewer.forward.z;
}

/** De las coordenadas locales de un encuadre al mundo. */
export function localToWorld(frame: PathFrame, x: number, y: number, z: number, out: Point3): Point3 {
  frameToWorld(frame, x, z, out);
  out.y = frame.y + y;
  return out;
}

/* ── El seguimiento de cada acto ───────────────────────────────────────── */

/** Su punto base, a menos de esto por delante de la cámara —o detrás—, cuenta como dejado atrás (u). */
export const PASSED_DISTANCE = 10;
/** …y se retira tras este avance de la cámara fuera de cuadro (u). */
export const PASSED_ADVANCE = 6;
/** Retrocediendo, se retira más allá de su distancia al nacer (o de media niebla) más esto (u). */
export const FAR_EXTRA = 10;
/** Dejar atrás un acto adelanta el siguiente a este rango (s). */
export const HURRY_GAP: readonly [number, number] = [4, 8];

export type ActState = 'entrando' | 'en cuadro' | 'fuera de cuadro' | 'dejado atrás' | 'saliendo';

/** Lo que el director sabe de un acto vivo. Lo escribe sólo `trackAct`. */
export interface ActTrack {
  /** Lo que su ancla se ha deslizado por el camino (u). Nunca decrece. */
  push: number;
  /** Profundidad de la cámara en el frame anterior. */
  lastD: number | null;
  /** Algún individuo está en cuadro en este frame. */
  visible: boolean;
  everSeen: boolean;
  /** Profundidad de la cámara desde la que cuenta como dejado atrás; null si no lo está. */
  passedFrom: number | null;
  /** Distancia de su punto base a la cámara, en horizontal y a lo largo de la mirada (u). */
  distance: number;
  state: ActState;
}

export function createTrack(): ActTrack {
  return {
    push: 0,
    lastD: null,
    visible: false,
    everSeen: false,
    passedFrom: null,
    distance: Number.POSITIVE_INFINITY,
    state: 'entrando',
  };
}

/**
 * Lleva el ancla del acto a lo que se ha deslizado: hacia donde miraba la
 * cámara cuando nació, subiendo o bajando lo que sube o baja el camino.
 */
export function slidAnchor(act: FaunaAct, push: number): void {
  const origin = act.origin;
  const anchor = act.anchor;
  anchor.x = origin.x - Math.sin(origin.yaw) * push;
  anchor.z = origin.z - Math.cos(origin.yaw) * push;
  anchor.y = origin.y + pathY(act.spawnD + push) - pathY(act.spawnD);
  anchor.yaw = origin.yaw;
}

/**
 * ¿Se desliza ahora? Lo que sólo vuela, siempre. Los gorriones que se posan,
 * sólo en el aire y si aún van por delante: si ya quedaron detrás, alzan el
 * vuelo donde están, fuera de cuadro.
 */
export function slidesNow(act: FaunaAct, seconds: number, distance: number): boolean {
  const mode = SLIDE[act.behavior].mode;
  if (mode === 'siempre') return true;
  return mode === 'en vuelo' && distance > 0 && inFlight(act, seconds);
}

const LOCAL: Point3 = { x: 0, y: 0, z: 0 };
const WORLD: Point3 = { x: 0, y: 0, z: 0 };

function baseDistance(act: FaunaAct, viewer: Viewer): number {
  localToWorld(act.anchor, 0, 0, act.depth, WORLD);
  return forwardDistance(viewer, WORLD.x, WORLD.z);
}

/**
 * Un frame de seguimiento: desliza el ancla si toca, mira con la cámara real si
 * algún individuo está en cuadro y lleva la cuenta de si se le ha dejado atrás.
 * Es el **único escritor** de `act.anchor` y de su `track`.
 */
export function trackAct(
  act: FaunaAct,
  track: ActTrack,
  now: number,
  d: number,
  dt: number,
  viewer: Viewer,
): void {
  const seconds = now - act.startedAt;
  const advance = track.lastD === null ? 0 : d - track.lastD;
  track.lastD = d;

  const before = baseDistance(act, viewer);
  if (slidesNow(act, seconds, before)) {
    const push = slideStep(track.push, before, advance, SLIDE[act.behavior].min, dt);
    if (push !== track.push) {
      track.push = push;
      slidAnchor(act, push);
    }
  }
  track.distance = baseDistance(act, viewer);

  // Una luz apagada no se ve: la luciérnaga que terminó su acto ya no cuenta.
  // Ni lo que la niebla ya se ha tragado (`seen`).
  const lit = extrapolates(act.behavior) || seconds < act.duration;
  const radius = viewRadius(act.spec.size);
  let visible = false;
  for (let member = 0; lit && !visible && member < act.members; member += 1) {
    placeAt(act, member, seconds, LOCAL);
    localToWorld(act.anchor, LOCAL.x, LOCAL.y, LOCAL.z, WORLD);
    visible = seen(viewer, WORLD.x, WORLD.y, WORLD.z, radius);
  }
  track.visible = visible;
  track.everSeen ||= visible;

  // Dejado atrás: su punto base ya está a menos de PASSED_DISTANCE y nadie lo
  // ve. Cuenta en avance, desde lo más atrás que haya estado la cámara.
  if (SLIDE[act.behavior].mode === 'siempre' || visible || track.distance >= PASSED_DISTANCE) {
    track.passedFrom = null;
  } else {
    track.passedFrom = track.passedFrom === null ? d : Math.min(track.passedFrom, d);
  }

  track.state =
    seconds >= act.duration
      ? 'saliendo'
      : visible
        ? 'en cuadro'
        : track.passedFrom !== null
          ? 'dejado atrás'
          : track.everSeen
            ? 'fuera de cuadro'
            : 'entrando';
}

export type Retirement = 'tiempo' | 'dejado' | 'lejos' | 'seguridad';

/**
 * Cuánto tiene que avanzar la cámara, con el acto fuera de cuadro, para darlo
 * por dejado atrás. A los gorriones posados, nada: si siguieran ahí al alzar el
 * vuelo, pasarían junto a la cámara.
 */
export function passedAdvance(behavior: BehaviorName): number {
  return SLIDE[behavior].mode === 'en vuelo' ? 0 : PASSED_ADVANCE;
}

/**
 * Por qué se retira un acto en este frame, o null si sigue. **Nunca a la
 * vista**: con algún individuo en cuadro sólo lo retira la red de seguridad, y
 * no debería saltar nunca.
 */
export function retirement(
  act: FaunaAct,
  track: ActTrack,
  now: number,
  d: number,
  fogFar: number,
): Retirement | null {
  const seconds = now - act.startedAt;
  if (track.visible) {
    return seconds >= act.duration + OVERTIME_LIMIT + OVERTIME_FADE ? 'seguridad' : null;
  }
  if (seconds >= act.duration) return 'tiempo';
  if (track.passedFrom !== null && d - track.passedFrom >= passedAdvance(act.behavior)) return 'dejado';
  if (track.distance > Math.max(CAMERA_Z - act.depth, FOG_CAP * fogFar) + FAR_EXTRA) return 'lejos';
  return null;
}
