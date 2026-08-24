import { OrbitControls, useGLTF, useProgress } from '@react-three/drei/native';
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber/native';
import { Suspense, useLayoutEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Object3D } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { KITCHEN_MODEL_ASSET } from '../assets/kitchenModel';
import type { AppTab } from './FloatingTabBar';

type Kitchen3DPrototypeProps = {
  onNavigate: (tab: AppTab) => void;
  onReady?: () => void;
};

type FeatureHotspotProps = {
  hitboxPosition: [number, number, number];
  hitboxSize: [number, number, number];
  markerPosition: [number, number, number];
  onPress: () => void;
};

const MODEL_POSITION: [number, number, number] = [-0.9, 0, -0.81];
const MODEL_SCALE = 10.5;
const CAMERA_TARGET: [number, number, number] = [0, 3.02, 0];
const INITIAL_CAMERA_POSITION: [number, number, number] = [14.6, 12.8, 20.2];

function PulseMarker({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.11, 18, 18]} />
      <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={2.2} />
      <pointLight color="#FFFFFF" intensity={0.7} distance={1.3} />
    </mesh>
  );
}

function FeatureHotspot({ hitboxPosition, hitboxSize, markerPosition, onPress }: FeatureHotspotProps) {
  const handlePress = (event: ThreeEvent<MouseEvent>) => {
    // Arthur: NarIyirm
    // 中文：透明热区扩大精细模型的可点击范围，并阻止点击继续穿透到厨房网格。
    // EN: The invisible hitbox enlarges the tap target and prevents the event reaching the kitchen mesh.
    event.stopPropagation();
    onPress();
  };

  return (
    <group>
      <mesh position={hitboxPosition} onClick={handlePress}>
        <boxGeometry args={hitboxSize} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>
      <PulseMarker position={markerPosition} />
    </group>
  );
}

function KitchenModel({ onReady }: { onReady?: () => void }) {
  const { scene } = useGLTF(KITCHEN_MODEL_ASSET) as { scene: Object3D };
  const hasPresentedFirstFrame = useRef(false);

  useFrame(() => {
    if (hasPresentedFirstFrame.current || !onReady) return;

    // Arthur: NarIyirm
    // 中文：模型参与首帧绘制后再通知 App，下一显示帧才移除开场层，避免露出空画布。
    // EN: Notify the app after the model joins its first render, then remove the opener on the next display frame.
    hasPresentedFirstFrame.current = true;
    requestAnimationFrame(onReady);
  });

  return (
    <group position={MODEL_POSITION} scale={MODEL_SCALE}>
      {/* Arthur: NarIyirm
          中文：原模型不足一个世界单位，在这里统一放大并按模型边界移回场景中心。
          EN: The source is under one world unit, so it is scaled uniformly and recentered from its bounds. */}
      {/* Arthur: NarIyirm
          中文：精细厨房本体不参与射线检测，避免每次拖拽都扫描完整模型网格。
          EN: The detailed kitchen has no pointer handlers, avoiding raycasts across the full model mesh. */}
      <primitive object={scene} />
    </group>
  );
}

function KitchenCameraControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const canvasWidth = useThree((state) => state.size.width);
  const canvasHeight = useThree((state) => state.size.height);

  useLayoutEffect(() => {
    // Arthur: NarIyirm
    // 中文：画布和控制器就绪后统一设置相机，确保首次进入和屏幕尺寸变化时厨房都保持居中。
    // EN: Set the camera after both canvas and controls are ready, keeping the kitchen centered on mount and resize.
    camera.position.set(...INITIAL_CAMERA_POSITION);
    camera.up.set(0, 1, 0);
    controlsRef.current?.target.set(...CAMERA_TARGET);
    controlsRef.current?.update();
    camera.lookAt(...CAMERA_TARGET);
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, canvasHeight, canvasWidth, invalidate]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      minDistance={15}
      maxDistance={34}
      minPolarAngle={0.62}
      maxPolarAngle={1.28}
      minAzimuthAngle={-0.95}
      maxAzimuthAngle={0.95}
      target={CAMERA_TARGET}
    />
  );
}

function KitchenScene({ onNavigate, onReady }: Kitchen3DPrototypeProps) {
  return (
    <>
      <color attach="background" args={['#D8EFF0']} />
      <ambientLight intensity={1.25} />
      <directionalLight position={[8, 14, 10]} intensity={2.1} color="#FFF6DE" />
      <directionalLight position={[-8, 6, -4]} intensity={0.65} color="#B8E1EC" />

      <Suspense fallback={null}>
        <KitchenModel onReady={onReady} />
      </Suspense>

      {/* Arthur: NarIyirm
          中文：精细模型只有少量命名节点，因此用独立热区维持冰箱、灶台和菜谱入口。
          EN: The detailed model has few named nodes, so separate hitboxes preserve the three feature entries. */}
      <FeatureHotspot hitboxPosition={[2.75, 2.15, -2.55]} hitboxSize={[2.15, 3.5, 1.6]} markerPosition={[2.75, 4.25, -2.25]} onPress={() => onNavigate('fridge')} />
      <FeatureHotspot hitboxPosition={[0.7, 1.2, -1.7]} hitboxSize={[1.75, 1.45, 1.25]} markerPosition={[0.7, 2.2, -1.6]} onPress={() => onNavigate('ingredients')} />
      <FeatureHotspot hitboxPosition={[0, 1.05, 1.15]} hitboxSize={[2.5, 1.7, 1.9]} markerPosition={[0, 2.15, 1.15]} onPress={() => onNavigate('recipes')} />

      <KitchenCameraControls />
    </>
  );
}

export function Kitchen3DPrototype({ onNavigate, onReady }: Kitchen3DPrototypeProps) {
  const { active: isLoading, progress } = useProgress();

  return (
    <View style={styles.container} accessibilityLabel="可旋转的三维厨房，点击冰箱、灶台或餐桌进入对应页面">
      {/* Arthur: NarIyirm
          中文：初始相机从厨房中央拉远，完整保留墙顶、地板边缘和外围背景留白。
          EN: The initial camera pulls back from the kitchen center to retain walls, floor edges, and outer spacing. */}
      {/* Arthur: NarIyirm
          中文：按需渲染只在手势或场景变化时绘制；原生画布自行管理手机像素比，避免视口缩到左下角。
          EN: Demand rendering draws only on changes; the native canvas owns device pixel ratio to prevent a lower-left viewport. */}
      <Canvas
        frameloop="demand"
        camera={{ position: INITIAL_CAMERA_POSITION, fov: 42, near: 0.1, far: 100 }}
        gl={{ antialias: false, alpha: false }}
      >
        {/* Arthur: NarIyirm
            中文：GLB 随 App 安装在本地，但 Canvas 仍只在开场结束后挂载，避免与开场动画同时占用资源。
            EN: The GLB ships locally with the app, while Canvas still mounts only after the opener to avoid competing for resources. */}
        <KitchenScene onNavigate={onNavigate} onReady={onReady} />
      </Canvas>
      {isLoading ? (
        // Arthur: NarIyirm
        // 中文：模型下载和解析期间显示明确进度，避免用户把短暂等待误认为再次卡死。
        // EN: Show explicit progress during download and parsing so a short wait does not look frozen.
        <KitchenLoading label={`正在解析厨房 ${Math.round(progress)}%`} />
      ) : null}
    </View>
  );
}

function KitchenLoading({ label }: { label: string }) {
  return (
    <View style={styles.loadingOverlay} pointerEvents="none">
      <ActivityIndicator size="small" color="#D47B21" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#D8EFF0' },
  loadingText: { color: '#46645D', fontSize: 13, fontWeight: '600' },
});
