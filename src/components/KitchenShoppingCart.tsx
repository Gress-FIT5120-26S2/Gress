import { useFrame, useThree } from '@react-three/fiber/native';
import { useEffect, useRef } from 'react';
import { MathUtils, type Group } from 'three';

export const SHOPPING_CART_POSITION: [number, number, number] = [2.15, 0.03, 1.62];

const WHEEL_POSITIONS = [
  [-0.43, 0.15, -0.26],
  [0.43, 0.15, -0.26],
  [-0.43, 0.15, 0.26],
  [0.43, 0.15, 0.26],
] as const;

const BASKET_WIRES_X = [-0.48, -0.32, -0.16, 0, 0.16, 0.32, 0.48] as const;
const BASKET_WIRES_Z = [-0.28, -0.14, 0, 0.14, 0.28] as const;

function CartProduct({ index }: { index: number }) {
  if (index === 0) {
    return (
      <group position={[-0.33, 0.79, -0.12]}>
        <mesh><boxGeometry args={[0.23, 0.43, 0.2]} /><meshStandardMaterial color="#F8EFD9" roughness={0.78} /></mesh>
        <mesh position={[0, 0.245, 0]} rotation={[0, Math.PI / 4, 0]}><boxGeometry args={[0.17, 0.1, 0.17]} /><meshStandardMaterial color="#9BC7D1" roughness={0.72} /></mesh>
        <mesh position={[0, 0.015, -0.104]}><boxGeometry args={[0.16, 0.13, 0.008]} /><meshStandardMaterial color="#74A9B7" roughness={0.76} /></mesh>
      </group>
    );
  }

  if (index === 1) {
    return (
      <group position={[-0.04, 0.8, -0.16]}>
        <mesh><cylinderGeometry args={[0.09, 0.1, 0.42, 20]} /><meshStandardMaterial color="#D9864F" roughness={0.68} /></mesh>
        <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.052, 0.052, 0.11, 16]} /><meshStandardMaterial color="#F2D48D" roughness={0.7} /></mesh>
        <mesh position={[0, 0, -0.093]}><boxGeometry args={[0.13, 0.12, 0.008]} /><meshStandardMaterial color="#FFF0C8" roughness={0.84} /></mesh>
      </group>
    );
  }

  if (index === 2) {
    return (
      <group position={[0.28, 0.7, -0.12]}>
        {[-0.09, 0.03, 0.12].map((x, tomatoIndex) => (
          <group key={x} position={[x, tomatoIndex === 1 ? 0.06 : 0, tomatoIndex === 2 ? 0.05 : 0]}>
            <mesh scale={[1, 0.9, 1]}><sphereGeometry args={[0.105, 14, 12]} /><meshStandardMaterial color="#D95D44" roughness={0.78} /></mesh>
            <mesh position={[0, 0.1, 0]} scale={[1.25, 0.42, 0.65]}><sphereGeometry args={[0.035, 8, 8]} /><meshStandardMaterial color="#668F5D" roughness={0.82} /></mesh>
          </group>
        ))}
      </group>
    );
  }

  if (index === 3) {
    return (
      <group position={[-0.2, 0.75, 0.14]} rotation={[0, 0, Math.PI / 2.9]}>
        <mesh><capsuleGeometry args={[0.075, 0.38, 6, 14]} /><meshStandardMaterial color="#D8A45B" roughness={0.88} /></mesh>
        {[-0.1, 0, 0.1].map((y) => (
          <mesh key={y} position={[0, y, -0.072]} rotation={[0.55, 0, 0]}><boxGeometry args={[0.08, 0.012, 0.018]} /><meshStandardMaterial color="#F0CB86" roughness={0.9} /></mesh>
        ))}
      </group>
    );
  }

  if (index === 4) {
    return (
      <group position={[0.22, 0.77, 0.14]} rotation={[0, -0.12, 0]}>
        <mesh><boxGeometry args={[0.29, 0.38, 0.18]} /><meshStandardMaterial color="#78A98B" roughness={0.8} /></mesh>
        <mesh position={[0, 0, -0.095]}><boxGeometry args={[0.2, 0.21, 0.01]} /><meshStandardMaterial color="#F2D88E" roughness={0.82} /></mesh>
        <mesh position={[0, 0.025, -0.102]}><circleGeometry args={[0.052, 18]} /><meshStandardMaterial color="#D87049" roughness={0.78} /></mesh>
      </group>
    );
  }

  if (index === 5) {
    return (
      <group position={[-0.4, 0.66, 0.14]}>
        {[-0.065, 0.055].map((x) => (
          <mesh key={x} position={[x, 0, 0]}><sphereGeometry args={[0.105, 14, 12]} /><meshStandardMaterial color="#E8B34F" roughness={0.8} /></mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.14, 0.012, 6, 20]} /><meshStandardMaterial color="#D7C59A" roughness={0.94} /></mesh>
      </group>
    );
  }

  if (index === 6) {
    return (
      <group position={[0.45, 0.72, 0.08]}>
        <mesh><cylinderGeometry args={[0.1, 0.1, 0.3, 20]} /><meshStandardMaterial color="#E6D3B2" roughness={0.76} /></mesh>
        <mesh position={[0, 0.175, 0]}><cylinderGeometry args={[0.105, 0.105, 0.05, 18]} /><meshStandardMaterial color="#C77C50" metalness={0.08} roughness={0.58} /></mesh>
        <mesh position={[0, 0, -0.102]}><boxGeometry args={[0.13, 0.1, 0.008]} /><meshStandardMaterial color="#89A983" roughness={0.82} /></mesh>
      </group>
    );
  }

  return (
    <group position={[0.02, 0.88, 0.06]}>
      {[-0.09, 0, 0.09].map((x, leafIndex) => (
        <mesh key={x} position={[x, leafIndex * 0.025, 0]} rotation={[0, 0, x * 2.4]} scale={[0.78, 1.75, 0.52]}>
          <sphereGeometry args={[0.1, 12, 10]} />
          <meshStandardMaterial color={leafIndex === 1 ? '#76A96B' : '#8CBD78'} roughness={0.84} />
        </mesh>
      ))}
      <mesh position={[0, -0.13, 0]}><cylinderGeometry args={[0.055, 0.075, 0.22, 12]} /><meshStandardMaterial color="#E7E0C8" roughness={0.88} /></mesh>
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
    // 中文：点击后购物车向正前方短距离滚动，车轮转速与位移距离保持一致。
    // EN: On selection the cart rolls a short distance forward, with wheel rotation tied to the travelled distance.
    cart.position.z = settle * 0.24;
    cart.position.y = Math.sin(progress * Math.PI) * 0.04 * (1 - progress * 0.45);
    cart.rotation.x = Math.sin(progress * Math.PI * 2) * 0.018 * (1 - progress);
    wheelRefs.current.forEach((wheel) => {
      if (wheel) wheel.rotation.x = -settle * 4.8;
    });

    finishedRef.current = progress >= 1;
    if (!finishedRef.current) invalidate();
  });

  return (
    <group ref={cartRef} rotation={[0, -0.34, 0]}>
      {/* Arthur: NarIyirm
          中文：商品数量由冰箱库存比例控制，后续接入数据时不需要再改模型结构。
          EN: Grocery count follows the fridge inventory ratio, so later data integration won't require another model change. */}
      {Array.from({ length: visibleProductCount }, (_, index) => <CartProduct key={index} index={index} />)}

      <mesh position={[0, 0.46, 0]}><boxGeometry args={[1.06, 0.055, 0.64]} /><meshStandardMaterial color="#6E9988" metalness={0.16} roughness={0.56} /></mesh>
      {[0.54, 0.78, 1.02].map((y) => (
        <group key={y}>
          <mesh position={[0, y, -0.34]}><boxGeometry args={[1.12, 0.032, 0.032]} /><meshStandardMaterial color="#93ADA4" metalness={0.34} roughness={0.42} /></mesh>
          <mesh position={[0, y, 0.34]}><boxGeometry args={[1.12, 0.032, 0.032]} /><meshStandardMaterial color="#93ADA4" metalness={0.34} roughness={0.42} /></mesh>
        </group>
      ))}
      {BASKET_WIRES_X.map((x) => (
        <group key={x}>
          <mesh position={[x, 0.78, -0.34]}><boxGeometry args={[0.018, 0.48, 0.018]} /><meshStandardMaterial color="#91A9A1" metalness={0.38} roughness={0.4} /></mesh>
          <mesh position={[x, 0.78, 0.34]}><boxGeometry args={[0.018, 0.48, 0.018]} /><meshStandardMaterial color="#91A9A1" metalness={0.38} roughness={0.4} /></mesh>
        </group>
      ))}
      {[-0.54, 0.54].map((x) => (
        <group key={x}>
          {[0.54, 0.78, 1.02].map((y) => (
            <mesh key={y} position={[x, y, 0]}><boxGeometry args={[0.032, 0.032, 0.68]} /><meshStandardMaterial color="#93ADA4" metalness={0.34} roughness={0.42} /></mesh>
          ))}
          {BASKET_WIRES_Z.map((z) => (
            <mesh key={z} position={[x, 0.78, z]}><boxGeometry args={[0.018, 0.48, 0.018]} /><meshStandardMaterial color="#91A9A1" metalness={0.38} roughness={0.4} /></mesh>
          ))}
        </group>
      ))}

      {[-0.34, 0, 0.34].map((x) => (
        <mesh key={x} position={[x, 0.32, 0]}><boxGeometry args={[0.032, 0.032, 0.58]} /><meshStandardMaterial color="#647F76" metalness={0.26} roughness={0.5} /></mesh>
      ))}
      <mesh position={[0, 0.32, -0.26]}><boxGeometry args={[1.0, 0.045, 0.045]} /><meshStandardMaterial color="#647F76" metalness={0.26} roughness={0.5} /></mesh>
      <mesh position={[0, 0.32, 0.26]}><boxGeometry args={[1.0, 0.045, 0.045]} /><meshStandardMaterial color="#647F76" metalness={0.26} roughness={0.5} /></mesh>

      {[-0.5, 0.5].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.42, 0]}><boxGeometry args={[0.045, 0.28, 0.045]} /><meshStandardMaterial color="#58756C" metalness={0.24} roughness={0.52} /></mesh>
          <mesh position={[x, 0.92, -0.43]} rotation={[0.58, 0, 0]}><boxGeometry args={[0.045, 0.52, 0.045]} /><meshStandardMaterial color="#58756C" metalness={0.24} roughness={0.52} /></mesh>
        </group>
      ))}
      <mesh position={[0, 1.16, -0.58]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 1.22, 18]} /><meshStandardMaterial color="#D47B3B" roughness={0.62} /></mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 1.16, -0.58]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.058, 0.058, 0.18, 18]} /><meshStandardMaterial color="#A6532D" roughness={0.68} /></mesh>
      ))}

      {WHEEL_POSITIONS.map((position, index) => (
        <group key={`${position[0]}-${position[2]}`} position={position}>
          <mesh position={[0, 0.11, 0]}><boxGeometry args={[0.075, 0.18, 0.075]} /><meshStandardMaterial color="#647F76" metalness={0.28} roughness={0.5} /></mesh>
          <group ref={(group) => { wheelRefs.current[index] = group; }}>
            <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.12, 0.12, 0.08, 22]} /><meshStandardMaterial color="#30453F" roughness={0.72} /></mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.052, 0.052, 0.09, 16]} /><meshStandardMaterial color="#C5CEC9" metalness={0.42} roughness={0.38} /></mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
