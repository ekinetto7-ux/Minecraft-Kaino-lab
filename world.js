import * as THREE from 'three';

export class World {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.chunkSize = 16;
    this.chunks = new Map();
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
  }

  chunkKey(cx, cz) { return `${cx},${cz}`; }
  blockKey(x, y, z) { return `${x},${y},${z}`; }

  getBlock(x, y, z) {
    if (y < 0 || y >= 64) return 0;
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return 0;
    const lx = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const lz = ((z % this.chunkSize) + this.chunkSize) % this.chunkSize;
    return chunk.blocks[lx][y][lz] || 0;
  }

  setBlock(x, y, z, id, updateNeighbors = true) {
    if (y < 0 || y >= 64) return false;
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    let chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) {
      chunk = this.createEmptyChunk(cx, cz);
      this.chunks.set(this.chunkKey(cx, cz), chunk);
    }
    const lx = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const lz = ((z % this.chunkSize) + this.chunkSize) % this.chunkSize;
    
    chunk.blocks[lx][y][lz] = id;
    this.rebuildChunkMesh(cx, cz);

    if (updateNeighbors) {
      if (lx === 0) this.rebuildChunkMesh(cx - 1, cz);
      if (lx === this.chunkSize - 1) this.rebuildChunkMesh(cx + 1, cz);
      if (lz === 0) this.rebuildChunkMesh(cx, cz - 1);
      if (lz === this.chunkSize - 1) this.rebuildChunkMesh(cx, cz + 1);
    }
    return true;
  }

  createEmptyChunk(cx, cz) {
    const blocks = Array.from({ length: this.chunkSize }, () =>
      Array.from({ length: 64 }, () => new Uint8Array(this.chunkSize))
    );
    return { cx, cz, blocks, mesh: null };
  }

  pseudoRand(n) { return Math.abs(Math.sin(n * 12.9898 + 78.233) * 43758.5453) % 1; }

  generateChunk(cx, cz, seed) {
    const key = this.chunkKey(cx, cz);
    if (this.chunks.has(key)) return this.chunks.get(key);

    const chunk = this.createEmptyChunk(cx, cz);
    for (let lx = 0; lx < this.chunkSize; lx++) {
      for (let lz = 0; lz < this.chunkSize; lz++) {
        const x = cx * this.chunkSize + lx;
        const z = cz * this.chunkSize + lz;

        const h1 = Math.sin((x + seed) * 0.04) * 5;
        const h2 = Math.cos((z + seed) * 0.04) * 5;
        const h3 = Math.sin((x + z + seed) * 0.02) * 8;
        const surfaceY = Math.max(8, Math.floor(24 + h1 + h2 + h3));

        for (let y = 0; y <= surfaceY; y++) {
          let id = 3; // 石
          if (y === surfaceY) {
            id = surfaceY <= 14 ? 14 : (surfaceY <= 18 ? 17 : 1); // 砂、水面、草
          } else if (y >= surfaceY - 3) {
            id = 2; // 土
          } else {
            const oreRoll = this.pseudoRand(x * 131 + y * 57 + z * 97 + seed);
            if (y <= 6 && oreRoll < 0.03) id = 13; // ダイヤ
            else if (y <= 12 && oreRoll < 0.06) id = 12; // 金
            else if (oreRoll < 0.12) id = 11; // 鉄
            else if (oreRoll < 0.22) id = 10; // 石炭
            else if (y <= 3) id = 18; // 溶岩層
          }
          chunk.blocks[lx][y][lz] = id;
        }
      }
    }
    this.chunks.set(key, chunk);
    this.rebuildChunkMesh(cx, cz);
    return chunk;
  }

  rebuildChunkMesh(cx, cz) {
    const key = this.chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }

    const geometries = [];
    // 簡易的にインスタンスまたは結合メッシュを作成
    const boxGeo = this.geometry;

    for (let lx = 0; lx < this.chunkSize; lx++) {
      for (let y = 0; y < 64; y++) {
        for (let lz = 0; lz < this.chunkSize; lz++) {
          const id = chunk.blocks[lx][y][lz];
          if (id === 0) continue;

          const x = cx * this.chunkSize + lx;
          const z = cz * this.chunkSize + lz;

          // 簡易オクルージョン判定
          if (
            this.getBlock(x+1,y,z) !== 0 && this.getBlock(x-1,y,z) !== 0 &&
            this.getBlock(x,y+1,z) !== 0 && this.getBlock(x,y-1,z) !== 0 &&
            this.getBlock(x,y,z+1) !== 0 && this.getBlock(x,y,z-1) !== 0
          ) continue;

          const mesh = new THREE.Mesh(boxGeo, this.materials[id]);
          mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
          mesh.updateMatrix();
          // 省略のため個別追加または統合管理
          this.scene.add(mesh);
          // 簡易的に配列保存
          if (!chunk.meshes) chunk.meshes = [];
          chunk.meshes.push(mesh);
        }
      }
    }
  }

  clear() {
    for (const chunk of this.chunks.values()) {
      if (chunk.meshes) {
        for (const m of chunk.meshes) this.scene.remove(m);
      }
    }
    this.chunks.clear();
  }

  updateAroundPlayer(px, pz, renderDist = 2, seed = 12345) {
    const pcx = Math.floor(px / this.chunkSize);
    const pcz = Math.floor(pz / this.chunkSize);

    for (let cx = pcx - renderDist; cx <= pcx + renderDist; cx++) {
      for (let cz = pcz - renderDist; cz <= pcz + renderDist; cz++) {
        this.generateChunk(cx, cz, seed);
      }
    }
  }

  getSpawnPoint() {
    return new THREE.Vector3(8, 28, 8);
  }

  serialize() {
    const list = [];
    for (const [k, chunk] of this.chunks.entries()) {
      // 変更のあったブロックのみ保存するなどの最適化
    }
    return list;
  }
  deserialize(data) { this.clear(); }
  getMeshArray() {
    const arr = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.meshes) arr.push(...chunk.meshes);
    }
    return arr;
  }
}
