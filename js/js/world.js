import * as THREE from 'three';

const SAVE_KEY = 'webcraft_3d_world_v1';

export class World {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.sizeX = 32;
    this.sizeZ = 32;
    this.maxY = 24;

    this.blocks = new Map();
    this.meshes = new Map();
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
  }

  key(x, y, z) {
    return `${x},${y},${z}`;
  }

  getBlock(x, y, z) {
    return this.blocks.get(this.key(x, y, z)) || 0;
  }

  setBlock(x, y, z, id, updateNeighbors = true) {
    if (y < 0 || y >= this.maxY) return false;
    const k = this.key(x, y, z);

    if (this.meshes.has(k)) {
      this.scene.remove(this.meshes.get(k));
      this.meshes.delete(k);
    }

    if (id === 0) {
      this.blocks.delete(k);
    } else {
      this.blocks.set(k, id);
      this.updateBlockVisibility(x, y, z);
    }

    if (updateNeighbors) {
      this.updateNeighbors(x, y, z);
    }
    return true;
  }

  isTransparent(id) {
    return id === 0 || id === 8;
  }

  isOccluded(x, y, z) {
    const dirs = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1]
    ];
    for (const [dx, dy, dz] of dirs) {
      const neighbor = this.getBlock(x + dx, y + dy, z + dz);
      if (this.isTransparent(neighbor)) {
        return false;
      }
    }
    return true;
  }

  updateBlockVisibility(x, y, z) {
    const k = this.key(x, y, z);
    const id = this.getBlock(x, y, z);
    if (id === 0) return;

    const hidden = this.isOccluded(x, y, z);
    if (hidden) {
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
    const dirs = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1]
    ];
    for (const [dx, dy, dz] of dirs) {
      this.updateBlockVisibility(x + dx, y + dy, z + dz);
    }
  }

  clear() {
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
    }
    this.meshes.clear();
    this.blocks.clear();
  }

  generateNew(seed = Math.random() * 1000) {
    this.clear();

    for (let x = 0; x < this.sizeX; x++) {
      for (let z = 0; z < this.sizeZ; z++) {
        const h1 = Math.sin((x + seed) * 0.14) * 2.5;
        const h2 = Math.cos((z + seed) * 0.14) * 2.5;
        const h3 = Math.sin((x + z + seed) * 0.08) * 1.5;
        const surfaceY = Math.max(2, Math.floor(6 + h1 + h2 + h3));

        for (let y = 0; y <= surfaceY; y++) {
          let id = 3;
          if (y === surfaceY) id = 1;
          else if (y >= surfaceY - 2) id = 2;
          this.blocks.set(this.key(x, y, z), id);
        }

        if (x > 2 && x < this.sizeX - 3 && z > 2 && z < this.sizeZ - 3) {
          const treeRoll = Math.abs(Math.sin(x * 37.2 + z * 91.7 + seed)) % 1;
          if (treeRoll < 0.028) {
            this.spawnTree(x, surfaceY + 1, z);
          }
        }
      }
    }

    this.rebuildAllMeshes();
  }

  spawnTree(tx, ty, tz) {
    const height = 4;
    for (let y = 0; y < height; y++) {
      this.blocks.set(this.key(tx, ty + y, tz), 6);
    }
    for (let dy = height - 2; dy <= height + 1; dy++) {
      const radius = dy >= height ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx === 0 && dz === 0 && dy < height) continue;
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          const k = this.key(tx + dx, ty + dy, tz + dz);
          if (!this.blocks.has(k)) {
            this.blocks.set(k, 7);
          }
        }
      }
    }
  }

  rebuildAllMeshes() {
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
    }
    this.meshes.clear();

    for (const k of this.blocks.keys()) {
      const [x, y, z] = k.split(',').map(Number);
      this.updateBlockVisibility(x, y, z);
    }
  }

  getSpawnPoint() {
    const sx = Math.floor(this.sizeX / 2);
    const sz = Math.floor(this.sizeZ / 2);
    for (let y = this.maxY - 1; y >= 0; y--) {
      if (this.getBlock(sx, y, sz) !== 0) {
        return new THREE.Vector3(sx + 0.5, y + 1.1, sz + 0.5);
      }
    }
    return new THREE.Vector3(sx + 0.5, 12, sz + 0.5);
  }

  save() {
    const data = Array.from(this.blocks.entries());
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const entries = JSON.parse(raw);
      this.clear();
      for (const [k, id] of entries) {
        this.blocks.set(k, id);
      }
      this.rebuildAllMeshes();
      return true;
    } catch {
      return false;
    }
  }

  getMeshArray() {
    return Array.from(this.meshes.values());
  }
}
