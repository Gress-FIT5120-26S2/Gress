import { Billboard, OrbitControls, useAnimations, useGLTF, useProgress } from '@react-three/drei/native';
import { Canvas, createPortal, type ThreeEvent, useFrame, useThree } from '@react-three/fiber/native';
import { Fragment, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  AdditiveBlending,
  LoopOnce,
  MathUtils,
  Spherical,
  Vector3,
  type AnimationClip,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
  type PointLight,
} from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { KITCHEN_MODEL_ASSET } from '../assets/kitchenModel';
import type { AppTab } from './FloatingTabBar';
import {
  KitchenTimeEnvironment,
  type KitchenLightingState,
} from './KitchenTimeLighting';

type Kitchen3DPrototypeProps = {
  expiringCount?: number;
  lighting: KitchenLightingState;
  onExplore?: () => void;
  onInteractionStart?: () => void;
  onNavigate: (tab: AppTab) => void;
  onReady?: () => void;
};

type FeatureHotspotProps = {
  freshnessCount?: number;
  hitboxSize: [number, number, number];
  markerOffset: [number, number, number];
  onPress: () => void;
  reduceMotion: boolean;
};

type KitchenInteraction = 'fridge' | 'stove' | 'recipes' | null;
type KitchenFeature = Exclude<KitchenInteraction, null>;
type LoadedKitchen = { scene: Object3D; animations: AnimationClip[] };
type CameraMotion = {
  currentOffset: Vector3;
  currentSpherical: Spherical;
  currentTarget: Vector3;
  duration: number;
  endSpherical: Spherical;
  endTarget: Vector3;
  feature: Exclude<KitchenInteraction, null>;
  hasCuedEffect: boolean;
  startSpherical: Spherical;
  startedAt: number | null;
  startTarget: Vector3;
  thetaDelta: number;
};
type KitchenSceneProps = {
  activeInteraction: KitchenInteraction;
  effectInteraction: KitchenInteraction;
  expiringCount: number;
  lighting: KitchenLightingState;
  onEffectCue: (feature: Exclude<KitchenInteraction, null>) => void;
  onExplore?: () => void;
  onFocusComplete: (feature: Exclude<KitchenInteraction, null>) => void;
  onReady?: () => void;
  onSelectFeature: (feature: KitchenFeature) => void;
  reduceMotion: boolean;
};

const CAMERA_TARGET: [number, number, number] = [0, 1.3, 0];
const INITIAL_CAMERA_POSITION: [number, number, number] = [10.8, 8.8, 16.6];
const REDUCED_MOTION_DELAY = 180;
const EFFECT_CUE_PROGRESS = 0.32;
const CAMERA_FOCUS = {
  fridge: {
    anchorName: 'Hotspot_Fridge',
    cameraOffset: [3.8, 2.15, 5.15] as [number, number, number],
    targetOffset: [0, 0.08, 0.04] as [number, number, number],
    duration: 1320,
  },
  stove: {
    anchorName: 'Hotspot_Stove',
    cameraOffset: [2.75, 1.85, 4.25] as [number, number, number],
    targetOffset: [0, 0.14, 0.06] as [number, number, number],
    duration: 1180,
  },
  recipes: {
    anchorName: 'Hotspot_Recipes',
    cameraOffset: [3.0, 2.2, 4.15] as [number, number, number],
    targetOffset: [0, -0.12, 0.02] as [number, number, number],
    duration: 1220,
  },
} as const;
const BURNER_ANCHORS = ['Stove_Burner_Left_Anchor', 'Stove_Burner_Right_Anchor'] as const;
const FLAME_RING = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2;
  return [Math.cos(angle) * 0.15, 0.09, Math.sin(angle) * 0.15] as [number, number, number];
});

function sampleCubicBezier(time: number, point1: number, point2: number) {
  const inverse = 1 - time;
  return 3 * inverse * inverse * time * point1 + 3 * inverse * time * time * point2 + time * time * time;
}

function sampleCubicBezierDerivative(time: number, point1: number, point2: number) {
  const inverse = 1 - time;
  return 3 * inverse * inverse * point1 + 6 * inverse * time * (point2 - point1) + 3 * time * time * (1 - point2);
}

function cubicBezierProgress(progress: number, x1: number, y1: number, x2: number, y2: number) {
  let time = progress;
  for (let index = 0; index < 5; index += 1) {
    const derivative = sampleCubicBezierDerivative(time, x1, x2);
    if (Math.abs(derivative) < 0.0001) break;
    time = MathUtils.clamp(time - (sampleCubicBezier(time, x1, x2) - progress) / derivative, 0, 1);
  }
  return sampleCubicBezier(time, y1, y2);
}

const cameraMoveEase = (progress: number) => cubicBezierProgress(progress, 0.77, 0, 0.175, 1);
const cameraZoomEase = (progress: number) => cubicBezierProgress(progress, 0.23, 1, 0.32, 1);

const SEVEN_SEGMENT_DIGITS: Record<number, Array<'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'>> = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'c', 'd', 'g'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'c', 'd'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g'],
};

const DIGIT_SEGMENTS = {
  a: { position: [0, 0.034, 0] as [number, number, number], size: [0.042, 0.008, 0.006] as [number, number, number] },
  b: { position: [0.024, 0.018, 0] as [number, number, number], size: [0.008, 0.027, 0.006] as [number, number, number] },
  c: { position: [0.024, -0.018, 0] as [number, number, number], size: [0.008, 0.027, 0.006] as [number, number, number] },
  d: { position: [0, -0.034, 0] as [number, number, number], size: [0.042, 0.008, 0.006] as [number, number, number] },
  e: { position: [-0.024, -0.018, 0] as [number, number, number], size: [0.008, 0.027, 0.006] as [number, number, number] },
  f: { position: [-0.024, 0.018, 0] as [number, number, number], size: [0.008, 0.027, 0.006] as [number, number, number] },
  g: { position: [0, 0, 0] as [number, number, number], size: [0.042, 0.008, 0.006] as [number, number, number] },
} as const;

function FreshnessDigit({ count }: { count: number }) {
  const digit = Math.min(9, Math.max(0, count));

  return (
    <group position={[0.135, 0.115, 0.012]}>
      <mesh renderOrder={21}>
        <circleGeometry args={[0.072, 24]} />
        <meshBasicMaterial color="#26394A" transparent opacity={0.92} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh renderOrder={22}>
        <ringGeometry args={[0.062, 0.076, 24]} />
        <meshBasicMaterial color="#F0A43C" depthTest={false} toneMapped={false} />
      </mesh>
      {/* Arthur: NarIyirm
          中文：数字用简单几何段组成，避免在原生 3D 场景里额外加载字体，同时始终跟随冰箱锚点。
          EN: Simple geometry segments form the count without loading a native 3D font, while remaining attached to the fridge anchor. */}
      {SEVEN_SEGMENT_DIGITS[digit].map((segment) => (
        <mesh key={segment} position={DIGIT_SEGMENTS[segment].position} renderOrder={23}>
          <boxGeometry args={DIGIT_SEGMENTS[segment].size} />
          <meshBasicMaterial color="#F8B95A" depthTest={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function PulseMarker({ freshnessCount = 0, position, reduceMotion }: { freshnessCount?: number; position: [number, number, number]; reduceMotion: boolean }) {
  const haloRef = useRef<Mesh>(null);
  const haloMaterialRef = useRef<MeshBasicMaterial>(null);
  const invalidate = useThree((state) => state.invalidate);
  const hasFreshness = freshnessCount > 0;

  useEffect(() => {
    if (!hasFreshness || reduceMotion) return;

    // Arthur: NarIyirm
    // 中文：临期光环只以低频请求画面并直接修改 Three.js 节点，避免让完整厨房持续以满帧渲染。
    // EN: The freshness halo requests low-frequency frames and mutates Three.js nodes directly so the full kitchen does not render continuously at maximum FPS.
    const interval = setInterval(invalidate, 90);
    return () => clearInterval(interval);
  }, [hasFreshness, invalidate, reduceMotion]);

  useFrame(({ clock }) => {
    if (!hasFreshness || reduceMotion) return;
    const pulse = (Math.sin(clock.elapsedTime * 2.25) + 1) / 2;
    haloRef.current?.scale.setScalar(0.94 + pulse * 0.12);
    if (haloMaterialRef.current) haloMaterialRef.current.opacity = 0.46 + pulse * 0.28;
  });

  return (
    <>
      <mesh position={position}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={2.2} />
        <pointLight color="#FFFFFF" intensity={0.45} distance={0.8} />
      </mesh>
      {hasFreshness ? (
        <Billboard position={position} follow>
          <mesh ref={haloRef} renderOrder={20}>
            <ringGeometry args={[0.092, 0.122, 28]} />
            <meshBasicMaterial ref={haloMaterialRef} color="#F0A43C" transparent opacity={0.6} depthTest={false} toneMapped={false} />
          </mesh>
          <FreshnessDigit count={freshnessCount} />
        </Billboard>
      ) : null}
    </>
  );
}

function FeatureHotspot({ freshnessCount, hitboxSize, markerOffset, onPress, reduceMotion }: FeatureHotspotProps) {
  const handlePress = (event: ThreeEvent<MouseEvent>) => {
    // Arthur: NarIyirm
    // 中文：透明热区扩大精细模型的可点击范围，并阻止点击继续穿透到厨房网格。
    // EN: The invisible hitbox enlarges the tap target and prevents the event reaching the kitchen mesh.
    event.stopPropagation();
    onPress();
  };

  return (
    <group>
      <mesh onClick={handlePress}>
        <boxGeometry args={hitboxSize} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>
      <PulseMarker freshnessCount={freshnessCount} position={markerOffset} reduceMotion={reduceMotion} />
    </group>
  );
}

function BurnerFlame({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const groupRef = useRef<Group>(null);
  const lightRef = useRef<PointLight>(null);
  const startedAtRef = useRef<number | null>(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    startedAtRef.current = null;
    if (groupRef.current) groupRef.current.visible = active;
    invalidate();
  }, [active, invalidate]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group || !active) return;

    if (startedAtRef.current === null) startedAtRef.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startedAtRef.current;
    const linearProgress = reduceMotion ? 1 : Math.min(elapsed / 0.24, 1);
    const ignitionProgress = 1 - Math.pow(1 - linearProgress, 3);
    const flicker = reduceMotion ? 1 : 0.94 + Math.sin(clock.elapsedTime * 29) * 0.04 + Math.sin(clock.elapsedTime * 43) * 0.02;

    // Arthur: NarIyirm
    // 中文：火焰只修改 Three.js 节点，并在短暂点火过程请求帧，不触发逐帧 React 状态更新。
    // EN: Mutate only the Three.js node and request frames during the short ignition without per-frame React state.
    group.scale.set(0.88 + ignitionProgress * 0.12, Math.max(0.06, ignitionProgress * flicker), 0.88 + ignitionProgress * 0.12);
    if (lightRef.current) lightRef.current.intensity = ignitionProgress * 0.8 * flicker;
    if (!reduceMotion) invalidate();
  });

  return (
    <group ref={groupRef} position={[0, 0.025, 0]} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[0.10, 0.21, 28]} />
        <meshBasicMaterial color="#36BFFF" transparent opacity={0.58} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      {FLAME_RING.map((flamePosition, index) => (
        <mesh key={index} position={flamePosition}>
          <coneGeometry args={[0.032, 0.17, 7]} />
          <meshBasicMaterial color={index % 2 === 0 ? '#7CF1FF' : '#258BFF'} transparent opacity={0.86} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
      <pointLight ref={lightRef} position={[0, 0.22, 0]} color="#65DFFF" intensity={0} distance={1.25} decay={2} />
    </group>
  );
}

function setEmissiveIntensity(object: Object3D | undefined, intensity: number) {
  object?.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const standardMaterial = material as MeshStandardMaterial;
      if ('emissiveIntensity' in standardMaterial) standardMaterial.emissiveIntensity = intensity;
    });
  });
}

function KitchenModel({
  activeInteraction,
  effectInteraction,
  expiringCount,
  lighting,
  onReady,
  onSelectFeature,
  reduceMotion,
}: {
  activeInteraction: KitchenInteraction;
  effectInteraction: KitchenInteraction;
  expiringCount: number;
  lighting: KitchenLightingState;
  onReady?: () => void;
  onSelectFeature: (feature: KitchenFeature) => void;
  reduceMotion: boolean;
}) {
  const { scene, animations } = useGLTF(KITCHEN_MODEL_ASSET) as LoadedKitchen;
  const { actions, mixer } = useAnimations(animations, scene);
  const hasPresentedFirstFrame = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  const anchors = useMemo(() => ({
    burners: BURNER_ANCHORS.map((name) => scene.getObjectByName(name)).filter((anchor): anchor is Object3D => Boolean(anchor)),
    ceilingLight: scene.getObjectByName('Ceiling_Light_Anchor'),
    fridgeLight: scene.getObjectByName('Fridge_Light_Anchor'),
    fridgeHotspot: scene.getObjectByName('Hotspot_Fridge'),
    stoveHotspot: scene.getObjectByName('Hotspot_Stove'),
    recipesHotspot: scene.getObjectByName('Hotspot_Recipes'),
  }), [scene]);

  useLayoutEffect(() => {
    // Arthur: NarIyirm
    // 中文：灯泡材质跟随时间和开门状态变化，真实点光源则挂在模型锚点上，旋转视角不会产生漂移。
    // EN: Bulb materials follow time and door state while real lights live on model anchors, preventing drift after rotation.
    setEmissiveIntensity(scene.getObjectByName('Ceiling_Lamp_Bulb'), 0.08 + lighting.ceilingIntensity * 0.35);
    setEmissiveIntensity(scene.getObjectByName('Fridge_Lamp'), effectInteraction === 'fridge' ? 2.5 : 0.05);
    invalidate();
  }, [effectInteraction, invalidate, lighting.ceilingIntensity, scene]);

  useEffect(() => {
    const doorPivot = scene.getObjectByName('Fridge_Door_Pivot');
    const doorAction = actions.Fridge_Door_Open;

    if (effectInteraction === 'fridge' && doorAction) {
      doorAction.reset();
      doorAction.setLoop(LoopOnce, 1);
      doorAction.clampWhenFinished = true;
      doorAction.timeScale = 1.35;
      doorAction.play();

      if (reduceMotion) {
        doorAction.time = doorAction.getClip().duration;
        doorAction.paused = true;
        mixer.update(0);
      }
      invalidate();
    }

    return () => {
      doorAction?.stop();
      if (doorPivot) {
        // Arthur: NarIyirm
        // 中文：卸载时把缓存模型的门恢复关闭，返回首页不会保留上一次开门姿态。
        // EN: Close the cached model door on unmount so returning home never keeps the previous pose.
        doorPivot.quaternion.identity();
        doorPivot.updateMatrixWorld(true);
      }
    };
  }, [actions.Fridge_Door_Open, effectInteraction, invalidate, mixer, reduceMotion, scene]);

  useFrame(() => {
    if (effectInteraction === 'fridge' && !reduceMotion) invalidate();
    if (hasPresentedFirstFrame.current || !onReady) return;

    // Arthur: NarIyirm
    // 中文：模型参与首帧绘制后再通知 App，下一显示帧才移除开场层，避免露出空画布。
    // EN: Notify the app after the model joins its first render, then remove the opener on the next display frame.
    hasPresentedFirstFrame.current = true;
    requestAnimationFrame(onReady);
  });

  return (
    <>
      <primitive object={scene} />

      {/* Arthur: NarIyirm
          中文：Portal 把反馈元素变成模型锚点的真实子节点，因此拖拽或旋转相机后仍与部件完全重合。
          EN: Portals make feedback elements true children of model anchors, keeping them aligned after camera rotation. */}
      {anchors.burners.map((anchor) => (
        <Fragment key={anchor.uuid}>
          {createPortal(
            <BurnerFlame active={effectInteraction === 'stove'} reduceMotion={reduceMotion} />,
            anchor,
          )}
        </Fragment>
      ))}
      {anchors.ceilingLight ? createPortal(
        <pointLight color="#FFD08A" intensity={lighting.ceilingIntensity} distance={7.2} decay={2} />,
        anchors.ceilingLight,
      ) : null}
      {anchors.fridgeLight ? createPortal(
        <pointLight color="#FFF1C4" intensity={effectInteraction === 'fridge' ? 2.4 : 0} distance={2.1} decay={2} />,
        anchors.fridgeLight,
      ) : null}
      {activeInteraction === null && anchors.fridgeHotspot ? createPortal(
          <FeatureHotspot freshnessCount={expiringCount} hitboxSize={[1.45, 2.5, 1.0]} markerOffset={[0, 1.18, 0]} onPress={() => onSelectFeature('fridge')} reduceMotion={reduceMotion} />,
          anchors.fridgeHotspot,
        ) : null}
      {activeInteraction === null && anchors.stoveHotspot ? createPortal(
          <FeatureHotspot hitboxSize={[1.35, 1.45, 1.0]} markerOffset={[0, 0.86, 0]} onPress={() => onSelectFeature('stove')} reduceMotion={reduceMotion} />,
          anchors.stoveHotspot,
        ) : null}
      {activeInteraction === null && anchors.recipesHotspot ? createPortal(
          <FeatureHotspot hitboxSize={[1.8, 1.25, 1.35]} markerOffset={[0, 0.76, 0]} onPress={() => onSelectFeature('recipes')} reduceMotion={reduceMotion} />,
          anchors.recipesHotspot,
        ) : null}
    </>
  );
}

function KitchenCameraControls({
  activeInteraction,
  onEffectCue,
  onExplore,
  onFocusComplete,
  reduceMotion,
}: {
  activeInteraction: KitchenInteraction;
  onEffectCue: (feature: Exclude<KitchenInteraction, null>) => void;
  onExplore?: () => void;
  onFocusComplete: (feature: Exclude<KitchenInteraction, null>) => void;
  reduceMotion: boolean;
}) {
  const { scene } = useGLTF(KITCHEN_MODEL_ASSET) as LoadedKitchen;
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraMotionRef = useRef<CameraMotion | null>(null);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const canvasWidth = useThree((state) => state.size.width);
  const canvasHeight = useThree((state) => state.size.height);

  useLayoutEffect(() => {
    // Arthur: NarIyirm
    // 中文：画布尺寸变化时重设完整厨房视角，保证墙体、地板和三个主要组件同时可见。
    // EN: Reset the full-kitchen view after a canvas resize so walls, floor, and all main components stay visible.
    camera.position.set(...INITIAL_CAMERA_POSITION);
    camera.up.set(0, 1, 0);
    controlsRef.current?.target.set(...CAMERA_TARGET);
    controlsRef.current?.update();
    camera.lookAt(...CAMERA_TARGET);
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, canvasHeight, canvasWidth, invalidate]);

  useEffect(() => {
    if (!activeInteraction) {
      cameraMotionRef.current = null;
      return;
    }

    if (reduceMotion) {
      onEffectCue(activeInteraction);
      const timer = setTimeout(() => onFocusComplete(activeInteraction), REDUCED_MOTION_DELAY);
      return () => clearTimeout(timer);
    }

    const focus = CAMERA_FOCUS[activeInteraction];
    const anchor = scene.getObjectByName(focus.anchorName);
    if (!anchor) {
      onEffectCue(activeInteraction);
      onFocusComplete(activeInteraction);
      return;
    }

    scene.updateMatrixWorld(true);
    const startTarget = controlsRef.current?.target.clone() ?? new Vector3(...CAMERA_TARGET);
    const endTarget = anchor.getWorldPosition(new Vector3()).add(new Vector3(...focus.targetOffset));
    const startSpherical = new Spherical().setFromVector3(camera.position.clone().sub(startTarget));
    const endSpherical = new Spherical().setFromVector3(new Vector3(...focus.cameraOffset));
    let thetaDelta = endSpherical.theta - startSpherical.theta;
    if (thetaDelta > Math.PI) thetaDelta -= Math.PI * 2;
    if (thetaDelta < -Math.PI) thetaDelta += Math.PI * 2;

    // Arthur: NarIyirm
    // 中文：从用户当前拖拽视角捕获球坐标，沿最短旋转方向移向目标，再延后推进形成“先对准、后聚焦”的镜头节奏。
    // EN: Capture the user's current orbit, rotate by the shortest arc, then delay the push-in for an aim-then-focus rhythm.
    cameraMotionRef.current = {
      currentOffset: new Vector3(),
      currentSpherical: new Spherical(),
      currentTarget: new Vector3(),
      duration: focus.duration,
      endSpherical,
      endTarget,
      feature: activeInteraction,
      hasCuedEffect: false,
      startSpherical,
      startedAt: null,
      startTarget,
      thetaDelta,
    };
    invalidate();
  }, [activeInteraction, camera, invalidate, onEffectCue, onFocusComplete, reduceMotion, scene]);

  useFrame(({ clock }) => {
    const motion = cameraMotionRef.current;
    if (!motion) return;
    if (motion.startedAt === null) motion.startedAt = clock.elapsedTime;

    const progress = MathUtils.clamp(((clock.elapsedTime - motion.startedAt) * 1000) / motion.duration, 0, 1);
    const moveProgress = cameraMoveEase(progress);
    const zoomStart = EFFECT_CUE_PROGRESS * 0.58;
    const zoomProgress = cameraZoomEase(MathUtils.clamp((progress - zoomStart) / (1 - zoomStart), 0, 1));

    if (!motion.hasCuedEffect && progress >= EFFECT_CUE_PROGRESS) {
      motion.hasCuedEffect = true;
      onEffectCue(motion.feature);
    }

    motion.currentTarget.lerpVectors(motion.startTarget, motion.endTarget, moveProgress);
    motion.currentSpherical.set(
      MathUtils.lerp(motion.startSpherical.radius, motion.endSpherical.radius, zoomProgress),
      MathUtils.lerp(motion.startSpherical.phi, motion.endSpherical.phi, moveProgress),
      motion.startSpherical.theta + motion.thetaDelta * moveProgress,
    );
    motion.currentOffset.setFromSpherical(motion.currentSpherical);
    camera.position.copy(motion.currentTarget).add(motion.currentOffset);
    camera.lookAt(motion.currentTarget);
    camera.updateMatrixWorld();
    controlsRef.current?.target.copy(motion.currentTarget);

    if (progress < 1) {
      invalidate();
      return;
    }

    if (!motion.hasCuedEffect) onEffectCue(motion.feature);
    cameraMotionRef.current = null;
    onFocusComplete(motion.feature);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={activeInteraction === null}
      enablePan={false}
      enableDamping={activeInteraction === null}
      dampingFactor={0.12}
      minDistance={16}
      maxDistance={31}
      minPolarAngle={0.62}
      maxPolarAngle={1.28}
      minAzimuthAngle={-0.95}
      maxAzimuthAngle={0.95}
      target={CAMERA_TARGET}
      onStart={onExplore}
    />
  );
}

function KitchenScene({ activeInteraction, effectInteraction, expiringCount, lighting, onEffectCue, onExplore, onFocusComplete, onReady, onSelectFeature, reduceMotion }: KitchenSceneProps) {
  return (
    <>
      <KitchenTimeEnvironment lighting={lighting} />

      <Suspense fallback={null}>
        <KitchenModel
          activeInteraction={activeInteraction}
          effectInteraction={effectInteraction}
          expiringCount={expiringCount}
          lighting={lighting}
          onReady={onReady}
          onSelectFeature={onSelectFeature}
          reduceMotion={reduceMotion}
        />
        <KitchenCameraControls
          activeInteraction={activeInteraction}
          onEffectCue={onEffectCue}
          onExplore={onExplore}
          onFocusComplete={onFocusComplete}
          reduceMotion={reduceMotion}
        />
      </Suspense>
    </>
  );
}

export function Kitchen3DPrototype({ expiringCount = 0, lighting, onExplore, onInteractionStart, onNavigate, onReady }: Kitchen3DPrototypeProps) {
  const { active: isLoading, progress } = useProgress();
  const [activeInteraction, setActiveInteraction] = useState<KitchenInteraction>(null);
  const [effectInteraction, setEffectInteraction] = useState<KitchenInteraction>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const interactionRef = useRef<KitchenInteraction>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectFeature = useCallback((feature: KitchenFeature) => {
    if (interactionRef.current) return;

    // Arthur: NarIyirm
    // 中文：三个厨房入口统一先锁住输入并隐藏导航栏，再由镜头完成聚焦后决定目标页面。
    // EN: All three kitchen entries lock input and hide chrome before camera focus decides the destination screen.
    interactionRef.current = feature;
    onInteractionStart?.();
    setActiveInteraction(feature);
  }, [onInteractionStart]);

  const handleEffectCue = useCallback((feature: Exclude<KitchenInteraction, null>) => {
    if (interactionRef.current === feature) setEffectInteraction(feature);
  }, []);

  const handleFocusComplete = useCallback((feature: Exclude<KitchenInteraction, null>) => {
    if (interactionRef.current !== feature) return;
    onNavigate(feature === 'fridge' ? 'fridge' : feature === 'stove' ? 'ingredients' : 'recipes');
  }, [onNavigate]);

  return (
    <View style={styles.container} accessibilityLabel="可旋转的三维厨房，点击冰箱、灶台或餐桌进入对应页面">
      {/* Arthur: NarIyirm
          中文：新 GLB 使用真实米制大小和中心原点，不再通过补偿缩放与偏移猜测画面位置。
          EN: The rebuilt GLB uses real scale and a centered origin, removing guessed scale and position compensation. */}
      <Canvas
        frameloop="demand"
        camera={{ position: INITIAL_CAMERA_POSITION, fov: 42, near: 0.1, far: 100 }}
        gl={{ antialias: false, alpha: false }}
      >
        <KitchenScene
          activeInteraction={activeInteraction}
          effectInteraction={effectInteraction}
          expiringCount={expiringCount}
          lighting={lighting}
          onEffectCue={handleEffectCue}
          onExplore={onExplore}
          onFocusComplete={handleFocusComplete}
          onReady={onReady}
          onSelectFeature={handleSelectFeature}
          reduceMotion={reduceMotion}
        />
      </Canvas>
      {isLoading ? (
        // Arthur: NarIyirm
        // 中文：本地 GLB 仍需从安装包解压并由 GPU 解析，这里只显示真实的设备端解析进度。
        // EN: The local GLB still needs package extraction and GPU parsing, so this shows only real on-device progress.
        <KitchenLoading label={`正在解析厨房 ${Math.round(progress)}%`} backgroundColor={lighting.background} />
      ) : null}
    </View>
  );
}

function KitchenLoading({ label, backgroundColor }: { label: string; backgroundColor: string }) {
  return (
    <View style={[styles.loadingOverlay, { backgroundColor }]} pointerEvents="none">
      <ActivityIndicator size="small" color="#D47B21" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#46645D', fontSize: 13, fontWeight: '600' },
});
