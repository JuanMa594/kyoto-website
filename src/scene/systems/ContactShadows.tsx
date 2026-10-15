'use client';

import { useEffect, useMemo } from 'react';
import {
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { stationContacts } from '@/scene/decor/contact';
import { DECOR_DENSITY } from '@/scene/decor/placement';
import type { QualityProfile } from '@/scene/quality/tiers';

interface ContactShadowsProps {
  /** Índice de la estación en `JOURNEY`. */
  index: number;
  portrait: boolean;
  palette: ScenePalette;
  profile: QualityProfile;
}

/**
 * Lo más oscura que llega a ser una sombra de contacto, en su centro. Más
 * que esto deja de ser penumbra y se lee como una mancha de tinta.
 */
const MAX_ALPHA = 0.38;

/**
 * Las sombras de contacto de una estación (`decor/contact.ts`): un
 * InstancedMesh de cuadrados tendidos en el suelo, una draw call, con la
 * penumbra radial dibujada en el shader. Material básico: es oscuridad, no
 * recibe luz; sí niebla, para fundirse con el fondo a lo lejos.
 */
export function ContactShadows({ index, portrait, palette, profile }: ContactShadowsProps) {
  const mesh = useMemo(() => {
    const shadows = stationContacts(index, portrait, DECOR_DENSITY[profile.tier]);
    if (shadows.length === 0) return null;

    const geometry = new PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    const strength = new Float32Array(shadows.length);

    const material = new MeshBasicMaterial({
      color: palette.sumi,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${CONTACT_VERTEX_PARS}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${CONTACT_VERTEX}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${CONTACT_FRAGMENT_PARS}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${CONTACT_FRAGMENT}`);
    };
    material.customProgramCacheKey = () => 'decor-contacto';

    const instanced = new InstancedMesh(geometry, material, shadows.length);
    const matrix = new Matrix4();
    const up = new Vector3(0, 1, 0);
    const normal = new Vector3();
    const tilt = new Quaternion();
    shadows.forEach((shadow, i) => {
      tilt.setFromUnitVectors(up, normal.set(...shadow.normal));
      const size = shadow.radius * 2;
      matrix.compose(new Vector3(shadow.x, shadow.y, shadow.z), tilt, new Vector3(size, 1, size));
      instanced.setMatrixAt(i, matrix);
      strength[i] = shadow.strength;
    });
    geometry.setAttribute('aContact', new InstancedBufferAttribute(strength, 1));
    instanced.computeBoundingSphere();
    // Lo primero de lo plano: el musgo (renderOrder −1) se dibuja encima.
    instanced.renderOrder = -2;
    return instanced;
  }, [index, portrait, palette, profile.tier]);

  useEffect(
    () => () => {
      if (!mesh) return;
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
      mesh.dispose();
    },
    [mesh],
  );

  return mesh ? <primitive object={mesh} /> : null;
}

const CONTACT_VERTEX_PARS = /* glsl */ `
attribute float aContact;
varying vec2 vContactUv;
varying float vContactStrength;
`;

const CONTACT_VERTEX = /* glsl */ `
vContactUv = position.xz * 2.0;
vContactStrength = aContact;
`;

const CONTACT_FRAGMENT_PARS = /* glsl */ `
varying vec2 vContactUv;
varying float vContactStrength;
`;

// Penumbra radial: densa bajo el objeto y sin borde, que muere antes de tocar
// el lado del cuadrado.
const CONTACT_FRAGMENT = /* glsl */ `
float contactFade = 1.0 - smoothstep(0.1, 1.0, length(vContactUv));
diffuseColor.a *= contactFade * contactFade * vContactStrength * ${MAX_ALPHA.toFixed(2)};
`;
