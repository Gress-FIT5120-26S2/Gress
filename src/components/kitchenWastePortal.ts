export const KITCHEN_WASTE_BIN_POSITION: [number, number, number] = [-2.72, 0.02, 1.78];
export const WASTE_PORTAL_DURATION = 1900;
export const WASTE_BIN_OPENING_HEIGHT = 0.89;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

// Arthur: NarIyirm
// 中文：桶盖、旋涡和镜头共用点击后的毫秒时间轴；先露出桶口，再吸入，最后以全黑遮住页面交接。
// EN: Lid, vortex and camera share milliseconds since the tap: reveal the opening, pull inward, then cover the page handoff in black.
export function getWastePortalFrame(elapsed: number) {
  const progress = clamp(elapsed / WASTE_PORTAL_DURATION);
  const lid = 1 - Math.pow(1 - clamp(elapsed / 420), 3);
  const aim = smooth(clamp(elapsed / 650));
  const pull = smooth(clamp((elapsed - 560) / 1160));
  const vortex = smooth(clamp((elapsed - 240) / 360));
  const fade = smooth(clamp((elapsed - 1550) / 250));
  const roll = Math.sin(pull * Math.PI / 2) * Math.PI * 0.7;
  return { progress, lid, aim, pull, vortex, fade, roll };
}
