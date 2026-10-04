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
import { VIEW } from '@/scene/camera/framing';
import { FireflyRig } from '@/scene/objects/fauna/FireflyRig';
import { ModelCreature } from '@/scene/objects/fauna/ModelCreature';
import { SkinnedCreature } from '@/scene/objects/fauna/SkinnedCreature';
import { PATH } from '@/scene/path/journeyPath';
import type { QualityProfile } from '@/scene/quality/tiers';
import { WIND } from '@/scene/systems/WindField';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { createTrack, createViewer, trackAct, updateViewer, type ActTrack } from './anchoring';
import { availableSpecies, modelUrl, speciesSpec } from './bestiary';
import type { FaunaAct } from './behaviors';
import { advanceCasting, describeAct, FAUNA_STAGE, newMemory, type CastingConfig } from './casting';

/**
 * El director de fauna: pone en escena lo que decide `casting.ts`.
 *
 * Funciona como un director de casting, no como un reproductor. No tiene una
 * lista de animaciones que va lanzando: tiene un elenco —las especies que
 * declara la estación en `journey.ts`— y un repertorio de conductas, y cada
 * tanto monta un acto combinando las dos cosas. La estación dice **qué
 * especies** viven ahí; nunca qué hacen.
 *
 * Desde la Fase 3B cada acto vive **en el mundo**, en su ancla, y el director
 * lo sigue cada frame con la cámara real (`anchoring.ts`): desliza el ancla de
 * lo que vuela, sabe si algo está en cuadro y no retira nunca un acto a la
 * vista.
 *
 * Este componente es sólo la parte que React necesita: el reloj, el estado y
 * las mallas. Las reglas —cadencia, aforo, variedad, dónde nace, cuándo se
 * retira— viven aparte y en puro TypeScript para poder comprobarlas.
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
  const tracks = useRef(new Map<number, ActTrack>());
  const viewer = useMemo(createViewer, []);

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
    tracks.current.clear();
    FAUNA_STAGE.live = [];
    memory.current = newMemory(WIND.time, random.current);
  }, [motionAllowed]);

  // Prioridad −0,5: después de CameraRig (−1), que mueve la cámara y escribe
  // PATH, y antes que los cuerpos (0), que leen el ancla de este mismo frame.
  // (Una prioridad positiva le quitaría a R3F el render automático.)
  useFrame((state, delta) => {
    if (!motionAllowed) return;

    const now = WIND.time;
    state.camera.updateMatrixWorld();
    // La niebla que se dibuja (con el factor del tier): lo que queda más allá
    // no se ve, aunque esté en cuadro.
    const fog = state.scene.fog;
    updateViewer(viewer, state.camera, fog && 'far' in fog ? fog.far : Number.POSITIVE_INFINITY);

    for (const act of acts) {
      let track = tracks.current.get(act.id);
      if (!track) {
        track = createTrack();
        tracks.current.set(act.id, track);
      }
      trackAct(act, track, now, PATH.d, Math.min(delta, 0.1), viewer);
    }

    const idleFor = (Date.now() - useKyotoStore.getState().lastScrollAt) / 1000;
    const result = advanceCasting({
      memory: memory.current,
      acts,
      now,
      idleFor,
      cast,
      config,
      random: random.current,
      camera: {
        d: PATH.d,
        velocity: PATH.velocity,
        frame: PATH.frame,
        aspect: VIEW.aspect,
        traveling: isTraveling(),
      },
      tracks: tracks.current,
    });

    if (result.acts !== acts) {
      const alive = new Set(result.acts.map((act) => act.id));
      for (const id of tracks.current.keys()) {
        if (!alive.has(id)) tracks.current.delete(id);
      }
      setActs(result.acts);
    }
    FAUNA_STAGE.live = result.acts.map((act) => describeAct(act, tracks.current.get(act.id)));

    // La voz del animal entra por el mismo lado que él, y sólo si esta zona
    // tiene pájaros declarados: el paisaje sonoro también sale de `journey.ts`.
    if (result.spawned?.spec.sound && station.ambient.sounds.includes('pajaros')) {
      playFauna(result.spawned.spec.sound, result.spawned.direction * 0.6);
    }
  }, -0.5);

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
 * Un acto en escena: tantos individuos como pida su conducta, en el grupo de su
 * ancla. Lo anclado no se mueve; lo que vuela sigue a `act.anchor`, que el
 * director ha deslizado en este mismo frame.
 *
 * Va dentro de `Suspense` porque los modelos se cargan de red. Mientras llegan
 * no se pinta nada — nunca un hueco, nunca un marcador de posición: un animal
 * que aún no ha llegado simplemente no ha entrado todavía en cuadro.
 */
function ActView({ act, palette }: { act: FaunaAct; palette: ScenePalette }) {
  const place = useRef<Group>(null);
  const members = useMemo(
    () => Array.from({ length: act.members }, (_, index) => index),
    [act.members],
  );

  useFrame(() => {
    const node = place.current;
    if (!node) return;
    const anchor = act.anchor;
    node.position.set(anchor.x, anchor.y, anchor.z);
    node.rotation.set(0, anchor.yaw, 0);
  });

  const { anchor } = act;
  return (
    <group ref={place} position={[anchor.x, anchor.y, anchor.z]} rotation={[0, anchor.yaw, 0]}>
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
    </group>
  );
}
