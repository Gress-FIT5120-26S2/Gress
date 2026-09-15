import bpy
from mathutils import Vector
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "docs" / "art-direction"


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


# Arthur: NarIyirm
# 中文：从最终绑定文件分别渲染静止与步态关键帧，直接暴露肩部、围裙和腿部可能出现的蒙皮穿插。
# EN: Render idle and gait keyframes from the final rigged file to expose skin intersections around shoulders, apron, and legs.
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
if scene.world is None:
    scene.world = bpy.data.worlds.new("Spoonie_V2_Preview_World")
scene.world.color = (0.035, 0.045, 0.04)

bpy.ops.object.camera_add(location=(1.85, -4.0, 1.62))
camera = bpy.context.object
camera.data.lens = 62
look_at(camera, (0, 0, 0.56))
scene.camera = camera

for location, energy, size in (
    ((-2.2, -2.8, 3.4), 780, 2.8),
    ((2.0, -1.0, 2.2), 480, 2.0),
    ((0.3, 2.0, 2.8), 560, 1.8),
):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    look_at(light, (0, 0, 0.58))

bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.006))
floor = bpy.context.object
floor_material = bpy.data.materials.new("Preview_Floor")
floor_material.diffuse_color = (0.12, 0.14, 0.13, 1)
floor.data.materials.append(floor_material)

armature = bpy.data.objects["Spoonie_Rig"]
armature.animation_data_create()
for action_name, frame in (("Idle_Breathe", 24), ("Walk", 7), ("Inspect_Cart", 35)):
    armature.animation_data.action = bpy.data.actions[action_name]
    scene.frame_set(frame)
    scene.render.filepath = str(OUTPUT_DIR / f"spoonie-v2-{action_name.lower()}.png")
    bpy.ops.render.render(write_still=True)
    print(f"SPOONIE_V2_PREVIEW={scene.render.filepath}")
