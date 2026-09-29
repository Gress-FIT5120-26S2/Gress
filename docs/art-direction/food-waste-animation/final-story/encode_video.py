"""Encode the final story's seven silent motion layers in Blender 5.2."""

import bpy
from pathlib import Path


root = Path(__file__).resolve().parent
for name in ("hub", "fridge-in", "fridge-hold", "fridge-out", "shelf-in", "shelf-hold", "shelf-out"):
    files = sorted((root / ".frames" / name).glob("frame_*.png"))
    assert files, f"Missing frames for {name}"
    scene = bpy.context.scene
    scene.sequence_editor_clear()
    editor = scene.sequence_editor_create()
    strip = editor.strips.new_image(name, str(files[0]), channel=1, frame_start=1)
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
    scene.render.filepath = str(root / "assets" / f"{name}.mp4")
    # Arthur: NarIyirm
    # 中文：静音画面可在两种语言间共用，旁白由 App 按当前语言单独播放。
    # EN: Silent clips are shared across locales while the app plays the matching narration separately.
    bpy.ops.render.render(animation=True)
    print(f"OUTPUT {name}: {len(files)} frames")
