'use client';

import { useThree } from '@react-three/fiber';
import { lazy, Suspense, useMemo } from 'react';

import { JOURNEY, type Station } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import { Shrub } from '@/scene/objects/Shrub';
import { StoneLanterns } from '@/scene/objects/toro/StoneLanterns';
import { Torii } from '@/scene/objects/torii/Torii';
import { stationIndex } from '@/scene/path/journeyPath';
import type { QualityProfile } from '@/scene/quality/tiers';
import { BambooGrove } from '@/scene/systems/BambooGrove';
import { ContactShadows } from '@/scene/systems/ContactShadows';
import { MossPatches } from '@/scene/systems/MossPatches';

import { stationDecorLayout } from './placement';

/** La maqueta de Ubicación, en diferido: su dato pesa ~80 KB y sólo hace falta cerca de allí. */
const Maqueta = lazy(() => import('@/scene/objects/maqueta/MaquetaJapon'));

interface StationDecorProps {
  /** La estación de la **zona** (la de la cámara), no la de la ruta. */
  station: Station;
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * La decoración del camino (Fase 4): la de la zona en la que está la cámara y
 * la de sus dos vecinas. Lo demás se desmonta. Cada estación se monta con la
 * colocación de su aspecto: al girar el móvil, el cartel se recoloca entero.
 */
export function StationDecor({ station, palette, profile }: StationDecorProps) {
  const portrait = useThree((state) => state.size.width <= state.size.height);
  const index = stationIndex(station.slug);
  const nearby = [index - 1, index, index + 1].filter((i) => i >= 0 && i < JOURNEY.length);

  return (
    <>
      {nearby.map((i) => (
        <DecorSet
          key={`${i}-${portrait ? 'v' : 'h'}`}
          index={i}
          portrait={portrait}
          palette={palette}
          profile={profile}
        />
      ))}
    </>
  );
}

interface DecorSetProps {
  index: number;
  portrait: boolean;
  palette: ScenePalette;
  profile: QualityProfile;
}

function DecorSet({ index, portrait, palette, profile }: DecorSetProps) {
  const layout = useMemo(() => stationDecorLayout(index, portrait), [index, portrait]);
  const lanterns = useMemo(() => layout.objects.filter((o) => o.item.kind === 'farol'), [layout]);

  return (
    <>
      {layout.objects.map((placed, k) => {
        if (placed.item.kind === 'torii') return <Torii key={k} placed={placed} palette={palette} profile={profile} />;
        if (placed.item.kind === 'arbusto') return <Shrub key={k} placed={placed} palette={palette} profile={profile} />;
        if (placed.item.kind === 'maqueta') {
          return (
            <Suspense key={k} fallback={null}>
              <Maqueta placed={placed} palette={palette} profile={profile} />
            </Suspense>
          );
        }
        return null;
      })}
      {lanterns.length > 0 && <StoneLanterns lanterns={lanterns} palette={palette} profile={profile} />}
      {layout.groves.length > 0 && <BambooGrove groves={layout.groves} palette={palette} profile={profile} />}
      <ContactShadows index={index} portrait={portrait} palette={palette} profile={profile} />
      <MossPatches index={index} portrait={portrait} palette={palette} profile={profile} />
    </>
  );
}
