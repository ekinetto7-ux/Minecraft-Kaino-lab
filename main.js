import * as THREE from 'three';
import { BLOCK_TYPES, createBlockMaterials } from './textures.js';
import { World } from './world.js';
import { Player } from './player.js';

const container = document.getElementById('game-container');
const overlay = document.getElementById('overlay');
const statusMsg = document.getElementById('status-msg');
const coordsEl = document.getElementById('coords');
const hotbarEl = document.getElementById('hotbar');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 22, 55);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
dirLight.position.set(30, 50, 20);
scene.add(dirLight);

const { materials, icons } = createBlockMaterials();
const world = new World(scene, materials);
if (!world.load()) {
  world.generateNew();
}

const player = new Player(camera, world, renderer.domElement);
player.spawn();

let selectedIndex = 0;

function renderHotbar() {
  hotbarEl.innerHTML = '';
  BLOCK_TYPES.forEach((block, index) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (index === selectedIndex ? ' active' : '');
    slot.title = block.name;

    const num = document.createElement('span');
    num.className = 'slot-num';
    num.textContent = index + 1;
    slot.appendChild(num);

    const iconCanvas = document.createElement('canvas');
    iconCanvas.width = 16;
    iconCanvas.height = 16;
    iconCanvas.getContext('2d').drawImage(icons[block.id], 0, 0);
    slot.appendChild(iconCanvas);

    slot.addEventListener('click', () => selectSlot(index));
    slot.addEventListener('touchstart', (e) => {
      e.preventDefault();
      selectSlot(index);
    });

    hotbarEl.appendChild(slot);
  });
}

function selectSlot(index) {
  if (index < 0 || index >= BLOCK_TYPES.length) return;
  selectedIndex = index;
  player.selectedBlockId = BLOCK_TYPES[index].id;
  renderHotbar();
}

renderHotbar();

window.addEventListener('keydown', (e) => {
  if (e.code.startsWith('Digit')) {
    const num = parseInt(e.code.replace('Digit', ''), 10);
    if (num >= 1 && num <= BLOCK_TYPES.length) {
      selectSlot(num - 1);
    }
  }
});

window.addEventListener('wheel', (e) => {
  if (!player.isLocked) return;
  const dir = e.deltaY > 0 ? 1 : -1;
  const next = (selectedIndex + dir + BLOCK_TYPES.length) % BLOCK_TYPES.length;
  selectSlot(next);
});

document.getElementById('play-btn').addEventListener('click', () => {
  overlay.classList.add('hidden');
  statusMsg.textContent = '';
  if (renderer.domElement.requestPointerLock) {
    try {
      renderer.domElement.requestPointerLock();
    } catch {}
  }
});

document.getElementById('menu-btn').addEventListener('click', () => {
  overlay.classList.remove('hidden');
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && !('ontouchstart' in window)) {
    overlay.classList.remove('hidden');
  }
});

document.getElementById('save-btn').addEventListener('click', () => {
  world.save();
  statusMsg.textContent = 'ワールドをブラウザに保存しました！';
});

document.getElementById('new-world-btn').addEventListener('click', () => {
  world.generateNew();
  player.spawn();
  statusMsg.textContent = '新しいワールドを生成しました！';
});

const joyBase = document.getElementById('joystick-base');
const joyStick = document.getElementById('joystick-stick');
let joyTouchId = null;

joyBase.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  joyTouchId = t.identifier;
  updateJoystick(t);
});

joyBase.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) updateJoystick(t);
  }
});

const resetJoystick = (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) {
      joyTouchId = null;
      joyStick.style.transform = 'translate(-50%, -50%)';
      player.joyInput.x = 0;
      player.joyInput.z = 0;
    }
  }
};
joyBase.addEventListener('touchend', resetJoystick);
joyBase.addEventListener('touchcancel', resetJoystick);

function updateJoystick(touch) {
  const rect = joyBase.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxR = rect.width / 2;

  let dx = touch.clientX - cx;
  let dy = touch.clientY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }

  joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  player.joyInput.x = dx / maxR;
  player.joyInput.z = dy / maxR;
}

document.getElementById('btn-break').addEventListener('touchstart', (e) => {
  e.preventDefault();
  player.breakBlock();
});

document.getElementById('btn-place').addEventListener('touchstart', (e) => {
  e.preventDefault();
  player.placeBlock();
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

let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (overlay.classList.contains('hidden')) {
    player.update(dt);
    coordsEl.textContent = `X: ${Math.floor(player.position.x)} Y: ${Math.floor(player.position.y)} Z: ${Math.floor(player.position.z)}`;
  }

  renderer.render(scene, camera);
}

animate(lastTime);
