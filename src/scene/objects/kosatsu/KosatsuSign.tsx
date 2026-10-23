'use client';

import { useMemo, useEffect } from 'react';
import { Color, type MeshStandardMaterial } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';
import type { PlacedObject } from '@/scene/decor/placement';
import type { QualityProfile } from '@/scene/quality/tiers';

import { boardWidth, KOSATSU_BOARD_TOP, KOSATSU_SIZE, writingLayout } from './kosatsu';
import { kosatsuGeometry } from './kosatsuGeometry';
import { KosatsuScroll } from './KosatsuScroll';
import { useBoardProjection, type BoardLocal } from './useBoardProjection';

interface KosatsuProps {
  placed: PlacedObject;
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * Un kōsatsu del tramo de Ubicación (Fase 5B), colocado por `StationDecor`
 * delante de la parada de su tarjeta. No se mueve con el viento.
 *
 * Cada frame proyecta su zona de escritura con la cámara real y con la de
 * su parada (`useBoardProjection`), y las deja en `KOSATSU.rects`: de ahí las
 * lee `useKosatsuFit`, que encaja encima el texto DOM de la tarjeta. Si lleva
 * mapa, cuelga su kakejiku (`KosatsuScroll`).
 */
export default function Kosatsu({ placed, palette, profile }: KosatsuProps) {
  const item = placed.item;
  const card = item.kind === 'kosatsu' ? item.card : -1;
  const map = item.kind === 'kosatsu' ? item.map : undefined;
  const parts = useMemo(() => kosatsuGeometry(map), [map]);

  const materials = useMemo(() => {
    const common = { key: 'kosatsu', washi: palette.washi, ink: palette.sumi };
    return {
      wood: createDecorMaterial({ ...common, color: palette.sumiSoft, roughness: 0.85 }),
      board: withGrain(
        createDecorMaterial({ ...common, key: 'kosatsu-tabla', color: palette.ishi, roughness: 0.92, rim: 0.2 }),
        palette.kohaku,
        palette.sumiFaint,
      ),
      roof: createDecorMaterial({ ...common, color: palette.sumi, roughness: 0.8 }),
    };
  }, [palette]);

  useEffect(
    () => () => {
      for (const material of Object.values(materials)) material.dispose();
    },
    [materials],
  );

  // La tabla, en sus coordenadas: lo escrito, la tabla entera con su marco y su cara.
  const local = useMemo((): BoardLocal => {
    const side = item.kind === 'kosatsu' ? item.side : 'izquierda';
    const reach = boardWidth(map) / 2 + KOSATSU_SIZE.frame;
    return {
      writing: writingLayout(side, map),
      board: {
        x0: -reach,
        x1: reach,
        y0: KOSATSU_SIZE.boardBottom - KOSATSU_SIZE.frame,
        y1: KOSATSU_BOARD_TOP + KOSATSU_SIZE.frame,
      },
      faceZ: KOSATSU_SIZE.boardDepth / 2,
    };
  }, [item, map]);
  useBoardProjection(placed, card, item.kind === 'kosatsu' ? item.station : null, local);

  return (
    <group position={[placed.x, placed.y, placed.z]} rotation={[0, placed.yaw, 0]} scale={placed.scale}>
      <mesh geometry={parts.wood} material={materials.wood} castShadow={profile.shadows} receiveShadow={profile.shadows} />
      <mesh geometry={parts.board} material={materials.board} castShadow={profile.shadows} receiveShadow={profile.shadows} />
      <mesh geometry={parts.roof} material={materials.roof} castShadow={profile.shadows} receiveShadow={profile.shadows} />
      {item.kind === 'kosatsu' && item.map && (
        <KosatsuScroll station={item.station} card={card} side={item.side} map={item.map} palette={palette} profile={profile} />
      )}
    </group>
  );
}

/**
 * La veta de la tabla: tablones horizontales con su junta, la fibra a lo
 * largo y un poco de sol en la madera. Va en la posición local (la tabla no
 * tiene uv), así que los tres tablones comparten programa.
 */
export function withGrain(material: MeshStandardMaterial, warm: string, seam: string): MeshStandardMaterial {
  const base = material.onBeforeCompile;
  const uWarm = { value: new Color(warm) };
  const uSeam = { value: new Color(seam) };
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    shader.uniforms.uGrainWarm = uWarm;
    shader.uniforms.uGrainSeam = uSeam;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrainPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uGrainWarm;
uniform vec3 uGrainSeam;
varying vec3 vGrainPos;
float grainHash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float grainNoise(vec2 q) {
  vec2 cell = floor(q);
  vec2 f = fract(q);
  vec2 s = f * f * (3.0 - 2.0 * f);
  return mix(mix(grainHash(cell), grainHash(cell + vec2(1.0, 0.0)), s.x),
             mix(grainHash(cell + vec2(0.0, 1.0)), grainHash(cell + vec2(1.0, 1.0)), s.x), s.y);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// Tablones de 0,66 u, la fibra a lo largo (x) ondulada por el ruido.
float plank = vGrainPos.y / 0.66;
float plankId = floor(plank);
float fiber = sin(vGrainPos.y * 46.0 + grainNoise(vec2(vGrainPos.x * 0.9, plankId * 7.0)) * 7.0);
float knots = grainNoise(vec2(vGrainPos.x * 2.3, vGrainPos.y * 2.3 + plankId * 3.1));
diffuseColor.rgb = mix(diffuseColor.rgb, uGrainWarm, 0.18 + 0.12 * grainHash(vec2(plankId, 3.0)));
diffuseColor.rgb *= 1.0 - 0.035 * fiber - 0.05 * smoothstep(0.62, 0.9, knots);
// La junta entre tablones: una línea fina y oscura.
float joint = smoothstep(0.482, 0.496, abs(fract(plank) - 0.5));
diffuseColor.rgb = mix(diffuseColor.rgb, uGrainSeam, joint * 0.55);`,
      );
  };
  return material;
}
