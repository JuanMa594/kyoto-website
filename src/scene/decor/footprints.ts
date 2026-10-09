/**
 * Lo que ocupa la decoración en el suelo, con su altura. Módulo puro.
 *
 * Tres usuarios: las piedras (nada se planta encima), la cámara (nunca entra
 * en un objeto) y la fauna (un acto que atravesaría un pilar o una caña de
 * bambú no sale; ver `crossesDecor`). Es la sonda que el PLAN (§5.6, «Para las
 * fases 4–8») pedía extender a cada objeto nuevo.
 *
 * Un macizo publica dos cosas: su **franja** entera, que es lo que miran la
 * cámara y las piedras (las hojas también cuentan), y **cada caña**, que es lo
 * que mira la fauna. Con la franja, ningún animal podría cruzar el cuadro: los
 * actos entran por un lado y salen por el otro, y entre medias hay bambú. Entre
 * caña y caña sí se pasa; por el follaje, también.
 */

import { JOURNEY } from '@/config/journey';
import { RYOBU_FOOTPRINTS } from '@/scene/objects/torii/ryobu';
import { frameToWorld, pathX, type PathFrame, type Point3 } from '@/scene/path/journeyPath';
import { groundY } from '@/scene/systems/elevation';
import { placeAt, type FaunaAct } from '@/scene/systems/fauna/behaviors';

import { groveCulms } from './bamboo';
import { areaU, objectToWorld, SHRUB_SIZE, stationDecorLayout } from './placement';

/**
 * Margen que pide cada huella a la fauna, en fracción del cuerpo del animal.
 * 0 = no le cierra el paso (el arbusto: bajo y blando; la franja del macizo:
 * sólo la miran la cámara y las piedras).
 */
const SOLID_MARGIN = 0.5;
/** Una caña es delgada: basta con que el cuerpo no la atraviese de lleno. */
const CULM_MARGIN = 0.25;

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

export type Footprint = CircleFootprint | BandFootprint;

const cache = new Map<boolean, readonly Footprint[]>();

/** Todas las huellas del camino para un aspecto, calculadas una vez. */
export function decorFootprints(portrait: boolean): readonly Footprint[] {
  const cached = cache.get(portrait);
  if (cached) return cached;

  const list: Footprint[] = [];
  const point = { x: 0, z: 0 };

  JOURNEY.forEach((_, index) => {
    const layout = stationDecorLayout(index, portrait);

    for (const o of layout.objects) {
      if (o.item.kind === 'torii') {
        for (const f of RYOBU_FOOTPRINTS) {
          objectToWorld(o, f.x, f.z, point);
          list.push({
            kind: 'circulo',
            x: point.x,
            z: point.z,
            r: f.r * o.scale,
            top: o.y + f.top * o.scale,
            faunaMargin: SOLID_MARGIN,
          });
        }
      } else {
        list.push({
          kind: 'circulo',
          x: o.x,
          z: o.z,
          r: SHRUB_SIZE.radius * o.scale,
          top: o.y + SHRUB_SIZE.height * o.scale,
          faunaMargin: 0,
        });
      }
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
  if (f.kind === 'circulo') return Math.hypot(f.x - frame.x, f.z - frame.z);
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
    return f.x + f.r + reach > minX && f.x - f.r - reach < maxX && f.z + f.r + reach > minZ && f.z - f.r - reach < maxZ;
  });

  for (let i = 0; i < points.length; i += 3) {
    for (const f of touching) {
      if (insideFootprint(f, points[i]!, points[i + 1]!, points[i + 2]!, act.spec.size * f.faunaMargin)) return true;
    }
  }
  return false;
}
