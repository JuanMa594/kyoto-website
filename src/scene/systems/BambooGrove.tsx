'use client';

import { useEffect, useMemo } from 'react';
import { Color, Euler, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { bambooLeafGeometry, culmGeometry, culmLeaves, groveCulms } from '@/scene/decor/bamboo';
import { createDecorMaterial, createSwayDepthMaterial } from '@/scene/decor/materials';
import { DECOR_DENSITY, type PlacedGrove } from '@/scene/decor/placement';
import type { QualityProfile } from '@/scene/quality/tiers';

interface BambooGroveProps {
  groves: readonly PlacedGrove[];
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * El bambú de una estación: todas sus cañas en un InstancedMesh y todas sus
 * hojas en otro. Dos draw calls por estación. Se dobla con el muelle de
 * `sway.ts`, desde el vertex shader (`windSway.ts`).
 */
export function BambooGrove({ groves, palette, profile }: BambooGroveProps) {
  const meshes = useMemo(() => {
    const culms = groves.flatMap((grove) => groveCulms(grove, DECOR_DENSITY[profile.tier]));
    const leaves = culmLeaves(culms, 4021);
    const look = { washi: palette.washi, ink: palette.sumi };

    // Cañas: del verde del bambú al de las cañas viejas, algo más amarillo.
    const culmGeo = culmGeometry();
    const culmMesh = new InstancedMesh(
      culmGeo,
      createDecorMaterial({ ...look, key: 'bambu-cana', color: '#ffffff', roughness: 0.55, sway: 'tallo' }),
      culms.length,
    );
    const young = new Color(palette.bambu);
    const old = new Color(palette.bambu).lerp(new Color(palette.kohaku), 0.35);
    const color = new Color();
    const matrix = new Matrix4();
    const sway = new Float32Array(culms.length * 4);
    culms.forEach((culm, i) => {
      matrix.compose(
        new Vector3(culm.x, culm.y, culm.z),
        new Quaternion().setFromEuler(new Euler(culm.tiltX, 0, culm.tiltZ)),
        new Vector3(culm.radius, culm.height, culm.radius),
      );
      culmMesh.setMatrixAt(i, matrix);
      culmMesh.setColorAt(i, color.copy(young).lerp(old, culm.tone * 0.7));
      sway.set([culm.y, culm.height, culm.phase, culm.spring], i * 4);
    });
    culmGeo.setAttribute('aSway', new InstancedBufferAttribute(sway, 4));
    culmMesh.castShadow = profile.shadows;
    culmMesh.receiveShadow = profile.shadows;
    culmMesh.customDepthMaterial = createSwayDepthMaterial(false);

    // Hojas: cada una lleva el aSway de su caña y se dobla con ella.
    const leafGeo = bambooLeafGeometry();
    const leafMesh = new InstancedMesh(
      leafGeo,
      createDecorMaterial({
        ...look,
        key: 'bambu-hoja',
        color: '#ffffff',
        roughness: 0.7,
        rim: 0.25,
        doubleSide: true,
        sway: 'hoja',
      }),
      leaves.length,
    );
    const leafSway = new Float32Array(leaves.length * 4);
    const light = new Color(palette.bambuPale);
    leaves.forEach((leaf, i) => {
      const culm = culms[leaf.culm]!;
      leafMesh.setMatrixAt(i, leaf.matrix);
      leafMesh.setColorAt(i, color.copy(young).lerp(light, ((i * 0.618) % 1) * 0.8));
      leafSway.set([culm.y, culm.height, culm.phase, culm.spring], i * 4);
    });
    leafGeo.setAttribute('aSway', new InstancedBufferAttribute(leafSway, 4));

    return { culmMesh, leafMesh };
  }, [groves, palette, profile.tier, profile.shadows]);

  useEffect(
    () => () => {
      for (const mesh of [meshes.culmMesh, meshes.leafMesh]) {
        mesh.geometry.dispose();
        (mesh.material as { dispose(): void }).dispose();
        mesh.customDepthMaterial?.dispose();
        mesh.dispose();
      }
    },
    [meshes],
  );

  return (
    <>
      <primitive object={meshes.culmMesh} />
      <primitive object={meshes.leafMesh} />
    </>
  );
}
