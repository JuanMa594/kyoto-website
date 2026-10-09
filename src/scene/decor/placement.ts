/**
 * La decoración de `journey.ts`, llevada al mundo. Módulo puro.
 *
 * Un descriptor dice dónde va algo en coordenadas del camino (`d`, `u`); aquí
 * se convierte en una posición del mundo apoyada en el terreno —también en
 * curvas y cuestas— y orientada según el rumbo del camino. Lo usan la escena
 * (`StationDecor`), las huellas de la fauna y `check:path`, así que los tres
 * ven exactamente lo mismo.
 */

import { JOURNEY, type DecorArea, type DecorGrove, type DecorItem } from '@/config/journey';
import type { QualityTier } from '@/scene/quality/tiers';
import { pathX, STATION_DEPTHS } from '@/scene/path/journeyPath';
import { groundY } from '@/scene/systems/elevation';

/** Cuánta decoración instanciada (cañas, hojas) por tier. */
export const DECOR_DENSITY: Record<QualityTier, number> = { high: 1, medium: 0.6, low: 0.35 };

/** El arbusto, en unidades a escala 1: radio en planta y alto. */
export const SHRUB_SIZE = { radius: 1.1, height: 1.35 } as const;

/** Rumbo del eje en `d`, sin acotar ni promediar (el de la cámara sí lo está). */
export function tangentYaw(d: number): number {
  return -Math.atan(pathX(d + 0.5) - pathX(d - 0.5));
}

export type DecorObject = Exclude<DecorItem, DecorGrove>;

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

export interface DecorLayout {
  readonly objects: readonly PlacedObject[];
  readonly groves: readonly PlacedGrove[];
}

export function isGrove(item: DecorItem): item is DecorGrove {
  return item.kind === 'bambu';
}

/** La decoración de una estación, para un aspecto. `portrait`: alto ≥ ancho. */
export function stationDecorLayout(index: number, portrait: boolean): DecorLayout {
  const station = JOURNEY[index];
  const stationD = STATION_DEPTHS[index];
  if (!station || stationD === undefined) return { objects: [], groves: [] };

  const objects: PlacedObject[] = [];
  const groves: PlacedGrove[] = [];

  for (const item of station.environment.decor) {
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
    // (las vigas de un torii) se aleja siempre del camino.
    const flip = at.u < 0 ? Math.PI : 0;
    objects.push({
      item,
      x,
      y: groundY(x, z),
      z,
      yaw: tangentYaw(d) + (item.yaw ?? 0) + flip,
      scale: item.scale ?? 1,
    });
  }

  return { objects, groves };
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
