/**
 * Las sombras de contacto de una estación. Módulo puro.
 *
 * La sombra del sol cae hacia un lado y, en los tiers bajos, ni existe; lo que
 * pega un objeto al suelo es la penumbra justo debajo de él, donde no llega la
 * luz del cielo. Una por cada base de `objectBases` —pilar, farol, arbusto— y
 * una, pequeña, al pie de cada caña. El musgo no la lleva: es plano, y lo
 * ancla su propio halo de tierra húmeda (`MossPatches`).
 *
 * Lo que sale de la tierra —los postes de madera de los kōsatsu y los troncos
 * de los cerezos— lleva además un halo de **tierra oscura** de borde
 * irregular, más ancho que la sombra (`earth`): la tierra removida y húmeda al
 * pie, que lo funde con el suelo. Y cada piedra de río mayor, su penumbra.
 */

import { JOURNEY } from '@/config/journey';

import { groveCulms } from './bamboo';
import { objectBases } from './footprints';
import { stationPebbles } from './pebbles';
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
  /** 0: penumbra; 1: tierra oscura de borde irregular. */
  readonly earth: number;
}

/** Cuánto más ancha que lo que toca el suelo, y cuán oscura, según qué la proyecta. */
// Un corro no tiene base (`objectBases` no devuelve ninguna): sus valores no se usan.
const SPREAD = { torii: 1.6, farol: 1.9, arbusto: 1.75, maqueta: 1.7, kosatsu: 1.9, roca: 1.5, cerezo: 2.4, corro: 0 } as const;
const STRENGTH = { torii: 0.7, farol: 0.85, arbusto: 0.95, maqueta: 0.85, kosatsu: 0.8, roca: 0.9, cerezo: 0.75, corro: 0 } as const;

/** El halo de tierra: cuánto más ancho que el pie, y cuán marcado. */
const EARTH = { kosatsu: { spread: 6, strength: 0.85 }, cerezo: { spread: 4, strength: 0.8 } } as const;

/** Por debajo del musgo: se dibuja antes y él la cubre. */
const CONTACT_LIFT = 0.008;

/** Las sombras de contacto de la estación `index` y su tramo. Sin decoración, ninguna. */
export function stationContacts(index: number, portrait: boolean, densityScale: number): ContactShadow[] {
  if (!JOURNEY[index]) return [];
  const layout = stationDecorLayout(index, portrait);
  const shadows: ContactShadow[] = [];

  const add = (x: number, z: number, radius: number, strength: number, earth = 0) => {
    const pose = groundPose(x, z, CONTACT_LIFT);
    shadows.push({ x, y: pose.y, z, radius, strength, normal: pose.normal, earth });
  };

  for (const o of layout.objects) {
    const kind = o.item.kind;
    for (const base of objectBases(o)) {
      // La tierra va primero: la penumbra, más pequeña, se dibuja encima.
      if (kind === 'kosatsu' || kind === 'cerezo') add(base.x, base.z, base.foot * EARTH[kind].spread, EARTH[kind].strength, 1);
      add(base.x, base.z, base.foot * SPREAD[kind], STRENGTH[kind]);
    }
  }
  for (const p of stationPebbles(index, portrait)) {
    if (p.anchor) add(p.x, p.z, p.radius * 1.7, 0.6);
  }
  for (const grove of layout.groves) {
    for (const culm of groveCulms(grove, densityScale)) add(culm.x, culm.z, 0.22 + culm.radius * 2.5, 0.55);
  }
  return shadows;
}
