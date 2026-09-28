'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MeshBasicMaterial, type Group, type Mesh } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { lerp } from '@/lib/procedural';
import type { FaunaAct } from '@/scene/systems/fauna/behaviors';

import { SPHERE, useFaunaFrame } from './rigParts';

/**
 * La luciérnaga: **un punto de luz con halo** que late.
 *
 * Es la única criatura del bestiario que no usa modelo, y es a propósito. En
 * pantalla mide unos ocho píxeles: los ochenta mil triángulos del modelo que
 * había no se verían nunca. Lo que se ve de una luciérnaga es su brillo, así que
 * eso es lo que se dibuja.
 *
 * Es también la única que necesita material propio: cada individuo titila a su
 * ritmo —de eso va el enjambre— y un material compartido no puede tener dos
 * opacidades a la vez. Son doce como mucho, y se liberan al terminar el acto.
 */

interface FireflyRigProps {
  act: FaunaAct;
  member: number;
  palette: ScenePalette;
}

export function FireflyRig({ act, member, palette }: FireflyRigProps) {
  const group = useRef<Group>(null);
  const spark = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);

  const materials = useMemo(() => {
    const color = palette[act.spec.body];
    return {
      spark: new MeshBasicMaterial({ color, transparent: true, opacity: 1, toneMapped: false }),
      halo: new MeshBasicMaterial({ color, transparent: true, opacity: 0.12, toneMapped: false, depthWrite: false }),
    };
  }, [palette, act.spec.body]);

  useEffect(
    () => () => {
      materials.spark.dispose();
      materials.halo.dispose();
    },
    [materials],
  );

  useFaunaFrame(act, member, group, (pose) => {
    // El pulso viene de la conducta: cada individuo lleva su propio ritmo.
    const glow = pose.glow;
    spark.current?.scale.setScalar(lerp(0.5, 1.15, glow));
    halo.current?.scale.setScalar(lerp(1.4, 3.4, glow));
    materials.spark.opacity = 0.35 + glow * 0.65;
    materials.halo.opacity = 0.05 + glow * 0.22;
  });

  return (
    <group ref={group}>
      <mesh ref={spark} geometry={SPHERE} material={materials.spark} />
      <mesh ref={halo} geometry={SPHERE} material={materials.halo} scale={2} />
    </group>
  );
}
