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
  /** `mapa` deja además el hueco del mapa (Fase 5); `texto` es sólo lectura. */
  readonly kind: 'texto' | 'mapa';
}

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
 * De Ubicación a la sakura: dónde está Kyoto y cómo es, antes de llegar a los
 * cerezos. Provisional: las dos tarjetas de mapa dejan el hueco del mapa
 * antiguo desplegable, que se hace en la Fase 5.
 */
const TRAMO_UBICACION: StationTramo = {
  cards: [
    { id: 'japon', side: 'izquierda', kind: 'mapa' },
    { id: 'kansai', side: 'derecha', kind: 'mapa' },
    { id: 'resena', side: 'izquierda', kind: 'texto' },
  ],
};

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
    environment: { hills: 'suaves', hillSides: ['izquierda'], altitude: 0, lateral: 0 },
    tramo: NO_CARDS,
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
    palette: { halo: '#FFFFFF', accent: '#C4181A', ground: '#F3EFE4' },
    // Valle abierto: ondulación baja por los dos costados.
    environment: { hills: 'suaves', hillSides: ['izquierda', 'derecha'], altitude: 0, lateral: -8 },
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
    environment: { hills: 'montanosa', hillSides: ['derecha'], altitude: 17, lateral: 8 },
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
