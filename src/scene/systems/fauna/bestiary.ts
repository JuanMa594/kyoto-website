/**
 * El bestiario: qué animal es cada especie y qué sabe hacer.
 *
 * La idea que sostiene toda la fauna del sitio es que **la criatura y la
 * conducta son cosas separadas**. Aquí vive la criatura —de qué modelo sale, qué
 * tamaño tiene, dónde se doblan su cola y sus patas, a qué profundidad
 * aparece—; el repertorio de conductas vive en `behaviors.ts` y es común. Una
 * misma conducta sirve para varias criaturas, así que añadir un animal es
 * declarar un modelo y sus regiones, no programar una animación nueva.
 *
 * El criterio del bestiario es **geográfico**, no "japonés genérico": todo lo
 * que hay aquí se ve en Kyoto. El ciervo, por ejemplo, queda fuera porque es de
 * Nara. La única licencia es el gorrión, que es un cucarachero de cactus: a
 * veinte píxeles y en bandada no se distinguen.
 *
 * Módulo puro y sin React: se puede comprobar fuera del navegador.
 */

import type { FaunaKind } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import type { DeformProfile } from '@/scene/objects/fauna/deform';

/**
 * Cómo se da cuerpo a una especie:
 *
 *   · `modelo`  — un .glb sin esqueleto, animado deformando regiones en el
 *     shader (`objects/fauna/deform.ts`). Es el caso de casi todo el bestiario.
 *   · `animado` — un .glb con esqueleto y clips propios (los insectos).
 *   · `luz`     — un punto de luz que late (la luciérnaga): a su tamaño, la forma
 *     no se ve; lo que se ve es el brillo.
 */
export type RigKind = 'modelo' | 'animado' | 'luz';

export type BehaviorName =
  | 'cruzarVolando'
  | 'planearEnCirculos'
  | 'visitaAlSuelo'
  | 'vadear'
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
  /** Archivo en `public/models/fauna/`, sin extensión. Lo produce `bun run models`. */
  readonly model?: string;
  /**
   * Segundo modelo para cuando el animal está en el aire. Hoy no lo usa nadie:
   * es el hueco para una garza en vuelo. Si llega: se añade al manifiesto de
   * `scripts/optimize-models.ts`, se pone aquí y se le devuelven a la garza
   * `visitaAlSuelo` y `cruzarVolando`. El rig ya cambia de modelo solo cuando la
   * conducta despega o aterriza. Lo que probablemente haga falta además es un
   * segundo perfil de deformación, porque las alas de un modelo en vuelo no
   * están donde las patas de uno de pie.
   */
  readonly flightModel?: string;
  /** Regiones que se doblan (sólo en `modelo`). */
  readonly deform?: DeformProfile;
  /**
   * Tamaño en unidades de mundo: de morro a cola en los animales, de punta a
   * punta de ala en los insectos. La referencia: el camino mide ~2 de ancho.
   */
  readonly size: number;
  /** Color de la luciérnaga y de la libélula; el resto trae el suyo en el modelo. */
  readonly body: keyof ScenePalette;
  readonly accent: keyof ScenePalette;
  /**
   * A qué altura queda el **origen** del modelo cuando el animal está de pie.
   * Los modelos normalizados tienen el origen en los pies, así que para todo lo
   * que camina vale 0: pisa exactamente el terreno.
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
  /**
   * Baja al suelo en grupo, no de uno en uno. El gorrión nunca se posa solo:
   * cae media bandada, picotea junta y se levanta junta al primer susto.
   */
  readonly gregarious?: boolean;
  /**
   * Cuánto se inclina hacia delante al volar un modelo esculpido de pie. Un
   * pájaro posado tiene el cuerpo en diagonal; en vuelo va en horizontal.
   */
  readonly flightPitch?: number;
  /** Peso relativo al sortear: los bichos raros son raros. */
  readonly weight: number;
}

/**
 * `null` = declarada en el camino pero **todavía sin cuerpo**. No es un olvido:
 * el kitsune necesita el túnel de toriis de la Fase 6 para que su aparición
 * signifique algo, y la carpa necesita agua en escena. El director las salta.
 * Tenerlas aquí en vez de borrarlas es lo que hace que el día que se
 * implementen no haya que acordarse de nada.
 *
 * Las regiones de cada `deform` se leyeron sobre una rejilla del modelo ya
 * normalizado —morro en x = +0,5, cola en −0,5, pies en y = 0—.
 */
export const BESTIARY: Record<FaunaKind, SpeciesSpec | null> = {
  // Las del río Kamo. El modelo está de pie y con las alas plegadas, así que
  // esta garza **no vuela: vadea**. Entra andando por la orilla, se para a
  // pescar y sigue su camino — que es, por otra parte, lo que hace una garza
  // casi todo el día.
  garza: {
    rig: 'modelo',
    model: 'garza',
    deform: {
      hipY: 0.46,
      splitX: 0,
      legMinX: -0.32,
      pairs: 1,
      legSwing: 0.42,
      stride: 0.42,
      neck: { baseX: 0.06, baseY: 0.62, dirX: 0.15, dirY: 0.99, reach: 0.36 },
      pivotY: 0.5,
    },
    size: 1.05,
    body: 'washi',
    accent: 'sumi',
    ride: 0,
    behaviors: ['vadear'],
    depth: [-13, -6],
    sound: 'graznido',
    weight: 1,
  },

  // Tobi. Planea en círculo sobre las colinas del este sin batir las alas, y no
  // aterriza nunca. El modelo viene justo así: con las alas abiertas.
  milano: {
    rig: 'modelo',
    model: 'milano',
    deform: {
      hipY: -1,
      splitX: 0,
      legMinX: 1,
      pairs: 1,
      legSwing: 0,
      stride: 1,
      tail: { baseX: -0.18, tipX: -0.5, minY: -1, pivotY: 0.28 },
      wings: { rootZ: 0.12, tipZ: 0.72, shoulderY: 0.45, minX: -1, maxX: 1, minY: -1, maxY: 2 },
      pivotY: 0.35,
    },
    size: 1,
    body: 'sumiFaint',
    accent: 'sumi',
    ride: 0,
    behaviors: ['planearEnCirculos'],
    depth: [-42, -26],
    sound: 'silbido',
    weight: 0.8,
  },

  // Suzume. Nunca va solo: o pasa la bandada entera o baja media bandada a
  // picotear.
  gorrion: {
    rig: 'modelo',
    model: 'gorrion',
    deform: {
      hipY: 0.12,
      splitX: 0,
      legMinX: 0,
      pairs: 1,
      legSwing: 0.5,
      stride: 0.2,
      tail: { baseX: -0.14, tipX: -0.5, minY: 0.05, pivotY: 0.25 },
      neck: { baseX: 0.13, baseY: 0.4, dirX: 0.71, dirY: 0.71, reach: 0.22 },
      wings: { rootZ: 0.035, tipZ: 0.13, shoulderY: 0.42, minX: -0.22, maxX: 0.26, minY: 0.24, maxY: 0.5 },
      pivotY: 0.3,
    },
    size: 0.3,
    body: 'sumiFaint',
    accent: 'sumi',
    ride: 0,
    behaviors: ['bandada', 'visitaAlSuelo'],
    depth: [-14, -5],
    sound: 'trino',
    gregarious: true,
    flightPitch: -0.35,
    weight: 1,
  },

  // Sciurus lis, la ardilla de Honshū. Corre a ráfagas, se para en dos patas a
  // olfatear y —cuando hay otra— se persiguen jugando.
  ardilla: {
    rig: 'modelo',
    model: 'ardilla',
    deform: {
      hipY: 0.1,
      splitX: 0.15,
      legMinX: -0.16,
      pairs: 2,
      legSwing: 0.7,
      stride: 0.35,
      tail: { baseX: -0.14, tipX: -0.5, minY: 0.18, pivotY: 0.3 },
      neck: { baseX: 0.26, baseY: 0.27, dirX: 0.98, dirY: 0.2, reach: 0.2 },
      sit: { hipX: -0.04, hipY: 0.14 },
      pivotY: 0.15,
    },
    size: 0.5,
    body: 'sumiSoft',
    accent: 'kohaku',
    ride: 0,
    behaviors: ['correrYParar', 'perseguir'],
    depth: [-9, -3.5],
    sitsUp: true,
    weight: 1.1,
  },

  // El de los callejones de Gion: un bobtail calicó, el mismo que el
  // maneki-neko. Anda despacio, se para y sigue.
  gato: {
    rig: 'modelo',
    model: 'gato',
    deform: {
      hipY: 0.26,
      splitX: -0.1,
      legMinX: -0.6,
      pairs: 2,
      legSwing: 0.4,
      stride: 0.45,
      tail: { baseX: -0.38, tipX: -0.5, minY: 0.35, pivotY: 0.48 },
      neck: { baseX: 0.18, baseY: 0.52, dirX: 0.8, dirY: 0.6, reach: 0.25 },
      pivotY: 0.3,
    },
    size: 0.62,
    body: 'sumi',
    accent: 'washi',
    ride: 0,
    behaviors: ['deambular'],
    depth: [-8, -3.5],
    weight: 1,
  },

  // Nocturno y esquivo. Aparece poco a propósito, y siempre en Gion.
  tanuki: {
    rig: 'modelo',
    model: 'tanuki',
    deform: {
      hipY: 0.17,
      splitX: -0.12,
      legMinX: -0.6,
      pairs: 2,
      legSwing: 0.45,
      stride: 0.4,
      tail: { baseX: -0.4, tipX: -0.5, minY: 0.14, pivotY: 0.25 },
      neck: { baseX: 0.2, baseY: 0.34, dirX: 0.99, dirY: 0.1, reach: 0.25 },
      pivotY: 0.25,
    },
    size: 0.62,
    body: 'sumiFaint',
    accent: 'sumi',
    ride: 0,
    behaviors: ['deambular'],
    depth: [-9, -5],
    weight: 0.45,
  },

  // Ageha, Papilio xuthus: la especie japonesa exacta, con su propio vuelo
  // animado.
  mariposa: {
    rig: 'animado',
    model: 'mariposa',
    size: 0.3,
    body: 'kohaku',
    accent: 'sumi',
    ride: 0,
    behaviors: ['revolotear'],
    depth: [0.5, 4],
    weight: 1,
  },

  // Akatombo, la libélula roja del final del verano. El modelo llega en blanco
  // y la escena la pinta: cuerpo rojo y alas de papel.
  libelula: {
    rig: 'animado',
    model: 'libelula',
    size: 0.3,
    body: 'shu',
    accent: 'washi',
    ride: 0,
    behaviors: ['revolotear'],
    depth: [-1.5, 3],
    weight: 1,
  },

  // Genji-botaru, las de junio en el Shirakawa. Muchas, pequeñas y lentas.
  luciernaga: {
    rig: 'luz',
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

/** Ruta pública de un modelo. */
export function modelUrl(name: string): string {
  return `/models/fauna/${name}.glb`;
}

/** Cuántos individuos salen juntos, según la conducta y la especie. */
export function membersFor(
  behavior: BehaviorName,
  random: () => number,
  spec?: SpeciesSpec,
): number {
  switch (behavior) {
    case 'visitaAlSuelo':
      return spec?.gregarious ? 3 + Math.floor(random() * 3) : 1;
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
    // Una garza camina despacio y se para a pescar: es el acto más largo.
    vadear: [50, 58],
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
