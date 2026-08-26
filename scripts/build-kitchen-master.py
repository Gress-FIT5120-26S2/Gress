import math
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BLEND_PATH = PROJECT_ROOT / "3DModel" / "Kitchen-Home-master-lighting.blend"
GLB_PATH = PROJECT_ROOT / "3DModel" / "Kitchen-Home-rebuilt-lighting.glb"
PREVIEW_CLOSED = PROJECT_ROOT / "artifacts" / "Kitchen-Home-lighting-closed.png"
PREVIEW_OPEN = PROJECT_ROOT / "artifacts" / "Kitchen-Home-lighting-open.png"


def material(name, color, roughness=0.58, metallic=0.0, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if emission:
        shader.inputs["Emission Color"].default_value = emission[0]
        shader.inputs["Emission Strength"].default_value = emission[1]
    return mat


def empty(name, location=(0, 0, 0), parent=None, interaction=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.parent = parent
    if interaction:
        obj["interaction"] = interaction
    return obj


def finish(obj, name, mat=None, parent=None, bevel=0.0, smooth=False):
    obj.name = name
    if obj.data:
        obj.data.name = f"{name}_Mesh"
        if mat:
            obj.data.materials.append(mat)
        if smooth:
            for polygon in obj.data.polygons:
                polygon.use_smooth = True
    obj.parent = parent
    if bevel:
        modifier = obj.modifiers.new(name="Soft_Edges", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def box(name, location, dimensions, mat, parent=None, bevel=0.03, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, parent, bevel)


def cylinder(name, location, radius, depth, mat, parent=None, rotation=(0, 0, 0), vertices=24, bevel=0.015):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    return finish(bpy.context.object, name, mat, parent, bevel, smooth=True)


def cone(name, location, radius_bottom, radius_top, depth, mat, parent=None, rotation=(0, 0, 0), vertices=32, bevel=0.015):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    return finish(bpy.context.object, name, mat, parent, bevel, smooth=True)


def sphere(name, location, scale, mat, parent=None, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=location)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, parent, smooth=True)


def torus(name, location, major_radius, minor_radius, mat, parent=None, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=32,
        minor_segments=10,
        location=location,
        rotation=rotation,
    )
    return finish(bpy.context.object, name, mat, parent, smooth=True)


def pipe(name, points, radius, mat, parent=None):
    curve = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(mat)
    obj.parent = parent
    return obj


def cabinet_back(name, x, width, parent, body_mat, front_mat, knob_mat, drawers=False):
    box(f"{name}_Body", (x, 2.12, 0.48), (width, 0.72, 0.92), body_mat, parent, 0.035)
    if drawers:
        for index, z in enumerate((0.30, 0.58, 0.82), start=1):
            box(f"{name}_Drawer_{index}", (x, 1.748, z), (width - 0.10, 0.035, 0.20), front_mat, parent, 0.018)
            cylinder(f"{name}_Knob_{index}", (x, 1.716, z), 0.035, 0.055, knob_mat, parent, rotation=(math.pi / 2, 0, 0), vertices=20, bevel=0.008)
    else:
        door_width = (width - 0.13) / 2
        for index, offset in enumerate((-door_width / 2 - 0.018, door_width / 2 + 0.018), start=1):
            box(f"{name}_Door_{index}", (x + offset, 1.748, 0.46), (door_width, 0.035, 0.74), front_mat, parent, 0.025)
            knob_x = x + offset + (door_width * 0.30 if index == 1 else -door_width * 0.30)
            cylinder(f"{name}_Knob_{index}", (knob_x, 1.715, 0.52), 0.035, 0.055, knob_mat, parent, rotation=(math.pi / 2, 0, 0), vertices=20, bevel=0.008)


def cabinet_left(name, y, length, parent, body_mat, front_mat, knob_mat):
    box(f"{name}_Body", (-2.66, y, 0.48), (0.72, length, 0.92), body_mat, parent, 0.035)
    panel_count = max(1, round(length / 0.72))
    panel_length = (length - 0.10 - (panel_count - 1) * 0.04) / panel_count
    start = y - (length / 2) + 0.05 + panel_length / 2
    for index in range(panel_count):
        panel_y = start + index * (panel_length + 0.04)
        box(f"{name}_Door_{index + 1}", (-2.278, panel_y, 0.46), (0.035, panel_length, 0.74), front_mat, parent, 0.025)
        cylinder(f"{name}_Knob_{index + 1}", (-2.246, panel_y, 0.54), 0.035, 0.055, knob_mat, parent, rotation=(0, math.pi / 2, 0), vertices=20, bevel=0.008)


def plant(name, location, scale, parent, pot_mat, leaf_mat):
    x, y, z = location
    cylinder(f"{name}_Pot", (x, y, z + 0.11 * scale), 0.14 * scale, 0.22 * scale, pot_mat, parent, vertices=20, bevel=0.02 * scale)
    for index, angle in enumerate((0, 72, 144, 216, 288), start=1):
        radians = math.radians(angle)
        leaf_x = x + math.cos(radians) * 0.12 * scale
        leaf_y = y + math.sin(radians) * 0.12 * scale
        sphere(f"{name}_Leaf_{index}", (leaf_x, leaf_y, z + 0.29 * scale), (0.08 * scale, 0.16 * scale, 0.055 * scale), leaf_mat, parent)


def book_stack(name, location, parent, colors, scale=1.0):
    x, y, z = location
    for index, color in enumerate(colors):
        box(f"{name}_{index + 1}", (x, y, z + index * 0.09 * scale), (0.42 * scale, 0.28 * scale, 0.075 * scale), color, parent, 0.018 * scale)


def point_camera(camera, target):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 900
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 28

world = bpy.data.worlds.new("KitchMemo_World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.52, 0.82, 0.86, 1.0)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7

salmon = material("Wall_Salmon", (0.78, 0.36, 0.29, 1), 0.72)
salmon_light = material("Brick_Light", (0.92, 0.55, 0.46, 1), 0.68)
salmon_dark = material("Brick_Dark", (0.66, 0.25, 0.20, 1), 0.72)
tile = material("Floor_Tile", (0.80, 0.82, 0.82, 1), 0.78)
grout = material("Floor_Grout", (0.62, 0.67, 0.68, 1), 0.82)
ivory = material("Cabinet_Ivory", (0.84, 0.84, 0.66, 1), 0.66)
cream = material("Cabinet_Cream", (0.93, 0.90, 0.72, 1), 0.63)
peach = material("Counter_Peach", (0.84, 0.48, 0.30, 1), 0.58)
wood = material("Warm_Wood", (0.58, 0.28, 0.12, 1), 0.62)
wood_light = material("Light_Wood", (0.76, 0.48, 0.25, 1), 0.62)
mint = material("Stove_Mint", (0.38, 0.62, 0.48, 1), 0.52)
mint_dark = material("Stove_Trim", (0.12, 0.24, 0.20, 1), 0.42)
fridge_white = material("Fridge_White", (0.88, 0.90, 0.84, 1), 0.42)
fridge_inner = material("Fridge_Inner", (0.76, 0.88, 0.86, 1), 0.42)
glass = material("Glass_Blue", (0.38, 0.65, 0.68, 1), 0.25, 0.10)
metal = material("Brushed_Metal", (0.38, 0.43, 0.40, 1), 0.30, 0.72)
black = material("Cooktop_Dark", (0.055, 0.070, 0.065, 1), 0.30, 0.10)
blue = material("Pastel_Blue", (0.35, 0.62, 0.72, 1), 0.58)
blue_dark = material("Rug_Blue_Dark", (0.25, 0.45, 0.54, 1), 0.72)
red = material("Food_Red", (0.80, 0.12, 0.08, 1), 0.65)
yellow = material("Food_Yellow", (0.94, 0.65, 0.12, 1), 0.68)
green = material("Plant_Green", (0.24, 0.58, 0.35, 1), 0.68)
green_light = material("Plant_Light", (0.43, 0.73, 0.48, 1), 0.68)
purple = material("Food_Purple", (0.47, 0.28, 0.55, 1), 0.66)
ceramic = material("Ceramic", (0.82, 0.88, 0.82, 1), 0.38)
lamp_mat = material("Fridge_Lamp", (1.0, 0.88, 0.48, 1), 0.26, emission=((1.0, 0.70, 0.24, 1), 2.4))
lamp_shade = material("Ceiling_Lamp_Shade", (0.92, 0.66, 0.31, 1), 0.42)
lamp_bulb = material("Ceiling_Lamp_Bulb", (1.0, 0.88, 0.56, 1), 0.22, emission=((1.0, 0.73, 0.30, 1), 2.8))

root = empty("Kitchen_Root", interaction="kitchen-root")

# Arthur: NarIyirm
# 中文：房间、家电和交互组件从一开始就是独立节点，避免再次依赖合并网格的面片切割。
# EN: The room, appliances, and interactive parts start as separate nodes, avoiding face extraction from a merged mesh.
room = empty("Room_Static", parent=root)
box("Floor_Base", (0, 0, -0.10), (6.4, 5.5, 0.20), tile, room, 0.045)
box("Back_Wall", (0, 2.64, 1.50), (6.4, 0.18, 3.0), salmon, room, 0.035)
box("Left_Wall", (-3.12, 0, 1.50), (0.18, 5.45, 3.0), salmon, room, 0.035)

for index, x in enumerate([value * 0.5 for value in range(-6, 7)], start=1):
    box(f"Floor_Grout_X_{index}", (x, 0, 0.012), (0.018, 5.25, 0.012), grout, room, 0.003)
for index, y in enumerate([value * 0.5 for value in range(-5, 6)], start=1):
    box(f"Floor_Grout_Y_{index}", (0, y, 0.014), (6.15, 0.018, 0.014), grout, room, 0.003)

back_bricks = [(-2.45, 1.6), (-1.9, 2.25), (-1.3, 1.78), (-0.65, 2.40), (-0.10, 1.62), (0.55, 2.18), (1.15, 1.68), (1.75, 2.38), (2.4, 1.70)]
for index, (x, z) in enumerate(back_bricks, start=1):
    brick_mat = salmon_light if index % 3 else salmon_dark
    box(f"Back_Brick_{index}", (x, 2.535, z), (0.34, 0.045, 0.14), brick_mat, room, 0.018)
    if index % 2 == 0:
        box(f"Back_Brick_Short_{index}", (x + 0.27, 2.535, z - 0.19), (0.25, 0.045, 0.12), salmon_light, room, 0.016)

for index, (y, z) in enumerate(((-1.85, 1.60), (-1.25, 2.25), (-0.60, 1.82), (0.08, 2.36), (0.80, 1.62), (1.45, 2.22)), start=1):
    box(f"Left_Brick_{index}", (-3.015, y, z), (0.045, 0.34, 0.14), salmon_dark if index % 3 == 0 else salmon_light, room, 0.018)

box("Window_Glass", (-3.005, 0.35, 1.83), (0.035, 1.42, 1.10), glass, room, 0.012)
for name, y, z, dimensions in (
    ("Window_Frame_Top", 0.35, 2.42, (0.10, 1.62, 0.10)),
    ("Window_Frame_Bottom", 0.35, 1.24, (0.10, 1.62, 0.10)),
    ("Window_Frame_Front", -0.42, 1.83, (0.10, 0.10, 1.28)),
    ("Window_Frame_Back", 1.12, 1.83, (0.10, 0.10, 1.28)),
    ("Window_Frame_Cross", 0.35, 1.83, (0.10, 1.48, 0.075)),
):
    box(name, (-2.975, y, z), dimensions, wood, room, 0.018)

cabinet_root = empty("Cabinet_Run", parent=root)
cabinet_left("Left_Cabinets", 0.56, 3.48, cabinet_root, ivory, cream, wood)
cabinet_back("Back_Cabinet_Left", -1.82, 1.28, cabinet_root, ivory, cream, wood)
cabinet_back("Back_Cabinet_Drawers", -0.56, 1.10, cabinet_root, ivory, cream, wood, drawers=True)
box("Left_Countertop", (-2.66, 0.56, 1.00), (0.84, 3.55, 0.14), peach, cabinet_root, 0.055)
box("Back_Countertop", (-1.16, 2.12, 1.00), (2.65, 0.84, 0.14), peach, cabinet_root, 0.055)

sink = empty("Sink", parent=root, interaction="sink")
box("Sink_Basin", (-2.64, 0.55, 1.035), (0.58, 0.90, 0.10), glass, sink, 0.055)
box("Sink_Inner", (-2.64, 0.55, 1.085), (0.45, 0.75, 0.035), black, sink, 0.040)
pipe("Faucet", [(-2.42, 0.93, 1.08), (-2.34, 0.93, 1.45), (-2.52, 0.74, 1.53), (-2.62, 0.64, 1.34)], 0.035, metal, sink)
cylinder("Faucet_Base", (-2.42, 0.93, 1.12), 0.075, 0.10, metal, sink, vertices=24, bevel=0.012)

for index, y in enumerate((1.20, 1.03, 0.86, 0.69, 0.52), start=1):
    cylinder(f"Plate_{index}", (-2.23, y, 1.34), 0.20, 0.035, ceramic, root, rotation=(math.pi / 2, 0, 0), vertices=32, bevel=0.008)
box("Plate_Rack_Base", (-2.23, 0.86, 1.12), (0.34, 0.90, 0.06), wood_light, root, 0.018)
torus("Tomato_Bowl", (-2.56, -0.48, 1.16), 0.22, 0.055, blue_dark, root)
for index, (dx, dy) in enumerate(((-0.13, 0), (0, 0), (0.13, 0), (-0.06, 0.10), (0.07, 0.10), (0, -0.10)), start=1):
    sphere(f"Tomato_{index}", (-2.56 + dx, -0.48 + dy, 1.22), (0.075, 0.075, 0.075), red, root)

stove = empty("Stove", location=(0.90, 2.08, 0), parent=root, interaction="stove")
box("Stove_Body", (0, 0, 0.60), (1.15, 0.78, 1.20), mint, stove, 0.065)
box("Stove_Top", (0, -0.015, 1.22), (1.18, 0.82, 0.10), black, stove, 0.035)
box("Oven_Window", (0, -0.405, 0.53), (0.72, 0.045, 0.46), mint_dark, stove, 0.045)
cylinder("Oven_Handle", (0, -0.48, 0.90), 0.045, 0.88, metal, stove, rotation=(0, math.pi / 2, 0), vertices=24, bevel=0.012)
for index, x in enumerate((-0.37, -0.12, 0.13, 0.38), start=1):
    cylinder(f"Stove_Knob_{index}", (x, -0.425, 1.04), 0.075, 0.07, metal, stove, rotation=(math.pi / 2, 0, 0), vertices=24, bevel=0.012)

burners = {
    "Burner_Front_Left": (-0.28, -0.20, 1.29),
    "Burner_Front_Right": (0.28, -0.20, 1.29),
    "Burner_Back_Left": (-0.28, 0.19, 1.29),
    "Burner_Back_Right": (0.28, 0.19, 1.29),
}
for name, location in burners.items():
    torus(name, location, 0.19, 0.040, black, stove)
    cylinder(f"{name}_Cap", (location[0], location[1], location[2] - 0.012), 0.12, 0.028, black, stove, vertices=32, bevel=0.008)

# Arthur: NarIyirm
# 中文：两个命名锚点直接位于前排炉圈中心，Three.js 可读取坐标生成火焰，无需再猜测位置。
# EN: Two named anchors sit at the front burner centers so Three.js can place flames without estimated coordinates.
empty("Stove_Burner_Left_Anchor", burners["Burner_Front_Left"], stove, "stove-burner")
empty("Stove_Burner_Right_Anchor", burners["Burner_Front_Right"], stove, "stove-burner")

fridge = empty("Fridge", location=(2.20, 2.08, 0), parent=root, interaction="fridge")
box("Fridge_Back", (0, 0.30, 1.22), (1.28, 0.09, 2.44), fridge_white, fridge, 0.055)
box("Fridge_Left_Wall", (-0.60, 0, 1.22), (0.10, 0.72, 2.44), fridge_white, fridge, 0.055)
box("Fridge_Right_Wall", (0.60, 0, 1.22), (0.10, 0.72, 2.44), fridge_white, fridge, 0.055)
box("Fridge_Top", (0, 0, 2.39), (1.28, 0.72, 0.10), fridge_white, fridge, 0.055)
box("Fridge_Bottom", (0, 0, 0.06), (1.28, 0.72, 0.12), fridge_white, fridge, 0.055)
interior = empty("Fridge_Interior", parent=fridge, interaction="fridge-interior")
box("Fridge_Interior_Back", (0, 0.245, 1.22), (1.05, 0.035, 2.20), fridge_inner, interior, 0.035)
for index, z in enumerate((0.53, 1.05, 1.57, 2.05), start=1):
    box(f"Fridge_Shelf_{index}", (0, 0.02, z), (1.02, 0.53, 0.055), glass, interior, 0.020)
box("Fridge_Lamp", (0, -0.26, 2.22), (0.32, 0.045, 0.08), lamp_mat, interior, 0.025)
empty("Fridge_Light_Anchor", (0, -0.31, 2.12), interior, "fridge-light")

for index, x in enumerate((-0.39, -0.13, 0.13, 0.39), start=1):
    cylinder(f"Fridge_Jar_{index}", (x, 0.02, 2.16), 0.095, 0.22, (red, yellow, green, purple)[index - 1], interior, vertices=20, bevel=0.018)
for index, (x, mat) in enumerate(((-0.38, blue), (-0.12, red)), start=1):
    cylinder(f"Fridge_Bottle_{index}", (x, 0.00, 1.32), 0.09, 0.37, mat, interior, vertices=20, bevel=0.018)
    cylinder(f"Fridge_Bottle_Cap_{index}", (x, 0.00, 1.55), 0.055, 0.09, cream, interior, vertices=18, bevel=0.012)
box("Fridge_Milk", (0.18, 0.00, 1.32), (0.26, 0.28, 0.45), cream, interior, 0.035)
box("Fridge_Juice", (0.43, 0.00, 1.32), (0.20, 0.26, 0.43), yellow, interior, 0.035)
for index, (x, mat) in enumerate(((-0.38, red), (-0.16, yellow), (0.07, red), (0.29, green), (0.45, purple)), start=1):
    sphere(f"Fridge_Produce_{index}", (x, -0.03, 0.74), (0.11, 0.10, 0.10), mat, interior)
box("Fridge_Drawer", (0, 0.02, 0.30), (1.00, 0.50, 0.28), fridge_inner, interior, 0.035)

door_pivot = empty("Fridge_Door_Pivot", (0.65, -0.37, 0), fridge, "fridge-door")
box("Fridge_Door", (-0.65, -0.055, 1.22), (1.30, 0.11, 2.44), fridge_white, door_pivot, 0.075)
box("Fridge_Door_Seam", (-0.65, -0.119, 1.68), (1.16, 0.025, 0.035), metal, door_pivot, 0.008)
cylinder("Fridge_Handle_Upper", (-1.11, -0.155, 1.96), 0.035, 0.50, metal, door_pivot, vertices=20, bevel=0.010)
cylinder("Fridge_Handle_Lower", (-1.11, -0.155, 1.27), 0.035, 0.38, metal, door_pivot, vertices=20, bevel=0.010)
for index, z in enumerate((0.78, 1.45), start=1):
    box(f"Fridge_Door_Bin_{index}", (-0.65, 0.035, z), (0.90, 0.20, 0.22), fridge_inner, door_pivot, 0.025)

# Arthur: NarIyirm
# 中文：门的原点固定在右侧真实铰链处，动画只旋转 Pivot，门板、把手和门架会作为整体移动。
# EN: The pivot sits on the real right hinge, so rotating it moves the door, handles, and bins as one assembly.
door_pivot.rotation_mode = "XYZ"
door_pivot.rotation_euler = (0, 0, 0)
door_pivot.keyframe_insert(data_path="rotation_euler", frame=1)
door_pivot.rotation_euler.z = math.radians(104)
door_pivot.keyframe_insert(data_path="rotation_euler", frame=28)
if door_pivot.animation_data and door_pivot.animation_data.action:
    door_pivot.animation_data.action.name = "Fridge_Door_Open"

table = empty("Dining_Table", location=(-0.15, -0.75, 0), parent=root, interaction="recipes")
box("Dining_Table_Top", (0, 0, 0.78), (1.55, 1.02, 0.14), wood_light, table, 0.075)
for index, (x, y) in enumerate(((-0.60, -0.34), (0.60, -0.34), (-0.60, 0.34), (0.60, 0.34)), start=1):
    box(f"Dining_Table_Leg_{index}", (x, y, 0.38), (0.13, 0.13, 0.76), wood, table, 0.035)
box("Recipe_Book", (0.08, 0.02, 0.89), (0.55, 0.38, 0.07), cream, table, 0.025, rotation=(0, 0, math.radians(-8)))
cylinder("Table_Plate", (-0.43, 0.05, 0.89), 0.20, 0.035, ceramic, table, vertices=32, bevel=0.010)

cylinder("Rug_Outer", (-0.15, -0.75, 0.025), 1.08, 0.035, blue_dark, root, vertices=64, bevel=0.010)
cylinder("Rug_Middle", (-0.15, -0.75, 0.048), 0.76, 0.025, blue, root, vertices=64, bevel=0.008)
cylinder("Rug_Inner", (-0.15, -0.75, 0.066), 0.40, 0.020, glass, root, vertices=64, bevel=0.006)

# Arthur: NarIyirm
# 中文：吊灯外观和锚点写进模型，真实光源强度由 App 根据时间控制。
# EN: The pendant and anchors live in the model while the app controls real light intensity from local time.
ceiling_lamp = empty("Ceiling_Lamp", location=(-0.15, -0.75, 0), parent=root, interaction="ceiling-light")
cylinder("Ceiling_Lamp_Cord", (0, 0, 3.10), 0.018, 0.24, metal, ceiling_lamp, vertices=16, bevel=0.004)
cone("Ceiling_Lamp_Shade", (0, 0, 2.88), 0.34, 0.15, 0.30, lamp_shade, ceiling_lamp, bevel=0.020)
sphere("Ceiling_Lamp_Bulb", (0, 0, 2.70), (0.105, 0.105, 0.13), lamp_bulb, ceiling_lamp, subdivisions=3)
empty("Ceiling_Light_Anchor", (-0.15, -0.75, 2.69), root, "ceiling-light")
empty("Window_Light_Anchor", (-2.95, 0.35, 1.82), root, "window-light")
empty("Sun_Anchor", (0, 3.15, 3.65), root, "sun")
empty("Moon_Anchor", (0, 3.15, 3.65), root, "moon")

decor = empty("Kitchen_Decor", parent=root)
box("Shelf_Left", (-1.95, 2.47, 2.12), (1.35, 0.32, 0.11), wood_light, decor, 0.035)
box("Shelf_Right", (0.12, 2.47, 2.05), (1.55, 0.32, 0.11), wood_light, decor, 0.035)
for index, (x, mat) in enumerate(((-2.40, green), (-2.20, blue_dark), (-2.00, yellow), (-1.80, cream)), start=1):
    box(f"Shelf_Book_{index}", (x, 2.40, 2.42), (0.15, 0.28, 0.52 - index * 0.025), mat, decor, 0.018, rotation=(0, 0, math.radians((index - 2) * 3)))
plant("Shelf_Plant", (-1.50, 2.36, 2.22), 0.65, decor, salmon_dark, green_light)
for index, x in enumerate((-0.42, -0.08, 0.26, 0.58), start=1):
    cylinder(f"Shelf_Jar_{index}", (x, 2.38, 2.25), 0.12, 0.28, (ceramic, yellow, salmon_light, cream)[index - 1], decor, vertices=20, bevel=0.020)

for index, (x, z, radius) in enumerate(((-1.75, 1.66, 0.25), (-1.35, 1.72, 0.20), (-0.98, 1.62, 0.23)), start=1):
    cylinder(f"Hanging_Pan_{index}", (x, 2.48, z), radius, 0.055, black, decor, rotation=(math.pi / 2, 0, 0), vertices=32, bevel=0.010)
    box(f"Hanging_Pan_Handle_{index}", (x, 2.46, z + radius + 0.18), (0.09, 0.055, 0.38), wood, decor, 0.022)

sphere("Kettle_Body", (-0.12, 2.00, 1.28), (0.24, 0.22, 0.20), salmon_dark, decor)
cylinder("Kettle_Lid", (-0.12, 2.00, 1.49), 0.12, 0.055, wood, decor, vertices=24, bevel=0.012)
pipe("Kettle_Handle", [(-0.30, 2.00, 1.35), (-0.27, 2.00, 1.65), (0.03, 2.00, 1.68), (0.07, 2.00, 1.40)], 0.030, wood, decor)
pipe("Kettle_Spout", [(0.08, 2.00, 1.35), (0.30, 2.00, 1.45), (0.39, 2.00, 1.62)], 0.045, salmon_dark, decor)

plant("Floor_Plant", (-2.72, -1.78, 0.22), 1.05, decor, salmon_dark, green_light)
cylinder("Plant_Stool_Top", (-2.72, -1.78, 0.27), 0.25, 0.11, wood_light, decor, vertices=24, bevel=0.035)
for index, (dx, dy) in enumerate(((-0.13, -0.10), (0.13, -0.10), (-0.13, 0.10), (0.13, 0.10)), start=1):
    box(f"Plant_Stool_Leg_{index}", (-2.72 + dx, -1.78 + dy, 0.13), (0.06, 0.06, 0.27), wood, decor, 0.018)

empty("Hotspot_Fridge", (2.20, 1.55, 1.55), root, "fridge")
empty("Hotspot_Stove", (0.90, 1.55, 1.18), root, "stove")
empty("Hotspot_Recipes", (-0.15, -0.75, 1.10), root, "recipes")

bpy.ops.object.light_add(type="AREA", location=(3.8, -4.5, 7.8))
key_light = bpy.context.object
key_light.name = "Preview_Key_Light"
key_light.data.energy = 1050
key_light.data.shape = "DISK"
key_light.data.size = 5.0
point_camera(key_light, (0, 0.4, 1.1))
bpy.ops.object.light_add(type="AREA", location=(-4.5, -1.0, 4.2))
fill_light = bpy.context.object
fill_light.name = "Preview_Fill_Light"
fill_light.data.energy = 550
fill_light.data.color = (0.62, 0.82, 1.0)
fill_light.data.size = 4.0
point_camera(fill_light, (-0.8, 0.5, 1.2))

bpy.ops.object.camera_add(location=(7.8, -10.2, 7.6))
camera = bpy.context.object
camera.name = "Preview_Camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 7.4
point_camera(camera, (0.0, 0.15, 1.25))
scene.camera = camera
scene.view_settings.look = "AgX - Medium High Contrast"

BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
PREVIEW_CLOSED.parent.mkdir(parents=True, exist_ok=True)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

# Arthur: NarIyirm
# 中文：GLB 只输出模型、命名节点、材质和动画；预览相机与灯光留在 .blend 中供后续修改。
# EN: The GLB exports only model data, named nodes, materials, and animation; preview cameras and lights remain in the .blend.
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    export_animations=True,
    export_extras=True,
    export_cameras=False,
    export_lights=False,
)

scene.render.filepath = str(PREVIEW_CLOSED)
bpy.ops.render.render(write_still=True)
scene.frame_set(28)
scene.render.filepath = str(PREVIEW_OPEN)
bpy.ops.render.render(write_still=True)

print(f"Blender master: {BLEND_PATH}")
print(f"App GLB: {GLB_PATH}")
print(f"Closed preview: {PREVIEW_CLOSED}")
print(f"Open preview: {PREVIEW_OPEN}")
