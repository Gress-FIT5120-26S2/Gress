import bpy
from mathutils import Vector
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "models" / "Kitchen-Home-rebuilt-lighting.glb"
IMPORTANT_NAMES = (
    "Hotspot_Fridge",
    "Hotspot_Recipes",
    "Hotspot_St",
    "Fridge_Door_Pivot",
)


# Arthur: NarIyirm
# 中文：导入发布用 GLB 并打印场景边界及交互锚点，角色路线因此使用实际世界坐标而不是目测值。
# EN: Import the shipping GLB and print scene bounds plus interaction anchors so character routes use real world coordinates instead of guesses.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(MODEL))
bpy.context.view_layer.update()

corners = []
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)

minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
print(f"SCENE_BOUNDS min={tuple(round(value, 3) for value in minimum)} max={tuple(round(value, 3) for value in maximum)}")

for name in IMPORTANT_NAMES:
    obj = bpy.data.objects.get(name)
    if obj:
        position = obj.matrix_world.translation
        print(f"ANCHOR {name}={tuple(round(value, 3) for value in position)}")

for obj in sorted(bpy.context.scene.objects, key=lambda item: item.name):
    lowered = obj.name.lower()
    if any(token in lowered for token in ("cart", "recipe", "table", "stove", "fridge")):
        position = obj.matrix_world.translation
        print(f"NODE {obj.name} type={obj.type} position={tuple(round(value, 3) for value in position)}")
