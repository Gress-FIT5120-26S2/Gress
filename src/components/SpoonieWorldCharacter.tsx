import { useAnimations, useGLTF } from '@react-three/drei/native';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LoopOnce,
  LoopRepeat,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Group,
  type Object3D,
} from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { SPOONIE_MODEL_ASSET } from '../assets/spoonieModel';
import type { InventoryBatch } from '../services/inventoryApi';

type LoadedSpoonie = { animations: AnimationClip[]; scene: Object3D };
type Destination = 'cart' | 'fridge' | 'recipe';
type CharacterLocation = Destination | 'start';
type DirectorPhase = 'idle' | 'performing' | 'walking';
type Scenario = {
  clip: 'Inspect_Cart' | 'Read_Recipe' | 'Think';
  destination: Destination;
  message: string;
  yaw: number;
};
type DirectorState = {
  clip: Scenario['clip'] | null;
  destination: Destination | null;
  message: string | null;
  phase: DirectorPhase;
  remaining: number;
  route: Vector3[];
  routeIndex: number;
  yaw: number;
};
type SpoonieWorldCharacterProps = {
  activitySignal: number;
  batches: InventoryBatch[];
  language: 'en' | 'zh';
  onOpenAssistant: () => void;
  onSpeechChange: (message: string | null) => void;
  reduceMotion: boolean;
  sceneBusy: boolean;
};

const START_POSITION = new Vector3(-1.12, 0.01, 1.68);
const WALK_SPEED = 0.72;
const AUTO_ACTION_DELAY = 15_000;
const SAFE_ROUTE_POINTS = {
  cart: [1.05, 0.01, 1.62],
  frontRight: [1.16, 0.01, 1.68],
  fridge: [0.98, 0.01, -0.76],
  recipe: [-0.15, 0.01, 1.68],
  rightAisle: [1.18, 0.01, 0.18],
} satisfies Record<string, [number, number, number]>;

const SAFE_ROUTES: Record<CharacterLocation, Record<Destination, Array<[number, number, number]>>> = {
  start: {
    cart: [SAFE_ROUTE_POINTS.frontRight, SAFE_ROUTE_POINTS.cart],
    fridge: [SAFE_ROUTE_POINTS.frontRight, SAFE_ROUTE_POINTS.rightAisle, SAFE_ROUTE_POINTS.fridge],
    recipe: [SAFE_ROUTE_POINTS.recipe],
  },
  cart: {
    cart: [SAFE_ROUTE_POINTS.cart],
    fridge: [SAFE_ROUTE_POINTS.frontRight, SAFE_ROUTE_POINTS.rightAisle, SAFE_ROUTE_POINTS.fridge],
    recipe: [SAFE_ROUTE_POINTS.frontRight, SAFE_ROUTE_POINTS.recipe],
  },
  fridge: {
    cart: [SAFE_ROUTE_POINTS.rightAisle, SAFE_ROUTE_POINTS.frontRight, SAFE_ROUTE_POINTS.cart],
    fridge: [SAFE_ROUTE_POINTS.fridge],
    recipe: [SAFE_ROUTE_POINTS.rightAisle, SAFE_ROUTE_POINTS.frontRight, SAFE_ROUTE_POINTS.recipe],
  },
  recipe: {
    cart: [SAFE_ROUTE_POINTS.frontRight, SAFE_ROUTE_POINTS.cart],
    fridge: [SAFE_ROUTE_POINTS.frontRight, SAFE_ROUTE_POINTS.rightAisle, SAFE_ROUTE_POINTS.fridge],
    recipe: [SAFE_ROUTE_POINTS.recipe],
  },
};

function daysUntil(date: string | null) {
  if (!date) return Number.POSITIVE_INFINITY;
  const milliseconds = new Date(date).getTime() - Date.now();
  return Number.isFinite(milliseconds) ? Math.ceil(milliseconds / 86_400_000) : Number.POSITIVE_INFINITY;
}

function buildScenarios(batches: InventoryBatch[], language: 'en' | 'zh'): Scenario[] {
  const expiring = batches
    .filter((batch) => daysUntil(batch.expiresAt) >= 0 && daysUntil(batch.expiresAt) <= 3)
    .sort((left, right) => daysUntil(left.expiresAt) - daysUntil(right.expiresAt))[0];
  const restock = batches.find((batch) => batch.needsRestock);
  const scenarios: Scenario[] = [];

  if (expiring) {
    const days = daysUntil(expiring.expiresAt);
    scenarios.push({
      clip: 'Think', destination: 'fridge', yaw: Math.PI,
      message: language === 'zh'
        ? `${expiring.name}${days === 0 ? '今天到期，要先用掉哦。' : `还有 ${days} 天，记得先用。`}`
        : `${expiring.name} ${days === 0 ? 'expires today—use it first.' : `has ${days} day${days === 1 ? '' : 's'} left.`}`,
    });
  }
  if (restock) {
    scenarios.push({
      clip: 'Inspect_Cart', destination: 'cart', yaw: Math.PI / 2,
      message: language === 'zh' ? `${restock.name}不多啦，记得补货。` : `We are low on ${restock.name}. Time to restock.`,
    });
  }
  scenarios.push({
    clip: 'Read_Recipe', destination: 'recipe', yaw: Math.PI,
    message: language === 'zh' ? '让我翻翻食谱，看看今天先用什么。' : 'Let me check what we can use first today.',
  });
  return scenarios;
}

// Arthur: NarIyirm
// 中文：角色导演只在片段边界更新 React 状态；行走、转向和骨骼播放全部留在 Three 帧循环中，避免移动时重渲染界面。
// EN: The character director touches React state only at clip boundaries; walking, turning, and skeletal playback stay in Three's frame loop to avoid UI rerenders in motion.
export function SpoonieWorldCharacter({ activitySignal, batches, language, onOpenAssistant, onSpeechChange, reduceMotion, sceneBusy }: SpoonieWorldCharacterProps) {
  const { animations, scene } = useGLTF(SPOONIE_MODEL_ASSET) as LoadedSpoonie;
  // Arthur: NarIyirm
  // 中文：蒙皮角色必须连同骨架绑定关系一起克隆；普通 Object3D.clone 会让部分设备上的骨骼引用仍指向缓存原件。
  // EN: Clone the skinned character with its skeleton bindings; Object3D.clone can leave bone references pointing at the cached source on some devices.
  const characterScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const characterRef = useRef<Group>(null);
  const { actions } = useAnimations(animations, characterScene);
  const invalidate = useThree((state) => state.invalidate);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const scenarioIndexRef = useRef(0);
  const currentLocationRef = useRef<CharacterLocation>('start');
  const [cycleVersion, setCycleVersion] = useState(0);
  const directorRef = useRef<DirectorState>({
    clip: null, destination: null, message: null, phase: 'idle', remaining: 0, route: [], routeIndex: 0, yaw: 0,
  });

  const playAction = useCallback((name: string, repeat: boolean) => {
    const next = actions[name];
    if (!next || currentActionRef.current === next) return;
    const previous = currentActionRef.current;
    next.reset();
    next.enabled = true;
    next.clampWhenFinished = !repeat;
    next.setLoop(repeat ? LoopRepeat : LoopOnce, repeat ? Number.POSITIVE_INFINITY : 1);
    next.fadeIn(0.2).play();
    previous?.fadeOut(0.18);
    currentActionRef.current = next;
    invalidate();
  }, [actions, invalidate]);

  const stopScenario = useCallback(() => {
    directorRef.current = { clip: null, destination: null, message: null, phase: 'idle', remaining: 0, route: [], routeIndex: 0, yaw: 0 };
    onSpeechChange(null);
    playAction('Idle_Breathe', true);
  }, [onSpeechChange, playAction]);

  useEffect(() => {
    playAction('Idle_Breathe', true);
    return () => {
      currentActionRef.current?.stop();
      currentActionRef.current = null;
    };
  }, [playAction]);

  useEffect(() => {
    if (directorRef.current.phase !== 'idle') stopScenario();
  }, [activitySignal, sceneBusy, stopScenario]);

  const beginScenario = useCallback(() => {
    if (reduceMotion || sceneBusy || !characterRef.current || directorRef.current.phase !== 'idle') return;
    const scenarios = buildScenarios(batches, language);
    const scenario = scenarios[scenarioIndexRef.current % scenarios.length];
    scenarioIndexRef.current += 1;
    directorRef.current = {
      clip: scenario.clip,
      destination: scenario.destination,
      message: scenario.message,
      phase: 'walking',
      remaining: 0,
      // Arthur: NarIyirm
      // 中文：路线沿餐桌外侧和右侧通道行走，并按角色当前区域选路；不再从一个目标点直穿家具去下一个目标点。
      // EN: Routes follow the dining-table perimeter and right aisle based on the character's current zone, instead of cutting straight through furniture between destinations.
      route: SAFE_ROUTES[currentLocationRef.current][scenario.destination].map((point) => new Vector3(...point)),
      routeIndex: 0,
      yaw: scenario.yaw,
    };
    onSpeechChange(null);
    playAction('Walk', true);
    invalidate();
  }, [batches, invalidate, language, onSpeechChange, playAction, reduceMotion, sceneBusy]);

  useEffect(() => {
    if (reduceMotion || sceneBusy) return undefined;
    const timer = setTimeout(beginScenario, AUTO_ACTION_DELAY + (cycleVersion % 3) * 2_000);
    return () => clearTimeout(timer);
  }, [activitySignal, beginScenario, cycleVersion, reduceMotion, sceneBusy]);

  useFrame((_, delta) => {
    const character = characterRef.current;
    const director = directorRef.current;
    if (!character || director.phase === 'idle') return;

    if (director.phase === 'walking') {
      const target = director.route[director.routeIndex];
      const offset = target.clone().sub(character.position);
      offset.y = 0;
      const distance = offset.length();
      const step = WALK_SPEED * Math.min(delta, 0.05);
      const desiredYaw = Math.atan2(offset.x, offset.z);
      const yawDelta = Math.atan2(Math.sin(desiredYaw - character.rotation.y), Math.cos(desiredYaw - character.rotation.y));
      character.rotation.y += yawDelta * (1 - Math.exp(-10 * Math.min(delta, 0.05)));

      if (distance <= step + 0.018) {
        character.position.copy(target);
        director.routeIndex += 1;
        if (director.routeIndex >= director.route.length) {
          if (director.destination) currentLocationRef.current = director.destination;
          director.phase = 'performing';
          director.remaining = animations.find((clip) => clip.name === director.clip)?.duration ?? 2.2;
          character.rotation.y = director.yaw;
          playAction(director.clip ?? 'Think', false);
          onSpeechChange(director.message);
        }
      } else {
        character.position.addScaledVector(offset.normalize(), step);
      }
      invalidate();
      return;
    }

    director.remaining -= Math.min(delta, 0.05);
    if (director.remaining > 0) {
      invalidate();
      return;
    }
    stopScenario();
    setCycleVersion((version) => version + 1);
  });

  const handlePress = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    stopScenario();
    onOpenAssistant();
  };

  return (
    <group ref={characterRef} position={START_POSITION.toArray()}>
      <primitive object={characterScene} />
      <mesh onClick={handlePress} position={[0, 0.58, 0]}>
        <boxGeometry args={[0.92, 1.20, 0.72]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>
    </group>
  );
}

useGLTF.preload(SPOONIE_MODEL_ASSET);
