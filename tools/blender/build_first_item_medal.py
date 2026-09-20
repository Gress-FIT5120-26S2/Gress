import math
import os

import bpy


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUTPUT_DIR = os.path.join(ROOT, 'models', 'achievements')
BLEND_PATH = os.path.join(OUTPUT_DIR, 'first-item.blend')
GLB_PATH = os.path.join(OUTPUT_DIR, 'first-item.glb')
PREVIEW_PATH = os.path.join(OUTPUT_DIR, 'first-item-preview.png')
FACE_PATH = os.path.join(ROOT, 'src', 'assets', 'achievements', 'motifs', 'first-item-motif.png')
BAKED_FACE_PATH = os.path.join(OUTPUT_DIR, 'first-item-face-baked.png')


def principled_material(name, colour, metallic, roughness, coat=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*colour, 1.0)
    material.use_nodes = True
    shader = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*colour, 1.0)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Coat Weight'].default_value = coat
    shader.inputs['Coat Roughness'].default_value = 0.2
    return material


def face_material():
    material = bpy.data.materials.new('Original first-item artwork')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
    source = bpy.data.images.load(FACE_PATH, check_existing=True)
    baked = bpy.data.images.new('First item baked face', width=source.size[0], height=source.size[1], alpha=False)
    source_pixels = list(source.pixels)
    gold_background = (0.035, 0.42, 0.62)
    baked_pixels = []
    for index in range(0, len(source_pixels), 4):
        alpha = source_pixels[index + 3]
        baked_pixels.extend((
            source_pixels[index] * alpha + gold_background[0] * (1 - alpha),
            source_pixels[index + 1] * alpha + gold_background[1] * (1 - alpha),
            source_pixels[index + 2] * alpha + gold_background[2] * (1 - alpha),
            1.0,
        ))
    baked.pixels = baked_pixels
    baked.filepath_raw = BAKED_FACE_PATH
    baked.file_format = 'PNG'
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    baked.save()
    texture_coordinates = nodes.new('ShaderNodeTexCoord')
    image_node = nodes.new('ShaderNodeTexImage')
    image_node.image = baked
    image_node.interpolation = 'Linear'
    links.new(texture_coordinates.outputs['UV'], image_node.inputs['Vector'])
    links.new(image_node.outputs['Color'], shader.inputs['Base Color'])
    shader.inputs['Metallic'].default_value = 0.42
    shader.inputs['Roughness'].default_value = 0.25
    shader.inputs['Coat Weight'].default_value = 0.45
    return material


def polygon_prism(name, points, depth, z, material):
    vertices = [(x, y, z) for x, y in points]
    mesh = bpy.data.meshes.new(f'{name} mesh')
    mesh.from_pydata(vertices, [], [list(range(len(vertices)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    solidify = obj.modifiers.new('Solid body', 'SOLIDIFY')
    solidify.thickness = depth
    solidify.offset = 0
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    return obj


def union_into(target, cutter):
    modifier = target.modifiers.new(f'Union {cutter.name}', 'BOOLEAN')
    modifier.operation = 'UNION'
    modifier.solver = 'EXACT'
    modifier.object = cutter
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def bevel(obj, width, segments=5):
    modifier = obj.modifiers.new('Continuous cast bevel', 'BEVEL')
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def create_model():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    gold = principled_material('Machined silver body', (0.66, 0.7, 0.72), 0.96, 0.16, 0.48)
    sage = principled_material('Deep teal back enamel', (0.025, 0.16, 0.19), 0.34, 0.22, 0.72)
    artwork = face_material()

    # Arthur: NarIyirm
    # 中文：Fitness 风格奖章由一块六边形金属坯体直接倒角成型，表面图案不再携带旧圆框和丝带轮廓。
    # EN: The Fitness-style award is beveled from one hexagonal metal blank, while the face motif no longer carries the old circular rim or ribbons.
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=1.72, depth=0.3, location=(0, 0, 0), rotation=(0, 0, math.radians(30)))
    body = bpy.context.object
    body.name = 'Unified first-item medal body'
    body.data.materials.append(gold)
    body.data.materials.append(artwork)
    body.data.materials.append(sage)
    bevel(body, 0.12, 8)
    triangulate = body.modifiers.new('Stable planar UV topology', 'TRIANGULATE')
    triangulate.quad_method = 'BEAUTY'
    triangulate.ngon_method = 'BEAUTY'
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=triangulate.name)

    # Arthur: NarIyirm
    # 中文：正面、侧壁与背面属于同一个封闭 Mesh；按面法线分配材质，并用平面 UV 保持 PNG 图案比例。
    # EN: Front, sidewall, and back remain one closed mesh; face normals select materials while planar UVs preserve the PNG artwork proportions.
    while body.data.uv_layers:
        body.data.uv_layers.remove(body.data.uv_layers[0])
    uv_layer = body.data.uv_layers.new(name='First item planar UV', do_init=False)
    body.data.uv_layers.active = uv_layer
    uv_layer.active_render = True
    for polygon in body.data.polygons:
        if polygon.normal.z > 0.96:
            polygon.material_index = 1
        elif polygon.normal.z < -0.96:
            polygon.material_index = 2
        else:
            polygon.material_index = 0
        for loop_index in polygon.loop_indices:
            vertex = body.data.vertices[body.data.loops[loop_index].vertex_index].co
            uv_layer.data[loop_index].uv = ((vertex.x + 1.52) / 3.04, (vertex.y + 1.5) / 3.0)

    root = bpy.data.objects.new('FIRST_ITEM_MEDAL', None)
    bpy.context.collection.objects.link(root)
    for obj in list(bpy.context.scene.objects):
        if obj != root and obj.parent is None:
            obj.parent = root

    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    bpy.context.scene.world.color = (0.018, 0.024, 0.021)
    bpy.ops.object.camera_add(location=(0, 0, 8.2))
    camera = bpy.context.object
    camera.data.lens = 58
    bpy.context.scene.camera = camera
    bpy.ops.object.light_add(type='AREA', location=(-3.5, 4, 5.5))
    bpy.context.object.data.energy = 920
    bpy.context.object.data.size = 4
    bpy.ops.object.light_add(type='AREA', location=(4, 1, 3.5))
    bpy.context.object.data.energy = 620
    bpy.context.object.data.color = (0.55, 0.78, 0.66)
    bpy.context.object.data.size = 3

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    bpy.context.scene.render.resolution_x = 640
    bpy.context.scene.render.resolution_y = 640
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.film_transparent = True
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    bpy.context.scene.render.filepath = PREVIEW_PATH
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    bpy.ops.render.render(write_still=True)
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format='GLB',
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )


if __name__ == '__main__':
    create_model()
