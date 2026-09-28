'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { playFauna } from '@/audio/engine';
import type { Station } from '@/config/journey';
import { readCssSeconds, type ScenePalette } from '@/lib/css-vars';
import { mulberry32 } from '@/lib/procedural';
import { FireflyRig } from '@/scene/objects/fauna/FireflyRig';
import { ModelCreature } from '@/scene/objects/fauna/ModelCreature';
import { SkinnedCreature } from '@/scene/objects/fauna/SkinnedCreature';
import type { QualityProfile } from '@/scene/quality/tiers';
import { WIND } from '@/scene/systems/WindField';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { availableSpecies, modelUrl, speciesSpec } from './bestiary';
import type { FaunaAct } from './behaviors';
import { advanceCasting, newMemory, type CastingConfig } from './casting';

/**
 * El director de fauna: pone en escena lo que decide `casting.ts`.
 *
 * Funciona como un director de casting, no como un reproductor. No tiene una
 * lista de animaciones que va lanzando: tiene un elenco —las especies que
 * declara la estación en `journey.ts`— y un repertorio de conductas, y cada
 * tanto monta un acto combinando las dos cosas. La estación dice **qué
 * especies** viven ahí; nunca qué hacen.
 *
 * Este componente es sólo la parte que React necesita: el reloj, el estado y
 * las mallas. Las reglas —cadencia, aforo, variedad— viven aparte y en puro
 * TypeScript para poder comprobarlas.
 */

interface FaunaDirectorProps {
  station: Station;
  palette: ScenePalette;
  profile: QualityProfile;
}

export function FaunaDirector({ station, palette, profile }: FaunaDirectorProps) {
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const [acts, setActs] = useState<readonly FaunaAct[]>([]);

  const cast = useMemo(() => availableSpecies(station.ambient.fauna), [station]);

  const config = useMemo<CastingConfig>(
    () => ({
      minGap: readCssSeconds('--fauna-min-gap', 20),
      maxGap: readCssSeconds('--fauna-max-gap', 40),
      idleGap: readCssSeconds('--idle-before-fauna', 20),
      // Dos actos a la vez sólo donde hay presupuesto para ellos.
      maxActs: profile.tier === 'high' ? 2 : 1,
    }),
    [profile.tier],
  );

  const random = useRef(mulberry32(20260915));
  const memory = useRef(newMemory(0, random.current));

  // Los modelos del elenco se piden en cuanto se llega a la estación. Pesan
  // decenas de KB, pero si se pidieran al empezar el acto la garza aparecería a
  // mitad de su paseo, cuando ya terminara de descargar.
  useEffect(() => {
    for (const kind of cast) {
      const spec = speciesSpec(kind);
      if (spec?.model) useGLTF.preload(modelUrl(spec.model), false, true);
      if (spec?.flightModel) useGLTF.preload(modelUrl(spec.flightModel), false, true);
    }
  }, [cast]);

  // Al cambiar de estación no se hereda nada: el elenco es otro.
  useEffect(() => {
    setActs([]);
    memory.current = newMemory(WIND.time, random.current);
  }, [station, motionAllowed]);

  useFrame(() => {
    if (!motionAllowed) return;

    const now = WIND.time;
    const idleFor = (Date.now() - useKyotoStore.getState().lastScrollAt) / 1000;

    const result = advanceCasting({
      memory: memory.current,
      acts,
      now,
      idleFor,
      station,
      cast,
      config,
      random: random.current,
    });

    if (result.acts !== acts) setActs(result.acts);

    // La voz del animal entra por el mismo lado que él, y sólo si esta zona
    // tiene pájaros declarados: el paisaje sonoro también sale de `journey.ts`.
    if (result.spawned?.spec.sound && station.ambient.sounds.includes('pajaros')) {
      playFauna(result.spawned.spec.sound, result.spawned.direction * 0.6);
    }
  });

  if (!motionAllowed) return null;

  return (
    <>
      {acts.map((act) => (
        <ActView key={act.id} act={act} palette={palette} />
      ))}
    </>
  );
}

/**
 * Un acto en escena: tantos individuos como pida su conducta.
 *
 * Va dentro de `Suspense` porque los modelos se cargan de red. Mientras llegan
 * no se pinta nada — nunca un hueco, nunca un marcador de posición: un animal
 * que aún no ha llegado simplemente no ha entrado todavía en cuadro.
 */
function ActView({ act, palette }: { act: FaunaAct; palette: ScenePalette }) {
  const members = useMemo(
    () => Array.from({ length: act.members }, (_, index) => index),
    [act.members],
  );

  return (
    <Suspense fallback={null}>
      {members.map((member) => {
        const key = `${act.id}-${member}`;

        switch (act.spec.rig) {
          case 'modelo':
            return <ModelCreature key={key} act={act} member={member} palette={palette} />;
          case 'animado':
            return <SkinnedCreature key={key} act={act} member={member} palette={palette} />;
          case 'luz':
            return <FireflyRig key={key} act={act} member={member} palette={palette} />;
        }
      })}
    </Suspense>
  );
}
