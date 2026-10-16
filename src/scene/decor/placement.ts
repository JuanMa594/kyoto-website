/**
 * La decoración de `journey.ts`, llevada al mundo. Módulo puro.
 *
 * Un descriptor dice dónde va algo en coordenadas del camino (`d`, `u`); aquí
 * se convierte en una posición del mundo apoyada en el terreno —también en
 * curvas y cuestas— y orientada según el rumbo del camino. Lo usan la escena
 * (`StationDecor`), las huellas de la fauna y `check:path`, así que los tres
 * ven exactamente lo mismo.
 */

import { cardStopD } from '@/animation/journeyScroll';
import {
  JOURNEY,
  type DecorArea,
  type DecorGrove,
  type DecorItem,
  type DecorSusuki,
  type OldMap,
  type Side,
  type StationSlug,
} from '@/config/journey';
import { createRig, snapRig } from '@/scene/camera/pathRig';
import { boardWidth, KOSATSU_POST_Z, KOSATSU_SCALE, KOSATSU_SIZE, kosatsuPosts } from '@/scene/objects/kosatsu/kosatsu';
import type { QualityTier } from '@/scene/quality/tiers';
import { pathX, STATION_DEPTHS } from '@/scene/path/journeyPath';
import { stoneLayout, type StoneInstance } from '@/scene/path/stones';
import { groundY } from '@/scene/systems/elevation';

/** Cuánta decoración instanciada (cañas, hojas) por tier. */
export const DECOR_DENSITY: Record<QualityTier, number> = { high: 1, medium: 0.6, low: 0.35 };

/** El arbusto, en unidades a escala 1: radio en planta y alto. */
export const SHRUB_SIZE = { radius: 1.1, height: 1.35 } as const;

/** Rumbo del eje en `d`, sin acotar ni promediar (el de la cámara sí lo está). */
export function tangentYaw(d: number): number {
  return -Math.atan(pathX(d + 0.5) - pathX(d - 0.5));
}

/**
 * Un kōsatsu del tramo (Fase 5B). No se declara en `decor`: lo deriva
 * `stationDecorLayout` de cada tarjeta con `sign`, delante de su parada.
 */
export interface KosatsuItem {
  readonly kind: 'kosatsu';
  /** La estación cuyo tramo lo lleva. */
  readonly station: StationSlug;
  /** Índice de su tarjeta en `tramo.cards`: el de `KOSATSU.rects`. */
  readonly card: number;
  readonly side: Side;
  readonly map?: OldMap;
}

export type DecorObject = Exclude<DecorItem, DecorGrove | DecorSusuki> | KosatsuItem;

export interface PlacedObject {
  readonly item: DecorObject;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly scale: number;
}

export interface PlacedGrove {
  readonly item: DecorGrove;
  /** El área que toca según el aspecto. */
  readonly area: DecorArea;
  /** Profundidad de la estación que lo declara. */
  readonly stationD: number;
}

/** Un macizo de susuki con el área de su aspecto (Fase 5B). */
export interface PlacedSusuki {
  readonly item: DecorSusuki;
  readonly area: DecorArea;
  readonly stationD: number;
}

export interface DecorLayout {
  readonly objects: readonly PlacedObject[];
  readonly groves: readonly PlacedGrove[];
  readonly susuki: readonly PlacedSusuki[];
}

export function isGrove(item: DecorItem): item is DecorGrove {
  return item.kind === 'bambu';
}

/** La decoración de una estación, para un aspecto. `portrait`: alto ≥ ancho. */
export function stationDecorLayout(index: number, portrait: boolean): DecorLayout {
  const station = JOURNEY[index];
  const stationD = STATION_DEPTHS[index];
  if (!station || stationD === undefined) return { objects: [], groves: [], susuki: [] };

  const objects: PlacedObject[] = [];
  const groves: PlacedGrove[] = [];
  const susuki: PlacedSusuki[] = [];

  for (const item of station.environment.decor) {
    if (item.kind === 'susuki') {
      const area = portrait && item.portrait !== undefined ? item.portrait : item.area;
      if (area) susuki.push({ item, area, stationD });
      continue;
    }
    if (isGrove(item)) {
      const area = portrait && item.portrait !== undefined ? item.portrait : item.area;
      if (area) groves.push({ item, area, stationD });
      continue;
    }

    const at = portrait && item.portrait !== undefined ? item.portrait : item.at;
    if (!at) continue;
    const d = stationD + at.d;
    const x = pathX(d) + at.u;
    const z = -d;
    // Al otro lado del camino el objeto se da la vuelta: lo que se extiende
    // (las vigas de un torii) se aleja siempre del camino. La maqueta y la roca
    // pintada no: miran siempre a la cámara.
    const flip = at.u < 0 && item.kind !== 'maqueta' && item.kind !== 'roca' ? Math.PI : 0;
    objects.push({
      item,
      x,
      y: groundY(x, z),
      z,
      // El cerezo no se gira: lo que se mece se dobla en los ejes del mundo.
      yaw: item.kind === 'cerezo' ? 0 : tangentYaw(d) + (item.yaw ?? 0) + flip,
      scale: (at.scale ?? 1) * (item.scale ?? 1),
    });
  }

  // Los kōsatsu del tramo: uno por tarjeta con cartel, a `depthFromCamera`
  // por delante de la cámara de su parada, en su lado y de frente a ella. Se
  // colocan igual en vertical: allí son escenario y el texto va en la tarjeta.
  const rig = createRig();
  station.tramo.cards.forEach((card, index) => {
    if (!card.sign) return;
    snapRig(rig, cardStopD(station.slug, index));
    const d = -rig.camera.z + KOSATSU_SIZE.depthFromCamera;
    const sign = card.side === 'izquierda' ? -1 : 1;
    const z = -d;
    // Paralela al plano de la imagen de la cámara de su parada (su rumbo): así
    // la tabla se proyecta como una copia escalada, sin trapecio, y el texto
    // DOM encaja con sólo trasladarlo y escalarlo.
    const yaw = rig.yaw;
    const map = card.sign.map;
    let x = pathX(d) + sign * (KOSATSU_SIZE.innerU + (boardWidth(map) / 2) * KOSATSU_SCALE);
    // Girada con el rumbo, una esquina del tejadillo se acerca al camino: se
    // aparta hasta que la más cercana quede en `innerU`.
    x += sign * (KOSATSU_SIZE.innerU - nearestCornerU({ x, z, yaw, scale: KOSATSU_SCALE }, sign, map));
    // En las curvas las piedras serpentean más lejos del eje: se aparta lo que
    // haga falta para no pisar ninguna.
    for (let pass = 0; pass < 3; pass += 1) {
      const gap = stoneGap({ x, z, yaw, scale: KOSATSU_SCALE }, d, map);
      if (gap >= STONE_CLEAR) break;
      x += sign * (STONE_CLEAR - gap + 0.01);
    }
    objects.push({
      item: { kind: 'kosatsu', station: station.slug, card: index, side: card.side, map: card.sign.map },
      x,
      y: groundY(x, z),
      z,
      yaw,
      scale: KOSATSU_SCALE,
    });
  });

  return { objects, groves, susuki };
}

/** Radio de una piedra con su escala máxima, más un margen: lo que cada poste deja libre. */
const STONE_CLEAR = 0.5;

let stones: readonly StoneInstance[] | null = null;

/**
 * Lo más cerca que queda una piedra del borde de un poste de un kōsatsu en
 * `d`. Sólo los postes tocan el suelo: la tabla y el tejadillo van por encima.
 */
function stoneGap(o: { x: number; z: number; yaw: number; scale: number }, d: number, map: OldMap | undefined): number {
  stones ??= stoneLayout();
  const post = { x: 0, z: 0 };
  let gap = Number.POSITIVE_INFINITY;
  for (const lx of kosatsuPosts(map)) {
    objectToWorld(o, lx, KOSATSU_POST_Z, post);
    for (const stone of stones) {
      if (Math.abs(-stone.z - d) > boardWidth(map) * o.scale) continue;
      gap = Math.min(gap, Math.hypot(stone.x - post.x, stone.z - post.z) - KOSATSU_SIZE.postSize * o.scale);
    }
  }
  return gap;
}

/**
 * La |u| de la esquina de la planta del tejadillo de un kōsatsu más cercana al
 * eje del camino (`sign`: el lado en que está).
 */
function nearestCornerU(o: { x: number; z: number; yaw: number; scale: number }, sign: number, map: OldMap | undefined): number {
  const hx = (boardWidth(map) / 2 + KOSATSU_SIZE.roofOverhang) * o.scale;
  const hz = (KOSATSU_SIZE.roofDepth / 2) * o.scale;
  const corner = { x: 0, z: 0 };
  let nearest = Number.POSITIVE_INFINITY;
  for (const [lx, lz] of [
    [hx, hz],
    [hx, -hz],
    [-hx, hz],
    [-hx, -hz],
  ] as const) {
    objectToWorld(o, lx, lz, corner);
    nearest = Math.min(nearest, sign * (corner.x - pathX(-corner.z)));
  }
  return nearest;
}

/** Del sistema local de un objeto colocado al mundo, en XZ: la rotación de three. */
export function objectToWorld(
  o: { readonly x: number; readonly z: number; readonly yaw: number; readonly scale: number },
  lx: number,
  lz: number,
  out: { x: number; z: number },
): void {
  const cos = Math.cos(o.yaw);
  const sin = Math.sin(o.yaw);
  out.x = o.x + (lx * cos + lz * sin) * o.scale;
  out.z = o.z + (-lx * sin + lz * cos) * o.scale;
}

/** Las `u` de un área, con el signo de su costado y en orden. */
export function areaU(area: DecorArea): [number, number] {
  return area.side === 'izquierda' ? [-area.outer, -area.inner] : [area.inner, area.outer];
}
