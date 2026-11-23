import * as THREE from 'three';

export class World {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.sizeX = 64;
    this.sizeZ = 64;
    this.maxY = 28;

    this.blocks = new Map();
    this.meshes = new Map();
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
  }

  key(x, y, z) { return `${x},${y},${z}`; }

  getBlock(x, y, z) { return this.blocks.get(this.key(x, y, z)) || 0; }

  setBlock(x, y, z, id, updateNeighbors = true) {
    if (x < 0 || x >= this.sizeX || z < 0 || z >= this.sizeZ || y < 0 || y >= this.maxY) return false;
    const k = this.key(x, y, z);

    if (this.meshes.has(k)) {
      this.scene.remove(this.meshes.get(k));
      this.meshes.delete(k);
    }

    if (id === 0) this.blocks.delete(k);
    else {
      this.blocks.set(k, id);
      this.updateBlockVisibility(x, y, z);
    }

    if (updateNeighbors) this.updateNeighbors(x, y, z);
    return true;
  }

  isTransparent(id) { return id === 0 || id === 8; }

  isOccluded(x, y, z) {
    const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (const [dx, dy, dz] of dirs) {
      if (this.isTransparent(this.getBlock(x + dx, y + dy, z + dz))) return false;
    }
    return true;
  }

  updateBlockVisibility(x, y, z) {
    const k = this.key(x, y, z);
    const id = this.getBlock(x, y, z);
    if (id === 0) return;

    if (this.isOccluded(x, y, z)) {
      if (this.meshes.has(k)) {
        this.scene.remove(this.meshes.get(k));
        this.meshes.delete(k);
      }
    } else if (!this.meshes.has(k)) {
      const mesh = new THREE.Mesh(this.geometry, this.materials[id]);
      mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
      mesh.userData = { x, y, z };
      this.scene.add(mesh);
      this.meshes.set(k, mesh);
    }
  }

  updateNeighbors(x, y, z) {
    const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (const [dx, dy, dz] of dirs) this.updateBlockVisibility(x + dx, y + dy, z + dz);
  }

  clear() {
    for (const mesh of this.meshes.values()) this.scene.remove(mesh);
    this.meshes.clear();
    this.blocks.clear();
  }

  pseudoRand(n) { return Math.abs(Math.sin(n * 12.9898 + 78.233) * 43758.5453) % 1; }

  generateNew(seed = Math.floor(Math.random() * 99999)) {
    this.clear();
    for (let x = 0; x < this.sizeX; x++) {
      for (let z = 0; z < this.sizeZ; z++) {
        const h1 = Math.sin((x + seed) * 0.09) * 2.6;
        const h2 = Math.cos((z + seed) * 0.09) * 2.6;
        const h3 = Math.sin((x + z + seed) * 0.05) * 1.6;
        const surfaceY = Math.max(3, Math.floor(8 + h1 + h2 + h3));

        for (let y = 0; y <= surfaceY; y++) {
          let id = 3;
          if (y === surfaceY) id = 1;
          else if (y >= surfaceY - 2) id = 2;
          else {
            const oreRoll = this.pseudoRand(x * 131 + y * 57 + z * 97 + seed);
            if (y <= 4 && oreRoll < 0.025) id = 13;
            else if (y <= 7 && oreRoll < 0.06) id = 12;
            else if (oreRoll < 0.13) id = 11;
            else if (oreRoll < 0.22) id = 10;
          }
          this.blocks.set(this.key(x, y, z), id);
        }

        if (x > 3 && x < this.sizeX - 4 && z > 3 && z < this.sizeZ - 4) {
          if (this.pseudoRand(x * 37.2 + z * 91.7 + seed) < 0.018) {
            this.spawnTree(x, surfaceY + 1, z);
          }
        }
      }
    }
    this.generateVillage(22, 22);
    this.rebuildAllMeshes();
  }

  generateVillage(vx, vz) {
    const baseH = 9;
    for (let x = vx - 3; x <= vx + 16; x++) {
      for (let z = vz - 3; z <= vz + 16; z++) {
        for (let y = baseH + 1; y < this.maxY; y++) this.blocks.delete(this.key(x, y, z));
        for (let y = 0; y <= baseH; y++) this.blocks.set(this.key(x, y, z), y === baseH ? 1 : 2);
      }
    }
    for (let i = -2; i <= 15; i++) {
      this.blocks.set(this.key(vx + 7, baseH, vz + i), 4);
      this.blocks.set(this.key(vx + i, baseH, vz + 7), 4);
    }
    this.buildHouse(vx, baseH + 1, vz);
    this.buildHouse(vx + 10, baseH + 1, vz);
    this.buildHouse(vx, baseH + 1, vz + 10);
  }

  buildHouse(hx, hy, hz) {
    const w = 5, d = 5, h = 4;
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        this.blocks.set(this.key(hx + x, hy - 1, hz + z), 4);
        for (let y = 0; y < h; y++) {
          const isEdgeX = x === 0 || x === w - 1;
          const isEdgeZ = z === 0 || z === d - 1;
          if (y === h - 1) this.blocks.set(this.key(hx + x, hy + y, hz + z), 6);
          else if (isEdgeX || isEdgeZ) {
            if (x === 2 && z === 0 && (y === 0 || y === 1)) continue;
            if (y === 1 && ((x === 2 && z === d - 1) || (z === 2 && isEdgeX))) {
              this.blocks.set(this.key(hx + x, hy + y, hz + z), 8);
            } else {
              this.blocks.set(this.key(hx + x, hy + y, hz + z), 5);
            }
          }
        }
      }
    }
    this.blocks.set(this.key(hx + 1, hy, hz + 3), 9);
  }

  spawnTree(tx, ty, tz) {
    const height = 4;
    for (let y = 0; y < height; y++) this.blocks.set(this.key(tx, ty + y, tz), 6);
    for (let dy = height - 2; dy <= height + 1; dy++) {
      const r = dy >= height ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy < height) continue;
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          const k = this.key(tx + dx, ty + dy, tz + dz);
          if (!this.blocks.has(k)) this.blocks.set(k, 7);
        }
      }
    }
  }

  rebuildAllMeshes() {
    for (const mesh of this.meshes.values()) this.scene.remove(mesh);
    this.meshes.clear();
    for (const k of this.blocks.keys()) {
      const [x, y, z] = k.split(',').map(Number);
      this.updateBlockVisibility(x, y, z);
    }
  }

  getSpawnPoint() {
    const sx = 29, sz = 29;
    for (let y = this.maxY - 1; y >= 0; y--) {
      if (this.getBlock(sx, y, sz) !== 0) return new THREE.Vector3(sx + 0.5, y + 1.2, sz + 0.5);
    }
    return new THREE.Vector3(sx + 0.5, 14, sz + 0.5);
  }

  serialize() { return Array.from(this.blocks.entries()); }
  deserialize(entries) {
    this.clear();
    for (const [k, id] of entries) this.blocks.set(k, id);
    this.rebuildAllMeshes();
  }
  getMeshArray() { return Array.from(this.meshes.values()); }
}
