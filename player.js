import * as THREE from 'three';
import { ITEMS } from './textures.js';

// シンプルなWeb Audio API効果音・足音エンジン
export class SoundEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playTone(freq, duration = 0.08, type = 'triangle', volume = 0.12) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.5), ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  playStep(blockSound = 'grass') {
    if (blockSound === 'stone') this.playTone(190 + Math.random() * 40, 0.05, 'square', 0.06);
    else if (blockSound === 'wood') this.playTone(150 + Math.random() * 30, 0.06, 'triangle', 0.08);
    else this.playTone(110 + Math.random() * 25, 0.05, 'sine', 0.07);
  }

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

    this.position = new THREE.Vector3(29, 14, 29);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.sensitivity = 1.0;

    this.height = 1.65;
    this.eyeHeight = 1.5;
    this.radius = 0.28;
    this.onGround = false;
    this.stepDistance = 0;

    // サバイバルステータス
    this.mode = 'survival'; // 'survival' | 'creative'
    this.health = 20;
    this.maxHealth = 20;
    this.hunger = 20;
    this.maxHunger = 20;
    this.hungerTimer = 0;

    // 36スロットインベントリ (0..8がホットバー、9..35がストレージ)
    // 各要素は null または { id, count, durability? }
    this.inventory = new Array(36).fill(null);
    this.selectedSlot = 0;

    // ブロック破壊進行状態（ヒビ割れ）
    this.isMining = false;
    this.miningTarget = null; // "x,y,z"
    this.miningProgress = 0;

    this.keys = {};
    this.joyInput = { x: 0, z: 0 };
    this.isLocked = false;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 6;

    // ターゲット枠＆ヒビ割れオーバーレイメッシュ
    const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
    this.highlightBox = new THREE.LineSegments(boxGeo, new THREE.LineBasicMaterial({ color: 0x000000 }));
    this.highlightBox.visible = false;
    this.world.scene.add(this.highlightBox);

    this.crackMaterial = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0],
      transparent: true,
      depthWrite: false
    });
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), this.crackMaterial);
    this.crackMesh.visible = false;
    this.world.scene.add(this.crackMesh);

    // 外部コールバック
    this.onInventoryChange = null;
    this.onStatsChange = null;
    this.onDamage = null;
    this.onOpenCraftingTable = null;
    this.onAttackMob = null;

    this.initControls();
  }

  setupMode(mode) {
    this.mode = mode;
    this.health = 20;
    this.hunger = 20;
    this.inventory = new Array(36).fill(null);

    if (mode === 'creative') {
      // クリエイティブは初期ホットバーに主要ブロック・道具を配置（減らない）
      const defaults = [1, 2, 3, 4, 5, 6, 8, 9, 154];
      defaults.forEach((id, i) => {
        this.inventory[i] = { id, count: 64 };
      });
    }
    // サバイバルは「初期装備0」からスタート！

    this.notifyInventory();
    this.notifyStats();
  }

  getHeldItem() {
    return this.inventory[this.selectedSlot];
  }

  addItem(id, count = 1) {
    if (!id || !ITEMS[id]) return false;
    const def = ITEMS[id];
    const stackable = def.type !== 'tool' && def.type !== 'weapon' && def.type !== 'armor';

    if (stackable) {
      for (let i = 0; i < 36; i++) {
        const slot = this.inventory[i];
        if (slot && slot.id === id && slot.count < 64) {
          const add = Math.min(64 - slot.count, count);
          slot.count += add;
          count -= add;
          if (count <= 0) {
            this.notifyInventory();
            return true;
          }
        }
      }
    }

    for (let i = 0; i < 36; i++) {
      if (!this.inventory[i]) {
        this.inventory[i] = {
          id,
          count: stackable ? count : 1,
          durability: def.maxDurability || undefined
        };
        this.notifyInventory();
        return true;
      }
    }
    return false;
  }

  consumeHeldItem(amount = 1) {
    if (this.mode === 'creative') return;
    const slot = this.inventory[this.selectedSlot];
    if (!slot) return;
    slot.count -= amount;
    if (slot.count <= 0) {
      this.inventory[this.selectedSlot] = null;
    }
    this.notifyInventory();
  }

  damageHeldTool(amount = 1) {
    if (this.mode === 'creative') return;
    const slot = this.inventory[this.selectedSlot];
    if (!slot || slot.durability === undefined) return;
    slot.durability -= amount;
    if (slot.durability <= 0) {
      this.inventory[this.selectedSlot] = null;
      this.sound.playBreak();
    }
    this.notifyInventory();
  }

  takeDamage(amount) {
    if (this.mode === 'creative') return;
    this.health = Math.max(0, this.health - amount);
    this.sound.playHit();
    if (this.onDamage) this.onDamage();
    if (this.health <= 0) {
      // リスポーン
      this.health = 20;
      this.hunger = 20;
      this.spawn();
    }
    this.notifyStats();
  }

  eatHeldFood() {
    const slot = this.getHeldItem();
    if (!slot) return false;
    const def = ITEMS[slot.id];
    if (!def || def.type !== 'food') return false;
    if (this.mode === 'survival' && this.hunger >= 20 && this.health >= 20 && def.hunger > 0) return false;

    this.hunger = Math.min(20, this.hunger + (def.hunger || 0));
    this.health = Math.min(20, this.health + (def.heal || 0));
    this.sound.playEat();
    this.consumeHeldItem(1);
    this.notifyStats();
    return true;
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
        // まずモブへの攻撃判定
        if (this.onAttackMob && this.onAttackMob()) return;
        this.isMining = true;
      }
      if (e.button === 2) {
        this.rightClickAction();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMining = false;
        this.miningProgress = 0;
        this.crackMesh.visible = false;
      }
    });

    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // スマホ右画面視点操作
    let lookTouchId = null, lastX = 0, lastY = 0;
    this.domElement.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth * 0.35 && lookTouchId === null) {
          lookTouchId = t.identifier;
          lastX = t.clientX;
          lastY = t.clientY;
        }
      }
    }, { passive: true });

    this.domElement.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) {
          this.yaw -= (t.clientX - lastX) * 0.005 * this.sensitivity;
          this.pitch -= (t.clientY - lastY) * 0.005 * this.sensitivity;
          this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
          lastX = t.clientX;
          lastY = t.clientY;
        }
      }
    }, { passive: true });

    const endTouch = (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookTouchId) lookTouchId = null;
    };
    this.domElement.addEventListener('touchend', endTouch);
    this.domElement.addEventListener('touchcancel', endTouch);
  }

  jump() {
    if (this.onGround) {
      this.velocity.y = 7.6;
      this.onGround = false;
    }
  }

  getTargetHit() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(this.world.getMeshArray(), false);
    return hits.length > 0 ? hits[0] : null;
  }

  rightClickAction() {
    const hit = this.getTargetHit();
    // 作業台を右クリックしたら作業台メニューを開く
    if (hit) {
      const { x, y, z } = hit.object.userData;
      const targetId = this.world.getBlock(x, y, z);
      if (targetId === 9 && this.onOpenCraftingTable) {
        this.onOpenCraftingTable();
        return;
      }
    }

    // 食料を持っていたら食べる
    const held = this.getHeldItem();
    if (held && ITEMS[held.id]?.type === 'food') {
      this.eatHeldFood();
      return;
    }

    // ブロック設置
    if (!hit || !hit.face || !held) return;
    const def = ITEMS[held.id];
    if (!def || def.type !== 'block') return;

    const { x, y, z } = hit.object.userData;
    const nx = x + Math.round(hit.face.normal.x);
    const ny = y + Math.round(hit.face.normal.y);
    const nz = z + Math.round(hit.face.normal.z);

    if (this.intersectsPlayer(nx, ny, nz)) return;

    if (this.world.setBlock(nx, ny, nz, held.id)) {
      this.sound.playPlace();
      this.consumeHeldItem(1);
    }
  }

  updateMining(dt) {
    if (!this.isMining) {
      this.miningProgress = 0;
      this.crackMesh.visible = false;
      return;
    }

    const hit = this.getTargetHit();
    if (!hit) {
      this.miningProgress = 0;
      this.crackMesh.visible = false;
      return;
    }

    const { x, y, z } = hit.object.userData;
    const key = `${x},${y},${z}`;
    if (this.miningTarget !== key) {
      this.miningTarget = key;
      this.miningProgress = 0;
    }

    const blockId = this.world.getBlock(x, y, z);
    const blockDef = ITEMS[blockId] || { hardness: 1 };

    // クリエイティブは即破壊
    if (this.mode === 'creative') {
      this.completeBreakBlock(x, y, z, blockDef);
      return;
    }

    // 適正ツールによる採掘速度ボーナス
    let speed = 1.0;
    const held = this.getHeldItem();
    const heldDef = held ? ITEMS[held.id] : null;
    if (heldDef && heldDef.type === 'tool' && heldDef.toolType === blockDef.tool) {
      speed = heldDef.speed || 2.0;
    }

    this.miningProgress += (speed / blockDef.hardness) * dt;

    // 徐々にヒビが入っていく表示
    const stage = Math.min(9, Math.floor(this.miningProgress * 10));
    this.crackMaterial.map = this.crackTextures[stage];
    this.crackMaterial.needsUpdate = true;
    this.crackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.crackMesh.visible = true;

    if (this.miningProgress >= 1.0) {
      this.completeBreakBlock(x, y, z, blockDef);
    }
  }

  completeBreakBlock(x, y, z, blockDef) {
    this.world.setBlock(x, y, z, 0);
    this.sound.playBreak();
    this.miningProgress = 0;
    this.crackMesh.visible = false;

    if (this.mode === 'survival') {
      this.damageHeldTool(1);
      if (blockDef.dropId) {
        const chance = blockDef.dropChance ?? 1.0;
        if (Math.random() <= chance) {
          this.addItem(blockDef.dropId, 1);
        }
      }
    }
  }

  intersectsPlayer(bx, by, bz) {
    return (
      this.position.x + this.radius > bx && this.position.x - this.radius < bx + 1 &&
      this.position.y + this.height > by && this.position.y < by + 1 &&
      this.position.z + this.radius > bz && this.position.z - this.radius < bz + 1
    );
  }

  collidesAt(pos) {
    const minX = Math.floor(pos.x - this.radius);
    const maxX = Math.floor(pos.x + this.radius);
    const minY = Math.floor(pos.y);
    const maxY = Math.floor(pos.y + this.height);
    const minZ = Math.floor(pos.z - this.radius);
    const maxZ = Math.floor(pos.z + this.radius);

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

    forward -= this.joyInput.z;
    strafe += this.joyInput.x;

    if (this.keys['Space']) this.jump();

    const speed = 5.3;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let moveX = (-sin * forward + cos * strafe);
    let moveZ = (-cos * forward - sin * strafe);
    const len = Math.hypot(moveX, moveZ);
    if (len > 1) { moveX /= len; moveZ /= len; }

    const prevX = this.position.x;
    const prevZ = this.position.z;

    const nextX = this.position.clone();
    nextX.x += moveX * speed * dt;
    if (!this.collidesAt(nextX)) this.position.x = nextX.x;

    const nextZ = this.position.clone();
    nextZ.z += moveZ * speed * dt;
    if (!this.collidesAt(nextZ)) this.position.z = nextZ.z;

    // 歩行時の足音再生
    const movedDist = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
    if (this.onGround && movedDist > 0.001) {
      this.stepDistance += movedDist;
      if (this.stepDistance >= 2.1) {
        this.stepDistance = 0;
        const underId = this.world.getBlock(
          Math.floor(this.position.x),
          Math.floor(this.position.y - 0.2),
          Math.floor(this.position.z)
        );
        const snd = ITEMS[underId]?.sound || 'grass';
        this.sound.playStep(snd);
      }
    }

    // 重力
    this.velocity.y -= 20 * dt;
    const nextY = this.position.clone();
    nextY.y += this.velocity.y * dt;
    if (this.collidesAt(nextY)) {
      if (this.velocity.y < 0) this.onGround = true;
      this.velocity.y = 0;
    } else {
      this.position.y = nextY.y;
      this.onGround = false;
    }

    if (this.position.y < -15) this.spawn();

    // サバイバル満腹度減少
    if (this.mode === 'survival') {
      this.hungerTimer += dt;
      if (this.hungerTimer >= 18) {
        this.hungerTimer = 0;
        if (this.hunger > 0) {
          this.hunger = Math.max(0, this.hunger - 1);
          this.notifyStats();
        } else {
          this.takeDamage(1);
        }
      }
    }

    // 採掘（ヒビ割れ進行）
    this.updateMining(dt);

    // カメラ更新
    this.camera.position.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    // 照準ブロックハイライト
    const hit = this.getTargetHit();
    if (hit) {
      const { x, y, z } = hit.object.userData;
      this.highlightBox.position.set(x + 0.5, y + 0.5, z + 0.5);
      this.highlightBox.visible = true;
    } else {
      this.highlightBox.visible = false;
    }
  }
}
