/**
 * El repertorio de conductas.
 *
 * Cada conducta es una **función pura del tiempo a una posición**. No hay
 * máquinas de estados ni clips: una garza no "reproduce" un aterrizaje, sigue
 * una trayectoria que baja hasta el suelo, se queda, y vuelve a subir. De ahí
 * salen gratis dos cosas que un clip no da: que el animal pueda encadenar
 * llegar → posarse → caminar → picotear → alzar el vuelo en un mismo acto, y
 * que **dos ardillas puedan perseguirse**, porque la segunda no es más que la
 * primera evaluada medio segundo antes.
 *
 * Nada de esto decide hacia dónde mira el animal ni cuánto aletea. Eso se
 * **deduce** de la propia trayectoria en `poseFor()`: la orientación sale de la
 * derivada, el alabeo de la curvatura y el esfuerzo de la velocidad. Así es
 * imposible que un animal mire hacia un lado y avance hacia otro, que es el
 * defecto que delata a una animación hecha a mano.
 *
 * Módulo puro y sin React: se comprueba fuera del navegador.
 */

import type { FaunaKind, StationEnvironment } from '@/config/journey';
import { clamp, lerp, mulberry32, smoothstep } from '@/lib/procedural';
import { bandCenterY, halfWidthAt, screenBandY } from '@/scene/camera/framing';
import { GROUND_Y, terrainHeight } from '@/scene/systems/elevation';

import type { BehaviorName, SpeciesSpec } from './bestiary';

export interface FaunaAct {
  readonly id: number;
  readonly species: FaunaKind;
  readonly spec: SpeciesSpec;
  readonly behavior: BehaviorName;
  readonly members: number;
  /** Segundos que dura el acto entero. */
  readonly duration: number;
  /** Reloj de escena en el que empezó. */
  readonly startedAt: number;
  /** 1 = de izquierda a derecha. */
  readonly direction: 1 | -1;
  /** Profundidad base del acto. */
  readonly depth: number;
  readonly environment: StationEnvironment;
  readonly seed: number;
}

export interface FaunaPose {
  x: number;
  y: number;
  z: number;
  /** Rotación en Y que hay que aplicar para que el morro apunte al avance. */
  heading: number;
  /** Cabeceo: positivo, subiendo. */
  pitch: number;
  /** Alabeo hacia el interior de la curva. */
  bank: number;
  /** Unidades por segundo. */
  speed: number;
  /** 0 quieto, 1 a tope. Alimenta el aleteo y la zancada. */
  effort: number;
  /** 1 en el aire, 0 pisando. */
  airborne: number;
  /** Sólo para la luciérnaga. */
  glow: number;
  /** Entradas y salidas, por si el acto empieza dentro de cuadro. */
  scale: number;
}

export function createPose(): FaunaPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 0,
    effort: 0,
    airborne: 1,
    glow: 1,
    scale: 1,
  };
}

interface Point {
  x: number;
  y: number;
  z: number;
}

/** Dónde está el suelo, en la misma función que dibuja el terreno. */
export function groundAt(x: number, z: number, env: StationEnvironment): number {
  return GROUND_Y + terrainHeight(x, z, env);
}

/**
 * La altura a la que queda el **centro del cuerpo** de un animal de pie: el
 * suelo más lo que levantan sus patas. Todo lo que camina la usa; si alguna
 * conducta se apoyara directamente en `groundAt`, el animal andaría enterrado
 * hasta el pecho.
 */
export function standingY(act: FaunaAct, x: number, z: number): number {
  return groundAt(x, z, act.environment) + act.spec.ride * act.spec.size;
}

/**
 * Interpola una magnitud entre fotogramas clave con arranque y frenada suaves.
 *
 * Es lo que permite escribir una visita al suelo como lo que es —una lista de
 * momentos: aquí aterriza, aquí camina, aquí se queda picoteando— sin que la
 * trayectoria dé un tirón en ninguna costura: en cada tramo la curva entra y
 * sale con derivada nula, así que dos tramos seguidos siempre empalman.
 */
export function track(t: number, keys: readonly (readonly [number, number])[]): number {
  const first = keys[0]!;
  if (t <= first[0]) return first[1];

  for (let i = 1; i < keys.length; i += 1) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (t <= b[0]) {
      return lerp(a[1], b[1], smoothstep(a[0], b[0], t));
    }
  }

  return keys[keys.length - 1]![1];
}

/** Margen por el que un animal entra y sale de cuadro sin que se le vea aparecer. */
function offscreenX(z: number, size: number): number {
  return halfWidthAt(z) + 2 + size * 2;
}

/** Ruido barato y estable por individuo, para que ninguno vaya clavado a otro. */
function jitter(seed: number, member: number, salt: number): number {
  return mulberry32(seed + member * 7919 + salt * 104729)();
}

type Place = (act: FaunaAct, member: number, seconds: number, out: Point) => void;

interface Behavior {
  readonly place: Place;
  /** Retoques que no se deducen de la trayectoria. */
  readonly decorate?: (act: FaunaAct, member: number, seconds: number, pose: FaunaPose) => void;
}

/* ── Las conductas ──────────────────────────────────────────────────────── */

/** Cruza el encuadre de lado a lado, con aleteos y planeos alternos. */
const cruzarVolando: Behavior = {
  place: (act, member, s, out) => {
    const t = s / act.duration;
    const z = act.depth - member * 0.9;
    const w = offscreenX(z, act.spec.size);

    out.z = z;
    out.x = act.direction * lerp(-w, w, t);
    out.y =
      bandCenterY(z, 'alto') +
      Math.sin(s * 0.7 + member * 1.3) * 0.55 -
      member * 0.3;
  },
  decorate: (_act, member, s, pose) => {
    // Un ave grande no bate sin parar: da unos aletazos y planea.
    pose.effort = 0.25 + 0.75 * smoothstep(-0.2, 0.6, Math.sin(s * 0.8 + member));
    pose.airborne = 1;
  },
};

/** Espirales lentas del milano, muy arriba y muy al fondo. Nunca aterriza. */
const planearEnCirculos: Behavior = {
  place: (act, member, s, out) => {
    const radius = 5 + jitter(act.seed, member, 1) * 3.5;
    const angle = act.direction * (s * 0.2 + member * 2.1) + act.seed;

    out.x = Math.cos(angle) * radius;
    out.z = act.depth + Math.sin(angle) * radius * 0.55;
    out.y = bandCenterY(out.z, 'alto') + Math.sin(s * 0.09 + member) * 1.6;
  },
  decorate: (_act, _member, _s, pose) => {
    // Alas fijas: el tobi planea, no bate.
    pose.effort = 0.05;
    pose.airborne = 1;
  },
};

/**
 * El acto completo: llega volando, frena, se posa, camina, picotea, camina otro
 * poco y alza el vuelo. Todo son fotogramas clave sobre la misma trayectoria.
 */
const visitaAlSuelo: Behavior = {
  place: (act, member, s, out) => {
    const t = s / act.duration;
    const z = act.depth + (jitter(act.seed, member, 2) - 0.5) * 1.6;
    const w = offscreenX(z, act.spec.size);
    const dir = act.direction;

    // Dónde toca suelo, y hasta dónde camina después.
    const landX = (jitter(act.seed, member, 3) - 0.5) * 3 - dir * 1.2;
    const walk1 = landX + dir * (0.8 + jitter(act.seed, member, 4) * 0.7);
    const walk2 = walk1 + dir * (0.5 + jitter(act.seed, member, 5) * 0.8);

    out.z = z;
    out.x = track(t, [
      [0, -dir * w],
      [0.2, landX],
      [0.3, landX],
      [0.52, walk1],
      [0.72, walk1],
      [0.84, walk2],
      [1, dir * w],
    ]);

    // Altura *sobre el suelo*, para que en Fushimi Inari la garza se pose en la
    // cuesta y no en el aire.
    const cruise = bandCenterY(z, 'alto') - standingY(act, 0, z);
    const height = track(t, [
      [0, cruise],
      [0.16, cruise * 0.35],
      [0.24, 0.12],
      [0.3, 0],
      [0.84, 0],
      [0.9, cruise * 0.4],
      [1, cruise],
    ]);

    out.y = standingY(act, out.x, z) + height;
  },
  decorate: (act, _member, s, pose) => {
    const t = s / act.duration;

    // Estar en el aire no es una fase declarada aparte: es, literalmente, no
    // tocar el suelo. Midiéndolo de la propia altura es imposible que el ave
    // mueva las patas mientras vuela o bata las alas mientras camina, que es lo
    // que pasa en cuanto la bandera y la trayectoria se llevan por separado.
    const height = pose.y - standingY(act, pose.x, pose.z);
    pose.airborne = smoothstep(0.05, 0.45, height);

    // En el suelo el esfuerzo lo marca el paso, que ya sale de la velocidad;
    // en el aire, el aleteo. Picoteando no hay ni lo uno ni lo otro.
    if (pose.airborne > 0.5) {
      // El despegue cuesta: aletazos fuertes.
      pose.effort = t > 0.84 ? 1 : 0.65 + 0.35 * Math.sin(s * 5);
    } else {
      pose.effort = clamp(pose.speed / 0.7, 0, 1);
    }
  },
};

/** La bandada de gorriones: van juntos, giran juntos y se asustan juntos. */
const bandada: Behavior = {
  place: (act, member, s, out) => {
    const t = s / act.duration;
    const z = act.depth + (jitter(act.seed, member, 6) - 0.5) * 3;
    const w = offscreenX(z, 1.5);

    // El viraje es común a todos: lo que convierte N pájaros en una bandada.
    const swerve = Math.sin(s * 0.85 + act.seed) * 1.1;
    const spreadX = (jitter(act.seed, member, 7) - 0.5) * 2.6;
    const spreadY = (jitter(act.seed, member, 8) - 0.5) * 1.4;

    out.z = z;
    out.x = act.direction * lerp(-w, w, t) + spreadX;
    out.y =
      bandCenterY(z, 'alto') +
      swerve +
      spreadY +
      Math.sin(s * 3.1 + member * 2.2) * 0.22;
  },
  decorate: (_act, member, s, pose) => {
    pose.effort = 0.8 + 0.2 * Math.sin(s * 9 + member);
    pose.airborne = 1;
  },
};

/**
 * Carreras cortas con paradas a olfatear.
 *
 * El truco está en no mover la ardilla a trompicones sino **integrar una
 * velocidad que casi se anula**: la distancia recorrida es `s − A·sen(ωs)/ω`,
 * cuya derivada es `1 − A·cos(ωs)`. Con A cerca de 1 la velocidad roza el cero
 * en cada ciclo —la ardilla se para— y nunca es negativa, así que jamás retrocede
 * ni da un salto.
 */
const correrYParar: Behavior = {
  place: (act, member, s, out) => {
    const z = act.depth + Math.sin(s * 0.5 + act.seed) * 0.55;
    const w = offscreenX(z, act.spec.size);
    const omega = 2 * Math.PI * 0.5;
    const pace = (2 * w) / act.duration;

    const distance = pace * (s - (0.93 / omega) * Math.sin(omega * s));
    const speed = pace * (1 - 0.93 * Math.cos(omega * s));

    out.z = z;
    out.x = act.direction * (-w + distance);
    // Brinca sólo cuando corre de verdad.
    out.y =
      standingY(act, out.x, z) +
      Math.abs(Math.sin(omega * s)) * 0.07 * clamp(speed / pace, 0, 1.6);
  },
};

/**
 * Dos individuos jugando: el segundo **es el primero medio segundo antes**.
 *
 * Perseguir no es una animación, es una relación. Evaluando la misma
 * trayectoria con un retardo se obtiene un perseguidor que corta las curvas
 * igual que el perseguido, con el retraso justo — que es exactamente lo que se
 * ve cuando dos ardillas se persiguen alrededor de un tronco.
 */
const perseguir: Behavior = {
  place: (act, member, s, out) => {
    const lag = 0.62;
    const own = s - member * lag;
    const t = s / act.duration;

    // El vaivén del juego, centrado en el cuadro…
    const play = Math.sin(own * 0.62 + act.seed) * 3.2;
    const depth = act.depth + Math.sin(own * 0.41 + 1.1) * 1.3;
    // …y por encima, la entrada y la salida por los costados. El margen suma la
    // amplitud del juego: si no, en el primer frame el vaivén puede dejar a una
    // de las dos ya dentro de cuadro, apareciendo de la nada.
    const w = offscreenX(depth, act.spec.size) + 3.4;
    const enter = track(t, [
      [0, -act.direction * w],
      [0.2, 0],
      [0.8, 0],
      [1, act.direction * w],
    ]);

    out.z = depth;
    out.x = enter + play;
    out.y = standingY(act, out.x, depth) + Math.abs(Math.sin(own * 3.4)) * 0.09;
  },
  decorate: (_act, member, _s, pose) => {
    // El que persigue va siempre un poco más lanzado.
    pose.effort = clamp(pose.speed / 1.6, 0, 1) * (member === 1 ? 1.1 : 1);
  },
};

/** El gato: pasea, se para un rato largo y sigue. */
const deambular: Behavior = {
  place: (act, member, s, out) => {
    const t = s / act.duration;
    const z = act.depth + Math.sin(s * 0.22 + act.seed) * 0.7;
    const w = offscreenX(z, act.spec.size);

    const progress = track(t, [
      [0, 0],
      [0.3, 0.38],
      [0.55, 0.42],
      [0.72, 0.62],
      [1, 1],
    ]);

    out.z = z;
    out.x = act.direction * lerp(-w, w, progress);
    out.y = standingY(act, out.x, z) + jitter(act.seed, member, 9) * 0.01;
  },
};

/** Mariposas y libélulas: cerca de la cámara y sin línea recta que valga. */
const revolotear: Behavior = {
  place: (act, member, s, out) => {
    const t = s / act.duration;
    const z = act.depth + Math.sin(s * 0.7 + member * 2) * 0.8;
    const w = offscreenX(z, 1);

    out.z = z;
    out.x =
      act.direction * lerp(-w, w, t) +
      Math.sin(s * 1.9 + member * 3.1) * 0.7 +
      Math.sin(s * 4.3) * 0.18;
    out.y =
      screenBandY(z, 0.55) +
      Math.sin(s * 1.3 + member) * 0.55 +
      Math.sin(s * 3.7 + member * 2) * 0.16;
  },
  decorate: (_act, _member, s, pose) => {
    // El ala no para aunque el bicho se quede suspendido.
    pose.effort = 1;
    pose.airborne = 1;
    pose.bank += Math.sin(s * 2.6) * 0.25;
  },
};

/** Luciérnagas: derivan bajo y se encienden cada una por su cuenta. */
const titilar: Behavior = {
  place: (act, member, s, out) => {
    const spreadX = (jitter(act.seed, member, 10) - 0.5) * 9;
    const spreadZ = (jitter(act.seed, member, 11) - 0.5) * 4;
    const phase = jitter(act.seed, member, 12) * 6.28;

    out.z = act.depth + spreadZ + Math.sin(s * 0.21 + phase) * 0.5;
    out.x = spreadX + Math.sin(s * 0.27 + phase) * 1.1;
    out.y =
      groundAt(out.x, out.z, act.environment) +
      0.35 +
      jitter(act.seed, member, 13) * 0.9 +
      Math.sin(s * 0.5 + phase) * 0.25;
  },
  decorate: (act, member, s, pose) => {
    const phase = jitter(act.seed, member, 12) * 6.28;
    // Cada una a su ritmo: una constelación que parpadea a la vez no es un
    // enjambre, es una guirnalda.
    pose.glow = 0.12 + 0.88 * Math.max(0, Math.sin(s * 1.6 + phase)) ** 2;
    pose.effort = 1;
    pose.airborne = 1;
  },
};

const BEHAVIORS: Record<BehaviorName, Behavior> = {
  cruzarVolando,
  planearEnCirculos,
  visitaAlSuelo,
  bandada,
  correrYParar,
  perseguir,
  deambular,
  revolotear,
  titilar,
};

/* ── De la trayectoria a la pose ────────────────────────────────────────── */

/** Separación de las muestras con las que se deriva orientación y velocidad. */
const DT = 0.05;

const before: Point = { x: 0, y: 0, z: 0 };
const here: Point = { x: 0, y: 0, z: 0 };
const after: Point = { x: 0, y: 0, z: 0 };

/** Diferencia de ángulos, llevada a −π…π. */
function angleDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * La pose completa de un individuo en un instante.
 *
 * Orientación, cabeceo, alabeo y velocidad **no se escriben a mano**: se sacan
 * de tres muestras de la propia trayectoria. Es lo que garantiza que el bicho
 * siempre mire hacia donde va, se incline hacia dentro de la curva y mueva las
 * patas al ritmo al que realmente avanza.
 */
export function poseFor(act: FaunaAct, member: number, seconds: number, out: FaunaPose): void {
  const behavior = BEHAVIORS[act.behavior];
  const s = clamp(seconds, 0, act.duration);

  behavior.place(act, member, Math.max(0, s - DT), before);
  behavior.place(act, member, s, here);
  behavior.place(act, member, Math.min(act.duration, s + DT), after);

  out.x = here.x;
  out.y = here.y;
  out.z = here.z;

  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const dz = after.z - before.z;
  const flat = Math.hypot(dx, dz);
  const span = Math.max(1e-4, Math.min(act.duration, s + DT) - Math.max(0, s - DT));

  out.speed = Math.hypot(dx, dy, dz) / span;

  // Una rotación en Y lleva el +X local hacia (cos, 0, −sen): de ahí el signo.
  if (flat > 1e-4) out.heading = Math.atan2(-dz, dx);
  out.pitch = clamp(Math.atan2(dy, Math.max(flat, 1e-3)), -0.9, 0.9);

  const headingIn = Math.atan2(-(here.z - before.z), here.x - before.x);
  const headingOut = Math.atan2(-(after.z - here.z), after.x - here.x);
  out.bank = clamp(angleDelta(headingOut, headingIn) * 1.6, -0.55, 0.55);

  // Por defecto el esfuerzo es la velocidad: quien va rápido, mueve más.
  out.effort = clamp(out.speed / 1.4, 0, 1);
  out.airborne = 0;
  out.glow = 1;

  const t = s / act.duration;
  out.scale = smoothstep(0, 0.03, t) * (1 - smoothstep(0.97, 1, t));

  behavior.decorate?.(act, member, s, out);
}
