'use client';

import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import type { BufferGeometry, Group, Mesh } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { WIND } from '@/scene/systems/WindField';
import type { FaunaAct } from '@/scene/systems/fauna/behaviors';
import { modelUrl } from '@/scene/systems/fauna/bestiary';

import { animate, createAnimMemory } from './animate';
import { applyDeformPose, createDeformMaterial, createDeformPose } from './deform';
import { useFaunaFrame } from './rigParts';

/**
 * Un animal de verdad —un modelo .glb— animado sin esqueleto.
 *
 * El modelo llega de `bun run models` ya preparado: una sola malla, con el color
 * de su textura horneado en los vértices, el morro hacia +X, los pies en y = 0
 * y largo 1. Aquí sólo hay que ponerlo en su sitio y doblarlo: la conducta dice
 * dónde está y a qué velocidad va, `animate()` lo traduce en ángulos de pata,
 * cola y cuello, y el shader de `deform.ts` los aplica.
 *
 * La jerarquía tiene tres niveles a propósito: el grupo exterior lleva la
 * posición, el rumbo y la escala; el intermedio sube al centro del cuerpo; el
 * interior aplica cabeceo y alabeo. Así el animal se inclina alrededor de su
 * pecho y no alrededor de los pies, que es lo que haría un giro aplicado sin
 * más.
 */

interface ModelCreatureProps {
  act: FaunaAct;
  member: number;
  palette: ScenePalette;
}

function firstGeometry(scene: Group): BufferGeometry | null {
  let geometry: BufferGeometry | null = null;
  scene.traverse((object) => {
    if (!geometry && (object as Mesh).isMesh) geometry = (object as Mesh).geometry;
  });
  return geometry;
}

export function ModelCreature({ act, member, palette }: ModelCreatureProps) {
  const spec = act.spec;
  const profile = spec.deform!;

  const ground = useGLTF(modelUrl(spec.model!), false, true);
  // Hueco para un modelo en vuelo (hoy, ninguna especie lo usa). `useGLTF` no
  // se puede llamar condicionalmente, así que sin modelo propio se reutiliza el
  // mismo: la caché de drei devuelve el ya cargado.
  const flight = useGLTF(modelUrl(spec.flightModel ?? spec.model!), false, true);

  const groundGeometry = useMemo(() => firstGeometry(ground.scene), [ground]);
  const flightGeometry = useMemo(() => firstGeometry(flight.scene), [flight]);

  // Un material por individuo —cada uno lleva su propia zancada—, todos con el
  // mismo programa de GPU. Se libera al terminar el acto.
  const { material, uniforms } = useMemo(
    () =>
      createDeformMaterial(profile, {
        washi: palette.washi,
        ink: palette.sumi,
        // Los modelos que llegan en blanco se pintan desde la paleta.
        paint: spec.translucentWings
          ? { body: palette[spec.body], wing: palette[spec.accent] }
          : undefined,
      }),
    [profile, palette, spec],
  );
  useEffect(() => () => material.dispose(), [material]);

  const group = useRef<Group>(null);
  const tilt = useRef<Group>(null);
  const groundMesh = useRef<Mesh>(null);
  const flightMesh = useRef<Mesh>(null);
  const memory = useMemo(createAnimMemory, []);
  const deformPose = useMemo(createDeformPose, []);

  useFaunaFrame(act, member, group, (pose, delta, seconds) => {
    const body = animate(spec, pose, seconds, delta, member, memory, deformPose, WIND.gust);
    applyDeformPose(uniforms, deformPose, profile);

    if (tilt.current) {
      tilt.current.rotation.z = body.pitch;
      tilt.current.rotation.x = body.bank;
      // El brinco del galope o del saltito —o lo que sube el viento—, en
      // largos de cuerpo.
      tilt.current.position.y = body.lift;
    }

    if (spec.flightModel && groundMesh.current && flightMesh.current) {
      const flying = pose.airborne > 0.5;
      groundMesh.current.visible = !flying;
      flightMesh.current.visible = flying;
    }
  });

  if (!groundGeometry) return null;

  return (
    <group ref={group}>
      <group position={[0, profile.pivotY, 0]}>
        <group ref={tilt}>
          <group position={[0, -profile.pivotY, 0]}>
            <mesh ref={groundMesh} geometry={groundGeometry} material={material} castShadow />
            {spec.flightModel && flightGeometry && (
              <mesh
                ref={flightMesh}
                geometry={flightGeometry}
                material={material}
                visible={false}
                castShadow
              />
            )}
          </group>
        </group>
      </group>
    </group>
  );
}
