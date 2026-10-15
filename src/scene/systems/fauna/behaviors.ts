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

import type { FaunaKind } from '@/config/journey';
import { clamp, lerp, mulberry32, smoothstep } from '@/lib/procedural';
import { bandCenterY, halfWidthAt, screenBandY } from '@/scene/camera/framing';
import { frameToWorld, type PathFrame, type Point3 } from '@/scene/path/journeyPath';
import { stoneTopY } from '@/scene/path/stoneSurface';
import { groundY } from '@/scene/systems/elevation';

import { catPlan, isAerial, type BehaviorName, type SpeciesSpec } from './bestiary';

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
  readonly seed: number;
  /**
   * El encuadre de la cámara al nacer (`PATH.frame`): el sitio del mundo donde
   * vive el acto. Sus conductas están escritas en coordenadas locales de él.
   */
  readonly origin: Readonly<PathFrame>;
  /**
   * Dónde está ahora: `origin`, salvo que lo que vuela se haya deslizado
   * (`anchoring.ts`). Es lo único que cambia de un acto y tiene un solo
   * escritor, `trackAct`. Lo leen el suelo (`groundAt`) y el grupo que lo dibuja.
   */
  readonly anchor: PathFrame;
  /** Profundidad de la cámara (`PATH.d`) cuando nació. */
  readonly spawnD: number;
  /** Aspecto de sus márgenes: el mayor entre el de la pantalla al nacer y 16:9. */
  readonly aspect: number;
  /**
   * El aspecto real de la pantalla al nacer, sin acotar. Con él ajusta el
   * milano sus círculos a un cuadro vertical (Fase 3C). Se fija al nacer: si se
   * gira el móvil a mitad de un acto, el acto no se recalcula —lo
   * teletransportaría—.
   */
  readonly viewAspect: number;
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
  /**
   * Posturas que no se deducen de la trayectoria —parado, un gato puede estar
   * de pie, sentado o dormido— y que la conducta marca con el mismo reloj con
   * el que lo para: 0–1 cada una, con entradas y salidas suaves.
   */
  sitting: number;
  lying: number;
  sleeping: number;
  /** Progreso del desperezo, 0–1 (0 fuera de él): primero las manos, luego las patas. */
  stretching: number;
  /**
   * Presencia de una luz, 0–1: las luciérnagas se encienden y se apagan en vez
   * de crecer y encogerse. 1 en todo lo demás.
   */
  fade: number;
}

export function createPose(): FaunaPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    // Sin rumbo todavía: el primer poseFor lo calcula aunque el animal no se
    // mueva (ver `aheadHeading`).
    heading: Number.NaN,
    pitch: 0,
    bank: 0,
    speed: 0,
    effort: 0,
    airborne: 1,
    glow: 1,
    scale: 1,
    sitting: 0,
    lying: 0,
    sleeping: 0,
    stretching: 0,
    fade: 1,
  };
}

type Point = Point3;

const WORLD = { x: 0, z: 0 };

/**
 * Dónde está el suelo, en las coordenadas locales del acto.
 *
 * Desde la Fase 3B el acto vive en el mundo, en su ancla (`act.anchor`): el
 * suelo se lee en su posición real, del mismo terreno que se dibuja, así que
 * nada flota ni se hunde en las cuestas, tampoco después de deslizarse. Y el
 * suelo de lo que pisa incluye las piedras del camino (`stoneTopY`): quien
 * cruza el camino pasa por encima de ellas, no a través.
 */
export function groundAt(act: FaunaAct, x: number, z: number): number {
  const frame = act.anchor;
  frameToWorld(frame, x, z, WORLD);
  return Math.max(groundY(WORLD.x, WORLD.z), stoneTopY(WORLD.x, WORLD.z)) - frame.y;
}

/**
 * La altura a la que queda el **centro del cuerpo** de un animal de pie: el
 * suelo más lo que levantan sus patas. Todo lo que camina la usa; si alguna
 * conducta se apoyara directamente en `groundAt`, el animal andaría enterrado
 * hasta el pecho.
 */
export function standingY(act: FaunaAct, x: number, z: number): number {
  return groundAt(act, x, z) + act.spec.ride * act.spec.size;
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

/**
 * Margen por el que un animal entra y sale de cuadro sin que se le vea
 * aparecer. Se mide con el aspecto del acto: en una pantalla más ancha que
 * 16:9 el cuadro es más ancho y el margen también. Quien quiera ajustarse a un
 * cuadro vertical pasa el aspecto real (`viewAspect`).
 */
function offscreenX(act: FaunaAct, z: number, size: number, aspect = act.aspect): number {
  return halfWidthAt(z, aspect) + 2 + size * 2;
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

/** Cuándo tocan suelo los gorriones que bajan a posarse, y cuándo alzan el vuelo (fracción del acto). */
const VISIT_LANDED = 0.3;
const VISIT_TAKEOFF = 0.84;

/** El radio más grande de los círculos del milano, y cuánto se aplastan en profundidad. */
const KITE_RADIUS_MAX = 8.5;
const KITE_DEPTH_SQUASH = 0.55;
/** Cuánto lo sube o lo baja la térmica (u/s), y en cuánto tiempo coge ese ritmo (s). */
const KITE_CLIMB = 1.4;
const KITE_CLIMB_EASE = 2;
/** Lo más que bajan sus oleajes respecto de su altura de crucero (suma de sus amplitudes). */
const KITE_SWELL = 1.2 + 0.8 + 0.25;
/** Lo que lo deriva el viento de lado mientras da vueltas (u/s). */
const KITE_DRIFT = 0.3;
/** Lo más que se estrechan los círculos del milano en un cuadro vertical. */
const KITE_FIT_FLOOR = 0.5;

/**
 * Cuánto se estrechan los círculos del milano con el cuadro: el medio ancho
 * visible es proporcional al aspecto, así que el cociente con el de 16:9 no
 * depende de la profundidad. Con un suelo: por debajo de la mitad los círculos
 * se cierran tanto que parece que gira sobre sí mismo (Fase 3C).
 */
export function kiteFit(viewAspect: number): number {
  return clamp(viewAspect / (16 / 9), KITE_FIT_FLOOR, 1);
}

/** Cruza el encuadre de lado a lado, con aleteos y planeos alternos. */
const cruzarVolando: Behavior = {
  place: (act, member, s, out) => {
    const t = s / act.duration;
    const z = act.depth - member * 0.9;
    const w = offscreenX(act, z, act.spec.size);

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

/**
 * Lo que sube (o baja) la térmica al milano a los `tau` segundos de empezar a
 * subir: arranca desde parado (derivada nula) y sigue a `KITE_CLIMB` u/s.
 */
function kiteRamp(tau: number): number {
  if (tau <= 0) return 0;
  return KITE_CLIMB * (tau - KITE_CLIMB_EASE * (1 - Math.exp(-tau / KITE_CLIMB_EASE)));
}

/** Su ritmo de subida en ese momento: la derivada de `kiteRamp`. */
function kiteRampRate(tau: number): number {
  return tau <= 0 ? 0 : KITE_CLIMB * (1 - Math.exp(-tau / KITE_CLIMB_EASE));
}

/**
 * Cuánto tiene que estar por encima de su altura de crucero para quedar fuera
 * de cuadro por arriba: del centro de la franja alta al borde superior, más lo
 * que bajan sus oleajes, su envergadura y un margen. Medido en el punto más
 * hondo de los círculos, donde el cuadro es más alto.
 */
function kiteHide(act: FaunaAct): number {
  const far = act.depth - KITE_RADIUS_MAX * KITE_DEPTH_SQUASH;
  return screenBandY(far, 0) - bandCenterY(far, 'alto') + 1 + KITE_SWELL + act.spec.size + 1.5;
}

/**
 * El tiempo que tarda la térmica en subirlo (o bajarlo) `kiteHide`: lo que dura
 * su entrada y su salida.
 */
function kiteLeg(act: FaunaAct): number {
  return kiteHide(act) / KITE_CLIMB + KITE_CLIMB_EASE;
}

/** Lo que le suma la térmica a su altura en `s`: bajando al entrar, subiendo al salir. */
function kiteThermal(act: FaunaAct, s: number): number {
  const leg = kiteLeg(act);
  return kiteRamp(leg - s) + kiteRamp(s - (act.duration - leg));
}

/** Espirales lentas del milano, muy arriba y muy al fondo. Nunca aterriza. */
const planearEnCirculos: Behavior = {
  place: (act, member, s, out) => {
    // En un cuadro vertical los círculos se estrechan con él (Fase 3C).
    const fit = kiteFit(act.viewAspect);
    const radius = (5 + jitter(act.seed, member, 1) * (KITE_RADIUS_MAX - 5)) * fit;
    const angle = act.direction * (s * 0.2 + member * 2.1) + act.seed;

    // Entra y sale **por arriba**, en la térmica: llega bajando en espiral desde
    // fuera de cuadro y se va subiendo en espiral hasta perderse, que es lo que
    // hace un milano de verdad. Antes entraba y salía por un costado, y para
    // cruzar las ~40 u que mide el cuadro a esa distancia en un quinto del acto
    // iba a 11 u/s: se le veía salir disparado. Subiendo no hay prisa ni fin —la
    // subida sigue después de su tiempo (`continuesOnItsOwn`)—, y mientras tanto
    // el viento lo deriva despacio hacia un lado.
    const center = act.direction * KITE_DRIFT * fit * (s - act.duration / 2);

    out.x = center + Math.cos(angle) * radius;
    out.z = act.depth + Math.sin(angle) * radius * KITE_DEPTH_SQUASH;
    // El aire no es parejo: sube en una térmica, cae en un bajón. Dos oleajes
    // de 7 y 15 s sobre la deriva lenta, para que en un solo acto se le vea
    // ganar y perder altura. El cabeceo sale solo de la trayectoria: sube con
    // el pico arriba y baja con el pico abajo. Las ráfagas del viento se suman
    // aparte, en el cuerpo (`ridesWind`), porque no son función del reloj.
    // Vuela algo por debajo del centro de la franja: es el hueco que necesita
    // la ráfaga para subirlo sin sacarlo del cuadro por arriba.
    out.y =
      bandCenterY(out.z, 'alto') -
      1 +
      Math.sin(s * 0.09 + member) * 1.2 +
      Math.sin(s * 0.42 + act.seed) * 0.8 +
      Math.sin(s * 0.87 + member * 2.1 + act.seed) * 0.25 +
      kiteThermal(act, s);
  },
  decorate: (act, _member, s, pose) => {
    // Casi sin esfuerzo: el tobi planea; los aletazos los pone el cuerpo.
    pose.effort = 0.05;
    pose.airborne = 1;

    // La térmica sube el aire, no el pico: lo que sube por ella no cuenta para
    // el cabeceo. Si contara, subiría encabritado a 45°.
    const leg = kiteLeg(act);
    const thermal = kiteRampRate(s - (act.duration - leg)) - kiteRampRate(leg - s);
    const rise = pose.speed * Math.sin(pose.pitch) - thermal;
    pose.pitch = clamp(Math.atan2(rise, pose.speed * Math.cos(pose.pitch)), -0.9, 0.9);
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
    const w = offscreenX(act, z, act.spec.size);
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
      [VISIT_LANDED, 0],
      [VISIT_TAKEOFF, 0],
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
      pose.effort = t > VISIT_TAKEOFF ? 1 : 0.65 + 0.35 * Math.sin(s * 5);
    } else {
      pose.effort = clamp(pose.speed / 0.7, 0, 1);
    }
  },
};

/**
 * La garza pescando: entra andando por la orilla, se para, espera, da unos
 * pasos más, vuelve a pararse y sigue su camino.
 *
 * Una garza no camina a velocidad constante: da un paso, se queda quieta, da
 * otro. Por eso la trayectoria tiene fotogramas clave intermedios aunque no se
 * pare en ellos — cada uno es una vacilación, y `track` los empalma frenando un
 * poco en cada uno. Las dos paradas largas son las de pesca: ahí la velocidad
 * cae a cero y el rig, al verla quieta en el suelo, baja el cuello a picotear.
 */
const vadear: Behavior = {
  place: (act, member, s, out) => {
    const t = s / act.duration;
    const z = act.depth + (jitter(act.seed, member, 20) - 0.5) * 1.2;
    const w = offscreenX(act, z, act.spec.size);
    const dir = act.direction;

    // Primera parada, un poco antes del centro; la segunda, un par de pasos
    // después. Nunca en el mismo sitio dos veces.
    const stop1 = -dir * (1.2 + jitter(act.seed, member, 21) * 2.2);
    const stop2 = stop1 + dir * (1.2 + jitter(act.seed, member, 22) * 1.1);

    // Tramos cortos: cada fotograma clave es una vacilación, y cuantos más
    // hay, más pareja es la marcha y más baja la punta de velocidad de cada
    // tramo. Con dos paradas largas en medio para pescar.
    out.x = track(t, [
      [0, -dir * w],
      [0.1, lerp(-dir * w, stop1, 0.35)],
      [0.2, lerp(-dir * w, stop1, 0.7)],
      [0.3, stop1],
      [0.42, stop1],
      [0.5, stop2],
      [0.62, stop2],
      [0.72, lerp(stop2, dir * w, 0.3)],
      [0.84, lerp(stop2, dir * w, 0.62)],
      [1, dir * w],
    ]);
    // La orilla serpentea **en función de por dónde va**, no del reloj. Si el
    // vaivén dependiera del tiempo, al pararse a pescar seguiría deslizándose
    // de lado, el rumbo —que sale del movimiento— apuntaría a la cámara y la
    // garza "intentaría girarse" en cada parada.
    out.z = z + Math.sin(out.x * 0.28 + act.seed) * 0.35;
    out.y = standingY(act, out.x, out.z);
  },
  decorate: (_act, _member, _s, pose) => {
    pose.airborne = 0;
    pose.effort = clamp(pose.speed / 0.8, 0, 1);
  },
};

/** La bandada de gorriones: van juntos, giran juntos y se asustan juntos. */
const bandada: Behavior = {
  place: (act, member, s, out) => {
    const t = s / act.duration;
    const z = act.depth + (jitter(act.seed, member, 6) - 0.5) * 3;
    const w = offscreenX(act, z, 1.5);

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
    // El margen de salida cubre también el vaivén lateral de abajo. Se mide con
    // el cuadro real: con el de 16:9, en vertical la ardilla pasaba dos tercios
    // del acto corriendo fuera de cuadro (Fase 3C). La duración no cambia, así
    // que en vertical corre más despacio en unidades del mundo —pero cruza la
    // pantalla, que es lo que se ve, a un ritmo parecido—.
    const w = offscreenX(act, act.depth, act.spec.size, act.viewAspect) + 0.6;
    const omega = 2 * Math.PI * 0.5;
    const pace = (2 * w) / act.duration;

    const distance = pace * (s - (0.93 / omega) * Math.sin(omega * s));

    out.x = act.direction * (-w + distance);
    // El zigzag depende de lo recorrido: parada, no se desvía.
    out.z = act.depth + Math.sin(distance * 0.3 + act.seed) * 0.55;
    // Los brincos no son cosa de la trayectoria sino del cuerpo: los pone el
    // galope del rig, uno por zancada.
    out.y = standingY(act, out.x, out.z);
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
    const w = offscreenX(act, depth, act.spec.size) + 3.4;
    const enter = track(t, [
      [0, -act.direction * w],
      [0.2, 0],
      [0.8, 0],
      [1, act.direction * w],
    ]);

    out.z = depth;
    out.x = enter + play;
    out.y = standingY(act, out.x, depth);
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
    const w = offscreenX(act, act.depth, act.spec.size) + 0.7;

    const progress = track(t, [
      [0, 0],
      [0.3, 0.38],
      [0.55, 0.42],
      [0.72, 0.62],
      [1, 1],
    ]);

    out.x = act.direction * lerp(-w, w, progress);
    // Serpentea con el avance: en la pausa se queda quieto de verdad.
    out.z = act.depth + Math.sin(progress * 5 + act.seed) * 0.7;
    out.y = standingY(act, out.x, out.z) + jitter(act.seed, member, 9) * 0.01;
  },
};

/**
 * Llegar a paso de crucero y frenar al final (u de 0 a 1). `track` frena en
 * cada fotograma clave; aquí la velocidad es pareja el 70 % del camino y sólo
 * se va a cero al llegar, como quien anda hasta un sitio y se para en él.
 */
function arrive(u: number): number {
  const cruise = 0.7;
  const k = 2 / (1 + cruise);
  const v = clamp(u, 0, 1);
  return v <= cruise ? k * v : 1 - (k / (2 * (1 - cruise))) * (1 - v) ** 2;
}

/** Lo mismo al revés: arrancar suave y seguir a paso de crucero. */
function depart(u: number): number {
  return 1 - arrive(1 - u);
}

/** Una postura que entra entre `a0` y `a1` y sale entre `b0` y `b1`. */
function spell(t: number, a0: number, a1: number, b0: number, b1: number): number {
  return smoothstep(a0, a1, t) * (1 - smoothstep(b0, b1, t));
}

/**
 * Los dos planes del gato que se paran de verdad: sentarse a mirar y
 * desperezarse, o echarse la siesta. Tiempos en fracción del acto; a la
 * salida le toca más que a la entrada porque cruza el cuadro entero. Todo el
 * gato de un acto sale del mismo reloj: la postura y la posición no pueden
 * contradecirse, porque las dos se leen aquí.
 */
const CAT_PLANS = {
  sentarse: {
    arrive: 0.27,
    leave: 0.69,
    sit: [0.29, 0.33, 0.52, 0.56],
    lie: null,
    sleep: null,
    stretch: [0.58, 0.68],
  },
  siesta: {
    arrive: 0.23,
    leave: 0.73,
    sit: null,
    lie: [0.24, 0.27, 0.6, 0.63],
    sleep: [0.29, 0.32, 0.54, 0.57],
    stretch: [0.64, 0.72],
  },
} as const;

/**
 * El juego de dos gatos: uno corre y el otro lo persigue, **dando vueltas**.
 *
 * Un giro se ve en tres dimensiones cuando el animal describe la curva —de
 * costado, de espaldas, del otro costado, de frente—, y se ve plano, como un
 * recorte que se voltea, cuando se da la vuelta en el sitio. Por eso este
 * recorrido no se escribe con posiciones sino con su **curvatura**, y la
 * posición sale de integrarla: una recta de entrada, un bucle completo que se
 * aleja de la cámara, un tramo recto, otro que se le acerca, y la salida. En
 * cada bucle la curvatura crece y mengua como 2·sen² —nula en los empalmes—,
 * así que el cuerpo se inclina hacia dentro de la curva sin tirones. El radio
 * más cerrado es ℓ/4π ≈ 1 unidad: un gato y medio.
 *
 * Se integra una vez por acto y se guarda; la conducta sigue siendo una
 * función del tiempo.
 */
interface PlayPath {
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly length: number;
}

const PLAY_PATHS = new WeakMap<FaunaAct, PlayPath>();
/** Largo de cada bucle, en unidades de mundo. */
const PLAY_LOOP = 12;
const PLAY_STEP = 0.02;
/** Lo que el perseguidor va por detrás, en segundos: pisa por donde ya pasó el otro. */
const PLAY_LAG = 0.75;

function playPath(act: FaunaAct): PlayPath {
  const cached = PLAY_PATHS.get(act);
  if (cached) return cached;

  // Se integra de izquierda a derecha; la dirección del acto lo refleja luego.
  const w = offscreenX(act, act.depth, act.spec.size) + 1;
  const firstLoopAt = -3.2 + jitter(act.seed, 0, 42) * 1.4;
  const between = 1.2 + jitter(act.seed, 0, 43) * 1.6;

  const xs: number[] = [];
  const zs: number[] = [];
  let x = -w;
  let z = 0;
  let heading = 0;
  // 0 entra · 1 bucle que se aleja · 2 recta · 3 bucle que se acerca · 4 sale
  let stage = 0;
  let into = 0;

  for (let guard = 0; guard < 20000; guard += 1) {
    xs.push(x);
    zs.push(z);
    if (stage === 4 && x >= w) break;

    let curvature = 0;
    if (stage === 1 || stage === 3) {
      const u = into / PLAY_LOOP;
      // z crece hacia la cámara: girar a menor rumbo es alejarse de ella.
      const turn = stage === 1 ? -1 : 1;
      curvature = turn * ((2 * Math.PI) / PLAY_LOOP) * 2 * Math.sin(Math.PI * u) ** 2;
    }
    const mid = heading + (curvature * PLAY_STEP) / 2;
    x += Math.cos(mid) * PLAY_STEP;
    z += Math.sin(mid) * PLAY_STEP;
    heading += curvature * PLAY_STEP;
    into += PLAY_STEP;

    if (stage === 0 && x >= firstLoopAt) {
      stage = 1;
      into = 0;
    } else if ((stage === 1 || stage === 3) && into >= PLAY_LOOP) {
      // Una vuelta entera exacta: sin arrastrar el error de la integración.
      stage += 1;
      into = 0;
      heading = 0;
    } else if (stage === 2 && into >= between) {
      stage = 3;
      into = 0;
    }
  }

  const path: PlayPath = {
    x: Float32Array.from(xs),
    z: Float32Array.from(zs),
    length: (xs.length - 1) * PLAY_STEP,
  };
  PLAY_PATHS.set(act, path);
  return path;
}

/**
 * El gato de Gion. Casi siempre anda, se para y sigue; pero unas veces se
 * sienta a mirar la calle y se despereza antes de irse, otras se echa a
 * dormir la siesta en mitad del callejón, y otras son dos, jugando a
 * perseguirse en círculos.
 *
 * Es una sola conducta con cuatro planes, y no cuatro conductas, a propósito:
 * el director reparte el peso por conducta, y cuatro le darían al gato el
 * cuádruple de apariciones que al tanuki y a las luciérnagas.
 */
const callejear: Behavior = {
  place: (act, member, s, out) => {
    const plan = catPlan(act.duration);
    if (plan === 'pasear') {
      // El paseo de siempre, con su duración de siempre.
      deambular.place(act, member, s, out);
      return;
    }

    if (plan === 'jugar') {
      const path = playPath(act);
      const own = Math.max(0, s - member * PLAY_LAG);
      // Recorre el camino entero en lo que dura el acto, a arrancones: la
      // velocidad ondea un 18 % sin llegar nunca a pararse.
      const pace = path.length / (act.duration - PLAY_LAG - 0.6);
      const arc =
        pace * (own - (0.18 / 1.1) * (Math.cos(1.1 * own + act.seed) - Math.cos(act.seed)));
      const at = clamp(arc, 0, path.length) / PLAY_STEP;
      const i = Math.min(path.x.length - 2, Math.floor(at));
      const f = at - i;
      out.x = act.direction * lerp(path.x[i]!, path.x[i + 1]!, f);
      out.z = act.depth + lerp(path.z[i]!, path.z[i + 1]!, f);
      out.y = standingY(act, out.x, out.z);
      return;
    }

    const timeline = CAT_PLANS[plan];
    const t = s / act.duration;
    const dir = act.direction;
    const w = offscreenX(act, act.depth, act.spec.size) + 0.7;
    // Se para antes del centro, del lado por el que entra: en un tercio, no en
    // mitad del cuadro.
    const stop = -dir * (1 + jitter(act.seed, member, 41) * 2.5);

    if (t <= timeline.arrive) {
      out.x = lerp(-dir * w, stop, arrive(t / timeline.arrive));
    } else if (t < timeline.leave) {
      out.x = stop;
    } else {
      out.x = lerp(stop, dir * w, depart((t - timeline.leave) / (1 - timeline.leave)));
    }
    // Serpentea con lo recorrido, no con el reloj: sentado, no se desliza.
    out.z = act.depth + Math.sin(out.x * 0.3 + act.seed) * 0.5;
    out.y = standingY(act, out.x, out.z);
  },
  decorate: (act, _member, s, pose) => {
    const plan = catPlan(act.duration);
    if (plan === 'pasear' || plan === 'jugar') return;
    const timeline = CAT_PLANS[plan];
    const t = s / act.duration;
    if (timeline.sit) pose.sitting = spell(t, ...timeline.sit);
    if (timeline.lie) pose.lying = spell(t, ...timeline.lie);
    if (timeline.sleep) pose.sleeping = spell(t, ...timeline.sleep);
    const [from, to] = timeline.stretch;
    pose.stretching = t > from && t < to ? (t - from) / (to - from) : 0;
  },
};

/** Mariposas y libélulas: cerca de la cámara y sin línea recta que valga. */
const revolotear: Behavior = {
  place: (act, member, s, out) => {
    const t = s / act.duration;
    const z = act.depth + Math.sin(s * 0.7 + member * 2) * 0.8;
    const w = offscreenX(act, z, 1);

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
      groundAt(act, out.x, out.z) +
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
    // Son luces: se encienden y se apagan en dos segundos, no crecen ni se
    // encogen (§5.3 del spec de 3B).
    pose.fade = smoothstep(0, 2, s) * (1 - smoothstep(act.duration - 2, act.duration, s));
    pose.scale = 1;
  },
};

const BEHAVIORS: Record<BehaviorName, Behavior> = {
  cruzarVolando,
  planearEnCirculos,
  visitaAlSuelo,
  vadear,
  bandada,
  correrYParar,
  perseguir,
  deambular,
  callejear,
  revolotear,
  titilar,
};

/* ── Dónde está cada individuo ──────────────────────────────────────────── */

/** Re-aceleración al seguir más allá del final (s), y tramo final cuya velocidad se mantiene. */
const EXIT_RAMP = 0.6;
const EXIT_SPAN = 0.15;
/**
 * Y además se va animando: gana velocidad con esta aceleración (u/s²) durante
 * este tiempo (s), hasta 4 u/s más. Visto de cerca, un acto que termina a la
 * vista sale en un par de segundos; visto de lejos tras retroceder mucho —el
 * cuadro mide allí decenas de unidades—, sin esto tardaría un minuto en salir.
 */
const EXIT_ACCEL = 0.4;
const EXIT_BOOST_TIME = 10;

/** Si un acto siguiera a la vista tanto tiempo (s) después de su fin, se funde en este otro. */
export const OVERTIME_LIMIT = 30;
export const OVERTIME_FADE = 1;

const exitFrom: Point = { x: 0, y: 0, z: 0 };
const exitTo: Point = { x: 0, y: 0, z: 0 };

/** ¿Sigue su camino al terminar su tiempo? Todo menos las luces, que se apagan. */
export function extrapolates(behavior: BehaviorName): boolean {
  return behavior !== 'titilar';
}

/**
 * ¿Su conducta ya está escrita más allá de su tiempo? El milano sigue subiendo
 * en la térmica sin fin: extrapolarlo en línea recta —y encima animándose— lo
 * sacaba disparado de lado, a 20 u/s.
 */
export function continuesOnItsOwn(behavior: BehaviorName): boolean {
  return behavior === 'planearEnCirculos';
}

/**
 * ¿Está el acto en el aire? Lo que sólo vuela, siempre; los gorriones que bajan
 * a posarse, sólo al llegar y al irse. Lo usa el ancla que se desliza.
 */
export function inFlight(act: FaunaAct, seconds: number): boolean {
  if (act.behavior === 'visitaAlSuelo') {
    const t = seconds / act.duration;
    return t < VISIT_LANDED || t > VISIT_TAKEOFF;
  }
  return isAerial(act.behavior);
}

/**
 * Dónde está un individuo, en las coordenadas locales de su acto.
 *
 * Dentro de su tiempo es su conducta, tal cual. **Más allá**, si alguien lo
 * sigue viendo —la cámara retrocedió y el cuadro se ensanchó—, no se encoge ni
 * desaparece: **sigue su camino** con la velocidad media del último 15 % del
 * acto, re-acelerando suave desde donde terminó (derivada nula en el empalme)
 * hasta salir de cuadro. Quien camina sigue pegado al suelo; quien vuela, a la
 * misma altura sobre él.
 */
export function placeAt(act: FaunaAct, member: number, seconds: number, out: Point): void {
  const behavior = BEHAVIORS[act.behavior];
  const s = Math.max(0, seconds);
  if (continuesOnItsOwn(act.behavior)) {
    behavior.place(act, member, s, out);
    return;
  }
  if (s <= act.duration || !extrapolates(act.behavior)) {
    behavior.place(act, member, Math.min(s, act.duration), out);
    return;
  }

  const span = act.duration * EXIT_SPAN;
  behavior.place(act, member, act.duration - span, exitFrom);
  behavior.place(act, member, act.duration, exitTo);

  const tau = s - act.duration;
  const along = tau - EXIT_RAMP * (1 - Math.exp(-tau / EXIT_RAMP));
  const vx = (exitTo.x - exitFrom.x) / span;
  const vz = (exitTo.z - exitFrom.z) / span;
  // Lo que gana al animarse, en la misma dirección: ½·a·τ² y después a ritmo
  // constante. Derivada nula en el empalme: no hay tirón.
  const boostTime = Math.min(tau, EXIT_BOOST_TIME);
  const boost =
    0.5 * EXIT_ACCEL * boostTime * boostTime + EXIT_ACCEL * EXIT_BOOST_TIME * (tau - boostTime);
  const speed = Math.hypot(vx, vz) || 1;
  out.x = exitTo.x + vx * along + (vx / speed) * boost;
  out.z = exitTo.z + vz * along + (vz / speed) * boost;
  // Conserva su altura **sobre el suelo**, no su altitud: quien camina sigue
  // pisando, y quien vuela no se mete en una colina que suba por el costado.
  const height = exitTo.y - standingY(act, exitTo.x, exitTo.z);
  out.y = standingY(act, out.x, out.z) + height;
}

/* ── De la trayectoria a la pose ────────────────────────────────────────── */

/** Separación de las muestras con las que se deriva orientación y velocidad. */
const DT = 0.05;

const before: Point = { x: 0, y: 0, z: 0 };
const here: Point = { x: 0, y: 0, z: 0 };
const after: Point = { x: 0, y: 0, z: 0 };
const ahead: Point = { x: 0, y: 0, z: 0 };

/**
 * El rumbo de quien todavía no se ha movido: hacia su **primer paso**, buscado
 * a saltos de una décima durante un segundo y medio; si ni así se mueve, hacia
 * donde avanza el acto.
 *
 * Sin esto un pose recién creado mira a +X por defecto, y el animal que entra
 * por la derecha empieza el acto girando 180° sobre sí mismo. Y tiene que ser
 * el primer paso, no un punto lejano: quien arranca en curva —las ardillas que
 * se persiguen— apuntaría a otro sitio y giraría igual.
 */
function aheadHeading(act: FaunaAct, member: number, s: number): number {
  const step = act.spec.size * 0.05;
  for (let lookAhead = 0.1; lookAhead <= 1.5; lookAhead += 0.1) {
    placeAt(act, member, s + lookAhead, ahead);
    const dx = ahead.x - here.x;
    const dz = ahead.z - here.z;
    if (Math.hypot(dx, dz) > step) return Math.atan2(-dz, dx);
  }
  return act.direction >= 0 ? 0 : Math.PI;
}

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
  // Sin tope por arriba: más allá de su tiempo el individuo sigue su camino.
  const s = Math.max(0, seconds);
  const early = Math.max(0, s - DT);

  placeAt(act, member, early, before);
  placeAt(act, member, s, here);
  placeAt(act, member, s + DT, after);

  out.x = here.x;
  out.y = here.y;
  out.z = here.z;

  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const dz = after.z - before.z;
  const flat = Math.hypot(dx, dz);
  const span = Math.max(1e-4, s + DT - early);

  out.speed = Math.hypot(dx, dy, dz) / span;

  // Una rotación en Y lleva el +X local hacia (cos, 0, −sen): de ahí el signo.
  // El rumbo sólo sigue al movimiento cuando hay movimiento de verdad. Parado,
  // la dirección de un desplazamiento minúsculo es ruido, y seguirla hace girar
  // al animal sobre sí mismo sin motivo.
  const moving = flat / span > 0.03;
  if (moving) out.heading = Math.atan2(-dz, dx);
  else if (Number.isNaN(out.heading)) out.heading = aheadHeading(act, member, s);
  out.pitch = clamp(Math.atan2(dy, Math.max(flat, 1e-3)), -0.9, 0.9);

  // El alabeo sale de cuánto tuerce la trayectoria. Con el animal parado, esa
  // torsión es la de dos desplazamientos casi nulos — puro ruido — y ladearlo
  // según ella lo haría bambolearse sin moverse.
  const headingIn = Math.atan2(-(here.z - before.z), here.x - before.x);
  const headingOut = Math.atan2(-(after.z - here.z), after.x - here.x);
  out.bank = moving ? clamp(angleDelta(headingOut, headingIn) * 1.6, -0.55, 0.55) : 0;

  // Por defecto el esfuerzo es la velocidad: quien va rápido, mueve más.
  out.effort = clamp(out.speed / 1.4, 0, 1);
  out.airborne = 0;
  out.glow = 1;
  out.sitting = 0;
  out.lying = 0;
  out.sleeping = 0;
  out.stretching = 0;
  out.fade = 1;

  // El reloj de la conducta no pasa de su duración: más allá, sólo se sigue el
  // camino (`placeAt`).
  const clock = Math.min(s, act.duration);
  const t = clock / act.duration;
  // Entra desde fuera de cuadro: crecer al empezar es sólo una red de
  // seguridad. Ya no se encoge al terminar —sale de cuadro—, salvo la red de
  // seguridad de la Fase 3B: si siguiera a la vista mucho después de su fin.
  const overtime = act.duration + OVERTIME_LIMIT;
  out.scale = smoothstep(0, 0.03, t) * (1 - smoothstep(overtime, overtime + OVERTIME_FADE, s));

  behavior.decorate?.(act, member, clock, out);
}
