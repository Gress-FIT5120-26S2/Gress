import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const inputPath = resolve('3DModel/Kitchen-Home-exquisite.glb');
const outputPath = resolve('3DModel/Kitchen-Home-interactive.glb');
const input = await readFile(inputPath);

const GLB_MAGIC = 'glTF';
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

if (input.toString('utf8', 0, 4) !== GLB_MAGIC || input.readUInt32LE(4) !== 2) {
  throw new Error('The source file is not a valid glTF 2.0 binary.');
}

const jsonLength = input.readUInt32LE(12);
const jsonType = input.readUInt32LE(16);
const jsonStart = 20;
const binaryHeader = jsonStart + jsonLength;

if (jsonType !== JSON_CHUNK || input.readUInt32LE(binaryHeader + 4) !== BIN_CHUNK) {
  throw new Error('The source GLB does not contain the expected JSON and binary chunks.');
}

const gltf = JSON.parse(input.toString('utf8', jsonStart, jsonStart + jsonLength));
const binaryLength = input.readUInt32LE(binaryHeader);
const binary = input.subarray(binaryHeader + 8, binaryHeader + 8 + binaryLength);
const primitive = gltf.meshes?.[0]?.primitives?.[0];

if (!primitive || primitive.indices === undefined || primitive.attributes?.POSITION === undefined) {
  throw new Error('The source model must contain one indexed mesh with positions.');
}

const positionAccessor = gltf.accessors[primitive.attributes.POSITION];
const indexAccessor = gltf.accessors[primitive.indices];
const positionView = gltf.bufferViews[positionAccessor.bufferView];
const indexView = gltf.bufferViews[indexAccessor.bufferView];

if (positionAccessor.componentType !== 5126 || indexAccessor.componentType !== 5125) {
  throw new Error('This editor currently expects float positions and unsigned 32-bit indices.');
}

const positionOffset = (positionView.byteOffset ?? 0) + (positionAccessor.byteOffset ?? 0);
const indexOffset = (indexView.byteOffset ?? 0) + (indexAccessor.byteOffset ?? 0);
const vertexCount = positionAccessor.count;
const faceCount = indexAccessor.count / 3;
const parents = new Int32Array(vertexCount);
parents.fill(-1);

function findRoot(vertex) {
  let root = vertex;
  while (parents[root] >= 0) root = parents[root];

  while (vertex !== root) {
    const parent = parents[vertex];
    parents[vertex] = root;
    vertex = parent;
  }

  return root;
}

function joinVertices(first, second) {
  let firstRoot = findRoot(first);
  let secondRoot = findRoot(second);
  if (firstRoot === secondRoot) return;

  if (parents[firstRoot] > parents[secondRoot]) {
    [firstRoot, secondRoot] = [secondRoot, firstRoot];
  }

  parents[firstRoot] += parents[secondRoot];
  parents[secondRoot] = firstRoot;
}

// Arthur: NarIyirm
// 中文：先按共用顶点寻找几何岛，避免用矩形直接切断冰箱门附近的其他物件。
// EN: Find connected geometry islands first so a rectangular crop does not cut nearby props.
for (let face = 0; face < faceCount; face += 1) {
  const offset = indexOffset + face * 12;
  const first = binary.readUInt32LE(offset);
  const second = binary.readUInt32LE(offset + 4);
  const third = binary.readUInt32LE(offset + 8);
  joinVertices(first, second);
  joinVertices(first, third);
}

const minimums = [new Float32Array(vertexCount), new Float32Array(vertexCount), new Float32Array(vertexCount)];
const maximums = [new Float32Array(vertexCount), new Float32Array(vertexCount), new Float32Array(vertexCount)];
minimums.forEach((values) => values.fill(Infinity));
maximums.forEach((values) => values.fill(-Infinity));

for (let vertex = 0; vertex < vertexCount; vertex += 1) {
  if (parents[vertex] === -1) continue;
  const root = findRoot(vertex);
  const offset = positionOffset + vertex * 12;

  for (let axis = 0; axis < 3; axis += 1) {
    const value = binary.readFloatLE(offset + axis * 4);
    minimums[axis][root] = Math.min(minimums[axis][root], value);
    maximums[axis][root] = Math.max(maximums[axis][root], value);
  }
}

const doorRoots = new Uint8Array(vertexCount);
let doorIslandCount = 0;

for (let root = 0; root < vertexCount; root += 1) {
  if (minimums[0][root] === Infinity) continue;

  // Arthur: NarIyirm
  // 中文：该范围包围冰箱正面门板和装饰，但排除冰箱侧壳与相邻灶台。
  // EN: This volume encloses the fridge front and decorations while excluding its shell and the stove.
  const isDoorIsland =
    minimums[0][root] >= 0.244 &&
    maximums[0][root] <= 0.445 &&
    minimums[1][root] >= -0.118 &&
    maximums[1][root] <= -0.075 &&
    minimums[2][root] >= -0.3745 &&
    maximums[2][root] <= -0.033;

  if (isDoorIsland) {
    doorRoots[root] = 1;
    doorIslandCount += 1;
  }
}

let doorFaceCount = 0;
for (let face = 0; face < faceCount; face += 1) {
  const first = binary.readUInt32LE(indexOffset + face * 12);
  if (doorRoots[findRoot(first)]) doorFaceCount += 1;
}

if (doorFaceCount < 1000) {
  throw new Error(`Only ${doorFaceCount} door faces were found; refusing to create an incomplete door.`);
}

const staticIndices = new Uint32Array((faceCount - doorFaceCount) * 3);
const doorIndices = new Uint32Array(doorFaceCount * 3);
let staticCursor = 0;
let doorCursor = 0;

for (let face = 0; face < faceCount; face += 1) {
  const offset = indexOffset + face * 12;
  const triangle = [binary.readUInt32LE(offset), binary.readUInt32LE(offset + 4), binary.readUInt32LE(offset + 8)];
  const target = doorRoots[findRoot(triangle[0])] ? doorIndices : staticIndices;
  let cursor = target === doorIndices ? doorCursor : staticCursor;

  target[cursor] = triangle[0];
  target[cursor + 1] = triangle[1];
  target[cursor + 2] = triangle[2];

  if (target === doorIndices) doorCursor += 3;
  else staticCursor += 3;
}

const binaryParts = [binary];
let nextBinaryOffset = binary.length;

function appendBinary(data) {
  const paddingLength = (4 - (nextBinaryOffset % 4)) % 4;
  if (paddingLength) {
    binaryParts.push(Buffer.alloc(paddingLength));
    nextBinaryOffset += paddingLength;
  }

  const byteOffset = nextBinaryOffset;
  const value = Buffer.isBuffer(data) ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  binaryParts.push(value);
  nextBinaryOffset += value.length;
  return { byteOffset, byteLength: value.length };
}

function appendIndexAccessor(indices) {
  const range = appendBinary(indices);
  const bufferView = gltf.bufferViews.push({ buffer: 0, ...range, target: 34963 }) - 1;
  return gltf.accessors.push({
    bufferView,
    componentType: 5125,
    count: indices.length,
    type: 'SCALAR',
  }) - 1;
}

const staticIndexAccessor = appendIndexAccessor(staticIndices);
const doorIndexAccessor = appendIndexAccessor(doorIndices);
const timeValues = new Float32Array([0, 0.85]);
const openAngle = -Math.PI / 2;
const rotationValues = new Float32Array([0, 0, 0, 1, 0, 0, Math.sin(openAngle / 2), Math.cos(openAngle / 2)]);
const timeRange = appendBinary(timeValues);
const rotationRange = appendBinary(rotationValues);
const timeView = gltf.bufferViews.push({ buffer: 0, ...timeRange }) - 1;
const rotationView = gltf.bufferViews.push({ buffer: 0, ...rotationRange }) - 1;
const timeAccessor = gltf.accessors.push({ bufferView: timeView, componentType: 5126, count: 2, min: [0], max: [0.85], type: 'SCALAR' }) - 1;
const rotationAccessor = gltf.accessors.push({ bufferView: rotationView, componentType: 5126, count: 2, type: 'VEC4' }) - 1;

const sharedAttributes = { ...primitive.attributes };
const sharedMaterial = primitive.material;
gltf.meshes = [
  { name: 'Kitchen_Static_Mesh', primitives: [{ attributes: sharedAttributes, indices: staticIndexAccessor, material: sharedMaterial }] },
  { name: 'Fridge_Door_Mesh', primitives: [{ attributes: sharedAttributes, indices: doorIndexAccessor, material: sharedMaterial }] },
];

const originalNode = gltf.nodes[0];
const hinge = [0.443, -0.098, 0];
gltf.nodes = [
  { name: 'Kitchen_Root', rotation: originalNode.rotation, children: [1, 2, 4, 5, 6, 7] },
  { name: 'Kitchen_Static', mesh: 0 },
  { name: 'Fridge_Door_Pivot', translation: hinge, children: [3], extras: { interaction: 'fridge-door' } },
  { name: 'Fridge_Door', mesh: 1, translation: hinge.map((value) => -value) },
  { name: 'Stove_Burner_Left_Anchor', translation: [0.11, -0.09, -0.18], extras: { interaction: 'stove-flame-left' } },
  { name: 'Stove_Burner_Right_Anchor', translation: [0.19, -0.09, -0.18], extras: { interaction: 'stove-flame-right' } },
  { name: 'Hotspot_Fridge', translation: [0.345, -0.07, -0.21], extras: { route: 'fridge' } },
  { name: 'Hotspot_Stove', translation: [0.15, -0.055, -0.12], extras: { route: 'ingredients' } },
];
gltf.scenes = [{ name: 'Kitchen Interactive', nodes: [0] }];
gltf.scene = 0;
gltf.animations = [
  {
    name: 'Fridge_Door_Open',
    samplers: [{ input: timeAccessor, output: rotationAccessor, interpolation: 'LINEAR' }],
    channels: [{ sampler: 0, target: { node: 2, path: 'rotation' } }],
  },
];

const finalBinary = Buffer.concat(binaryParts);
gltf.buffers[0].byteLength = finalBinary.length;
gltf.asset.extras = {
  ...(gltf.asset.extras ?? {}),
  interactiveEditor: 'KitchMemo',
  source: 'Kitchen-Home-exquisite.glb',
};

const jsonBuffer = Buffer.from(JSON.stringify(gltf));
const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
const paddedJson = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]);
const binaryPadding = (4 - (finalBinary.length % 4)) % 4;
const paddedBinary = Buffer.concat([finalBinary, Buffer.alloc(binaryPadding)]);
const output = Buffer.alloc(12 + 8 + paddedJson.length + 8 + paddedBinary.length);

output.write(GLB_MAGIC, 0, 4, 'utf8');
output.writeUInt32LE(2, 4);
output.writeUInt32LE(output.length, 8);
output.writeUInt32LE(paddedJson.length, 12);
output.writeUInt32LE(JSON_CHUNK, 16);
paddedJson.copy(output, 20);
const outputBinaryHeader = 20 + paddedJson.length;
output.writeUInt32LE(paddedBinary.length, outputBinaryHeader);
output.writeUInt32LE(BIN_CHUNK, outputBinaryHeader + 4);
paddedBinary.copy(output, outputBinaryHeader + 8);

await writeFile(outputPath, output);
console.log(JSON.stringify({
  outputPath,
  bytes: output.length,
  staticFaces: faceCount - doorFaceCount,
  doorFaces: doorFaceCount,
  doorIslands: doorIslandCount,
  nodes: gltf.nodes.map((node) => node.name),
  animations: gltf.animations.map((animation) => animation.name),
}, null, 2));
