import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

class NodeFileReader {
  result = null;
  onloadend = null;

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      setTimeout(() => this.onloadend?.(), 0);
    });
  }
}

globalThis.FileReader = NodeFileReader;

const scene = new THREE.Scene();
const root = new THREE.Group();
root.name = 'Kitchen_Root';
scene.add(root);

const material = (name, color, roughness = 0.82) => {
  const value = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
  value.name = name;
  return value;
};

const addBox = (parent, name, size, position, color, roughness) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(`${name}_Material`, color, roughness));
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
};

const addCylinder = (parent, name, radius, height, position, color) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24), material(`${name}_Material`, color));
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
};

// Arthur: NarIyirm
// 中文：三个交互物件围绕世界原点布置，保证默认远景可以同时完整看到它们。
// EN: The three interactive props stay around world origin so the default wide shot shows all of them.
addBox(root, 'Room_Floor', [8.2, 0.14, 6.2], [0, -0.07, 0], '#E8DDD5');
addBox(root, 'Room_Wall_Back', [8.2, 4.3, 0.16], [0, 2.15, -3.02], '#D99882');
addBox(root, 'Room_Wall_Left', [0.16, 4.3, 6.2], [-4.02, 2.15, 0], '#E7A38B');

const sink = new THREE.Group();
sink.name = 'Sink_Group';
root.add(sink);

// Arthur: NarIyirm
// 中文：洗菜池沿左墙纵向摆放，把后墙中央完整留给冰箱和灶台。
// EN: The sink runs along the left wall, leaving the back-center area for the fridge and stove.
addBox(sink, 'Sink_Cabinet', [0.9, 1.25, 2.2], [-3.48, 0.63, -0.72], '#EACFA8');
addBox(sink, 'Sink_Counter', [1.02, 0.16, 2.32], [-3.44, 1.32, -0.72], '#C98161');
addBox(sink, 'Sink_Basin', [0.58, 0.09, 1.05], [-3.37, 1.42, -0.72], '#B8C9C3', 0.34);
addBox(sink, 'Sink_Basin_Inner', [0.44, 0.04, 0.82], [-3.32, 1.47, -0.72], '#718B87', 0.28);
addCylinder(sink, 'Sink_Faucet_Neck', 0.055, 0.62, [-3.35, 1.72, -1.45], '#748783');
addBox(sink, 'Sink_Faucet_Spout', [0.42, 0.08, 0.08], [-3.15, 2.01, -1.45], '#748783', 0.3);

const fridge = new THREE.Group();
fridge.name = 'Fridge_Group';
fridge.position.set(-0.75, 0, -2.36);
root.add(fridge);
addBox(fridge, 'Fridge_Body', [1.45, 2.65, 1.05], [0, 1.33, 0], '#DCE7DD', 0.68);
addBox(fridge, 'Fridge_Interior', [1.16, 2.22, 0.08], [0, 1.34, 0.57], '#BFD7D0');
const doorPivot = new THREE.Group();
doorPivot.name = 'Fridge_Door_Pivot';
doorPivot.position.set(-0.7, 1.34, 0.59);
fridge.add(doorPivot);
addBox(doorPivot, 'Fridge_Door', [1.4, 2.55, 0.12], [0.7, 0, 0], '#EDF1E6', 0.62);
addBox(doorPivot, 'Fridge_Handle', [0.08, 0.72, 0.1], [1.23, 0.18, 0.11], '#7F9189', 0.45);

const stove = new THREE.Group();
stove.name = 'Stove_Group';
stove.position.set(1, 0, -2.35);
root.add(stove);
addBox(stove, 'Stove_Body', [1.55, 1.5, 1.05], [0, 0.75, 0], '#769988', 0.7);
addBox(stove, 'Stove_Top', [1.62, 0.14, 1.1], [0, 1.54, 0], '#414C48', 0.42);
addCylinder(stove, 'Stove_Burner_Left', 0.28, 0.05, [-0.4, 1.63, 0], '#252C29');
addCylinder(stove, 'Stove_Burner_Right', 0.28, 0.05, [0.4, 1.63, 0], '#252C29');
addBox(stove, 'Stove_Oven_Window', [1.12, 0.55, 0.08], [0, 0.72, 0.56], '#31433D', 0.3);

const table = new THREE.Group();
table.name = 'Table_Group';
table.position.set(0.15, 0, 0.55);
root.add(table);
addBox(table, 'Table_Body', [2.7, 0.2, 1.45], [0, 1.02, 0], '#C98254', 0.78);
for (const [index, position] of [[-1.12, 0.5, -0.52], [1.12, 0.5, -0.52], [-1.12, 0.5, 0.52], [1.12, 0.5, 0.52]].entries()) {
  addBox(table, `Table_Leg_${index + 1}`, [0.16, 1, 0.16], position, '#98623F');
}
addBox(table, 'Recipe_Card', [0.72, 0.06, 0.52], [0, 1.17, 0], '#F5EEDC', 0.88).rotation.y = -0.22;

addCylinder(root, 'Rug', 0.95, 0.04, [-1.55, 0.02, 1.5], '#8DB2B4');

const hotspotMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.01, depthWrite: false });
const addHotspot = (name, size, position) => {
  const hotspot = new THREE.Mesh(new THREE.BoxGeometry(...size), hotspotMaterial.clone());
  hotspot.name = name;
  hotspot.position.set(...position);
  root.add(hotspot);
};
addHotspot('Hotspot_Fridge', [1.75, 3.05, 1.5], [-0.75, 1.45, -2.15]);
addHotspot('Hotspot_Stove', [1.85, 2.05, 1.5], [1, 1.02, -2.15]);
addHotspot('Hotspot_Table', [3.1, 1.5, 1.9], [0.15, 0.88, 0.55]);

const exporter = new GLTFExporter();
const outputPath = resolve('assets/models/kitchen-blockout.glb');
await mkdir(dirname(outputPath), { recursive: true });

const binary = await new Promise((resolveExport, rejectExport) => {
  exporter.parse(scene, resolveExport, rejectExport, { binary: true, onlyVisible: true });
});

await writeFile(outputPath, new Uint8Array(binary));
console.log(`Generated ${outputPath}`);
