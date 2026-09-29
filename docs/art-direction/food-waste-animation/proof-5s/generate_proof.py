"""Render a five-second, text-light motion study for KitchMemo."""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
FRAMES = ROOT / "frames"

FPS = 30
COUNT = 5 * FPS
W, H, SCALE = 540, 960, 2
CREAM = (239, 237, 229)
INK = (23, 29, 27)
CORAL = (219, 113, 83)
MINT = (128, 178, 150)
GREY = (148, 151, 143)
FONT_PATH = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REGULAR_PATH = "C:/Windows/Fonts/segoeui.ttf"
FONT_BOLD = ImageFont.truetype(FONT_PATH, 48 * SCALE)
FONT_SMALL = ImageFont.truetype(FONT_REGULAR_PATH, 10 * SCALE)


def clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def smooth(x: float) -> float:
    x = clamp(x)
    return x * x * (3 - 2 * x)


def phase(t: float, start: float, end: float) -> float:
    return smooth((t - start) / (end - start))


def mix(a: float, b: float, p: float) -> float:
    return a + (b - a) * p


def mix_color(a: tuple[int, int, int], b: tuple[int, int, int], p: float):
    return tuple(round(mix(x, y, p)) for x, y in zip(a, b))


class Canvas:
    def __init__(self, bg: tuple[int, int, int]):
        self.bg = bg
        self.image = Image.new("RGBA", (W * SCALE, H * SCALE), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.image, "RGBA")

    def pt(self, x: float, y: float):
        return round(x * SCALE), round(y * SCALE)

    def line(self, points, fill, width=1, joint="curve"):
        self.draw.line([self.pt(*p) for p in points], fill=fill, width=max(1, round(width * SCALE)), joint=joint)

    def rect(self, box, fill=None, outline=None, width=1, radius=0):
        self.draw.rounded_rectangle(
            tuple(round(v * SCALE) for v in box),
            radius=round(radius * SCALE),
            fill=fill,
            outline=outline,
            width=max(1, round(width * SCALE)),
        )

    def ellipse(self, box, fill=None, outline=None, width=1):
        self.draw.ellipse(
            tuple(round(v * SCALE) for v in box),
            fill=fill,
            outline=outline,
            width=max(1, round(width * SCALE)),
        )

    def polygon(self, points, fill):
        self.draw.polygon([self.pt(*p) for p in points], fill=fill)

    def text(self, x, y, value, fill, font=FONT_SMALL, anchor=None):
        self.draw.text(self.pt(x, y), value, fill=fill, font=font, anchor=anchor)

    def render(self):
        base = Image.new("RGBA", (W * SCALE, H * SCALE), self.bg + (255,))
        base.alpha_composite(self.image)
        return base.convert("RGB").resize((W, H), Image.Resampling.LANCZOS)

    def save(self, path: Path):
        self.render().save(path)


def tomato(c: Canvas, x: float, y: float, size: float, opacity: float, dark=False):
    if opacity <= 0:
        return
    a = round(255 * clamp(opacity))
    color = mix_color(CORAL, GREY, 0.68 if dark else 0)
    c.ellipse((x - size, y - size, x + size, y + size), fill=(*color, a))
    c.polygon(
        [(x, y - size - 9), (x + 4, y - size + 2), (x + 14, y - size - 4),
         (x + 7, y - size + 7), (x + 10, y - size + 13), (x, y - size + 7),
         (x - 10, y - size + 13), (x - 7, y - size + 7), (x - 14, y - size - 4),
         (x - 4, y - size + 2)],
        fill=(*MINT, a),
    )
    c.ellipse((x - size * 0.45, y - size * 0.49, x - size * 0.21, y - size * 0.34),
              fill=(255, 235, 214, round(a * 0.72)))


def header(c: Canvas, t: float, dark: bool):
    color = (*((225, 223, 213) if dark else INK), 220)
    c.text(31, 31, "KITCHMEMO", color, FONT_SMALL)
    c.text(509, 31, f"{int(t):02d}:{int((t % 1) * 30):02d}", color, FONT_SMALL, "ra")
    c.line([(31, 62), (509, 62)], (*((225, 223, 213) if dark else INK), 55), 1)
    c.line([(31, 62), (31 + 478 * t / 5, 62)], (*CORAL, 255), 2)
    c.text(31, 908, "01 / 05", (*((225, 223, 213) if dark else INK), 155), FONT_SMALL)
    c.text(509, 908, "●  ●  ●", (*CORAL, 155), FONT_SMALL, "ra")


def grocery_bag(c: Canvas, t: float):
    enter = phase(t, 0.0, 0.38)
    leave = 1 - phase(t, 1.08, 1.48)
    a = round(220 * enter * leave)
    yoff = (1 - enter) * 85 + phase(t, 1.07, 1.46) * 75
    # Arthur: NarIyirm
    # 中文：购物袋的边缘随食物进入冰箱而解构，维持镜头之间的视觉连续性。
    # EN: The bag outline breaks apart as food enters the fridge, carrying one visual motif across the transition.
    c.line([(159, 516 + yoff), (176, 688 + yoff), (364, 688 + yoff), (381, 516 + yoff)], (*INK, a), 3)
    c.line([(159, 516 + yoff), (381, 516 + yoff)], (*INK, a), 3)
    c.line([(216, 516 + yoff), (216, 494 + yoff), (228, 473 + yoff),
            (312, 473 + yoff), (324, 494 + yoff), (324, 516 + yoff)], (*INK, a), 3)
    c.line([(176, 625 + yoff), (364, 625 + yoff)], (*INK, round(a * .17)), 1)


def fridge(c: Canvas, t: float, color, opacity: float, center=(270, 500), zoom=1.0):
    if opacity <= 0:
        return
    cx, cy = center
    a = round(255 * clamp(opacity))

    def tr(x, y):
        return cx + (x - 270) * zoom, cy + (y - 500) * zoom

    x1, y1 = tr(126, 246)
    x2, y2 = tr(414, 754)
    c.rect((x1, y1, x2, y2), outline=(*color, a), width=3, radius=25 * zoom)
    for sy in (409, 576):
        l, yy = tr(151, sy)
        r, _ = tr(390, sy)
        c.line([(l, yy), (r, yy)], (*color, round(a * 0.56)), 2)
    for yy in (277, 293, 309):
        x, y = tr(350, yy)
        c.line([(x, y), (x + 31 * zoom, y)], (*color, round(a * 0.40)), 1)
    x, y = tr(383, 430)
    c.rect((x, y, x + 6 * zoom, y + 95 * zoom), fill=(*color, a), radius=3 * zoom)


def package(c: Canvas, x, y, w, h, color, opacity, tilt=0):
    if opacity <= 0:
        return
    a = round(255 * clamp(opacity))
    c.rect((x, y, x + w, y + h), fill=(*color, round(a * .24)), outline=(*color, a), width=2, radius=11)
    c.line([(x + 12, y + 18), (x + w - 12, y + 18)], (*color, round(a * .45)), 1)
    if tilt:
        c.line([(x + w - 23, y + h - 18), (x + w - 12, y + h - 18)], (*color, round(a * .6)), 2)


RNG = random.Random(19)
PARTICLES = []
for i in range(230):
    angle = i * 2.399963229728653
    radius = math.sqrt((i + .5) / 230)
    sx = 270 + math.cos(angle) * radius * 110
    sy = 455 + math.sin(angle) * radius * 110
    orbit = 2 * math.pi * (i / 230)
    px = 270 + math.cos(orbit * 7 + radius * 8) * (84 + radius * 170)
    py = 490 + math.sin(orbit * 7 + radius * 8) * (84 + radius * 170)
    drop_x = 270 + RNG.uniform(-85, 85)
    drop_y = 750 + RNG.uniform(-30, 80)
    PARTICLES.append((sx, sy, px, py, drop_x, drop_y, RNG.uniform(1.0, 3.5)))


def particles(c: Canvas, t: float):
    appear = phase(t, 2.74, 3.02)
    disperse = phase(t, 2.93, 3.48)
    fall = phase(t, 3.35, 4.06)
    fade = 1 - phase(t, 3.88, 4.27)
    for i, (sx, sy, px, py, dx, dy, r) in enumerate(PARTICLES):
        a = round(255 * appear * fade * (0.4 + .6 * (i % 5) / 4))
        if a <= 0:
            continue
        x = mix(mix(sx, px, disperse), dx, fall)
        y = mix(mix(sy, py, disperse), dy, fall)
        y += math.sin(t * 6 + i * .31) * 4 * disperse * (1 - fall)
        color = CORAL if i % 9 < 3 else (225, 224, 215)
        c.ellipse((x - r, y - r, x + r, y + r), fill=(*color, a))


def data_field(c: Canvas, t: float):
    reveal = phase(t, 3.07, 3.38) * (1 - phase(t, 3.82, 4.13))
    if reveal <= 0:
        return
    # Arthur: NarIyirm
    # 中文：点阵由冰箱里的食物形状扩展成起伏的数据场，暗示个体损失累积为更大的问题。
    # EN: The food particles expand into a rippling data field, linking a household loss to a wider pattern.
    for row in range(14):
        depth = row / 13
        y = 353 + depth * 329
        span = 95 + depth * 210
        for col in range(17):
            side = (col - 8) / 8
            x = 270 + side * span
            distance = side * side * 2.7 + (depth - .44) ** 2 * 8
            pulse = math.exp(-distance) * math.sin((t - 3.04) * 9 - distance * 3)
            yy = y - pulse * 62
            size = 1.0 + depth * 2.2 + max(0, pulse) * 2.2
            alpha = round((26 + depth * 64) * reveal)
            color = CORAL if distance < .32 else (230, 228, 219)
            c.ellipse((x - size, yy - size, x + size, yy + size), fill=(*color, alpha))


def draw_frame(index: int):
    t = index / FPS
    dark = phase(t, 2.72, 3.04) * (1 - phase(t, 4.04, 4.43))
    bg = mix_color(CREAM, INK, dark)
    c = Canvas(bg)

    # Arthur: NarIyirm
    # 中文：所有形状以同一个时间轴逐帧计算，转场由连续的形变和运动完成。
    # EN: Every shape is evaluated on one timeline so transitions are formed by continuous motion rather than still-image swaps.
    intro = phase(t, .04, .54)
    orb_r = mix(0, 157, intro)
    orb_a = round(95 * intro * (1 - phase(t, 1.15, 1.67)))
    c.ellipse((270 - orb_r, 498 - orb_r, 270 + orb_r, 498 + orb_r), fill=(*CORAL, orb_a))
    grocery_bag(c, t)

    move = phase(t, 1.05, 1.87)
    tomato_x = mix(270, 215, move)
    tomato_y = mix(444 - math.sin(phase(t, .3, .93) * math.pi) * 65, 362, move)
    tomato_size = mix(60, 31, move)
    tomato(c, tomato_x, tomato_y, tomato_size, phase(t, .15, .58) * (1 - phase(t, 2.74, 3.02)),
           dark=t > 2.30)
    for i, (x, y, size, col) in enumerate(((209, 454, 21, MINT), (340, 457, 20, CORAL), (327, 410, 16, MINT))):
        e = phase(t, .28 + i * .07, .72 + i * .07)
        xx = mix(x, [310, 242, 338][i], move)
        yy = mix(y, [348, 524, 531][i], move)
        c.ellipse((xx-size, yy-size, xx+size, yy+size), fill=(*col, round(205*e*(1-phase(t, 2.78, 3.05)))))

    form = phase(t, 1.12, 1.82)
    zoom = mix(.76, 1.0, phase(t, 1.57, 2.52))
    fridge(c, t, INK, form * (1 - phase(t, 2.71, 3.03)), zoom=zoom)
    # Arthur: NarIyirm
    # 中文：新食物从右侧遮住番茄，让“买了却忘记”通过遮挡关系直接可见。
    # EN: New packages occlude the tomato so the forgotten-food idea is carried by the animation itself.
    crowd = phase(t, 1.91, 2.55)
    pack_a = crowd * (1 - phase(t, 2.77, 3.08))
    package(c, mix(510, 193, crowd), 315, 99, 83, MINT, pack_a)
    package(c, mix(550, 275, crowd), 320, 99, 73, (198, 187, 162), pack_a)
    package(c, mix(570, 192, crowd), 472, 142, 88, (198, 187, 162), pack_a)
    package(c, mix(610, 310, crowd), 479, 74, 76, MINT, pack_a)

    # Arthur: NarIyirm
    # 中文：时间弧线传达流逝，样片不使用未经核验的具体数字。
    # EN: The time arc signals passing time without putting an unverified number into the proof.
    clock_a = round(170 * phase(t, 2.10, 2.47) * (1 - phase(t, 2.81, 3.07)))
    if clock_a:
        c.ellipse((383, 207, 443, 267), outline=(*INK, clock_a), width=2)
        angle = -math.pi / 2 + 2 * math.pi * phase(t, 2.34, 2.82)
        c.line([(413, 237), (413 + 23 * math.cos(angle), 237 + 23 * math.sin(angle))], (*CORAL, clock_a), 3)

    data_field(c, t)
    particles(c, t)
    waste_in = phase(t, 3.17, 3.54)
    waste_out = 1 - phase(t, 3.90, 4.24)
    wa = round(210 * waste_in * waste_out)
    c.line([(189, 782), (350, 782), (336, 843), (203, 843), (189, 782)], (230, 228, 216, wa), 3)
    c.line([(206, 769), (334, 769)], (230, 228, 216, wa), 3)
    for j in range(5):
        c.line([(222 + j * 24, 790), (227 + j * 22, 831)], (230, 228, 216, round(wa * .55)), 1)

    reset = phase(t, 4.03, 4.40)
    if reset:
        # Arthur: NarIyirm
        # 中文：最后一帧保留可点击的冰箱构图；未来的原生热点直接覆盖门体区域。
        # EN: The closing composition holds a clear fridge target for a future native touch hotspot.
        pulse = .5 + .5 * math.sin((t - 4.03) * math.pi * 3)
        halo = round(52 * reset * (0.7 + .3 * pulse))
        for k in range(6, 0, -1):
            pad = k * 10
            c.rect((126-pad, 246-pad, 414+pad, 754+pad), outline=(*MINT, round(halo / k)), width=2, radius=25+pad)
        fridge(c, t, MINT, reset)
        tomato(c, 215, 362, 31, reset)
        c.ellipse((370, 460, 402, 492), outline=(*CORAL, round(220*reset)), width=2)
        c.ellipse((378, 468, 394, 484), fill=(*CORAL, round(220*reset)))

    header(c, t, dark > .5)
    c.save(FRAMES / f"frame_{index:04d}.png")


if __name__ == "__main__":
    FRAMES.mkdir(exist_ok=True)
    for frame in range(COUNT):
        draw_frame(frame)
        if frame % 30 == 0:
            print(f"Rendered {frame}/{COUNT}", flush=True)
    print(f"Rendered {COUNT} frames in {FRAMES}")
