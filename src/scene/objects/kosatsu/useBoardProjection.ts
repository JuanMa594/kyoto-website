'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { PerspectiveCamera, Vector3, type Camera } from 'three';

import { cardStopD } from '@/animation/journeyScroll';
import type { StationSlug } from '@/config/journey';
import { createRig, snapRig } from '@/scene/camera/pathRig';
import type { PlacedObject } from '@/scene/decor/placement';

import { KOSATSU, type KosatsuProjection } from './kosatsu';

/** Un tablero en sus coordenadas locales: lo escrito, el tablero entero y su cara. */
export interface BoardLocal {
  /** La zona de escritura: centro y medidas. */
  readonly writing: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** El tablero entero, de lado a lado y de arriba abajo: lo que se toca. */
  readonly board: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };
  /** La z local de la cara. */
  readonly faceZ: number;
}

/** Las esquinas de la zona de escritura, en el orden en que se proyectan. */
const CORNERS = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
] as const;

/**
 * El puente de un tablero del tramo —un kōsatsu (5B) o una ema (6A)— con el
 * texto DOM de su tarjeta. Cada frame proyecta su zona de escritura con la
 * cámara real y con la de su parada, y las deja en `KOSATSU.rects[card]`: de
 * ahí las lee `useKosatsuFit`, que encaja encima el texto. Justo después llama
 * a `KOSATSU.place`, en el mismo frame (ver la trampa de `gsap.ticker`).
 */
export function useBoardProjection(placed: PlacedObject, card: number, station: StationSlug | null, local: BoardLocal): void {
  const invalidate = useThree((state) => state.invalidate);

  // El puente con el DOM: pedir frames y, al irse, dejar de proyectar.
  useEffect(() => {
    if (card < 0) return;
    KOSATSU.wake = () => invalidate();
    return () => {
      KOSATSU.rects[card]!.on = false;
      KOSATSU.rects[card]!.stop.on = false;
      KOSATSU.place?.(card);
      KOSATSU.wake = () => {};
    };
  }, [card, invalidate]);

  /** Del sistema local del tablero al mundo. */
  const toWorld = useMemo(() => {
    const cos = Math.cos(placed.yaw);
    const sin = Math.sin(placed.yaw);
    return (lx: number, ly: number, lz: number, out: Vector3) =>
      out.set(
        placed.x + (lx * cos + lz * sin) * placed.scale,
        placed.y + ly * placed.scale,
        placed.z + (-lx * sin + lz * cos) * placed.scale,
      );
  }, [placed]);
  const point = useMemo(() => new Vector3(), []);

  // La cámara de la parada de su tarjeta, quieta: con ella se decide si el
  // texto va sobre el tablero (`boardFit`). Sólo cambian su aspecto y su fov.
  const stopCamera = useMemo(() => {
    const rig = createRig();
    snapRig(rig, station ? cardStopD(station, card) : 0);
    const camera = new PerspectiveCamera();
    camera.position.set(rig.camera.x, rig.camera.y, rig.camera.z);
    camera.lookAt(rig.focus.x, rig.focus.y, rig.focus.z);
    camera.updateMatrixWorld();
    return camera;
  }, [station, card]);

  /** Proyecta la zona de escritura y el tablero entero con `camera` en `out`. */
  const project = (camera: Camera, width: number, height: number, out: KosatsuProjection) => {
    const { writing, board, faceZ } = local;
    let behind = false;
    const toPx = () => {
      point.project(camera);
      if (point.z >= 1 || point.z <= -1) behind = true;
      return [((point.x + 1) / 2) * width, ((1 - point.y) / 2) * height] as const;
    };

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const [sx, sy] of CORNERS) {
      toWorld(writing.x + (sx * writing.w) / 2, writing.y + (sy * writing.h) / 2, faceZ, point);
      const [px, py] = toPx();
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    out.x = minX;
    out.y = minY;
    out.w = maxX - minX;
    out.h = maxY - minY;

    // El tablero entero, de lado a lado por la altura de lo escrito, y de
    // arriba abajo por su centro: el texto sólo va encima si se ve entero.
    let boardMin = Number.POSITIVE_INFINITY;
    let boardMax = Number.NEGATIVE_INFINITY;
    for (const lx of [board.x0, board.x1]) {
      toWorld(lx, writing.y, faceZ, point);
      const [px] = toPx();
      boardMin = Math.min(boardMin, px);
      boardMax = Math.max(boardMax, px);
    }
    out.boardX = boardMin;
    out.boardW = boardMax - boardMin;
    let boardTop = Number.POSITIVE_INFINITY;
    let boardBottom = Number.NEGATIVE_INFINITY;
    for (const ly of [board.y0, board.y1]) {
      toWorld(writing.x, ly, faceZ, point);
      const [, py] = toPx();
      boardTop = Math.min(boardTop, py);
      boardBottom = Math.max(boardBottom, py);
    }
    out.boardY = boardTop;
    out.boardH = boardBottom - boardTop;
    toWorld(writing.x, writing.y, faceZ, point);
    out.distance = camera.position.distanceTo(point);
    out.on = !behind;
  };

  useFrame(({ camera, size }) => {
    const rect = KOSATSU.rects[card];
    if (!rect) return;
    project(camera, size.width, size.height, rect);
    // El mismo tablero visto desde su parada, con la lente y el aspecto de ahora.
    const fov = (camera as PerspectiveCamera).fov;
    const aspect = size.width / Math.max(1, size.height);
    if (stopCamera.fov !== fov || stopCamera.aspect !== aspect) {
      stopCamera.fov = fov;
      stopCamera.aspect = aspect;
      stopCamera.updateProjectionMatrix();
    }
    project(stopCamera, size.width, size.height, rect.stop);
    // El texto DOM, en este mismo frame (ver KOSATSU.place).
    KOSATSU.place?.(card);
  });
}
