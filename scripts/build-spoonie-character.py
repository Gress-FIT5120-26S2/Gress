import bpy
import math
from mathutils import Vector
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "Spoonie-Character-v1.glb"
BLEND_PATH = ROOT / "models" / "Spoonie-Character-v1.blend"
FRAME_RATE = 30

bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, roughness=0.72, metallic=0.0):
    linear_color = tuple(
        channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4
        for channel in color
    )
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*linear_color, 1.0)
    # Arthur: NarIyirm
    # 中文：Blender 5.2 不再假定新材质已有默认节点，因此显式建立 PBR 输出以保证 GLB 颜色和粗糙度稳定。
    # EN: Blender 5.2 no longer guarantees default nodes on a new material, so create the PBR output explicitly for stable GLB colour and roughness.
    nodes = value.node_tree.nodes
    nodes.clear()
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    output = nodes.new("ShaderNodeOutputMaterial")
    principled.inputs["Base Color"].default_value = (*linear_color, 1.0)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    value.node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    return value


MINT = material("Spoonie_Mint", (0.31, 0.78, 0.61), 0.62)
MINT_DARK = material("Spoonie_Mint_Dark", (0.20, 0.57, 0.43), 0.7)
CREAM = material("Spoonie_Cream", (0.95, 0.89, 0.72), 0.76)
ORANGE = material("Spoonie_Orange", (1.0, 0.34, 0.05), 0.58)
GREEN = material("Spoonie_Face_Green", (0.03, 0.25, 0.16), 0.55)
BLUSH = material("Spoonie_Blush", (1.0, 0.49, 0.30), 0.75)


def smooth(object_value):
    if object_value.type == "MESH":
        for polygon in object_value.data.polygons:
            polygon.use_smooth = True


def uv_sphere(name, location, scale, material_value, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    value = bpy.context.object
    value.name = name
    value.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    value.data.materials.append(material_value)
    smooth(value)
    return value


def curve_object(name, points, material_value, bevel_depth=0.012):
    curve_data = bpy.data.curves.new(name, "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = bevel_depth
    curve_data.bevel_resolution = 2
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    value = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(value)
    value.data.materials.append(material_value)
    return value


def bone_parent(obj, armature, bone_name):
    world = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world


def add_bone(armature, name, head, tail, parent=None):
    bone = armature.data.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    if parent:
        bone.parent = armature.data.edit_bones[parent]
    return bone


def key_pose(pose_bone, frame, location=None, rotation=None, scale=None):
    if location is not None:
        pose_bone.location = location
        pose_bone.keyframe_insert("location", frame=frame, group=pose_bone.name)
    if rotation is not None:
        pose_bone.rotation_euler = rotation
        pose_bone.keyframe_insert("rotation_euler", frame=frame, group=pose_bone.name)
    if scale is not None:
        pose_bone.scale = scale
        pose_bone.keyframe_insert("scale", frame=frame, group=pose_bone.name)


def new_action(armature, name, frame_end):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = action
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = frame_end
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.location = (0, 0, 0)
        bone.rotation_euler = (0, 0, 0)
        bone.scale = (1, 1, 1)
    return action


def set_linear_interpolation(action):
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                for curve in channelbag.fcurves:
                    for keyframe in curve.keyframe_points:
                        keyframe.interpolation = "LINEAR"


# Arthur: NarIyirm
# 中文：角色由少量圆润刚性部件绑定到真实骨骼，既保留软陶外观，也避免移动端蒙皮网格带来的额外顶点成本。
# EN: A small set of rounded rigid parts binds to real bones, preserving the clay look without the extra skinned-vertex cost on mobile.
bpy.context.scene.render.fps = FRAME_RATE
bpy.context.scene.unit_settings.system = "METRIC"

armature_data = bpy.data.armatures.new("Spoonie_Rig")
armature = bpy.data.objects.new("Spoonie_Rig", armature_data)
bpy.context.collection.objects.link(armature)
bpy.context.view_layer.objects.active = armature
armature.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
add_bone(armature, "Root", (0, 0, 0), (0, 0, 0.18))
add_bone(armature, "Body", (0, 0, 0.28), (0, 0, 0.78), "Root")
add_bone(armature, "Arm.L", (-0.31, 0, 0.70), (-0.45, -0.01, 0.44), "Body")
add_bone(armature, "Arm.R", (0.31, 0, 0.70), (0.45, -0.01, 0.44), "Body")
add_bone(armature, "Leg.L", (-0.16, 0, 0.27), (-0.16, 0, 0.08), "Root")
add_bone(armature, "Leg.R", (0.16, 0, 0.27), (0.16, 0, 0.08), "Root")
bpy.ops.object.mode_set(mode="POSE")
for pose_bone in armature.pose.bones:
    pose_bone.rotation_mode = "XYZ"
bpy.ops.object.mode_set(mode="OBJECT")

body_parts = [
    uv_sphere("Spoonie_Body", (0, 0, 0.58), (0.39, 0.29, 0.47), MINT),
    uv_sphere("Spoonie_Face", (0, -0.282, 0.70), (0.285, 0.026, 0.225), CREAM),
    uv_sphere("Spoonie_Apron", (0, -0.292, 0.43), (0.27, 0.024, 0.28), CREAM),
    uv_sphere("Spoonie_Eye_L", (-0.105, -0.318, 0.735), (0.034, 0.018, 0.056), GREEN, 18, 12),
    uv_sphere("Spoonie_Eye_R", (0.105, -0.318, 0.735), (0.034, 0.018, 0.056), GREEN, 18, 12),
    uv_sphere("Spoonie_Cheek_L", (-0.185, -0.316, 0.635), (0.045, 0.012, 0.03), BLUSH, 16, 10),
    uv_sphere("Spoonie_Cheek_R", (0.185, -0.316, 0.635), (0.045, 0.012, 0.03), BLUSH, 16, 10),
    uv_sphere("Spoonie_Button_L", (-0.20, -0.327, 0.545), (0.04, 0.017, 0.04), ORANGE, 18, 12),
    uv_sphere("Spoonie_Button_R", (0.20, -0.327, 0.545), (0.04, 0.017, 0.04), ORANGE, 18, 12),
    uv_sphere("Spoonie_Pocket", (0, -0.329, 0.33), (0.17, 0.015, 0.11), ORANGE, 20, 12),
]

mouth = curve_object("Spoonie_Mouth", [(-0.075, -0.329, 0.65), (0, -0.348, 0.61), (0.075, -0.329, 0.65)], GREEN, 0.012)
eyebrow_left = curve_object("Spoonie_Brow_L", [(-0.15, -0.327, 0.805), (-0.105, -0.342, 0.82), (-0.06, -0.327, 0.805)], GREEN, 0.009)
eyebrow_right = curve_object("Spoonie_Brow_R", [(0.06, -0.327, 0.805), (0.105, -0.342, 0.82), (0.15, -0.327, 0.805)], GREEN, 0.009)
strap_left = curve_object("Spoonie_Strap_L", [(-0.31, -0.20, 0.63), (-0.26, -0.31, 0.59), (-0.20, -0.33, 0.55)], CREAM, 0.018)
strap_right = curve_object("Spoonie_Strap_R", [(0.31, -0.20, 0.63), (0.26, -0.31, 0.59), (0.20, -0.33, 0.55)], CREAM, 0.018)
body_parts.extend((mouth, eyebrow_left, eyebrow_right, strap_left, strap_right))

antenna_left = uv_sphere("Spoonie_Antenna_L", (-0.12, -0.01, 1.06), (0.12, 0.075, 0.21), ORANGE, 20, 12)
antenna_left.rotation_euler.y = -0.52
antenna_right = uv_sphere("Spoonie_Antenna_R", (0.12, -0.01, 1.06), (0.12, 0.075, 0.21), ORANGE, 20, 12)
antenna_right.rotation_euler.y = 0.52
body_parts.extend((antenna_left, antenna_right))

arm_left = [
    uv_sphere("Spoonie_Sleeve_L", (-0.365, -0.005, 0.57), (0.115, 0.105, 0.19), MINT_DARK, 20, 12),
    uv_sphere("Spoonie_Hand_L", (-0.445, -0.015, 0.405), (0.085, 0.082, 0.09), ORANGE, 18, 12),
]
arm_right = [
    uv_sphere("Spoonie_Sleeve_R", (0.365, -0.005, 0.57), (0.115, 0.105, 0.19), MINT_DARK, 20, 12),
    uv_sphere("Spoonie_Hand_R", (0.445, -0.015, 0.405), (0.085, 0.082, 0.09), ORANGE, 18, 12),
]
leg_left = [
    uv_sphere("Spoonie_Leg_L", (-0.16, 0, 0.18), (0.105, 0.10, 0.15), MINT_DARK, 20, 12),
    uv_sphere("Spoonie_Foot_L", (-0.16, -0.055, 0.07), (0.145, 0.18, 0.075), MINT_DARK, 20, 12),
]
leg_right = [
    uv_sphere("Spoonie_Leg_R", (0.16, 0, 0.18), (0.105, 0.10, 0.15), MINT_DARK, 20, 12),
    uv_sphere("Spoonie_Foot_R", (0.16, -0.055, 0.07), (0.145, 0.18, 0.075), MINT_DARK, 20, 12),
]

for value in body_parts:
    bone_parent(value, armature, "Body")
for value in arm_left:
    bone_parent(value, armature, "Arm.L")
for value in arm_right:
    bone_parent(value, armature, "Arm.R")
for value in leg_left:
    bone_parent(value, armature, "Leg.L")
for value in leg_right:
    bone_parent(value, armature, "Leg.R")

for name, location in (
    ("Spoonie_Speech_Anchor", (0, 0, 1.20)),
    ("Spoonie_Look_Anchor", (0, -0.34, 0.72)),
    ("Spoonie_Floor_Anchor", (0, 0, 0)),
):
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.05
    empty.location = location
    bpy.context.collection.objects.link(empty)
    empty.parent = armature

root = armature.pose.bones["Root"]
body = armature.pose.bones["Body"]
arm_l = armature.pose.bones["Arm.L"]
arm_r = armature.pose.bones["Arm.R"]
leg_l = armature.pose.bones["Leg.L"]
leg_r = armature.pose.bones["Leg.R"]

# Arthur: NarIyirm
# 中文：所有片段首尾回到兼容姿态，运行时可用 AnimationMixer 交叉淡化，不会在巡游行为之间跳帧。
# EN: Every clip starts and ends on compatible poses so AnimationMixer crossfades do not pop between roaming behaviours.
new_action(armature, "Idle_Breathe", 72)
for frame, lift, sway, breath in ((1, 0, 0, 1), (24, 0.008, -0.025, 1.015), (48, 0.003, 0.025, 1.008), (72, 0, 0, 1)):
    key_pose(root, frame, location=(0, 0, lift))
    key_pose(body, frame, rotation=(0, sway, 0), scale=(1, 1, breath))

walk = new_action(armature, "Walk", 24)
for frame, phase in ((1, 0), (7, 1), (13, 0), (19, -1), (24, 0)):
    bounce = 0.018 if phase == 0 else 0.0
    key_pose(root, frame, location=(0, 0, bounce))
    key_pose(body, frame, rotation=(0.02 * phase, 0, -0.025 * phase))
    key_pose(leg_l, frame, rotation=(0.34 * phase, 0, 0))
    key_pose(leg_r, frame, rotation=(-0.34 * phase, 0, 0))
    key_pose(arm_l, frame, rotation=(-0.28 * phase, 0, 0))
    key_pose(arm_r, frame, rotation=(0.28 * phase, 0, 0))
set_linear_interpolation(walk)

new_action(armature, "Wave", 48)
for frame, angle, lean in ((1, 0, 0), (10, -1.85, -0.05), (20, -2.15, 0.05), (30, -1.8, -0.04), (40, -2.05, 0.03), (48, 0, 0)):
    key_pose(arm_r, frame, rotation=(angle, 0.18, -0.35))
    key_pose(body, frame, rotation=(0, lean, 0))

spin_action = new_action(armature, "Spin", 42)
for frame, rotation, lift in ((1, 0, 0), (10, math.pi * 0.45, 0.05), (22, math.pi, 0.10), (34, math.pi * 1.6, 0.04), (42, math.pi * 2, 0)):
    key_pose(root, frame, location=(0, 0, lift), rotation=(0, 0, rotation))
set_linear_interpolation(spin_action)

new_action(armature, "Inspect_Cart", 70)
for frame, lean, arm_angle, lift in ((1, 0, 0, 0), (18, 0.30, -0.55, 0.02), (35, 0.38, -0.72, 0.055), (52, 0.28, -0.5, 0.02), (70, 0, 0, 0)):
    key_pose(root, frame, location=(0, 0, lift))
    key_pose(body, frame, rotation=(lean, 0, 0))
    key_pose(arm_l, frame, rotation=(arm_angle, 0, -0.08))
    key_pose(arm_r, frame, rotation=(arm_angle, 0, 0.08))

new_action(armature, "Read_Recipe", 84)
for frame, lean, head_sway in ((1, 0, 0), (18, 0.26, 0), (36, 0.32, -0.10), (55, 0.32, 0.10), (70, 0.25, 0), (84, 0, 0)):
    key_pose(body, frame, rotation=(lean, head_sway, 0))
    key_pose(arm_l, frame, rotation=(-0.65, 0, -0.12))
    key_pose(arm_r, frame, rotation=(-0.65, 0, 0.12))

new_action(armature, "Think", 60)
for frame, tilt_value, arm_angle in ((1, 0, 0), (16, -0.10, -1.15), (32, 0.12, -1.30), (46, -0.08, -1.12), (60, 0, 0)):
    key_pose(body, frame, rotation=(0, tilt_value, -tilt_value * 0.7))
    key_pose(arm_r, frame, rotation=(arm_angle, -0.3, -0.2))

new_action(armature, "Speak", 54)
for frame, bounce, openness in ((1, 0, 0), (12, 0.025, 0.16), (24, 0.005, -0.10), (38, 0.022, 0.14), (54, 0, 0)):
    key_pose(root, frame, location=(0, 0, bounce))
    key_pose(arm_l, frame, rotation=(-0.20, 0, -openness))
    key_pose(arm_r, frame, rotation=(-0.20, 0, openness))

new_action(armature, "Celebrate", 62)
for frame, lift, arms in ((1, 0, 0), (14, 0.14, -1.75), (28, 0, -1.55), (42, 0.08, -1.78), (62, 0, 0)):
    key_pose(root, frame, location=(0, 0, lift))
    key_pose(arm_l, frame, rotation=(arms, 0, 0.38))
    key_pose(arm_r, frame, rotation=(arms, 0, -0.38))

armature.animation_data.action = None
bpy.context.scene.frame_set(1)

for obj in bpy.context.scene.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = armature

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
bpy.ops.export_scene.gltf(
    filepath=str(MODEL_PATH),
    export_format="GLB",
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_force_sampling=True,
    export_frame_range=False,
    export_apply=True,
    export_yup=True,
)
print(f"SPOONIE_BLEND={BLEND_PATH}")
print(f"SPOONIE_GLB={MODEL_PATH}")
print(f"SPOONIE_ACTIONS={','.join(sorted(action.name for action in bpy.data.actions))}")
