'use client';

import { useEffect, useMemo } from 'react';
import { Color, Euler, InstancedMesh, Matrix4, Quaternion, Vector3, type MeshStandardMaterial } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';
import type { PlacedObject } from '@/scene/decor/placement';
import type { QualityProfile } from '@/scene/quality/tiers';

import type { LanternVariant } from './toro';
import { lanternGeometry } from './toroGeometry';

interface StoneLanternsProps {
  /** Los faroles colocados de una estación, de cualquier variante. */
  lanterns: readonly PlacedObject[];
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * Cuánto brillan de día las ventanas de papel: un tibio kohaku, lo justo para
 * que se lean como papel con luz detrás y no como piedra pintada. El modo
 * noche (pendiente, ver docs/PLAN.md) las subirá y sumará la luz al camino.
 */
const DAY_GLOW = 0.22;

/** Cuánto se entierra el pie: en una cuesta, que no quede un hueco debajo. */
const SINK = 0.03;

/**
 * Los faroles de piedra de una estación: por variante, un InstancedMesh de
 * piedra y otro de papel. Con el kasuga y el yukimi, cuatro draw calls para
 * todos. No se mueven con el viento.
 */
export function StoneLanterns({ lanterns, palette, profile }: StoneLanternsProps) {
  const materials = useMemo(() => {
    const common = { washi: palette.washi, ink: palette.sumi };
    const stone = withMoss(
      createDecorMaterial({ ...common, key: 'farol-piedra', color: palette.ishiDeep, roughness: 0.95, vertexColors: true }),
      palette.kokeMid,
    );
    const paper = createDecorMaterial({ ...common, key: 'farol-papel', color: palette.washi, roughness: 0.9, rim: 0 });
    paper.emissive = new Color(palette.kohaku);
    paper.emissiveIntensity = DAY_GLOW;
    return { stone, paper };
  }, [palette]);

  const meshes = useMemo(() => {
    const byVariant = new Map<LanternVariant, PlacedObject[]>();
    for (const placed of lanterns) {
      if (placed.item.kind !== 'farol') continue;
      const list = byVariant.get(placed.item.variant) ?? [];
      list.push(placed);
      byVariant.set(placed.item.variant, list);
    }

    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const euler = new Euler();
    const out: InstancedMesh[] = [];
    for (const [variant, list] of byVariant) {
      const parts = lanternGeometry(variant);
      const stone = new InstancedMesh(parts.stone, materials.stone, list.length);
      const paper = new InstancedMesh(parts.paper, materials.paper, list.length);
      list.forEach((placed, i) => {
        rotation.setFromEuler(euler.set(0, placed.yaw, 0));
        matrix.compose(
          new Vector3(placed.x, placed.y - SINK, placed.z),
          rotation,
          new Vector3(placed.scale, placed.scale, placed.scale),
        );
        stone.setMatrixAt(i, matrix);
        paper.setMatrixAt(i, matrix);
      });
      for (const mesh of [stone, paper]) {
        mesh.computeBoundingSphere();
        mesh.receiveShadow = profile.shadows;
      }
      stone.castShadow = profile.shadows;
      out.push(stone, paper);
    }
    return out;
  }, [lanterns, materials, profile.shadows]);

  // La geometría es compartida y no se libera; los materiales, sí.
  useEffect(() => () => meshes.forEach((mesh) => mesh.dispose()), [meshes]);
  useEffect(
    () => () => {
      materials.stone.dispose();
      materials.paper.dispose();
    },
    [materials],
  );

  return (
    <>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </>
  );
}

/** El musgo de la piedra: `aMoss` (por vértice) mezcla el color hacia el koke. */
function withMoss(material: MeshStandardMaterial, moss: string): MeshStandardMaterial {
  const base = material.onBeforeCompile;
  const uMoss = { value: new Color(moss) };
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    shader.uniforms.uMoss = uMoss;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMoss;\nvarying float vMoss;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMoss = aMoss;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uMoss;\nvarying float vMoss;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uMoss, vMoss);');
  };
  return material;
}
