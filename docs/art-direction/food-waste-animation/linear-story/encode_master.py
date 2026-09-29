"""Encode the proof and continuation frames as one silent H.264 master."""

from pathlib import Path

import bpy


root = Path(__file__).resolve().parent
proof_frames = sorted((root / ".frames").glob("frame_*.png"))
frames = sorted((root / ".frames").glob("frame_*.jpg"))
output = root / "kitchmemo-food-waste-linear-60s.mp4"
assert len(proof_frames) == 150, f"Expected 150 text-free proof frames, found {len(proof_frames)}"
assert len(frames) == 1650, f"Expected 1650 continuation frames, found {len(frames)}"

scene = bpy.context.scene
scene.sequence_editor_clear()
editor = scene.sequence_editor_create()
proof_strip = editor.strips.new_image("Text-free five-second proof", str(proof_frames[0]), channel=1, frame_start=1)
for frame in proof_frames[1:]:
    proof_strip.elements.append(frame.name)
strip = editor.strips.new_image("Continuous motion continuation", str(frames[0]), channel=1, frame_start=151)

# Arthur: NarIyirm
# 中文：第二段从第 151 帧衔接样片，编码为一条无音轨影片供 App 使用。
# EN: Start the continuation at frame 151, joining the proof into one silent asset for the app.
for frame in frames[1:]:
    strip.elements.append(frame.name)

scene.frame_start = 1
scene.frame_end = 1800
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
