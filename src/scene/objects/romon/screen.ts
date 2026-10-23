import { Vector3, type Camera } from 'three';

import { ROMON, ROMON_HEIGHT } from './romon';

/** Lo que se puede tocar del rōmon, en locales: el edificio entero, de la base a la cumbrera. */
const HIT = { x0: -ROMON.lowerRoof.halfW, x1: ROMON.lowerRoof.halfW, y0: 0, y1: ROMON_HEIGHT, z0: -ROMON.lowerRoof.halfD, z1: ROMON.lowerRoof.halfD };

const point = new Vector3();

/**
 * Dónde cae el rōmon en la ventana (Fase 6A): su caja proyectada, en px. La
 * lee la zona DOM que se toca (`LandmarkInput`): el canvas no captura el
 * puntero. **Un único escritor**: `RomonGate`, en su `useFrame`, después de
 * `CameraRig`.
 */
export const ROMON_SCREEN = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  /** Si el rōmon está montado y delante de la cámara. */
  on: false,
  /** Proyecta la caja del rōmon colocado con `camera`. */
  project(
    placed: { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly scale: number },
    camera: Camera,
    width: number,
    height: number,
  ): void {
    const cos = Math.cos(placed.yaw);
    const sin = Math.sin(placed.yaw);
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let behind = false;
    for (const lx of [HIT.x0, HIT.x1]) {
      for (const ly of [HIT.y0, HIT.y1]) {
        for (const lz of [HIT.z0, HIT.z1]) {
          point
            .set(
              placed.x + (lx * cos + lz * sin) * placed.scale,
              placed.y + ly * placed.scale,
              placed.z + (-lx * sin + lz * cos) * placed.scale,
            )
            .project(camera);
          if (point.z >= 1 || point.z <= -1) behind = true;
          const px = ((point.x + 1) / 2) * width;
          const py = ((1 - point.y) / 2) * height;
          minX = Math.min(minX, px);
          maxX = Math.max(maxX, px);
          minY = Math.min(minY, py);
          maxY = Math.max(maxY, py);
        }
      }
    }
    this.x = minX;
    this.y = minY;
    this.w = maxX - minX;
    this.h = maxY - minY;
    this.on = !behind;
  },
};
