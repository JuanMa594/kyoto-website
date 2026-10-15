'use client';

import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import {
  AnimationMixer,
  DoubleSide,
  type Group,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

import type { ScenePalette } from '@/lib/css-vars';
import type { FaunaAct } from '@/scene/systems/fauna/behaviors';
import { modelUrl } from '@/scene/systems/fauna/bestiary';

import { useFaunaFrame } from './rigParts';

/**
 * Modelos con esqueleto y **su propio vuelo animado** (hoy, la mariposa).
 *
 * Aquí no hace falta deformar nada: el clip del modelo ya bate las alas. Lo
 * único que se ata a la conducta es el **ritmo** —el clip corre más deprisa
 * cuanto más se esfuerza el insecto—, y la posición y el rumbo, que llegan del
 * mismo `useFaunaFrame` que usa el resto de la fauna.
 *
 * Cada individuo necesita su propio esqueleto (dos mariposas no pueden batir
 * las alas con los mismos huesos), así que la escena se clona con
 * `SkeletonUtils`, que sí duplica los huesos. Los materiales, en cambio, se
 * comparten: nadie los modifica por individuo.
 */

interface SkinnedCreatureProps {
  act: FaunaAct;
  member: number;
  palette: ScenePalette;
}

export function SkinnedCreature({ act, member, palette }: SkinnedCreatureProps) {
  const spec = act.spec;
  const gltf = useGLTF(modelUrl(spec.model!), false, true);

  const scene = useMemo(() => {
    const copy = cloneSkinned(gltf.scene) as Object3D;

    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      // Las alas se ven por las dos caras; un ala vista desde abajo no puede
      // desaparecer.
      (mesh.material as Material).side = DoubleSide;
      // Un esqueleto que se mueve no cabe en la caja de reposo: sin esto, three
      // lo descartaría al salir de ella aunque siga en cuadro.
      mesh.frustumCulled = false;
    });

    return copy;
  }, [gltf]);

  const mixer = useMemo(() => new AnimationMixer(scene), [scene]);

  useEffect(() => {
    const clip = gltf.animations[0];
    if (!clip) return;
    const action = mixer.clipAction(clip);
    // Cada individuo empieza el ciclo en un punto distinto: dos mariposas
    // batiendo al unísono se leen como una sola duplicada.
    action.time = (member * 0.37 * clip.duration) % clip.duration;
    action.play();
    return () => {
      action.stop();
      mixer.uncacheRoot(scene);
    };
  }, [gltf, mixer, scene, member]);

  const group = useRef<Group>(null);

  useFaunaFrame(act, member, group, (pose, delta) => {
    // Batir más deprisa cuanto más empuja: suspendida, la mariposa bate lento.
    mixer.timeScale = 0.7 + pose.effort * 0.9;
    mixer.update(delta);
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}
