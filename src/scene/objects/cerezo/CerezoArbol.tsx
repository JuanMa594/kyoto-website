'use client';

import { useEffect, useMemo } from 'react';
import { Color, InstancedBufferAttribute, InstancedMesh, Mesh } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial, createSwayDepthMaterial } from '@/scene/decor/materials';
import { DECOR_DENSITY, type PlacedObject } from '@/scene/decor/placement';
import type { QualityProfile } from '@/scene/quality/tiers';

import { createBlossomMaterial } from './blossomMaterial';
import { growCerezo } from './cerezo';
import { blossomGeometry, blossomMatrices, cerezoTrunkGeometry, treeSway } from './cerezoGeometry';

interface CerezoArbolProps {
  placed: PlacedObject;
  palette: ScenePalette;
  profile: QualityProfile;
}

/** El muelle del cerezo (índice en `SPRINGS`): rígido y con retardo, se mece poco. */
const TREE_SPRING = 5;

/**
 * Un cerezo (Fase 5B), colocado por `StationDecor`: el tronco y las ramas en
 * una malla, las flores en un InstancedMesh. Dos draw calls por árbol. Se mece
 * entero con el viento, despacio (el tronco y la copa con el mismo muelle,
 * para que las flores no se despeguen de las ramas). El tronco proyecta su
 * sombra con el mismo viento; las flores, no.
 */
export default function CerezoArbol({ placed, palette, profile }: CerezoArbolProps) {
  const item = placed.item;
  const seed = item.kind === 'cerezo' ? item.seed : 0;

  const meshes = useMemo(() => {
    const tree = growCerezo(seed);
    const phase = (seed * 0.618) % 1;
    const look = { washi: palette.washi, ink: palette.sumi };

    const trunkGeo = cerezoTrunkGeometry(tree);
    trunkGeo.setAttribute('aSway', treeSway(trunkGeo.getAttribute('position').count, tree.height, phase, TREE_SPRING));
    const bark = new Color(palette.sumi).lerp(new Color(palette.sumiSoft), 0.45).getStyle();
    const trunk = new Mesh(trunkGeo, createDecorMaterial({ ...look, key: 'cerezo-tronco', color: bark, roughness: 0.9, sway: 'tallo' }));
    trunk.castShadow = profile.shadows;
    trunk.receiveShadow = profile.shadows;
    trunk.customDepthMaterial = createSwayDepthMaterial(false);

    const matrices = blossomMatrices(tree, DECOR_DENSITY[profile.tier], seed);
    const blossomGeo = blossomGeometry();
    const sway = new Float32Array(matrices.length * 4);
    for (let i = 0; i < matrices.length; i += 1) sway.set([0, tree.height, phase, TREE_SPRING], i * 4);
    blossomGeo.setAttribute('aSway', new InstancedBufferAttribute(sway, 4));
    const blossoms = new InstancedMesh(blossomGeo, createBlossomMaterial(palette.washi, palette.sumi, palette.sakura, palette.sakuraPale), matrices.length);
    const pale = new Color(palette.sakuraPale);
    const white = new Color(palette.kami);
    const color = new Color();
    matrices.forEach((matrix, i) => {
      blossoms.setMatrixAt(i, matrix);
      blossoms.setColorAt(i, color.copy(pale).lerp(white, ((i * 0.618) % 1) * 0.55));
    });
    blossoms.receiveShadow = profile.shadows;
    blossoms.computeBoundingSphere();
    return { trunk, blossoms };
  }, [seed, palette, profile.tier, profile.shadows]);

  useEffect(
    () => () => {
      for (const mesh of [meshes.trunk, meshes.blossoms]) {
        mesh.geometry.dispose();
        (mesh.material as { dispose(): void }).dispose();
        mesh.customDepthMaterial?.dispose();
      }
      meshes.blossoms.dispose();
    },
    [meshes],
  );

  // Sin giro: lo que se mece se dobla en los ejes del mundo.
  return (
    <group position={[placed.x, placed.y - 0.05, placed.z]} scale={placed.scale}>
      <primitive object={meshes.trunk} />
      <primitive object={meshes.blossoms} />
    </group>
  );
}
