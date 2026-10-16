'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, Vector3, type MeshStandardMaterial } from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';
import type { PlacedObject } from '@/scene/decor/placement';
import type { QualityProfile } from '@/scene/quality/tiers';

import { boardWidth, KOSATSU, KOSATSU_SIZE, kosatsuWriting } from './kosatsu';
import { kosatsuGeometry } from './kosatsuGeometry';
import { KosatsuScroll } from './KosatsuScroll';

interface KosatsuProps {
  placed: PlacedObject;
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * Un kōsatsu del tramo de Ubicación (Fase 5B), colocado por `StationDecor`
 * delante de la parada de su tarjeta. No se mueve con el viento.
 *
 * Cada frame proyecta su zona de escritura con la cámara real y la deja en
 * `KOSATSU.rects`: de ahí la lee `useKosatsuFit`, que encaja encima el texto
 * DOM de la tarjeta. Si lleva mapa, cuelga su kakejiku (`KosatsuScroll`).
 */
export default function Kosatsu({ placed, palette, profile }: KosatsuProps) {
  const item = placed.item;
  const card = item.kind === 'kosatsu' ? item.card : -1;
  const map = item.kind === 'kosatsu' ? item.map : undefined;
  const parts = useMemo(() => kosatsuGeometry(map), [map]);
  const invalidate = useThree((state) => state.invalidate);

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

  // El puente con el DOM: pedir frames y, al irse, dejar de proyectar.
  useEffect(() => {
    if (card < 0) return;
    KOSATSU.wake = () => invalidate();
    return () => {
      KOSATSU.rects[card]!.on = false;
      KOSATSU.wake = () => {};
    };
  }, [card, invalidate]);

  const writing = useMemo(() => kosatsuWriting(placed), [placed]);
  // Dónde cae el centro de lo escrito sobre el eje x de la tabla, desde su centro.
  const writingOffset = useMemo(() => {
    const [dx, , dz] = [writing.center[0] - placed.x, 0, writing.center[2] - placed.z];
    return dx * writing.right[0] + dz * writing.right[2];
  }, [writing, placed]);
  const corner = useMemo(() => new Vector3(), []);

  useFrame(({ camera, size }) => {
    const rect = KOSATSU.rects[card];
    if (!rect) return;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let behind = false;
    const [cx, cy, cz] = writing.center;
    const [rx, , rz] = writing.right;
    for (const [sx, sy] of [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ] as const) {
      corner.set(cx + (rx * sx * writing.w) / 2, cy + (sy * writing.h) / 2, cz + (rz * sx * writing.w) / 2);
      corner.project(camera);
      if (corner.z >= 1 || corner.z <= -1) behind = true;
      const px = ((corner.x + 1) / 2) * size.width;
      const py = ((1 - corner.y) / 2) * size.height;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    rect.x = minX;
    rect.y = minY;
    rect.w = maxX - minX;
    rect.h = maxY - minY;

    // La tabla entera, de lado a lado (con el marco): el texto sólo va encima
    // si se ve entera.
    let boardMin = Number.POSITIVE_INFINITY;
    let boardMax = Number.NEGATIVE_INFINITY;
    for (const side of [-1, 1]) {
      const reach = side * (boardWidth(map) / 2 + KOSATSU_SIZE.frame) * placed.scale;
      // Del centro de lo escrito al canto de la tabla, a lo largo de su eje x.
      const along = reach - writingOffset;
      corner.set(cx + rx * along, cy, cz + rz * along).project(camera);
      if (corner.z >= 1 || corner.z <= -1) behind = true;
      const px = ((corner.x + 1) / 2) * size.width;
      boardMin = Math.min(boardMin, px);
      boardMax = Math.max(boardMax, px);
    }
    rect.boardX = boardMin;
    rect.boardW = boardMax - boardMin;
    rect.on = !behind;
  });

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
function withGrain(material: MeshStandardMaterial, warm: string, seam: string): MeshStandardMaterial {
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
