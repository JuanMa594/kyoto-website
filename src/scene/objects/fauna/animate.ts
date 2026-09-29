/**
 * De la conducta al cuerpo: cómo se traduce una pose (dónde está el animal, a
 * qué velocidad va, si vuela) en los ángulos que dobla el shader.
 *
 * La conducta sólo dice **qué hace** el animal. Aquí se decide **cómo se le
 * nota**: una garza quieta en el suelo baja el cuello a pescar; una ardilla
 * quieta se sienta y olfatea; un gorrión en el aire recoge las patas y bate las
 * alas. Nada de eso se declara aparte: sale de la velocidad y de si pisa o no.
 *
 * Es un módulo puro, sin three ni React, para poder dibujar poses sueltas fuera
 * del navegador al calibrar las regiones de cada especie.
 */

import { clamp, damp, lerp, smoothstep } from '@/lib/procedural';
import type { FaunaPose } from '@/scene/systems/fauna/behaviors';
import type { SpeciesSpec } from '@/scene/systems/fauna/bestiary';

import type { DeformPose } from './deform';

/** Lo que tiene memoria entre frames: fases que se integran y valores que se amortiguan. */
export interface AnimMemory {
  stride: number;
  flap: number;
  tailSwing: number;
  /** 0 cola enroscada (parado), 1 estirada detrás (corriendo). */
  tailStream: number;
  /** Altura que le ha dado el viento, en largos de cuerpo, ya amortiguada. */
  windLift: number;
  neckYaw: number;
  sit: number;
  still: number;
  /** Segundos seguidos que lleva quieto. Marca el ritmo de la pesca. */
  stillTime: number;
}

export function createAnimMemory(): AnimMemory {
  return {
    stride: 0,
    flap: 0,
    tailSwing: 0,
    tailStream: 0,
    windLift: 0,
    neckYaw: 0,
    sit: 0,
    still: 0,
    stillTime: 0,
  };
}

/** Lo que el rig aplica al cuerpo entero, fuera del shader. */
export interface BodyPose {
  pitch: number;
  bank: number;
  /** Cuánto se levanta el cuerpo del suelo en este instante, en largos de cuerpo. */
  lift: number;
  /**
   * Aplastamiento sobre los pies: 0 nada, 0,1 un 10 % más bajo (y algo más
   * ancho, para que el volumen no cambie). La recepción del galope y el
   * respirar del gato dormido.
   */
  squash: number;
}

const TAU = Math.PI * 2;

/**
 * Un paso de animación. `delta` es el tiempo de este frame; `seconds`, el reloj
 * del acto; `gust`, la ráfaga del viento en este instante (0–1, `WIND.gust`).
 * Las fases se **integran** —nunca `tiempo × frecuencia`—, porque la frecuencia
 * cambia con la velocidad y ese producto saltaría entero.
 */
export function animate(
  spec: SpeciesSpec,
  pose: FaunaPose,
  seconds: number,
  delta: number,
  member: number,
  memory: AnimMemory,
  out: DeformPose,
  gust = 0,
): BodyPose {
  const profile = spec.deform!;
  const air = pose.airborne;
  const quadruped = profile.gait === 'trote' || profile.gait === 'galope';
  const bounding = profile.gait === 'galope' || profile.gait === 'brinco';

  // Cuánto avanza en largos de cuerpo por segundo: la misma velocidad es un
  // paseo para una garza y una carrera para una ardilla.
  const pace = pose.speed / spec.size;
  const moving = smoothstep(0.03, 0.7, pace) * (1 - air);

  // Quieto de verdad, en el suelo, un rato: amortiguado para que no parpadee
  // entre "anda" y "está parado" en cada vacilación.
  memory.still = damp(memory.still, (1 - smoothstep(0.02, 0.18, pace)) * (1 - air), 5, delta);
  const still = memory.still;
  memory.stillTime = still > 0.8 ? memory.stillTime + delta : 0;

  // ── Patas y cuerpo ──────────────────────────────────────────────────────
  // Un ciclo completo por cada paso o salto recorrido: las patas van al ritmo
  // al que el animal avanza de verdad, así que nunca patinan.
  //
  // El galope acorta la zancada a velocidad de persecución —un 15 % desde los
  // ~3 cuerpos por segundo a los que se persiguen—: más saltos por segundo y
  // más bajos, un ciclo continuo y pegado al suelo en vez de botes sueltos. Se
  // integra igual que siempre, así que cambiar el largo no hace saltar la fase.
  const galope = profile.gait === 'galope';
  // Quien trota al paso y galopa al correr (el gato): cuánto galopa ya. La
  // zancada se alarga con él, y como la fase se integra, sin saltos.
  const run = profile.run ? smoothstep(profile.run.from, profile.run.to, pace) * moving : 0;
  const bound = galope ? 1 : run;
  const strideLength = galope
    ? profile.stride * (1 - 0.15 * smoothstep(1.5, 3.5, pace))
    : profile.run
      ? lerp(profile.stride, profile.run.stride, run)
      : profile.stride;
  memory.stride = (memory.stride + (TAU * pose.speed * delta) / (strideLength * spec.size)) % TAU;
  out.stridePhase = memory.stride;
  out.legAmplitude = profile.legSwing * moving;
  out.tuck = air;
  out.gallop = run;

  // En galope y a saltitos el cuerpo **despega** media zancada y cae la otra
  // media: es lo que se ve de una ardilla o de un gorrión a veinte píxeles.
  // Al paso, sólo el leve sube y baja de cada apoyo.
  //
  // El vuelo es medio seno: sube frenando, se detiene sin pico en la cúspide y
  // cae acelerando. El galope cabecea poco —morro arriba al despegar, abajo al
  // caer—: un balanceo de peso, no un vaivén.
  const rock = Math.cos(memory.stride) * 0.07 * moving * bound;
  // Cabecear alrededor del pecho baja el extremo que cae: sin compensarlo, las
  // manos se hunden en el suelo al aterrizar. El pie más alejado del pivote
  // anda a unos 0,3 largos, así que se sube el cuerpo lo que ese pie baja.
  const lift =
    (bounding
      ? profile.hop * Math.max(0, Math.sin(memory.stride)) * moving
      : lerp(
          0.012 * Math.abs(Math.sin(memory.stride)),
          (profile.run?.hop ?? 0) * Math.max(0, Math.sin(memory.stride)),
          run,
        ) * moving) +
    0.3 * Math.abs(Math.sin(rock));
  // Al tocar suelo, el cuerpo **se comprime** antes de volver a impulsarse. La
  // media zancada de apoyo es de π a 2π; el aplastamiento empieza y acaba en
  // cero —empalma con el vuelo por los dos lados— y llega a su máximo al 40 %
  // del apoyo, poco después del contacto. El sesgo es un polinomio y no una
  // potencia: con v^0,7 la pendiente en el contacto era infinita y el cuerpo se
  // aplastaba de golpe en un frame.
  const stance = memory.stride > Math.PI ? (memory.stride - Math.PI) / Math.PI : 0;
  const landing = 0.09 * Math.sin(Math.PI * stance * (1.4 - 0.4 * stance)) * moving * bound;

  // ── Posturas del cuadrúpedo parado (el gato) ────────────────────────────
  // Sentarse, echarse y desperezarse no se deducen del movimiento: la
  // conducta las marca con el mismo reloj con el que lo para. El desperezo
  // tiene dos tiempos: manos al frente con el pecho al suelo, y luego las
  // patas traseras estiradas hacia atrás; cada uno empieza y acaba en cero.
  const postures = profile.postures;
  const sitting = postures ? pose.sitting : 0;
  const lying = postures ? pose.lying : 0;
  const sleeping = postures ? pose.sleeping : 0;
  const stretch = postures ? pose.stretching : 0;
  const reach = stretch > 0 && stretch < 0.55 ? Math.sin((Math.PI * stretch) / 0.55) : 0;
  const kick = stretch >= 0.55 ? Math.sin((Math.PI * (stretch - 0.55)) / 0.45) : 0;
  let posturePitch = 0;
  let postureLift = 0;
  if (postures) {
    out.legFront =
      -postures.sitTilt * sitting + postures.lieFront * lying + postures.reachFront * reach;
    out.legHind = postures.sitFold * sitting + postures.lieHind * lying - postures.kickHind * kick;
    posturePitch = postures.sitTilt * sitting - postures.reachTilt * reach + postures.kickTilt * kick;
    postureLift =
      -postures.sitDrop * sitting -
      postures.lieDrop * lying -
      postures.reachDrop * reach -
      postures.kickDrop * kick;
  } else {
    out.legFront = 0;
    out.legHind = 0;
  }
  // Echado, respira: el lomo sube y baja despacio, más despacio si duerme.
  const resting = Math.max(lying, sitting * 0.5);
  const breath = resting * 0.02 * Math.sin(seconds * (2.2 - 0.8 * sleeping));

  // ── Cola: persigue al cuerpo con retardo ────────────────────────────────
  const tailTarget =
    -pose.bank * 1.4 + Math.sin(seconds * 2.1 + member * 1.7) * (0.08 + 0.12 * moving);
  memory.tailSwing = damp(memory.tailSwing, tailTarget, 6, delta);
  out.tailSwing = memory.tailSwing;

  if (quadruped) {
    // Acompaña al salto: se levanta al despegar y ondea al caer.
    out.tailLift = Math.sin(memory.stride) * 0.16 * moving + still * (spec.sitsUp ? 0.25 : 0.05);
  } else if (profile.wings?.style === 'zumbido') {
    // El abdomen de la libélula sube y baja al volar suspendida.
    out.tailLift = Math.sin(seconds * 2.3 + member * 1.9) * 0.1;
  } else {
    // Los pájaros sacuden la cola de vez en cuando, y la bajan al volar.
    out.tailLift =
      Math.max(0, Math.sin(seconds * 1.6 + member * 2.3)) ** 10 * 0.35 * (1 - air) - air * 0.1;
  }
  // La ardilla corre con la cola **estirada** detrás, ondeando con cada salto,
  // y la enrosca al pararse. Cuenta como parada cualquier frenazo por debajo
  // de dos cuerpos por segundo: sus paradas duran medio segundo, y con un
  // umbral más bajo la cola se quedaba a medio enroscar, en gancho. Se estira
  // algo más rápido de lo que se recoge.
  if (profile.tail?.curl) {
    const target = smoothstep(0.4, 2, pace) * (1 - air);
    memory.tailStream = damp(memory.tailStream, target, target > memory.tailStream ? 6 : 4.5, delta);
    const stream = memory.tailStream;
    // Dos ondas con retardo creciente —base, luego punta—: una ola que recorre
    // la cola hacia atrás, en vez de un palo que sube y baja.
    out.tailLift =
      stream * (0.75 + 0.14 * Math.sin(memory.stride - 0.9)) +
      (1 - stream) * still * (spec.sitsUp ? 0.25 : 0.05);
    out.tailCurl = -stream * (0.65 + 0.22 * Math.sin(memory.stride - 2.1));
  } else {
    out.tailCurl = 0;
  }
  // El milano gobierna con la cola: la tuerce hacia dentro de la curva.
  out.tailRoll = profile.wings?.style === 'planeo' ? air * pose.bank * 0.5 : 0;

  // ── Cuello y cabeza ─────────────────────────────────────────────────────
  if (quadruped) {
    // Olfatea parado —golpes cortos de hocico— y cabecea con cada zancada.
    // Sentado o echado no olfatea: levanta la cabeza a mirar; y dormido la
    // apoya sobre las manos.
    const upright = Math.max(sitting, lying) * (1 - sleeping);
    out.neckPitch =
      (-still * (0.12 + 0.08 * Math.sin(seconds * 9 + member)) +
        Math.sin(memory.stride * 2) * 0.06 * moving) *
        (1 - Math.max(sitting, lying)) +
      upright * 0.08 -
      sleeping * 0.55;
  } else if (profile.gait === 'paso') {
    // La garza: cabeceo adelante-atrás con cada paso, y quieta, espera con el
    // cuello tenso hasta que golpea. Esperas largas, golpes secos.
    //
    // El golpe se cuenta desde que se paró, no con el reloj del acto: atado
    // al reloj, una parada podía caer entera entre dos golpes y la garza se
    // pasaba seis segundos "pescando" sin pescar nada. Así el primero llega a
    // los ~2,7 s de pararse, y después cada ~5 s.
    const waited = memory.stillTime - 1.5;
    const strike = waited > 0 ? Math.max(0, Math.sin(waited * 1.3)) ** 14 : 0;
    out.neckPitch = Math.sin(memory.stride) * 0.07 * moving - still * (0.28 + 0.85 * strike);
  } else if (profile.gait === 'brinco') {
    // Pájaro pequeño: picotazos rápidos y seguidos.
    out.neckPitch = -still * Math.max(0, Math.sin(seconds * 5.2 + member)) ** 3 * 0.9;
  } else {
    out.neckPitch = 0;
  }
  // Parado mira alrededor; dormido deja la cabeza ladeada, quieta.
  const lookTarget =
    still * Math.sin(seconds * 0.7 + member * 2) * 0.45 * (1 - sleeping) + sleeping * 0.3;
  memory.neckYaw = damp(memory.neckYaw, lookTarget, 3, delta);
  out.neckYaw = memory.neckYaw;

  // ── Erguirse (la ardilla) ───────────────────────────────────────────────
  memory.sit = damp(memory.sit, spec.sitsUp ? still * 0.55 : 0, 4, delta);
  out.sit = memory.sit;

  // ── Alas ────────────────────────────────────────────────────────────────
  const wings = profile.wings;
  if (!wings) {
    out.wingLift = 0;
  } else if (wings.style === 'planeo') {
    // Planeador: diedro leve que respira, y más cuando alabea. Cada nueve
    // segundos y medio, una tanda de aletazos lentos y hondos —tres o cuatro—
    // para recuperar altura, y vuelta a planear. La tanda va envuelta en un
    // seno que vale 0 al empezar y al acabar: las alas entran y salen del
    // planeo sin saltos.
    const cycle = (seconds + 4 + member * 3.1) % 9.5;
    const burst = cycle < 1.7 ? Math.sin((Math.PI * cycle) / 1.7) : 0;
    memory.flap = (memory.flap + TAU * wings.beat * delta) % TAU;
    const glide = 0.07 + 0.05 * Math.sin(seconds * 0.45 + member) + Math.abs(pose.bank) * 0.12;
    out.wingLift = glide + burst * (0.08 + 0.5 * Math.sin(memory.flap));
  } else if (wings.style === 'batido') {
    // Pájaro posado que vuela: las alas se abren a golpes, rápidos.
    memory.flap = (memory.flap + TAU * wings.beat * (0.6 + pose.effort) * delta) % TAU;
    out.wingLift = air * (0.15 + 1.1 * Math.max(0, Math.sin(memory.flap)));
  } else {
    // Zumbido: arriba y abajo sin descanso, simétrico, como una libélula
    // suspendida. Tan rápido que casi se lee como un temblor de las alas.
    memory.flap = (memory.flap + TAU * wings.beat * delta) % TAU;
    out.wingLift = 0.06 + Math.sin(memory.flap) * 0.5;
  }

  // ── Montar el viento ────────────────────────────────────────────────────
  // La ráfaga lo levanta despacio y lo deja caer despacio: el milano no sube
  // de golpe, lo lleva el aire. Mientras sube, levanta el pico; y con viento
  // fuerte se mece un poco de ala a ala, como en el aire revuelto.
  let windPitch = 0;
  let windRock = 0;
  if (spec.ridesWind) {
    const before = memory.windLift;
    memory.windLift = damp(memory.windLift, gust * spec.ridesWind, 0.7, delta);
    const climb = delta > 0 ? (memory.windLift - before) / delta : 0;
    windPitch = clamp(climb * 0.35, -0.15, 0.2);
    windRock = gust * 0.12 * Math.sin(seconds * 1.4 + member * 2.3);
  }

  return {
    pitch:
      clamp(pose.pitch * 0.6, -0.5, 0.5) +
      air * (spec.flightPitch ?? 0) +
      rock +
      windPitch +
      posturePitch,
    bank: pose.bank + windRock,
    lift: lift + memory.windLift + postureLift,
    squash: landing + breath,
  };
}
