'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CylinderGeometry, PlaneGeometry, SRGBColorSpace, TextureLoader, type Mesh, type Texture } from 'three';

import type { OldMap, Side, StationSlug } from '@/config/journey';
import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';
import type { QualityProfile } from '@/scene/quality/tiers';

import { KOSATSU, KOSATSU_SIZE, scrollLayout, unrollOf } from './kosatsu';
import { createScrollMaterial } from './scrollMaterial';

interface KosatsuScrollProps {
  /** La estación del tramo y la tarjeta del kōsatsu: lo que lee `unrollOf`. */
  station: StationSlug;
  card: number;
  side: Side;
  map: OldMap;
  palette: ScenePalette;
  profile: QualityProfile;
}

/** Radio de las varas; el rollo engorda con el papel que lleva enrollado. */
const ROD_RADIUS = 0.045;
const ROLL_EXTRA = 0.05;

/**
 * El kakejiku de un kōsatsu (Fase 5B): la vara de arriba, el papel con el mapa
 * antiguo y la vara de abajo, que baja con él. Lo que cuelga lo dice
 * `KOSATSU.unroll` (lo escribe el tramo con `tramoUnroll`): baja al acercarse a
 * la parada y vuelve a subir al alejarse. Va dentro del grupo del kōsatsu, en
 * sus coordenadas locales.
 */
export function KosatsuScroll({ station, card, side, map, palette, profile }: KosatsuScrollProps) {
  const layout = useMemo(() => scrollLayout(side, map), [side, map]);
  const [texture, setTexture] = useState<Texture | null>(null);
  const paperMesh = useRef<Mesh>(null);
  const bottomRod = useRef<Mesh>(null);

  // La textura del mapa, en diferido: sólo hace falta cerca de Ubicación.
  useEffect(() => {
    let alive = true;
    let loaded: Texture | null = null;
    new TextureLoader().load(`/maps/${map}.webp`, (result) => {
      result.colorSpace = SRGBColorSpace;
      result.anisotropy = 4;
      loaded = result;
      if (alive) setTexture(result);
      else result.dispose();
    });
    return () => {
      alive = false;
      loaded?.dispose();
    };
  }, [map]);

  const parts = useMemo(() => {
    const paper = new PlaneGeometry(layout.width, layout.height, 1, 48);
    // La parte de arriba en y = 0: cuelga hacia abajo.
    paper.translate(0, -layout.height / 2, 0);
    const rod = new CylinderGeometry(1, 1, layout.width + 0.22, 12);
    rod.rotateZ(Math.PI / 2);
    const { material: paperMaterial, uniforms } = createScrollMaterial(
      palette.washi,
      palette.kohaku,
      palette.sumiFaint,
      layout.height,
    );
    const rodMaterial = createDecorMaterial({
      key: 'kosatsu-vara',
      color: palette.sumi,
      washi: palette.washi,
      ink: palette.sumi,
      roughness: 0.6,
    });
    return { paper, rod, paperMaterial, uniforms, rodMaterial };
  }, [layout, palette]);

  useEffect(() => {
    parts.uniforms.uMap.value = texture;
    KOSATSU.wake();
  }, [parts, texture]);

  useEffect(
    () => () => {
      parts.paper.dispose();
      parts.rod.dispose();
      parts.paperMaterial.dispose();
      parts.rodMaterial.dispose();
    },
    [parts],
  );

  // Delante de la tabla, a más de un centímetro: el papel flota sobre ella.
  const z = KOSATSU_SIZE.boardDepth / 2 + 0.06;

  useFrame(() => {
    const unroll = unrollOf(station, card);
    parts.uniforms.uUnroll.value = unroll;
    const rod = bottomRod.current;
    if (rod) {
      // La vara de abajo lleva el rollo: más gordo cuanto más papel guarda.
      const radius = ROD_RADIUS + ROLL_EXTRA * (1 - unroll);
      rod.position.y = layout.top - unroll * layout.height - radius * 0.4;
      rod.scale.set(1, radius, radius);
    }
    if (paperMesh.current) paperMesh.current.visible = unroll > 0.002 && texture !== null;
  });

  // Las varas no proyectan sombra: sobre la tabla no se leería, y cada una
  // sería un draw call más en la pasada de sombras.
  return (
    <group position={[layout.x, 0, z]}>
      <mesh geometry={parts.rod} material={parts.rodMaterial} position={[0, layout.top + ROD_RADIUS, 0]} scale={[1, ROD_RADIUS, ROD_RADIUS]} />
      <mesh ref={paperMesh} geometry={parts.paper} material={parts.paperMaterial} position={[0, layout.top, 0]} receiveShadow={profile.shadows} />
      <mesh ref={bottomRod} geometry={parts.rod} material={parts.rodMaterial} position={[0, layout.top, 0]} />
    </group>
  );
}
