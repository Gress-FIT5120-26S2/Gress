import { useFrame, useThree } from '@react-three/fiber/native';
import { useEffect, useRef } from 'react';
import { MathUtils, type Group } from 'three';

export const KITCHEN_MAILBOX_POSITION: [number, number, number] = [-2.96, 1.46, 1.08];
export const KITCHEN_MAILBOX_ROTATION: [number, number, number] = [0, Math.PI / 2, 0];

const LETTER_OFFSETS = [
  [-0.19, 0.13, 0.02, -0.08],
  [0.14, 0.18, 0.01, 0.07],
  [-0.08, 0.28, 0.03, -0.03],
  [0.20, 0.35, 0.02, 0.1],
  [-0.18, 0.43, 0.04, -0.11],
  [0.05, 0.52, 0.05, 0.03],
] as const;

function Envelope({ position, rotationZ }: { position: readonly [number, number, number]; rotationZ: number }) {
  return (
    <group position={[...position]} rotation={[0, 0, rotationZ]}>
      <mesh>
        <boxGeometry args={[0.42, 0.26, 0.022]} />
        <meshStandardMaterial color="#FFF4D8" roughness={0.86} />
      </mesh>
      <mesh position={[-0.095, 0, 0.015]} rotation={[0, 0, -0.56]}>
        <boxGeometry args={[0.24, 0.014, 0.012]} />
        <meshStandardMaterial color="#D9BFA0" roughness={0.9} />
      </mesh>
      <mesh position={[0.095, 0, 0.015]} rotation={[0, 0, 0.56]}>
        <boxGeometry args={[0.24, 0.014, 0.012]} />
        <meshStandardMaterial color="#D9BFA0" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function KitchenMailbox({ active, reduceMotion, unreadCount }: { active: boolean; reduceMotion: boolean; unreadCount: number }) {
  const doorRef = useRef<Group>(null);
  const featuredLetterRef = useRef<Group>(null);
  const letterSheetRef = useRef<Group>(null);
  const flapRef = useRef<Group>(null);
  const startedAtRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  const visibleLetterCount = Math.min(LETTER_OFFSETS.length, Math.max(0, unreadCount));

  useEffect(() => {
    startedAtRef.current = null;
    finishedRef.current = false;
    if (doorRef.current) doorRef.current.rotation.x = active && reduceMotion ? 1.12 : 0;
    if (featuredLetterRef.current) {
      featuredLetterRef.current.position.set(0, active && reduceMotion ? 0.83 : 0.2, active && reduceMotion ? 0.82 : 0.28);
      featuredLetterRef.current.rotation.x = active && reduceMotion ? -0.12 : 0;
    }
    if (flapRef.current) flapRef.current.rotation.x = active && reduceMotion ? -2.35 : 0;
    if (letterSheetRef.current) {
      letterSheetRef.current.position.y = active && reduceMotion ? 0.29 : 0.04;
      letterSheetRef.current.scale.y = active && reduceMotion ? 1 : 0.12;
    }
    invalidate();
  }, [active, invalidate, reduceMotion]);

  useFrame(({ clock }) => {
    if (!active || reduceMotion || finishedRef.current) return;
    if (startedAtRef.current === null) startedAtRef.current = clock.elapsedTime;

    const progress = MathUtils.clamp((clock.elapsedTime - startedAtRef.current) / 0.82, 0, 1);
    const doorProgress = 1 - Math.pow(1 - Math.min(progress / 0.46, 1), 3);
    const letterProgress = 1 - Math.pow(1 - MathUtils.clamp((progress - 0.22) / 0.78, 0, 1), 3);
    const openProgress = 1 - Math.pow(1 - MathUtils.clamp((progress - 0.5) / 0.5, 0, 1), 3);

    // Arthur: NarIyirm
    // 中文：箱门先落下，最上方信封再升到用户面前并展开信纸，三段变换共享同一时间轴。
    // EN: The door drops first, then the top envelope rises toward the user and unfolds its letter on one shared timeline.
    if (doorRef.current) doorRef.current.rotation.x = doorProgress * 1.12;
    if (featuredLetterRef.current) {
      featuredLetterRef.current.position.set(0, MathUtils.lerp(0.2, 0.83, letterProgress), MathUtils.lerp(0.28, 0.82, letterProgress));
      featuredLetterRef.current.rotation.x = MathUtils.lerp(0, -0.12, letterProgress);
    }
    if (flapRef.current) flapRef.current.rotation.x = openProgress * -2.35;
    if (letterSheetRef.current) {
      letterSheetRef.current.position.y = MathUtils.lerp(0.04, 0.29, openProgress);
      letterSheetRef.current.scale.y = MathUtils.lerp(0.12, 1, openProgress);
    }

    finishedRef.current = progress >= 1;
    if (!finishedRef.current) invalidate();
  });

  return (
    <group>
      {/* Arthur: NarIyirm
          中文：未读数量直接控制可见信件层数；超过四封时信件会越过箱口，形成无需文字也能读懂的提醒强度。
          EN: Unread count directly controls visible letter layers; after four, letters rise above the slot to communicate urgency without copy. */}
      <mesh position={[0, 0, 0.09]}>
        <boxGeometry args={[0.8, 0.66, 0.18]} />
        <meshStandardMaterial color="#A8472E" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.02, 0.24]}>
        <boxGeometry args={[0.76, 0.58, 0.3]} />
        <meshStandardMaterial color="#D76C43" roughness={0.68} />
      </mesh>
      <mesh position={[0, 0.29, 0.25]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.5, 0.5, 0.28]} />
        <meshStandardMaterial color="#E07B51" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.02, 0.405]}>
        <boxGeometry args={[0.56, 0.07, 0.035]} />
        <meshStandardMaterial color="#873522" roughness={0.62} />
      </mesh>

      {LETTER_OFFSETS.slice(0, visibleLetterCount).map(([x, y, z, rotationZ], index) => (
        <Envelope key={index} position={[x, y, 0.34 + z]} rotationZ={rotationZ} />
      ))}

      <group ref={featuredLetterRef} position={[0, 0.2, 0.28]} visible={unreadCount > 0}>
        <Envelope position={[0, 0, 0]} rotationZ={0} />
        <group ref={flapRef} position={[0, 0.13, 0.018]}>
          <mesh position={[0, -0.07, 0]}>
            <boxGeometry args={[0.38, 0.14, 0.018]} />
            <meshStandardMaterial color="#E7D2B8" roughness={0.88} />
          </mesh>
        </group>
        <group ref={letterSheetRef} position={[0, 0.04, 0.012]} scale={[1, 0.12, 1]}>
          <mesh>
            <boxGeometry args={[0.34, 0.36, 0.012]} />
            <meshStandardMaterial color="#FFFDF2" roughness={0.92} />
          </mesh>
          {[-0.09, -0.015, 0.06].map((y) => (
            <mesh key={y} position={[0, y, 0.01]}>
              <boxGeometry args={[0.23, 0.012, 0.008]} />
              <meshStandardMaterial color="#A8B6AC" roughness={0.9} />
            </mesh>
          ))}
        </group>
      </group>

      <group ref={doorRef} position={[0, -0.29, 0.42]}>
        <mesh position={[0, 0.29, 0]}>
          <boxGeometry args={[0.78, 0.6, 0.075]} />
          <meshStandardMaterial color="#C95A38" roughness={0.66} />
        </mesh>
        <mesh position={[0, 0.32, 0.043]}>
          <boxGeometry args={[0.3, 0.07, 0.028]} />
          <meshStandardMaterial color="#F1B365" metalness={0.18} roughness={0.48} />
        </mesh>
      </group>
    </group>
  );
}
