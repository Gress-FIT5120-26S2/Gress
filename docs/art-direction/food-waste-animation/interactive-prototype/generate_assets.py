"""Generate a looping kitchen hub and two matched round-trip motion branches."""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "proof-5s"))
from generate_proof import Canvas, CREAM, CORAL, GREY, INK, MINT, W, H, mix, phase, smooth


FRAMES = ROOT / ".frames"
ASSETS = ROOT / "assets"
FPS = 30
HUB_COUNT = 72
TRANSITION_COUNT = 45


def kitchen(t: float) -> Image.Image:
    c = Canvas(CREAM)
    c.text(32, 35, "KITCHMEMO", (*INK, 220))
    c.line([(32, 62), (508, 62)], (*INK, 42), 1)
    c.line([(32, 62), (94, 62)], (*CORAL, 255), 2)
    c.line([(0, 786), (540, 786)], (*INK, 85), 2)
    c.rect((0, 786, 540, 960), fill=(213, 211, 201, 110))
    c.line([(245, 786), (245, 885)], (*INK, 58), 2)
    c.line([(295, 786), (295, 885)], (*INK, 58), 2)

    c.rect((47, 261, 260, 740), outline=(*INK, 230), width=3, radius=23)
    c.line([(66, 410), (243, 410)], (*INK, 112), 2)
    c.line([(66, 567), (243, 567)], (*INK, 112), 2)
    c.rect((228, 429, 236, 548), fill=(*INK, 190), radius=4)
    c.ellipse((90, 325, 147, 382), fill=(*CORAL, 210))
    c.polygon([(117, 314), (124, 329), (136, 318), (126, 336), (109, 337), (100, 319), (112, 330)], (*MINT, 240))
    c.rect((157, 337, 218, 390), fill=(190, 188, 170, 75), outline=(190, 188, 170, 195), width=2, radius=7)
    c.rect((85, 492, 174, 545), fill=(*MINT, 68), outline=(*MINT, 190), width=2, radius=9)
    c.rect((181, 497, 215, 543), fill=(*CORAL, 43), outline=(*CORAL, 160), width=2, radius=8)

    c.rect((310, 300, 495, 744), outline=(*INK, 210), width=2, radius=7)
    for y in (420, 550, 681):
        c.line([(320, y), (485, y)], (*INK, 168), 3)
    c.rect((331, 343, 374, 410), fill=(*CORAL, 60), outline=(*CORAL, 220), width=2, radius=4)
    c.rect((383, 326, 407, 409), fill=(*MINT, 70), outline=(*MINT, 210), width=2, radius=8)
    c.rect((419, 355, 476, 410), fill=(190, 188, 170, 90), outline=(165, 163, 147, 180), width=2, radius=5)
    c.rect((337, 469, 390, 540), fill=(*MINT, 72), outline=(*MINT, 205), width=2, radius=5)
    c.rect((405, 493, 472, 540), fill=(*CORAL, 45), outline=(*CORAL, 160), width=2, radius=5)
    c.rect((336, 601, 369, 670), fill=(*CORAL, 70), outline=(*CORAL, 170), width=2, radius=13)
    c.rect((390, 623, 473, 670), fill=(*MINT, 58), outline=(*MINT, 175), width=2, radius=5)

    # Arthur: NarIyirm
    # 中文：总场景只让热点和少量食材呼吸，循环首尾构图完全一致，方便随时点击转场。
    # EN: Only the targets and small ingredients breathe, while the loop starts and ends on the same composition.
    breath = math.sin(t * 2 * math.pi / (HUB_COUNT - 1) * FPS)
    for x, y, color in ((224, 608, MINT), (462, 581, CORAL)):
        for radius, alpha in ((23 + 3 * breath, 49), (14 + 2 * breath, 95), (4, 225)):
            c.ellipse((x-radius, y-radius, x+radius, y+radius),
                      fill=(*color, alpha) if radius < 5 else None,
                      outline=(*color, alpha) if radius >= 5 else None,
                      width=2)
    for j in range(7):
        x = 112 + j * 48
        y = 185 + math.sin(t * FPS * 2 * math.pi / (HUB_COUNT - 1) + j * .8) * 5
        color = CORAL if j % 3 == 0 else MINT
        c.ellipse((x-2, y-2, x+2, y+2), fill=(*color, 100))
    c.text(32, 915, "01  /  02", (*INK, 110))
    return c.render()


def waste_poster() -> Image.Image:
    c = Canvas(INK)
    c.text(32, 35, "KITCHMEMO", (235, 233, 225, 215))
    c.line([(32, 62), (508, 62)], (235, 233, 225, 50), 1)
    c.line([(32, 62), (247, 62)], (*CORAL, 255), 2)
    rng = random.Random(51)
    for i in range(410):
        theta = i * 2.399963229728653
        r = math.sqrt((i + .5) / 410)
        x = 270 + math.cos(theta) * r * 182
        y = 335 + math.sin(theta) * r * 182
        color = CORAL if i % 11 < 3 else (231, 228, 219)
        size = rng.choice((1.0, 1.5, 2.0, 2.6))
        c.ellipse((x-size, y-size, x+size, y+size), fill=(*color, rng.randint(100, 235)))
    c.ellipse((72, 137, 468, 533), outline=(*CORAL, 65), width=1)
    c.ellipse((107, 172, 433, 498), outline=(*CORAL, 48), width=1)
    c.line([(32, 552), (508, 552)], (230, 228, 220, 55), 1)
    c.text(32, 915, "01  /  02", (235, 233, 225, 110))
    return c.render()


def causes_poster() -> Image.Image:
    c = Canvas(CREAM)
    c.text(32, 35, "KITCHMEMO", (*INK, 220))
    c.line([(32, 62), (508, 62)], (*INK, 42), 1)
    c.line([(32, 62), (247, 62)], (*CORAL, 255), 2)
    for i, (y, color) in enumerate(((171, CORAL), (298, MINT), (425, GREY))):
        c.rect((64, y, 476, y + 101), outline=(*INK, 75), width=1, radius=9)
        c.rect((83, y + 20, 142, y + 79), fill=(*color, 57), outline=(*color, 180), width=2, radius=7)
        c.line([(172, y + 37), (426, y + 37)], (*INK, 92), 3)
        c.line([(172, y + 62), (375 - i * 35, y + 62)], (*INK, 42), 2)
        c.ellipse((426, y + 48, 439, y + 61), fill=(*color, 210))
    c.line([(32, 552), (508, 552)], (*INK, 48), 1)
    c.text(32, 915, "02  /  02", (*INK, 110))
    return c.render()


def zoom(image: Image.Image, target: tuple[int, int], progress: float) -> Image.Image:
    scale = 1 + 1.85 * progress
    cx = mix(W / 2, target[0], progress)
    cy = mix(H / 2, target[1], progress)
    sw, sh = W / scale, H / scale
    return image.crop((cx-sw/2, cy-sh/2, cx+sw/2, cy+sh/2)).resize((W, H), Image.Resampling.BICUBIC)


def transition(target: tuple[int, int], poster: Image.Image, frame: int) -> Image.Image:
    p = smooth(frame / (TRANSITION_COUNT - 1))
    hub = kitchen(0)
    closeup = zoom(hub, target, p)
    blend = phase(p, .55, 1.0)
    return Image.blend(closeup, poster, blend)


def save_sequence(name: str, images):
    folder = FRAMES / name
    folder.mkdir(parents=True, exist_ok=True)
    for index, image in enumerate(images):
        image.save(folder / f"frame_{index:04d}.png")
    print(f"{name}: {index + 1} frames", flush=True)


if __name__ == "__main__":
    FRAMES.mkdir(exist_ok=True)
    ASSETS.mkdir(exist_ok=True)
    hub = [kitchen(i / FPS) for i in range(HUB_COUNT)]
    waste = waste_poster()
    causes = causes_poster()
    hub[0].save(ASSETS / "hub-poster.png")
    waste.save(ASSETS / "waste-poster.png")
    causes.save(ASSETS / "causes-poster.png")
    save_sequence("hub", hub)
    for name, target, poster in (("fridge", (153, 490), waste), ("shelf", (402, 500), causes)):
        frames = [transition(target, poster, i) for i in range(TRANSITION_COUNT)]
        save_sequence(f"{name}-in", frames)
        save_sequence(f"{name}-out", reversed(frames))
