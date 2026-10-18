/**
 * ★ Fuente única de verdad del sitio.
 *
 * Una estación = un punto del camino de piedras. De este array se derivan al
 * mismo tiempo:
 *   · el sidebar radial de navegación (los 6 círculos de `13.png`),
 *   · las rutas de Next (`src/app/[locale]/…`),
 *   · la posición de cada estación sobre el spline del camino (`pathT`),
 *   · la paleta y el ambiente de cada zona (pétalos, viento, fauna, sonido),
 *   · el set de kanji que se subsetea en la fuente japonesa (`bun run fonts`).
 *
 * Cambiar el orden de este array reordena el sitio entero. Es lo que hace que
 * "el camino" sea real y no una animación decorativa.
 */

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

/** Identidad estable de cada estación. También es la clave de traducción. */
export type StationSlug =
  | 'inicio'
  | 'ubicacion'
  | 'eventos'
  | 'fushimi-inari'
  | 'kiyomizu-dera'
  | 'gion'
  | 'gastronomia';

/** Ícono del sidebar. Mapea 1:1 con los círculos de `13.png`. */
export type StationIcon = 'mapa' | 'sakura' | 'torii' | 'pagoda' | 'farol' | 'naruto' | 'kanji';

/** Familia de ruta: define qué plantilla renderiza la estación. */
export type StationGroup = 'inicio' | 'ubicacion' | 'eventos' | 'lugares' | 'gastronomia';

/** Qué cae del cielo en esta zona. */
export type PetalKind = 'sakura' | 'momiji' | 'bambu' | 'ninguna';

/**
 * Cuánto ambiente tiene una zona, en tier alto; los tiers medio y bajo lo
 * escalan (ver `src/scene/quality`).
 *
 * Los valores son **fracciones del presupuesto máximo**, no cantidades
 * absolutas, y están calibrados para que el cuadro no se sature antes de que
 * lleguen los objetos 3D de las fases 4–8: `alta` = 100 % (sólo la sakura de
 * eventos, que es el momento del año en que la ciudad está literalmente
 * cubierta), `media` = 35 %, `baja` = 20 % — un ambiente pasivo, de fondo. La
 * tabla concreta vive en `scene/systems/petals.ts`.
 *
 * Con cada ráfaga de viento la densidad sube hasta el doble de la base y vuelve
 * despacio: la zona respira en vez de mantener un goteo constante.
 */
export type Density = 'ninguna' | 'baja' | 'media' | 'alta';

/**
 * Fauna que puede cruzar el encuadre. El director de fauna (Fase 2) elige una
 * de esta lista cada 20–40 s, y también como recompensa tras ~20 s sin scroll.
 */
export type FaunaKind =
  | 'garza'
  | 'milano'
  | 'gorrion'
  | 'mariposa'
  | 'libelula'
  | 'ardilla'
  | 'gato'
  | 'tanuki'
  | 'luciernaga'
  | 'kitsune'
  | 'carpa';

/** Capas de audio ambiental. Nunca suenan todas a la vez ni todo el tiempo. */
export type SoundLayer =
  | 'viento'
  | 'bambu'
  | 'arroyo'
  | 'furin'
  | 'grillos'
  | 'pajaros'
  | 'ciudad'
  | 'fuego';

/**
 * Relieve del fondo. Va SIEMPRE a los costados: el centro del cuadro queda
 * libre para el sujeto (el torii, el cerezo, la pagoda). La máscara lateral de
 * `scene/systems/elevation.ts` lo garantiza por construcción, no por disciplina.
 */
export type HillProfile = 'ninguna' | 'suaves' | 'montanosa';

export type Side = 'izquierda' | 'derecha';

/** Tinte que se mezcla al fondo y a la niebla para que cada zona tenga su luz. */
export interface SkyTint {
  readonly color: string;
  /** 0–1. Por encima de ~0.25 deja de leerse como washi. */
  readonly amount: number;
}

/**
 * Dónde va un objeto de la decoración, en coordenadas del camino: `d` es la
 * profundidad desde la estación (positiva = hacia la siguiente: la
 * decoración de un tramo la declara la estación de la que sale) y `u`, la
 * distancia al eje del camino (negativa = a la izquierda), la misma `u` de
 * `scene/systems/elevation.ts`.
 */
export interface DecorAt {
  readonly d: number;
  readonly u: number;
  /**
   * Escala propia de esta colocación, por encima de la del objeto. Sirve para
   * que en vertical un objeto quepa más lejos sin cambiar en horizontal.
   */
  readonly scale?: number;
}

/** Una franja a un costado del camino, entre dos profundidades y dos |u|. */
export interface DecorArea {
  readonly side: Side;
  readonly from: number;
  readonly to: number;
  readonly inner: number;
  readonly outer: number;
}

interface DecorObjectBase {
  readonly at: DecorAt;
  /**
   * Otra colocación cuando la pantalla es más alta que ancha: en 9:16 el cuadro
   * mide unas 4 u de ancho a la distancia del cartel. `null` = no aparece.
   */
  readonly portrait?: DecorAt | null;
  /** Giro extra sobre el rumbo del camino, en radianes. */
  readonly yaw?: number;
  readonly scale?: number;
}

/** Un torii. La Fase 6 añadirá la variante `inari` para Fushimi. */
export interface DecorTorii extends DecorObjectBase {
  readonly kind: 'torii';
  readonly variant: 'ryobu';
}

/**
 * Un arbusto podado en nube (o-karikomi). Le cierra el paso a la fauna que
 * anda (y a lo que vuela por debajo de su copa).
 */
export interface DecorShrub extends DecorObjectBase {
  readonly kind: 'arbusto';
  readonly seed: number;
}

/**
 * Un farol de piedra (tōrō). `kasuga`: el alto, sobre poste, de los caminos de
 * los santuarios; `yukimi`: el bajo de patas y tejado ancho, de jardín. Le
 * cierra el paso a la fauna. Las ventanas son de papel: el modo noche las
 * encenderá.
 */
export interface DecorLantern extends DecorObjectBase {
  readonly kind: 'farol';
  readonly variant: 'kasuga' | 'yukimi';
}

/**
 * Un macizo: una franja que se llena de plantas con semilla fija. Hoy, bambú;
 * es también la puerta a los cerezos de Eventos y a las reglas de Fushimi.
 */
export interface DecorGrove {
  readonly kind: 'bambu';
  readonly area: DecorArea;
  readonly portrait?: DecorArea | null;
  /** Cañas por unidad² en tier alto. */
  readonly density: number;
  /** Densidad al final del macizo, como fracción de la del principio: < 1 se aclara. */
  readonly taper?: number;
  /** Alto de las cañas, en unidades: de las más bajas a las más altas. */
  readonly height: readonly [number, number];
  readonly seed: number;
  /**
   * Hojas por caña (34 si no se dice). Un macizo de fondo, que la niebla ya
   * vuelve sombra, lleva menos: no se distinguen y cuestan triángulos.
   */
  readonly leaves?: number;
}

/**
 * La maqueta de Japón de Ubicación (Fase 5A): una bandeja de piedra con las
 * prefecturas, inclinada hacia la cámara sobre su atril. No se voltea al otro
 * lado del camino: mira siempre a la cámara. Le cierra el paso a la fauna.
 * Medidas: `scene/objects/maqueta/maqueta.ts`.
 */
export interface DecorMaqueta extends DecorObjectBase {
  readonly kind: 'maqueta';
}

/**
 * La roca pintada del tramo de Ubicación (Fase 5B): un tateishi más ancho que
 * alto con la esquina de `2.png` —sol, Fuji y torii— pintada en la cara. Como
 * la maqueta, mira siempre a la cámara: no se voltea al otro lado del camino.
 * Le cierra el paso a la fauna. Medidas: `scene/objects/roca/roca.ts`.
 */
export interface DecorRoca extends DecorObjectBase {
  readonly kind: 'roca';
}

/**
 * Un macizo de susuki (すすき, Fase 5B): matas de hierba alta con sus espigas,
 * que se mecen con el viento. Es blanda para la fauna —la cruzan las
 * libélulas y la garza—; sólo la cámara y las piedras la tratan como franja.
 * Va declarada por área, como el bambú.
 */
export interface DecorSusuki {
  readonly kind: 'susuki';
  readonly area: DecorArea;
  readonly portrait?: DecorArea | null;
  /** Matas por unidad² en tier alto. */
  readonly density: number;
  /** Densidad al final, como fracción de la del principio: < 1 se aclara. */
  readonly taper?: number;
  /** Alto de las matas, de las más bajas a las más altas. */
  readonly height: readonly [number, number];
  readonly seed: number;
  /**
   * `susuki` (por defecto): hojas que se abren en abanico y espigas plateadas.
   * `junco`: hierba alta silvestre de los costados lejanos, más fina, recta y
   * verde, sin espigas. Comparte las instancias de la susuki.
   */
  readonly variant?: 'susuki' | 'junco';
}

/**
 * Un cerezo (桜, Fase 5B): tronco y ramas procedurales con su copa de flor,
 * que se mece despacio con el viento. Es el árbol base de la Fase 7. No se
 * gira (lo que se mece no se gira: el viento lo doblaría en otra dirección):
 * la variedad la da la semilla. El tronco cierra el paso a lo que anda.
 * Medidas: `scene/objects/cerezo/cerezo.ts`.
 */
export interface DecorCerezo extends DecorObjectBase {
  readonly kind: 'cerezo';
  readonly seed: number;
}

/**
 * Un corro (5B, pulido): un grupo natural pegado al suelo —unas manchas de
 * musgo y algunas piedras de río— para que el terreno abierto no quede
 * pelado. Es bajo: no tapa nada ni carga el fondo de un cartel. Lo dibujan
 * `moss.ts` y `pebbles.ts`; las piedras cuentan como obstáculo para la fauna.
 */
export interface DecorCorro extends DecorObjectBase {
  readonly kind: 'corro';
  /** Manchas de musgo (con el tier alto) y piedras de río del corro. */
  readonly moss: number;
  readonly pebbles: number;
}

export type DecorItem =
  | DecorTorii
  | DecorCorro
  | DecorShrub
  | DecorLantern
  | DecorGrove
  | DecorMaqueta
  | DecorRoca
  | DecorSusuki
  | DecorCerezo;

/**
 * El "preset de ambiente" de la estación: qué forma tiene el terreno, por qué
 * lado se levanta, a qué altura está el camino. Es lo que evita que el fondo
 * sea siempre el mismo. La decoración concreta (cerezos, toriis repetidos,
 * machiya, chochin) llega en las fases 4–8 y se colgará de este mismo objeto.
 */
export interface StationEnvironment {
  readonly hills: HillProfile;
  /** Costados donde se levanta el relieve. Vacío = terreno llano. */
  readonly hillSides: readonly Side[];
  /**
   * Altura del camino en el punto de la estación, en unidades, relativa a la
   * Home. El camino sube o baja **en los tramos**, entre la altura de una
   * estación y la de la siguiente, y queda llano en cada estación: la cuesta
   * de Fushimi Inari es la de llegada, y la bajada a Gion, la de salida de
   * Kiyomizu-dera.
   */
  readonly altitude: number;
  /**
   * Desvío lateral del camino en el punto de la estación, en unidades. Entre
   * dos estaciones el camino va de un lateral al otro, y ahí están las curvas.
   * Entre estaciones consecutivas |Δ| ≤ 20, para que el rumbo no pase de ~13°.
   */
  readonly lateral: number;
  readonly skyTint?: SkyTint;
  /**
   * La decoración de la estación **y de su tramo de salida** (Fase 4). La
   * llevan al mundo `scene/decor/placement.ts` y `StationDecor`.
   */
  readonly decor: readonly DecorItem[];
  /**
   * Cuánto musgo crece al pie de su decoración y junto a las piedras, 0–1
   * (`scene/decor/moss.ts`). Sin él, ninguno.
   */
  readonly moss?: number;
  /**
   * Cuántas piedras de río hay al pie de los faroles y de los postes de los
   * carteles, 0–1 (`scene/decor/pebbles.ts`). Como el musgo, no se declaran
   * una a una: crecen en grupos asimétricos alrededor de cada base. Sin él,
   * ninguna.
   */
  readonly pebbles?: number;
  /**
   * La alfombra de pétalos caídos alrededor de la estación (5B): el suelo y lo
   * alto de las piedras se van cubriendo de rosa. La pinta el shader del
   * terreno y del camino, sin geometría (`scene/systems/petalCarpet.ts`).
   */
  readonly petalCarpet?: PetalCarpet;
}

/**
 * Cuánto cubren los pétalos caídos (0–1) en la estación, desde cuántas
 * unidades antes empiezan a aparecer, cuántas después siguen igual de densos y
 * en cuántas más se acaban.
 */
export interface PetalCarpet {
  readonly cover: number;
  readonly before: number;
  readonly hold: number;
  readonly fade: number;
}

/**
 * Una tarjeta del tramo: lo que se lee a un lado del camino al caminar hacia la
 * siguiente estación. Al llegar a ella la cámara casi se detiene mientras la
 * tarjeta aparece (`animation/journeyScroll.ts`). Sus textos viven en
 * `messages/*.json`, en `tramos.<estación>.<id>`.
 */
export interface TramoCard {
  readonly id: string;
  /** A qué lado del camino aparece. En móvil, siempre centrada. */
  readonly side: Side;
  /** `mapa` lleva un mapa antiguo (`sign.map`); `texto` es sólo lectura. */
  readonly kind: 'texto' | 'mapa';
  /**
   * Va escrita en un kōsatsu plantado delante de su parada (Fase 5B). El
   * tablón se deriva de aquí (`scene/decor/placement.ts`): no se declara en
   * `decor`. Sin `sign`, la tarjeta es de papel.
   */
  readonly sign?: { readonly map?: OldMap };
}

/** Los mapas antiguos del tramo de Ubicación (Fase 5B), los genera `bun run maps`. */
export type OldMap = 'japon' | 'heian';

/** Lo que hay en el camino entre esta estación y la siguiente. */
export interface StationTramo {
  readonly cards: readonly TramoCard[];
  /**
   * Unidades de camino llano y recto al salir de la estación, antes de que
   * empiecen la curva y la cuesta hacia la siguiente. Mientras dura, la zona
   * sigue siendo ésta. Sin él, el tramo empieza a cambiar desde la estación.
   */
  readonly flat?: number;
}

export interface StationPalette {
  /** Color del círculo en el sidebar (muestreado de `13.png`). */
  readonly halo: string;
  /** Acento dominante de la zona. */
  readonly accent: string;
  /** Color del suelo y de la bruma de esta zona en la escena 3D. */
  readonly ground: string;
}

export interface StationAmbient {
  readonly petals: Density;
  readonly petalKind: PetalKind;
  /** Intensidad base del viento, 0–1. Las ráfagas se suman encima (Fase 2). */
  readonly wind: number;
  readonly fauna: readonly FaunaKind[];
  /**
   * A qué distancia de la cámara nace la fauna de esta zona, como factor de la
   * de cada especie: 1 = la de siempre, 0,8 = un 20 % más cerca. Se mezcla por
   * zonas a lo largo del tramo y nunca acerca nada por debajo del suelo de
   * distancia de `scene/systems/fauna/anchoring.ts` (Fase 3B).
   */
  readonly faunaDistance: number;
  readonly sounds: readonly SoundLayer[];
  /** Niebla de la zona, en unidades de mundo. Más corta = encuadre más íntimo. */
  readonly fog: { readonly near: number; readonly far: number };
}

export interface Station {
  readonly slug: StationSlug;
  /** Decorativo: sólo aparece en títulos, nunca como texto de lectura. */
  readonly kanji: string;
  readonly romaji: string;
  readonly icon: StationIcon;
  readonly group: StationGroup;
  /** Ruta relativa al idioma. Cadena vacía = raíz del idioma. */
  readonly route: string;
  /** Posición sobre el camino: 0 = inicio, 1 = final. Su profundidad es `pathT × PATH_LENGTH`. */
  readonly pathT: number;
  /** Si aparece como círculo en el sidebar. `inicio` no: es el punto de partida. */
  readonly inSidebar: boolean;
  readonly palette: StationPalette;
  readonly ambient: StationAmbient;
  readonly environment: StationEnvironment;
  /**
   * El tramo que sale de esta estación hacia la siguiente. Cada tarjeta suma
   * su parada de lectura al largo del tramo. La última estación no tiene.
   */
  readonly tramo: StationTramo;
}

/**
 * Profundidad total del camino, en unidades de mundo: de la Home (`pathT` 0)
 * a Gastronomía (`pathT` 1). Los `pathT` de abajo se escriben como
 * «profundidad / PATH_LENGTH» para que se lea la distancia real: de la Home a
 * Ubicación hay 64 unidades —medio tramo: se llega pronto a la primera
 * sección—; entre las demás, 128–144 (más 50 de llano entre los cerezos al
 * salir de Eventos), sitio para caminar y para leer lo que
 * hay a los lados. Ver `scene/path/journeyPath.ts`.
 */
export const PATH_LENGTH = 786;

/** Un tramo sin nada que leer: sólo camino. */
const NO_CARDS: StationTramo = { cards: [] };

/**
 * De la sakura a Fushimi Inari: 50 unidades llanas entre los cerezos antes de
 * que empiece la subida. Sin ellas, al llegar a Eventos ya se veía la cuesta.
 */
const TRAMO_EVENTOS: StationTramo = { cards: [], flat: 50 };

/**
 * De la Home a Ubicación: cómo se recorre el sitio, a la izquierda (el torii
 * queda a la derecha). Es la única explicación de la interfaz que hay.
 */
const TRAMO_INICIO: StationTramo = {
  cards: [{ id: 'bienvenida', side: 'izquierda', kind: 'texto' }],
};

/**
 * De Ubicación a la sakura (Fase 5B): la historia de la ciudad, escrita en
 * tres kōsatsu plantados junto al camino —la capital de mil años con el mapa
 * de Japón, Heian-kyō con su plano y el paso a Kyoto—. Cada tablón se planta
 * delante de su parada (`scene/decor/placement.ts`).
 */
const TRAMO_UBICACION: StationTramo = {
  cards: [
    { id: 'capital', side: 'derecha', kind: 'mapa', sign: { map: 'japon' } },
    { id: 'heian', side: 'izquierda', kind: 'mapa', sign: { map: 'heian' } },
    { id: 'kyoto', side: 'derecha', kind: 'texto', sign: {} },
  ],
};

/**
 * Un fondo de bambú a un costado: bosquetes ralos, altos y de pocas hojas, uno
 * por cada tramo `[from, to]`, con su semilla (`seed`, `seed + 1`, …).
 */
function backdropBamboo(
  side: Side,
  inner: number,
  outer: number,
  seed: number,
  spans: readonly (readonly [number, number])[],
): DecorGrove[] {
  return spans.map(([from, to], k) => ({
    kind: 'bambu',
    seed: seed + k,
    density: 0.08,
    height: [6, 13],
    leaves: 16,
    area: { side, from, to, inner, outer },
  }));
}

/**
 * La Home y su tramo: el cartel de `1.png` —el torii a la derecha, cortado por
 * el borde; bambú en la esquina; un arbusto al pie— y un bosquecillo de bambú
 * que se aclara hasta abrirse al valle de Ubicación. Los números están
 * calibrados con `bun run check:path` (sección «El cartel de la Home»).
 */
const DECOR_INICIO: readonly DecorItem[] = [
  { kind: 'torii', variant: 'ryobu', at: { d: -6.25, u: 5 }, portrait: { d: 6.6, u: 3.6 } },
  { kind: 'arbusto', seed: 11, at: { d: -9.2, u: 5.6 }, portrait: { d: 5, u: 4.6 } },
  // Delante: cañas jóvenes cortadas por la esquina inferior izquierda.
  {
    kind: 'bambu',
    seed: 21,
    density: 0.55,
    height: [3.2, 4.8],
    area: { side: 'izquierda', from: -14, to: -6, inner: 4.5, outer: 9 },
    // En vertical no: el viaje de vuelta desde Ubicación pasa por la izquierda
    // del eje y lo atravesaría (check:path, «La cámara nunca entra»).
    portrait: null,
  },
  // Detrás del texto, ya con niebla.
  {
    kind: 'bambu',
    seed: 22,
    density: 0.12,
    height: [5, 10.5],
    area: { side: 'izquierda', from: 0, to: 18, inner: 6.5, outer: 12 },
  },
  // Lejos, detrás del torii.
  {
    kind: 'bambu',
    seed: 23,
    density: 0.16,
    height: [5, 10.5],
    area: { side: 'derecha', from: 6, to: 26, inner: 7.5, outer: 13 },
  },
  // El tramo: el bosquecillo se aclara hacia el valle.
  {
    kind: 'bambu',
    seed: 24,
    density: 0.2,
    taper: 0.15,
    height: [5, 10.5],
    area: { side: 'izquierda', from: 18, to: 48, inner: 6, outer: 12 },
  },
  {
    kind: 'bambu',
    seed: 25,
    density: 0.2,
    taper: 0.15,
    height: [5, 10.5],
    area: { side: 'derecha', from: 26, to: 52, inner: 5, outer: 12 },
  },
  // El fondo de los dos costados, detrás de los macizos: cañas más altas y
  // de alturas más dispares, ralas y con pocas hojas. La niebla las vuelve
  // sombras de bambú; rellenan los laterales sin tocar el pasillo. Van en
  // bosquetes con claros entre medias: por ellos entra la garza que vadea
  // (que llega andando desde fuera del cuadro), y dan ritmo al fondo.
  ...backdropBamboo('izquierda', 12.5, 22, 260, [
    [4, 15],
    [22, 33],
    [40, 50],
  ]),
  ...backdropBamboo('derecha', 13.5, 23, 270, [
    [2, 12],
    [19, 31],
    [38, 54],
  ]),
  { kind: 'arbusto', seed: 12, at: { d: 14, u: -5.5 } },
  { kind: 'arbusto', seed: 13, at: { d: 34, u: 6 } },
  // Los faroles, ya fuera del cartel: un yukimi entre el musgo al empezar a
  // caminar, a la derecha (la izquierda es del texto y de la tarjeta), y un
  // par de kasuga flanqueando el camino donde el bambú se abre a Ubicación.
  // En vertical, más cerca: así queda detrás del pilar del torii desde el cartel.
  { kind: 'farol', variant: 'yukimi', at: { d: 22, u: 5.2 }, portrait: { d: 12, u: 4.8 } },
  { kind: 'farol', variant: 'kasuga', at: { d: 54, u: -4.6 } },
  { kind: 'farol', variant: 'kasuga', at: { d: 54, u: 4.6 } },
];

/** La susuki del valle de Ubicación (Fase 5B), por manchas. Calibrado con `check:path` («La susuki»). */
const SUSUKI_UBICACION: readonly DecorSusuki[] = [
  { kind: 'susuki', area: { side: 'izquierda', from: 8, to: 25, inner: 4, outer: 10 }, density: 0.6, height: [0.9, 1.6], seed: 42 },
  { kind: 'susuki', area: { side: 'derecha', from: 37, to: 58, inner: 4, outer: 11 }, density: 0.55, height: [1, 1.6], seed: 43 },
  { kind: 'susuki', area: { side: 'izquierda', from: 40, to: 57, inner: 9, outer: 15 }, density: 0.45, height: [1, 1.6], seed: 44 },
  { kind: 'susuki', area: { side: 'izquierda', from: 68, to: 86, inner: 4, outer: 11 }, density: 0.55, height: [0.9, 1.5], seed: 45 },
  {
    kind: 'susuki',
    area: { side: 'derecha', from: 66, to: 90, inner: 9, outer: 15 },
    density: 0.5,
    taper: 0.3,
    height: [0.9, 1.4],
    seed: 46,
  },
];

/**
 * Los juncos del valle (5B, pulido): hierba alta silvestre en los costados
 * lejanos, a 16–25 u del camino, que da textura vertical y movimiento con el
 * viento sin acercarse a nada. Empiezan pasada la vista inicial (a la derecha,
 * pasada también la franja que cae bajo el título) para no cargarla, y se
 * acaban antes de los cerezos.
 */
const JUNCOS_UBICACION: readonly DecorSusuki[] = [
  {
    kind: 'susuki',
    variant: 'junco',
    area: { side: 'izquierda', from: 34, to: 95, inner: 16, outer: 24 },
    density: 0.14,
    taper: 0.6,
    height: [1.3, 2.1],
    seed: 61,
  },
  // A la derecha, antes, **bien lejos** (24–32 u): desde la vista de Ichi
  // quedan fuera del cuadro o, al fondo, como una línea fina sobre el horizonte.
  {
    kind: 'susuki',
    variant: 'junco',
    area: { side: 'derecha', from: 12, to: 62, inner: 24, outer: 32 },
    density: 0.08,
    height: [1.1, 1.7],
    seed: 63,
  },
  {
    kind: 'susuki',
    variant: 'junco',
    area: { side: 'derecha', from: 62, to: 95, inner: 17, outer: 25 },
    density: 0.14,
    taper: 0.7,
    height: [1.3, 2.1],
    seed: 62,
  },
];

/**
 * Ubicación: el cartel de `2.png` en espejo respecto de la Home —la maqueta
 * de Japón a la izquierda del camino, el texto a la derecha—. Girada hacia la
 * cámara (`yaw`), que la ve desde la derecha. Calibrado con `bun run
 * check:path` («El cartel de Ubicación»). El resto del valle es de la Fase 5B.
 */
const DECOR_UBICACION: readonly DecorItem[] = [
  // En vertical no hay sitio junto al camino para una bandeja grande: más
  // lejos y algo menor, entera en el cuadro de un teléfono (≈ 0,45).
  { kind: 'maqueta', at: { d: -5, u: -5.8 }, portrait: { d: 20, u: -4.5, scale: 0.8 }, yaw: 0.15 },
  // La roca pintada (5B): desde la vista inicial, a ~50 u y difusa por la
  // niebla; en la primera parada, al otro lado del camino que el kōsatsu.
  { kind: 'roca', at: { d: 30, u: -5.2 }, portrait: { d: 34, u: -3.4, scale: 0.8 }, yaw: 0.2 },
  // La susuki (5B): manchas por los dos costados, nunca entre la cámara de una
  // parada y su kōsatsu; se aclara al final y no llega a los cerezos.
  ...SUSUKI_UBICACION,
  ...JUNCOS_UBICACION,
  // Corros de musgo y piedras de río (5B, pulido) a la derecha del camino, entre
  // el cartel y el primer kōsatsu: el terreno abierto ya no queda pelado, y son
  // tan bajos que no cargan el fondo de la vista de Ichi. **Lejos de ella**
  // (≥ 33 u de su cámara): desde Ichi se ve algo de musgo al fondo, nada cerca;
  // caminando, van apareciendo.
  // Los más lejanos, más grandes: de lejos, una mancha pequeña no se ve.
  { kind: 'corro', at: { d: 21, u: 6.5 }, moss: 3, pebbles: 3 },
  { kind: 'corro', at: { d: 26, u: 10.5 }, moss: 3, pebbles: 2, scale: 1.2 },
  { kind: 'corro', at: { d: 28, u: 7 }, moss: 3, pebbles: 3, scale: 1.3 },
  { kind: 'corro', at: { d: 30, u: 14 }, moss: 3, pebbles: 2, scale: 1.4 },
  { kind: 'corro', at: { d: 38, u: 14.5 }, moss: 4, pebbles: 0, scale: 1.7 },
  { kind: 'corro', at: { d: 45, u: 13 }, moss: 4, pebbles: 2, scale: 1.7 },
  { kind: 'corro', at: { d: 50, u: 16 }, moss: 4, pebbles: 0, scale: 1.9 },
  // Y dos más a la derecha, que desde Ichi caen al lado del texto, no detrás:
  // el musgo que se ve al fondo de la vista inicial.
  { kind: 'corro', at: { d: 31, u: 20 }, moss: 4, pebbles: 0, scale: 1.8 },
  { kind: 'corro', at: { d: 42, u: 23 }, moss: 4, pebbles: 0, scale: 2 },
  // Faroles y arbustos (5B): un kasuga y un yukimi juntos, otro yukimi solo
  // más allá; los arbustos acompañan a la roca y rellenan el final.
  { kind: 'farol', variant: 'kasuga', at: { d: 47.5, u: -4.6 } },
  { kind: 'farol', variant: 'yukimi', at: { d: 49.6, u: -6 } },
  { kind: 'arbusto', seed: 31, at: { d: 51.5, u: -7.4 } },
  { kind: 'farol', variant: 'yukimi', at: { d: 61, u: 4.8 } },
  { kind: 'arbusto', seed: 32, at: { d: 26.5, u: -8.8 } },
  { kind: 'arbusto', seed: 33, at: { d: 92, u: -6.5 } },
  // Los primeros cerezos (5B), al final: anuncian Eventos sin pegarse al camino.
  { kind: 'cerezo', seed: 22, at: { d: 106, u: -9 } },
  { kind: 'cerezo', seed: 24, at: { d: 115, u: 11.5 }, scale: 1.08 },
  { kind: 'cerezo', seed: 25, at: { d: 124, u: -12.5 }, scale: 0.92 },
];

/**
 * El orden es el del camino, y es también el orden de lectura de `13.png`:
 * mapa → sakura → torii → pagoda → farol → gastronomía.
 */
export const JOURNEY: readonly Station[] = [
  {
    slug: 'inicio',
    kanji: '京都',
    romaji: 'Kyoto',
    icon: 'kanji',
    group: 'inicio',
    route: '',
    pathT: 0,
    inSidebar: false,
    palette: { halo: '#FFFACD', accent: '#D82609', ground: '#EDE6DD' },
    // Home: jardín llano. Sólo una colina insinuada a la izquierda, de fondo.
    environment: {
      hills: 'suaves',
      hillSides: ['izquierda'],
      altitude: 0,
      lateral: 0,
      decor: DECOR_INICIO,
      moss: 1,
    },
    tramo: TRAMO_INICIO,
    ambient: {
      petals: 'media',
      petalKind: 'bambu',
      wind: 0.35,
      fauna: ['garza', 'gorrion'],
      faunaDistance: 1,
      sounds: ['viento', 'bambu'],
      fog: { near: 18, far: 90 },
    },
  },
  {
    slug: 'ubicacion',
    kanji: '位置',
    romaji: 'Ichi',
    icon: 'mapa',
    group: 'ubicacion',
    route: 'ubicacion',
    pathT: 64 / PATH_LENGTH,
    inSidebar: true,
    // El acento es el verde de 2.png (koke-deep): así el pin y Kyoto son lo
    // único rojo del cuadro, como la bandera.
    palette: { halo: '#FFFFFF', accent: '#306828', ground: '#F3EFE4' },
    // Valle abierto: ondulación baja por los dos costados.
    environment: {
      hills: 'suaves',
      hillSides: ['izquierda', 'derecha'],
      altitude: 0,
      lateral: -8,
      decor: DECOR_UBICACION,
      moss: 0.5,
      // Las piedras de río al pie de los faroles y de los postes de los kōsatsu.
      pebbles: 1,
    },
    tramo: TRAMO_UBICACION,
    ambient: {
      petals: 'baja',
      petalKind: 'ninguna',
      wind: 0.2,
      // Valle abierto: libélulas sobre la hierba y alguna garza de paso.
      fauna: ['libelula', 'garza'],
      faunaDistance: 1.2,
      sounds: ['viento'],
      fog: { near: 30, far: 140 },
    },
  },
  {
    slug: 'eventos',
    kanji: '桜',
    romaji: 'Sakura',
    icon: 'sakura',
    group: 'eventos',
    route: 'eventos',
    pathT: 192 / PATH_LENGTH,
    inSidebar: true,
    palette: { halo: '#FFCCBC', accent: '#EB81A5', ground: '#FFDDE8' },
    // Sakura: relieve suave a la derecha; los cerezos van a los lados (Fase 7).
    environment: {
      hills: 'suaves',
      hillSides: ['derecha'],
      altitude: 0,
      lateral: 4,
      skyTint: { color: '#EB81A5', amount: 0.1 },
      decor: [],
      // Los pétalos caídos: empiezan sueltos a la altura del segundo kōsatsu
      // del tramo de Ubicación, son ya la mitad del suelo en el tercero y bajo
      // los cerezos, y en Eventos el suelo es casi todo rosa.
      // Siguen así por el llano de los cerezos y se acaban en la subida a Fushimi.
      petalCarpet: { cover: 0.95, before: 70, hold: TRAMO_EVENTOS.flat ?? 0, fade: 60 },
    },
    tramo: TRAMO_EVENTOS,
    ambient: {
      petals: 'alta',
      petalKind: 'sakura',
      wind: 0.5,
      fauna: ['mariposa', 'gorrion'],
      faunaDistance: 0.9,
      sounds: ['viento', 'furin', 'pajaros'],
      fog: { near: 16, far: 80 },
    },
  },
  {
    slug: 'fushimi-inari',
    kanji: '伏見稲荷大社',
    romaji: 'Fushimi Inari Taisha',
    icon: 'torii',
    group: 'lugares',
    route: 'lugares/fushimi-inari',
    pathT: 386 / PATH_LENGTH,
    inSidebar: true,
    palette: { halo: '#EDE6DD', accent: '#D82609', ground: '#C8BFAF' },
    // El monte Inari: relieve montañoso a ambos lados; el camino llega subiendo.
    environment: {
      hills: 'montanosa',
      hillSides: ['izquierda', 'derecha'],
      altitude: 14,
      lateral: -12,
      skyTint: { color: '#D82609', amount: 0.14 },
      decor: [],
    },
    tramo: NO_CARDS,
    ambient: {
      petals: 'baja',
      petalKind: 'momiji',
      wind: 0.3,
      fauna: ['milano', 'ardilla', 'gorrion'],
      faunaDistance: 1,
      sounds: ['viento', 'grillos', 'pajaros'],
      // Antes era 8/45 ("túnel"), pero a esa distancia la niebla se tragaba la
      // montaña por completo. La sensación de subida la da ahora la pendiente
      // del tramo de llegada (`environment.altitude`) y, en la Fase 6, las
      // gradas con los toriis repetidos.
      fog: { near: 12, far: 95 },
    },
  },
  {
    slug: 'kiyomizu-dera',
    kanji: '清水寺',
    romaji: 'Kiyomizu-dera',
    icon: 'pagoda',
    group: 'lugares',
    route: 'lugares/kiyomizu-dera',
    pathT: 514 / PATH_LENGTH,
    inSidebar: true,
    palette: { halo: '#FFCCBC', accent: '#B1341F', ground: '#E8D6C3' },
    // Ladera: el relieve sólo por la derecha; el camino sube un poco más y,
    // de aquí a Gion, baja.
    environment: { hills: 'montanosa', hillSides: ['derecha'], altitude: 17, lateral: 8, decor: [] },
    tramo: NO_CARDS,
    ambient: {
      // Los tres lugares comparten ambiente pasivo: aquí el protagonista es el
      // sitio —la terraza, los toriis, el callejón—, no lo que cae del cielo.
      petals: 'baja',
      petalKind: 'momiji',
      wind: 0.35,
      fauna: ['ardilla', 'garza', 'milano'],
      faunaDistance: 1.1,
      sounds: ['arroyo', 'viento', 'pajaros'],
      fog: { near: 24, far: 160 },
    },
  },
  {
    slug: 'gion',
    kanji: '祇園地区',
    romaji: 'Gion chiku',
    icon: 'farol',
    group: 'lugares',
    route: 'lugares/gion',
    pathT: 650 / PATH_LENGTH,
    inSidebar: true,
    palette: { halo: '#FFD699', accent: '#942D2D', ground: '#D8C4A0' },
    // Gion al anochecer: apenas la sombra de una colina a la derecha, luz ámbar.
    environment: {
      hills: 'suaves',
      hillSides: ['derecha'],
      altitude: 8,
      lateral: -10,
      skyTint: { color: '#FFD699', amount: 0.16 },
      decor: [],
    },
    tramo: NO_CARDS,
    ambient: {
      petals: 'baja',
      petalKind: 'sakura',
      wind: 0.15,
      // La luciérnaga vuelve con la noche: ámbar sobre washi no se ve (PLAN §11).
      fauna: ['gato', 'tanuki'],
      faunaDistance: 0.8,
      sounds: ['ciudad', 'arroyo', 'fuego'],
      // Callejón al anochecer: el encuadre se cierra.
      fog: { near: 10, far: 55 },
    },
  },
  {
    slug: 'gastronomia',
    kanji: '京料理',
    romaji: 'Kyo-ryori',
    icon: 'naruto',
    group: 'gastronomia',
    route: 'gastronomia',
    pathT: 1,
    inSidebar: true,
    palette: { halo: '#B4CCAD', accent: '#556B2F', ground: '#CBD9B8' },
    // Interior/cocina: terreno llano, sin relieve que distraiga del plato.
    environment: {
      hills: 'ninguna',
      hillSides: [],
      altitude: 8,
      lateral: 0,
      skyTint: { color: '#B4CCAD', amount: 0.12 },
      decor: [],
    },
    tramo: NO_CARDS,
    ambient: {
      petals: 'ninguna',
      petalKind: 'ninguna',
      wind: 0.1,
      // Gorriones picoteando en el patio de la machiya. La carpa queda
      // declarada para cuando haya agua en escena (ver bestiary.ts).
      fauna: ['gorrion', 'carpa'],
      faunaDistance: 0.9,
      sounds: ['arroyo', 'furin'],
      fog: { near: 30, far: 120 },
    },
  },
];

/* ── Derivados ──────────────────────────────────────────────────────────── */

export const STATION_SLUGS: readonly StationSlug[] = JOURNEY.map((s) => s.slug);

const BY_SLUG = new Map<StationSlug, Station>(JOURNEY.map((s) => [s.slug, s]));

export function getStation(slug: StationSlug): Station {
  const station = BY_SLUG.get(slug);
  if (!station) throw new Error(`Estación desconocida: ${slug}`);
  return station;
}

export function isStationSlug(value: string): value is StationSlug {
  return BY_SLUG.has(value as StationSlug);
}

/** Los 6 círculos del sidebar, en orden de camino. */
export const SIDEBAR_STATIONS: readonly Station[] = JOURNEY.filter((s) => s.inSidebar);

/** Las estaciones del grupo "lugares", para `lugares/[slug]`. */
export const PLACE_STATIONS: readonly Station[] = JOURNEY.filter((s) => s.group === 'lugares');

/**
 * Ruta SIN idioma. Es la que espera `<Link>` de next-intl, que se encarga de
 * anteponer el idioma activo.
 */
export function stationPath(station: Station): string {
  return station.route ? `/${station.route}` : '/';
}

/** Ruta absoluta, ya con idioma y barra final. Para sitemap, OG y enlaces duros. */
export function stationHref(station: Station, locale: Locale): string {
  return station.route ? `/${locale}/${station.route}/` : `/${locale}/`;
}

/**
 * La misma ruta en otro idioma, absoluta y con la barra final del export
 * («/lugares/gion» → «/en/lugares/gion/»). Los slugs no se traducen (decidido
 * en la Fase 3). La usa el cambio de idioma, que es una navegación completa
 * (ver `LanguageToggle`).
 */
export function localeHref(pathname: string, locale: Locale): string {
  const route = pathname.replace(/^\/+|\/+$/g, '');
  return route ? `/${locale}/${route}/` : `/${locale}/`;
}

/**
 * La estación de una ruta **sin idioma**, como la da el `usePathname` de
 * `@/i18n/navigation` («/lugares/gion/» → gion). Acepta la barra final del
 * export. `null` fuera del camino (`/diagnostico`, `/tipografia`). La usa la
 * navegación para marcar la estación actual ya en el HTML estático, sin
 * esperar al store (Fase 3C).
 */
export function stationFromPathname(pathname: string): Station | null {
  const route = pathname.replace(/^\/+|\/+$/g, '');
  return JOURNEY.find((station) => station.route === route) ?? null;
}

/** Estación anterior y siguiente sobre el camino (flechas y navegación por teclado). */
export function neighbours(slug: StationSlug): {
  prev: Station | null;
  next: Station | null;
} {
  const i = JOURNEY.findIndex((s) => s.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? (JOURNEY[i - 1] ?? null) : null,
    next: i < JOURNEY.length - 1 ? (JOURNEY[i + 1] ?? null) : null,
  };
}

/** Estación más cercana a un punto del camino. La usa la cámara en Fase 3. */
export function stationAt(t: number): Station {
  let best = JOURNEY[0]!;
  for (const s of JOURNEY) {
    if (Math.abs(s.pathT - t) < Math.abs(best.pathT - t)) best = s;
  }
  return best;
}

/**
 * Todos los kanji que el sitio necesita renderizar, deducidos del propio
 * camino. `scripts/subset-fonts.ts` lo lee para saber qué glifos conservar:
 * así la fuente japonesa nunca incluye glifos que no se usan.
 */
export const KANJI_EXTRA = '静音風光雨雪春夏秋冬年月日味道山川森';

export function requiredKanji(): string {
  const set = new Set<string>();
  for (const s of JOURNEY) for (const ch of s.kanji) set.add(ch);
  for (const ch of KANJI_EXTRA) set.add(ch);
  return [...set].sort().join('');
}
