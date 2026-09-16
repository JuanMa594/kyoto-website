'use client';

import { useRef } from 'react';
import type { Group, Material } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { clamp, damp } from '@/lib/procedural';
import type { FaunaAct } from '@/scene/systems/fauna/behaviors';

import { CONE, CYLINDER, SPHERE, useFaunaFrame, useFaunaMaterials, usePhase } from './rigParts';

/**
 * El cuerpo de los cuadrúpedos: ardilla, gato y tanuki.
 *
 * Lo que de verdad vende a estos animales no es el cuerpo, que a esta escala es
 * una cápsula con cuatro patas: **es la cola**. Va montada como una cadena de
 * segmentos donde cada uno persigue al anterior con retardo, así que al girar
 * se curva sola y al frenar sigue viniendo. Ese latigazo es lo que separa una
 * ardilla de un roedor de juguete, y es exactamente lo que un clip no puede dar
 * porque depende de por dónde vaya el animal en ese momento.
 *
 * La otra mitad es la **zancada atada a la velocidad real**: las patas se mueven
 * al ritmo al que el animal avanza de verdad, nunca a un ritmo fijo. Así, cuando
 * la ardilla se para —y su conducta la para de golpe cada pocos pasos— las patas
 * se quedan quietas en vez de seguir patinando.
 */

interface QuadrupedRigProps {
  act: FaunaAct;
  member: number;
  palette: ScenePalette;
}

/** Cuántos trozos tiene la cola. Cuatro bastan para que se lea la curva. */
const TAIL_SEGMENTS = 4;

export function QuadrupedRig({ act, member, palette }: QuadrupedRigProps) {
  const group = useRef<Group>(null);
  const tilt = useRef<Group>(null);
  const head = useRef<Group>(null);
  const legs = useRef<(Group | null)[]>([]);
  const tail = useRef<(Group | null)[]>([]);

  const materials = useFaunaMaterials(act.spec, palette);
  const stepPhase = usePhase();

  const { sitsUp = false } = act.spec;

  useFaunaFrame(act, member, group, (pose, delta, seconds) => {
    // Quieto del todo o corriendo: de eso dependen la postura y el paso.
    const moving = clamp(pose.speed / 1.2, 0, 1);
    const still = 1 - clamp(pose.speed / 0.25, 0, 1);

    if (tilt.current) {
      // La ardilla se yergue cuando para: se sienta sobre los cuartos traseros
      // y levanta el morro. El gato simplemente se queda de pie.
      const rear = sitsUp ? still * 0.55 : 0;
      tilt.current.rotation.z = pose.pitch * 0.5 + rear;
      tilt.current.rotation.x = pose.bank * 0.6;
      tilt.current.position.y = rear * 0.12 + Math.abs(Math.sin(stepPhase.value())) * 0.02 * moving;
    }

    if (head.current) {
      // Olfatea mientras está parada; mira al frente cuando corre.
      head.current.rotation.z = still * (0.25 + Math.sin(seconds * 3.1 + member) * 0.22) - moving * 0.1;
      head.current.rotation.y = still * Math.sin(seconds * 1.7 + member * 2) * 0.35;
    }

    // ── Patas: trote diagonal al ritmo real de avance ─────────────────────
    const stride = stepPhase.advance(Math.PI * 2 * clamp(pose.speed * 2.2, 0, 9), delta);
    for (let i = 0; i < 4; i += 1) {
      const leg = legs.current[i];
      if (!leg) continue;
      // Delanteras 0 y 1, traseras 2 y 3; en diagonal van en fase.
      const diagonal = i === 0 || i === 3 ? 0 : Math.PI;
      const lift = sitsUp && i < 2 ? still * 0.9 : 0;
      leg.rotation.z = Math.sin(stride + diagonal) * 0.55 * moving + lift;
    }

    // ── Cola: cada segmento persigue al de delante ────────────────────────
    let leader =
      -pose.bank * 1.3 +
      Math.sin(seconds * 3 + member) * 0.12 +
      Math.sin(stride) * 0.1 * moving;

    for (const segment of tail.current) {
      if (!segment) continue;
      segment.rotation.y = damp(segment.rotation.y, leader, 9, delta);
      // El siguiente no persigue el objetivo, persigue a éste: de ahí el
      // retardo acumulado que dibuja la curva.
      leader = segment.rotation.y;
    }
  });

  const tailCurl = sitsUp ? 0.42 : 0.12;

  return (
    <group ref={group}>
      <group ref={tilt}>
        {/* Cuerpo */}
        <mesh geometry={SPHERE} material={materials.body} scale={[1, 0.46, 0.44]} />

        {/* Cabeza, hocico y orejas */}
        <group ref={head} position={[0.44, 0.16, 0]}>
          <mesh geometry={SPHERE} material={materials.body} scale={0.34} />
          <mesh
            geometry={CONE}
            material={materials.body}
            position={[0.16, -0.03, 0]}
            rotation={[0, 0, -1.45]}
            scale={[0.16, 0.22, 0.16]}
          />
          <mesh
            geometry={CONE}
            material={materials.accent}
            position={[-0.04, 0.16, 0.1]}
            scale={[0.1, 0.18, 0.1]}
          />
          <mesh
            geometry={CONE}
            material={materials.accent}
            position={[-0.04, 0.16, -0.1]}
            scale={[0.1, 0.18, 0.1]}
          />
        </group>

        {/* Patas: delanteras y traseras */}
        {[
          [0.26, 0.15],
          [0.26, -0.15],
          [-0.26, 0.15],
          [-0.26, -0.15],
        ].map(([x, z], i) => (
          <group
            key={i}
            ref={(node) => {
              legs.current[i] = node;
            }}
            position={[x!, -0.12, z!]}
          >
            <mesh
              geometry={CYLINDER}
              material={materials.body}
              position={[0, -0.13, 0]}
              scale={[0.09, 0.28, 0.09]}
            />
          </group>
        ))}

        {/* Cola: segmentos anidados, cada uno colgando del anterior */}
        <TailChain
          index={0}
          curl={tailCurl}
          material={materials.accent}
          refs={tail}
          fat={sitsUp}
        />
      </group>
    </group>
  );
}

/**
 * La cola, recursiva: cada segmento contiene al siguiente, así que las
 * rotaciones se acumulan y basta con retocar la de cada uno para que la curva
 * entera cambie de forma.
 */
function TailChain({
  index,
  curl,
  material,
  refs,
  fat,
}: {
  index: number;
  curl: number;
  material: Material;
  refs: { current: (Group | null)[] };
  fat: boolean;
}) {
  if (index >= TAIL_SEGMENTS) return null;

  const taper = 1 - index * 0.16;
  const thickness = (fat ? 0.2 : 0.1) * taper;

  return (
    <group
      ref={(node) => {
        refs.current[index] = node;
      }}
      position={index === 0 ? [-0.46, 0.1, 0] : [-0.17, 0.05, 0]}
      rotation={[0, 0, curl]}
    >
      <mesh
        geometry={SPHERE}
        material={material}
        position={[-0.08, 0, 0]}
        scale={[0.2, thickness, thickness]}
      />
      <TailChain index={index + 1} curl={curl} material={material} refs={refs} fat={fat} />
    </group>
  );
}
