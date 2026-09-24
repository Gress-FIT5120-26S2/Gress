from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parent
FPS = 24
scene = bpy.context.scene
scene.render.resolution_x = 720
scene.render.resolution_y = 1280
scene.render.resolution_percentage = 100
scene.render.fps = FPS
scene.render.film_transparent = False
scene.render.image_settings.media_type = "VIDEO"
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.file_format = "FFMPEG"
scene.render.ffmpeg.format = "MPEG4"
scene.render.ffmpeg.codec = "H264"
scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
scene.render.ffmpeg.ffmpeg_preset = "GOOD"
scene.render.filepath = str(ROOT / "kitchmemo-food-waste-visual.mp4")
scene.render.use_file_extension = True
scene.view_settings.view_transform = "Standard"
scene.sequence_editor_create()
strips = scene.sequence_editor.strips


def add_image(filename, channel, start, end, *, zoom_start=1.0, zoom_end=1.0, fade_in=0, fade_out=0):
    strip = strips.new_image(filename, str(ROOT / filename), channel=channel, frame_start=start)
    strip.frame_final_duration = end - start
    strip.blend_type = "ALPHA_OVER"

    # Arthur: NarIyirm
    # 中文：对同一参考画面做轻微镜头推进，维持连续性而不伪装成角色动作生成。
    # EN: Slowly reframe each reference still for continuity without presenting it as generated character motion.
    strip.transform.scale_x = zoom_start
    strip.transform.scale_y = zoom_start
    strip.transform.keyframe_insert(data_path="scale_x", frame=start)
    strip.transform.keyframe_insert(data_path="scale_y", frame=start)
    strip.transform.scale_x = zoom_end
    strip.transform.scale_y = zoom_end
    strip.transform.keyframe_insert(data_path="scale_x", frame=end - 1)
    strip.transform.keyframe_insert(data_path="scale_y", frame=end - 1)

    if fade_in:
        strip.blend_alpha = 0.0
        strip.keyframe_insert(data_path="blend_alpha", frame=start)
        strip.blend_alpha = 1.0
        strip.keyframe_insert(data_path="blend_alpha", frame=start + fade_in)
    if fade_out:
        strip.blend_alpha = 1.0
        strip.keyframe_insert(data_path="blend_alpha", frame=end - fade_out)
        strip.blend_alpha = 0.0
        strip.keyframe_insert(data_path="blend_alpha", frame=end - 1)
    return strip


add_image("01-shopping.png", 1, 1, 217, zoom_start=1.0, zoom_end=1.055)
add_image("02-forgotten.png", 2, 193, 577, zoom_start=1.0, zoom_end=1.075, fade_in=24)
add_image("03-next-time.png", 3, 553, 865, zoom_start=1.055, zoom_end=1.0, fade_in=24)

scene.frame_start = 1
scene.frame_end = 864
bpy.ops.render.render(animation=True)
