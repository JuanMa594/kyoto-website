'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';

import { isTraveling } from '@/animation/travel';
import { playFauna } from '@/audio/engine';
import type { FaunaKind, Station } from '@/config/journey';
import { readCssSeconds, type ScenePalette } from '@/lib/css-vars';
import { mulberry32 } from '@/lib/procedural';
import { FireflyRig } from '@/scene/objects/fauna/FireflyRig';
import { ModelCreature } from '@/scene/objects/fauna/ModelCreature';
import { SkinnedCreature } from '@/scene/objects/fauna/SkinnedCreature';
import { PATH } from '@/scene/path/journeyPath';
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

/**
 * Sólo en desarrollo: `?fauna=garza` deja en escena una única especie, sea cual
 * sea la estación, y acorta las esperas a unos segundos. Sirve para revisar un
 * animal sin esperar a que el sorteo lo saque. En el build de producción
 * `process.env.NODE_ENV` vale 'production' y esto no existe.
 */
function devFocus(): FaunaKind | null {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
  const wanted = new URLSearchParams(window.location.search).get('fauna');
  return wanted && speciesSpec(wanted as FaunaKind) ? (wanted as FaunaKind) : null;
}

export function FaunaDirector({ station, palette, profile }: FaunaDirectorProps) {
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const [acts, setActs] = useState<readonly FaunaAct[]>([]);

  const focus = useMemo(devFocus, []);
  const cast = useMemo(
    () => (focus ? [focus] : availableSpecies(station.ambient.fauna)),
    [station, focus],
  );

  const config = useMemo<CastingConfig>(
    () => ({
      minGap: focus ? 3 : readCssSeconds('--fauna-min-gap', 20),
      maxGap: focus ? 6 : readCssSeconds('--fauna-max-gap', 40),
      idleGap: readCssSeconds('--idle-before-fauna', 20),
      // Dos actos a la vez sólo donde hay presupuesto para ellos.
      maxActs: profile.tier === 'high' ? 2 : 1,
    }),
    [profile.tier, focus],
  );

  const random = useRef(mulberry32(20260915));
  const memory = useRef(newMemory(0, random.current));
  const stage = useRef<Group>(null);

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

  // Al apagar o encender el movimiento se empieza de cero. Al cambiar de zona
  // no: los actos vivos terminan su acto y la zona nueva sólo cuenta para el
  // siguiente reparto. Borrarlos de golpe se veía como un corte en mitad del
  // camino.
  useEffect(() => {
    setActs([]);
    memory.current = newMemory(WIND.time, random.current);
  }, [motionAllowed]);

  useFrame(() => {
    // En la Fase 3A la fauna viaja con el encuadre de la cámara (ver
    // `groundAt`). La Fase 3B la anclará al mundo.
    const node = stage.current;
    if (node) {
      const frame = PATH.frame;
      node.position.set(frame.x, frame.y, frame.z);
      node.rotation.set(0, frame.yaw, 0);
    }

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
      canSpawn: !isTraveling(),
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
    <group ref={stage}>
      {acts.map((act) => (
        <ActView key={act.id} act={act} palette={palette} />
      ))}
    </group>
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
