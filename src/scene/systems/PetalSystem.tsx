'use client';

import { useFrame } from '@react-three/fiber';
import { gsap } from 'gsap';
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
  type InstancedMesh,
} from 'three';

import { registerPresets } from '@/animation/presets';
import type { Station } from '@/config/journey';
import { readCssSeconds, type ScenePalette } from '@/lib/css-vars';
import { mulberry32 } from '@/lib/procedural';
import { petalGeometry } from '@/scene/objects/PetalGeometry';
import { WIND } from '@/scene/systems/WindField';
import { selectParticleScale, useKyotoStore } from '@/store/useKyotoStore';

import {
  petalAllocation,
  petalColors,
  petalDrawCount,
  petalLayers,
  petalPresence,
  PETAL_FADE_BAND,
  PETAL_SURGE,
  type PetalLayer,
} from './petals';

/**
 * Pétalos y hojas, en tres capas de profundidad.
 *
 * **Toda la animación ocurre en el vertex shader.** La CPU no toca una sola
 * posición por frame: sube un puñado de uniforms por capa y se desentiende. Por
 * eso da igual que haya setenta pétalos o trescientos — el coste es el mismo
 * puñado de draw calls, y el presupuesto se gasta en que se vean bien, no en
 * moverlos.
 *
 * Lo que la CPU sí tiene que integrar son las magnitudes con **memoria**, que
 * el shader no puede reconstruir porque sólo conoce este frame:
 *
 *   · `uDrift`, el desplazamiento acumulado del viento;
 *   · `uFallPhase`, lo que lleva caído cada pétalo. Y aquí está el detalle que
 *     no es obvio: la caída **no** puede escribirse como `tiempo × velocidad`
 *     si la velocidad cambia con la ráfaga, porque al cambiar el factor salta
 *     todo el producto y los pétalos se teletransportan. Se integra la fase y
 *     se manda ya sumada, que es continua por construcción.
 *
 * La densidad tampoco es fija: en reposo cada zona tiene la suya —el 100 % sólo
 * en la sakura de eventos, el resto ambientes pasivos— y **cada ráfaga la sube
 * hasta el doble**, con vuelta lenta a la calma. Los pétalos de más no aparecen
 * de golpe: el shader compara el índice de cada instancia con la densidad
 * actual y los hace entrar y salir encogiendo.
 *
 * Las tres capas no son decorativas: la de delante cruza **entre la cámara y el
 * sujeto** —es la que de verdad vende la profundidad, y la que el desenfoque de
 * campo convierte en bokeh—, la media acompaña al sujeto y la del fondo apenas
 * se insinúa entre la niebla.
 */

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uFallPhase;
  uniform float uDrift;
  uniform float uDriftZ;
  uniform float uStrength;
  uniform float uDensity;
  uniform float uFadeBand;
  uniform vec3 uCenter;
  uniform vec3 uSize;
  uniform float uSpin;
  uniform float uScale;

  attribute vec3 aOffset;
  attribute float aSeed;
  attribute float aScale;
  attribute float aIndex;

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
    float life = fract(aOffset.y + uFallPhase * (0.65 + 0.7 * seed));

    float x01 = fract(aOffset.x + uDrift / uSize.x);
    float z01 = fract(aOffset.z + uDriftZ / uSize.z);

    float sway = sin(uTime * (0.6 + seed * 0.9) + seed * 31.4) * (0.25 + uStrength * 1.1);
    float bob = cos(uTime * (0.5 + seed * 0.7) + seed * 17.3) * 0.12;

    vec3 place = vec3(
      uCenter.x + (x01 - 0.5) * uSize.x + sway,
      uCenter.y + (0.5 - life) * uSize.y + bob,
      uCenter.z + (z01 - 0.5) * uSize.z
    );

    // Entran y salen encogiendo por los dos motivos: porque terminan su caída,
    // y porque la densidad de la zona sube o baja con la ráfaga. Sin esto se
    // vería el salto de abajo a arriba y el estallido al empezar a soplar.
    float ciclo = smoothstep(0.0, 0.06, life) * (1.0 - smoothstep(0.88, 1.0, life));
    float presente = 1.0 - smoothstep(uDensity, uDensity + uFadeBand, aIndex);
    float fade = ciclo * presente;

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

/** Cuánto acelera la caída en el pico de la ráfaga. */
const GUST_FALL_BOOST = 0.4;

/** Histéresis de la ráfaga: entra por arriba y sale por abajo, sin parpadeos. */
const GUST_ON = 0.15;
const GUST_OFF = 0.07;

/**
 * El que decide cuándo la zona se llena y cuándo vuelve a su calma.
 *
 * Vigila el mismo `WIND` que mueve los pétalos —una sola fuente de viento para
 * todo el sitio— y traduce sus ráfagas en una tween de GSAP sobre la densidad.
 * Que sea una tween y no una copia de la envolvente del viento es deliberado:
 * **la vuelta tiene que ser más lenta que la ráfaga**. El aire se calma antes
 * que el aire lleno de hojas, y copiar la curva del viento daría un corte
 * antinatural justo cuando deja de soplar.
 *
 * Las curvas son las de `tokens.css` —`viento` para subir, `washi` para
 * volver— y los tiempos, los mismos tokens que gobiernan la ráfaga del viento.
 */
function GustSurge() {
  const gusting = useRef(false);

  useEffect(() => {
    // Las curvas con nombre las registra el motor de movimiento al arrancar,
    // pero con `prefers-reduced-motion` ese motor no existe y aquí seguiría
    // habiendo pétalos. Es idempotente.
    registerPresets();

    return () => {
      gsap.killTweensOf(PETAL_SURGE);
      PETAL_SURGE.value = 0;
    };
  }, []);

  useFrame(() => {
    const gust = WIND.gust;
    const next = gusting.current ? gust > GUST_OFF : gust > GUST_ON;
    if (next === gusting.current) return;

    gusting.current = next;
    gsap.killTweensOf(PETAL_SURGE);
    gsap.to(
      PETAL_SURGE,
      next
        ? { value: 1, duration: readCssSeconds('--gust-attack', 1.1), ease: 'viento' }
        : { value: 0, duration: readCssSeconds('--gust-release', 3.2), ease: 'washi' },
    );
  });

  return null;
}

interface LayerProps {
  layer: PetalLayer;
  station: Station;
  palette: ScenePalette;
  particleScale: number;
  allocation: number;
}

function PetalLayerMesh({ layer, station, palette, particleScale, allocation }: LayerProps) {
  const kind = station.ambient.petalKind;
  const mesh = useRef<InstancedMesh>(null);

  const geometry = useMemo<BufferGeometry>(() => {
    const geo = petalGeometry(kind);

    // Semilla estable por capa: el reparto es el mismo en cada carga, que es lo
    // que permite comparar dos capturas al calibrar.
    const random = mulberry32(layer.name.length * 977 + allocation);
    const offsets = new Float32Array(allocation * 3);
    const seeds = new Float32Array(allocation);
    const scales = new Float32Array(allocation);
    const indices = new Float32Array(allocation);

    for (let i = 0; i < allocation; i += 1) {
      offsets[i * 3] = random();
      offsets[i * 3 + 1] = random();
      offsets[i * 3 + 2] = random();
      seeds[i] = random();
      scales[i] = 0.7 + random() * 0.6;
      // Posición en la cola de la densidad. Como las posiciones ya son
      // aleatorias, los que entran con la ráfaga salen repartidos por todo el
      // cuadro y no en un bloque.
      indices[i] = allocation > 1 ? i / (allocation - 1) : 0;
    }

    geo.setAttribute('aOffset', new InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    geo.setAttribute('aScale', new InstancedBufferAttribute(scales, 1));
    geo.setAttribute('aIndex', new InstancedBufferAttribute(indices, 1));

    return geo;
  }, [kind, allocation, layer.name]);

  const material = useMemo(() => {
    const [light, dark] = petalColors(kind, palette);

    const uniforms = UniformsUtils.merge([
      UniformsLib.fog,
      {
        uTime: { value: 0 },
        uFallPhase: { value: 0 },
        uDrift: { value: 0 },
        uDriftZ: { value: 0 },
        uStrength: { value: 0 },
        uDensity: { value: 1 },
        uFadeBand: { value: PETAL_FADE_BAND },
        uCenter: { value: null },
        uSize: { value: null },
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
  }, [kind, palette, layer.center, layer.size, layer.spin, layer.scale]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const drift = useRef({ x: 0, z: 0 });
  const fallPhase = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    // Las dos magnitudes con memoria. El desplazamiento se envuelve al tamaño
    // de la capa: si creciera sin límite, en una sesión larga el float del
    // shader perdería resolución y los pétalos darían tirones.
    drift.current.x = (drift.current.x + WIND.x * dt * DRIFT_SCALE) % layer.size[0];
    drift.current.z = (drift.current.z + WIND.z * dt * DRIFT_SCALE * 0.35) % layer.size[2];
    fallPhase.current += layer.fall * (1 + WIND.gust * GUST_FALL_BOOST) * dt;

    const uniforms = material.uniforms;
    uniforms.uTime!.value = WIND.time;
    uniforms.uFallPhase!.value = fallPhase.current;
    uniforms.uDrift!.value = drift.current.x;
    uniforms.uDriftZ!.value = drift.current.z;
    uniforms.uStrength!.value = WIND.strength;
    uniforms.uDensity!.value = petalPresence(station, PETAL_SURGE.value);

    // Los que no están presentes ni siquiera entran en el draw call: el
    // `uDensity` de arriba sólo se encarga del puñado que está a medio
    // desvanecer en el borde.
    if (mesh.current) {
      mesh.current.count = petalDrawCount(layer, station, particleScale, PETAL_SURGE.value);
    }
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, allocation]}
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
      <GustSurge />

      {layers.map((layer) => {
        const allocation = petalAllocation(layer, station, particleScale);
        if (allocation <= 0) return null;

        return (
          <PetalLayerMesh
            key={`${layer.name}-${station.ambient.petalKind}-${allocation}`}
            layer={layer}
            station={station}
            palette={palette}
            particleScale={particleScale}
            allocation={allocation}
          />
        );
      })}
    </>
  );
}
