'use client';

import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  LatheGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';
import { animate, createAnimMemory } from '@/scene/objects/fauna/animate';
import { applyDeformPose, createDeformMaterial, createDeformPose } from '@/scene/objects/fauna/deform';
import { PEDESTAL, STATUE_SIZE } from '@/scene/objects/romon/romon';
import type { QualityProfile } from '@/scene/quality/tiers';
import { createPose } from '@/scene/systems/fauna/behaviors';
import { modelUrl, speciesSpec } from '@/scene/systems/fauna/bestiary';

interface KitsuneStatueProps {
  /** En las coordenadas del rōmon. */
  x: number;
  z: number;
  /** Giro sobre el frente del rōmon: las dos miran hacia delante, un poco hacia dentro. */
  yaw: number;
  /** Lo que lleva en la boca: la llave del granero de arroz o la joya. */
  holding: 'llave' | 'tama';
  palette: ScenePalette;
  profile: QualityProfile;
}

function firstGeometry(scene: Group): BufferGeometry | null {
  let geometry: BufferGeometry | null = null;
  scene.traverse((object) => {
    if (!geometry && (object as Mesh).isMesh) geometry = (object as Mesh).geometry;
  });
  return geometry;
}

/**
 * Un zorro de piedra de la escalinata del rōmon (Fase 6A): el **mismo modelo**
 * que el kitsune vivo, sentado con la postura de la deformación de la fauna
 * (la del gato, calibrada para el zorro) y pintado de granito, sobre su
 * pedestal. Lleva el babero rojo (*yodarekake*) que le ponen los fieles y, en
 * la boca, la llave del granero o la joya (*tama*).
 *
 * No se anima: la pose se calcula una vez, como si llevara un rato sentado.
 */
export function KitsuneStatue({ x, z, yaw, holding, palette, profile }: KitsuneStatueProps) {
  const spec = speciesSpec('kitsune')!;
  const deform = spec.deform!;
  const gltf = useGLTF(modelUrl('kitsune'), false, true);
  const geometry = useMemo(() => firstGeometry(gltf.scene), [gltf]);

  // La piedra: el cuerpo pintado de granito (sin el color horneado del zorro).
  const { material, body } = useMemo(() => {
    const granite = new Color(palette.ishiDeep).lerp(new Color(palette.sumiFaint), 0.25).getStyle();
    const made = createDeformMaterial(deform, { washi: palette.washi, ink: palette.sumi, paint: { body: granite, wing: granite } });
    made.material.transparent = false;
    withGranite(made.material, palette.kokeDeep);
    // Sentado, como si llevara un rato: la misma cuenta que el animal vivo.
    const pose = createPose();
    pose.heading = 0;
    pose.sitting = 1;
    pose.airborne = 0;
    const memory = createAnimMemory();
    const deformPose = createDeformPose();
    let bodyPose = animate(spec, pose, 3, 0.1, 0, memory, deformPose, 0);
    for (let k = 0; k < 40; k += 1) bodyPose = animate(spec, pose, 3, 0.1, 0, memory, deformPose, 0);
    applyDeformPose(made.uniforms, deformPose, deform);
    return { material: made.material, body: bodyPose };
  }, [deform, palette, spec]);

  const extras = useMemo(() => {
    const common = { washi: palette.washi, ink: palette.sumi };
    return {
      stone: createDecorMaterial({ ...common, key: 'pedestal', color: palette.ishiDeep, roughness: 0.95, rim: 0.25 }),
      bib: createDecorMaterial({ ...common, key: 'babero', color: palette.shu, roughness: 0.85, rim: 0.2, doubleSide: true }),
      gold: createDecorMaterial({ ...common, key: 'llave', color: palette.kohaku, roughness: 0.5, rim: 0.15 }),
    };
  }, [palette]);

  const shapes = useMemo(() => {
    // El pedestal: zócalo, cuerpo y tapa.
    const plinth = new BoxGeometry(PEDESTAL.half * 2, 0.25, PEDESTAL.depth * 2);
    plinth.translate(0, 0.125, 0);
    const core = new BoxGeometry(PEDESTAL.half * 1.6, PEDESTAL.height - 0.4, PEDESTAL.depth * 1.6);
    core.translate(0, 0.25 + (PEDESTAL.height - 0.4) / 2, 0);
    const cap = new BoxGeometry(PEDESTAL.half * 1.85, 0.15, PEDESTAL.depth * 1.85);
    cap.translate(0, PEDESTAL.height - 0.075, 0);
    const pedestal = mergeGeometries([plinth, core, cap])!;
    for (const part of [plinth, core, cap]) part.dispose();

    // El babero: un collar abierto hacia abajo, en el cuello (coordenadas del modelo).
    const bib = new CylinderGeometry(0.075, 0.15, 0.15, 18, 1, true);
    bib.rotateZ(-(Math.PI / 2 - Math.atan2(0.6, 0.8)));
    bib.translate(0.27, 0.4, 0);

    // En la boca: la llave (una barra y su anilla) o la joya (una gota en llama).
    let held: BufferGeometry;
    if (holding === 'llave') {
      const bar = new CylinderGeometry(0.012, 0.012, 0.2, 8, 1, false);
      bar.rotateX(Math.PI / 2);
      const ring = new TorusGeometry(0.03, 0.008, 6, 14);
      ring.translate(0, 0, 0.11);
      held = mergeGeometries([bar.toNonIndexed(), ring.toNonIndexed()])!;
      bar.dispose();
      ring.dispose();
    } else {
      const points = [0, 0.2, 0.45, 0.7, 0.88, 1].map((t) => new Vector2(0.045 * Math.sin(Math.PI * t) ** 0.8 * (1 - 0.35 * t), 0.11 * t - 0.04));
      held = new LatheGeometry(points, 14);
    }
    held.translate(0.47, 0.38, 0);
    return { pedestal, bib, held };
  }, [holding]);

  useEffect(
    () => () => {
      material.dispose();
      for (const extra of Object.values(extras)) extra.dispose();
    },
    [material, extras],
  );
  useEffect(
    () => () => {
      for (const shape of Object.values(shapes)) shape.dispose();
    },
    [shapes],
  );

  if (!geometry) return null;

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh geometry={shapes.pedestal} material={extras.stone} castShadow={profile.shadows} receiveShadow={profile.shadows} />
      {/* El zorro mira a +x en su modelo: se gira para que mire al frente del rōmon. */}
      <group position={[0, PEDESTAL.height, 0]} rotation={[0, -Math.PI / 2, 0]} scale={STATUE_SIZE}>
        <group position={[0, deform.pivotY, 0]}>
          <group rotation={[body.bank, 0, body.pitch]} position={[0, body.lift, 0]}>
            <group position={[0, -deform.pivotY, 0]}>
              <mesh geometry={geometry} material={material} castShadow={profile.shadows} receiveShadow={profile.shadows} />
              <mesh geometry={shapes.bib} material={extras.bib} />
              <mesh geometry={shapes.held} material={extras.gold} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

/** El granito: un moteado fino y, en lo bajo, el verde del musgo. */
function withGranite(material: MeshStandardMaterial, moss: string): MeshStandardMaterial {
  const base = material.onBeforeCompile;
  const mossColor = { value: new Color(moss) };
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    shader.uniforms.uMossColor = mossColor;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStonePos;')
      .replace('vec3 transformed = faunaPosition;', 'vec3 transformed = faunaPosition;\nvStonePos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uMossColor;\nvarying vec3 vStonePos;\nfloat graniteHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }')
      // Después de pintarlo de piedra (la pintura de la deformación) y antes del tinte washi.
      .replace(
        'diffuseColor.rgb = mix(diffuseColor.rgb, uWashi, 0.05);',
        `// Moteado del granito, y el musgo que sube desde los pies.
float grain = graniteHash(floor(vStonePos * 140.0));
diffuseColor.rgb *= 0.86 + 0.22 * grain;
float stoneMoss = (1.0 - smoothstep(0.02, 0.12, vStonePos.y)) * (0.55 + 0.45 * graniteHash(floor(vStonePos * 30.0)));
diffuseColor.rgb = mix(diffuseColor.rgb, uMossColor, stoneMoss * 0.6);
diffuseColor.rgb = mix(diffuseColor.rgb, uWashi, 0.05);`,
      );
  };
  const previousKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${previousKey?.() ?? ''}-granito`;
  return material;
}
