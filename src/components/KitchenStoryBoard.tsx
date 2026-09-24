import { Shape } from 'three';

const playMark = new Shape();
playMark.moveTo(-0.075, -0.105);
playMark.lineTo(0.115, 0);
playMark.lineTo(-0.075, 0.105);
playMark.closePath();

export const KITCHEN_STORY_BOARD_POSITION: [number, number, number] = [-1.08, 1.59, -2.43];

export function KitchenStoryBoard() {
  return (
    <group rotation={[0, 0, -0.035]}>
      <mesh>
        <boxGeometry args={[0.97, 0.75, 0.085]} />
        <meshStandardMaterial color="#9A6740" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0, 0.052]}>
        <boxGeometry args={[0.87, 0.65, 0.015]} />
        <meshStandardMaterial color="#183D32" roughness={0.96} />
      </mesh>
      <mesh position={[-0.25, 0.23, 0.064]}>
        <boxGeometry args={[0.25, 0.019, 0.008]} />
        <meshBasicMaterial color="#F4D18F" />
      </mesh>
      <mesh position={[0, 0.025, 0.07]}>
        <circleGeometry args={[0.18, 32]} />
        <meshBasicMaterial color="#FFF1D5" />
      </mesh>
      <mesh position={[0.012, 0.025, 0.077]}>
        <shapeGeometry args={[playMark]} />
        <meshBasicMaterial color="#173B31" />
      </mesh>
      {[-0.23, -0.30].map((y, index) => (
        <mesh key={y} position={[0, y, 0.065]}>
          <boxGeometry args={[index === 0 ? 0.55 : 0.38, 0.018, 0.008]} />
          <meshBasicMaterial color="#E8E8D7" />
        </mesh>
      ))}
      <mesh position={[0.32, -0.29, 0.071]} rotation={[0, 0, -0.38]}>
        <boxGeometry args={[0.08, 0.02, 0.012]} />
        <meshStandardMaterial color="#F5D99F" roughness={0.95} />
      </mesh>
    </group>
  );
}
