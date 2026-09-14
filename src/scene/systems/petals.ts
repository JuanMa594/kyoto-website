/**
 * Reparto de los pétalos: cuántos, en qué capa y de qué color.
 *
 * Es un módulo puro y sin React a propósito — lo usan a la vez el sistema de
 * partículas y el panel de `/diagnostico`, que necesita enseñar exactamente los
 * mismos números que se están dibujando. Si la cuenta viviera dentro del
 * componente, el panel tendría que reimplementarla y acabarían mintiendo uno de
 * los dos.
 */

import type { Density, PetalKind, Station } from '@/config/journey';
import { readCssNumber, type ScenePalette } from '@/lib/css-vars';

export type PetalLayerName = 'frente' | 'medio' | 'fondo';

export interface PetalLayer {
  readonly name: PetalLayerName;
  /** Centro de la caja donde viven estos pétalos. */
  readonly center: readonly [number, number, number];
  /** Tamaño de esa caja: ancho, alto y profundidad. */
  readonly size: readonly [number, number, number];
  /** Tamaño base del pétalo en esta capa. */
  readonly scale: number;
  /** Velocidad de caída, en alturas de caja por segundo. */
  readonly fall: number;
  /** Velocidad de volteo. */
  readonly spin: number;
  /** Qué parte del total le toca. */
  readonly share: number;
}

/**
 * Densidad nominal en tier alto. Después la escala `selectParticleScale()` del
 * store, que ya combina tier, `prefers-reduced-motion` y modo 静.
 *
 * Son números modestos a propósito: la referencia es un cartel, no una tormenta
 * de nieve. Con partículas en el shader podríamos poner diez mil sin despeinar
 * la GPU — y el cuadro quedaría ilegible.
 */
const TOTAL_BY_DENSITY: Record<Density, number> = {
  ninguna: 0,
  baja: 70,
  media: 150,
  alta: 300,
};

let layers: readonly PetalLayer[] | null = null;

/**
 * Las tres capas de profundidad del §5.1 del PLAN.
 *
 * El frente y el medio se anclan a `--depth-front` y `--depth-mid`, que es
 * donde el sistema de diseño declara esas capas. La tercera **no** usa
 * `--depth-back` (−60): ahí es donde viven las montañas y las siluetas del
 * fondo, y un pétalo a esa distancia no llega ni a un píxel. Se queda a mitad
 * de camino, lo bastante lejos para leerse como profundidad y lo bastante cerca
 * para verse.
 */
export function petalLayers(): readonly PetalLayer[] {
  if (layers) return layers;

  const front = readCssNumber('--depth-front', 2.5);
  const mid = readCssNumber('--depth-mid', -12);

  layers = [
    {
      name: 'frente',
      // Entre la cámara y el sujeto: son los que de verdad venden la
      // profundidad, porque cruzan por delante de todo.
      //
      // Pocos y grandes, y el reparto es bajo a propósito: a esta distancia un
      // pétalo ocupa casi el 5 % del alto del cuadro, así que una docena ya se
      // lee como "está cayendo sakura" y dos docenas se leen como ruido. La
      // caja es además más ancha que el encuadre, de modo que en cada momento
      // sólo hay algo más de la mitad en pantalla.
      center: [0, 3, front],
      size: [18, 11, 5],
      scale: 0.27,
      fall: 0.19,
      spin: 1.5,
      share: 0.12,
    },
    {
      name: 'medio',
      center: [0, 3.5, mid],
      size: [34, 16, 12],
      scale: 0.2,
      fall: 0.13,
      spin: 1.1,
      share: 0.48,
    },
    {
      name: 'fondo',
      center: [0, 5, mid * 2.2],
      size: [62, 22, 16],
      scale: 0.17,
      fall: 0.1,
      spin: 0.8,
      share: 0.38,
    },
  ];

  return layers;
}

/** Total de pétalos vivos ahora mismo, ya escalado por calidad y a11y. */
export function petalTotal(station: Station, particleScale: number): number {
  if (station.ambient.petalKind === 'ninguna') return 0;
  return Math.round(TOTAL_BY_DENSITY[station.ambient.petals] * particleScale);
}

/** Cuántos le tocan a una capa concreta. */
export function petalCountFor(
  layer: PetalLayer,
  station: Station,
  particleScale: number,
): number {
  return Math.round(petalTotal(station, particleScale) * layer.share);
}

/**
 * Los dos colores de cada tipo de hoja: la cara iluminada y la de sombra. Al
 * voltear en el aire, el pétalo alterna entre las dos — es lo que hace que se
 * vean vivos en vez de como confeti de un solo tono.
 */
export function petalColors(kind: PetalKind, palette: ScenePalette): [string, string] {
  switch (kind) {
    case 'sakura':
      return [palette.sakuraPale, palette.sakura];
    case 'momiji':
      // Arce de otoño: del ámbar al rojo del torii.
      return [palette.kohaku, palette.shu];
    case 'bambu':
      return [palette.bambuPale, palette.bambu];
    case 'ninguna':
      return [palette.washi, palette.washi];
  }
}
