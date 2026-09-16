/**
 * El encuadre, como matemática pura.
 *
 * Vive aparte de `CameraRig.tsx` para que lo puedan usar módulos que no son de
 * React —las conductas de la fauna, sin ir más lejos— y para que se pueda
 * comprobar fuera del navegador. El rig lo importa de aquí; no hay dos copias.
 *
 * Su razón de ser es la **regla de tercios** del proyecto: el tercio superior es
 * de las copas y de lo que vuela, el medio del texto, el inferior del camino y
 * de lo que anda. Esa regla está escrita en fracciones de pantalla, pero la
 * escena necesita metros. Traducir una por otra a ojo es cómo se acaba con una
 * garza cruzando por encima del título.
 */

export interface CameraFraming {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export const CAMERA_BASE: CameraFraming = {
  position: [0, 4.2, 13],
  target: [0, 1.9, -9],
  fov: 34,
};

/** Las tres franjas de la regla de tercios, en fracción desde arriba. */
export const BANDS = {
  alto: [0, 0.3],
  medio: [0.3, 0.65],
  bajo: [0.65, 1],
} as const;

const dx = CAMERA_BASE.target[0] - CAMERA_BASE.position[0];
const dy = CAMERA_BASE.target[1] - CAMERA_BASE.position[1];
const dz = CAMERA_BASE.target[2] - CAMERA_BASE.position[2];
const length = Math.hypot(dx, dy, dz);

/** Vector unitario de la mirada. */
const DIR = { x: dx / length, y: dy / length, z: dz / length };

const HALF_FOV = (CAMERA_BASE.fov * Math.PI) / 360;

/**
 * Distancia a lo largo del eje de la cámara hasta el plano de profundidad `z`.
 *
 * No es `13 − z`: la cámara mira algo hacia abajo, así que avanzar un metro por
 * su eje acerca un poco menos de un metro en Z. El factor es pequeño (~0,5 %)
 * pero es gratis tenerlo bien.
 */
export function axisDistance(z: number): number {
  return Math.max(0.5, (CAMERA_BASE.position[2] - z) / -DIR.z);
}

/** Medio alto visible, en unidades de mundo, a esa profundidad. */
export function halfHeightAt(z: number): number {
  return Math.tan(HALF_FOV) * axisDistance(z);
}

/**
 * Medio ancho visible. Depende del aspecto de la pantalla, así que por defecto
 * asume 16:9 — el caso que hay que respetar para que nada entre por un lado
 * antes de tiempo. En pantallas más anchas sobra margen, no falta.
 */
export function halfWidthAt(z: number, aspect = 16 / 9): number {
  return halfHeightAt(z) * aspect;
}

/** Altura del centro del cuadro a esa profundidad. */
export function centerYAt(z: number): number {
  return CAMERA_BASE.position[1] + DIR.y * axisDistance(z);
}

/**
 * La Y del mundo que cae en `fromTop` (0 = borde superior, 1 = borde inferior)
 * a la profundidad `z`.
 */
export function screenBandY(z: number, fromTop: number): number {
  return centerYAt(z) + halfHeightAt(z) * (1 - 2 * fromTop);
}

/**
 * En qué fracción de pantalla —desde arriba— cae un punto del mundo. Es la
 * inversa de `screenBandY`, y es con lo que se comprueba que nada se sale de su
 * franja.
 */
export function screenFraction(z: number, y: number): number {
  return (1 - (y - centerYAt(z)) / halfHeightAt(z)) / 2;
}

/** Punto medio de una franja, útil para colocar algo "en el tercio de arriba". */
export function bandCenterY(z: number, band: keyof typeof BANDS): number {
  const [from, to] = BANDS[band];
  return screenBandY(z, (from + to) / 2);
}
