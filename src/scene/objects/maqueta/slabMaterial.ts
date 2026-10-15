import {
  Color,
  MeshDepthMaterial,
  Vector2,
  RGBADepthPacking,
  type IUniform,
  type MeshStandardMaterial,
  type Plane,
} from 'three';

import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';

import { PREFECTURES } from './prefectures.generated';
import { REGION_TONE } from './regions';
import { KYOTO_INDEX } from './zoom';

/**
 * Los materiales de la base y de las losas de la maqueta (Fase 5A).
 *
 * Son los de la decoración (`MeshStandardMaterial` + mirada de cartel) con un
 * paso más: cada vértice sabe de qué prefectura es (`aPref`) y lee en dos
 * arrays de uniforms cuánto sube su losa (`uLift`) y cuánto se funde con el
 * color del mar (`uSea`). Los arrays los escribe la CPU en cada frame —con
 * los muelles de `MaquetaJapon`—; el shader no lleva reloj. Kyoto, además, lleva un
 * lavado shu (`uKyotoTint`).
 *
 * Todos comparten los planos de recorte de la bandeja: en el zoom, el mapa
 * crece y lo que sale de la bandeja se corta.
 */

const PREFS = PREFECTURES.length;

export interface SlabUniforms {
  readonly uLift: { value: Float32Array };
  readonly uSea: { value: Float32Array };
  /** El color de cada losa (rgb, plano): el de su región. */
  readonly uLand: { value: Float32Array };
}

export function createSlabUniforms(): SlabUniforms {
  return {
    uLift: { value: new Float32Array(PREFS) },
    uSea: { value: new Float32Array(PREFS) },
    uLand: { value: new Float32Array(PREFS * 3) },
  };
}

// Sin backticks dentro: cerrarían el template literal.
const VERTEX_PARS = /* glsl */ `
#define MAP_PREFS ${PREFS}
attribute float aPref;
uniform float uLift[MAP_PREFS];
uniform float uSea[MAP_PREFS];
uniform float uKyoto;
uniform vec3 uLand[MAP_PREFS];
varying float vMapSea;
varying float vMapKyoto;
varying vec3 vMapLand;
`;

const VERTEX_LIFT = /* glsl */ `
int mapIndex = int(aPref + 0.5);
transformed.y += uLift[mapIndex];
vMapSea = uSea[mapIndex];
vMapKyoto = 1.0 - step(0.5, abs(aPref - uKyoto));
vMapLand = uLand[mapIndex];
`;

const FRAGMENT_PARS = /* glsl */ `
uniform vec3 uSeaColor;
uniform vec3 uKyotoColor;
uniform float uKyotoTint;
uniform float uSeaGain;
uniform float uLandMix;
varying float vMapSea;
varying float vMapKyoto;
varying vec3 vMapLand;
`;

const FRAGMENT_COLOR = /* glsl */ `
diffuseColor.rgb = mix(diffuseColor.rgb, vMapLand, uLandMix);
diffuseColor.rgb = mix(diffuseColor.rgb, uKyotoColor, vMapKyoto * uKyotoTint);
diffuseColor.rgb = mix(diffuseColor.rgb, uSeaColor, min(1.0, vMapSea * uSeaGain));
`;

/** Sólo el desplazamiento, para la sombra. */
const DEPTH_PARS = /* glsl */ `
#define MAP_PREFS ${PREFS}
attribute float aPref;
uniform float uLift[MAP_PREFS];
`;

const DEPTH_LIFT = /* glsl */ `
transformed.y += uLift[int(aPref + 0.5)];
`;

interface PrefectureLook {
  readonly sea: string;
  readonly kyoto: string;
  readonly kyotoTint: number;
  /** La base se funde del todo: sus juntas, en el zoom, serían rayas gruesas. */
  readonly seaGain: number;
  /** Cuánto toma del color de su región: la cara entera, los cantos a medias. */
  readonly landMix: number;
}

/** Encadena el paso de las prefecturas tras el de la decoración, como `withMoss`. */
function withPrefectures(material: MeshStandardMaterial, uniforms: SlabUniforms, look: PrefectureLook) {
  const base = material.onBeforeCompile;
  const own: Record<string, IUniform> = {
    uSeaColor: { value: new Color(look.sea) },
    uKyotoColor: { value: new Color(look.kyoto) },
    uKyotoTint: { value: look.kyotoTint },
    uKyoto: { value: KYOTO_INDEX },
    uSeaGain: { value: look.seaGain },
    uLandMix: { value: look.landMix },
  };
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms, own);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_LIFT}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_COLOR}`);
  };
  return material;
}

export interface MapMaterials {
  readonly baseFace: MeshStandardMaterial;
  readonly baseSide: MeshStandardMaterial;
  readonly slabFace: MeshStandardMaterial;
  readonly slabSide: MeshStandardMaterial;
  readonly depth: MeshDepthMaterial;
}

/** Cuánto shu lleva la losa de Kyoto. Si se come al pin, se baja. */
const KYOTO_TINT = 0.28;

export function createMapMaterials(palette: ScenePalette, uniforms: SlabUniforms, clipping: Plane[]): MapMaterials {
  const common = { washi: palette.washi, ink: palette.sumi };
  const sea = `#${seaColor(palette).getHexString()}`;
  const look = (kyotoTint: number, seaGain: number, landMix: number): PrefectureLook => ({
    sea,
    kyoto: palette.shu,
    kyotoTint,
    seaGain,
    landMix,
  });
  const make = (key: string, color: string, tint: number, rim: number, seaGain = 1, landMix = 0) => {
    const material = withPrefectures(
      createDecorMaterial({ ...common, key: `maqueta-${key}`, color, roughness: 0.9, rim }),
      uniforms,
      look(tint, seaGain, landMix),
    );
    material.clippingPlanes = clipping;
    material.clipShadows = true;
    return material;
  };

  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${DEPTH_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${DEPTH_LIFT}`);
  };
  depth.customProgramCacheKey = () => 'maqueta-depth';
  depth.clippingPlanes = clipping;

  return {
    baseFace: make('base-cara', palette.sumi, 0, 0.2, 1.2),
    baseSide: make('base-canto', palette.kokeDeep, 0, 0.3, 1.2),
    slabFace: make('losa-cara', palette.kami, KYOTO_TINT, 0, 1, 1),
    slabSide: make('losa-canto', palette.ishi, KYOTO_TINT, 0.25, 1, 0.45),
    depth,
  };
}

/** Cuánto índigo lleva el mar de la bandeja: lo justo para leerse como agua. */
const SEA_INK = 0.46;

/** El mar: la piedra de la bandeja con un velo de índigo. */
export function seaColor(palette: ScenePalette): Color {
  return new Color(palette.ishi).lerp(new Color(palette.ai), SEA_INK);
}

/** El color de cada losa, el de su región, aclarado con blanco (`REGION_TONE`). */
export function fillLandColors(palette: ScenePalette, target: Float32Array): void {
  const white = new Color(palette.kami);
  const color = new Color();
  PREFECTURES.forEach((prefecture, i) => {
    const tone = REGION_TONE[prefecture.region];
    color.set(palette[tone.token]).lerp(white, tone.white);
    target[i * 3] = color.r;
    target[i * 3 + 1] = color.g;
    target[i * 3 + 2] = color.b;
  });
}

/** Cuánto índigo lleva el agua del lago Biwa: más honda que el mar, para que se distinga. */
const LAKE_INK = 0.78;

/**
 * Lo que se adelanta el agua del lago hacia la cámara, en unidades: más que
 * lo que queda por encima de ella la losa de Shiga levantada en el zoom
 * ((0,14 − 0,022 + 0,12) × 1,5 ≈ 0,36). Al pin no lo tapa aunque esté más
 * cerca: se pinta antes que él y no escribe profundidad (`renderOrder`).
 */
const LAKE_AHEAD_UNITS = 0.45;

/**
 * Por su propio rayo de vista: el vértice cae en el mismo píxel, sólo más
 * cerca en profundidad.
 */
const LAKE_AHEAD = /* glsl */ `
mvPosition.xyz -= normalize( mvPosition.xyz ) * ${LAKE_AHEAD_UNITS.toFixed(2)};
gl_Position = projectionMatrix * mvPosition;
`;

// El mar, pintado en la cara de la bandeja (aSea = 1). Sin backticks dentro.
const TRAY_VERTEX_PARS = /* glsl */ `
attribute float aSea;
varying float vTraySea;
`;

const TRAY_FRAGMENT_PARS = /* glsl */ `
uniform vec3 uTraySea;
varying float vTraySea;
`;

const TRAY_FRAGMENT = /* glsl */ `
diffuseColor.rgb = mix(diffuseColor.rgb, uTraySea, vTraySea);
`;

// El pincel seco de las olas: bordes deshechos y vetas a lo largo del trazo.
// Cada ola sigue a su sitio del mapa (aWave.xy, contenido) y se desvanece o
// aparece con el zoom según su juego (aWave.z). Sin backticks dentro.
const BRUSH_VERTEX_PARS = /* glsl */ `
attribute vec3 aBrush;
attribute vec3 aWave;
uniform float uWaveScale;
uniform vec2 uWaveOffset;
uniform float uWaveZoom;
varying vec3 vBrush;
varying float vWaveFade;
`;

const BRUSH_VERTEX = /* glsl */ `
transformed.x += aWave.x * uWaveScale + uWaveOffset.x;
transformed.z += aWave.y * uWaveScale + uWaveOffset.y;
vBrush = aBrush;
vWaveFade = aWave.z > 0.5 ? smoothstep(0.55, 1.0, uWaveZoom) : 1.0 - smoothstep(0.0, 0.45, uWaveZoom);
`;

const BRUSH_FRAGMENT_PARS = /* glsl */ `
varying vec3 vBrush;
varying float vWaveFade;
float mapBrushHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float mapBrushNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mapBrushHash(cell);
  float b = mapBrushHash(cell + vec2(1.0, 0.0));
  float c = mapBrushHash(cell + vec2(0.0, 1.0));
  float d = mapBrushHash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

const BRUSH_FRAGMENT = /* glsl */ `
float brushAcross = abs(vBrush.y);
float brushVein = mapBrushNoise(vec2(vBrush.x * 10.0 + vBrush.z * 17.0, vBrush.y * 3.5 + vBrush.z * 5.0));
float brushDry = mapBrushNoise(vec2(vBrush.x * 46.0 + vBrush.z * 9.0, vBrush.y * 9.0));
float brushEdge = 1.0 - smoothstep(0.5, 1.0, brushAcross + (brushVein - 0.5) * 0.55);
float brushInk = brushEdge * mix(0.55, 1.0, brushVein);
// Hacia el final del trazo el pincel se seca y deja hueco.
brushInk *= smoothstep(0.12, 0.42, brushDry + 0.35 * (1.0 - vBrush.x));
diffuseColor.a *= brushInk * vWaveFade;
`;

/** Lo que mueve las olas: la pose del contenido y el zoom. Los escribe `MaquetaJapon` cada frame. */
export interface WaveUniforms {
  readonly uWaveScale: { value: number };
  readonly uWaveOffset: { value: Vector2 };
  readonly uWaveZoom: { value: number };
}

export interface SeaMaterials {
  /** La bandeja de piedra, con el mar pintado en su cara. */
  readonly tray: MeshStandardMaterial;
  readonly lake: MeshStandardMaterial;
  readonly waves: MeshStandardMaterial;
  readonly waveUniforms: WaveUniforms;
}

/** La bandeja con su mar, el lago y las olas, en índigo (`--color-ai`). */
export function createSeaMaterials(palette: ScenePalette, clipping: Plane[]): SeaMaterials {
  const common = { washi: palette.washi, ink: palette.sumi };

  const tray = createDecorMaterial({ ...common, key: 'maqueta-bandeja', color: palette.ishi, roughness: 0.95, rim: 0.25 });
  const traySea = { value: seaColor(palette) };
  const trayBase = tray.onBeforeCompile;
  tray.onBeforeCompile = (shader, renderer) => {
    trayBase.call(tray, shader, renderer);
    shader.uniforms.uTraySea = traySea;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${TRAY_VERTEX_PARS}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTraySea = aSea;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${TRAY_FRAGMENT_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${TRAY_FRAGMENT}`);
  };

  const lakeColor = new Color(palette.ishi).lerp(new Color(palette.ai), LAKE_INK);
  const lake = createDecorMaterial({
    ...common,
    key: 'maqueta-lago',
    color: `#${lakeColor.getHexString()}`,
    roughness: 0.6,
    rim: 0,
  });
  lake.clippingPlanes = clipping;
  // El agua no sube con Shiga, pero de frente lo parecía: su orilla era el
  // borde del agujero de la losa, que sube con ella. Se adelanta en
  // profundidad —no en pantalla— para quedar por delante de la losa levantada
  // y ser ella la orilla. No escribe profundidad: el pin, que se pinta después,
  // queda encima.
  lake.depthWrite = false;
  const lakeBase = lake.onBeforeCompile;
  lake.onBeforeCompile = (shader, renderer) => {
    lakeBase.call(lake, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>\n${LAKE_AHEAD}`,
    );
  };

  const waveUniforms: WaveUniforms = {
    uWaveScale: { value: 1 },
    uWaveOffset: { value: new Vector2() },
    uWaveZoom: { value: 0 },
  };
  const waves = createDecorMaterial({ ...common, key: 'maqueta-olas', color: palette.ai, roughness: 0.9, rim: 0 });
  waves.transparent = true;
  waves.opacity = 0.85;
  waves.depthWrite = false;
  // Por encima de la bandeja también a lo lejos, donde la profundidad pierde precisión.
  waves.polygonOffset = true;
  waves.polygonOffsetFactor = -2;
  waves.polygonOffsetUnits = -2;
  waves.clippingPlanes = clipping;
  const wavesBase = waves.onBeforeCompile;
  waves.onBeforeCompile = (shader, renderer) => {
    wavesBase.call(waves, shader, renderer);
    Object.assign(shader.uniforms, waveUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${BRUSH_VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${BRUSH_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${BRUSH_FRAGMENT_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${BRUSH_FRAGMENT}`);
  };

  return { tray, lake, waves, waveUniforms };
}
