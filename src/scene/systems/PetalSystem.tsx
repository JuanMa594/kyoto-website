'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
  type BufferGeometry,
} from 'three';

import type { Station } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import { mulberry32 } from '@/lib/procedural';
import { petalGeometry } from '@/scene/objects/PetalGeometry';
import { WIND } from '@/scene/systems/WindField';
import { selectParticleScale, useKyotoStore } from '@/store/useKyotoStore';

import { petalColors, petalCountFor, petalLayers, type PetalLayer } from './petals';

/**
 * Pétalos y hojas, en tres capas de profundidad.
 *
 * **Toda la animación ocurre en el vertex shader.** La CPU no toca una sola
 * posición por frame: sube cinco uniforms por capa y se desentiende. Por eso da
 * igual que haya setenta pétalos o trescientos — el coste es el mismo puñado de
 * draw calls, y el presupuesto se gasta en que se vean bien, no en moverlos.
 *
 * Lo único que la CPU sí tiene que hacer es **integrar el viento**: el shader
 * conoce la ráfaga de este frame pero no su historia, así que el
 * desplazamiento acumulado (`uDrift`) se suma aquí y se manda ya resuelto. Se
 * mantiene envuelto al ancho de la capa para que no crezca sin freno y acabe
 * comiéndose la precisión del float.
 *
 * Las tres capas no son decorativas: la de delante cruza **entre la cámara y el
 * sujeto** —es la que de verdad vende la profundidad, y la que el desenfoque de
 * campo convierte en bokeh—, la media acompaña al sujeto y la del fondo apenas
 * se insinúa entre la niebla.
 */

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uDrift;
  uniform float uDriftZ;
  uniform float uStrength;
  uniform vec3 uCenter;
  uniform vec3 uSize;
  uniform float uFall;
  uniform float uSpin;
  uniform float uScale;

  attribute vec3 aOffset;
  attribute float aSeed;
  attribute float aScale;

  varying float vShade;

  #include <fog_pars_vertex>

  // Rotación alrededor de un eje cualquiera (Rodrigues). Un pétalo que sólo
  // girase sobre un eje se leería como una moneda; éste voltea.
  mat3 axisRotation(vec3 axis, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    float t = 1.0 - c;
    vec3 a = normalize(axis);

    return mat3(
      t * a.x * a.x + c,        t * a.x * a.y - s * a.z,  t * a.x * a.z + s * a.y,
      t * a.x * a.y + s * a.z,  t * a.y * a.y + c,        t * a.y * a.z - s * a.x,
      t * a.x * a.z - s * a.y,  t * a.y * a.z + s * a.x,  t * a.z * a.z + c
    );
  }

  void main() {
    float seed = aSeed;

    // 0 = acaba de entrar por arriba, 1 = sale por abajo. El fract() hace el
    // ciclo infinito sin que nadie tenga que reciclar nada desde la CPU.
    float life = fract(aOffset.y + uTime * uFall * (0.65 + 0.7 * seed));

    float x01 = fract(aOffset.x + uDrift / uSize.x);
    float z01 = fract(aOffset.z + uDriftZ / uSize.z);

    float sway = sin(uTime * (0.6 + seed * 0.9) + seed * 31.4) * (0.25 + uStrength * 1.1);
    float bob = cos(uTime * (0.5 + seed * 0.7) + seed * 17.3) * 0.12;

    vec3 place = vec3(
      uCenter.x + (x01 - 0.5) * uSize.x + sway,
      uCenter.y + (0.5 - life) * uSize.y + bob,
      uCenter.z + (z01 - 0.5) * uSize.z
    );

    // Entran y salen encogiendo. Sin esto se ve el salto de abajo a arriba.
    float fade = smoothstep(0.0, 0.06, life) * (1.0 - smoothstep(0.88, 1.0, life));

    float angle = uTime * uSpin * (0.5 + seed) + seed * 6.283;
    mat3 spin = axisRotation(vec3(0.4 + seed * 0.6, 1.0, 0.25 - seed * 0.5), angle);

    vec3 local = spin * (position * uScale * aScale * fade);

    // Misma dirección que la luz direccional de la escena. El abs() es
    // deliberado: un pétalo es translúcido y sus dos caras reciben luz.
    vec3 lit = normalize(spin * normal);
    vShade = 0.35 + 0.65 * abs(dot(lit, normalize(vec3(-0.6, 0.75, 0.35))));

    vec4 mvPosition = modelViewMatrix * vec4(place + local, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uLight;
  uniform vec3 uDark;

  varying float vShade;

  #include <fog_pars_fragment>

  void main() {
    gl_FragColor = vec4(mix(uDark, uLight, vShade), 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** Cuánto empuja el viento a los pétalos, por unidad de viento y segundo. */
const DRIFT_SCALE = 2.6;

interface LayerProps {
  layer: PetalLayer;
  station: Station;
  palette: ScenePalette;
  count: number;
}

function PetalLayerMesh({ layer, station, palette, count }: LayerProps) {
  const kind = station.ambient.petalKind;

  const geometry = useMemo<BufferGeometry>(() => {
    const geo = petalGeometry(kind);

    // Semilla estable por capa: el reparto es el mismo en cada carga, que es lo
    // que permite comparar dos capturas al calibrar.
    const random = mulberry32(layer.name.length * 977 + count);
    const offsets = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const scales = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      offsets[i * 3] = random();
      offsets[i * 3 + 1] = random();
      offsets[i * 3 + 2] = random();
      seeds[i] = random();
      scales[i] = 0.7 + random() * 0.6;
    }

    geo.setAttribute('aOffset', new InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    geo.setAttribute('aScale', new InstancedBufferAttribute(scales, 1));

    return geo;
  }, [kind, count, layer.name]);

  const material = useMemo(() => {
    const [light, dark] = petalColors(kind, palette);

    const uniforms = UniformsUtils.merge([
      UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDrift: { value: 0 },
        uDriftZ: { value: 0 },
        uStrength: { value: 0 },
        uCenter: { value: null },
        uSize: { value: null },
        uFall: { value: layer.fall },
        uSpin: { value: layer.spin },
        uScale: { value: layer.scale },
        uLight: { value: null },
        uDark: { value: null },
      },
    ]);

    // `UniformsUtils.merge` clona cada valor, y clonar un Color o un Vector3
    // pasa por `.clone()`; se asignan después, ya construidos, para no depender
    // de ese detalle.
    uniforms.uCenter!.value = new Vector3(...layer.center);
    uniforms.uSize!.value = new Vector3(...layer.size);
    uniforms.uLight!.value = new Color(light);
    uniforms.uDark!.value = new Color(dark);

    return new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
      // Sin `UniformsLib.fog` mezclado arriba, el renderer no encuentra dónde
      // escribir el color y las distancias de la niebla, y los pétalos del
      // fondo flotarían nítidos sobre una escena con bruma.
      fog: true,
      // Opaco a propósito: con transparencia habría que ordenar cientos de
      // instancias por profundidad en cada frame para que no se recortaran
      // entre sí. La niebla ya disuelve las de atrás.
      transparent: false,
      side: DoubleSide,
    });
  }, [kind, palette, layer.center, layer.size, layer.fall, layer.spin, layer.scale]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const drift = useRef({ x: 0, z: 0 });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    // El viento se integra aquí y se manda ya sumado. Se envuelve al tamaño de
    // la capa: si creciera sin límite, en una sesión larga el float del shader
    // perdería resolución y los pétalos empezarían a dar tirones.
    drift.current.x = (drift.current.x + WIND.x * dt * DRIFT_SCALE) % layer.size[0];
    drift.current.z = (drift.current.z + WIND.z * dt * DRIFT_SCALE * 0.35) % layer.size[2];

    const uniforms = material.uniforms;
    uniforms.uTime!.value = WIND.time;
    uniforms.uDrift!.value = drift.current.x;
    uniforms.uDriftZ!.value = drift.current.z;
    uniforms.uStrength!.value = WIND.strength;
  });

  return (
    <instancedMesh
      args={[geometry, material, count]}
      // La geometría base mide un dedo y vive en el origen, así que el frustum
      // la daría por fuera de cuadro y se llevaría por delante todas las
      // instancias: sus posiciones reales sólo existen dentro del shader.
      frustumCulled={false}
    />
  );
}

interface PetalSystemProps {
  station: Station;
  palette: ScenePalette;
}

export function PetalSystem({ station, palette }: PetalSystemProps) {
  const particleScale = useKyotoStore(selectParticleScale);
  const layers = petalLayers();

  if (station.ambient.petalKind === 'ninguna' || particleScale <= 0) return null;

  return (
    <>
      {layers.map((layer) => {
        const count = petalCountFor(layer, station, particleScale);
        if (count <= 0) return null;

        return (
          <PetalLayerMesh
            key={`${layer.name}-${station.ambient.petalKind}-${count}`}
            layer={layer}
            station={station}
            palette={palette}
            count={count}
          />
        );
      })}
    </>
  );
}
