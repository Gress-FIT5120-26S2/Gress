import { useFrame, useThree } from '@react-three/fiber/native';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, DoubleSide, type Group, type Mesh, type MeshBasicMaterial } from 'three';

export type KitchenWeather = 'clear' | 'rain';

const RAIN_TRAILS = [
  { x: -0.58, offset: 0.08, speed: 0.17, length: 0.16 },
  { x: -0.41, offset: 0.44, speed: 0.14, length: 0.22 },
  { x: -0.24, offset: 0.72, speed: 0.19, length: 0.13 },
  { x: -0.06, offset: 0.22, speed: 0.15, length: 0.2 },
  { x: 0.12, offset: 0.58, speed: 0.18, length: 0.15 },
  { x: 0.3, offset: 0.88, speed: 0.13, length: 0.23 },
  { x: 0.47, offset: 0.34, speed: 0.16, length: 0.18 },
  { x: 0.61, offset: 0.66, speed: 0.2, length: 0.12 },
] as const;

export function WindowRain({ reduceMotion }: { reduceMotion: boolean }) {
  const trailRefs = useRef<Array<Mesh | null>>([]);

  useFrame(({ clock }) => {
    if (reduceMotion) return;

    // Arthur: NarIyirm
    // 中文：雨痕只更新 Three.js 节点位置，不触发 React 状态；低频画面请求由厨房场景统一管理。
    // EN: Rain updates only Three.js node positions without React state; the kitchen scene owns low-frequency frame requests.
    RAIN_TRAILS.forEach((trail, index) => {
      const mesh = trailRefs.current[index];
      if (!mesh) return;
      const cycle = (clock.elapsedTime * trail.speed + trail.offset) % 1;
      mesh.position.y = 0.48 - cycle * 0.96;
    });
  });

  return (
    <group position={[0.035, 0.01, 0]} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <planeGeometry args={[1.36, 1.04]} />
        <meshBasicMaterial color="#79AEE4" transparent opacity={0.08} depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      {RAIN_TRAILS.map((trail, index) => (
        <mesh
          key={trail.x}
          ref={(mesh) => { trailRefs.current[index] = mesh; }}
          position={[trail.x, 0.48 - trail.offset * 0.96, 0.012]}
        >
          <boxGeometry args={[0.012, trail.length, 0.005]} />
          <meshBasicMaterial color="#B7DAFF" transparent opacity={0.32} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

const NOODLE_LOOPS = [
  [-0.055, 0.012, -0.025, 0.12],
  [0.045, 0.015, -0.035, -0.18],
  [-0.025, 0.018, 0.045, 0.32],
  [0.06, 0.02, 0.04, -0.36],
] as const;

const STEAM_BASES = [-0.055, 0.005, 0.06] as const;

function TomatoPasta() {
  return (
    <group position={[-0.43, -0.18, -0.05]}>
      <mesh position={[0, 0.015, 0]}>
        <cylinderGeometry args={[0.145, 0.16, 0.03, 24]} />
        <meshStandardMaterial color="#C95F37" roughness={0.78} />
      </mesh>
      {NOODLE_LOOPS.map(([x, y, z, rotation], index) => (
        <mesh key={index} position={[x, 0.035 + y, z]} rotation={[Math.PI / 2, 0, rotation]}>
          <torusGeometry args={[0.055, 0.012, 5, 15]} />
          <meshStandardMaterial color={index % 2 === 0 ? '#F2B84D' : '#E9A63D'} roughness={0.72} />
        </mesh>
      ))}
      <mesh position={[-0.025, 0.068, 0.005]} scale={[1.2, 0.5, 0.8]}>
        <sphereGeometry args={[0.027, 8, 8]} />
        <meshStandardMaterial color="#5F8B55" roughness={0.8} />
      </mesh>
    </group>
  );
}

const BOOK_LEAVES = [
  { color: '#466A5D', delay: 0, endY: -0.012, startY: 0.046, settle: 0 },
  { color: '#F3E4C8', delay: 0.055, endY: 0.001, startY: 0.039, settle: -0.018 },
  { color: '#FFF3D9', delay: 0.11, endY: 0.006, startY: 0.033, settle: 0.012 },
  { color: '#F7EAD0', delay: 0.165, endY: 0.011, startY: 0.027, settle: -0.01 },
  { color: '#FFF6E3', delay: 0.22, endY: 0.016, startY: 0.021, settle: 0 },
] as const;
const BOOK_LEAF_DURATION = 0.42;

function easeBookFlip(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

function AnimatedRecipeBook({ isOpen, reduceMotion }: { isOpen: boolean; reduceMotion: boolean }) {
  const leafRefs = useRef<Array<Group | null>>([]);
  const elapsedRef = useRef(0);
  const hasFinishedRef = useRef(false);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    elapsedRef.current = 0;
    hasFinishedRef.current = false;

    BOOK_LEAVES.forEach((leaf, index) => {
      const group = leafRefs.current[index];
      if (!group) return;
      const openProgress = isOpen && reduceMotion ? 1 : 0;
      group.rotation.z = (-Math.PI + leaf.settle) * openProgress;
      group.position.y = leaf.startY + (leaf.endY - leaf.startY) * openProgress;
    });
    invalidate();
  }, [invalidate, isOpen, reduceMotion]);

  useFrame((_, delta) => {
    if (!isOpen || reduceMotion || hasFinishedRef.current) return;

    // Arthur: NarIyirm
    // 中文：封面和内页围绕同一书脊错峰翻转，动画期间主动请求下一帧，完成后自动回到按需渲染。
    // EN: The cover and pages flip around one spine with short staggers, requesting frames only until the sequence completes.
    elapsedRef.current += Math.min(delta, 0.05);
    let hasPendingLeaf = false;
    BOOK_LEAVES.forEach((leaf, index) => {
      const group = leafRefs.current[index];
      if (!group) return;
      const rawProgress = Math.max(0, Math.min(1, (elapsedRef.current - leaf.delay) / BOOK_LEAF_DURATION));
      const progress = easeBookFlip(rawProgress);
      group.rotation.z = (-Math.PI + leaf.settle) * progress;
      group.position.y = leaf.startY + (leaf.endY - leaf.startY) * progress;
      if (rawProgress < 1) hasPendingLeaf = true;
    });

    hasFinishedRef.current = !hasPendingLeaf;
    if (hasPendingLeaf) invalidate();
  });

  return (
    <group position={[0.16, -0.185, -0.02]} rotation={[0, -0.08, 0]}>
      <mesh position={[-0.15, -0.012, 0]}>
        <boxGeometry args={[0.31, 0.025, 0.39]} />
        <meshStandardMaterial color="#466A5D" roughness={0.86} />
      </mesh>
      <mesh position={[-0.15, 0.012, 0]} rotation={[0, 0, -0.055]}>
        <boxGeometry args={[0.295, 0.018, 0.37]} />
        <meshStandardMaterial color="#FFF3D9" roughness={0.94} />
      </mesh>
      <mesh position={[-0.15, 0.024, -0.025]}>
        <cylinderGeometry args={[0.072, 0.072, 0.008, 18]} />
        <meshStandardMaterial color="#D96C43" roughness={0.76} />
      </mesh>
      {[-0.08, 0.015, 0.11].map((z, index) => (
        <mesh key={z} position={[-0.15, 0.024, z]}>
          <boxGeometry args={[index === 0 ? 0.17 : 0.13, 0.007, 0.018]} />
          <meshBasicMaterial color={index === 0 ? '#D17B45' : '#AFA78F'} />
        </mesh>
      ))}
      {BOOK_LEAVES.map((leaf, index) => (
        <group
          key={`${leaf.color}-${leaf.delay}`}
          ref={(group) => { leafRefs.current[index] = group; }}
          position={[0, leaf.startY, 0]}
        >
          <group position={[-0.15, 0, 0]}>
            <mesh>
              <boxGeometry args={[index === 0 ? 0.31 : 0.295, index === 0 ? 0.018 : 0.008, index === 0 ? 0.39 : 0.37]} />
              <meshStandardMaterial color={leaf.color} roughness={index === 0 ? 0.86 : 0.94} />
            </mesh>
            {index === 0 ? (
              <mesh position={[0, 0.013, 0]}>
                <cylinderGeometry args={[0.055, 0.055, 0.008, 18]} />
                <meshStandardMaterial color="#D98232" roughness={0.76} />
              </mesh>
            ) : null}
            {index === BOOK_LEAVES.length - 1 ? (
              <>
                <mesh position={[0, -0.009, -0.035]}>
                  <cylinderGeometry args={[0.065, 0.065, 0.006, 18]} />
                  <meshStandardMaterial color="#C9623B" roughness={0.78} />
                </mesh>
                {[-0.07, 0.03, 0.115].map((z, lineIndex) => (
                  <mesh key={z} position={[0, -0.009, z]}>
                    <boxGeometry args={[lineIndex === 0 ? 0.17 : 0.13, 0.006, 0.015]} />
                    <meshBasicMaterial color={lineIndex === 0 ? '#D17B45' : '#AAA38E'} />
                  </mesh>
                ))}
              </>
            ) : null}
          </group>
        </group>
      ))}
    </group>
  );
}

export function TodayRecipeScene({ isBookOpen, reduceMotion }: { isBookOpen: boolean; reduceMotion: boolean }) {
  const steamRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (reduceMotion || !steamRef.current) return;

    // Arthur: NarIyirm
    // 中文：三缕蒸汽错峰上升并淡出，循环表达“当前可做”的菜谱状态，不增加粒子系统开销。
    // EN: Three steam wisps rise and fade out of phase to signal a ready-to-cook recipe without a particle-system cost.
    steamRef.current.children.forEach((child, index) => {
      const cycle = (clock.elapsedTime * 0.22 + index / 3) % 1;
      child.position.x = STEAM_BASES[index] + Math.sin(cycle * Math.PI * 2) * 0.025;
      child.position.y = 0.08 + cycle * 0.3;
      child.scale.setScalar(0.82 + cycle * 0.28);
      const material = (child as Mesh).material as MeshBasicMaterial;
      material.opacity = Math.sin(cycle * Math.PI) * 0.2;
    });
  });

  return (
    <>
      <TomatoPasta />
      <AnimatedRecipeBook isOpen={isBookOpen} reduceMotion={reduceMotion} />
      <group ref={steamRef} position={[-0.43, -0.09, -0.05]}>
        {STEAM_BASES.map((x, index) => (
          <mesh key={x} position={[x, 0.08 + index * 0.08, 0]} scale={[0.42, 1.35, 0.42]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshBasicMaterial color="#FFF1D2" transparent opacity={reduceMotion ? 0.12 : 0.08} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </>
  );
}

export function FridgeMemoryMagnet() {
  const herbPositions = useMemo(() => [[-0.04, 0.03], [0.05, -0.015], [0.015, 0.055]] as const, []);

  return (
    <group position={[-0.45, 1.82, 0.13]}>
      <mesh>
        <boxGeometry args={[0.38, 0.48, 0.025]} />
        <meshStandardMaterial color="#F4E7C9" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.045, 0.022]}>
        <boxGeometry args={[0.3, 0.27, 0.012]} />
        <meshStandardMaterial color="#D6B28B" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.035, 0.034]}>
        <circleGeometry args={[0.105, 20]} />
        <meshStandardMaterial color="#FFF2D5" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.035, 0.041]}>
        <circleGeometry args={[0.077, 20]} />
        <meshStandardMaterial color="#C9623B" roughness={0.78} />
      </mesh>
      {herbPositions.map(([x, y]) => (
        <mesh key={`${x}-${y}`} position={[x, 0.035 + y, 0.049]} scale={[1.3, 0.65, 0.45]}>
          <sphereGeometry args={[0.018, 7, 7]} />
          <meshStandardMaterial color="#668A58" roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[0.15, 0.215, 0.038]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color="#D98232" roughness={0.7} />
      </mesh>
    </group>
  );
}
