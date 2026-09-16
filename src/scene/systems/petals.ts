/**
 * Reparto de los pétalos: cuántos, en qué capa, de qué color — y cuántos más
 * durante una ráfaga.
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
 * Presupuesto máximo de pétalos vivos, en tier alto. Es el 100 %: lo que se ve
 * en la sakura de eventos y el techo que ninguna zona pasa ni en ráfaga.
 *
 * Es un número modesto a propósito. Con la posición calculada en el shader
 * podríamos poner diez mil sin despeinar la GPU — y el cuadro quedaría
 * ilegible. La referencia es un cartel, no una tormenta de nieve.
 */
export const PETAL_MAX_TOTAL = 300;

/**
 * Qué fracción del presupuesto le toca a cada densidad de `journey.ts`.
 *
 * `alta` es la temporada de sakura y nada más: es el único momento del año en
 * que la ciudad está de verdad cubierta, así que es el único sitio donde el
 * ambiente puede permitirse ser el protagonista. El resto son **fondos
 * pasivos** — lo justo para que el aire no esté muerto mientras se lee.
 */
const DENSITY_FRACTION: Record<Density, number> = {
  ninguna: 0,
  baja: 0.2,
  media: 0.35,
  alta: 1,
};

/** Cuánto sube la densidad en el pico de una ráfaga: el doble de la base. */
const GUST_PEAK_MULTIPLIER = 2;

/**
 * Recorte de la capa delantera en las zonas de ambiente pasivo.
 *
 * Un pétalo de primer plano ocupa casi el 5 % del alto del cuadro, y ahí es
 * justo donde caen el título y el texto. En eventos eso es el efecto buscado;
 * en el resto de estaciones sobra, así que la capa más cercana lleva un 20 %
 * menos. La condición no mira el slug de ninguna estación —eso rompería que
 * `journey.ts` sea la fuente única de verdad— sino su densidad: la única zona
 * que llega al 100 % es la sakura.
 */
const FRONT_TRIM = 0.8;

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
      // Pocos y grandes, y el reparto es bajo a propósito: a esta distancia una
      // docena ya se lee como "está cayendo sakura" y dos docenas se leen como
      // ruido. La caja es además más ancha que el encuadre, de modo que en cada
      // momento sólo hay algo más de la mitad en pantalla.
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
      share: 0.4,
    },
  ];

  return layers;
}

/**
 * Avance de la ráfaga de densidad, 0 en reposo y 1 en el pico.
 *
 * Mismo criterio que `WIND` y `PARALLAX`: cambia durante toda la ráfaga y
 * meterlo en el store sería un render por frame. Lo escribe únicamente el
 * `<GustSurge>` del sistema de pétalos —con una tween de GSAP, para que la
 * vuelta a la calma sea lenta y no un corte—, y lo leen las capas y el panel de
 * `/diagnostico`.
 */
export const PETAL_SURGE = { value: 0 };

/** Fracción del presupuesto que tiene esta zona en reposo, 0–1. */
export function petalBaseFraction(station: Station): number {
  if (station.ambient.petalKind === 'ninguna') return 0;
  return DENSITY_FRACTION[station.ambient.petals];
}

/**
 * Fracción en el pico de la ráfaga. El tope en 1 tiene una consecuencia
 * buscada: **en eventos no cambia nada**, porque la sakura ya está al máximo.
 * La ráfaga levanta las zonas pasivas, no desborda la que ya estaba llena.
 */
export function petalPeakFraction(station: Station): number {
  return Math.min(1, petalBaseFraction(station) * GUST_PEAK_MULTIPLIER);
}

/**
 * Instancias que se reservan para una capa: las del pico, porque el buffer se
 * dimensiona una vez y luego sólo se mueve cuántas se dibujan. Reservar de
 * menos obligaría a reconstruir la geometría en mitad de una ráfaga.
 */
export function petalAllocation(
  layer: PetalLayer,
  station: Station,
  particleScale: number,
): number {
  const trim = layer.name === 'frente' && petalBaseFraction(station) < 1 ? FRONT_TRIM : 1;
  return Math.round(PETAL_MAX_TOTAL * petalPeakFraction(station) * particleScale * layer.share * trim);
}

/**
 * Margen en el que los pétalos del borde de la densidad entran y salen
 * encogiendo, en vez de aparecer de golpe. Lo aplica el shader comparando el
 * índice de cada instancia con la densidad actual; aquí se suma a la cuenta
 * dibujada para que esos que están a medio desvanecer sigan entrando en el
 * draw call.
 */
export const PETAL_FADE_BAND = 0.08;

/**
 * Fracción de la reserva que está presente ahora mismo, 0–1. Es lo que el
 * shader recibe como `uDensity`.
 */
export function petalPresence(station: Station, surge: number): number {
  const peak = petalPeakFraction(station);
  if (peak <= 0) return 0;

  const base = petalBaseFraction(station);
  return (base + (peak - base) * surge) / peak;
}

/** Cuántos pétalos se ven ahora mismo en una capa. */
export function petalPresentCount(
  layer: PetalLayer,
  station: Station,
  particleScale: number,
  surge: number,
): number {
  return Math.round(petalAllocation(layer, station, particleScale) * petalPresence(station, surge));
}

/**
 * Cuántos entran en el draw call: los que se ven **más la banda de los que
 * están a medio desvanecer**. Es la cuenta que necesita la GPU, no la que
 * describe lo que se percibe — para eso está `petalPresentCount`.
 */
export function petalDrawCount(
  layer: PetalLayer,
  station: Station,
  particleScale: number,
  surge: number,
): number {
  const allocation = petalAllocation(layer, station, particleScale);
  const presence = petalPresence(station, surge);

  return Math.min(allocation, Math.ceil(allocation * (presence + PETAL_FADE_BAND)));
}

/** Total visible ahora mismo, ya escalado por calidad y accesibilidad. */
export function petalTotal(station: Station, particleScale: number, surge = 0): number {
  return petalLayers().reduce(
    (sum, layer) => sum + petalPresentCount(layer, station, particleScale, surge),
    0,
  );
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
