import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image


JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def pad_four(data: bytes, fill: bytes = b"\x00") -> bytes:
    padding = (-len(data)) % 4
    return data + fill * padding


def main() -> None:
    if len(sys.argv) not in {3, 4}:
        raise SystemExit("Usage: resize-glb-textures.py input.glb output.glb [max-size]")

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    max_size = int(sys.argv[3]) if len(sys.argv) == 4 else 1024
    source = input_path.read_bytes()

    if source[:4] != b"glTF" or struct.unpack_from("<I", source, 4)[0] != 2:
        raise ValueError("The input is not a glTF 2.0 binary.")

    json_length, json_type = struct.unpack_from("<II", source, 12)
    if json_type != JSON_CHUNK:
        raise ValueError("The GLB JSON chunk is missing.")

    document = json.loads(source[20 : 20 + json_length])
    binary_header = 20 + json_length
    binary_length, binary_type = struct.unpack_from("<II", source, binary_header)
    if binary_type != BIN_CHUNK:
        raise ValueError("The GLB binary chunk is missing.")
    binary = source[binary_header + 8 : binary_header + 8 + binary_length]

    image_views = {
        image["bufferView"]: image
        for image in document.get("images", [])
        if "bufferView" in image and image.get("mimeType") in {"image/png", "image/jpeg"}
    }
    rebuilt_parts: list[bytes] = []
    next_offset = 0
    resized_images: list[dict[str, object]] = []

    # Arthur: NarIyirm
    # 中文：逐个重建 BufferView，并只缩小嵌入纹理；模型数据和交互节点保持原样。
    # EN: Rebuild each buffer view while resizing only embedded textures; model data and interaction nodes stay unchanged.
    for view_index, buffer_view in enumerate(document.get("bufferViews", [])):
        old_offset = buffer_view.get("byteOffset", 0)
        old_length = buffer_view["byteLength"]
        view_data = binary[old_offset : old_offset + old_length]

        if view_index in image_views:
            image = Image.open(io.BytesIO(view_data))
            original_size = image.size
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            output_image = io.BytesIO()
            image_format = "PNG" if image_views[view_index]["mimeType"] == "image/png" else "JPEG"
            save_options = {"optimize": True}
            if image_format == "JPEG":
                save_options.update({"quality": 88, "progressive": True})
            image.save(output_image, format=image_format, **save_options)
            view_data = output_image.getvalue()
            resized_images.append({
                "name": image_views[view_index].get("name", f"image-{view_index}"),
                "from": original_size,
                "to": image.size,
                "bytes": len(view_data),
            })

        alignment = (-next_offset) % 4
        if alignment:
            rebuilt_parts.append(b"\x00" * alignment)
            next_offset += alignment

        buffer_view["byteOffset"] = next_offset
        buffer_view["byteLength"] = len(view_data)
        rebuilt_parts.append(view_data)
        next_offset += len(view_data)

    rebuilt_binary = b"".join(rebuilt_parts)
    document["buffers"][0]["byteLength"] = len(rebuilt_binary)
    document.setdefault("asset", {}).setdefault("extras", {})["mobileTextureLimit"] = max_size
    encoded_json = pad_four(json.dumps(document, separators=(",", ":")).encode("utf-8"), b" ")
    encoded_binary = pad_four(rebuilt_binary)
    total_length = 12 + 8 + len(encoded_json) + 8 + len(encoded_binary)

    output = bytearray(total_length)
    struct.pack_into("<4sII", output, 0, b"glTF", 2, total_length)
    struct.pack_into("<II", output, 12, len(encoded_json), JSON_CHUNK)
    output[20 : 20 + len(encoded_json)] = encoded_json
    output_binary_header = 20 + len(encoded_json)
    struct.pack_into("<II", output, output_binary_header, len(encoded_binary), BIN_CHUNK)
    output[output_binary_header + 8 :] = encoded_binary

    output_path.write_bytes(output)
    print(json.dumps({
        "output": str(output_path.resolve()),
        "bytes": len(output),
        "images": resized_images,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
