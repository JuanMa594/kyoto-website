/**
 * Utilidades deterministas para geometría procedural.
 *
 * La regla del proyecto (§7 del PLAN) es generar los visuales por código, no
 * dibujarlos: así se animan por vértices, se instancian miles de veces y
 * reaccionan al input. Todo lo de aquí es determinista — mismo `seed`, misma
 * piedra — para que el servidor y el cliente produzcan lo mismo y no haya
 * saltos de hidratación.
 */

/** PRNG pequeño y rápido. Mismo seed, misma secuencia. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ondulación suave en función de la *dirección* del vértice, no de su índice.
 *
 * Importante: las geometrías de poliedro de three.js no están indexadas, así
 * que un vértice compartido aparece varias veces. Si se desplazara por índice
 * aleatorio, la malla se abriría por las costuras. Al depender sólo de (x,y,z)
 * normalizados, los duplicados reciben exactamente el mismo desplazamiento y
 * la piedra queda cerrada.
 */
export function directionalWobble(x: number, y: number, z: number, seed: number): number {
  const s = seed * 0.618;
  return (
    0.20 * Math.sin(3.1 * x + s) * Math.cos(2.7 * y - s) +
    0.13 * Math.sin(4.3 * z + s * 2) +
    0.07 * Math.cos(6.1 * (x + y + z) + s * 3)
  );
}

/** Interpolación lineal. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Recorta un valor a un rango. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Rampa suave entre dos bordes: 0 antes de `edge0`, 1 después de `edge1` y una
 * curva con derivada nula en los dos extremos en medio. Es la misma función que
 * GLSL trae de serie, y se usa en todo el proyecto para que nada arranque ni
 * frene de golpe — el relieve del terreno, la envolvente de las ráfagas.
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Amortiguación independiente del framerate. Es la base del parallax de cursor:
 * la cámara persigue al objetivo con inercia, nunca 1:1.
 */
export function damp(current: number, target: number, lambda: number, delta: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * delta));
}
