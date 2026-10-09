import { DoubleSide, FrontSide, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking } from 'three';

import { cartelUniforms, withCartelLook } from '@/scene/shaders/cartelLook';
import { withWindSway } from '@/scene/shaders/windSway';
import { SWAY_UNIFORMS } from '@/scene/systems/sway';

/**
 * Los materiales de la decoración: MeshStandardMaterial con la mirada de
 * cartel (y, en lo que se mece, el viento). Al ser materiales estándar traen
 * niebla, sombras y espacio de color sin hacer nada.
 */
export interface DecorMaterialOptions {
  /** Distingue programas: dos materiales con la misma clave comparten shader. */
  readonly key: string;
  readonly color: string;
  readonly washi: string;
  readonly ink: string;
  readonly roughness?: number;
  /** Fuerza del filo de tinta. Las hojas, finas, lo llevan más suave. */
  readonly rim?: number;
  readonly doubleSide?: boolean;
  readonly vertexColors?: boolean;
  /** Lo que se mece: 'tallo' se dobla; 'hoja' además planea (gira sobre su peciolo). */
  readonly sway?: 'tallo' | 'hoja';
}

export function createDecorMaterial(options: DecorMaterialOptions): MeshStandardMaterial {
  const uniforms = cartelUniforms(options.washi, options.ink, options.rim);
  const material = new MeshStandardMaterial({
    color: options.color,
    roughness: options.roughness ?? 0.75,
    metalness: 0,
    side: options.doubleSide ? DoubleSide : FrontSide,
    vertexColors: options.vertexColors ?? false,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (options.sway) {
      Object.assign(shader.uniforms, SWAY_UNIFORMS);
      shader.vertexShader = withWindSway(shader.vertexShader, options.sway === 'hoja');
    }
    shader.fragmentShader = withCartelLook(shader.fragmentShader);
  };
  material.customProgramCacheKey = () => `decor-${options.key}`;
  return material;
}

/**
 * La sombra de lo que se mece. Sin esto la sombra sería la de la planta
 * quieta: three dibuja las sombras con su propio material de profundidad.
 */
export function createSwayDepthMaterial(leaf: boolean): MeshDepthMaterial {
  const material = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, SWAY_UNIFORMS);
    shader.vertexShader = withWindSway(shader.vertexShader, leaf);
  };
  material.customProgramCacheKey = () => `decor-sway-depth-${leaf ? 'hoja' : 'tallo'}`;
  return material;
}
