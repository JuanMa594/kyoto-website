/**
 * Lo que ocupa la decoración en el suelo, con su altura. Módulo puro.
 *
 * Tres usuarios: las piedras (nada se planta encima), la cámara (nunca entra
 * en un objeto) y la fauna (un acto que atravesaría un pilar, un farol o una
 * caña de bambú no sale; ver `crossesDecor`). El musgo (`moss.ts`) crece al pie
 * de las mismas bases (`objectBases`). Es la sonda que el PLAN (§5.6, «Para las
 * fases 4–8») pedía extender a cada objeto nuevo.
 *
 * Un macizo publica dos cosas: su **franja** entera, que es lo que miran la
 * cámara y las piedras (las hojas también cuentan), y **cada caña**, que es lo
 * que mira la fauna. Con la franja, ningún animal podría cruzar el cuadro: los
 * actos entran por un lado y salen por el otro, y entre medias hay bambú. Entre
 * caña y caña sí se pasa; por el follaje, también.
 */

import { JOURNEY } from '@/config/journey';
import { EMA_HEIGHT, EMA_SIZE, emaPosts } from '@/scene/objects/ema/ema';
import { NOBORI, NOBORI_HEIGHT } from '@/scene/objects/nobori/nobori';
import { PEDESTAL, ROMON_FOOTPRINT, ROMON_FOXES, ROMON_HEIGHT } from '@/scene/objects/romon/romon';
import { boardWidth, KOSATSU_HEIGHT, KOSATSU_POST_Z, KOSATSU_SIZE, kosatsuPosts } from '@/scene/objects/kosatsu/kosatsu';
import { MAQUETA_PLAN, MAQUETA_SIZE } from '@/scene/objects/maqueta/maqueta';
import { growCerezo } from '@/scene/objects/cerezo/cerezo';
import { ROCA_FOOTPRINTS, ROCA_SIZE } from '@/scene/objects/roca/roca';
import { LANTERN_SIZE } from '@/scene/objects/toro/toro';
import { INARI, INARI_HEIGHT, inariLift } from '@/scene/objects/torii/inari';
import { RYOBU_FOOTPRINTS } from '@/scene/objects/torii/ryobu';
import { frameToWorld, pathX, type PathFrame, type Point3 } from '@/scene/path/journeyPath';
import { groundY } from '@/scene/systems/elevation';
import { placeAt, type FaunaAct } from '@/scene/systems/fauna/behaviors';

import { groveCulms } from './bamboo';
import { galleryPillars, type PlacedGallery } from './gallery';
import { areaU, objectToWorld, SHRUB_SIZE, stationDecorLayout, type PlacedObject } from './placement';
import { stationPebbles } from './pebbles';

/**
 * Margen que pide cada huella a la fauna, en fracción del cuerpo del animal.
 * 0 = no le cierra el paso (la franja del macizo: sólo la miran la cámara y
 * las piedras; para la fauna cuenta cada caña). Pilares, faroles y arbustos son
 * sólidos.
 */
const SOLID_MARGIN = 0.5;
/** Una caña es delgada: basta con que el cuerpo no la atraviese de lleno. */
const CULM_MARGIN = 0.25;
/** Una piedra de río es baja: lo que anda la rodea sin el margen de un pilar. */
const PEBBLE_MARGIN = 0.3;

export interface CircleFootprint {
  readonly kind: 'circulo';
  readonly x: number;
  readonly z: number;
  readonly r: number;
  /** La y del mundo de su punto más alto. */
  readonly top: number;
  readonly faunaMargin: number;
}

/** Una franja del camino: entre dos profundidades y dos `u` con signo. */
export interface BandFootprint {
  readonly kind: 'franja';
  readonly d0: number;
  readonly d1: number;
  readonly u0: number;
  readonly u1: number;
  readonly top: number;
  readonly faunaMargin: number;
}

/**
 * Un rectángulo girado en planta: la bandeja de la maqueta (Fase 5A). Un
 * círculo que cubriera sus esquinas le quitaría al camino un metro de cada
 * lado.
 */
export interface RectFootprint {
  readonly kind: 'rectangulo';
  readonly x: number;
  readonly z: number;
  /** El giro de three alrededor de Y: el eje local x del rectángulo. */
  readonly yaw: number;
  readonly hx: number;
  readonly hz: number;
  readonly top: number;
  readonly faunaMargin: number;
  /**
   * `false` si no toca el suelo: el tejadillo de un kōsatsu, a 4,5 u, cuenta
   * para la cámara y la fauna, pero no pisa las piedras (eso lo miran sus postes).
   */
  readonly ground?: false;
}

export type Footprint = CircleFootprint | BandFootprint | RectFootprint;

/** Una base de un objeto suelto: su huella y lo que de verdad toca el suelo. */
export interface ObjectBase extends CircleFootprint {
  /** Radio de lo que toca el suelo (sin el vuelo del tejado): ahí crece el musgo. */
  readonly foot: number;
}

/** Lo que pisa un objeto colocado: un círculo por pilar, por arbusto, por farol. */
export function objectBases(o: PlacedObject): ObjectBase[] {
  const item = o.item;
  // Un corro no tiene base: sus piedras publican su propia huella (`stationPebbles`).
  if (item.kind === 'corro') return [];
  if (item.kind === 'torii') {
    const point = { x: 0, z: 0 };
    return RYOBU_FOOTPRINTS.map((f) => {
      objectToWorld(o, f.x, f.z, point);
      return {
        kind: 'circulo',
        x: point.x,
        z: point.z,
        r: f.r * o.scale,
        foot: f.r * o.scale,
        top: o.y + f.top * o.scale,
        faunaMargin: SOLID_MARGIN,
      };
    });
  }
  if (item.kind === 'farol') {
    const size = LANTERN_SIZE[item.variant];
    return [
      {
        kind: 'circulo',
        x: o.x,
        z: o.z,
        r: size.radius * o.scale,
        foot: size.foot * o.scale,
        top: o.y + size.height * o.scale,
        faunaMargin: SOLID_MARGIN,
      },
    ];
  }
  if (item.kind === 'kosatsu') {
    // Los dos postes. La tabla y el tejadillo van aparte (`kosatsuFootprint`).
    const point = { x: 0, z: 0 };
    return kosatsuPosts(item.map).map((lx) => {
      objectToWorld(o, lx, KOSATSU_POST_Z, point);
      return {
        kind: 'circulo',
        x: point.x,
        z: point.z,
        r: KOSATSU_SIZE.postSize * o.scale,
        foot: KOSATSU_SIZE.postSize * o.scale,
        top: o.y + KOSATSU_HEIGHT * o.scale,
        faunaMargin: SOLID_MARGIN,
      };
    });
  }
  if (item.kind === 'romon') {
    // Las esquinas de la base y los dos pedestales: ahí crecen el musgo y la
    // penumbra. Lo que ocupa entero va aparte (`romonFootprint`).
    const point = { x: 0, z: 0 };
    const { hx, hz, cz } = ROMON_FOOTPRINT;
    const corners = [
      [-hx, cz - hz],
      [hx, cz - hz],
      [-hx, cz + hz - 1.6],
      [hx, cz + hz - 1.6],
    ] as const;
    return [
      ...corners.map(([lx, lz]) => ({ lx, lz, r: 0.7 })),
      ...ROMON_FOXES.map((fox) => ({ lx: fox.x, lz: fox.z, r: PEDESTAL.half * 1.3 })),
    ].map(({ lx, lz, r }) => {
      objectToWorld(o, lx, lz, point);
      return {
        kind: 'circulo' as const,
        x: point.x,
        z: point.z,
        r: r * o.scale,
        foot: r * o.scale,
        top: o.y + ROMON_HEIGHT * o.scale,
        faunaMargin: SOLID_MARGIN,
      };
    });
  }
  if (item.kind === 'nobori') {
    return [
      {
        kind: 'circulo',
        x: o.x,
        z: o.z,
        r: NOBORI.poleRadius * 2.5 * o.scale,
        foot: 0.18 * o.scale,
        top: o.y + NOBORI_HEIGHT * o.scale,
        faunaMargin: SOLID_MARGIN,
      },
    ];
  }
  if (item.kind === 'ema') {
    // Los dos postes del ema-kake. Las ema y el tejadillo van aparte (`emaFootprint`).
    const point = { x: 0, z: 0 };
    return emaPosts().map((lx) => {
      objectToWorld(o, lx, 0, point);
      return {
        kind: 'circulo',
        x: point.x,
        z: point.z,
        r: EMA_SIZE.postSize * o.scale,
        foot: EMA_SIZE.postSize * o.scale,
        top: o.y + EMA_HEIGHT * o.scale,
        faunaMargin: SOLID_MARGIN,
      };
    });
  }
  if (item.kind === 'cerezo') {
    // El tronco. La copa es blanda: lo que vuela la cruza.
    const tree = growCerezo(item.seed);
    return [
      {
        kind: 'circulo',
        x: o.x,
        z: o.z,
        r: tree.trunkRadius * 1.6 * o.scale,
        foot: tree.trunkRadius * 1.4 * o.scale,
        top: o.y + 2 * o.scale,
        faunaMargin: SOLID_MARGIN,
      },
    ];
  }
  if (item.kind === 'roca') {
    const point = { x: 0, z: 0 };
    return ROCA_FOOTPRINTS.map((f) => {
      objectToWorld(o, f.x, 0, point);
      return {
        kind: 'circulo',
        x: point.x,
        z: point.z,
        r: f.r * o.scale,
        foot: f.foot * o.scale,
        top: o.y + ROCA_SIZE.height * o.scale,
        faunaMargin: SOLID_MARGIN,
      };
    });
  }
  if (item.kind === 'maqueta') {
    // El pie del atril. La bandeja va aparte, como rectángulo (`trayFootprint`).
    return [
      {
        kind: 'circulo',
        x: o.x,
        z: o.z,
        r: MAQUETA_SIZE.columnRadius * 1.25 * o.scale,
        foot: MAQUETA_SIZE.foot * o.scale,
        top: o.y + MAQUETA_SIZE.top * o.scale,
        faunaMargin: SOLID_MARGIN,
      },
    ];
  }
  return [
    {
      kind: 'circulo',
      x: o.x,
      z: o.z,
      r: SHRUB_SIZE.radius * o.scale,
      foot: SHRUB_SIZE.radius * 0.85 * o.scale,
      top: o.y + SHRUB_SIZE.height * o.scale,
      // Es una masa compacta de 1,35 de alto: la garza que vadea la
      // atravesaba a la vista. Lo que vuela por encima de su copa, pasa.
      faunaMargin: SOLID_MARGIN,
    },
  ];
}

/**
 * Los pilares de una galería de toriis (Fase 6A), como bases: para la fauna,
 * cada uno es un obstáculo sólido; al pie de cada uno crecen musgo y sombra de
 * contacto. Con `sparse`, en las galerías densas sólo uno de cada dos: entre
 * pilares tan juntos apenas se ve el suelo, y el musgo de todos sería el doble
 * de parches para lo mismo.
 */
export function galleryBases(gallery: PlacedGallery, sparse = false): ObjectBase[] {
  const bases: ObjectBase[] = [];
  gallery.toriis.forEach((torii, k) => {
    if (sparse && gallery.item.variant === 'densa' && k % 2 === 1) return;
    for (const pillar of galleryPillars(torii)) {
      bases.push({
        kind: 'circulo',
        x: pillar.x,
        z: pillar.z,
        r: INARI.baseRadius[0],
        foot: INARI.baseRadius[0],
        top: torii.y + inariLift(INARI_HEIGHT, torii.lift),
        faunaMargin: SOLID_MARGIN,
      });
    }
  });
  return bases;
}

/**
 * Las dos hileras de pilares de una galería, como franjas: lo que miran la
 * cámara y las piedras. **No el pasillo entero**: por ahí pasa la cámara, bajo
 * los dinteles. Para la fauna cuentan los pilares uno a uno (`galleryBases`).
 */
export function galleryBands(gallery: PlacedGallery): BandFootprint[] {
  const half = INARI.span / 2;
  const r = INARI.baseRadius[0];
  const top = Math.max(...gallery.toriis.map((t) => t.y + inariLift(INARI_HEIGHT, t.lift)));
  return [
    { kind: 'franja', d0: gallery.from - r, d1: gallery.to + r, u0: -half - r, u1: -half + r, top, faunaMargin: 0 },
    { kind: 'franja', d0: gallery.from - r, d1: gallery.to + r, u0: half - r, u1: half + r, top, faunaMargin: 0 },
  ];
}

/** La bandeja de la maqueta en planta: un rectángulo que cubre sus dos poses. */
export function trayFootprint(o: PlacedObject): RectFootprint {
  return {
    kind: 'rectangulo',
    x: o.x,
    z: o.z,
    yaw: o.yaw,
    hx: MAQUETA_PLAN.hx * o.scale,
    hz: MAQUETA_PLAN.hz * o.scale,
    top: o.y + MAQUETA_SIZE.top * o.scale,
    faunaMargin: SOLID_MARGIN,
  };
}

/**
 * La planta del tejadillo de un kōsatsu: la tabla baja hasta 0,6 u del suelo,
 * así que lo que anda no pasa por debajo; y la cámara, al pasar a su lado,
 * tiene que quedar a su distancia también del vuelo del tejado.
 */
export function kosatsuFootprint(o: PlacedObject): RectFootprint {
  return {
    kind: 'rectangulo',
    x: o.x,
    z: o.z,
    yaw: o.yaw,
    hx: (boardWidth(o.item.kind === 'kosatsu' ? o.item.map : undefined) / 2 + KOSATSU_SIZE.roofOverhang) * o.scale,
    hz: (KOSATSU_SIZE.roofDepth / 2) * o.scale,
    top: o.y + KOSATSU_HEIGHT * o.scale,
    faunaMargin: SOLID_MARGIN,
    ground: false,
  };
}

/**
 * La planta de un ema-kake (6A): las ema de zorro cuelgan hasta medio metro
 * del suelo, así que lo que anda no pasa por debajo; y la cámara, al pasar a
 * su lado, queda a su distancia también del vuelo del tejadillo.
 */
export function emaFootprint(o: PlacedObject): RectFootprint {
  return {
    kind: 'rectangulo',
    x: o.x,
    z: o.z,
    yaw: o.yaw,
    hx: (EMA_SIZE.frameWidth / 2 + EMA_SIZE.roofOverhang) * o.scale,
    hz: (EMA_SIZE.roofDepth / 2) * o.scale,
    top: o.y + EMA_HEIGHT * o.scale,
    faunaMargin: SOLID_MARGIN,
    ground: false,
  };
}

/** La base del rōmon con su escalinata, en planta: un rectángulo sólido. */
export function romonFootprint(o: PlacedObject): RectFootprint {
  const center = { x: 0, z: 0 };
  objectToWorld(o, 0, ROMON_FOOTPRINT.cz, center);
  return {
    kind: 'rectangulo',
    x: center.x,
    z: center.z,
    yaw: o.yaw,
    hx: ROMON_FOOTPRINT.hx * o.scale,
    hz: ROMON_FOOTPRINT.hz * o.scale,
    top: o.y + ROMON_HEIGHT * o.scale,
    faunaMargin: SOLID_MARGIN,
  };
}

const cache = new Map<boolean, readonly Footprint[]>();

/** Todas las huellas del camino para un aspecto, calculadas una vez. */
export function decorFootprints(portrait: boolean): readonly Footprint[] {
  const cached = cache.get(portrait);
  if (cached) return cached;

  const list: Footprint[] = [];

  JOURNEY.forEach((_, index) => {
    const layout = stationDecorLayout(index, portrait);

    for (const o of layout.objects) {
      list.push(...objectBases(o));
      if (o.item.kind === 'maqueta') list.push(trayFootprint(o));
      if (o.item.kind === 'kosatsu') list.push(kosatsuFootprint(o));
      if (o.item.kind === 'ema') list.push(emaFootprint(o));
      if (o.item.kind === 'romon') list.push(romonFootprint(o));
    }

    // Las galerías de toriis (6A): cada pilar para la fauna, cada hilera para la cámara.
    for (const gallery of layout.galleries) {
      list.push(...galleryBases(gallery), ...galleryBands(gallery));
    }

    // Las piedras de río al pie de faroles y postes (5B): bajas, pero sólidas.
    for (const p of stationPebbles(index, portrait)) {
      list.push({ kind: 'circulo', x: p.x, z: p.z, r: p.radius, top: p.y + p.height, faunaMargin: PEBBLE_MARGIN });
    }

    for (const g of layout.groves) {
      const [u0, u1] = areaU(g.area);
      const d0 = g.stationD + g.area.from;
      const d1 = g.stationD + g.area.to;
      // El suelo sube con las colinas fuera del pasillo: la copa se mide desde
      // lo más alto de la franja.
      let floor = Number.NEGATIVE_INFINITY;
      for (const d of [d0, (d0 + d1) / 2, d1]) {
        for (const u of [u0, (u0 + u1) / 2, u1]) floor = Math.max(floor, groundY(pathX(d) + u, -d));
      }
      list.push({ kind: 'franja', d0, d1, u0, u1, top: floor + g.item.height[1] + 0.6, faunaMargin: 0 });

      // Las cañas del tier alto: en los demás tiers salen las primeras de la
      // misma lista (mismo sorteo, se para antes), así que éstas las cubren.
      for (const culm of groveCulms(g, 1)) {
        list.push({
          kind: 'circulo',
          x: culm.x,
          z: culm.z,
          r: culm.radius,
          top: culm.y + culm.height,
          faunaMargin: CULM_MARGIN,
        });
      }
    }

    // La susuki (Fase 5B): sólo su franja, para la cámara y las piedras. Para
    // la fauna es blanda: la cruzan las libélulas y la garza.
    for (const s of layout.susuki) {
      const [u0, u1] = areaU(s.area);
      const d0 = s.stationD + s.area.from;
      const d1 = s.stationD + s.area.to;
      let floor = Number.NEGATIVE_INFINITY;
      for (const d of [d0, (d0 + d1) / 2, d1]) {
        for (const u of [u0, (u0 + u1) / 2, u1]) floor = Math.max(floor, groundY(pathX(d) + u, -d));
      }
      list.push({ kind: 'franja', d0, d1, u0, u1, top: floor + s.item.height[1] + 0.3, faunaMargin: 0 });
    }
  });

  cache.set(portrait, list);
  return list;
}

/**
 * Distancia horizontal de (x, z) al borde de la huella; negativa si cae
 * dentro. La de la franja se mide en coordenadas del camino.
 */
export function footprintDistance(f: Footprint, x: number, z: number): number {
  if (f.kind === 'circulo') return Math.hypot(x - f.x, z - f.z) - f.r;
  if (f.kind === 'rectangulo') {
    // Al sistema del rectángulo: la inversa del giro de three.
    const dx = x - f.x;
    const dz = z - f.z;
    const cos = Math.cos(f.yaw);
    const sin = Math.sin(f.yaw);
    const lx = Math.abs(dx * cos - dz * sin) - f.hx;
    const lz = Math.abs(dx * sin + dz * cos) - f.hz;
    if (lx <= 0 && lz <= 0) return Math.max(lx, lz);
    return Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
  }
  const d = -z;
  const u = x - pathX(d);
  const du = Math.max(f.u0 - u, 0, u - f.u1);
  const dd = Math.max(f.d0 - d, 0, d - f.d1);
  if (du === 0 && dd === 0) return -Math.min(u - f.u0, f.u1 - u, d - f.d0, f.d1 - d);
  return Math.hypot(du, dd);
}

/** Si un punto del mundo cae dentro de la huella (y por debajo de su copa), con margen. */
export function insideFootprint(f: Footprint, x: number, y: number, z: number, margin: number): boolean {
  if (y > f.top + margin) return false;
  return footprintDistance(f, x, z) < margin;
}

/** Distancia en planta de una huella al origen de un acto, para descartar las lejanas. */
function distanceToFrame(f: Footprint, frame: PathFrame): number {
  if (f.kind === 'circulo' || f.kind === 'rectangulo') return Math.hypot(f.x - frame.x, f.z - frame.z);
  const d = -frame.z;
  return Math.max(f.d0 - d, 0, d - f.d1);
}

const sample: Point3 = { x: 0, y: 0, z: 0 };
const flat = { x: 0, z: 0 };
/** Cada cuánto se muestrea la trayectoria, en segundos. */
const SAMPLE_STEP = 0.25;
/** Más allá de esto del origen del acto, ninguna huella le afecta. */
const NEAR = 60;

/**
 * Si algún individuo del acto atravesaría una huella que le cierra el paso en
 * algún momento de su tiempo. Se mide en el mundo, con el ancla de nacimiento
 * (`origin`): lo que vuela y desliza su ancla se aleja de ahí, nunca se
 * acerca, así que el error está del lado seguro.
 */
export function crossesDecor(act: FaunaAct, footprints: readonly Footprint[]): boolean {
  const near = footprints.filter((f) => f.faunaMargin > 0 && distanceToFrame(f, act.origin) < NEAR);
  if (near.length === 0) return false;

  // Primero la trayectoria entera y su caja: sólo cuentan las huellas que la
  // tocan. Se corre en el frame en que nace el acto, hasta cuatro veces.
  const points: number[] = [];
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let member = 0; member < act.members; member += 1) {
    for (let s = 0; s <= act.duration; s += SAMPLE_STEP) {
      placeAt(act, member, s, sample);
      frameToWorld(act.origin, sample.x, sample.z, flat);
      points.push(flat.x, act.origin.y + sample.y, flat.z);
      minX = Math.min(minX, flat.x);
      maxX = Math.max(maxX, flat.x);
      minZ = Math.min(minZ, flat.z);
      maxZ = Math.max(maxZ, flat.z);
    }
  }

  const reach = act.spec.size;
  const touching = near.filter((f) => {
    if (f.kind === 'franja') return true;
    if (f.kind === 'rectangulo') {
      const r = Math.hypot(f.hx, f.hz) + reach;
      return f.x + r > minX && f.x - r < maxX && f.z + r > minZ && f.z - r < maxZ;
    }
    return f.x + f.r + reach > minX && f.x - f.r - reach < maxX && f.z + f.r + reach > minZ && f.z - f.r - reach < maxZ;
  });

  for (let i = 0; i < points.length; i += 3) {
    for (const f of touching) {
      if (insideFootprint(f, points[i]!, points[i + 1]!, points[i + 2]!, act.spec.size * f.faunaMargin)) return true;
    }
  }
  return false;
}
