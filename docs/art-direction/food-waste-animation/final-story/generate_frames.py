"""Render the continuous kitchen story and its two interactive branches."""

from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "interactive-prototype"))
from generate_assets import kitchen, waste_poster, causes_poster, zoom
sys.path.insert(0, str(ROOT.parent / "proof-5s"))
from generate_proof import Canvas, CREAM, CORAL, GREY, INK, MINT, W, H, mix, mix_color, phase, tomato


FPS = 30
FRAMES = ROOT / ".frames"
ASSETS = ROOT / "assets"
FRAMES.mkdir(exist_ok=True)
ASSETS.mkdir(exist_ok=True)
ENTER_COUNT = 96
HOLD_COUNT = 60
EXIT_COUNT = 24
KITCHEN_BASE = kitchen(0)
POSTERS = {"fridge": waste_poster(), "shelf": causes_poster()}


def fridge_interior(t: float) -> Image.Image:
    dark = phase(t, 1.82, 2.35)
    c = Canvas(mix_color(CREAM, INK, dark))
    light = mix_color(INK, CREAM, dark)
    c.text(32, 35, "KITCHMEMO", (*light, 210))
    c.line([(32, 62), (508, 62)], (*light, 50), 1)
    c.line([(32, 62), (220 + 80 * phase(t, .9, 2.8), 62)], (*CORAL, 230), 2)
    c.rect((70, 156, 470, 757), outline=(*light, round(190 * (1 - phase(t, 2.2, 2.65)))), width=3, radius=20)
    for y in (344, 538):
        c.line([(88, y), (452, y)], (*light, round(110 * (1 - phase(t, 2.2, 2.65)))), 2)

    # Arthur: NarIyirm
    # 中文：番茄被新购入的包装逐渐遮住，随后解构为点阵，形成与数据场连续的视觉因果。
    # EN: New groceries hide the tomato before it dissolves into the data field, preserving visual cause and effect.
    forgotten = phase(t, 1.17, 1.72)
    vanish = 1 - phase(t, 1.95, 2.36)
    tomato(c, mix(190, 139, forgotten), mix(269, 260, forgotten), mix(48, 34, forgotten), vanish, dark=forgotten > .7)
    for index, color in enumerate((MINT, (192, 181, 158), CORAL)):
        enter = phase(t, .63 + index * .14, 1.11 + index * .14)
        fade = 1 - phase(t, 2.10, 2.53)
        x = mix(560 + index * 45, 180 + index * 72, enter)
        y = (229, 254, 426)[index]
        c.rect((x, y, x + 118, y + 104), fill=(*color, round(58 * enter * fade)),
               outline=(*color, round(208 * enter * fade)), width=2, radius=12)
        c.line([(x + 14, y + 24), (x + 98, y + 24)], (*color, round(90 * enter * fade)), 2)

    clock_alpha = phase(t, 1.35, 1.65) * (1 - phase(t, 2.20, 2.56))
    if clock_alpha:
        c.ellipse((352, 124, 431, 203), outline=(*CORAL, round(180 * clock_alpha)), width=2)
        angle = -math.pi / 2 + math.pi * 2 * phase(t, 1.47, 2.25)
        c.line([(392, 163), (392 + 28 * math.cos(angle), 163 + 28 * math.sin(angle))],
               (*CORAL, round(200 * clock_alpha)), 3)

    cloud = phase(t, 2.12, 2.72)
    for i in range(290):
        p = (i + .5) / 290
        angle = i * 2.399963229728653
        radius = math.sqrt(p)
        x = mix(139 + math.cos(angle) * 34, 270 + math.cos(angle) * radius * 181, cloud)
        y = mix(260 + math.sin(angle) * 34, 340 + math.sin(angle) * radius * 181, cloud)
        size = mix(3.8, 1.1 + (i % 5) * .32, cloud)
        color = CORAL if i % 11 < 3 else (231, 228, 219)
        alpha = round(220 * cloud)
        if alpha:
            c.ellipse((x-size, y-size, x+size, y+size), fill=(*color, alpha))
    c.line([(32, 552), (508, 552)], (*light, round(50 * dark)), 1)
    c.text(32, 915, "01  /  02", (*light, 120))
    return c.render()


def shelf_interior(t: float) -> Image.Image:
    c = Canvas(CREAM)
    c.text(32, 35, "KITCHMEMO", (*INK, 220))
    c.line([(32, 62), (508, 62)], (*INK, 42), 1)
    c.line([(32, 62), (220 + 80 * phase(t, .9, 2.8), 62)], (*CORAL, 230), 2)
    colors = (CORAL, MINT, GREY)
    for index, (y, color) in enumerate(zip((171, 298, 425), colors)):
        show = phase(t, .72 + index * .39, 1.15 + index * .39)
        xoff = (1 - show) * (240 if index % 2 == 0 else -240)
        alpha = round(225 * show)
        c.rect((64 + xoff, y, 476 + xoff, y + 101), outline=(*INK, round(75 * show)), width=1, radius=9)
        c.rect((83 + xoff, y + 20, 142 + xoff, y + 79), fill=(*color, round(57 * show)),
               outline=(*color, round(180 * show)), width=2, radius=7)
        line_progress = phase(t, 1.1 + index * .34, 1.53 + index * .34)
        c.line([(172 + xoff, y + 37), (mix(172, 426, line_progress) + xoff, y + 37)], (*INK, round(92 * show)), 3)
        c.line([(172 + xoff, y + 62), (mix(172, 380 - index * 35, line_progress) + xoff, y + 62)], (*INK, round(45 * show)), 2)
        # Arthur: NarIyirm
        # 中文：三张卡片分别接住购物、计划、日期判断的行为线索，进入数据页前已有连续动作。
        # EN: Three cards gather the shopping, planning, and date-label cues before the explanation settles.
        if alpha:
            dot_x = mix(435 + xoff, 435, phase(t, 1.72 + index * .18, 2.18 + index * .18))
            c.ellipse((dot_x-6, y+46, dot_x+6, y+58), fill=(*color, alpha))
    c.line([(32, 552), (508, 552)], (*INK, 48), 1)
    c.text(32, 915, "02  /  02", (*INK, 110))
    return c.render()


def entering(branch: str, index: int) -> Image.Image:
    t = index / FPS
    first = KITCHEN_BASE
    poster = POSTERS[branch]
    target = (153, 490) if branch == "fridge" else (402, 500)
    push = phase(t, .04, .72)
    closeup = zoom(first, target, push * .81)
    interior = fridge_interior(t) if branch == "fridge" else shelf_interior(t)
    handoff = phase(t, .54, .94)
    image = Image.blend(closeup, interior, handoff)
    settle = phase(t, 2.55, (ENTER_COUNT - 1) / FPS)
    return Image.blend(image, poster, settle)


def holding(branch: str, index: int) -> Image.Image:
    if index in (0, HOLD_COUNT - 1):
        return POSTERS[branch]
    c = Canvas(INK if branch == "fridge" else CREAM)
    c.image = POSTERS[branch].resize((W * 2, H * 2)).convert("RGBA")
    from PIL import ImageDraw
    c.draw = ImageDraw.Draw(c.image, "RGBA")
    pulse = math.sin(2 * math.pi * index / (HOLD_COUNT - 1))
    if branch == "fridge":
        for i in range(48):
            a = i * 2.399963229728653
            r = math.sqrt((i + .5) / 48) * 170
            x = 270 + math.cos(a) * r + pulse * 3
            y = 335 + math.sin(a) * r - pulse * 2
            c.ellipse((x-1.5, y-1.5, x+1.5, y+1.5), fill=(*CORAL, round(70 * abs(pulse))))
    else:
        for i, y in enumerate((220, 347, 474)):
            x = 430 + pulse * 7 * (1 if i % 2 else -1)
            c.ellipse((x-7, y-7, x+7, y+7), outline=(*(CORAL, MINT, GREY)[i], round(95 * abs(pulse))), width=2)
    return c.render()


def exiting(branch: str, index: int) -> Image.Image:
    p = phase(index / FPS, 0, (EXIT_COUNT - 1) / FPS)
    poster = POSTERS[branch]
    target = (153, 490) if branch == "fridge" else (402, 500)
    closeup = zoom(KITCHEN_BASE, target, (1 - p) * .81)
    return Image.blend(poster, closeup, phase(p, .05, .92))


def save(name: str, images) -> None:
    folder = FRAMES / name
    folder.mkdir(parents=True, exist_ok=True)
    for index, image in enumerate(images):
        image.save(folder / f"frame_{index:04d}.png")
    print(f"{name}: {index + 1} frames", flush=True)


if __name__ == "__main__":
    save("hub", (kitchen(i / FPS) for i in range(72)))
    KITCHEN_BASE.save(ASSETS / "hub-poster.png")
    for branch, poster in POSTERS.items():
        poster.save(ASSETS / ("waste-poster.png" if branch == "fridge" else "causes-poster.png"))
        save(f"{branch}-in", (entering(branch, i) for i in range(ENTER_COUNT)))
        save(f"{branch}-hold", (holding(branch, i) for i in range(HOLD_COUNT)))
        save(f"{branch}-out", (exiting(branch, i) for i in range(EXIT_COUNT)))
