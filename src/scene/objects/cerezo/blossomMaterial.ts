import { Color, type MeshStandardMaterial } from 'three';

import { createDecorMaterial } from '@/scene/decor/materials';

/**
 * La flor del cerezo (Fase 5B): una tarjeta instanciada con la flor dibujada
 * en el shader —cinco pétalos redondeados con su muesca en la punta y el
 * centro más rosa—; fuera de la flor, `discard`. El color de cada flor (del
 * rosa pálido al blanco) es el de su instancia; el centro, `uBlossomHeart`.
 *
 * Es el material de la decoración con el viento en modo hoja: cada flor gira
 * sobre su base con fase propia y la copa entera se mece con el muelle de su
 * árbol.
 */
export function createBlossomMaterial(washi: string, ink: string, heart: string, glow: string): MeshStandardMaterial {
  const material = createDecorMaterial({
    key: 'cerezo-flor',
    color: '#ffffff',
    washi,
    ink,
    roughness: 0.7,
    // Sin filo de tinta: las flores de canto se oscurecían y la copa salía parda.
    rim: 0,
    doubleSide: true,
    sway: 'hoja',
  });
  // El pétalo deja pasar la luz: un poco de brillo propio, para que a
  // contraluz siga siendo rosa.
  material.emissive = new Color(glow);
  material.emissiveIntensity = 0.28;
  const base = material.onBeforeCompile;
  const uHeart = { value: new Color(heart) };
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    shader.uniforms.uBlossomHeart = uHeart;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBlossomUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlossomUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uBlossomHeart;\nvarying vec2 vBlossomUv;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// La flor, en polares: cinco pétalos con su muesca.
vec2 bloom = (vBlossomUv - 0.5) * 2.0;
float bloomRadius = length(bloom);
float bloomAngle = atan(bloom.y, bloom.x);
float petalWave = abs(cos(bloomAngle * 2.5));
float petalEdge = 0.55 + 0.42 * pow(petalWave, 0.6) - 0.1 * smoothstep(0.92, 1.0, petalWave);
if (bloomRadius > petalEdge) discard;
diffuseColor.rgb = mix(uBlossomHeart, diffuseColor.rgb, smoothstep(0.08, 0.38, bloomRadius));`,
      );
  };
  material.customProgramCacheKey = () => 'decor-cerezo-flor';
  return material;
}
