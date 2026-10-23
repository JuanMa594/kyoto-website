'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, type MeshStandardMaterial } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { damp } from '@/lib/procedural';
import { createDecorMaterial } from '@/scene/decor/materials';
import type { PlacedObject } from '@/scene/decor/placement';
import type { QualityProfile } from '@/scene/quality/tiers';
import { KitsuneStatue } from '@/scene/objects/kitsune/KitsuneStatue';

import { LIGHT_OFF, LIGHT_ON, ROMON_LIGHTS } from './lights';
import { ROMON_FOXES } from './romon';
import { romonGeometry } from './romonGeometry';
import { ROMON_SCREEN } from './screen';

interface RomonProps {
  placed: PlacedObject;
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * El rōmon de Fushimi Inari (Fase 6A), con sus dos zorros de piedra. No se
 * mueve; lo que cambia es la luz de sus chōchin (`ROMON_LIGHTS`), que se
 * encienden al tocar la puerta.
 *
 * Cada frame deja en `ROMON_SCREEN` dónde cae la puerta en la ventana: de ahí
 * la lee la zona DOM que se toca (`LandmarkInput`). El canvas no captura el
 * puntero.
 */
export default function RomonGate({ placed, palette, profile }: RomonProps) {
  const parts = useMemo(romonGeometry, []);
  const invalidate = useThree((state) => state.invalidate);

  const materials = useMemo(() => {
    const common = { key: 'romon', washi: palette.washi, ink: palette.sumi };
    const bark = new Color(palette.sumiSoft).lerp(new Color(palette.sumi), 0.35).getStyle();
    const paper = createDecorMaterial({ ...common, key: 'romon-chochin', color: palette.kami, roughness: 0.85, rim: 0.15 });
    paper.emissive = new Color(palette.kohaku);
    paper.emissiveIntensity = 0.04;
    return {
      shu: createDecorMaterial({ ...common, color: palette.shu, roughness: 0.6 }),
      wall: createDecorMaterial({ ...common, key: 'romon-pano', color: palette.kami, roughness: 0.92, rim: 0.2 }),
      stone: createDecorMaterial({ ...common, key: 'romon-piedra', color: palette.ishiDeep, roughness: 0.95, rim: 0.25 }),
      roof: createDecorMaterial({ ...common, key: 'romon-tejado', color: bark, roughness: 0.9 }),
      dark: createDecorMaterial({ ...common, key: 'romon-alero', color: palette.sumi, roughness: 0.85, rim: 0.2 }),
      paper: withRibs(paper, palette.sumiSoft),
      caps: createDecorMaterial({ ...common, key: 'romon-tapas', color: palette.sumi, roughness: 0.6 }),
    };
  }, [palette]);

  useEffect(
    () => () => {
      for (const material of Object.values(materials)) material.dispose();
    },
    [materials],
  );

  useEffect(() => {
    ROMON_LIGHTS.wake = () => invalidate();
    return () => {
      ROMON_LIGHTS.wake = () => {};
      ROMON_SCREEN.on = false;
    };
  }, [invalidate]);

  useFrame(({ camera, size }, delta) => {
    // Los chōchin: hacia encendidos o hacia apagados, sin saltos.
    const target = ROMON_LIGHTS.lit ? 1 : 0;
    const before = ROMON_LIGHTS.value;
    ROMON_LIGHTS.value = damp(before, target, 1 / (target > before ? LIGHT_ON : LIGHT_OFF), Math.min(delta, 0.1));
    if (Math.abs(ROMON_LIGHTS.value - target) < 0.002) ROMON_LIGHTS.value = target;
    materials.paper.emissiveIntensity = 0.04 + 1.5 * ROMON_LIGHTS.value;
    // Con el canvas a demanda, se piden frames mientras cambia.
    if (ROMON_LIGHTS.value !== target) invalidate();

    ROMON_SCREEN.project(placed, camera, size.width, size.height);
  });

  return (
    <group position={[placed.x, placed.y, placed.z]} rotation={[0, placed.yaw, 0]} scale={placed.scale}>
      <mesh geometry={parts.stone} material={materials.stone} castShadow={profile.shadows} receiveShadow={profile.shadows} />
      <mesh geometry={parts.shu} material={materials.shu} castShadow={profile.shadows} receiveShadow={profile.shadows} />
      <mesh geometry={parts.wall} material={materials.wall} receiveShadow={profile.shadows} />
      <mesh geometry={parts.roof} material={materials.roof} castShadow={profile.shadows} receiveShadow={profile.shadows} />
      <mesh geometry={parts.dark} material={materials.dark} castShadow={profile.shadows} receiveShadow={profile.shadows} />
      <mesh geometry={parts.paper} material={materials.paper} />
      <mesh geometry={parts.caps} material={materials.caps} />
      {ROMON_FOXES.map((fox) => (
        <KitsuneStatue key={fox.holding} x={fox.x} z={fox.z} yaw={fox.yaw} holding={fox.holding} palette={palette} profile={profile} />
      ))}
    </group>
  );
}

/** Las costillas de bambú del chōchin: líneas finas y oscuras a lo largo del papel. */
function withRibs(material: MeshStandardMaterial, rib: string): MeshStandardMaterial {
  const base = material.onBeforeCompile;
  const ribColor = { value: new Color(rib) };
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    shader.uniforms.uRibColor = ribColor;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vRibY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRibY = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRibColor;\nvarying float vRibY;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// Una costilla cada 0,16 u, fina.
float ribLine = 1.0 - smoothstep(0.012, 0.03, abs(fract(vRibY / 0.16) - 0.5) * 0.16);
diffuseColor.rgb = mix(diffuseColor.rgb, uRibColor, ribLine * 0.45);`,
      );
  };
  const previousKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${previousKey?.() ?? ''}-costillas`;
  return material;
}
