'use client';

import { useEffect, useMemo } from 'react';
import {
  Color,
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
/** La tierra oscura al pie de postes y troncos: algo más marcada, porque es color y no sólo sombra. */
const EARTH_ALPHA = 0.55;

/**
 * Las sombras de contacto de una estación (`decor/contact.ts`): un
 * InstancedMesh de cuadrados tendidos en el suelo, una draw call, con la
 * penumbra radial dibujada en el shader. Material básico: es oscuridad, no
 * recibe luz; sí niebla, para fundirse con el fondo a lo lejos. La tierra
 * oscura al pie de postes y troncos (`earth`) va en la misma draw call: otro
 * color, sumi-soft, y un borde deshecho que cambia con cada una.
 */
export function ContactShadows({ index, portrait, palette, profile }: ContactShadowsProps) {
  const mesh = useMemo(() => {
    const shadows = stationContacts(index, portrait, DECOR_DENSITY[profile.tier]);
    if (shadows.length === 0) return null;

    const geometry = new PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    const strength = new Float32Array(shadows.length);
    const earth = new Float32Array(shadows.length);

    const material = new MeshBasicMaterial({
      color: palette.sumi,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uEarth = { value: new Color(palette.sumiSoft) };
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
      earth[i] = shadow.earth;
    });
    geometry.setAttribute('aContact', new InstancedBufferAttribute(strength, 1));
    geometry.setAttribute('aEarth', new InstancedBufferAttribute(earth, 1));
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
attribute float aEarth;
varying vec2 vContactUv;
varying float vContactStrength;
varying float vEarth;
varying float vEarthSeed;
`;

const CONTACT_VERTEX = /* glsl */ `
vContactUv = position.xz * 2.0;
vContactStrength = aContact;
vEarth = aEarth;
// La semilla del borde, de dónde está: cada halo de tierra, distinto.
vEarthSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;
`;

const CONTACT_FRAGMENT_PARS = /* glsl */ `
uniform vec3 uEarth;
varying vec2 vContactUv;
varying float vContactStrength;
varying float vEarth;
varying float vEarthSeed;
`;

// Penumbra radial: densa bajo el objeto y sin borde, que muere antes de tocar
// el lado del cuadrado. La tierra, con el borde deshecho en tres ondas y del
// color de la tierra húmeda; más pareja por dentro.
const CONTACT_FRAGMENT = /* glsl */ `
float contactRadius = length(vContactUv);
float contactAngle = atan(vContactUv.y, vContactUv.x);
float earthEdge = 0.78 + 0.12 * sin(contactAngle * 3.0 + vEarthSeed) + 0.07 * sin(contactAngle * 7.0 - vEarthSeed * 1.7);
float earthFade = 1.0 - smoothstep(earthEdge * 0.45, earthEdge, contactRadius);
float shadowFade = 1.0 - smoothstep(0.1, 1.0, contactRadius);
float contactFade = mix(shadowFade * shadowFade, earthFade, vEarth);
diffuseColor.rgb = mix(diffuseColor.rgb, uEarth, vEarth);
diffuseColor.a *= contactFade * vContactStrength * mix(${MAX_ALPHA.toFixed(2)}, ${EARTH_ALPHA.toFixed(2)}, vEarth);
`;
