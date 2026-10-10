import { useFrame, useThree } from '@react-three/fiber/native';
import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide, type Group, type ShaderMaterial } from 'three';
import { getWastePortalFrame, WASTE_BIN_OPENING_HEIGHT } from './kitchenWastePortal';

const VORTEX_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Arthur: NarIyirm
// 中文：单个桶口圆片用极坐标绘制向中心旋转的光带，避免逐帧创建粒子或 React 节点。
// EN: One opening disc draws inward spiral bands in polar coordinates without creating particles or React nodes each frame.
const VORTEX_FRAGMENT = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uStrength;
  void main() {
    vec2 point = (vUv - 0.5) * 2.0;
    float radius = length(point);
    float angle = atan(point.y, point.x);
    float spiral = pow(0.5 + 0.5 * sin(angle * 4.0 + radius * 22.0 + uTime * 8.0), 5.0);
    float core = smoothstep(0.18, 0.6, radius);
    float edge = 1.0 - smoothstep(0.78, 1.0, radius);
    vec3 glow = vec3(0.32, 0.72, 0.58) * spiral * core * edge * uStrength;
    gl_FragColor = vec4(vec3(0.003, 0.008, 0.006) + glow, 1.0);
  }
`;

export function KitchenWasteBin({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const lidRef = useRef<Group>(null);
  const vortexRef = useRef<ShaderMaterial>(null);
  const startedAt = useRef<number | null>(null);
  const invalidate = useThree((state) => state.invalidate);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uStrength: { value: 0 } }), []);

  useEffect(() => {
    startedAt.current = null;
    if (lidRef.current) lidRef.current.rotation.x = active && reduceMotion ? -Math.PI * 0.68 : 0;
    uniforms.uStrength.value = 0;
    invalidate();
  }, [active, invalidate, reduceMotion, uniforms]);

  useFrame(({ clock }) => {
    if (!active || reduceMotion) return;
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    const elapsed = (clock.elapsedTime - startedAt.current) * 1000;
    const frame = getWastePortalFrame(elapsed);
    if (lidRef.current) lidRef.current.rotation.x = -Math.PI * 0.68 * frame.lid;
    if (vortexRef.current) {
      uniforms.uTime.value = elapsed / 1000;
      uniforms.uStrength.value = frame.vortex;
    }
    if (frame.progress < 1) invalidate();
  });

  return (
    <group name="Kitchen_Waste_Bin">
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.29, 0.8, 32, 1, true]} />
        <meshStandardMaterial color="#53796B" roughness={0.62} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.30, 0.30, 0.08, 32]} />
        <meshStandardMaterial color="#314E45" roughness={0.74} />
      </mesh>
      <mesh position={[0, 0.855, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.354, 0.028, 8, 32]} />
        <meshStandardMaterial color="#A4BCAF" roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.86, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.33, 48]} />
        <shaderMaterial ref={vortexRef} uniforms={uniforms} vertexShader={VORTEX_VERTEX} fragmentShader={VORTEX_FRAGMENT} side={DoubleSide} toneMapped={false} />
      </mesh>
      {/* Arthur: NarIyirm
          中文：盖子以桶口后沿为轴，前沿向上翻开，吸入镜头因此不会穿过盖子。
          EN: The lid hinges at the rear rim and lifts its front edge clear of the incoming camera. */}
      <group ref={lidRef} position={[0, WASTE_BIN_OPENING_HEIGHT, -0.34]}>
        <mesh position={[0, 0, 0.34]}>
          <cylinderGeometry args={[0.39, 0.39, 0.075, 32]} />
          <meshStandardMaterial color="#385B4E" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.065, 0.43]}>
          <boxGeometry args={[0.18, 0.065, 0.07]} />
          <meshStandardMaterial color="#DCE7DE" roughness={0.42} metalness={0.2} />
        </mesh>
      </group>
      <mesh position={[0, 0.105, 0.325]}>
        <boxGeometry args={[0.18, 0.055, 0.13]} />
        <meshStandardMaterial color="#C8D4CC" metalness={0.35} roughness={0.45} />
      </mesh>
      <group position={[0, 0.47, 0.351]}>
        <mesh>
          <circleGeometry args={[0.125, 24]} />
          <meshStandardMaterial color="#E8EBDC" roughness={0.85} />
        </mesh>
        {[0, 1, 2].map((index) => (
          <group key={index} rotation={[0, 0, index * Math.PI * 2 / 3]}>
            <mesh position={[0, 0.066, 0.006]} rotation={[0, 0, -0.4]}>
              <boxGeometry args={[0.067, 0.018, 0.006]} />
              <meshStandardMaterial color="#385B4E" />
            </mesh>
            <mesh position={[0.034, 0.055, 0.007]} rotation={[0, 0, -Math.PI / 2 - 0.4]}>
              <coneGeometry args={[0.025, 0.041, 3]} />
              <meshStandardMaterial color="#385B4E" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
