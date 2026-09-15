import bpy
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REFERENCE_PATH = ROOT / "models" / "new-sponine.glb"
MODEL_PATH = ROOT / "models" / "Spoonie-Character-v2.glb"
BLEND_PATH = ROOT / "models" / "Spoonie-Character-v2.blend"
FRAME_RATE = 30
TEXTURE_SIZE = 2048

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(REFERENCE_PATH))
bpy.context.scene.render.fps = FRAME_RATE
bpy.context.scene.unit_settings.system = "METRIC"

character = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
character.name = "Spoonie_Hero_Mesh"
character.data.validate(clean_customdata=True)
character.data.update()

# Arthur: NarIyirm
# 中文：高模只有五万三角面，移动端瓶颈主要是三张 4K 贴图；保留轮廓，将底色降为 2K，避免再次牺牲角色神态。
# EN: The reference has only 50k triangles; its three 4K textures dominate mobile cost, so preserve the silhouette and reduce the base colour to 2K instead of degrading the character again.
for image in bpy.data.images:
    if image.size[0] and image.size[1] and (image.size[0] > TEXTURE_SIZE or image.size[1] > TEXTURE_SIZE):
        image.scale(TEXTURE_SIZE, TEXTURE_SIZE)
        image.pack()

# Arthur: NarIyirm
# 中文：参考模型的高频法线与金属粗糙度图在移动端会形成刮痕噪点；卡通角色改用平滑哑光 PBR，只保留负责五官和配色的 2K 底色贴图。
# EN: High-frequency normal and metallic-roughness maps turn into scratch noise on mobile, so the stylised character uses smooth matte PBR while retaining a 2K base-colour texture for facial detail and palette.
for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    for principled in (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"):
        for input_name in ("Normal", "Metallic", "Roughness"):
            socket = principled.inputs.get(input_name)
            if socket:
                for link in tuple(socket.links):
                    material.node_tree.links.remove(link)
        principled.inputs["Metallic"].default_value = 0.0
        principled.inputs["Roughness"].default_value = 0.64


def add_bone(armature, name, head, tail, parent=None):
    bone = armature.data.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    if parent:
        bone.parent = armature.data.edit_bones[parent]
    return bone


armature_data = bpy.data.armatures.new("Spoonie_Rig")
armature = bpy.data.objects.new("Spoonie_Rig", armature_data)
bpy.context.collection.objects.link(armature)
bpy.context.view_layer.objects.active = armature
armature.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
add_bone(armature, "Root", (0, 0, 0.03), (0, 0, 0.22))
add_bone(armature, "Body", (0, 0, 0.22), (0, 0, 0.76), "Root")
add_bone(armature, "Head", (0, 0, 0.66), (0, 0, 1.02), "Body")
add_bone(armature, "Arm.L", (-0.25, 0, 0.62), (-0.37, -0.005, 0.31), "Body")
add_bone(armature, "Arm.R", (0.27, 0, 0.62), (0.37, -0.005, 0.94), "Body")
add_bone(armature, "Leg.L", (-0.14, 0, 0.23), (-0.14, -0.025, 0.055), "Root")
add_bone(armature, "Leg.R", (0.14, 0, 0.23), (0.14, -0.025, 0.055), "Root")
bpy.ops.object.mode_set(mode="POSE")
for pose_bone in armature.pose.bones:
    pose_bone.rotation_mode = "XYZ"
bpy.ops.object.mode_set(mode="OBJECT")

# Arthur: NarIyirm
# 中文：自动权重保留肩部与腿部的连续软变形；失败时立即终止构建，避免把看似成功但会穿模的模型交给应用。
# EN: Automatic weights preserve continuous shoulder and leg deformation; fail the build immediately rather than shipping a model that only appears rigged but clips in motion.
bpy.ops.object.select_all(action="DESELECT")
character.select_set(True)
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
result = bpy.ops.object.parent_set(type="ARMATURE_AUTO")
if "FINISHED" not in result:
    raise RuntimeError(f"Automatic rigging failed: {result}")

for name, location in (
    ("Spoonie_Speech_Anchor", (0, 0, 1.22)),
    ("Spoonie_Look_Anchor", (0, -0.30, 0.72)),
    ("Spoonie_Floor_Anchor", (0, 0, 0)),
):
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.05
    empty.location = location
    empty.parent = armature
    bpy.context.collection.objects.link(empty)


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


def new_action(name, frame_end):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = action
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = frame_end
    for bone in armature.pose.bones:
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


root = armature.pose.bones["Root"]
body = armature.pose.bones["Body"]
head = armature.pose.bones["Head"]
arm_l = armature.pose.bones["Arm.L"]
arm_r = armature.pose.bones["Arm.R"]
leg_l = armature.pose.bones["Leg.L"]
leg_r = armature.pose.bones["Leg.R"]

# Arthur: NarIyirm
# 中文：动作幅度刻意限制在高模肩宽和腿长允许的范围内，利用重心起伏制造活力，避免四肢大角度穿过围裙和身体。
# EN: Motion stays within the reference shoulder width and leg length, using weight shifts for life while avoiding limb arcs through the apron and torso.
new_action("Idle_Breathe", 72)
for frame, lift, sway, breath in ((1, 0, 0, 1), (24, 0.006, -0.018, 1.008), (48, 0.002, 0.018, 1.004), (72, 0, 0, 1)):
    key_pose(root, frame, location=(0, 0, lift))
    key_pose(body, frame, rotation=(0, sway, 0), scale=(1, 1, breath))
    key_pose(head, frame, rotation=(0, -sway * 0.7, 0))

walk = new_action("Walk", 24)
for frame, phase in ((1, 0), (7, 1), (13, 0), (19, -1), (24, 0)):
    key_pose(root, frame, location=(0, 0, 0.012 if phase == 0 else 0))
    key_pose(body, frame, rotation=(0.012 * phase, 0, -0.018 * phase))
    key_pose(head, frame, rotation=(-0.008 * phase, 0, 0.012 * phase))
    key_pose(leg_l, frame, rotation=(0.18 * phase, 0, 0))
    key_pose(leg_r, frame, rotation=(-0.18 * phase, 0, 0))
    key_pose(arm_l, frame, rotation=(-0.12 * phase, 0, 0))
    key_pose(arm_r, frame, rotation=(0.08 * phase, 0, 0))
set_linear_interpolation(walk)

new_action("Wave", 48)
for frame, twist, lean in ((1, 0, 0), (10, -0.22, -0.025), (20, 0.28, 0.025), (30, -0.25, -0.02), (40, 0.22, 0.018), (48, 0, 0)):
    key_pose(arm_r, frame, rotation=(0, twist, -0.10))
    key_pose(body, frame, rotation=(0, lean, 0))

spin = new_action("Spin", 48)
for frame, rotation, lift in ((1, 0, 0), (12, math.pi * 0.45, 0.035), (24, math.pi, 0.07), (36, math.pi * 1.55, 0.03), (48, math.pi * 2, 0)):
    key_pose(root, frame, location=(0, 0, lift), rotation=(0, 0, rotation))
set_linear_interpolation(spin)

new_action("Inspect_Cart", 70)
for frame, lean, reach in ((1, 0, 0), (18, 0.10, -0.10), (35, 0.15, -0.18), (52, 0.10, -0.10), (70, 0, 0)):
    key_pose(body, frame, rotation=(lean, 0, 0))
    key_pose(head, frame, rotation=(lean * 0.6, 0, 0))
    key_pose(arm_l, frame, rotation=(reach, 0, -0.04))

new_action("Read_Recipe", 84)
for frame, lean, scan in ((1, 0, 0), (18, 0.09, 0), (36, 0.13, -0.08), (55, 0.13, 0.08), (70, 0.09, 0), (84, 0, 0)):
    key_pose(body, frame, rotation=(lean, 0, 0))
    key_pose(head, frame, rotation=(lean * 0.5, scan, 0))
    key_pose(arm_l, frame, rotation=(-0.12, 0, -0.04))

new_action("Think", 60)
for frame, tilt, nod in ((1, 0, 0), (16, -0.07, -0.04), (32, 0.07, 0.035), (46, -0.05, -0.025), (60, 0, 0)):
    key_pose(head, frame, rotation=(nod, tilt, -tilt * 0.45))
    key_pose(body, frame, rotation=(0, tilt * 0.25, 0))

new_action("Speak", 54)
for frame, bounce, gesture in ((1, 0, 0), (12, 0.018, 0.08), (24, 0.004, -0.05), (38, 0.016, 0.07), (54, 0, 0)):
    key_pose(root, frame, location=(0, 0, bounce))
    key_pose(arm_l, frame, rotation=(-gesture, 0, -gesture * 0.4))
    key_pose(head, frame, rotation=(0, gesture * 0.25, 0))

new_action("Celebrate", 62)
for frame, lift, lean in ((1, 0, 0), (14, 0.075, -0.04), (28, 0, 0.025), (42, 0.05, -0.025), (62, 0, 0)):
    key_pose(root, frame, location=(0, 0, lift))
    key_pose(body, frame, rotation=(0, lean, 0))
    key_pose(arm_l, frame, rotation=(-0.22 if lift else 0, 0, -0.08))
    key_pose(arm_r, frame, rotation=(0, lean * 3, -0.08))

armature.animation_data.action = None
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = armature
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
print(f"SPOONIE_MOBILE_BLEND={BLEND_PATH}")
print(f"SPOONIE_MOBILE_GLB={MODEL_PATH}")
print(f"SPOONIE_MOBILE_BYTES={MODEL_PATH.stat().st_size}")
print(f"SPOONIE_MOBILE_ACTIONS={','.join(sorted(action.name for action in bpy.data.actions))}")
