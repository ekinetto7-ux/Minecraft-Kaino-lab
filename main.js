import * as THREE from 'three';
import { ITEMS, RECIPES, createAssets } from './textures.js';
import { World } from './world.js';
import { Player, SoundEngine } from './player.js';

const WORLDS_STORAGE_KEY = 'webcraft_saved_worlds_v3';

const homeScreen = document.getElementById('home-screen');
const worldSelectScreen = document.getElementById('world-select-screen');
const worldCreateScreen = document.getElementById('world-create-screen');
const settingsScreen = document.getElementById('settings-screen');
const gameplayHud = document.getElementById('gameplay-hud');
const pauseOverlay = document.getElementById('pause-overlay');
const inventoryModal = document.getElementById('inventory-modal');

const container = document.getElementById('game-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 24, 64);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
dirLight.position.set(40, 70, 30);
scene.add(dirLight);

const { blockMaterials, icons, crackTextures, mobTextures } = createAssets();
const sound = new SoundEngine();
const world = new World(scene, blockMaterials);
const player = new Player(camera, world, renderer.domElement, crackTextures, sound);

// 敵モブマネージャー（夜間出現＆湧き潰し対応）
class MobManager {
  constructor(scene, world, player, mobTextures) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.mobTextures = mobTextures;
    this.mobs = [];
    this.spawnTimer = 0;
  }
  clear() {
    for (const m of this.mobs) this.scene.remove(m.mesh);
    this.mobs = [];
  }
  spawnMob() {
    if (this.mobs.length >= 6) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 10;
    const sx = Math.floor(this.player.position.x + Math.cos(angle) * dist);
    const sz = Math.floor(this.player.position.z + Math.sin(angle) * dist);
    
    // 松明の周り（湧き潰し）は敵が湧かない
    if (this.world.getBlock(sx, Math.floor(this.player.position.y), sz) === 21) return;

    let sy = -1;
    for (let y = 35; y >= 0; y--) {
      if (this.world.getBlock(sx, y, sz) !== 0) { sy = y + 1; break; }
    }
    if (sy < 0) return;

    const group = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshLambertMaterial({ map: this.mobTextures.zombieHead }));
    head.position.y = 1.35;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.22), new THREE.MeshLambertMaterial({ map: this.mobTextures.zombieBody }));
    body.position.y = 0.82;
    group.add(head); group.add(body);
    group.position.set(sx + 0.5, sy, sz + 0.5);
    this.scene.add(group);

    this.mobs.push({ mesh: group, hp: 10, hitCooldown: 0 });
  }

  tryAttack() {
    const ray = new THREE.Raycaster();
    ray.far = 4.0; ray.setFromCamera(new THREE.Vector2(0, 0), this.player.camera);
    const hits = ray.intersectObjects(this.mobs.map(m => m.mesh), true);
    if (hits.length === 0) return false;
    const mob = this.mobs.find(m => m.mesh === hits[0].object.parent || m.mesh === hits[0].object);
    if (!mob) return false;
    mob.hp -= 4; sound.playHit();
    if (mob.hp <= 0) {
      this.scene.remove(mob.mesh);
      this.mobs = this.mobs.filter(m => m !== mob);
      player.addItem(301, 1);
    }
    return true;
  }

  update(dt, isNight) {
    if (!isNight || player.mode !== 'survival') return;
    this.spawnTimer += dt;
    if (this.spawnTimer >= 6) { this.spawnTimer = 0; this.spawnMob(); }
    for (const mob of this.mobs) {
      const toPlayer = new THREE.Vector3().subVectors(player.position, mob.mesh.position);
      const dist = Math.hypot(toPlayer.x, toPlayer.z);
      mob.mesh.lookAt(player.position.x, mob.mesh.position.y, player.position.z);
      if (dist > 1.3 && dist < 18) {
        mob.mesh.position.addScaledVector(toPlayer.normalize(), 1.6 * dt);
      }
      if (dist <= 1.5 && mob.hitCooldown <= 0) {
        mob.hitCooldown = 1.2; player.takeDamage(2);
      }
    }
  }
}

const mobManager = new MobManager(scene, world, player, mobTextures);
player.onAttackMob = () => mobManager.tryAttack();

let gameState = 'HOME';
let gameTime = 0; // 0 ~ 24000 (昼夜サイクル)
let currentWorldId = null;
let selectedWorldListId = null;
let createMode = 'survival';
let activeInteractive = null;

function loadSavedWorlds() {
  try { return JSON.parse(localStorage.getItem(WORLDS_STORAGE_KEY)) || []; } catch { return []; }
}
function saveWorldsList(list) { localStorage.setItem(WORLDS_STORAGE_KEY, JSON.stringify(list)); }

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
    listEl.innerHTML = '<div style="color:#aaa;text-align:center;padding:40px;">ワールドがありません</div>';
    document.getElementById('btn-play-selected').disabled = true;
    document.getElementById('btn-delete-world').disabled = true;
    return;
  }
  worlds.forEach(w => {
    const div = document.createElement('div');
    div.className = 'world-item' + (w.id === selectedWorldListId ? ' selected' : '');
    div.innerHTML = `<div><div class="world-item-title">${w.name}</div><div class="world-item-meta">${w.mode === 'survival' ? 'サバイバル' : 'クリエイティブ'}</div></div>`;
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
  world.clear();
  world.updateAroundPlayer(8, 8, 2, worldObj.seed);
  player.setupMode(worldObj.mode);
  player.spawn();

  document.getElementById('mode-badge').textContent = worldObj.mode === 'survival' ? 'サバイバル' : 'クリエイティブ';
  document.getElementById('status-bars').style.display = worldObj.mode === 'survival' ? 'flex' : 'none';
  renderHotbar();
  renderStatsBars();
  enterGameplay();
}

function enterGameplay() {
  gameState = 'PLAYING';
  showScreen(gameplayHud);
  try { renderer.domElement.requestPointerLock(); } catch {}
}

document.getElementById('btn-goto-worlds').addEventListener('click', () => { renderWorldList(); showScreen(worldSelectScreen); });
document.getElementById('btn-goto-settings').addEventListener('click', () => showScreen(settingsScreen));
document.getElementById('btn-back-home1').addEventListener('click', () => showScreen(homeScreen));
document.getElementById('btn-back-home2').addEventListener('click', () => showScreen(homeScreen));
document.getElementById('btn-goto-create').addEventListener('click', () => showScreen(worldCreateScreen));
document.getElementById('btn-back-worlds').addEventListener('click', () => { renderWorldList(); showScreen(worldSelectScreen); });

document.getElementById('btn-toggle-mode').addEventListener('click', (e) => {
  createMode = createMode === 'survival' ? 'creative' : 'survival';
  e.target.textContent = `ゲームモード: ${createMode === 'survival' ? 'サバイバル' : 'クリエイティブ'}`;
});

document.getElementById('btn-create-start').addEventListener('click', () => {
  const name = document.getElementById('input-world-name').value.trim() || '大世界';
  const seed = Math.floor(Math.random() * 99999);
  const w = { id: 'w_' + Date.now(), name, mode: createMode, seed };
  const list = loadSavedWorlds(); list.unshift(w); saveWorldsList(list);
  startWorldSession(w);
});

document.getElementById('btn-play-selected').addEventListener('click', () => {
  const w = loadSavedWorlds().find(item => item.id === selectedWorldListId);
  if (w) startWorldSession(w);
});

document.getElementById('btn-delete-world').addEventListener('click', () => {
  saveWorldsList(loadSavedWorlds().filter(w => w.id !== selectedWorldListId));
  selectedWorldListId = null; renderWorldList();
});

function createSlotElement(slotData, index, showNum = false) {
  const el = document.createElement('div');
  el.className = 'mc-slot' + (showNum && index === player.selectedSlot ? ' active' : '');
  if (showNum) {
    const num = document.createElement('span'); num.className = 'slot-num'; num.textContent = index + 1; el.appendChild(num);
  }
  if (slotData && ITEMS[slotData.id]) {
    const def = ITEMS[slotData.id]; el.title = def.name;
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    c.getContext('2d').drawImage(icons[slotData.id], 0, 0);
    el.appendChild(c);
    if (slotData.count > 1) {
      const cnt = document.createElement('span'); cnt.className = 'slot-count'; cnt.textContent = slotData.count; el.appendChild(cnt);
    }
  }
  return el;
}

function renderHotbar() {
  const hb = document.getElementById('hotbar'); hb.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const slotEl = createSlotElement(player.inventory[i], i, true);
    slotEl.addEventListener('click', () => { player.selectedSlot = i; renderHotbar(); });
    hb.appendChild(slotEl);
  }
  const held = player.getHeldItem();
  document.getElementById('held-item-name').textContent = held ? ITEMS[held.id].name : '';
}

function renderStatsBars() {
  const h = Math.ceil(player.health / 2), fg = Math.ceil(player.hunger / 2);
  document.getElementById('health-bar').textContent = '❤️'.repeat(h) + '🖤'.repeat(10 - h);
  document.getElementById('hunger-bar').textContent = '🍖'.repeat(fg) + '🦴'.repeat(10 - fg);
}

player.onInventoryChange = () => { renderHotbar(); if (gameState === 'INVENTORY') renderInventoryModal(); };
player.onStatsChange = renderStatsBars;
player.onDamage = () => {
  const f = document.getElementById('damage-flash'); f.style.opacity = '1';
  setTimeout(() => { f.style.opacity = '0'; }, 160);
};
player.onOpenInteractive = (type) => {
  if (type === 'bed') {
    gameTime = 0; // 朝にする
    sound.playEat();
    return;
  }
  openInventory(type);
};

function openInventory(type = 'inventory') {
  activeInteractive = type;
  gameState = 'INVENTORY';
  if (document.pointerLockElement) document.exitPointerLock();
  showScreen(inventoryModal);
  renderInventoryModal();
}

function renderInventoryModal() {
  const titleEl = document.getElementById('inv-title');
  const survBody = document.getElementById('survival-inv-body');
  const creaBody = document.getElementById('creative-inv-body');

  if (player.mode === 'creative') {
    titleEl.textContent = 'クリエイティブメニュー';
    survBody.classList.add('hidden'); creaBody.classList.remove('hidden');
    renderCreativeMenu(); return;
  }

  survBody.classList.remove('hidden'); creaBody.classList.add('hidden');
  titleEl.textContent = activeInteractive === 'furnace' ? 'かまど（精錬）' : (activeInteractive === 'crafting_table' ? '作業台' : 'インベントリ');

  const recipeListEl = document.getElementById('craft-recipe-list');
  recipeListEl.innerHTML = '';
  RECIPES.forEach(recipe => {
    const outDef = ITEMS[recipe.outId];
    const canCraft = recipe.req.every(r => {
      let t = 0; player.inventory.forEach(s => { if (s && s.id === r.id) t += s.count; });
      return t >= r.count;
    });
    const card = document.createElement('div');
    card.className = 'recipe-card' + (canCraft ? ' craftable' : '');
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.style.width = '24px'; c.style.height = '24px';
    c.getContext('2d').drawImage(icons[recipe.outId], 0, 0);
    card.appendChild(c);
    card.innerHTML += `<div class="recipe-info"><strong>${outDef.name}</strong></div>`;
    card.addEventListener('click', () => {
      if (!canCraft) return;
      recipe.req.forEach(r => {
        let need = r.count;
        player.inventory.forEach((s, idx) => {
          if (s && s.id === r.id && need > 0) {
            const take = Math.min(s.count, need);
            s.count -= take; need -= take;
            if (s.count <= 0) player.inventory[idx] = null;
          }
        });
      });
      player.addItem(recipe.outId, recipe.outCount);
      sound.playPlace();
      renderInventoryModal();
    });
    recipeListEl.appendChild(card);
  });

  const storageGrid = document.getElementById('inv-storage-grid');
  const hotbarGrid = document.getElementById('inv-hotbar-grid');
  storageGrid.innerHTML = ''; hotbarGrid.innerHTML = '';
  for (let i = 9; i < 36; i++) {
    const slot = createSlotElement(player.inventory[i], i, false);
    slot.addEventListener('click', () => {
      const tmp = player.inventory[player.selectedSlot];
      player.inventory[player.selectedSlot] = player.inventory[i];
      player.inventory[i] = tmp;
      renderHotbar(); renderInventoryModal();
    });
    storageGrid.appendChild(slot);
  }
  for (let i = 0; i < 9; i++) {
    const slot = createSlotElement(player.inventory[i], i, true);
    slot.addEventListener('click', () => { player.selectedSlot = i; renderHotbar(); renderInventoryModal(); });
    hotbarGrid.appendChild(slot);
  }
}

function renderCreativeMenu() {
  const catalogEl = document.getElementById('creative-catalog-grid'); catalogEl.innerHTML = '';
  Object.values(ITEMS).forEach(item => {
    const slot = createSlotElement({ id: item.id, count: 64 }, 0, false);
    slot.addEventListener('click', () => {
      player.inventory[player.selectedSlot] = { id: item.id, count: 64 };
      renderHotbar(); renderCreativeMenu();
    });
    catalogEl.appendChild(slot);
  });
  const hotbarGrid = document.getElementById('creative-hotbar-grid'); hotbarGrid.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const slot = createSlotElement(player.inventory[i], i, true);
    slot.addEventListener('click', () => { player.selectedSlot = i; renderHotbar(); renderCreativeMenu(); });
    hotbarGrid.appendChild(slot);
  }
}

document.getElementById('btn-open-inv').addEventListener('click', () => openInventory('inventory'));
document.getElementById('btn-close-inv').addEventListener('click', enterGameplay);

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') {
    if (gameState === 'PLAYING') openInventory('inventory');
    else if (gameState === 'INVENTORY') enterGameplay();
  }
  if (gameState === 'PLAYING' && e.code.startsWith('Digit')) {
    const num = parseInt(e.code.replace('Digit', ''), 10);
    if (num >= 1 && num <= 9) { player.selectedSlot = num - 1; renderHotbar(); }
  }
});

let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (gameState === 'PLAYING') {
    player.update(dt);
    world.updateAroundPlayer(player.position.x, player.position.z, 2);
    
    // 昼夜サイクル進行 (1日 = 120秒)
    gameTime = (gameTime + dt * 200) % 24000;
    const isNight = gameTime >= 12000;
    document.getElementById('time-badge').textContent = isNight ? '夜 🌙' : '昼 ☀️';
    mobManager.update(dt, isNight);

    document.getElementById('coords').textContent = `XYZ: ${Math.floor(player.position.x)} / ${Math.floor(player.position.y)} / ${Math.floor(player.position.z)}`;
  }
  renderer.render(scene, camera);
}

animate(lastTime);
