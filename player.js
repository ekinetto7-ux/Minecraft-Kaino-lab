import * as THREE from 'three';
import { ITEMS } from './textures.js';

export class SoundEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }
  ensureContext() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  playTone(freq, duration = 0.08, type = 'triangle', volume = 0.12) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + duration);
  }
  playStep() { this.playTone(110, 0.05, 'sine', 0.07); }
  playBreak() { this.playTone(140, 0.12, 'sawtooth', 0.14); }
  playPlace() { this.playTone(240, 0.07, 'triangle', 0.12); }
  playHit()   { this.playTone(95, 0.15, 'square', 0.18); }
  playEat()   { this.playTone(320, 0.09, 'sine', 0.12); }
}

export class Player {
  constructor(camera, world, domElement, crackTextures, sound) {
    this.camera = camera;
    this.world = world;
    this.domElement = domElement;
    this.crackTextures = crackTextures;
    this.sound = sound;

    this.position = new THREE.Vector3(8, 28, 8);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.sensitivity = 1.0;

    this.height = 1.65; this.eyeHeight = 1.5; this.radius = 0.28;
    this.onGround = false;

    this.mode = 'survival';
    this.health = 20; this.hunger = 20; this.hungerTimer = 0;

    this.inventory = new Array(36).fill(null);
    this.selectedSlot = 0;

    this.isMining = false;
    this.miningTarget = null;
    this.miningProgress = 0;

    this.keys = {};
    this.joyInput = { x: 0, z: 0 };
    this.isLocked = false;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 6;

    const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
    this.highlightBox = new THREE.LineSegments(boxGeo, new THREE.LineBasicMaterial({ color: 0x000000 }));
    this.highlightBox.visible = false;
    this.world.scene.add(this.highlightBox);

    this.crackMaterial = new THREE.MeshBasicMaterial({ map: this.crackTextures[0], transparent: true, depthWrite: false });
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), this.crackMaterial);
    this.crackMesh.visible = false;
    this.world.scene.add(this.crackMesh);

    this.onInventoryChange = null;
    this.onStatsChange = null;
    this.onDamage = null;
    this.onOpenInteractive = null;
    this.onAttackMob = null;

    this.initControls();
  }

  setupMode(mode) {
    this.mode = mode;
    this.health = 20; this.hunger = 20;
    this.inventory = new Array(36).fill(null);
    if (mode === 'creative') {
      [1, 2, 3, 4, 5, 6, 8, 9, 19, 20, 21, 22, 109, 110, 154].forEach((id, i) => {
        this.inventory[i] = { id, count: 64 };
      });
    }
    this.notifyInventory();
    this.notifyStats();
  }

  getHeldItem() { return this.inventory[this.selectedSlot]; }

  addItem(id, count = 1) {
    if (!id || !ITEMS[id]) return false;
    const def = ITEMS[id];
    for (let i = 0; i < 36; i++) {
      const slot = this.inventory[i];
      if (slot && slot.id === id && slot.count < 64) {
        slot.count += count;
        this.notifyInventory(); return true;
      }
    }
    for (let i = 0; i < 36; i++) {
      if (!this.inventory[i]) {
        this.inventory[i] = { id, count, durability: def.maxDurability || undefined };
        this.notifyInventory(); return true;
      }
    }
    return false;
  }

  consumeHeldItem(amount = 1) {
    if (this.mode === 'creative') return;
    const slot = this.getHeldItem();
    if (!slot) return;
    slot.count -= amount;
    if (slot.count <= 0) this.inventory[this.selectedSlot] = null;
    this.notifyInventory();
  }

  takeDamage(amount) {
    if (this.mode === 'creative') return;
    this.health = Math.max(0, this.health - amount);
    this.sound.playHit();
    if (this.onDamage) this.onDamage();
    if (this.health <= 0) { this.health = 20; this.hunger = 20; this.spawn(); }
    this.notifyStats();
  }

  notifyInventory() { if (this.onInventoryChange) this.onInventoryChange(); }
  notifyStats() { if (this.onStatsChange) this.onStatsChange(); }

  spawn() {
    this.position.copy(this.world.getSpawnPoint());
    this.velocity.set(0, 0, 0);
  }

  initControls() {
    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      if (!this.isLocked) this.isMining = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      const sens = 0.0022 * this.sensitivity;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });

    this.domElement.addEventListener('mousedown', (e) => {
      if (!this.isLocked) return;
      if (e.button === 0) {
        if (this.onAttackMob && this.onAttackMob()) return;
        this.isMining = true;
      }
      if (e.button === 2) this.rightClickAction();
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMining = false; this.miningProgress = 0; this.crackMesh.visible = false;
      }
    });

    this.domElement.addEventListener('contextmenu', e => e.preventDefault());
  }

  jump() {
    if (this.onGround) { this.velocity.y = 7.6; this.onGround = false; }
  }

  getTargetHit() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(this.world.getMeshArray(), false);
    return hits.length > 0 ? hits[0] : null;
  }

  rightClickAction() {
    const hit = this.getTargetHit();
    if (hit) {
      const { x, y, z } = hit.object.userData || {};
      const blockId = this.world.getBlock(x, y, z);
      const def = ITEMS[blockId];
      if (def && def.interactive && this.onOpenInteractive) {
        this.onOpenInteractive(def.interactive);
        return;
      }
    }

    const held = this.getHeldItem();
    if (!held || !hit || !hit.face) return;
    const def = ITEMS[held.id];

    // バケツでの水汲み
    if (held.id === 109) {
      const { x, y, z } = hit.object.userData;
      if (this.world.getBlock(x, y, z) === 17) {
        this.inventory[this.selectedSlot] = { id: 110, count: 1 };
        this.notifyInventory();
        return;
      }
    }

    if (!def || (def.type !== 'block' && !def.placesBlock)) return;

    const { x, y, z } = hit.object.userData;
    const nx = x + Math.round(hit.face.normal.x);
    const ny = y + Math.round(hit.face.normal.y);
    const nz = z + Math.round(hit.face.normal.z);

    const placeId = def.placesBlock || held.id;
    if (this.world.setBlock(nx, ny, nz, placeId)) {
      this.sound.playPlace();
      this.consumeHeldItem(1);
      if (held.id === 110) { // 水を置いたら空バケツに戻す
        this.addItem(109, 1);
      }
    }
  }

  updateMining(dt) {
    if (!this.isMining) {
      this.miningProgress = 0; this.crackMesh.visible = false; return;
    }
    const hit = this.getTargetHit();
    if (!hit) { this.miningProgress = 0; this.crackMesh.visible = false; return; }
    const { x, y, z } = hit.object.userData || {};
    const key = `${x},${y},${z}`;
    if (this.miningTarget !== key) { this.miningTarget = key; this.miningProgress = 0; }

    const blockId = this.world.getBlock(x, y, z);
    const blockDef = ITEMS[blockId] || { hardness: 1 };

    if (this.mode === 'creative') {
      this.completeBreakBlock(x, y, z, blockDef); return;
    }

    this.miningProgress += (2.0 / blockDef.hardness) * dt;
    const stage = Math.min(9, Math.floor(this.miningProgress * 10));
    this.crackMaterial.map = this.crackTextures[stage];
    this.crackMaterial.needsUpdate = true;
    this.crackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.crackMesh.visible = true;

    if (this.miningProgress >= 1.0) this.completeBreakBlock(x, y, z, blockDef);
  }

  completeBreakBlock(x, y, z, blockDef) {
    this.world.setBlock(x, y, z, 0);
    this.sound.playBreak();
    this.miningProgress = 0;
    this.crackMesh.visible = false;
    if (this.mode === 'survival' && blockDef.dropId) {
      this.addItem(blockDef.dropId, 1);
    }
  }

  collidesAt(pos) {
    const minX = Math.floor(pos.x - this.radius), maxX = Math.floor(pos.x + this.radius);
    const minY = Math.floor(pos.y), maxY = Math.floor(pos.y + this.height);
    const minZ = Math.floor(pos.z - this.radius), maxZ = Math.floor(pos.z + this.radius);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.world.getBlock(x, y, z) !== 0) return true;
        }
      }
    }
    return false;
  }

  update(dt) {
    let forward = 0, strafe = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) strafe += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) strafe -= 1;

    forward -= this.joyInput.z; strafe += this.joyInput.x;
    if (this.keys['Space']) this.jump();

    const speed = 5.3;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let moveX = (-sin * forward + cos * strafe);
    let moveZ = (-cos * forward - sin * strafe);
    const len = Math.hypot(moveX, moveZ);
    if (len > 1) { moveX /= len; moveZ /= len; }

    const nextX = this.position.clone(); nextX.x += moveX * speed * dt;
    if (!this.collidesAt(nextX)) this.position.x = nextX.x;
    const nextZ = this.position.clone(); nextZ.z += moveZ * speed * dt;
    if (!this.collidesAt(nextZ)) this.position.z = nextZ.z;

    this.velocity.y -= 20 * dt;
    const nextY = this.position.clone(); nextY.y += this.velocity.y * dt;
    if (this.collidesAt(nextY)) {
      if (this.velocity.y < 0) this.onGround = true;
      this.velocity.y = 0;
    } else {
      this.position.y = nextY.y; this.onGround = false;
    }

    this.updateMining(dt);

    this.camera.position.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    const hit = this.getTargetHit();
    if (hit) {
      const { x, y, z } = hit.object.userData || {};
      this.highlightBox.position.set(x + 0.5, y + 0.5, z + 0.5);
      this.highlightBox.visible = true;
    } else {
      this.highlightBox.visible = false;
    }
  }
}
