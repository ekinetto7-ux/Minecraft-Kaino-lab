import * as THREE from 'three';
import { ITEMS, RECIPES, createAssets } from './textures.js';
import { World } from './world.js';
import { Player, SoundEngine } from './player.js';

const WORLDS_STORAGE_KEY = 'webcraft_saved_worlds_v2';

// DOM参照
const homeScreen = document.getElementById('home-screen');
const worldSelectScreen = document.getElementById('world-select-screen');
const worldCreateScreen = document.getElementById('world-create-screen');
const settingsScreen = document.getElementById('settings-screen');
const gameplayHud = document.getElementById('gameplay-hud');
const pauseOverlay = document.getElementById('pause-overlay');
const inventoryModal = document.getElementById('inventory-modal');

// Three.js 基本セットアップ
const container = document.getElementById('game-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 26, 68);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.68));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.72);
dirLight.position.set(35, 60, 25);
scene.add(dirLight);

const { blockMaterials, icons, crackTextures } = createAssets();
const sound = new SoundEngine();
const world = new World(scene, blockMaterials);
// タイトル画面の背景用に初期パノラマワールド生成
world.generateNew(12345);

const player = new Player(camera, world, renderer.domElement, crackTextures, sound);

// ========== 敵モブ（ゾンビ・スケルトン）管理システム ==========
class MobManager {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.mobs = [];
    this.spawnTimer = 0;
  }

  clear() {
    for (const m of this.mobs) this.scene.remove(m.mesh);
    this.mobs = [];
  }

  spawnMob(type = 'zombie') {
    if (this.mobs.length >= 10) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = 12 + Math.random() * 14;
    const sx = Math.floor(this.player.position.x + Math.cos(angle) * dist);
    const sz = Math.floor(this.player.position.z + Math.sin(angle) * dist);
    if (sx < 2 || sx >= this.world.sizeX - 2 || sz < 2 || sz >= this.world.sizeZ - 2) return;

    let sy = -1;
    for (let y = this.world.maxY - 1; y >= 0; y--) {
      if (this.world.getBlock(sx, y, sz) !== 0) { sy = y + 1; break; }
    }
    if (sy < 0) return;

    const group = new THREE.Group();
    const isZombie = type === 'zombie';
    const bodyMat = new THREE.MeshLambertMaterial({ color: isZombie ? 0x2d7a47 : 0xdcdcdc });
    const headMat = new THREE.MeshLambertMaterial({ color: isZombie ? 0x4b9e44 : 0xeaeaea });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.35), bodyMat);
    body.position.y = 0.55;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
    head.position.y = 1.35;

    group.add(body);
    group.add(head);
    group.position.set(sx + 0.5, sy, sz + 0.5);
    this.scene.add(group);

    this.mobs.push({
      type,
      mesh: group,
      hp: isZombie ? 12 : 10,
      hitCooldown: 0,
      shootTimer: 2.5
    });
  }

  tryPlayerAttack() {
    const ray = new THREE.Raycaster();
    ray.far = 4.2;
    ray.setFromCamera(new THREE.Vector2(0, 0), this.player.camera);
    const targets = this.mobs.map(m => m.mesh);
    const hits = ray.intersectObjects(targets, true);
    if (hits.length === 0) return false;

    let hitGroup = hits[0].object;
    while (hitGroup.parent && !this.mobs.some(m => m.mesh === hitGroup)) {
      hitGroup = hitGroup.parent;
    }
    const mob = this.mobs.find(m => m.mesh === hitGroup);
    if (!mob) return false;

    const held = this.player.getHeldItem();
    const dmg = held ? (ITEMS[held.id]?.damage || 2) : 1;
    mob.hp -= dmg;
    sound.playHit();
    this.player.damageHeldTool(1);

    // ノックバック
    const push = mob.mesh.position.clone().sub(this.player.position).setY(0).normalize();
    mob.mesh.position.addScaledVector(push, 0.8);

    if (mob.hp <= 0) {
      this.scene.remove(mob.mesh);
      this.mobs = this.mobs.filter(m => m !== mob);
      // ドロップ報酬
      if (this.player.mode === 'survival') {
        this.player.addItem(mob.type === 'zombie' ? 202 : 307, 1);
      }
    }
    return true;
  }

  update(dt) {
    if (this.player.mode !== 'survival') return;

    this.spawnTimer += dt;
    if (this.spawnTimer >= 6) {
      this.spawnTimer = 0;
      this.spawnMob(Math.random() < 0.6 ? 'zombie' : 'skeleton');
    }

    for (const mob of this.mobs) {
      if (mob.hitCooldown > 0) mob.hitCooldown -= dt;

      const toPlayer = new THREE.Vector3().subVectors(this.player.position, mob.mesh.position);
      const dist = Math.hypot(toPlayer.x, toPlayer.z);
      mob.mesh.lookAt(this.player.position.x, mob.mesh.position.y, this.player.position.z);

      if (dist > 1.4 && dist < 24) {
        const speed = mob.type === 'zombie' ? 2.1 : 1.7;
        const dirX = toPlayer.x / dist;
        const dirZ = toPlayer.z / dist;
        const nx = mob.mesh.position.x + dirX * speed * dt;
        const nz = mob.mesh.position.z + dirZ * speed * dt;

        // 足元の高さ調整
        const bx = Math.floor(nx);
        const bz = Math.floor(nz);
        let groundY = -1;
        for (let y = Math.floor(mob.mesh.position.y) + 1; y >= 0; y--) {
          if (this.world.getBlock(bx, y, bz) !== 0) { groundY = y + 1; break; }
        }
        if (groundY >= 0 && Math.abs(groundY - mob.mesh.position.y) <= 1.2) {
          mob.mesh.position.set(nx, groundY, nz);
        }
      }

      // 近接攻撃（ゾンビ）または遠距離射撃（スケルトン）
      if (mob.type === 'zombie' && dist <= 1.6 && mob.hitCooldown <= 0) {
        mob.hitCooldown = 1.3;
        this.player.takeDamage(2);
      } else if (mob.type === 'skeleton' && dist <= 12) {
        mob.shootTimer -= dt;
        if (mob.shootTimer <= 0) {
          mob.shootTimer = 3.2;
          this.player.takeDamage(2);
        }
      }
    }
  }
}

const mobManager = new MobManager(scene, world, player);
player.onAttackMob = () => mobManager.tryPlayerAttack();

// ========== ゲーム状態・セーブデータ管理 ==========
let gameState = 'HOME'; // 'HOME' | 'PLAYING' | 'PAUSED' | 'INVENTORY'
let currentWorldId = null;
let selectedWorldListId = null;
let createMode = 'survival';
let isUsingCraftingTable = false;
let activeCreativeTab = 'ブロック';

function loadSavedWorlds() {
  try {
    return JSON.parse(localStorage.getItem(WORLDS_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveWorldsList(list) {
  localStorage.setItem(WORLDS_STORAGE_KEY, JSON.stringify(list));
}

function saveCurrentGame() {
  if (!currentWorldId) return;
  const list = loadSavedWorlds();
  const idx = list.findIndex(w => w.id === currentWorldId);
  if (idx === -1) return;

  list[idx].updatedAt = new Date().toLocaleString('ja-JP');
  list[idx].blocks = world.serialize();
  list[idx].player = {
    pos: player.position.toArray(),
    health: player.health,
    hunger: player.hunger,
    inventory: player.inventory
  };
  saveWorldsList(list);
}

// ========== 画面遷移ヘルパー ==========
function showScreen(screenEl) {
  [homeScreen, worldSelectScreen, worldCreateScreen, settingsScreen, gameplayHud, pauseOverlay, inventoryModal]
    .forEach(el => el.classList.add('hidden'));
  if (screenEl) screenEl.classList.remove('hidden');
}

function renderWorldList() {
  const listEl = document.getElementById('world-list');
  const worlds = loadSavedWorlds();
  listEl.innerHTML = '';

  if (worlds.length === 0) {
    listEl.innerHTML = '<div style="color:#aaa;text-align:center;padding:40px;">セーブされたワールドがありません。「ワールド新規作成」から始めてください。</div>';
    document.getElementById('btn-play-selected').disabled = true;
    document.getElementById('btn-delete-world').disabled = true;
    return;
  }

  worlds.forEach(w => {
    const div = document.createElement('div');
    div.className = 'world-item' + (w.id === selectedWorldListId ? ' selected' : '');
    div.innerHTML = `
      <div>
        <div class="world-item-title">${w.name}</div>
        <div class="world-item-meta">${w.mode === 'survival' ? 'サバイバルモード' : 'クリエイティブモード'} / 更新: ${w.updatedAt}</div>
      </div>
    `;
    div.addEventListener('click', () => {
      selectedWorldListId = w.id;
      document.getElementById('btn-play-selected').disabled = false;
      document.getElementById('btn-delete-world').disabled = false;
      renderWorldList();
    });
    listEl.appendChild(div);
  });
}

function startWorldSession(worldObj) {
  currentWorldId = worldObj.id;
  mobManager.clear();

  if (worldObj.blocks && worldObj.blocks.length > 0) {
    world.deserialize(worldObj.blocks);
  } else {
    world.generateNew(worldObj.seed);
  }

  player.setupMode(worldObj.mode);
  if (worldObj.player) {
    player.position.fromArray(worldObj.player.pos);
    player.health = worldObj.player.health ?? 20;
    player.hunger = worldObj.player.hunger ?? 20;
    if (worldObj.player.inventory) player.inventory = worldObj.player.inventory;
  } else {
    player.spawn();
  }

  document.getElementById('mode-badge').textContent = worldObj.mode === 'survival' ? 'サバイバル' : 'クリエイティブ';
  document.getElementById('status-bars').style.display = worldObj.mode === 'survival' ? 'flex' : 'none';

  renderHotbar();
  renderStatsBars();
  enterGameplay();
}

function enterGameplay() {
  gameState = 'PLAYING';
  showScreen(gameplayHud);
  if (renderer.domElement.requestPointerLock) {
    try { renderer.domElement.requestPointerLock(); } catch {}
  }
}

// ========== ホーム＆メニューボタンイベント ==========
document.getElementById('btn-goto-worlds').addEventListener('click', () => {
  selectedWorldListId = null;
  renderWorldList();
  showScreen(worldSelectScreen);
});

document.getElementById('btn-goto-settings').addEventListener('click', () => showScreen(settingsScreen));
document.getElementById('btn-back-home1').addEventListener('click', () => showScreen(homeScreen));
document.getElementById('btn-back-home2').addEventListener('click', () => showScreen(homeScreen));
document.getElementById('btn-goto-create').addEventListener('click', () => showScreen(worldCreateScreen));
document.getElementById('btn-back-worlds').addEventListener('click', () => {
  renderWorldList();
  showScreen(worldSelectScreen);
});

document.getElementById('btn-toggle-mode').addEventListener('click', (e) => {
  createMode = createMode === 'survival' ? 'creative' : 'survival';
  e.target.textContent = `ゲームモード: ${createMode === 'survival' ? 'サバイバル' : 'クリエイティブ'}`;
  document.getElementById('mode-desc').textContent = createMode === 'survival'
    ? '資源を集め、クラフトし、体力と満腹度を管理して生き残ります。'
    : 'すべてのブロックとアイテムを無限に使い、自由に建築できます。';
});

document.getElementById('btn-create-start').addEventListener('click', () => {
  const name = document.getElementById('input-world-name').value.trim() || '新しいワールド';
  const seedRaw = document.getElementById('input-world-seed').value.trim();
  const seed = seedRaw ? Number(seedRaw) || seedRaw.length * 1337 : Math.floor(Math.random() * 99999);

  const newWorld = {
    id: 'w_' + Date.now(),
    name,
    mode: createMode,
    seed,
    updatedAt: new Date().toLocaleString('ja-JP'),
    blocks: [],
    player: null
  };

  const list = loadSavedWorlds();
  list.unshift(newWorld);
  saveWorldsList(list);
  startWorldSession(newWorld);
});

document.getElementById('btn-play-selected').addEventListener('click', () => {
  const w = loadSavedWorlds().find(item => item.id === selectedWorldListId);
  if (w) startWorldSession(w);
});

document.getElementById('btn-delete-world').addEventListener('click', () => {
  if (!selectedWorldListId) return;
  const filtered = loadSavedWorlds().filter(w => w.id !== selectedWorldListId);
  saveWorldsList(filtered);
  selectedWorldListId = null;
  renderWorldList();
});

// 設定画面コントロール
document.getElementById('btn-toggle-sound').addEventListener('click', (e) => {
  sound.enabled = !sound.enabled;
  e.target.textContent = `サウンド（足音・効果音）: ${sound.enabled ? 'ON' : 'OFF'}`;
});

document.getElementById('range-fov').addEventListener('input', (e) => {
  const v = Number(e.target.value);
  document.getElementById('fov-val').textContent = v;
  camera.fov = v;
  camera.updateProjectionMatrix();
});

document.getElementById('range-sens').addEventListener('input', (e) => {
  const v = Number(e.target.value);
  document.getElementById('sens-val').textContent = v.toFixed(1);
  player.sensitivity = v;
});

// ========== ホットバー＆ステータス描画 ==========
function createSlotElement(slotData, index, showNum = false) {
  const el = document.createElement('div');
  el.className = 'mc-slot' + (showNum && index === player.selectedSlot ? ' active' : '');

  if (showNum) {
    const num = document.createElement('span');
    num.className = 'slot-num';
    num.textContent = index + 1;
    el.appendChild(num);
  }

  if (slotData && ITEMS[slotData.id]) {
    const def = ITEMS[slotData.id];
    el.title = def.name;

    const iconCanvas = document.createElement('canvas');
    iconCanvas.width = 16;
    iconCanvas.height = 16;
    iconCanvas.getContext('2d').drawImage(icons[slotData.id], 0, 0);
    el.appendChild(iconCanvas);

    if (player.mode === 'survival' && slotData.count > 1) {
      const cnt = document.createElement('span');
      cnt.className = 'slot-count';
      cnt.textContent = slotData.count;
      el.appendChild(cnt);
    }

    if (slotData.durability !== undefined && def.maxDurability) {
      const bar = document.createElement('div');
      bar.className = 'slot-durability';
      const fill = document.createElement('div');
      fill.className = 'slot-durability-fill';
      fill.style.width = `${Math.max(5, (slotData.durability / def.maxDurability) * 100)}%`;
      bar.appendChild(fill);
      el.appendChild(bar);
    }
  }
  return el;
}

function renderHotbar() {
  const hotbarEl = document.getElementById('hotbar');
  hotbarEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const slotEl = createSlotElement(player.inventory[i], i, true);
    slotEl.addEventListener('click', () => {
      player.selectedSlot = i;
      renderHotbar();
    });
    hotbarEl.appendChild(slotEl);
  }
  const held = player.getHeldItem();
  document.getElementById('held-item-name').textContent = held ? ITEMS[held.id].name : '';
}

function renderStatsBars() {
  const hpEl = document.getElementById('health-bar');
  const hgEl = document.getElementById('hunger-bar');
  const hearts = Math.ceil(player.health / 2);
  const meats = Math.ceil(player.hunger / 2);
  hpEl.textContent = '❤️'.repeat(hearts) + '🖤'.repeat(Math.max(0, 10 - hearts));
  hgEl.textContent = '🍖'.repeat(meats) + '🦴'.repeat(Math.max(0, 10 - meats));
}

player.onInventoryChange = () => {
  renderHotbar();
  if (gameState === 'INVENTORY') renderInventoryModal();
};
player.onStatsChange = renderStatsBars;
player.onDamage = () => {
  const flash = document.getElementById('damage-flash');
  flash.style.opacity = '1';
  setTimeout(() => { flash.style.opacity = '0'; }, 160);
};
player.onOpenCraftingTable = () => openInventory(true);

// ========== インベントリ / 作業台 / クリエイティブメニュー (Eキー) ==========
function countTotalItem(id) {
  let total = 0;
  for (const s of player.inventory) {
    if (s && s.id === id) total += s.count;
  }
  return total;
}

function consumeMaterials(reqList) {
  for (const r of reqList) {
    let need = r.count;
    for (let i = 0; i < 36; i++) {
      const s = player.inventory[i];
      if (s && s.id === r.id) {
        const take = Math.min(s.count, need);
        s.count -= take;
        need -= take;
        if (s.count <= 0) player.inventory[i] = null;
        if (need <= 0) break;
      }
    }
  }
}

function openInventory(fromCraftingTable = false) {
  isUsingCraftingTable = fromCraftingTable;
  gameState = 'INVENTORY';
  if (document.pointerLockElement) document.exitPointerLock();

  inventoryModal.classList.remove('hidden');
  renderInventoryModal();
}

function closeInventory() {
  inventoryModal.classList.add('hidden');
  enterGameplay();
}

function renderInventoryModal() {
  const titleEl = document.getElementById('inv-title');
  const survBody = document.getElementById('survival-inv-body');
  const creaBody = document.getElementById('creative-inv-body');

  if (player.mode === 'creative') {
    titleEl.textContent = 'クリエイティブインベントリ（全アイテム）';
    survBody.classList.add('hidden');
    creaBody.classList.remove('hidden');
    renderCreativeMenu();
    return;
  }

  survBody.classList.remove('hidden');
  creaBody.classList.add('hidden');
  titleEl.textContent = isUsingCraftingTable ? '作業台（全アイテム作成可能）' : 'インベントリ（手元クラフト）';
  document.getElementById('craft-section-label').textContent = isUsingCraftingTable
    ? '作業台レシピ（クリックで作成）'
    : '手元作成メニュー（作業台を設置して右クリックすると全レシピ解放）';

  // クラフトレシピ一覧
  const recipeListEl = document.getElementById('craft-recipe-list');
  recipeListEl.innerHTML = '';
  const visibleRecipes = RECIPES.filter(r => isUsingCraftingTable || !r.tableOnly);

  visibleRecipes.forEach(recipe => {
    const outDef = ITEMS[recipe.outId];
    const canCraft = recipe.req.every(r => countTotalItem(r.id) >= r.count);
    const reqText = recipe.req.map(r => `${ITEMS[r.id].name}×${r.count}`).join(' + ');

    const card = document.createElement('div');
    card.className = 'recipe-card' + (canCraft ? ' craftable' : '');

    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    c.style.width = '24px'; c.style.height = '24px';
    c.getContext('2d').drawImage(icons[recipe.outId], 0, 0);
    card.appendChild(c);

    const info = document.createElement('div');
    info.className = 'recipe-info';
    info.innerHTML = `<strong>${outDef.name} ×${recipe.outCount}</strong><br>${reqText}`;
    card.appendChild(info);

    card.addEventListener('click', () => {
      if (!canCraft) return;
      consumeMaterials(recipe.req);
      player.addItem(recipe.outId, recipe.outCount);
      sound.playPlace();
      renderInventoryModal();
    });
    recipeListEl.appendChild(card);
  });

  // ストレージ (9..35) と ホットバー (0..8)
  const storageGrid = document.getElementById('inv-storage-grid');
  const hotbarGrid = document.getElementById('inv-hotbar-grid');
  storageGrid.innerHTML = '';
  hotbarGrid.innerHTML = '';

  for (let i = 9; i < 36; i++) {
    const slotEl = createSlotElement(player.inventory[i], i, false);
    slotEl.addEventListener('click', () => {
      // クリックで現在選択中のホットバースロットと入れ替え
      const tmp = player.inventory[player.selectedSlot];
      player.inventory[player.selectedSlot] = player.inventory[i];
      player.inventory[i] = tmp;
      renderHotbar();
      renderInventoryModal();
    });
    storageGrid.appendChild(slotEl);
  }

  for (let i = 0; i < 9; i++) {
    const slotEl = createSlotElement(player.inventory[i], i, true);
    slotEl.addEventListener('click', () => {
      player.selectedSlot = i;
      renderHotbar();
      renderInventoryModal();
    });
    hotbarGrid.appendChild(slotEl);
  }
}

function renderCreativeMenu() {
  const categories = ['ブロック', '道具', '武器・防具', '食料', '鉱石・素材', '醸造・ポーション', '移動・乗り物', '装飾・その他'];
  const tabsEl = document.getElementById('creative-tabs');
  tabsEl.innerHTML = '';

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'mc-tab-btn' + (cat === activeCreativeTab ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      activeCreativeTab = cat;
      renderCreativeMenu();
    });
    tabsEl.appendChild(btn);
  });

  const catalogEl = document.getElementById('creative-catalog-grid');
  catalogEl.innerHTML = '';
  Object.values(ITEMS)
    .filter(item => item.cat === activeCreativeTab)
    .forEach(item => {
      const slotEl = createSlotElement({ id: item.id, count: 64 }, 0, false);
      slotEl.addEventListener('click', () => {
        player.inventory[player.selectedSlot] = {
          id: item.id,
          count: 64,
          durability: item.maxDurability || undefined
        };
        renderHotbar();
        renderCreativeMenu();
      });
      catalogEl.appendChild(slotEl);
    });

  const hotbarGrid = document.getElementById('creative-hotbar-grid');
  hotbarGrid.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const slotEl = createSlotElement(player.inventory[i], i, true);
    slotEl.addEventListener('click', () => {
      player.selectedSlot = i;
      renderHotbar();
      renderCreativeMenu();
    });
    hotbarGrid.appendChild(slotEl);
  }
}

// ========== キーボード＆UI操作イベント ==========
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') {
    if (gameState === 'PLAYING') {
      openInventory(false);
    } else if (gameState === 'INVENTORY') {
      closeInventory();
    }
  }

  if (gameState === 'PLAYING' && e.code.startsWith('Digit')) {
    const num = parseInt(e.code.replace('Digit', ''), 10);
    if (num >= 1 && num <= 9) {
      player.selectedSlot = num - 1;
      renderHotbar();
    }
  }
});

window.addEventListener('wheel', (e) => {
  if (gameState !== 'PLAYING') return;
  const dir = e.deltaY > 0 ? 1 : -1;
  player.selectedSlot = (player.selectedSlot + dir + 9) % 9;
  renderHotbar();
});

document.getElementById('btn-open-inv').addEventListener('click', () => openInventory(false));
document.getElementById('btn-close-inv').addEventListener('click', closeInventory);

// ポーズメニュー制御
function openPauseMenu() {
  gameState = 'PAUSED';
  if (document.pointerLockElement) document.exitPointerLock();
  document.getElementById('pause-msg').textContent = '';
  pauseOverlay.classList.remove('hidden');
}

document.getElementById('btn-pause').addEventListener('click', openPauseMenu);
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && gameState === 'PLAYING' && !('ontouchstart' in window)) {
    openPauseMenu();
  }
});

document.getElementById('btn-resume').addEventListener('click', () => {
  pauseOverlay.classList.add('hidden');
  enterGameplay();
});

document.getElementById('btn-save-world').addEventListener('click', () => {
  saveCurrentGame();
  document.getElementById('pause-msg').textContent = 'ワールドを保存しました！';
});

document.getElementById('btn-save-quit').addEventListener('click', () => {
  saveCurrentGame();
  mobManager.clear();
  gameState = 'HOME';
  showScreen(homeScreen);
});

// スマホ用ジョイスティック＆ボタン
const joyBase = document.getElementById('joystick-base');
const joyStick = document.getElementById('joystick-stick');
let joyTouchId = null;

joyBase.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  joyTouchId = t.identifier;
  updateJoy(t);
});
joyBase.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) if (t.identifier === joyTouchId) updateJoy(t);
});
const endJoy = (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) {
      joyTouchId = null;
      joyStick.style.transform = 'translate(-50%, -50%)';
      player.joyInput = { x: 0, z: 0 };
    }
  }
};
joyBase.addEventListener('touchend', endJoy);
joyBase.addEventListener('touchcancel', endJoy);

function updateJoy(touch) {
  const rect = joyBase.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxR = rect.width / 2;
  let dx = touch.clientX - cx;
  let dy = touch.clientY - cy;
  const d = Math.hypot(dx, dy);
  if (d > maxR) { dx = (dx / d) * maxR; dy = (dy / d) * maxR; }
  joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  player.joyInput = { x: dx / maxR, z: dy / maxR };
}

const btnBreak = document.getElementById('btn-break');
btnBreak.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!mobManager.tryPlayerAttack()) player.isMining = true;
});
btnBreak.addEventListener('touchend', () => {
  player.isMining = false;
  player.miningProgress = 0;
  player.crackMesh.visible = false;
});
document.getElementById('btn-place').addEventListener('touchstart', (e) => {
  e.preventDefault();
  player.rightClickAction();
});
document.getElementById('btn-jump').addEventListener('touchstart', (e) => {
  e.preventDefault();
  player.jump();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ========== メインループ ==========
let lastTime = performance.now();
let panoramaAngle = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (gameState === 'PLAYING') {
    player.update(dt);
    mobManager.update(dt);
    document.getElementById('coords').textContent =
      `XYZ: ${Math.floor(player.position.x)} / ${Math.floor(player.position.y)} / ${Math.floor(player.position.z)}`;
  } else if (gameState === 'HOME') {
    // タイトル画面のパノラマ背景回転
    panoramaAngle += dt * 0.15;
    camera.position.set(32 + Math.cos(panoramaAngle) * 18, 17, 32 + Math.sin(panoramaAngle) * 18);
    camera.lookAt(32, 10, 32);
  }

  renderer.render(scene, camera);
}

animate(lastTime);
