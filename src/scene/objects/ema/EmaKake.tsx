'use client';

import { useEffect, useMemo } from 'react';
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type MeshStandardMaterial,
} from 'three';

import { mulberry32 } from '@/lib/procedural';
import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';
import type { PlacedObject } from '@/scene/decor/placement';
import { withGrain } from '@/scene/objects/kosatsu/KosatsuSign';
import { useBoardProjection, type BoardLocal } from '@/scene/objects/kosatsu/useBoardProjection';
import type { QualityProfile } from '@/scene/quality/tiers';
import { SWAY_UNIFORMS } from '@/scene/systems/sway';

import { EMA_PLAQUE_FACE, EMA_SIZE, emaWritingLayout, foxSlots, plaqueExtent } from './ema';
import { emaGeometry, foxEmaGeometry } from './emaGeometry';

interface EmaKakeProps {
  placed: PlacedObject;
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * Un ema-kake de la subida a Fushimi Inari (Fase 6A), colocado por
 * `StationDecor` delante de la parada de su tarjeta: el bastidor con las ema
 * de zorro y, delante, la ema grande donde se lee la tarjeta. No se gira con
 * el viento; las ema de zorro sí se mecen, cada una con su fase.
 *
 * Su zona de escritura se proyecta como la de un kōsatsu
 * (`useBoardProjection`): el texto, la tarjeta de lectura al tocarla y la
 * vuelta al papel son los de la 5B, sin cambios.
 */
export default function EmaKake({ placed, palette, profile }: EmaKakeProps) {
  const item = placed.item;
  const side = item.kind === 'ema' ? item.side : 'izquierda';
  const card = item.kind === 'ema' ? item.card : -1;
  const parts = useMemo(() => emaGeometry(side), [side]);

  const materials = useMemo(() => {
    const common = { key: 'ema', washi: palette.washi, ink: palette.sumi };
    return {
      wood: createDecorMaterial({ ...common, color: palette.sumiSoft, roughness: 0.85 }),
      roof: createDecorMaterial({ ...common, color: palette.sumi, roughness: 0.8 }),
      plaque: withGrain(
        createDecorMaterial({ ...common, key: 'ema-tabla', color: palette.ishi, roughness: 0.9, rim: 0.2 }),
        palette.kohaku,
        palette.sumiFaint,
      ),
      cord: createDecorMaterial({ ...common, key: 'ema-cordon', color: palette.shu, roughness: 0.7, rim: 0.2 }),
    };
  }, [palette]);

  // Las ema de zorro, instanciadas: una draw call por ema-kake.
  const foxes = useMemo(() => {
    const slots = foxSlots(side);
    const geometry = foxEmaGeometry();
    const material = withFoxFace(
      createDecorMaterial({ key: 'ema-zorro', color: '#ffffff', washi: palette.washi, ink: palette.sumi, roughness: 0.85, rim: 0.25, doubleSide: true }),
      palette,
    );
    const mesh = new InstancedMesh(geometry, material, slots.length);
    const random = mulberry32(card * 131 + 17);
    const seeds = new Float32Array(slots.length);
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const unit = new Vector3(1, 1, 1);
    const color = new Color();
    const white = new Color(palette.kami);
    const aged = new Color(palette.washiDeep);
    slots.forEach((slot, i) => {
      // Un poco de desorden: unas más adelante, otras ladeadas.
      rotation.setFromAxisAngle(new Vector3(0, 1, 0), (random() - 0.5) * 0.5);
      matrix.compose(new Vector3(slot.x + (random() - 0.5) * 0.06, slot.y, 0.07 + random() * 0.04), rotation, unit);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.copy(white).lerp(aged, random() * 0.7));
      seeds[i] = random();
    });
    geometry.setAttribute('aFoxSeed', new InstancedBufferAttribute(seeds, 1));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = profile.shadows;
    mesh.computeBoundingSphere();
    return mesh;
  }, [side, card, palette, profile.shadows]);

  useEffect(
    () => () => {
      for (const material of Object.values(materials)) material.dispose();
    },
    [materials],
  );
  useEffect(
    () => () => {
      foxes.geometry.dispose();
      (foxes.material as MeshStandardMaterial).dispose();
      foxes.dispose();
    },
    [foxes],
  );

  // La ema grande, en sus coordenadas: lo escrito, la ema entera (con su punta) y su cara.
  const local = useMemo((): BoardLocal => {
    const extent = plaqueExtent(side);
    return { writing: emaWritingLayout(side), board: extent, faceZ: EMA_PLAQUE_FACE };
  }, [side]);
  useBoardProjection(placed, card, item.kind === 'ema' ? item.station : null, local);

  return (
    <group position={[placed.x, placed.y, placed.z]} rotation={[0, placed.yaw, 0]} scale={placed.scale}>
      <mesh geometry={parts.wood} material={materials.wood} castShadow={profile.shadows} receiveShadow={profile.shadows} />
      <mesh geometry={parts.roof} material={materials.roof} castShadow={profile.shadows} receiveShadow={profile.shadows} />
      <mesh geometry={parts.plaque} material={materials.plaque} castShadow={profile.shadows} receiveShadow={profile.shadows} />
      <mesh geometry={parts.cord} material={materials.cord} />
      <primitive object={foxes} />
    </group>
  );
}

const FOX_VERTEX_PARS = /* glsl */ `
attribute float aFoxSeed;
uniform float uSwayTime;
uniform float uSwayStrength;
varying vec3 vFoxPos;
vec3 foxSwing(vec3 v, float a, float b) {
  float ca = cos(a);
  float sa = sin(a);
  v = vec3(v.x, ca * v.y - sa * v.z, sa * v.y + ca * v.z);
  float cb = cos(b);
  float sb = sin(b);
  return vec3(cb * v.x + sb * v.z, v.y, -sb * v.x + cb * v.z);
}
`;

const FOX_SWING = /* glsl */ `
// Cada ema cuelga de su cordón: se balancea sobre el punto de donde cuelga,
// hacia delante y hacia atrás y girando un poco, a su ritmo. Con viento, más.
float foxRate = 1.1 + aFoxSeed * 0.9;
float foxSwingA = sin(uSwayTime * foxRate + aFoxSeed * 6.2831853) * (0.05 + 0.2 * uSwayStrength) - 0.06 * uSwayStrength;
float foxSwingB = sin(uSwayTime * foxRate * 0.63 + aFoxSeed * 11.0) * (0.06 + 0.16 * uSwayStrength);
`;

const FOX_FRAGMENT_PARS = /* glsl */ `
uniform vec3 uFoxRed;
uniform vec3 uFoxInk;
varying vec3 vFoxPos;
float foxEllipse(vec2 p, vec2 c, vec2 r, float turn) {
  vec2 q = p - c;
  float ct = cos(turn);
  float st = sin(turn);
  q = vec2(ct * q.x - st * q.y, st * q.x + ct * q.y) / r;
  return length(q);
}
`;

const FOX_FACE = /* glsl */ `
// La cara del zorro, pintada en la cara de delante (z alta): ojos rasgados de
// tinta con su filo rojo, el interior de las orejas y las mejillas en rojo, y
// la nariz. En la de atrás, nada: ahí se escribe el deseo.
if (vFoxPos.z > 0.015) {
  vec2 p = vFoxPos.xy;
  float side = sign(p.x);
  vec2 m = vec2(abs(p.x), p.y);
  float eye = foxEllipse(m, vec2(0.075, -0.2), vec2(0.05, 0.016), 0.38);
  float eyeRim = foxEllipse(m, vec2(0.075, -0.2), vec2(0.064, 0.026), 0.38);
  float ear = foxEllipse(m, vec2(0.14, -0.045), vec2(0.035, 0.05), -0.5);
  float cheek = foxEllipse(m, vec2(0.105, -0.29), vec2(0.035, 0.011), -0.25);
  float nose = foxEllipse(p, vec2(0.0, -0.43), vec2(0.022, 0.016), 0.0);
  vec3 ink = diffuseColor.rgb;
  ink = mix(ink, uFoxRed, (1.0 - smoothstep(0.85, 1.05, ear)) * 0.9);
  ink = mix(ink, uFoxRed, 1.0 - smoothstep(0.85, 1.05, eyeRim));
  ink = mix(ink, uFoxInk, 1.0 - smoothstep(0.8, 1.0, eye));
  ink = mix(ink, uFoxRed, (1.0 - smoothstep(0.8, 1.05, cheek)) * 0.85);
  ink = mix(ink, uFoxInk, 1.0 - smoothstep(0.8, 1.0, nose));
  diffuseColor.rgb = ink;
}
`;

/** La cara pintada y el balanceo de las ema de zorro. */
function withFoxFace(material: MeshStandardMaterial, palette: ScenePalette): MeshStandardMaterial {
  const base = material.onBeforeCompile;
  const red = { value: new Color(palette.shu) };
  const ink = { value: new Color(palette.sumi) };
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    shader.uniforms.uSwayTime = SWAY_UNIFORMS.uSwayTime;
    shader.uniforms.uSwayStrength = SWAY_UNIFORMS.uSwayStrength;
    shader.uniforms.uFoxRed = red;
    shader.uniforms.uFoxInk = ink;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FOX_VERTEX_PARS}`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>\n${FOX_SWING}\nobjectNormal = foxSwing(objectNormal, foxSwingA, foxSwingB);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\nvFoxPos = position;\ntransformed = foxSwing(transformed, foxSwingA, foxSwingB);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FOX_FRAGMENT_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FOX_FACE}`);
  };
  const previousKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${previousKey?.() ?? ''}-zorro`;
  return material;
}

/** Lo que mide el ema-kake: para las comprobaciones. */
export const EMA_TOP = EMA_SIZE.postHeight;
