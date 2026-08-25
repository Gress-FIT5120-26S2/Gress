import { useFrame, useThree } from '@react-three/fiber/native';
import { useEffect, useRef } from 'react';
import { MathUtils, type Group } from 'three';

export const SHOPPING_CART_POSITION: [number, number, number] = [2.15, 0.03, 1.62];

const WHEEL_POSITIONS = [
  [-0.43, 0.16, -0.27],
  [0.43, 0.16, -0.27],
  [-0.43, 0.16, 0.27],
  [0.43, 0.16, 0.27],
] as const;

function CartProduct({ index }: { index: number }) {
  if (index === 0) {
    return (
      <group position={[-0.31, 0.72, -0.12]}>
        <mesh><boxGeometry args={[0.22, 0.42, 0.2]} /><meshStandardMaterial color="#F4EBD4" roughness={0.82} /></mesh>
        <mesh position={[0, 0.24, 0]}><coneGeometry args={[0.14, 0.1, 4]} /><meshStandardMaterial color="#9BC7D1" roughness={0.76} /></mesh>
      </group>
    );
  }

  if (index === 1) {
    return (
      <group position={[0.02, 0.73, -0.16]}>
        <mesh><cylinderGeometry args={[0.09, 0.1, 0.42, 16]} /><meshStandardMaterial color="#D9864F" roughness={0.7} /></mesh>
        <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.055, 0.055, 0.1, 14]} /><meshStandardMaterial color="#F2D48D" roughness={0.74} /></mesh>
      </group>
    );
  }

  if (index === 2) {
    return (
      <group position={[0.32, 0.64, -0.12]}>
        <mesh scale={[1, 0.86, 1]}><sphereGeometry args={[0.14, 12, 10]} /><meshStandardMaterial color="#D95D44" roughness={0.8} /></mesh>
        <mesh position={[0, 0.13, 0]} scale={[1.4, 0.45, 0.7]}><sphereGeometry args={[0.045, 8, 8]} /><meshStandardMaterial color="#668F5D" roughness={0.82} /></mesh>
      </group>
    );
  }

  if (index === 3) {
    return (
      <mesh position={[-0.16, 0.72, 0.12]} rotation={[0, 0, Math.PI / 2.8]}>
        <capsuleGeometry args={[0.09, 0.42, 5, 10]} />
        <meshStandardMaterial color="#D9A85F" roughness={0.9} />
      </mesh>
    );
  }

  if (index === 4) {
    return (
      <mesh position={[0.22, 0.7, 0.14]} rotation={[0, -0.12, 0]}>
        <boxGeometry args={[0.28, 0.34, 0.18]} />
        <meshStandardMaterial color="#78A98B" roughness={0.82} />
      </mesh>
    );
  }

  if (index === 5) {
    return (
      <group position={[-0.4, 0.61, 0.15]}>
        {[-0.065, 0.055].map((x) => (
          <mesh key={x} position={[x, 0, 0]}><sphereGeometry args={[0.105, 10, 9]} /><meshStandardMaterial color="#E8B34F" roughness={0.82} /></mesh>
        ))}
      </group>
    );
  }

  if (index === 6) {
    return (
      <group position={[0.43, 0.67, 0.08]}>
        <mesh><cylinderGeometry args={[0.1, 0.1, 0.3, 16]} /><meshStandardMaterial color="#E6D3B2" roughness={0.78} /></mesh>
        <mesh position={[0, 0.17, 0]}><cylinderGeometry args={[0.105, 0.105, 0.05, 16]} /><meshStandardMaterial color="#C77C50" roughness={0.72} /></mesh>
      </group>
    );
  }

  return (
    <group position={[0.02, 0.82, 0.08]}>
      {[-0.08, 0, 0.08].map((x, leafIndex) => (
        <mesh key={x} position={[x, leafIndex * 0.025, 0]} rotation={[0, 0, x * 2.4]} scale={[0.8, 1.7, 0.55]}>
          <sphereGeometry args={[0.1, 9, 8]} />
          <meshStandardMaterial color={leafIndex === 1 ? '#76A96B' : '#8CBD78'} roughness={0.86} />
        </mesh>
      ))}
    </group>
  );
}

export function KitchenShoppingCart({ active, inventoryFillRatio, reduceMotion }: { active: boolean; inventoryFillRatio: number; reduceMotion: boolean }) {
  const cartRef = useRef<Group>(null);
  const wheelRefs = useRef<Array<Group | null>>([]);
  const startedAtRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  const visibleProductCount = inventoryFillRatio <= 0 ? 0 : Math.ceil(MathUtils.clamp(inventoryFillRatio, 0, 1) * 8);

  useEffect(() => {
    startedAtRef.current = null;
    finishedRef.current = false;
    if (cartRef.current) {
      cartRef.current.position.set(0, 0, active && reduceMotion ? 0.24 : 0);
      cartRef.current.rotation.x = 0;
    }
    wheelRefs.current.forEach((wheel) => wheel?.rotation.set(0, 0, 0));
    invalidate();
  }, [active, invalidate, reduceMotion]);

  useFrame(({ clock }) => {
    const cart = cartRef.current;
    if (!cart || !active || reduceMotion || finishedRef.current) return;
    if (startedAtRef.current === null) startedAtRef.current = clock.elapsedTime;

    const progress = MathUtils.clamp((clock.elapsedTime - startedAtRef.current) / 0.54, 0, 1);
    const settle = 1 - Math.pow(1 - progress, 3);

    // Arthur: NarIyirm
    // 中文：购物车点击后短距离滚向用户，车身和轮子只修改 Three.js 变换，结束后停止逐帧刷新。
    // EN: On selection the cart rolls briefly toward the user; body and wheels mutate only Three.js transforms and stop requesting frames afterward.
    cart.position.z = settle * 0.24;
    cart.position.y = Math.sin(progress * Math.PI) * 0.055 * (1 - progress * 0.45);
    cart.rotation.x = Math.sin(progress * Math.PI * 2) * 0.022 * (1 - progress);
    wheelRefs.current.forEach((wheel) => {
      if (wheel) wheel.rotation.x = -settle * 4.8;
    });

    finishedRef.current = progress >= 1;
    if (!finishedRef.current) invalidate();
  });

  return (
    <group ref={cartRef} rotation={[0, -0.34, 0]}>
      {/* Arthur: NarIyirm
          中文：商品数量直接由冰箱库存比例决定，让同一份库存状态同时驱动冰箱页面与首页购物提示。
          EN: Product count derives directly from fridge stock ratio so one inventory state can drive both the fridge screen and home shopping cue. */}
      {Array.from({ length: visibleProductCount }, (_, index) => <CartProduct key={index} index={index} />)}

      <mesh position={[0, 0.46, 0]}><boxGeometry args={[1.08, 0.08, 0.66]} /><meshStandardMaterial color="#6E9988" metalness={0.15} roughness={0.58} /></mesh>
      {[0.6, 0.82, 1.02].map((y) => (
        <group key={y}>
          <mesh position={[0, y, -0.34]}><boxGeometry args={[1.12, 0.035, 0.035]} /><meshStandardMaterial color="#89AA9E" metalness={0.24} roughness={0.52} /></mesh>
          <mesh position={[0, y, 0.34]}><boxGeometry args={[1.12, 0.035, 0.035]} /><meshStandardMaterial color="#89AA9E" metalness={0.24} roughness={0.52} /></mesh>
        </group>
      ))}
      {[-0.54, 0.54].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.8, 0]}><boxGeometry args={[0.035, 0.48, 0.69]} /><meshStandardMaterial color="#89AA9E" metalness={0.24} roughness={0.52} /></mesh>
          <mesh position={[x, 0.34, 0]} rotation={[0.18, 0, 0]}><boxGeometry args={[0.045, 0.42, 0.045]} /><meshStandardMaterial color="#58756C" metalness={0.2} roughness={0.58} /></mesh>
        </group>
      ))}
      <mesh position={[0, 1.13, -0.48]}><boxGeometry args={[1.16, 0.07, 0.07]} /><meshStandardMaterial color="#D47B3B" roughness={0.68} /></mesh>
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} position={[x, 1.07, -0.42]} rotation={[0.55, 0, 0]}><boxGeometry args={[0.045, 0.26, 0.045]} /><meshStandardMaterial color="#58756C" metalness={0.2} roughness={0.58} /></mesh>
      ))}
      {WHEEL_POSITIONS.map((position, index) => (
        <group key={`${position[0]}-${position[2]}`} ref={(group) => { wheelRefs.current[index] = group; }} position={position}>
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.12, 0.12, 0.08, 18]} /><meshStandardMaterial color="#344B45" roughness={0.7} /></mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 0.09, 14]} /><meshStandardMaterial color="#BFC9C3" metalness={0.34} roughness={0.45} /></mesh>
        </group>
      ))}
    </group>
  );
}
