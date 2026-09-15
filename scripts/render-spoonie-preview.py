import bpy
from mathutils import Vector
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "art-direction" / "spoonie-model-preview-v1.png"


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


# Arthur: NarIyirm
# 中文：用固定棚拍镜头检查发布模型的轮廓、材质和关节连接，预览不写回角色源文件。
# EN: A fixed studio camera checks silhouette, materials, and joint connections without writing preview setup into the source character file.
bpy.context.scene.render.engine = "BLENDER_EEVEE"
bpy.context.scene.render.resolution_x = 720
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.render.image_settings.file_format = "PNG"
bpy.context.scene.render.film_transparent = False
bpy.context.scene.world = bpy.data.worlds.new("Preview_World")
bpy.context.scene.world.color = (0.82, 0.84, 0.81)

bpy.ops.object.camera_add(location=(2.1, -4.2, 1.75))
camera = bpy.context.object
look_at(camera, (0, 0, 0.56))
bpy.context.scene.camera = camera
camera.data.lens = 58

bpy.ops.object.light_add(type="AREA", location=(-2.4, -3.2, 3.4))
bpy.context.object.data.energy = 760
bpy.context.object.data.shape = "DISK"
bpy.context.object.data.size = 3.0
look_at(bpy.context.object, (0, 0, 0.55))

bpy.ops.object.light_add(type="AREA", location=(2.2, -1.0, 2.0))
bpy.context.object.data.energy = 420
bpy.context.object.data.size = 2.2
look_at(bpy.context.object, (0, 0, 0.58))

bpy.ops.object.light_add(type="AREA", location=(0.5, 2.2, 2.7))
bpy.context.object.data.energy = 520
bpy.context.object.data.size = 2.0
look_at(bpy.context.object, (0, 0, 0.65))

bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.01))
floor = bpy.context.object
floor_material = bpy.data.materials.new("Preview_Floor")
floor_material.diffuse_color = (0.88, 0.87, 0.82, 1)
floor.data.materials.append(floor_material)

bpy.context.scene.render.filepath = str(OUTPUT)
bpy.ops.render.render(write_still=True)
print(f"SPOONIE_PREVIEW={OUTPUT}")
