'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  DoubleSide,
  type Group,
} from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { WIND } from '@/scene/systems/WindField';
import { createPose, poseFor, type FaunaAct, type FaunaPose } from '@/scene/systems/fauna/behaviors';
import type { SpeciesSpec } from '@/scene/systems/fauna/bestiary';

/**
 * Las piezas con las que se arman los tres rigs.
 *
 * Cuatro geometrías para todo el bestiario, compartidas entre todas las
 * instancias: una esfera, un cono, un cilindro y un ala. Cada parte del cuerpo
 * es una de ellas con otra escala, así que una ardilla y un gato no son dos
 * modelos sino dos juegos de proporciones. Eso es lo que hace barato añadir una
 * especie, y lo que permitía descartar Lottie: aquí el animal no reproduce nada,
 * se mueve.
 *
 * La convención de orientación es **el morro hacia +X**. La pose trae el giro en
 * Y ya calculado para eso (`heading`), de modo que ningún rig tiene que volver a
 * pensarlo.
 */

/** Esfera de radio 1/2: sirve de cuerpo, cabeza, grupa y abdomen. */
export const SPHERE = new SphereGeometry(0.5, 10, 8);

/** Cono de altura 1 apuntando a +Y: picos, hocicos, orejas y colas. */
export const CONE = new ConeGeometry(0.5, 1, 7);

/** Cilindro de altura 1: patas, cuellos y tarsos. */
export const CYLINDER = new CylinderGeometry(0.5, 0.5, 1, 6);

/**
 * Un ala: superficie plana que sale del hombro hacia +Z, con la cuerda en X.
 *
 * El perfil no es un rectángulo ni un triángulo: es ancho cerca del cuerpo y se
 * afila hacia la punta, y el borde de ataque va más adelantado que el de salida.
 * A tamaño de silueta, eso es toda la diferencia entre "ave" y "cometa".
 */
function buildWing(): BufferGeometry {
  const steps = 8;
  const positions: number[] = [];

  const chord = (u: number) => Math.sin(Math.PI * u ** 0.75) ** 0.6;
  const lead = (u: number) => chord(u) * 0.38;
  const trail = (u: number) => -chord(u) * 0.62;

  for (let i = 0; i < steps; i += 1) {
    const u0 = i / steps;
    const u1 = (i + 1) / steps;
    // Un poco de diedro: la punta sube. Sin él, el ala extendida se ve rígida.
    const y0 = u0 ** 2 * 0.1;
    const y1 = u1 ** 2 * 0.1;

    positions.push(lead(u0), y0, u0, lead(u1), y1, u1, trail(u1), y1, u1);
    positions.push(lead(u0), y0, u0, trail(u1), y1, u1, trail(u0), y0, u0);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export const WING = buildWing();

export interface FaunaMaterials {
  body: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  glow: MeshBasicMaterial;
  halo: MeshBasicMaterial;
}

/**
 * Los materiales de una especie: **uno por especie y para toda la sesión**, no
 * uno por individuo.
 *
 * La diferencia importa. Los actos van y vienen cada veinte segundos y una
 * bandada son nueve gorriones; crear los materiales dentro de cada criatura
 * significaría fabricar —y abandonar— miles de programas de GPU en una sesión
 * larga, porque un material sólo se libera si alguien lo libera. Una caché por
 * especie los crea una vez y los reutiliza para siempre: nueve gorriones
 * comparten pelaje, que es lo que hacen los gorriones.
 */
const materialCache = new Map<SpeciesSpec, { palette: ScenePalette; materials: FaunaMaterials }>();

export function useFaunaMaterials(spec: SpeciesSpec, palette: ScenePalette): FaunaMaterials {
  return useMemo(() => {
    const cached = materialCache.get(spec);
    if (cached && cached.palette === palette) return cached.materials;

    const body = new MeshStandardMaterial({
      color: palette[spec.body],
      flatShading: true,
      roughness: 0.85,
      // Las alas y las orejas se ven por las dos caras: son superficies, no
      // volúmenes, y un ala vista desde abajo no puede desaparecer.
      side: DoubleSide,
    });

    const accent = new MeshStandardMaterial({
      color: palette[spec.accent],
      flatShading: true,
      roughness: 0.8,
      side: DoubleSide,
    });

    const glow = new MeshBasicMaterial({
      color: palette[spec.body],
      transparent: true,
      opacity: 1,
      toneMapped: false,
    });

    // El halo de la luciérnaga es el mismo color con mucha menos presencia.
    const halo = glow.clone();
    halo.opacity = 0.12;

    const materials = { body, accent, glow, halo };
    materialCache.set(spec, { palette, materials });
    return materials;
  }, [spec, palette]);
}

/**
 * El puente entre la conducta y la malla.
 *
 * Calcula la pose del individuo en este frame, la aplica al grupo raíz y deja
 * que el rig retoque sus partes. Es **un solo `useFrame` por criatura**: si la
 * pose se calculara en el padre y las partes en el hijo, las partes irían un
 * frame por detrás del cuerpo, que es la clase de desfase que se nota sin saber
 * por qué.
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

/**
 * Fase de un ciclo que cambia de ritmo — el aleteo, la zancada.
 *
 * Se **integra**, nunca se calcula como `tiempo × frecuencia`: en cuanto la
 * frecuencia cambia, ese producto salta entero y el ala se teletransporta a
 * mitad del batido. Es el mismo problema que ya tuvieron los pétalos al caer
 * más rápido con la ráfaga.
 */
export interface Phase {
  /** Avanza la fase a la velocidad de ahora y devuelve el valor nuevo. */
  advance: (rate: number, delta: number) => number;
  /** El valor actual, para leerlo sin avanzarlo. */
  value: () => number;
}

export function usePhase(): Phase {
  const phase = useRef(0);

  return useMemo(
    () => ({
      advance: (rate: number, delta: number) => {
        phase.current = (phase.current + rate * delta) % (Math.PI * 2);
        return phase.current;
      },
      value: () => phase.current,
    }),
    [],
  );
}
