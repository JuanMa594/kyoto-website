'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { lerp } from '@/lib/procedural';
import type { FaunaAct } from '@/scene/systems/fauna/behaviors';

import { CYLINDER, SPHERE, WING, useFaunaFrame, useFaunaMaterials, usePhase } from './rigParts';

/**
 * Los bichos: mariposa, libélula y luciérnaga.
 *
 * Las dos primeras son cuerpo y alas; la tercera no tiene alas que se vean —a su
 * tamaño sería un píxel— y se resuelve como **un punto de luz con halo** que
 * late. Es la única criatura del bestiario que no se ve por su forma sino por su
 * brillo, y por eso es la única que usa un material que no depende de las luces
 * de la escena: una luciérnaga que se apagase con la niebla no sería una
 * luciérnaga.
 *
 * El aleteo va a una frecuencia fija y alta: un insecto no deja de batir aunque
 * se quede suspendido en el aire, así que aquí el esfuerzo no manda.
 */

interface InsectRigProps {
  act: FaunaAct;
  member: number;
  palette: ScenePalette;
}

export function InsectRig({ act, member, palette }: InsectRigProps) {
  const group = useRef<Group>(null);
  const tilt = useRef<Group>(null);
  const wingL = useRef<Group>(null);
  const wingR = useRef<Group>(null);
  const halo = useRef<Mesh>(null);
  const spark = useRef<Mesh>(null);

  const materials = useFaunaMaterials(act.spec, palette);
  const flapPhase = usePhase();

  // La luciérnaga se distingue por su conducta, no por su tamaño: es la única
  // que titila.
  const glowing = act.behavior === 'titilar';
  // Una libélula bate mucho más rápido que una mariposa.
  const flapHz = act.spec.size < 0.22 ? 9 : 5.5;

  /**
   * La luciérnaga es la única criatura que necesita material propio: su brillo
   * es distinto en cada individuo —de eso va el titileo— y los materiales
   * compartidos por especie no pueden tener dos opacidades a la vez. Son doce
   * como mucho, y se liberan al terminar el acto.
   */
  const own = useMemo(() => {
    if (!glowing) return null;
    return { spark: materials.glow.clone(), halo: materials.halo.clone() };
  }, [glowing, materials]);

  useEffect(() => {
    if (!own) return;
    return () => {
      own.spark.dispose();
      own.halo.dispose();
    };
  }, [own]);

  useFaunaFrame(act, member, group, (pose, delta, seconds) => {
    if (tilt.current) {
      tilt.current.rotation.z = pose.pitch * 0.8;
      tilt.current.rotation.x = pose.bank * 1.4;
    }

    if (glowing) {
      // El pulso viene de la conducta: cada individuo lleva su propio ritmo.
      const glow = pose.glow;
      if (spark.current) spark.current.scale.setScalar(lerp(0.5, 1.15, glow));
      if (halo.current) {
        halo.current.scale.setScalar(lerp(1.4, 3.4, glow));
        (halo.current.material as MeshBasicMaterial).opacity = 0.05 + glow * 0.22;
      }
      if (spark.current) {
        (spark.current.material as MeshBasicMaterial).opacity = 0.35 + glow * 0.65;
      }
      return;
    }

    const flap = flapPhase.advance(Math.PI * 2 * flapHz, delta);
    const beat = Math.sin(flap);
    if (wingL.current) wingL.current.rotation.x = beat * 1.05;
    if (wingR.current) wingR.current.rotation.x = -beat * 1.05;

    // Las alas empujan: el cuerpo sube y baja un poco con cada batido.
    if (tilt.current) tilt.current.position.y = Math.sin(seconds * flapHz * 0.6) * 0.03;
  });

  if (glowing) {
    return (
      <group ref={group}>
        <mesh ref={spark} geometry={SPHERE} material={own!.spark} scale={1} />
        <mesh ref={halo} geometry={SPHERE} material={own!.halo} scale={2} />
      </group>
    );
  }

  return (
    <group ref={group}>
      <group ref={tilt}>
        {/* Abdomen */}
        <mesh
          geometry={CYLINDER}
          material={materials.accent}
          rotation={[0, 0, Math.PI / 2]}
          scale={[0.1, 0.9, 0.1]}
        />
        {/* Tórax */}
        <mesh geometry={SPHERE} material={materials.body} position={[0.22, 0, 0]} scale={0.24} />

        {/* Alas */}
        <group ref={wingL} position={[0.16, 0.04, 0.05]}>
          <mesh geometry={WING} material={materials.body} scale={[0.85, 1, 0.75]} />
        </group>
        <group ref={wingR} position={[0.16, 0.04, -0.05]}>
          <mesh geometry={WING} material={materials.body} scale={[0.85, 1, -0.75]} />
        </group>
      </group>
    </group>
  );
}
