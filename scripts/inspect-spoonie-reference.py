import bpy
import json
from mathutils import Vector
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "new-sponine.glb"
PREVIEW_PATH = ROOT / "docs" / "art-direction" / "new-sponine-reference-preview.png"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(MODEL_PATH))


def scene_bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
minimum, maximum = scene_bounds(meshes)
center = (minimum + maximum) / 2
size = maximum - minimum
triangles = sum(len(mesh.data.loop_triangles) for mesh in meshes if not mesh.data.calc_loop_triangles())
if triangles == 0:
    triangles = sum(len(mesh.data.loop_triangles) for mesh in meshes)

# Arthur: NarIyirm
# 中文：先量化高模的三角面、贴图、骨骼和包围盒，再决定移动端版本的减面比例，避免凭文件大小盲目压缩。
# EN: Measure triangles, textures, bones, and bounds before choosing a mobile reduction ratio instead of compressing blindly by file size.
report = {
    "file_bytes": MODEL_PATH.stat().st_size,
    "objects": len(bpy.context.scene.objects),
    "meshes": len(meshes),
    "vertices": sum(len(obj.data.vertices) for obj in meshes),
    "triangles": triangles,
    "materials": len(bpy.data.materials),
    "images": [
        {"name": image.name, "width": image.size[0], "height": image.size[1], "packed": bool(image.packed_file)}
        for image in bpy.data.images
        if image.size[0] and image.size[1]
    ],
    "bounds_min": [round(value, 4) for value in minimum],
    "bounds_max": [round(value, 4) for value in maximum],
    "size": [round(value, 4) for value in size],
    "armatures": [
        {"name": armature.name, "bones": len(armature.data.bones)} for armature in armatures
    ],
    "actions": [action.name for action in bpy.data.actions],
}
print("SPOONIE_REFERENCE=" + json.dumps(report, ensure_ascii=False))

# Arthur: NarIyirm
# 中文：自动按模型包围盒布置无损棚拍预览，便于直接比较高模轮廓与当前移动端角色。
# EN: Frame a non-destructive studio preview from the model bounds so its silhouette can be compared directly with the current mobile character.
bpy.context.scene.render.engine = "BLENDER_EEVEE"
bpy.context.scene.render.resolution_x = 720
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.render.image_settings.file_format = "PNG"
bpy.context.scene.world = bpy.data.worlds.new("Reference_Preview_World")
bpy.context.scene.world.color = (0.04, 0.05, 0.045)

radius = max(size.x, size.y, size.z)
distance = radius * 2.5
bpy.ops.object.camera_add(location=(center.x, center.y - distance, center.z + size.z * 0.08))
camera = bpy.context.object
camera.data.lens = 62
look_at(camera, center)
bpy.context.scene.camera = camera

for location, energy, area_size in (
    ((center.x - radius, center.y - radius, maximum.z + radius), 950, radius * 1.8),
    ((center.x + radius, center.y - radius * 0.25, center.z + radius * 0.3), 520, radius * 1.4),
    ((center.x, center.y + radius, maximum.z), 650, radius * 1.2),
):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = area_size
    look_at(light, center)

bpy.context.scene.render.filepath = str(PREVIEW_PATH)
bpy.ops.render.render(write_still=True)
print(f"SPOONIE_REFERENCE_PREVIEW={PREVIEW_PATH}")
