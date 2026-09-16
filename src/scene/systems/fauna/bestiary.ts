/**
 * El bestiario: qué animal es cada especie y qué sabe hacer.
 *
 * La idea que sostiene toda la fauna del sitio es que **la criatura y la
 * conducta son cosas separadas**. Aquí vive la criatura —de qué rig cuelga, qué
 * tamaño tiene, de qué color es, a qué profundidad aparece—; el repertorio de
 * conductas vive en `behaviors.ts` y es común. Un mismo rig sirve para tres
 * especies y una misma conducta para varias criaturas, así que añadir un animal
 * es declarar proporciones, no dibujar nada ni programar una animación nueva.
 *
 * El criterio del bestiario es **geográfico**, no "japonés genérico": todo lo
 * que hay aquí se ve en Kyoto. El ciervo, por ejemplo, queda fuera porque es de
 * Nara.
 *
 * Módulo puro y sin React: se puede comprobar fuera del navegador.
 */

import type { FaunaKind } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';

/** Los tres cuerpos con los que se construye todo el bestiario. */
export type RigKind = 'ave' | 'cuadrupedo' | 'insecto';

export type BehaviorName =
  | 'cruzarVolando'
  | 'planearEnCirculos'
  | 'visitaAlSuelo'
  | 'bandada'
  | 'correrYParar'
  | 'perseguir'
  | 'deambular'
  | 'revolotear'
  | 'titilar';

/** Lo que suelta el animal al aparecer, si suelta algo. */
export type FaunaSound = 'graznido' | 'trino' | 'silbido';

export interface SpeciesSpec {
  readonly rig: RigKind;
  /** Largo del cuerpo en unidades de mundo. La referencia: el camino mide ~2 de ancho. */
  readonly size: number;
  readonly body: keyof ScenePalette;
  readonly accent: keyof ScenePalette;
  /**
   * A qué altura queda el centro del cuerpo cuando el animal está de pie, en
   * unidades del propio cuerpo. Sin esto, una garza "apoyada" en el suelo
   * tendría el pecho enterrado y las patas por debajo del terreno: lo que pisa
   * son los pies, no el centro de la esfera.
   */
  readonly ride: number;
  /** Conductas que sabe hacer. El director elige una. */
  readonly behaviors: readonly BehaviorName[];
  /** Franja de profundidad donde puede aparecer. */
  readonly depth: readonly [number, number];
  readonly sound?: FaunaSound;
  /**
   * Se sienta sobre los cuartos traseros cuando se para. Es lo que hace que una
   * ardilla se lea como ardilla y no como una rata corriendo.
   */
  readonly sitsUp?: boolean;
  /** Peso relativo al sortear: los bichos raros son raros. */
  readonly weight: number;
}

/**
 * `null` = declarada en el camino pero **todavía sin cuerpo**. No es un olvido:
 * el kitsune necesita el túnel de toriis de la Fase 6 para que su aparición
 * signifique algo, y la carpa necesita agua en escena. El director las salta.
 * Tenerlas aquí en vez de borrarlas es lo que hace que el día que se
 * implementen no haya que acordarse de nada.
 */
export const BESTIARY: Record<FaunaKind, SpeciesSpec | null> = {
  // Las del río Kamo. Vuela despacio, con el cuello recogido, y cuando se posa
  // camina por la orilla picoteando: es la especie que mejor enseña que una
  // conducta no es un clip.
  garza: {
    rig: 'ave',
    size: 1.05,
    body: 'washi',
    accent: 'sumi',
    ride: 0.62,
    behaviors: ['cruzarVolando', 'visitaAlSuelo'],
    depth: [-16, -7],
    sound: 'graznido',
    weight: 1,
  },

  // Tobi. Planea en círculo sobre las colinas del este sin batir las alas, y no
  // aterriza nunca: es puro tercio superior.
  milano: {
    rig: 'ave',
    size: 1.3,
    body: 'sumiFaint',
    accent: 'sumi',
    ride: 0,
    behaviors: ['planearEnCirculos'],
    depth: [-42, -26],
    sound: 'silbido',
    weight: 0.8,
  },

  // Suzume. Nunca va solo: o pasa la bandada entera o no pasa nadie.
  gorrion: {
    rig: 'ave',
    size: 0.26,
    body: 'sumiFaint',
    accent: 'sumi',
    ride: 0.22,
    behaviors: ['bandada', 'visitaAlSuelo'],
    depth: [-14, -5],
    sound: 'trino',
    weight: 1,
  },

  // Sciurus lis, la ardilla de Honshū. Corre a ráfagas, se para en dos patas a
  // olfatear y —cuando hay otra— se persiguen jugando.
  ardilla: {
    rig: 'cuadrupedo',
    size: 0.34,
    body: 'sumiSoft',
    accent: 'kohaku',
    ride: 0.3,
    behaviors: ['correrYParar', 'perseguir'],
    depth: [-9, -3.5],
    sitsUp: true,
    weight: 1.1,
  },

  // El de los callejones de Gion. Anda despacio, se sienta, se estira y se va.
  gato: {
    rig: 'cuadrupedo',
    size: 0.62,
    body: 'sumi',
    accent: 'washi',
    ride: 0.33,
    behaviors: ['deambular'],
    depth: [-8, -3.5],
    weight: 1,
  },

  // Nocturno y esquivo. Aparece poco a propósito: media docena de apariciones
  // en una sesión larga y siempre en Gion.
  tanuki: {
    rig: 'cuadrupedo',
    size: 0.58,
    body: 'sumiFaint',
    accent: 'sumi',
    ride: 0.31,
    behaviors: ['deambular'],
    depth: [-9, -5],
    weight: 0.45,
  },

  // Ageha. Cruza cerca de la cámara, casi rozando el cristal.
  mariposa: {
    rig: 'insecto',
    size: 0.2,
    body: 'sakuraPale',
    accent: 'sakura',
    ride: 0,
    behaviors: ['revolotear'],
    depth: [0.5, 4],
    weight: 1,
  },

  // Akatombo, la libélula roja del final del verano. Vuela más recta que la
  // mariposa y se queda suspendida en el aire.
  libelula: {
    rig: 'insecto',
    size: 0.24,
    body: 'bambu',
    accent: 'shu',
    ride: 0,
    behaviors: ['revolotear'],
    depth: [-1.5, 3],
    weight: 1,
  },

  // Genji-botaru, las de junio en el Shirakawa. Muchas, pequeñas y lentas.
  luciernaga: {
    rig: 'insecto',
    size: 0.075,
    body: 'kohaku',
    accent: 'kohaku',
    ride: 0,
    behaviors: ['titilar'],
    depth: [-3, 3.5],
    weight: 1,
  },

  kitsune: null,
  carpa: null,
};

/** Las especies que esta estación puede sacar y que además tienen cuerpo. */
export function availableSpecies(fauna: readonly FaunaKind[]): FaunaKind[] {
  return fauna.filter((kind) => BESTIARY[kind] !== null);
}

export function speciesSpec(kind: FaunaKind): SpeciesSpec | null {
  return BESTIARY[kind];
}

/** Cuántos individuos salen juntos, según la conducta. */
export function membersFor(behavior: BehaviorName, random: () => number): number {
  switch (behavior) {
    case 'bandada':
      return 5 + Math.floor(random() * 5);
    case 'titilar':
      return 6 + Math.floor(random() * 7);
    case 'perseguir':
      // El juego necesita exactamente dos: una que huye y otra que persigue.
      return 2;
    case 'revolotear':
      return 1 + Math.floor(random() * 2);
    default:
      return 1;
  }
}

/** Cuánto dura un acto, en segundos. */
export function durationFor(behavior: BehaviorName, random: () => number): number {
  const range: Record<BehaviorName, readonly [number, number]> = {
    cruzarVolando: [7, 12],
    planearEnCirculos: [22, 34],
    visitaAlSuelo: [15, 23],
    bandada: [8, 14],
    correrYParar: [9, 15],
    perseguir: [11, 17],
    deambular: [15, 23],
    revolotear: [11, 18],
    titilar: [22, 34],
  };

  const [min, max] = range[behavior];
  return min + random() * (max - min);
}

/** ¿La conducta transcurre por el aire? Lo usa el director para no solapar dos. */
export function isAerial(behavior: BehaviorName): boolean {
  return (
    behavior === 'cruzarVolando' ||
    behavior === 'planearEnCirculos' ||
    behavior === 'bandada' ||
    behavior === 'revolotear' ||
    behavior === 'titilar'
  );
}
