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

import { clamp, damp, smoothstep } from '@/lib/procedural';
import type { FaunaPose } from '@/scene/systems/fauna/behaviors';
import type { SpeciesSpec } from '@/scene/systems/fauna/bestiary';

import type { DeformPose } from './deform';

/** Lo que tiene memoria entre frames: fases que se integran y valores que se amortiguan. */
export interface AnimMemory {
  stride: number;
  flap: number;
  tailSwing: number;
  neckYaw: number;
  sit: number;
  still: number;
  /** Segundos seguidos que lleva quieto. Marca el ritmo de la pesca. */
  stillTime: number;
}

export function createAnimMemory(): AnimMemory {
  return { stride: 0, flap: 0, tailSwing: 0, neckYaw: 0, sit: 0, still: 0, stillTime: 0 };
}

/** Lo que el rig aplica al cuerpo entero, fuera del shader. */
export interface BodyPose {
  pitch: number;
  bank: number;
}

const TAU = Math.PI * 2;

/**
 * Un paso de animación. `delta` es el tiempo de este frame; `seconds`, el reloj
 * del acto. Las fases se **integran** —nunca `tiempo × frecuencia`—, porque la
 * frecuencia cambia con la velocidad y ese producto saltaría entero.
 */
export function animate(
  spec: SpeciesSpec,
  pose: FaunaPose,
  seconds: number,
  delta: number,
  member: number,
  memory: AnimMemory,
  out: DeformPose,
): BodyPose {
  const profile = spec.deform!;
  const air = pose.airborne;
  const quadruped = profile.pairs === 2;

  // Cuánto avanza en largos de cuerpo por segundo: la misma velocidad es un
  // paseo para una garza y una carrera para una ardilla.
  const pace = pose.speed / spec.size;
  const moving = smoothstep(0.03, 0.7, pace) * (1 - air);

  // Quieto de verdad, en el suelo, un rato: amortiguado para que no parpadee
  // entre "anda" y "está parado" en cada vacilación.
  memory.still = damp(memory.still, (1 - smoothstep(0.02, 0.18, pace)) * (1 - air), 5, delta);
  const still = memory.still;
  memory.stillTime = still > 0.8 ? memory.stillTime + delta : 0;

  // ── Patas ───────────────────────────────────────────────────────────────
  memory.stride = (memory.stride + (TAU * pose.speed * delta) / (profile.stride * spec.size)) % TAU;
  out.stridePhase = memory.stride;
  out.legAmplitude = profile.legSwing * moving;
  out.tuck = air;

  // ── Cola: persigue al cuerpo con retardo ────────────────────────────────
  const tailTarget =
    -pose.bank * 1.4 + Math.sin(seconds * 2.1 + member * 1.7) * (0.08 + 0.12 * moving);
  memory.tailSwing = damp(memory.tailSwing, tailTarget, 6, delta);
  out.tailSwing = memory.tailSwing;
  out.tailLift = quadruped
    ? Math.sin(memory.stride) * 0.14 * moving + still * (spec.sitsUp ? 0.25 : 0.05)
    : // Los pájaros sacuden la cola de vez en cuando, y la bajan al volar.
      Math.max(0, Math.sin(seconds * 1.6 + member * 2.3)) ** 10 * 0.35 * (1 - air) - air * 0.1;
  // El milano gobierna con la cola: la tuerce hacia dentro de la curva.
  out.tailRoll = air * pose.bank * 0.5;

  // ── Cuello y cabeza ─────────────────────────────────────────────────────
  if (quadruped) {
    // Olfatea parado —golpes cortos de hocico— y cabecea al trote.
    out.neckPitch =
      -still * (0.12 + 0.08 * Math.sin(seconds * 9 + member)) +
      Math.sin(memory.stride * 2) * 0.05 * moving;
  } else if (profile.stride > 0.3) {
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
  } else {
    // Pájaro pequeño: picotazos rápidos y seguidos.
    out.neckPitch = -still * Math.max(0, Math.sin(seconds * 5.2 + member)) ** 3 * 0.9;
  }
  const lookTarget = still * Math.sin(seconds * 0.7 + member * 2) * 0.45;
  memory.neckYaw = damp(memory.neckYaw, lookTarget, 3, delta);
  out.neckYaw = memory.neckYaw;

  // ── Erguirse (la ardilla) ───────────────────────────────────────────────
  memory.sit = damp(memory.sit, spec.sitsUp ? still * 0.55 : 0, 4, delta);
  out.sit = memory.sit;

  // ── Alas ────────────────────────────────────────────────────────────────
  if (profile.wings) {
    if (profile.pairs === 1 && profile.legSwing === 0) {
      // Planeador: diedro leve que respira, y más cuando alabea.
      out.wingLift = 0.07 + 0.05 * Math.sin(seconds * 0.45 + member) + Math.abs(pose.bank) * 0.12;
    } else {
      // Pájaro posado que vuela: las alas se abren a golpes, rápidos.
      memory.flap = (memory.flap + TAU * 8 * (0.6 + pose.effort) * delta) % TAU;
      out.wingLift = air * (0.15 + 1.1 * Math.max(0, Math.sin(memory.flap)));
    }
  } else {
    out.wingLift = 0;
  }

  return {
    pitch: clamp(pose.pitch * 0.6, -0.5, 0.5) + air * (spec.flightPitch ?? 0),
    bank: pose.bank,
  };
}
