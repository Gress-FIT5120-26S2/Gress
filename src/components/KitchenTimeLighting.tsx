import { useThree } from '@react-three/fiber/native';
import { useEffect, useMemo, useState } from 'react';
import { AdditiveBlending, Color, DoubleSide, Object3D } from 'three';

export type KitchenTimePhase = 'night' | 'dawn' | 'day' | 'sunset';

export type KitchenLightingState = {
  phase: KitchenTimePhase;
  background: string;
  ambientColor: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  moonColor: string;
  moonIntensity: number;
  moonPosition: [number, number, number];
  ceilingIntensity: number;
  windowColor: string;
  windowOpacity: number;
  windowPosition: [number, number, number];
  windowRotation: number;
};

type LightingKeyframe = Omit<KitchenLightingState, 'phase'> & { hour: number };

const LIGHTING_KEYFRAMES: LightingKeyframe[] = [
  { hour: 0, background: '#17283A', ambientColor: '#7691B5', ambientIntensity: 0.44, sunColor: '#FFD6A0', sunIntensity: 0, sunPosition: [-4.5, 3.4, -3.4], moonColor: '#BFD8FF', moonIntensity: 0.48, moonPosition: [0.5, 4.8, -3.5], ceilingIntensity: 4.8, windowColor: '#8FB7FF', windowOpacity: 0.08, windowPosition: [-1.7, 0.028, -0.15], windowRotation: -0.18 },
  { hour: 5, background: '#354A60', ambientColor: '#91A7C3', ambientIntensity: 0.55, sunColor: '#FFBE83', sunIntensity: 0.05, sunPosition: [-4.4, 3.5, -3.4], moonColor: '#C9DAF5', moonIntensity: 0.20, moonPosition: [4.1, 3.7, -3.5], ceilingIntensity: 3.2, windowColor: '#9BBFFF', windowOpacity: 0.08, windowPosition: [-1.8, 0.028, -0.25], windowRotation: -0.22 },
  { hour: 6.5, background: '#EFA985', ambientColor: '#FFD2B2', ambientIntensity: 0.72, sunColor: '#FF9C52', sunIntensity: 0.78, sunPosition: [-4.0, 3.55, -3.4], moonColor: '#CFDFFF', moonIntensity: 0, moonPosition: [4.8, 3.2, -3.5], ceilingIntensity: 1.4, windowColor: '#FFB36B', windowOpacity: 0.29, windowPosition: [-1.75, 0.028, -0.30], windowRotation: -0.30 },
  { hour: 8.5, background: '#B9E4E8', ambientColor: '#E8FAF4', ambientIntensity: 0.96, sunColor: '#FFE2A8', sunIntensity: 1.32, sunPosition: [-3.0, 4.35, -3.4], moonColor: '#CFDFFF', moonIntensity: 0, moonPosition: [4.8, 3.0, -3.5], ceilingIntensity: 0, windowColor: '#FFD792', windowOpacity: 0.22, windowPosition: [-1.55, 0.028, -0.16], windowRotation: -0.22 },
  { hour: 12.5, background: '#D2F0F1', ambientColor: '#F3FFF9', ambientIntensity: 1.08, sunColor: '#FFF2CB', sunIntensity: 1.48, sunPosition: [0, 5.25, -3.4], moonColor: '#CFDFFF', moonIntensity: 0, moonPosition: [4.8, 3.0, -3.5], ceilingIntensity: 0, windowColor: '#FFF1C2', windowOpacity: 0.16, windowPosition: [-1.20, 0.028, 0.02], windowRotation: -0.10 },
  { hour: 16.5, background: '#C7E9E8', ambientColor: '#FFF0D8', ambientIntensity: 0.94, sunColor: '#FFD29A', sunIntensity: 1.16, sunPosition: [2.8, 4.25, -3.4], moonColor: '#CFDFFF', moonIntensity: 0, moonPosition: [-4.8, 3.0, -3.5], ceilingIntensity: 0, windowColor: '#FFD09A', windowOpacity: 0.21, windowPosition: [-0.92, 0.028, 0.20], windowRotation: 0.08 },
  { hour: 18.5, background: '#E88A65', ambientColor: '#FFC49E', ambientIntensity: 0.70, sunColor: '#FF884A', sunIntensity: 0.72, sunPosition: [4.2, 3.55, -3.4], moonColor: '#BDD5FF', moonIntensity: 0.04, moonPosition: [-4.2, 3.6, -3.5], ceilingIntensity: 1.8, windowColor: '#FF9A58', windowOpacity: 0.31, windowPosition: [-0.68, 0.028, 0.31], windowRotation: 0.20 },
  { hour: 20, background: '#34475F', ambientColor: '#8FA9CE', ambientIntensity: 0.52, sunColor: '#FFB06F', sunIntensity: 0, sunPosition: [4.8, 3.1, -3.4], moonColor: '#C8DCFF', moonIntensity: 0.36, moonPosition: [-3.8, 3.8, -3.5], ceilingIntensity: 4.1, windowColor: '#91B9FF', windowOpacity: 0.09, windowPosition: [-1.25, 0.028, 0.05], windowRotation: 0.12 },
  { hour: 24, background: '#17283A', ambientColor: '#7691B5', ambientIntensity: 0.44, sunColor: '#FFD6A0', sunIntensity: 0, sunPosition: [-4.5, 3.4, -3.4], moonColor: '#BFD8FF', moonIntensity: 0.48, moonPosition: [0.5, 4.8, -3.5], ceilingIntensity: 4.8, windowColor: '#8FB7FF', windowOpacity: 0.08, windowPosition: [-1.7, 0.028, -0.15], windowRotation: -0.18 },
];

function interpolateColor(from: string, to: string, progress: number) {
  const color = new Color(from).lerp(new Color(to), progress);
  return `#${color.getHexString()}`;
}

function interpolatePosition(from: [number, number, number], to: [number, number, number], progress: number): [number, number, number] {
  return [
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress,
    from[2] + (to[2] - from[2]) * progress,
  ];
}

function interpolateNumber(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function getPhase(hour: number): KitchenTimePhase {
  if (hour < 5.5 || hour >= 19.5) return 'night';
  if (hour < 8.5) return 'dawn';
  if (hour < 16.5) return 'day';
  return 'sunset';
}

export function getKitchenLighting(date: Date): KitchenLightingState {
  const hour = date.getHours() + date.getMinutes() / 60;
  const nextIndex = LIGHTING_KEYFRAMES.findIndex((keyframe) => keyframe.hour >= hour);
  const upper = LIGHTING_KEYFRAMES[Math.max(1, nextIndex)];
  const lower = LIGHTING_KEYFRAMES[Math.max(0, nextIndex - 1)];
  const progress = upper.hour === lower.hour ? 0 : (hour - lower.hour) / (upper.hour - lower.hour);

  return {
    phase: getPhase(hour),
    background: interpolateColor(lower.background, upper.background, progress),
    ambientColor: interpolateColor(lower.ambientColor, upper.ambientColor, progress),
    ambientIntensity: interpolateNumber(lower.ambientIntensity, upper.ambientIntensity, progress),
    sunColor: interpolateColor(lower.sunColor, upper.sunColor, progress),
    sunIntensity: interpolateNumber(lower.sunIntensity, upper.sunIntensity, progress),
    sunPosition: interpolatePosition(lower.sunPosition, upper.sunPosition, progress),
    moonColor: interpolateColor(lower.moonColor, upper.moonColor, progress),
    moonIntensity: interpolateNumber(lower.moonIntensity, upper.moonIntensity, progress),
    moonPosition: interpolatePosition(lower.moonPosition, upper.moonPosition, progress),
    ceilingIntensity: interpolateNumber(lower.ceilingIntensity, upper.ceilingIntensity, progress),
    windowColor: interpolateColor(lower.windowColor, upper.windowColor, progress),
    windowOpacity: interpolateNumber(lower.windowOpacity, upper.windowOpacity, progress),
    windowPosition: interpolatePosition(lower.windowPosition, upper.windowPosition, progress),
    windowRotation: interpolateNumber(lower.windowRotation, upper.windowRotation, progress),
  };
}

export function useKitchenTimeLighting() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    // Arthur: NarIyirm
    // 中文：时间在整分钟更新一次，环境会缓慢连续变化，同时避免每帧触发 React 渲染。
    // EN: Update on minute boundaries for gradual environmental change without causing per-frame React renders.
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return useMemo(() => getKitchenLighting(now), [now]);
}

function CartoonSun({ lighting }: { lighting: KitchenLightingState }) {
  const rays = useMemo(() => Array.from({ length: 8 }, (_, index) => (index / 8) * Math.PI * 2), []);

  return (
    <group position={lighting.sunPosition} visible={lighting.sunIntensity > 0.03}>
      <mesh>
        <sphereGeometry args={[0.31, 20, 20]} />
        <meshBasicMaterial color={lighting.sunColor} toneMapped={false} />
      </mesh>
      {rays.map((angle) => (
        <mesh key={angle} position={[Math.cos(angle) * 0.47, Math.sin(angle) * 0.47, 0]} rotation={[0, 0, angle]}>
          <boxGeometry args={[0.20, 0.065, 0.045]} />
          <meshBasicMaterial color={lighting.sunColor} transparent opacity={0.82} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function CartoonMoon({ lighting }: { lighting: KitchenLightingState }) {
  return (
    <group position={lighting.moonPosition} visible={lighting.moonIntensity > 0.03}>
      <mesh>
        <sphereGeometry args={[0.29, 20, 20]} />
        <meshBasicMaterial color={lighting.moonColor} toneMapped={false} />
      </mesh>
      <mesh position={[-0.10, 0.08, 0.265]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshBasicMaterial color="#9DB8DD" transparent opacity={0.48} toneMapped={false} />
      </mesh>
      <mesh position={[0.09, -0.09, 0.27]}>
        <sphereGeometry args={[0.038, 12, 12]} />
        <meshBasicMaterial color="#9DB8DD" transparent opacity={0.42} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function KitchenTimeEnvironment({ lighting, weather = 'clear' }: { lighting: KitchenLightingState; weather?: 'clear' | 'rain' }) {
  const invalidate = useThree((state) => state.invalidate);
  const windowTarget = useMemo(() => new Object3D(), []);
  const daylightFactor = weather === 'rain' ? 0.48 : 1;
  const isNight = lighting.phase === 'night';
  const windowLightColor = isNight ? lighting.moonColor : lighting.sunColor;
  const windowLightIntensity = (isNight ? lighting.moonIntensity * 1.45 : lighting.sunIntensity * 2.35) * daylightFactor;
  const patchOpacity = lighting.windowOpacity * daylightFactor;

  useEffect(() => invalidate(), [invalidate, lighting, weather]);

  return (
    <>
      <color attach="background" args={[lighting.background]} />
      <ambientLight color={lighting.ambientColor} intensity={lighting.ambientIntensity * 0.54} />
      <hemisphereLight args={[lighting.ambientColor, '#6C625A', lighting.ambientIntensity * 0.52]} />

      {/* Arthur: NarIyirm
          中文：室外主光从真实窗户锚点射向厨房中央，天气只衰减窗光，室内顶灯仍可独立照明。
          EN: Outdoor key light travels from the real window toward the kitchen center; weather attenuates only window light while the ceiling lamp remains independent. */}
      <primitive object={windowTarget} position={[-0.55, 0.42, 0.42]} />
      <spotLight
        position={[-2.93, 1.84, -0.35]}
        target={windowTarget}
        color={windowLightColor}
        intensity={windowLightIntensity}
        angle={0.68}
        penumbra={0.72}
        distance={7.4}
        decay={1.55}
      />

      <mesh position={[-2.94, 1.83, -0.35]} rotation={[0, Math.PI / 2, 0]} renderOrder={1}>
        <planeGeometry args={[1.42, 1.1]} />
        <meshBasicMaterial color={windowLightColor} transparent opacity={Math.max(0.025, patchOpacity * 0.24)} depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
      </mesh>

      {/* Arthur: NarIyirm
          中文：四块柔边光斑对应窗格，色温和落点随时间插值；它比一整块发光平面更接近真实窗光，又不启用昂贵的实时阴影。
          EN: Four soft patches mirror the window panes and interpolate color and landing point over time, reading more naturally than one glowing slab without costly real-time shadows. */}
      <group position={lighting.windowPosition} rotation={[-Math.PI / 2, 0, lighting.windowRotation]}>
        <mesh position={[0, 0, -0.012]} renderOrder={1}>
          <planeGeometry args={[3.05, 1.34]} />
          <meshBasicMaterial color={lighting.windowColor} transparent opacity={patchOpacity * 0.18} depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
        {([-1, 1] as const).flatMap((column) => ([-1, 1] as const).map((row) => (
          <mesh key={`${column}-${row}`} position={[column * 0.67, row * 0.25, 0]} renderOrder={2}>
            <planeGeometry args={[1.22, 0.43]} />
            <meshBasicMaterial color={lighting.windowColor} transparent opacity={patchOpacity * 0.78} depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
        )))}
      </group>

      <CartoonSun lighting={lighting} />
      <CartoonMoon lighting={lighting} />
    </>
  );
}
