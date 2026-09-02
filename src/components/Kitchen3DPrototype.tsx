import { Ionicons } from '@expo/vector-icons';
import { Billboard, OrbitControls, useAnimations, useGLTF, useProgress } from '@react-three/drei/native';
import { Canvas, createPortal, type ThreeEvent, useFrame, useThree } from '@react-three/fiber/native';
import { Fragment, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useI18n } from '../i18n';
import type { AppTab } from './FloatingTabBar';
import { FridgeMemoryMagnet, TodayRecipeScene, WindowRain, type KitchenWeather } from './KitchenAmbientDetails';
import { KitchenMailbox, KITCHEN_MAILBOX_POSITION, KITCHEN_MAILBOX_ROTATION } from './KitchenMailbox';
import { KitchenShoppingCart, SHOPPING_CART_POSITION } from './KitchenShoppingCart';
import {
  KitchenTimeEnvironment,
  type KitchenLightingState,
} from './KitchenTimeLighting';

type Kitchen3DPrototypeProps = {
  expiringCount?: number;
  inventoryFillRatio?: number;
  lighting: KitchenLightingState;
  onExplore?: () => void;
  onInteractionStart?: () => void;
  onNavigate: (tab: AppTab) => void;
  onReady?: () => void;
  unreadNotificationCount?: number;
  weather?: KitchenWeather;
};

type FeatureHotspotProps = {
  hasStatus?: boolean;
  hitboxSize: [number, number, number];
  markerOffset: [number, number, number];
  onPress: () => void;
  reduceMotion: boolean;
  selected?: boolean;
};

type KitchenFeature = 'fridge' | 'stove' | 'recipes' | 'shopping' | 'mailbox';
type KitchenNavigationFeature = Extract<KitchenFeature, 'fridge' | 'shopping' | 'mailbox'>;
type KitchenInteraction = KitchenNavigationFeature | null;
type LoadedKitchen = { scene: Object3D; animations: AnimationClip[] };
type CameraFocusConfig = {
  anchorName?: string;
  cameraOffset: [number, number, number];
  duration: number;
  targetOffset: [number, number, number];
  worldPosition?: [number, number, number];
};
type CameraMotion = {
  currentOffset: Vector3;
  currentSpherical: Spherical;
  currentTarget: Vector3;
  duration: number;
  endSpherical: Spherical;
  endTarget: Vector3;
  feature: KitchenNavigationFeature | null;
  hasCuedEffect: boolean;
  startSpherical: Spherical;
  startedAt: number | null;
  startTarget: Vector3;
  thetaDelta: number;
};
type KitchenSceneProps = {
  activeInteraction: KitchenInteraction;
  cameraResetRequest: number;
  effectInteraction: KitchenInteraction;
  expiringCount: number;
  inventoryFillRatio: number;
  isRecipeBookOpen: boolean;
  isStoveLit: boolean;
  lighting: KitchenLightingState;
  onEffectCue: (feature: KitchenNavigationFeature) => void;
  onCameraActivity: () => void;
  onCameraChanged: () => void;
  onCameraResetComplete: () => void;
  onExplore?: () => void;
  onFocusComplete: (feature: KitchenNavigationFeature) => void;
  onReady?: () => void;
  onSelectFeature: (feature: KitchenFeature) => void;
  pressedFeature: KitchenFeature | null;
  reduceMotion: boolean;
  isResettingCamera: boolean;
  unreadNotificationCount: number;
  weather: KitchenWeather;
};

const CAMERA_TARGET: [number, number, number] = [0, 1.3, 0];
const INITIAL_CAMERA_POSITION: [number, number, number] = [10.8, 8.8, 16.6];
const REDUCED_MOTION_DELAY = 180;
const EFFECT_CUE_PROGRESS = 0.32;
const CAMERA_IDLE_RESET_DELAY = 12_000;
const CAMERA_FOCUS: Record<KitchenNavigationFeature, CameraFocusConfig> = {
  fridge: {
    anchorName: 'Hotspot_Fridge',
    cameraOffset: [0, 1.15, 5.65] as [number, number, number],
    targetOffset: [0, 0.12, 0] as [number, number, number],
    duration: 1320,
  },
  shopping: {
    worldPosition: SHOPPING_CART_POSITION,
    cameraOffset: [-1.45, 1.72, 4.12],
    targetOffset: [0, 0.62, 0],
    duration: 1120,
  },
  mailbox: {
    worldPosition: KITCHEN_MAILBOX_POSITION,
    cameraOffset: [4.25, 0.82, 0],
    targetOffset: [0, 0.16, 0],
    duration: 1320,
  },
};
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

function PulseMarker({ hasStatus = false, position, reduceMotion, selected = false }: { hasStatus?: boolean; position: [number, number, number]; reduceMotion: boolean; selected?: boolean }) {
  const markerRef = useRef<Group>(null);
  const whiteMaterialRef = useRef<MeshBasicMaterial>(null);
  const alertMaterialRef = useRef<MeshBasicMaterial>(null);
  const lightRef = useRef<PointLight>(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => invalidate(), [hasStatus, invalidate, selected]);

  useFrame(({ clock }, delta) => {
    const marker = markerRef.current;
    if (!marker) return;

    const breathing = reduceMotion ? 1 : 0.92 + ((Math.sin(clock.elapsedTime * 2.1) + 1) / 2) * 0.14;
    const blinking = reduceMotion ? 1 : 0.38 + ((Math.sin(clock.elapsedTime * 5.4) + 1) / 2) * 0.62;
    const alertCycle = clock.elapsedTime % 2.8;
    const alertJump = !reduceMotion && hasStatus && alertCycle < 0.58
      ? Math.sin((alertCycle / 0.58) * Math.PI) * 0.13
      : 0;
    const targetScale = selected ? 0.04 : breathing;
    const nextScale = MathUtils.damp(marker.scale.x, targetScale, selected ? 18 : 8, Math.min(delta, 0.05));
    marker.scale.setScalar(nextScale);
    marker.position.y = alertJump;

    if (whiteMaterialRef.current) whiteMaterialRef.current.opacity = selected ? Math.max(0, nextScale - 0.04) : 0.9;
    if (alertMaterialRef.current) alertMaterialRef.current.opacity = selected ? Math.max(0, nextScale - 0.04) : blinking;
    if (lightRef.current) lightRef.current.intensity = selected ? 0 : hasStatus ? (0.58 + alertJump * 2.4) * blinking : 0.34 * breathing;
    if ((!reduceMotion && hasStatus) || Math.abs(nextScale - targetScale) > 0.01) invalidate();
  });

  return (
    <Billboard position={position} follow>
      <group ref={markerRef}>
        {hasStatus ? (
          <>
            {/* Arthur: NarIyirm
                中文：有事件时用无数字的竖向琥珀灯取代白点，闪烁只表达“值得查看”。
                EN: A number-free vertical amber lamp replaces the white dot for events; its blink communicates only that something needs attention. */}
            <mesh position={[0, 0.035, 0]} renderOrder={20}>
              <capsuleGeometry args={[0.045, 0.12, 6, 14]} />
              <meshBasicMaterial ref={alertMaterialRef} color="#FFC24F" transparent opacity={1} depthTest={false} toneMapped={false} />
            </mesh>
            <mesh position={[0, -0.085, 0]} renderOrder={20}>
              <sphereGeometry args={[0.038, 14, 14]} />
              <meshBasicMaterial color="#A86822" depthTest={false} toneMapped={false} />
            </mesh>
          </>
        ) : (
          <mesh renderOrder={20}>
            <sphereGeometry args={[0.075, 18, 18]} />
            <meshBasicMaterial ref={whiteMaterialRef} color="#FFFFFF" transparent opacity={0.9} depthTest={false} toneMapped={false} />
          </mesh>
        )}
        <pointLight ref={lightRef} color={hasStatus ? '#FFC24F' : '#FFFFFF'} intensity={0.4} distance={0.85} />
      </group>
    </Billboard>
  );
}

function FeatureHotspot({ hasStatus, hitboxSize, markerOffset, onPress, reduceMotion, selected }: FeatureHotspotProps) {
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
      <PulseMarker hasStatus={hasStatus} position={markerOffset} reduceMotion={reduceMotion} selected={selected} />
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
    if (!reduceMotion && linearProgress < 1) invalidate();
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
  inventoryFillRatio,
  isRecipeBookOpen,
  isStoveLit,
  lighting,
  onReady,
  onSelectFeature,
  pressedFeature,
  reduceMotion,
  unreadNotificationCount,
  weather,
}: {
  activeInteraction: KitchenInteraction;
  effectInteraction: KitchenInteraction;
  expiringCount: number;
  inventoryFillRatio: number;
  isRecipeBookOpen: boolean;
  isStoveLit: boolean;
  lighting: KitchenLightingState;
  onReady?: () => void;
  onSelectFeature: (feature: KitchenFeature) => void;
  pressedFeature: KitchenFeature | null;
  reduceMotion: boolean;
  unreadNotificationCount: number;
  weather: KitchenWeather;
}) {
  const { scene, animations } = useGLTF(KITCHEN_MODEL_ASSET) as LoadedKitchen;
  const { actions, mixer } = useAnimations(animations, scene);
  const hasPresentedFirstFrame = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  const anchors = useMemo(() => ({
    burners: BURNER_ANCHORS.map((name) => scene.getObjectByName(name)).filter((anchor): anchor is Object3D => Boolean(anchor)),
    ceilingLight: scene.getObjectByName('Ceiling_Light_Anchor'),
    fridgeDoor: scene.getObjectByName('Fridge_Door_Pivot'),
    fridgeLight: scene.getObjectByName('Fridge_Light_Anchor'),
    fridgeHotspot: scene.getObjectByName('Hotspot_Fridge'),
    recipesHotspot: scene.getObjectByName('Hotspot_Recipes'),
    stoveHotspot: scene.getObjectByName('Hotspot_Stove'),
    windowLight: scene.getObjectByName('Window_Light_Anchor'),
  }), [scene]);

  useLayoutEffect(() => {
    const closedRecipeBook = scene.getObjectByName('Recipe_Book');
    if (!closedRecipeBook) return;

    // Arthur: NarIyirm
    // 中文：隐藏模型里不可动的旧书，在同一个餐桌锚点放置可翻页菜谱，避免两本书重叠。
    // EN: Hide the model's static book and place the animated recipe at the same table anchor to prevent overlap.
    const previousVisibility = closedRecipeBook.visible;
    closedRecipeBook.visible = false;
    invalidate();
    return () => {
      closedRecipeBook.visible = previousVisibility;
    };
  }, [invalidate, scene]);

  useEffect(() => {
    if (reduceMotion) {
      invalidate();
      return;
    }

    // Arthur: NarIyirm
    // 中文：一个低频刷新器共同驱动雨滴、蒸汽、火焰和呼吸提示，避免每个装饰各自创建渲染循环。
    // EN: One low-frequency invalidation loop drives rain, steam, flame, and pulse cues instead of giving every detail its own render loop.
    const interval = setInterval(invalidate, 90);
    return () => clearInterval(interval);
  }, [invalidate, reduceMotion]);

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
          中文：Portal 把动效和生活细节变成模型锚点的真实子节点，转动镜头或打开冰箱门后仍会留在正确位置。
          EN: Portals make motion and lived-in details true children of model anchors, keeping them aligned after camera rotation or door movement. */}
      {weather === 'rain' && anchors.windowLight ? createPortal(
        <WindowRain reduceMotion={reduceMotion} />,
        anchors.windowLight,
      ) : null}
      {anchors.recipesHotspot ? createPortal(
        <TodayRecipeScene isBookOpen={isRecipeBookOpen} reduceMotion={reduceMotion} />,
        anchors.recipesHotspot,
      ) : null}
      {anchors.fridgeDoor ? createPortal(
        <FridgeMemoryMagnet />,
        anchors.fridgeDoor,
      ) : null}
      <group position={SHOPPING_CART_POSITION}>
        <KitchenShoppingCart active={effectInteraction === 'shopping'} inventoryFillRatio={inventoryFillRatio} reduceMotion={reduceMotion} />
        {activeInteraction === null || activeInteraction === 'shopping' ? (
          <group position={[0, 0.65, 0]}>
            <FeatureHotspot hasStatus={inventoryFillRatio < 0.35} hitboxSize={[1.45, 1.3, 1.1]} markerOffset={[0, 0.77, 0]} onPress={() => onSelectFeature('shopping')} reduceMotion={reduceMotion} selected={pressedFeature === 'shopping'} />
          </group>
        ) : null}
      </group>
      <group position={KITCHEN_MAILBOX_POSITION} rotation={KITCHEN_MAILBOX_ROTATION}>
        <KitchenMailbox active={effectInteraction === 'mailbox'} reduceMotion={reduceMotion} unreadCount={unreadNotificationCount} />
        {activeInteraction === null || activeInteraction === 'mailbox' ? (
          <FeatureHotspot
            hasStatus={unreadNotificationCount > 0}
            hitboxSize={[1.05, 1.25, 0.8]}
            markerOffset={[0, 0.76, 0.18]}
            onPress={() => onSelectFeature('mailbox')}
            reduceMotion={reduceMotion}
            selected={pressedFeature === 'mailbox'}
          />
        ) : null}
      </group>
      {anchors.burners.map((anchor) => (
        <Fragment key={anchor.uuid}>
          {createPortal(
            <BurnerFlame active={isStoveLit} reduceMotion={reduceMotion} />,
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
      {(activeInteraction === null || activeInteraction === 'fridge') && anchors.fridgeHotspot ? createPortal(
          <FeatureHotspot hasStatus={expiringCount > 0} hitboxSize={[1.45, 2.5, 1.0]} markerOffset={[0, 1.18, 0]} onPress={() => onSelectFeature('fridge')} reduceMotion={reduceMotion} selected={pressedFeature === 'fridge'} />,
          anchors.fridgeHotspot,
        ) : null}
      {activeInteraction === null && anchors.stoveHotspot ? createPortal(
          <FeatureHotspot hitboxSize={[1.35, 1.45, 1.0]} markerOffset={[0, 0.86, 0]} onPress={() => onSelectFeature('stove')} reduceMotion={reduceMotion} selected={pressedFeature === 'stove'} />,
          anchors.stoveHotspot,
        ) : null}
      {activeInteraction === null && anchors.recipesHotspot ? createPortal(
          <FeatureHotspot hitboxSize={[1.8, 1.25, 1.35]} markerOffset={[0, 0.76, 0]} onPress={() => onSelectFeature('recipes')} reduceMotion={reduceMotion} selected={pressedFeature === 'recipes'} />,
          anchors.recipesHotspot,
        ) : null}
    </>
  );
}

function KitchenCameraControls({
  activeInteraction,
  cameraResetRequest,
  isResettingCamera,
  onCameraActivity,
  onCameraChanged,
  onCameraResetComplete,
  onEffectCue,
  onExplore,
  onFocusComplete,
  reduceMotion,
}: {
  activeInteraction: KitchenInteraction;
  cameraResetRequest: number;
  isResettingCamera: boolean;
  onCameraActivity: () => void;
  onCameraChanged: () => void;
  onCameraResetComplete: () => void;
  onEffectCue: (feature: KitchenNavigationFeature) => void;
  onExplore?: () => void;
  onFocusComplete: (feature: KitchenNavigationFeature) => void;
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
    const anchor = focus.anchorName ? scene.getObjectByName(focus.anchorName) : undefined;
    if (!anchor && !focus.worldPosition) {
      onEffectCue(activeInteraction);
      onFocusComplete(activeInteraction);
      return;
    }

    scene.updateMatrixWorld(true);
    const startTarget = controlsRef.current?.target.clone() ?? new Vector3(...CAMERA_TARGET);
    const focusPosition = anchor
      ? anchor.getWorldPosition(new Vector3())
      : new Vector3(...(focus.worldPosition as [number, number, number]));
    const endTarget = focusPosition.add(new Vector3(...focus.targetOffset));
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

  useEffect(() => {
    if (cameraResetRequest === 0 || activeInteraction) return;

    const startTarget = controlsRef.current?.target.clone() ?? new Vector3(...CAMERA_TARGET);
    const endTarget = new Vector3(...CAMERA_TARGET);
    const startSpherical = new Spherical().setFromVector3(camera.position.clone().sub(startTarget));
    const endSpherical = new Spherical().setFromVector3(new Vector3(...INITIAL_CAMERA_POSITION).sub(endTarget));
    let thetaDelta = endSpherical.theta - startSpherical.theta;
    if (thetaDelta > Math.PI) thetaDelta -= Math.PI * 2;
    if (thetaDelta < -Math.PI) thetaDelta += Math.PI * 2;

    // Arthur: NarIyirm
    // 中文：手动和空闲复位共用同一条球面相机路径，从用户当前视角平滑返回初始全景。
    // EN: Manual and idle resets share one spherical camera path that returns smoothly from the user's current view to the initial overview.
    cameraMotionRef.current = {
      currentOffset: new Vector3(),
      currentSpherical: new Spherical(),
      currentTarget: new Vector3(),
      duration: reduceMotion ? 1 : 760,
      endSpherical,
      endTarget,
      feature: null,
      hasCuedEffect: true,
      startSpherical,
      startedAt: null,
      startTarget,
      thetaDelta,
    };
    invalidate();
  }, [activeInteraction, camera, cameraResetRequest, invalidate, reduceMotion]);

  useFrame(({ clock }) => {
    const motion = cameraMotionRef.current;
    if (!motion) return;
    if (motion.startedAt === null) motion.startedAt = clock.elapsedTime;

    const progress = MathUtils.clamp(((clock.elapsedTime - motion.startedAt) * 1000) / motion.duration, 0, 1);
    const moveProgress = cameraMoveEase(progress);
    const zoomStart = EFFECT_CUE_PROGRESS * 0.58;
    const zoomProgress = cameraZoomEase(MathUtils.clamp((progress - zoomStart) / (1 - zoomStart), 0, 1));

    if (motion.feature && !motion.hasCuedEffect && progress >= EFFECT_CUE_PROGRESS) {
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

    if (motion.feature && !motion.hasCuedEffect) onEffectCue(motion.feature);
    cameraMotionRef.current = null;
    if (motion.feature) onFocusComplete(motion.feature);
    else {
      controlsRef.current?.update();
      onCameraResetComplete();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={activeInteraction === null && !isResettingCamera}
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
      onStart={() => {
        onExplore?.();
        onCameraChanged();
        onCameraActivity();
      }}
      onEnd={onCameraActivity}
    />
  );
}

function KitchenScene({ activeInteraction, cameraResetRequest, effectInteraction, expiringCount, inventoryFillRatio, isRecipeBookOpen, isResettingCamera, isStoveLit, lighting, onCameraActivity, onCameraChanged, onCameraResetComplete, onEffectCue, onExplore, onFocusComplete, onReady, onSelectFeature, pressedFeature, reduceMotion, unreadNotificationCount, weather }: KitchenSceneProps) {
  return (
    <>
      <KitchenTimeEnvironment lighting={lighting} weather={weather} />

      <Suspense fallback={null}>
        <KitchenModel
          activeInteraction={activeInteraction}
          effectInteraction={effectInteraction}
          expiringCount={expiringCount}
          inventoryFillRatio={inventoryFillRatio}
          isRecipeBookOpen={isRecipeBookOpen}
          isStoveLit={isStoveLit}
          lighting={lighting}
          onReady={onReady}
          onSelectFeature={onSelectFeature}
          pressedFeature={pressedFeature}
          reduceMotion={reduceMotion}
          unreadNotificationCount={unreadNotificationCount}
          weather={weather}
        />
        <KitchenCameraControls
          activeInteraction={activeInteraction}
          cameraResetRequest={cameraResetRequest}
          isResettingCamera={isResettingCamera}
          onCameraActivity={onCameraActivity}
          onCameraChanged={onCameraChanged}
          onCameraResetComplete={onCameraResetComplete}
          onEffectCue={onEffectCue}
          onExplore={onExplore}
          onFocusComplete={onFocusComplete}
          reduceMotion={reduceMotion}
        />
      </Suspense>
    </>
  );
}

export function Kitchen3DPrototype({ expiringCount = 0, inventoryFillRatio = 0, lighting, onExplore, onInteractionStart, onNavigate, onReady, unreadNotificationCount = 0, weather = 'clear' }: Kitchen3DPrototypeProps) {
  const { t } = useI18n();
  const { active: isLoading, progress } = useProgress();
  const [activeInteraction, setActiveInteraction] = useState<KitchenInteraction>(null);
  const [effectInteraction, setEffectInteraction] = useState<KitchenInteraction>(null);
  const [isRecipeBookOpen, setIsRecipeBookOpen] = useState(false);
  const [cameraResetRequest, setCameraResetRequest] = useState(0);
  const [cameraActivityVersion, setCameraActivityVersion] = useState(0);
  const [isCameraModified, setIsCameraModified] = useState(false);
  const [isResettingCamera, setIsResettingCamera] = useState(false);
  const [isStoveLit, setIsStoveLit] = useState(false);
  const [pressedFeature, setPressedFeature] = useState<KitchenFeature | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const interactionRef = useRef<KitchenInteraction>(null);
  const markerFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => () => {
    if (markerFeedbackTimerRef.current) clearTimeout(markerFeedbackTimerRef.current);
  }, []);

  const registerCameraActivity = useCallback(() => {
    setCameraActivityVersion((version) => version + 1);
  }, []);

  const handleCameraChanged = useCallback(() => {
    setIsCameraModified(true);
  }, []);

  const requestCameraReset = useCallback(() => {
    if (interactionRef.current || isResettingCamera) return;
    setIsCameraModified(false);
    setIsResettingCamera(true);
    setCameraResetRequest((request) => request + 1);
  }, [isResettingCamera]);

  const handleCameraResetComplete = useCallback(() => {
    setIsResettingCamera(false);
    setIsCameraModified(false);
  }, []);

  useEffect(() => {
    if (!isCameraModified || isResettingCamera || activeInteraction) return;

    // Arthur: NarIyirm
    // 中文：只在用户改变过相机后开始空闲计时，新的拖拽、缩放或点击会重新计时。
    // EN: Idle timing starts only after the camera changes; any new drag, zoom, or tap restarts the countdown.
    const timer = setTimeout(requestCameraReset, CAMERA_IDLE_RESET_DELAY);
    return () => clearTimeout(timer);
  }, [activeInteraction, cameraActivityVersion, isCameraModified, isResettingCamera, requestCameraReset]);

  const handleSelectFeature = useCallback((feature: KitchenFeature) => {
    registerCameraActivity();
    if (markerFeedbackTimerRef.current) clearTimeout(markerFeedbackTimerRef.current);
    setPressedFeature(feature);

    if (feature === 'stove') {
      onExplore?.();
      setIsStoveLit((isLit) => !isLit);
      markerFeedbackTimerRef.current = setTimeout(() => setPressedFeature(null), 240);
      return;
    }

    if (feature === 'recipes') {
      onExplore?.();
      setIsRecipeBookOpen(true);
      markerFeedbackTimerRef.current = setTimeout(() => setPressedFeature(null), 240);
      return;
    }

    if (interactionRef.current) return;

    // Arthur: NarIyirm
    // 中文：冰箱、购物车和信箱会锁住输入并进入镜头导航；灶台与菜谱只更新首页中的本地动效状态。
    // EN: Fridge, cart, and mailbox lock input for camera navigation; stove and recipe update local home-scene effects only.
    interactionRef.current = feature;
    onInteractionStart?.();
    setActiveInteraction(feature);
  }, [onExplore, onInteractionStart, registerCameraActivity]);

  const handleEffectCue = useCallback((feature: KitchenNavigationFeature) => {
    if (interactionRef.current === feature) setEffectInteraction(feature);
  }, []);

  const handleFocusComplete = useCallback((feature: KitchenNavigationFeature) => {
    if (interactionRef.current !== feature) return;
    onNavigate(feature === 'fridge' ? 'fridge' : feature === 'shopping' ? 'shopping' : 'notifications');
  }, [onNavigate]);

  return (
    <View style={styles.container} accessibilityLabel={t.kitchen.accessibility} onTouchStart={registerCameraActivity}>
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
          cameraResetRequest={cameraResetRequest}
          effectInteraction={effectInteraction}
          expiringCount={expiringCount}
          inventoryFillRatio={inventoryFillRatio}
          isRecipeBookOpen={isRecipeBookOpen}
          isResettingCamera={isResettingCamera}
          isStoveLit={isStoveLit}
          lighting={lighting}
          onCameraActivity={registerCameraActivity}
          onCameraChanged={handleCameraChanged}
          onCameraResetComplete={handleCameraResetComplete}
          onEffectCue={handleEffectCue}
          onExplore={onExplore}
          onFocusComplete={handleFocusComplete}
          onReady={onReady}
          onSelectFeature={handleSelectFeature}
          pressedFeature={pressedFeature}
          reduceMotion={reduceMotion}
          unreadNotificationCount={unreadNotificationCount}
          weather={weather}
        />
      </Canvas>
      {isCameraModified && !activeInteraction && !isResettingCamera ? (
        <Pressable
          accessibilityHint={t.kitchen.resetCameraHint}
          accessibilityLabel={t.kitchen.resetCamera}
          accessibilityRole="button"
          hitSlop={8}
          onPress={requestCameraReset}
          pressRetentionOffset={12}
          style={({ pressed }) => [
            styles.resetCameraButton,
            lighting.phase === 'night' ? styles.resetCameraButtonNight : styles.resetCameraButtonDay,
            pressed && styles.resetCameraButtonPressed,
          ]}
        >
          <Ionicons name="locate-outline" size={23} color={lighting.phase === 'night' ? '#F1F4F5' : '#365048'} />
        </Pressable>
      ) : null}
      {isLoading ? (
        // Arthur: NarIyirm
        // 中文：本地 GLB 仍需从安装包解压并由 GPU 解析，这里只显示真实的设备端解析进度。
        // EN: The local GLB still needs package extraction and GPU parsing, so this shows only real on-device progress.
        <KitchenLoading label={t.kitchen.parsing(Math.round(progress))} backgroundColor={lighting.background} />
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
  resetCameraButton: { position: 'absolute', top: 136, right: 24, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 1 },
  resetCameraButtonDay: { borderColor: 'rgba(255,255,255,0.76)', backgroundColor: 'rgba(241,248,246,0.82)' },
  resetCameraButtonNight: { borderColor: 'rgba(226,237,247,0.24)', backgroundColor: 'rgba(47,68,87,0.82)' },
  resetCameraButtonPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  loadingOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#46645D', fontSize: 13, fontWeight: '600' },
});
