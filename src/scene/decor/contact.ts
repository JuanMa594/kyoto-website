/**
 * Las sombras de contacto de una estación. Módulo puro.
 *
 * La sombra del sol cae hacia un lado y, en los tiers bajos, ni existe; lo que
 * pega un objeto al suelo es la penumbra justo debajo de él, donde no llega la
 * luz del cielo. Una por cada base de `objectBases` —pilar, farol, arbusto— y
 * una, pequeña, al pie de cada caña. El musgo no la lleva: es plano, y lo
 * ancla su propio halo de tierra húmeda (`MossPatches`).
 */

import { JOURNEY } from '@/config/journey';

import { groveCulms } from './bamboo';
import { objectBases } from './footprints';
import { groundPose } from './ground';
import { stationDecorLayout } from './placement';

export interface ContactShadow {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Radio de la penumbra, en unidades. */
  readonly radius: number;
  /** 0–1: lo oscura que es en su centro, relativa al máximo del material. */
  readonly strength: number;
  readonly normal: readonly [number, number, number];
}

/** Cuánto más ancha que lo que toca el suelo, y cuán oscura, según qué la proyecta. */
const SPREAD = { torii: 1.6, farol: 1.9, arbusto: 1.75, maqueta: 1.7 } as const;
const STRENGTH = { torii: 0.7, farol: 0.85, arbusto: 0.95, maqueta: 0.85 } as const;

/** La penumbra que deja la bandeja de la maqueta: el ancho de la bandeja, a media fuerza. */
const TRAY_SHADOW = { radius: 2.6, strength: 0.45 } as const;

/** Por debajo del musgo: se dibuja antes y él la cubre. */
const CONTACT_LIFT = 0.008;

/** Las sombras de contacto de la estación `index` y su tramo. Sin decoración, ninguna. */
export function stationContacts(index: number, portrait: boolean, densityScale: number): ContactShadow[] {
  if (!JOURNEY[index]) return [];
  const layout = stationDecorLayout(index, portrait);
  const shadows: ContactShadow[] = [];

  const add = (x: number, z: number, radius: number, strength: number) => {
    const pose = groundPose(x, z, CONTACT_LIFT);
    shadows.push({ x, y: pose.y, z, radius, strength, normal: pose.normal });
  };

  for (const o of layout.objects) {
    for (const base of objectBases(o)) add(base.x, base.z, base.foot * SPREAD[o.item.kind], STRENGTH[o.item.kind]);
    // La bandeja de la maqueta no proyecta sombra (era un bloque duro en el
    // suelo): la sustituye esta penumbra, ancha y suave, bajo ella.
    if (o.item.kind === 'maqueta') add(o.x, o.z, TRAY_SHADOW.radius * o.scale, TRAY_SHADOW.strength);
  }
  for (const grove of layout.groves) {
    for (const culm of groveCulms(grove, densityScale)) add(culm.x, culm.z, 0.22 + culm.radius * 2.5, 0.55);
  }
  return shadows;
}
