"""Render the CC0 wheelie-bin GLB into lightweight transparent game sprites."""

import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "assets" / "waste-wheelie-bin.glb"
OUTPUT = ROOT / "assets" / "waste-bins"
PALETTES = {
    "organics": ((52, 86, 64), (66, 113, 75)),
    "recycling": ((70, 79, 80), (207, 158, 43)),
    "general": ((73, 77, 80), (188, 80, 72)),
}
SIZE = (420, 540)
SCALE = 3


def glb():
    data = MODEL.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20 : 20 + json_length])
    binary_offset = 20 + json_length + 8
    return document, data[binary_offset:]


def accessor(document, binary, number):
    item = document["accessors"][number]
    view = document["bufferViews"][item["bufferView"]]
    components = {"SCALAR": 1, "VEC3": 3}[item["type"]]
    dtype = {5122: np.int16, 5123: np.uint16, 5126: np.float32}[item["componentType"]]
    start = view.get("byteOffset", 0) + item.get("byteOffset", 0)
    stride = view.get("byteStride", np.dtype(dtype).itemsize * components)
    values = np.ndarray((item["count"], components), dtype=dtype, buffer=binary, offset=start, strides=(stride, np.dtype(dtype).itemsize)).copy()
    if item.get("normalized") and item["componentType"] == 5122:
        return np.maximum(values.astype(float) / 32767, -1)
    return values.astype(float)


def scene_triangles(document, binary, open_lid):
    triangles = []

    def visit(node_id, parent_rotation, parent_translation):
        node = document["nodes"][node_id]
        translation = np.array(node.get("translation", [0, 0, 0]), dtype=float)
        scale = np.array(node.get("scale", [1, 1, 1]), dtype=float)
        rotation = parent_rotation
        origin = parent_translation + parent_rotation @ translation
        if node.get("name") == "lid" and open_lid:
            angle = -0.68
            hinge = np.array([[1, 0, 0], [0, math.cos(angle), -math.sin(angle)], [0, math.sin(angle), math.cos(angle)]])
            rotation = parent_rotation @ hinge
        if "mesh" in node:
            mesh_id = node["mesh"]
            primitive = document["meshes"][mesh_id]["primitives"][0]
            positions = accessor(document, binary, primitive["attributes"]["POSITION"])
            positions = (rotation @ (positions * scale).T).T + origin
            for points in positions.reshape(-1, 3, 3):
                triangles.append((mesh_id, primitive["material"], points))
        for child in node.get("children", []):
            visit(child, rotation, origin)

    visit(0, np.eye(3), np.zeros(3))
    return triangles


def render(document, binary, stream, open_lid):
    width, height = SIZE
    canvas = Image.new("RGBA", (width * SCALE, height * SCALE), (0, 0, 0, 0))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse((75 * SCALE, 445 * SCALE, 365 * SCALE, 486 * SCALE), fill=(13, 26, 22, 58))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(13 * SCALE)))
    draw = ImageDraw.Draw(canvas)
    camera = np.array([2.1, 1.35, 3.4], dtype=float)
    camera /= np.linalg.norm(camera)
    right = np.cross(np.array([0, 1, 0]), camera)
    right /= np.linalg.norm(right)
    up = np.cross(camera, right)
    light = np.array([-0.3, 0.9, 0.55], dtype=float)
    light /= np.linalg.norm(light)
    faces = []

    # Arthur: NarIyirm
    # 中文：按模型三角面深度绘制，固定光源和机位，生成可离线使用的开盖与闭盖状态。
    # EN: Sort model triangles by depth under fixed lighting to make offline open and closed sprites.
    for mesh_id, material_id, points in scene_triangles(document, binary, open_lid):
        normal = np.cross(points[1] - points[0], points[2] - points[0])
        length = np.linalg.norm(normal)
        if length < 1e-8:
            continue
        normal /= length
        if np.dot(normal, camera) <= 0:
            continue
        if material_id == 1:
            base = (53, 57, 57)
        elif material_id == 2:
            base = (180, 185, 173)
        elif mesh_id == 2:
            base = PALETTES[stream][1]
        else:
            base = PALETTES[stream][0]
        shade = 0.64 + 0.34 * max(0, np.dot(normal, light))
        color = tuple(min(255, round(channel * shade)) for channel in base) + (255,)
        projected = [((width / 2 + np.dot(point, right) * 325) * SCALE, (height * 0.63 - np.dot(point - [0, 0.5, 0], up) * 325) * SCALE) for point in points]
        faces.append((float(np.dot(points.mean(axis=0), camera)), projected, color))
    for _, projected, color in sorted(faces):
        draw.polygon(projected, fill=color)
    return canvas.resize(SIZE, Image.Resampling.LANCZOS)


def main():
    document, binary = glb()
    OUTPUT.mkdir(exist_ok=True)
    for stream in PALETTES:
        for state in ("closed", "open"):
            render(document, binary, stream, state == "open").save(OUTPUT / f"{stream}-{state}.png", optimize=True)


if __name__ == "__main__":
    main()
