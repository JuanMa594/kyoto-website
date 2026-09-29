/**
 * El encuadre sobre el camino, como matemática pura.
 *
 * `CAMERA_BASE` es un encuadre **local**: cámara 22 unidades por detrás del
 * punto de interés y 2,3 por encima, ~6° de inclinación, horizonte al 32 %.
 * Aquí se lleva ese encuadre a cualquier punto del camino:
 *
 *   · el punto de interés es el eje en `d`, a 2,9 sobre el suelo del camino;
 *   · la cámara queda 22 unidades por detrás siguiendo su rumbo, a 5,2 sobre el
 *     terreno que tiene debajo;
 *   · **la inclinación queda acotada** a 3,5°–8,7° (horizonte al 25–40 %). En
 *     una cuesta, si la mirada se saliera de esa banda, se sube la cámara:
 *     nunca se inclina más. Altura e inclinación son dos mandos distintos.
 *
 * **El rumbo está acotado dos veces, contra el mareo**: en ángulo (±15°) y en
 * velocidad (12°/s). Y en los viajes rápidos el encuadre sigue una versión
 * filtrada del camino —paso bajo en rumbo y en desvío lateral, de ~0,5 s— que
 * recorta las curvas: a velocidad de viaje, seguirlas al pie de la letra sería
 * un zarandeo. A velocidad de scroll el filtro es casi transparente.
 *
 * Módulo puro: `bun run check:path` recorre el camino con él.
 */

import { clamp, damp, lerp, smoothstep } from '@/lib/procedural';
import { pathX, pathY, type PathFrame, type Point3 } from '@/scene/path/journeyPath';
import { GROUND_Y, groundY } from '@/scene/systems/elevation';

import { CAMERA_BASE } from './framing';

const DEG = Math.PI / 180;

const [, CAMERA_Y, CAMERA_Z] = CAMERA_BASE.position;
const [, TARGET_Y, TARGET_Z] = CAMERA_BASE.target;

/** Distancia horizontal de la cámara a su punto de interés. */
export const CAMERA_BACK = CAMERA_Z - TARGET_Z;
/** Altura del punto de interés sobre el suelo del camino. */
export const FOCUS_HEIGHT = TARGET_Y - GROUND_Y;
/** Altura de la cámara sobre el terreno que tiene debajo. */
export const CAMERA_HEIGHT = CAMERA_Y - GROUND_Y;

export const RIG_LIMITS = {
  maxYaw: 15 * DEG,
  maxYawRate: 12 * DEG,
  pitchMin: 3.5 * DEG,
  pitchMax: 8.7 * DEG,
} as const;

/** El rumbo mira la tangente promediada en ±10 unidades, no la puntual. */
const TANGENT_SPAN = 10;

/** Constante del filtro en reposo y en viaje (1/τ, en 1/s). */
const SETTLE_LAMBDA = 12;
const TRAVEL_LAMBDA = 2;

/** Entre estas velocidades (u/s) el filtro pasa de uno a otro. */
const SPEED_SETTLED = 15;
const SPEED_TRAVEL = 60;

export interface RigState {
  initialized: boolean;
  d: number;
  /** Velocidad de avance suavizada, u/s. */
  speed: number;
  /** Desvío lateral filtrado del punto de interés. */
  focusX: number;
  yaw: number;
  focus: Point3;
  camera: Point3;
  frame: PathFrame;
}

export function createRig(): RigState {
  return {
    initialized: false,
    d: 0,
    speed: 0,
    focusX: 0,
    yaw: 0,
    focus: { x: 0, y: 0, z: 0 },
    camera: { x: 0, y: 0, z: 0 },
    frame: { x: 0, y: 0, z: 0, yaw: 0 },
  };
}

/** El rumbo que pide el camino en `d`, ya acotado. */
export function pathYaw(d: number): number {
  const slope = (pathX(d + TANGENT_SPAN) - pathX(d - TANGENT_SPAN)) / (2 * TANGENT_SPAN);
  // Una rotación en Y lleva el −Z local hacia (−sen, −cos): para mirar hacia
  // donde avanza el camino, el rumbo es −atan de su pendiente.
  return clamp(-Math.atan(slope), -RIG_LIMITS.maxYaw, RIG_LIMITS.maxYaw);
}

/** Coloca el rig en `d` de golpe, sin filtros: la primera vez y sin movimiento. */
export function snapRig(rig: RigState, d: number): void {
  rig.initialized = true;
  rig.d = d;
  rig.speed = 0;
  rig.focusX = pathX(d);
  rig.yaw = pathYaw(d);
  place(rig);
}

/** Avanza el rig hasta `d` en `dt` segundos, con filtros y topes. */
export function stepRig(rig: RigState, d: number, dt: number): void {
  if (!rig.initialized || dt <= 0) {
    snapRig(rig, d);
    return;
  }

  rig.speed = damp(rig.speed, Math.abs(d - rig.d) / dt, 8, dt);
  const lambda = lerp(SETTLE_LAMBDA, TRAVEL_LAMBDA, smoothstep(SPEED_SETTLED, SPEED_TRAVEL, rig.speed));

  rig.focusX = damp(rig.focusX, pathX(d), lambda, dt);

  const wanted = damp(rig.yaw, pathYaw(d), lambda, dt);
  const maxStep = RIG_LIMITS.maxYawRate * dt;
  rig.yaw = clamp(
    rig.yaw + clamp(wanted - rig.yaw, -maxStep, maxStep),
    -RIG_LIMITS.maxYaw,
    RIG_LIMITS.maxYaw,
  );

  rig.d = d;
  place(rig);
}

function place(rig: RigState): void {
  const sin = Math.sin(rig.yaw);
  const cos = Math.cos(rig.yaw);
  const focusY = GROUND_Y + pathY(rig.d) + FOCUS_HEIGHT;

  rig.focus.x = rig.focusX;
  rig.focus.y = focusY;
  rig.focus.z = -rig.d;

  const cameraX = rig.focusX + CAMERA_BACK * sin;
  const cameraZ = -rig.d + CAMERA_BACK * cos;
  const lowest = focusY + CAMERA_BACK * Math.tan(RIG_LIMITS.pitchMin);
  const highest = focusY + CAMERA_BACK * Math.tan(RIG_LIMITS.pitchMax);

  rig.camera.x = cameraX;
  rig.camera.y = clamp(groundY(cameraX, cameraZ) + CAMERA_HEIGHT, lowest, highest);
  rig.camera.z = cameraZ;

  // El origen local es el punto que hace coincidir el objetivo de CAMERA_BASE
  // con el punto de interés: así la regla de tercios y las conductas de la
  // fauna, escritas en local, caen donde tienen que caer.
  rig.frame.yaw = rig.yaw;
  rig.frame.x = rig.focusX - TARGET_Z * sin;
  rig.frame.z = -rig.d - TARGET_Z * cos;
  rig.frame.y = focusY - TARGET_Y;
}
