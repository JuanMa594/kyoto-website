/**
 * Las poses de la maqueta, como matemática pura (Fase 5A).
 *
 * Tres espacios encadenados: el **contenido** (el mapa, como lo escribe
 * `prefectures.generated.ts`), la **bandeja** (cara de arriba en y = 0) y el
 * **objeto** (origen al pie del atril). El zoom no mueve la cámara: escala y
 * desplaza el contenido dentro de la bandeja —los planos de recorte cortan lo
 * que sobra— y endereza un poco la bandeja. Todo sale de un solo número,
 * `t` (0 = Japón, 1 = Kinki), así que la escena y `check:path` ven lo mismo.
 */

import { lerp } from '@/lib/procedural';

import { MAQUETA_LIFT, MAQUETA_SIZE, MAQUETA_ZOOM } from './maqueta';
import { KYOTO_CITY, PREFECTURES } from './prefectures.generated';

/** Índice de Kyoto en `PREFECTURES`. */
export const KYOTO_INDEX = PREFECTURES.findIndex((p) => p.code === 26);

/** Los índices de las siete prefecturas de Kinki. */
export const KINKI: readonly number[] = PREFECTURES.flatMap((p, i) => (p.kinki ? [i] : []));

const IS_KINKI = PREFECTURES.map((p) => p.kinki);

/** Lo que cruza el rayo del cursor, de cerca a lejos. */
export interface SlabHit {
  /** De qué prefectura es la cara (`aPref`). */
  readonly pref: number;
  /** El grupo de la geometría de las losas: 0, las caras; 1, los cantos. */
  readonly group: number;
  /** Si cae dentro de la bandeja (lo de fuera, recortado, no se ve). */
  readonly inTray: boolean;
}

/**
 * La prefectura que elige el cursor (−1 si ninguna): la primera **cara** de
 * losa que cruza su rayo dentro de la bandeja; en el zoom (`t` > 0,5), sólo de
 * Kinki. Los cantos no cuentan: por el hueco del lago Biwa el rayo daba con
 * las paredes del agujero de Shiga, y el cursor sobre el agua levantaba Shiga.
 */
export function pickSlab(hits: Iterable<SlabHit>, t: number): number {
  for (const hit of hits) {
    if (!hit.inTray || hit.group !== 0) continue;
    if (t > 0.5 && !IS_KINKI[hit.pref]) continue;
    return hit.pref;
  }
  return -1;
}

/**
 * Cómo queda de frente a la cámara la maqueta en el zoom: el giro extra sobre
 * su rumbo (`yaw`) y la inclinación de la bandeja (`tilt`). Salen de dónde
 * está la cámara de la estación, que no se mueve: es la maqueta la que se
 * vuelve hacia ella para leerse de frente.
 */
export interface FaceAngles {
  readonly yaw: number;
  readonly tilt: number;
}

/** Lo que falta para quedar del todo de canto a la mirada: un pelo de relieve. */
const FACE_MARGIN = (3 * Math.PI) / 180;

/** Sin cámara (las comprobaciones de la pose): sólo se endereza. */
const NO_FACE: FaceAngles = { yaw: 0, tilt: MAQUETA_ZOOM.tiltKyoto };

/** Los ángulos para que la bandeja mire a `camera`, desde un objeto colocado. */
export function faceCamera(
  placed: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly scale: number },
  camera: { readonly x: number; readonly y: number; readonly z: number },
): FaceAngles {
  const dx = camera.x - placed.x;
  const dz = camera.z - placed.z;
  // El giro de three que lleva el +z del objeto hacia la cámara.
  let yaw = Math.atan2(dx, dz) - placed.yaw;
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  const dy = camera.y - (placed.y + MAQUETA_SIZE.pivotY * placed.scale);
  return { yaw, tilt: Math.atan2(Math.hypot(dx, dz), dy) - FACE_MARGIN };
}

export interface TrayPose {
  /** Inclinación de la bandeja hacia la cámara, en radianes. */
  tilt: number;
  /** Giro extra del objeto, sobre su rumbo, para quedar de frente. */
  yaw: number;
  /** Escala del contenido en el plano. */
  scale: number;
  /** Escala del grosor del contenido. */
  heightScale: number;
  /** Desplazamiento del contenido en la bandeja. */
  offsetX: number;
  offsetZ: number;
  /**
   * Lo que avanza la bandeja hacia la cámara al enderezarse: de pie, sin esto,
   * la columna del atril asomaba por delante del mapa.
   */
  forward: number;
}

/**
 * La pose para un `t`. El contenido se escala alrededor de Kyoto: con `t = 0`
 * queda tal cual, y con `t = 1` Kyoto cae en `MAQUETA_ZOOM.kyotoAt`.
 */
export function trayPose(t: number, face: FaceAngles = NO_FACE): TrayPose {
  const scale = lerp(1, MAQUETA_ZOOM.scale, t);
  const [kx, kz] = KYOTO_CITY;
  return {
    tilt: lerp(MAQUETA_ZOOM.tiltJapon, face.tilt, t),
    yaw: face.yaw * t,
    scale,
    heightScale: lerp(1, MAQUETA_ZOOM.heightScale, t),
    offsetX: lerp(kx, MAQUETA_ZOOM.kyotoAt[0], t) - kx * scale,
    offsetZ: lerp(kz, MAQUETA_ZOOM.kyotoAt[1], t) - kz * scale,
    forward: MAQUETA_ZOOM.forward * t,
  };
}

/** Del contenido a la bandeja, en el plano. */
export function contentToTray(x: number, z: number, pose: TrayPose, out: { x: number; z: number }): void {
  out.x = x * pose.scale + pose.offsetX;
  out.z = z * pose.scale + pose.offsetZ;
}

/**
 * De la bandeja al objeto: el giro en X de three (`rotation.x = tilt`) y la
 * subida hasta el eje. El borde sur (z > 0) baja hacia la cámara; el norte
 * sube.
 */
export function trayToObject(
  x: number,
  y: number,
  z: number,
  tilt: number,
  out: { x: number; y: number; z: number },
  forward = 0,
): void {
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  out.x = x;
  out.y = MAQUETA_SIZE.pivotY + y * cos - z * sin;
  out.z = forward + y * sin + z * cos;
}

/**
 * Lo que quiere cada losa para un `t` y una prefectura bajo el cursor
 * (`hover`, −1 si ninguna): cuánto sube (`lift`) y cuánto se funde con el
 * mar (`sea`). En el zoom, lo de fuera de Kinki se hunde un poco y se
 * desvanece en la bandeja: Japón se retira sin desaparecer de golpe.
 */
export function slabTargets(t: number, hover: number, lift: Float32Array, sea: Float32Array): void {
  for (let i = 0; i < IS_KINKI.length; i += 1) {
    const inKinki = IS_KINKI[i]!;
    let target = i === KYOTO_INDEX ? MAQUETA_LIFT.kyoto : inKinki ? 0 : MAQUETA_LIFT.sunk * t;
    if (i === hover) target += MAQUETA_LIFT.hover;
    lift[i] = target;
    sea[i] = inKinki ? 0 : MAQUETA_LIFT.sea * t;
  }
}
