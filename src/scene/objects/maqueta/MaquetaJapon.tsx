'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { gsap } from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import { Plane, Raycaster, Vector2, Vector3, type Group, type Mesh } from 'three';

import { registerPresets } from '@/animation/presets';
import type { ScenePalette } from '@/lib/css-vars';
import { createDecorMaterial } from '@/scene/decor/materials';
import type { PlacedObject } from '@/scene/decor/placement';
import { createRig, snapRig } from '@/scene/camera/pathRig';
import { PATH, stationDepth } from '@/scene/path/journeyPath';
import type { QualityProfile } from '@/scene/quality/tiers';
import { stepSpring, type Spring, type SpringState } from '@/scene/systems/sway';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { MAQUETA } from './input';
import { MAQUETA_SIZE, MAQUETA_ZOOM } from './maqueta';
import { maquetaGeometry, PIN_HEIGHT } from './maquetaGeometry';
import { Pin } from './Pin';
import { KYOTO_CITY, PREFECTURES } from './prefectures.generated';
import { createMapMaterials, createSeaMaterials, createSlabUniforms, fillLandColors } from './slabMaterial';
import { faceCamera, KYOTO_INDEX, pickSlab, slabTargets, trayPose } from './zoom';

interface MaquetaProps {
  placed: PlacedObject;
  palette: ScenePalette;
  profile: QualityProfile;
}

const COUNT = PREFECTURES.length;
const IS_KINKI = PREFECTURES.map((p) => p.kinki);

/** Hasta dónde puede alejarse la cámara de la estación con la maqueta viva. */
const ACTIVE_RANGE = 0.6;
/** Las losas suben con peso y se pasan un pelo: un muelle firme. */
const SLAB_SPRING: Spring = { omega: 10, zeta: 0.55, gain: 0, delay: 0 };
/** Lo que dura el nombre de una prefectura tocada en una pantalla táctil. */
const TOUCH_LABEL = 2.5;
/** Lo alto de la cara de una losa, en el espacio de la bandeja. */
const SLAB_TOP = MAQUETA_SIZE.baseHeight + MAQUETA_SIZE.slabHeight;
/** Las esquinas de la cara de la bandeja, en orden, en fracción de su medio lado. */
const FRAME_CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;
/** Lo que flota la punta del pin sobre la losa de Kyoto. */
const PIN_FLOAT = 0.06;

/**
 * La maqueta de Japón de Ubicación (Fase 5A): el atril, la bandeja y, dentro,
 * el mapa en dos capas. El zoom no mueve la cámara: escala el contenido
 * alrededor de Kyoto y endereza la bandeja; los planos de recorte cortan lo
 * que sale de ella. Lo monta `StationDecor` (en diferido: el dato pesa) y lo
 * desmonta al alejarse.
 */
export default function Maqueta({ placed, palette, profile }: MaquetaProps) {
  const parts = useMemo(maquetaGeometry, []);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const uniforms = useMemo(createSlabUniforms, []);
  const clipping = useMemo(() => [0, 1, 2, 3].map(() => new Plane()), []);
  const { materials, waveUniforms } = useMemo(() => {
    const common = { washi: palette.washi, ink: palette.sumi };
    fillLandColors(palette, uniforms.uLand.value);
    const { waveUniforms: wave, ...sea } = createSeaMaterials(palette, clipping);
    return {
      materials: {
        ...createMapMaterials(palette, uniforms, clipping),
        ...sea,
        stone: createDecorMaterial({ ...common, key: 'maqueta-atril', color: palette.ishiDeep, roughness: 0.95 }),
      },
      waveUniforms: wave,
    };
  }, [palette, uniforms, clipping]);

  const object = useRef<Group>(null);
  const tray = useRef<Group>(null);
  const content = useRef<Group>(null);
  const slabs = useRef<Mesh>(null);
  const pin = useRef<Group>(null);

  const state = useMemo(
    () => ({
      springs: PREFECTURES.map((): SpringState => ({ x: 0, v: 0 })),
      settled: false,
      lift: new Float32Array(COUNT),
      sea: new Float32Array(COUNT),
      hover: -1,
      touch: { index: -1, until: 0 },
      raycaster: new Raycaster(),
      ndc: new Vector2(),
      point: new Vector3(),
      localPlanes: [
        new Plane(new Vector3(-1, 0, 0), 0),
        new Plane(new Vector3(1, 0, 0), 0),
        new Plane(new Vector3(0, 0, -1), 0),
        new Plane(new Vector3(0, 0, 1), 0),
      ],
    }),
    [],
  );
  const stationD = useMemo(() => stationDepth('ubicacion'), []);
  // De frente a la cámara de la estación, que no se mueve: el zoom gira y
  // endereza la maqueta hasta leerse de frente.
  const face = useMemo(() => {
    const rig = createRig();
    snapRig(rig, stationD);
    return faceCamera(placed, rig.camera);
  }, [placed, stationD]);

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  // A demanda (movimiento reducido), cada gesto pide su frame.
  useEffect(() => {
    MAQUETA.wake = () => invalidate();
    return () => {
      MAQUETA.wake = () => {};
    };
  }, [invalidate]);

  useEffect(
    () => () => {
      for (const material of Object.values(materials)) material.dispose();
    },
    [materials],
  );

  // El zoom: una tween sobre `MAQUETA.zoomT` cada vez que cambia el store.
  useEffect(() => {
    registerPresets();
    let tween: gsap.core.Tween | null = null;
    const apply = (zoom: 'japon' | 'kyoto') => {
      const target = zoom === 'kyoto' ? 1 : 0;
      tween?.kill();
      tween = null;
      if (!selectMotionAllowed(useKyotoStore.getState())) {
        MAQUETA.zoomT = target;
        invalidate();
        return;
      }
      const distance = Math.abs(target - MAQUETA.zoomT);
      if (distance === 0) return;
      tween = gsap.to(MAQUETA, { zoomT: target, duration: MAQUETA_ZOOM.duration * distance, ease: 'piedra' });
    };
    apply(useKyotoStore.getState().mapZoom);
    const unsubscribe = useKyotoStore.subscribe((now, before) => {
      if (now.mapZoom !== before.mapZoom) apply(now.mapZoom);
    });
    return () => {
      unsubscribe();
      tween?.kill();
      tween = null;
      if (useKyotoStore.getState().mapZoom === 'japon') MAQUETA.zoomT = 0;
      MAQUETA.active = false;
      MAQUETA.hover = -1;
      MAQUETA.overKyoto = false;
      MAQUETA.labelOn.fill(0);
      MAQUETA.pin.on = false;
    };
  }, [invalidate]);

  useFrame(({ camera, clock, size }, delta) => {
    const objectGroup = object.current;
    const trayGroup = tray.current;
    const contentGroup = content.current;
    const slabMesh = slabs.current;
    if (!objectGroup || !trayGroup || !contentGroup || !slabMesh) return;

    const store = useKyotoStore.getState();
    const motion = selectMotionAllowed(store);
    const away = Math.abs(PATH.d - stationD) > ACTIVE_RANGE;
    const active = PATH.live && !away && Math.abs(PATH.offset) < 0.5;
    MAQUETA.active = active;
    // Al echar a andar, el zoom se deshace solo.
    if (away && store.mapZoom === 'kyoto') store.setMapZoom('japon');

    // La pose.
    const t = MAQUETA.zoomT;
    const pose = trayPose(t, face);
    objectGroup.rotation.y = placed.yaw + pose.yaw;
    trayGroup.rotation.x = pose.tilt;
    trayGroup.position.z = pose.forward;
    contentGroup.scale.set(pose.scale, pose.heightScale, pose.scale);
    contentGroup.position.set(pose.offsetX, 0, pose.offsetZ);
    objectGroup.updateMatrixWorld(true);
    // Las olas siguen a su sitio del mapa sin cambiar de tamaño.
    waveUniforms.uWaveScale.value = pose.scale;
    waveUniforms.uWaveOffset.value.set(pose.offsetX, pose.offsetZ);
    waveUniforms.uWaveZoom.value = t;

    // Los planos de recorte, del espacio de la bandeja al mundo.
    const half = (MAQUETA_SIZE.tray / 2) * MAQUETA_SIZE.clip;
    state.localPlanes.forEach((local, i) => {
      local.constant = half;
      clipping[i]!.copy(local).applyMatrix4(trayGroup.matrixWorld);
    });

    // Lo que hay bajo el cursor: la losa más cercana dentro de la bandeja (en
    // el zoom, sólo las de Kinki).
    const pick = (x: number, y: number): number => {
      state.raycaster.setFromCamera(state.ndc.set(x, y), camera);
      const aPref = slabMesh.geometry.getAttribute('aPref');
      const hits = state.raycaster.intersectObject(slabMesh, false).flatMap((hit) => {
        if (!hit.face) return [];
        trayGroup.worldToLocal(state.point.copy(hit.point));
        const inTray = Math.abs(state.point.x) <= half && Math.abs(state.point.z) <= half;
        return [{ pref: Math.round(aPref.getX(hit.face.a)), group: hit.face.materialIndex, inTray }];
      });
      return pickSlab(hits, t);
    };

    const pointer = MAQUETA.pointer;
    if (!active || !pointer.present) state.hover = -1;
    else if (pointer.moved || (t > 0 && t < 1)) state.hover = pick(pointer.x, pointer.y);
    pointer.moved = false;

    const now = clock.elapsedTime;
    for (const click of MAQUETA.clicks.splice(0)) {
      if (!active) continue;
      const index = pick(click.x, click.y);
      if (index === KYOTO_INDEX) store.setMapZoom(store.mapZoom === 'kyoto' ? 'japon' : 'kyoto');
      else if (click.touch && index >= 0) state.touch = { index, until: now + TOUCH_LABEL };
    }
    const touching = active && state.touch.index >= 0 && now < state.touch.until;
    const hover = touching ? state.touch.index : state.hover;
    MAQUETA.hover = hover;
    MAQUETA.overKyoto = active && !touching && state.hover === KYOTO_INDEX;

    // Las losas: muelles hacia sus objetivos; el mar, directo.
    slabTargets(t, hover, state.lift, state.sea);
    const dt = Math.min(delta, 1 / 20);
    const steps = Math.max(1, Math.ceil(dt * 60));
    for (let i = 0; i < COUNT; i += 1) {
      const spring = state.springs[i]!;
      const target = state.lift[i]!;
      if (!state.settled || !motion) {
        spring.x = target;
        spring.v = 0;
      } else {
        for (let s = 0; s < steps; s += 1) stepSpring(spring, target, SLAB_SPRING, dt / steps);
      }
      uniforms.uLift.value[i] = spring.x;
      uniforms.uSea.value[i] = state.sea[i]!;
    }
    state.settled = true;

    // La cara visible de la bandeja, en la ventana: el marco de los nombres.
    FRAME_CORNERS.forEach(([sx, sz], k) => {
      state.point.set(sx * half, 0, sz * half);
      trayGroup.localToWorld(state.point);
      state.point.project(camera);
      const corner = MAQUETA.frame[k]!;
      corner[0] = ((state.point.x + 1) / 2) * size.width;
      corner[1] = ((1 - state.point.y) / 2) * size.height;
    });

    // Las etiquetas: el centro de cada losa visible, proyectado a la ventana.
    const wide = size.width > size.height;
    for (let i = 0; i < COUNT; i += 1) {
      // En el zoom, los nombres de Kinki, en corro; el de Kyoto, sólo al
      // tocarlo (lo marca el pin). En vertical la maqueta es pequeña y se
      // amontonarían: sólo el que se toca.
      const ring = active && wide && t > 0.6;
      const zoomed = ring && IS_KINKI[i] && i !== KYOTO_INDEX;
      const hovered = active && i === hover;
      if (!zoomed && !hovered) {
        MAQUETA.labelOn[i] = 0;
        continue;
      }
      const [cx, cz] = PREFECTURES[i]!.center;
      // Las del zoom no suben con su losa: el hover no las mueve.
      state.point.set(cx, SLAB_TOP + (ring ? 0 : state.springs[i]!.x), cz);
      contentGroup.localToWorld(state.point);
      state.point.project(camera);
      MAQUETA.labelX[i] = ((state.point.x + 1) / 2) * size.width;
      MAQUETA.labelY[i] = ((1 - state.point.y) / 2) * size.height;
      MAQUETA.labelOn[i] = state.point.z >= 1 ? 0 : zoomed ? 2 : 1;
    }

    // El pin: sobre la losa de Kyoto, de frente a la cámara.
    const pinGroup = pin.current;
    if (pinGroup) {
      state.point.set(KYOTO_CITY[0], SLAB_TOP + state.springs[KYOTO_INDEX]!.x, KYOTO_CITY[1]);
      contentGroup.localToWorld(state.point);
      const bob = motion ? 0.03 * Math.sin(now * 1.4) : 0;
      pinGroup.position.set(state.point.x, state.point.y + (PIN_FLOAT + bob) * placed.scale, state.point.z);
      pinGroup.quaternion.copy(camera.quaternion);
      const pinScale = (1 + 0.25 * t) * placed.scale;
      pinGroup.scale.setScalar(pinScale);

      // Su rectángulo en la ventana, para que las etiquetas lo esquiven.
      state.point.copy(pinGroup.position).project(camera);
      const bottom = ((1 - state.point.y) / 2) * size.height;
      MAQUETA.pin.x = ((state.point.x + 1) / 2) * size.width;
      state.point.copy(pinGroup.position).addScaledVector(camera.up, PIN_HEIGHT * pinScale).project(camera);
      MAQUETA.pin.top = ((1 - state.point.y) / 2) * size.height;
      MAQUETA.pin.bottom = bottom;
      MAQUETA.pin.on = active;
    }
  });

  return (
    <>
      <group ref={object} position={[placed.x, placed.y, placed.z]} rotation={[0, placed.yaw, 0]} scale={placed.scale}>
        <mesh
          geometry={parts.column}
          material={materials.stone}
          castShadow={profile.shadows}
          receiveShadow={profile.shadows}
        />
        <group ref={tray} position={[0, MAQUETA_SIZE.pivotY, 0]}>
          {/* La bandeja proyecta su sombra (la de las losas cae dentro de la
              suya); la columna, la suya y su penumbra de contacto. */}
          <mesh
            geometry={parts.tray}
            material={materials.tray}
            castShadow={profile.shadows}
            receiveShadow={profile.shadows}
          />
          {/* Las olas siguen al mapa en el shader y se desvanecen con el zoom. */}
          <mesh geometry={parts.waves} material={materials.waves} renderOrder={1} />
          <group ref={content}>
            {/* Después de las losas y antes del pin: el agua se adelanta para
                ser ella la orilla (slabMaterial.ts). */}
            <mesh geometry={parts.lake} material={materials.lake} receiveShadow={profile.shadows} renderOrder={1} />
            <mesh
              geometry={parts.base}
              material={[materials.baseFace, materials.baseSide]}
              receiveShadow={profile.shadows}
            />
            <mesh
              ref={slabs}
              geometry={parts.slabs}
              material={[materials.slabFace, materials.slabSide]}
              customDepthMaterial={materials.depth}
              receiveShadow={profile.shadows}
            />
          </group>
        </group>
      </group>
      <Pin ref={pin} palette={palette} profile={profile} />
    </>
  );
}
