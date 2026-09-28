"""Encode the generated PNG sequence with Blender's built-in FFmpeg backend."""

import bpy
from pathlib import Path


root = Path(__file__).resolve().parent
frames = root / "frames"
output = root / "kitchmemo-motion-proof-5s.mp4"
files = sorted(frames.glob("frame_*.png"))
assert len(files) == 150, f"Expected 150 frames, found {len(files)}"

scene = bpy.context.scene
scene.sequence_editor_clear()
editor = scene.sequence_editor_create()
strip = editor.strips.new_image("KitchMemo motion proof", str(files[0]), channel=1, frame_start=1)

# Arthur: NarIyirm
# 中文：将逐帧生成的图像作为连续序列交给 Blender 编码，保留每秒 30 帧的运动节奏。
# EN: Encode the generated images as one sequence to preserve the authored 30 fps timing.
for frame in files[1:]:
    strip.elements.append(frame.name)

scene.frame_start = 1
scene.frame_end = len(files)
scene.render.fps = 30
scene.render.resolution_x = 540
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.use_sequencer = True
scene.render.image_settings.media_type = "VIDEO"
scene.render.image_settings.file_format = "FFMPEG"
scene.render.ffmpeg.format = "MPEG4"
scene.render.ffmpeg.codec = "H264"
scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
scene.render.ffmpeg.audio_codec = "NONE"
scene.render.filepath = str(output)
bpy.ops.render.render(animation=True)
print(f"OUTPUT {output} ({output.stat().st_size} bytes)")
