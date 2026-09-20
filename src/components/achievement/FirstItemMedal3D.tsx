import { OrbitControls, useGLTF } from '@react-three/drei/native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, View } from 'react-native';
import { Color, MathUtils, type Group, type Object3D } from 'three';

const FIRST_ITEM_MODEL = require('../../../models/achievements/first-item.glb');

type Props = {
  earned: boolean;
};

type LoadedMedal = {
  scene: Object3D;
};

// Arthur: NarIyirm
// 中文：首枚奖牌使用 Blender 制作的独立浮雕、包边与丝带网格；详情页只挂载一个 GL 场景，避免奖牌列表产生多个 GPU 上下文。
// EN: The first medal uses independently modeled Blender reliefs, rims, and ribbons; the detail view mounts one GL scene so the medal grid never creates multiple GPU contexts.
export function FirstItemMedal3D({ earned }: Props) {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.root}>
      <Suspense fallback={<View style={styles.loading}><ActivityIndicator color="#D7B06D" /></View>}>
        <Canvas
          camera={{ fov: 31, near: 0.1, far: 30, position: [0, 0, 7.6] }}
          gl={{ alpha: true, antialias: true }}
          onCreated={({ gl }) => gl.setClearColor(new Color('#000000'), 0)}
          style={styles.canvas}
        >
          <ambientLight intensity={earned ? 0.82 : 0.48} />
          <directionalLight color="#FFF1CF" intensity={earned ? 4.5 : 2.4} position={[-3.5, 4.5, 5]} />
          <directionalLight color="#8FB6A5" intensity={earned ? 2.5 : 1.2} position={[4, 1, 2]} />
          <pointLight color="#F6C978" intensity={earned ? 13 : 4} position={[0, -2.5, 3]} />
          <FirstItemMedalModel reduceMotion={reduceMotion} />
          <OrbitControls
            enableDamping={!reduceMotion}
            enablePan={false}
            enableZoom={false}
            maxPolarAngle={Math.PI - 0.001}
            minPolarAngle={0.001}
            rotateSpeed={0.72}
          />
        </Canvas>
      </Suspense>
    </View>
  );
}

function FirstItemMedalModel({ reduceMotion }: { reduceMotion: boolean }) {
  const root = useRef<Group>(null);
  const { scene } = useGLTF(FIRST_ITEM_MODEL) as LoadedMedal;
  const model = useMemo(() => scene.clone(true), [scene]);

  useFrame((state, delta) => {
    if (!root.current || reduceMotion) return;
    root.current.position.y = 0.32 + Math.sin(state.clock.elapsedTime * 0.8) * 0.035;
    root.current.rotation.z = MathUtils.damp(root.current.rotation.z, Math.sin(state.clock.elapsedTime * 0.55) * 0.016, 3, delta);
  });

  return (
    <group ref={root} position={[0, 0.32, 0]} rotation={[Math.PI / 2, 0, 0]} scale={0.98}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload(FIRST_ITEM_MODEL);

const styles = StyleSheet.create({
  root: { width: 292, height: 292 },
  canvas: { width: 292, height: 292 },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
