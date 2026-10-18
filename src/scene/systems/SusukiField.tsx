'use client';

import { useEffect, useMemo } from 'react';
import { Color, InstancedBufferAttribute, InstancedMesh } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';
import { DECOR_DENSITY, type PlacedSusuki } from '@/scene/decor/placement';
import {
  SUSUKI_SPRING,
  susukiBladeGeometry,
  susukiPlumeGeometry,
  susukiTufts,
  tuftBlades,
  tuftPlumes,
} from '@/scene/decor/susuki';
import type { QualityProfile } from '@/scene/quality/tiers';

interface SusukiFieldProps {
  patches: readonly PlacedSusuki[];
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * La susuki de una estación (Fase 5B): todas sus hojas en un InstancedMesh y
 * todas sus espigas en otro. Dos draw calls. Se mece con el viento de siempre
 * (`windSway`, modo hoja): cada hoja gira sobre su base con fase propia y se
 * tiende a sotavento con la flexión de su mata. No proyecta sombra: son
 * cintas finas, y su sombra no se leería y costaría.
 */
export function SusukiField({ patches, palette, profile }: SusukiFieldProps) {
  const meshes = useMemo(() => {
    const tufts = patches.flatMap((patch) => susukiTufts(patch, DECOR_DENSITY[profile.tier]));
    const blades = tuftBlades(tufts, 5101);
    const plumes = tuftPlumes(tufts, 5102);
    const look = { washi: palette.washi, ink: palette.sumi };

    const sway = (list: readonly { tuft: number }[]) => {
      const data = new Float32Array(list.length * 4);
      list.forEach((entry, i) => {
        const tuft = tufts[entry.tuft]!;
        data.set([tuft.y, tuft.height * 1.1, tuft.phase, SUSUKI_SPRING], i * 4);
      });
      return new InstancedBufferAttribute(data, 4);
    };

    const bladeGeo = susukiBladeGeometry();
    bladeGeo.setAttribute('aSway', sway(blades));
    const bladeMesh = new InstancedMesh(
      bladeGeo,
      createDecorMaterial({ ...look, key: 'susuki-hoja', color: '#ffffff', roughness: 0.8, rim: 0.2, doubleSide: true, sway: 'hoja' }),
      blades.length,
    );
    const green = new Color(palette.matchaSoft);
    const straw = new Color(palette.kohaku).lerp(new Color(palette.bambu), 0.25);
    // Los juncos, de un verde más hondo y apenas pajizos en la punta de la mata.
    const rushGreen = new Color(palette.bambu).lerp(new Color(palette.kokeDeep), 0.3);
    const color = new Color();
    blades.forEach((blade, i) => {
      const tuft = tufts[blade.tuft]!;
      bladeMesh.setMatrixAt(i, blade.matrix);
      const jitter = ((i * 0.618) % 1) * 0.2;
      bladeMesh.setColorAt(
        i,
        tuft.rush
          ? color.copy(rushGreen).lerp(green, 0.2 + tuft.tone * 0.3).lerp(straw, jitter * 0.6)
          : color.copy(green).lerp(straw, 0.25 + tuft.tone * 0.45 + jitter),
      );
    });

    const plumeGeo = susukiPlumeGeometry();
    plumeGeo.setAttribute('aSway', sway(plumes));
    const plumeMesh = new InstancedMesh(
      plumeGeo,
      createDecorMaterial({ ...look, key: 'susuki-espiga', color: '#ffffff', roughness: 0.65, rim: 0.12, doubleSide: true, sway: 'hoja' }),
      plumes.length,
    );
    const silver = new Color(palette.washiDeep);
    const blush = new Color(palette.sakuraBlush);
    plumes.forEach((plume, i) => {
      plumeMesh.setMatrixAt(i, plume.matrix);
      plumeMesh.setColorAt(i, color.copy(silver).lerp(blush, ((i * 0.381) % 1) * 0.35));
    });

    for (const mesh of [bladeMesh, plumeMesh]) {
      mesh.receiveShadow = profile.shadows;
      mesh.computeBoundingSphere();
    }
    return { bladeMesh, plumeMesh };
  }, [patches, palette, profile.tier, profile.shadows]);

  useEffect(
    () => () => {
      for (const mesh of [meshes.bladeMesh, meshes.plumeMesh]) {
        mesh.geometry.dispose();
        (mesh.material as { dispose(): void }).dispose();
        mesh.dispose();
      }
    },
    [meshes],
  );

  return (
    <>
      <primitive object={meshes.bladeMesh} />
      <primitive object={meshes.plumeMesh} />
    </>
  );
}
