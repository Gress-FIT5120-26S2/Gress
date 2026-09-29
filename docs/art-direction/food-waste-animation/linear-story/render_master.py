"""Render the text-free continuation of the approved five-second proof."""

from __future__ import annotations

import math
import importlib.util
import shutil
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
APP_ASSETS = ROOT.parents[3] / "assets" / "story" / "food-waste"
FRAMES = ROOT / ".frames"
FPS = 30
END_FRAME = 60 * FPS
SCALE = 1.5
SIZE = (540, 960)
CREAM = (239, 237, 229)
INK = (29, 39, 34)
CORAL = (216, 117, 83)
MINT = (134, 180, 155)
SAND = (189, 183, 166)


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def smooth(value: float) -> float:
    value = clamp(value)
    return value * value * (3 - 2 * value)


def phase(time: float, start: float, end: float) -> float:
    return smooth((time - start) / (end - start))


def mix(a: float, b: float, amount: float) -> float:
    return a + (b - a) * amount


def blend_color(a: tuple[int, int, int], b: tuple[int, int, int], amount: float):
    return tuple(round(mix(x, y, amount)) for x, y in zip(a, b))


class Canvas:
    def __init__(self, background=CREAM):
        self.image = Image.new("RGB", SIZE, background)
        self.draw = ImageDraw.Draw(self.image)

    def p(self, x: float, y: float):
        return round(x * SCALE), round(y * SCALE)

    def line(self, points, color=INK, width=1.5):
        self.draw.line([self.p(x, y) for x, y in points], fill=color, width=max(1, round(width * SCALE)), joint="curve")

    def rect(self, x, y, w, h, radius=0, fill=None, outline=None, width=1.5):
        box = (*self.p(x, y), *self.p(x + w, y + h))
        self.draw.rounded_rectangle(box, radius=round(radius * SCALE), fill=fill, outline=outline, width=max(1, round(width * SCALE)))

    def circle(self, x, y, radius, fill, outline=None, width=1.5):
        box = (*self.p(x - radius, y - radius), *self.p(x + radius, y + radius))
        self.draw.ellipse(box, fill=fill, outline=outline, width=max(1, round(width * SCALE)))

    def polygon(self, points, fill):
        self.draw.polygon([self.p(x, y) for x, y in points], fill=fill)


def tomato(canvas: Canvas, x: float, y: float, radius: float, amount=1.0):
    if amount <= 0:
        return
    canvas.circle(x, y, radius, blend_color(CREAM, CORAL, amount))
    stem = blend_color(CREAM, MINT, amount)
    canvas.line([(x - radius * .35, y - radius * .85), (x, y - radius * 1.14), (x + radius * .43, y - radius * .79)], stem, max(1.5, radius * .1))
    canvas.circle(x - radius * .23, y - radius * .27, radius * .13, blend_color(CREAM, (255, 224, 204), amount))


def fridge(canvas: Canvas, x: float, y: float, width: float, height: float, color=MINT):
    canvas.rect(x, y, width, height, 13, outline=color, width=2)
    canvas.line([(x + 10, y + height * .37), (x + width - 10, y + height * .37)], color, 1)
    canvas.line([(x + 10, y + height * .7), (x + width - 10, y + height * .7)], color, 1)
    canvas.rect(x + width - 18, y + height * .44, 4, 57, 2, fill=color)


def package(canvas: Canvas, x: float, y: float, width: float, height: float, color, amount: float):
    if amount <= 0:
        return
    tone = blend_color(CREAM, color, amount)
    canvas.rect(x, y, width, height, 7, outline=tone, width=1.8)
    canvas.line([(x + 8, y + 13), (x + width - 8, y + 13)], tone, 1)


def particle_field(canvas: Canvas, time: float, cx: float, cy: float, spread: float, amount=1.0):
    for index in range(130):
        angle = index * 2.3999632297
        radius = math.sqrt((index + .5) / 130) * spread
        drift = math.sin(time * 1.15 + index * .63) * 1.5
        x = cx + math.cos(angle) * radius + drift
        y = cy + math.sin(angle) * radius
        color = CORAL if index % 5 < 2 else MINT if index % 7 == 0 else (221, 218, 207)
        color = blend_color(canvas.image.getpixel((0, 0)), color, amount * (.55 + .45 * ((index % 6) / 5)))
        canvas.circle(x, y, 1.1 if index % 7 else 2.1, color)


def scene_fridge(time: float) -> Image.Image:
    canvas = Canvas()
    push = phase(time, 5.08, 6.18)
    zoom = mix(1, 1.28, push)

    def tx(x):
        return 180 + (x - 180) * zoom

    def ty(y):
        return 330 + (y - 330) * zoom

    fridge(canvas, tx(84), ty(164), 192 * zoom, 339 * zoom)
    tomato(canvas, tx(143), ty(241), 20 * zoom, 1 - .5 * phase(time, 7.05, 7.65))
    first = phase(time, 5.35, 5.95)
    package(canvas, tx(mix(330, 193, first)), ty(222), 58 * zoom, 50 * zoom, MINT, first)
    for start, end, begin, finish, y, w, h, color in (
        (6.25, 6.85, 387, 114, 206, 91, 66, SAND),
        (7.05, 7.65, 400, 184, 331, 80, 60, MINT),
        (7.78, 8.35, 416, 106, 350, 86, 57, SAND),
    ):
        amount = phase(time, start, end)
        package(canvas, tx(mix(begin, finish, amount)), ty(y), w * zoom, h * zoom, color, amount)
    if time >= 8.45:
        clock = phase(time, 8.45, 8.85)
        tone = blend_color(CREAM, CORAL, clock)
        canvas.circle(276, 154, 24, CREAM, tone, 2)
        angle = -math.pi / 2 + phase(time, 8.8, 9.7) * math.pi * 3
        canvas.line([(276, 154), (276 + 17 * math.cos(angle), 154 + 17 * math.sin(angle))], tone, 2)
    return canvas.image


def scene_weight(time: float) -> Image.Image:
    dark = blend_color(CREAM, (32, 40, 37), phase(time, 16, 16.6))
    canvas = Canvas(dark)
    gather = phase(time, 16.1, 17.3)
    settle = phase(time, 17.3, 18)
    particle_field(canvas, time, 180, mix(315, 444, gather), mix(185, 95, gather), .3 + .55 * settle)
    line_color = blend_color(dark, (189, 209, 192), settle)
    canvas.line([(72, 542), (288, 542)], line_color, 1)
    for index in range(4):
        canvas.line([(88 + index * 62, 555), (88 + index * 62, 565)], line_color, 1)
    return canvas.image


def scene_cost(time: float) -> Image.Image:
    canvas = Canvas()
    reform = phase(time, 29, 29.85)
    if reform < 1:
        particle_field(canvas, time, 180, mix(444, 434, reform), mix(95, 48, reform), (1 - reform) * .5)
    border = blend_color(CREAM, INK, reform)
    canvas.rect(83, 319, 194, 230, 8, fill=blend_color(CREAM, (248, 246, 239), reform), outline=border, width=1.5)
    for index in range(4):
        color = MINT if index % 2 else (168, 176, 166)
        canvas.line([(105, 362 + index * 35), (250 - (index % 2) * 35, 362 + index * 35)], blend_color(CREAM, color, reform), 2)
    canvas.line([(105, 508), (250, 508)], blend_color(CREAM, CORAL, reform), 2)
    return canvas.image


def scene_habits(time: float) -> Image.Image:
    canvas = Canvas()
    enter = phase(time, 40, 40.75)
    canvas.rect(94, 156, 172, 285, 8, outline=blend_color(CREAM, INK, enter))
    for index in range(3):
        amount = phase(time, 40.9 + index * .55, 41.25 + index * .55)
        x = mix(320, 116, amount)
        canvas.rect(x, 210 + index * 63, 18, 18, 3, outline=blend_color(CREAM, MINT, amount))
        canvas.line([(149, 220 + index * 63), (234, 220 + index * 63)], blend_color(CREAM, (155, 169, 154), amount), 2)
    return canvas.image


def scene_action(time: float) -> Image.Image:
    canvas = Canvas()
    reform = phase(time, 49, 49.9)
    reveal = phase(time, 49.9, 50.8)
    fridge(canvas, 80, 148, 200, 317)
    tomato(canvas, 141, 242, 25)
    package(canvas, 192 + 56 * reveal, 233, 57, 49, SAND, 1 - reveal * .65)
    border = blend_color(CREAM, MINT, reform)
    canvas.rect(116, 355, 127, 55, 8, outline=border)
    canvas.line([(130, 383), (141, 394), (161, 371)], blend_color(CREAM, CORAL, reform), 3)
    canvas.line([(174, 384), (225, 384)], border, 2)
    return canvas.image


SCENES = (
    (5, 16, scene_fridge),
    (16, 29, scene_weight),
    (29, 40, scene_cost),
    (40, 49, scene_habits),
    (49, 60, scene_action),
)


def render_at(time: float) -> Image.Image:
    current = next(render for start, end, render in SCENES if start <= time < end)
    frame = current(time)
    # Arthur: NarIyirm
    # 中文：仅在镜头边界短暂交叠，阅读停留段不做缓慢转场或持续推移。
    # EN: Blend only at scene boundaries; the reading holds have no slow transition or camera drift.
    for boundary, previous, following in (
        (16, scene_fridge, scene_weight),
        (29, scene_weight, scene_cost),
        (40, scene_cost, scene_habits),
        (49, scene_habits, scene_action),
    ):
        if boundary <= time < boundary + .35:
            frame = Image.blend(previous(boundary - .01), following(time), phase(time, boundary, boundary + .35))
            break
    return frame


def main():
    FRAMES.mkdir(parents=True, exist_ok=True)
    APP_ASSETS.mkdir(parents=True, exist_ok=True)
    proof_source = ROOT.parent / "proof-5s" / "generate_proof.py"
    spec = importlib.util.spec_from_file_location("kitchmemo_proof", proof_source)
    assert spec and spec.loader
    proof = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(proof)
    proof.FRAMES = FRAMES
    # Arthur: NarIyirm
    # 中文：保留样片的全部动作与构图，但移除原样片角落里的固定标题和时间码。
    # EN: Keep the proof's exact motion and composition while removing its baked-in header and timecode.
    proof.header = lambda *_args: None
    for index in range(5 * FPS):
        proof.draw_frame(index)
    shutil.copyfile(FRAMES / "frame_0000.png", APP_ASSETS / "poster.png")
    for index in range(5 * FPS, END_FRAME):
        image = render_at(index / FPS)
        image.save(FRAMES / f"frame_{index:04d}.jpg", quality=91, subsampling=0)
        if index % 150 == 0:
            print(f"Rendered {index}/{END_FRAME}", flush=True)
    print(f"Rendered {END_FRAME} text-free frames")


if __name__ == "__main__":
    main()
