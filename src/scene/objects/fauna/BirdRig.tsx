'use client';

import { useRef } from 'react';
import type { Group, Mesh } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { clamp, lerp } from '@/lib/procedural';
import type { FaunaAct } from '@/scene/systems/fauna/behaviors';

import { CONE, CYLINDER, SPHERE, WING, useFaunaFrame, useFaunaMaterials, usePhase } from './rigParts';

/**
 * El cuerpo de las aves: garza, milano y gorrión con las mismas piezas.
 *
 * Lo que las distingue no es el modelo sino las proporciones y **el ritmo**: la
 * garza bate despacio y lleva las patas colgando al aterrizar, el milano ni las
 * mueve, el gorrión va a cuatro batidos por segundo. La frecuencia sale del
 * tamaño de la especie, así que una especie nueva no necesita ajustes a mano.
 *
 * Las aves pequeñas se montan en versión corta —sin cuello, sin patas, sin
 * pico—: a esa escala no se distinguen, y una bandada de nueve gorriones con el
 * cuerpo entero serían ochenta mallas para nada.
 *
 * Dos poses conviven y se mezclan con `pose.airborne`: la de vuelo (alas
 * extendidas, patas recogidas, cuello plegado) y la de suelo (alas cerradas,
 * patas dando zancadas, cuello erguido). Al posarse no hay cambio de clip: hay
 * una interpolación entre las dos.
 */

interface BirdRigProps {
  act: FaunaAct;
  member: number;
  palette: ScenePalette;
}

export function BirdRig({ act, member, palette }: BirdRigProps) {
  const group = useRef<Group>(null);
  const tilt = useRef<Group>(null);
  const wingL = useRef<Group>(null);
  const wingR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const neck = useRef<Group>(null);
  const body = useRef<Mesh>(null);

  const materials = useFaunaMaterials(act.spec, palette);
  const flapPhase = usePhase();
  const stepPhase = usePhase();

  // Por debajo de este tamaño el detalle no se ve y sólo cuesta mallas.
  const detailed = act.spec.size > 0.4;

  // Un ave grande bate despacio; una pequeña, deprisa.
  const flapHz = 1.2 + 0.9 / act.spec.size;

  useFaunaFrame(act, member, group, (pose, delta, seconds) => {
    const air = pose.airborne;

    if (tilt.current) {
      tilt.current.rotation.z = pose.pitch * 0.7;
      tilt.current.rotation.x = pose.bank;
      // Al caminar, el cuerpo sube y baja con el paso.
      tilt.current.position.y = (1 - air) * Math.sin(stepPhase.value() * 2) * 0.012;
    }

    // ── Alas ──────────────────────────────────────────────────────────────
    const flap = flapPhase.advance(Math.PI * 2 * flapHz * (0.35 + pose.effort), delta);
    const beat = Math.sin(flap) * (0.25 + pose.effort * 0.75);
    // En el aire: batido amplio. En el suelo: plegadas contra el cuerpo.
    const wingLift = lerp(-0.25, beat * 1.1, air);
    const wingSweep = lerp(-0.95, 0, air);
    const wingSpan = lerp(0.5, 1, air);

    for (const [wing, side] of [
      [wingL, 1],
      [wingR, -1],
    ] as const) {
      if (!wing.current) continue;
      wing.current.rotation.x = wingLift * side;
      wing.current.rotation.y = wingSweep * side;
      wing.current.scale.set(1, 1, wingSpan * side);
    }

    // ── Patas ─────────────────────────────────────────────────────────────
    // Volando van recogidas hacia atrás; en el suelo dan zancadas al ritmo real
    // de avance, que es lo que evita el patinaje de las animaciones en bucle.
    const stride = stepPhase.advance(Math.PI * 2 * clamp(pose.speed * 1.6, 0, 6), delta);
    if (legL.current && legR.current) {
      const tuck = lerp(0, -1.35, air);
      legL.current.rotation.z = tuck + (1 - air) * Math.sin(stride) * 0.5;
      legR.current.rotation.z = tuck + (1 - air) * Math.sin(stride + Math.PI) * 0.5;
    }

    // ── Cuello y cabeza ───────────────────────────────────────────────────
    if (neck.current) {
      // Picotear no es una conducta aparte: es lo que hace un ave parada en el
      // suelo. Si no avanza y no vuela, baja la cabeza cada par de segundos.
      const still = (1 - air) * (1 - clamp(pose.speed / 0.25, 0, 1));
      const peck = still * Math.max(0, Math.sin(seconds * 1.35 + member)) ** 3;
      neck.current.rotation.z = lerp(-0.55, lerp(0.35, -1.25, peck), 1 - air * 0.85);
      neck.current.scale.y = lerp(0.62, 1, 1 - air * 0.6);
    }

    if (body.current) {
      // El pecho se hincha un pelo en cada aletazo fuerte.
      const swell = 1 + air * pose.effort * Math.sin(flap) * 0.04;
      body.current.scale.set(1, 0.42 * swell, 0.4 * swell);
    }
  });

  return (
    <group ref={group}>
      <group ref={tilt}>
        {/* Cuerpo */}
        <mesh ref={body} geometry={SPHERE} material={materials.body} scale={[1, 0.42, 0.4]} />

        {/* Cola */}
        <mesh
          geometry={CONE}
          material={materials.body}
          position={[-0.52, 0.02, 0]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[0.3, 0.45, 0.06]}
        />

        {/* Alas */}
        <group ref={wingL} position={[0.04, 0.1, 0.1]}>
          <mesh geometry={WING} material={materials.body} scale={[0.55, 1, 0.95]} />
        </group>
        <group ref={wingR} position={[0.04, 0.1, -0.1]}>
          <mesh geometry={WING} material={materials.body} scale={[0.55, 1, 0.95]} />
        </group>

        {/* Cuello, cabeza y pico. Sólo en las aves grandes. */}
        <group ref={neck} position={[0.34, 0.12, 0]}>
          {detailed && (
            <mesh
              geometry={CYLINDER}
              material={materials.body}
              position={[0.08, 0.16, 0]}
              rotation={[0, 0, -0.35]}
              scale={[0.09, 0.42, 0.09]}
            />
          )}
          <mesh
            geometry={SPHERE}
            material={materials.body}
            position={detailed ? [0.22, 0.34, 0] : [0.12, 0.1, 0]}
            scale={detailed ? 0.2 : 0.3}
          />
          {detailed && (
            <mesh
              geometry={CONE}
              material={materials.accent}
              position={[0.42, 0.33, 0]}
              rotation={[0, 0, -1.45]}
              scale={[0.07, 0.3, 0.07]}
            />
          )}
        </group>

        {/* Patas */}
        {detailed && (
          <>
            <group ref={legL} position={[-0.05, -0.16, 0.09]}>
              <mesh
                geometry={CYLINDER}
                material={materials.accent}
                position={[0, -0.22, 0]}
                scale={[0.035, 0.45, 0.035]}
              />
            </group>
            <group ref={legR} position={[-0.05, -0.16, -0.09]}>
              <mesh
                geometry={CYLINDER}
                material={materials.accent}
                position={[0, -0.22, 0]}
                scale={[0.035, 0.45, 0.035]}
              />
            </group>
          </>
        )}
      </group>
    </group>
  );
}
