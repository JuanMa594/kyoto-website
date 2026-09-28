'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, type RefObject } from 'react';
import { SphereGeometry, type Group } from 'three';

import { WIND } from '@/scene/systems/WindField';
import { createPose, poseFor, type FaunaAct, type FaunaPose } from '@/scene/systems/fauna/behaviors';

/**
 * Lo que comparten todos los cuerpos de la fauna.
 *
 * La convención de orientación es **el morro hacia +X**, que es como salen los
 * modelos de `bun run models`. La pose trae el giro en Y ya calculado para eso
 * (`heading`), de modo que ningún rig tiene que volver a pensarlo.
 */

/** Esfera de radio 1/2: el punto de luz de la luciérnaga y su halo. */
export const SPHERE = new SphereGeometry(0.5, 10, 8);

/**
 * El puente entre la conducta y la malla.
 *
 * Calcula la pose del individuo en este frame, la aplica al grupo raíz y deja
 * que el rig retoque su cuerpo. Es **un solo `useFrame` por criatura**: si la
 * pose se calculara en el padre y el cuerpo en el hijo, el cuerpo iría un frame
 * por detrás de su propia posición, que es la clase de desfase que se nota sin
 * saber por qué.
 *
 * El reloj es `WIND.time`, el mismo de la escena: sólo avanza cuando el canvas
 * dibuja, así que en modo 静 la fauna se queda quieta con todo lo demás.
 */
export function useFaunaFrame(
  act: FaunaAct,
  member: number,
  group: RefObject<Group | null>,
  apply: (pose: FaunaPose, delta: number, seconds: number) => void,
): FaunaPose {
  const pose = useMemo(createPose, []);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;

    const seconds = WIND.time - act.startedAt;
    poseFor(act, member, seconds, pose);

    node.position.set(pose.x, pose.y, pose.z);
    node.rotation.set(0, pose.heading, 0);
    node.scale.setScalar(act.spec.size * pose.scale);

    apply(pose, Math.min(delta, 0.1), seconds);
  });

  return pose;
}
