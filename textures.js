import * as THREE from 'three';

export const ITEMS = {
  1:  { id: 1,  name: '草ブロック', cat: 'ブロック', type: 'block', hardness: 0.7, tool: 'shovel', dropId: 2, sound: 'grass' },
  2:  { id: 2,  name: '土', cat: 'ブロック', type: 'block', hardness: 0.6, tool: 'shovel', dropId: 2, sound: 'grass' },
  3:  { id: 3,  name: '石', cat: 'ブロック', type: 'block', hardness: 1.8, tool: 'pickaxe', dropId: 4, sound: 'stone' },
  4:  { id: 4,  name: '丸石', cat: 'ブロック', type: 'block', hardness: 2.0, tool: 'pickaxe', dropId: 4, sound: 'stone' },
  5:  { id: 5,  name: 'オークの木材', cat: 'ブロック', type: 'block', hardness: 1.2, tool: 'axe', dropId: 5, sound: 'wood' },
  6:  { id: 6,  name: 'オークの原木', cat: 'ブロック', type: 'block', hardness: 1.5, tool: 'axe', dropId: 6, sound: 'wood' },
  7:  { id: 7,  name: 'オークの葉', cat: 'ブロック', type: 'block', hardness: 0.3, tool: 'shears', dropId: 201, dropChance: 0.25, sound: 'grass' },
  8:  { id: 8,  name: 'ガラス', cat: 'ブロック', type: 'block', hardness: 0.4, tool: 'any', dropId: 0, sound: 'stone' },
  9:  { id: 9,  name: '作業台', cat: 'ブロック', type: 'block', hardness: 1.4, tool: 'axe', dropId: 9, sound: 'wood', interactive: 'crafting_table' },
  10: { id: 10, name: '石炭鉱石', cat: '鉱石・素材', type: 'block', hardness: 2.2, tool: 'pickaxe', dropId: 301, sound: 'stone' },
  11: { id: 11, name: '鉄鉱石', cat: '鉱石・素材', type: 'block', hardness: 2.6, tool: 'pickaxe', dropId: 302, sound: 'stone' },
  12: { id: 12, name: '金鉱石', cat: '鉱石・素材', type: 'block', hardness: 2.8, tool: 'pickaxe', dropId: 303, sound: 'stone' },
  13: { id: 13, name: 'ダイヤモンド鉱石', cat: '鉱石・素材', type: 'block', hardness: 3.2, tool: 'pickaxe', dropId: 304, sound: 'stone' },
  14: { id: 14, name: '砂', cat: 'ブロック', type: 'block', hardness: 0.5, tool: 'shovel', dropId: 14, sound: 'grass' },
  15: { id: 15, name: 'レンガ', cat: '装飾・その他', type: 'block', hardness: 2.0, tool: 'pickaxe', dropId: 15, sound: 'stone' },
  16: { id: 16, name: '羊毛（白）', cat: '装飾・その他', type: 'block', hardness: 0.8, tool: 'shears', dropId: 16, sound: 'grass' },
  17: { id: 17, name: '水', cat: 'ブロック', type: 'block', hardness: 100, sound: 'grass', fluid: true },
  18: { id: 18, name: '溶岩', cat: 'ブロック', type: 'block', hardness: 100, sound: 'stone', fluid: true },
  19: { id: 19, name: 'かまど', cat: 'ブロック', type: 'block', hardness: 2.2, tool: 'pickaxe', dropId: 19, sound: 'stone', interactive: 'furnace' },
  20: { id: 20, name: 'ベッド', cat: '装飾・その他', type: 'block', hardness: 0.6, tool: 'any', dropId: 20, sound: 'wood', interactive: 'bed' },
  21: { id: 21, name: '松明', cat: '装飾・その他', type: 'block', hardness: 0.1, tool: 'any', dropId: 21, sound: 'wood', lightLevel: 14 },
  22: { id: 22, name: '木製ドア', cat: '装飾・その他', type: 'block', hardness: 1.0, tool: 'axe', dropId: 22, sound: 'wood', interactive: 'door' },

  101: { id: 101, name: '木のツルハシ', cat: '道具', type: 'tool', toolType: 'pickaxe', speed: 2.2, maxDurability: 59, damage: 2 },
  102: { id: 102, name: '石のツルハシ', cat: '道具', type: 'tool', toolType: 'pickaxe', speed: 3.5, maxDurability: 131, damage: 3 },
  103: { id: 103, name: '鉄のツルハシ', cat: '道具', type: 'tool', toolType: 'pickaxe', speed: 5.0, maxDurability: 250, damage: 4 },
  104: { id: 104, name: 'ダイヤのツルハシ', cat: '道具', type: 'tool', toolType: 'pickaxe', speed: 7.5, maxDurability: 1561, damage: 5 },
  105: { id: 105, name: '木の斧', cat: '道具', type: 'tool', toolType: 'axe', speed: 2.2, maxDurability: 59, damage: 4 },
  106: { id: 106, name: '石の斧', cat: '道具', type: 'tool', toolType: 'axe', speed: 3.5, maxDurability: 131, damage: 5 },
  107: { id: 107, name: '木のシャベル', cat: '道具', type: 'tool', toolType: 'shovel', speed: 2.2, maxDurability: 59, damage: 1 },
  109: { id: 109, name: 'バケツ', cat: '道具', type: 'misc' },
  110: { id: 110, name: '水入りバケツ', cat: '道具', type: 'misc', placesBlock: 17 },
  111: { id: 111, name: '溶岩入りバケツ', cat: '道具', type: 'misc', placesBlock: 18 },

  151: { id: 151, name: '木の剣', cat: '武器・防具', type: 'weapon', damage: 4, maxDurability: 59 },
  152: { id: 152, name: '石の剣', cat: '武器・防具', type: 'weapon', damage: 5, maxDurability: 131 },
  153: { id: 153, name: '鉄の剣', cat: '武器・防具', type: 'weapon', damage: 6, maxDurability: 250 },
  154: { id: 154, name: 'ダイヤの剣', cat: '武器・防具', type: 'weapon', damage: 8, maxDurability: 1561 },

  201: { id: 201, name: 'リンゴ', cat: '食料', type: 'food', hunger: 4, heal: 2 },
  202: { id: 202, name: 'パン', cat: '食料', type: 'food', hunger: 5, heal: 2 },
  203: { id: 203, name: 'ステーキ', cat: '食料', type: 'food', hunger: 8, heal: 4 },

  301: { id: 301, name: '石炭', cat: '鉱石・素材', type: 'material' },
  302: { id: 302, name: '鉄インゴット', cat: '鉱石・素材', type: 'material' },
  303: { id: 303, name: '金インゴット', cat: '鉱石・素材', type: 'material' },
  304: { id: 304, name: 'ダイヤモンド', cat: '鉱石・素材', type: 'material' },
  307: { id: 307, name: '棒', cat: '鉱石・素材', type: 'material' }
};

export const RECIPES = [
  { outId: 5,   outCount: 4, tableOnly: false, req: [{ id: 6, count: 1 }] },
  { outId: 307, outCount: 4, tableOnly: false, req: [{ id: 5, count: 2 }] },
  { outId: 9,   outCount: 1, tableOnly: false, req: [{ id: 5, count: 4 }] },
  { outId: 19,  outCount: 1, tableOnly: true,  req: [{ id: 4, count: 8 }] },
  { outId: 21,  outCount: 4, tableOnly: false, req: [{ id: 301, count: 1 }, { id: 307, count: 1 }] },
  { outId: 109, outCount: 1, tableOnly: true,  req: [{ id: 302, count: 3 }] },
  { outId: 101, outCount: 1, tableOnly: true,  req: [{ id: 5, count: 3 }, { id: 307, count: 2 }] },
  { outId: 105, outCount: 1, tableOnly: true,  req: [{ id: 5, count: 3 }, { id: 307, count: 2 }] },
  { outId: 151, outCount: 1, tableOnly: true,  req: [{ id: 5, count: 2 }, { id: 307, count: 1 }] },
  { outId: 103, outCount: 1, tableOnly: true,  req: [{ id: 302, count: 3 }, { id: 307, count: 2 }] },
  { outId: 153, outCount: 1, tableOnly: true,  req: [{ id: 302, count: 2 }, { id: 307, count: 1 }] }
];

function createPixelCanvas(drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  drawFn(ctx);
  return canvas;
}

function canvasToTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function fillNoise(ctx, colors, seed = 1) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const h = Math.abs(Math.sin((x + seed) * 12.9898 + (y + seed) * 78.233) * 43758.5453);
      ctx.fillStyle = colors[Math.floor((h % 1) * colors.length)];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawToolIcon(ctx, headColor, handleColor = '#8a5a2b', shape = 'pickaxe') {
  ctx.clearRect(0, 0, 16, 16);
  ctx.fillStyle = handleColor;
  for (let i = 3; i <= 12; i++) ctx.fillRect(15 - i, i, 2, 2);
  ctx.fillStyle = headColor;
  if (shape === 'pickaxe') {
    ctx.fillRect(3, 2, 8, 2);
    ctx.fillRect(2, 3, 2, 3);
    ctx.fillRect(10, 3, 3, 3);
  } else if (shape === 'sword') {
    for (let i = 2; i <= 9; i++) ctx.fillRect(14 - i, i, 3, 3);
    ctx.fillStyle = '#553311';
    ctx.fillRect(3, 9, 4, 4);
  } else if (shape === 'axe') {
    ctx.fillRect(6, 2, 6, 5);
    ctx.fillRect(8, 7, 4, 2);
  } else {
    ctx.fillRect(5, 4, 6, 6);
  }
}

export function createAssets() {
  const c = {};
  c.dirt = createPixelCanvas(ctx => fillNoise(ctx, ['#6b4423', '#7a4e28', '#5c3a1d'], 1));
  c.grassTop = createPixelCanvas(ctx => fillNoise(ctx, ['#4ca638', '#56b840', '#41942f'], 2));
  c.grassSide = createPixelCanvas(ctx => {
    fillNoise(ctx, ['#6b4423', '#7a4e28', '#5c3a1d'], 3);
    fillNoise(ctx, ['#4ca638', '#56b840'], 4);
    for (let x = 0; x < 16; x++) {
      const d = 3 + ((x * 7) % 3);
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(x, d, 1, 16 - d);
    }
  });
  c.stone = createPixelCanvas(ctx => fillNoise(ctx, ['#7d7d7d', '#8a8a8a', '#6e6e6e'], 5));
  c.cobble = createPixelCanvas(ctx => {
    fillNoise(ctx, ['#666', '#858585', '#555'], 6);
    ctx.fillStyle = '#444';
    for (let i = 0; i < 16; i += 4) {
      ctx.fillRect(0, i, 16, 1);
      ctx.fillRect(i, 0, 1, 16);
    }
  });
  c.planks = createPixelCanvas(ctx => {
    fillNoise(ctx, ['#b8945f', '#a88450', '#c49f68'], 7);
    ctx.fillStyle = '#7d5f35';
    [3, 7, 11, 15].forEach(y => ctx.fillRect(0, y, 16, 1));
  });
  c.logSide = createPixelCanvas(ctx => {
    fillNoise(ctx, ['#594025', '#4a341d', '#664a2b'], 8);
    ctx.fillStyle = '#3b2815';
    [2, 6, 10, 14].forEach(x => ctx.fillRect(x, 0, 1, 16));
  });
  c.logTop = createPixelCanvas(ctx => {
    ctx.fillStyle = '#594025'; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#b8945f'; ctx.fillRect(2, 2, 12, 12);
    ctx.fillStyle = '#8c6d40'; ctx.fillRect(5, 5, 6, 6);
  });
  c.leaves = createPixelCanvas(ctx => fillNoise(ctx, ['#2d7a22', '#388e2b', '#236319'], 9));
  c.glass = createPixelCanvas(ctx => {
    ctx.fillStyle = 'rgba(200,240,255,0.28)'; ctx.fillRect(1, 1, 14, 14);
    ctx.strokeStyle = '#fff'; ctx.strokeRect(0.5, 0.5, 15, 15);
  });
  c.craftTop = createPixelCanvas(ctx => {
    fillNoise(ctx, ['#b8945f', '#a88450'], 10);
    ctx.fillStyle = '#4a3018'; ctx.strokeStyle = '#33200e';
    ctx.strokeRect(1.5, 1.5, 13, 13);
    ctx.fillRect(5, 2, 1, 12); ctx.fillRect(10, 2, 1, 12);
  });
  c.water = createPixelCanvas(ctx => { ctx.fillStyle = 'rgba(30, 100, 220, 0.75)'; ctx.fillRect(0, 0, 16, 16); });
  c.lava = createPixelCanvas(ctx => { ctx.fillStyle = 'rgba(230, 80, 10, 0.95)'; ctx.fillRect(0, 0, 16, 16); });
  c.furnaceTop = createPixelCanvas(ctx => { ctx.fillStyle = '#666'; ctx.fillRect(0, 0, 16, 16); ctx.fillStyle = '#444'; ctx.strokeRect(2, 2, 12, 12); });
  c.torch = createPixelCanvas(ctx => { ctx.fillStyle = '#8a5a2b'; ctx.fillRect(7, 6, 2, 8); ctx.fillStyle = '#ffaa00'; ctx.fillRect(6, 4, 4, 3); });

  c.zombieHead = createPixelCanvas(ctx => fillNoise(ctx, ['#386b32', '#417a3a'], 20));
  c.zombieBody = createPixelCanvas(ctx => fillNoise(ctx, ['#1a3a5c', '#142d47'], 21));
  c.zombieArm = createPixelCanvas(ctx => fillNoise(ctx, ['#386b32', '#417a3a'], 22));
  c.zombieLeg = createPixelCanvas(ctx => fillNoise(ctx, ['#162a40', '#1c3654'], 25));

  c.skeletonHead = createPixelCanvas(ctx => fillNoise(ctx, ['#d8d8d8', '#e8e8e8'], 23));
  c.skeletonBody = createPixelCanvas(ctx => fillNoise(ctx, ['#cccccc', '#dcdcdc'], 24));
  c.skeletonLeg = createPixelCanvas(ctx => fillNoise(ctx, ['#b8b8b8', '#cccccc'], 26));

  const makeOre = (col, seed) => createPixelCanvas(ctx => {
    fillNoise(ctx, ['#7d7d7d', '#8a8a8a', '#6e6e6e'], seed);
    ctx.fillStyle = col;
    [[3,3],[4,4],[10,3],[11,4],[5,10],[6,11],[11,11],[12,10]].forEach(([x,y]) => ctx.fillRect(x, y, 2, 2));
  });

  c.coalOre = makeOre('#1e1e1e', 11);
  c.ironOre = makeOre('#d8af93', 12);
  c.goldOre = makeOre('#fcee4b', 13);
  c.diamondOre = makeOre('#4aedd9', 14);
  c.sand = createPixelCanvas(ctx => fillNoise(ctx, ['#dbd3a0', '#e3dbab'], 15));
  c.brick = createPixelCanvas(ctx => { ctx.fillStyle = '#9e473b'; ctx.fillRect(0, 0, 16, 16); });
  c.wool = createPixelCanvas(ctx => fillNoise(ctx, ['#eeeeee', '#ffffff'], 16));

  const crackTextures = [];
  for (let stage = 0; stage < 10; stage++) {
    const cc = createPixelCanvas(ctx => {
      ctx.clearRect(0, 0, 16, 16);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      for (let i = 0; i < (stage + 1) * 2; i++) {
        ctx.beginPath(); const sx = (i * 5) % 16, sy = (i * 7) % 16;
        ctx.moveTo(sx, sy); ctx.lineTo((sx + 5) % 16, (sy + 6) % 16); ctx.stroke();
      }
    });
    crackTextures.push(canvasToTexture(cc));
  }

  const tex = {};
  for (const [k, canvas] of Object.entries(c)) tex[k] = canvasToTexture(canvas);

  const blockMaterials = {
    1: [tex.grassSide, tex.grassSide, tex.grassTop, tex.dirt, tex.grassSide, tex.grassSide].map(m => new THREE.MeshLambertMaterial({ map: m })),
    2: new THREE.MeshLambertMaterial({ map: tex.dirt }),
    3: new THREE.MeshLambertMaterial({ map: tex.stone }),
    4: new THREE.MeshLambertMaterial({ map: tex.cobble }),
    5: new THREE.MeshLambertMaterial({ map: tex.planks }),
    6: [tex.logSide, tex.logSide, tex.logTop, tex.logTop, tex.logSide, tex.logSide].map(m => new THREE.MeshLambertMaterial({ map: m })),
    7: new THREE.MeshLambertMaterial({ map: tex.leaves }),
    8: new THREE.MeshLambertMaterial({ map: tex.glass, transparent: true, opacity: 0.85 }),
    9: [tex.planks, tex.planks, tex.craftTop, tex.planks, tex.planks, tex.planks].map(m => new THREE.MeshLambertMaterial({ map: m })),
    10: new THREE.MeshLambertMaterial({ map: tex.coalOre }),
    11: new THREE.MeshLambertMaterial({ map: tex.ironOre }),
    12: new THREE.MeshLambertMaterial({ map: tex.goldOre }),
    13: new THREE.MeshLambertMaterial({ map: tex.diamondOre }),
    14: new THREE.MeshLambertMaterial({ map: tex.sand }),
    15: new THREE.MeshLambertMaterial({ map: tex.brick }),
    16: new THREE.MeshLambertMaterial({ map: tex.wool }),
    17: new THREE.MeshLambertMaterial({ map: tex.water, transparent: true, opacity: 0.8 }),
    18: new THREE.MeshLambertMaterial({ map: tex.lava }),
    19: [tex.stone, tex.stone, tex.furnaceTop, tex.stone, tex.stone, tex.stone].map(m => new THREE.MeshLambertMaterial({ map: m })),
    20: new THREE.MeshLambertMaterial({ map: tex.wool }),
    21: new THREE.MeshLambertMaterial({ map: tex.torch }),
    22: new THREE.MeshLambertMaterial({ map: tex.planks })
  };

  const icons = {
    1: c.grassSide, 2: c.dirt, 3: c.stone, 4: c.cobble, 5: c.planks, 6: c.logSide, 7: c.leaves, 8: c.glass,
    9: c.craftTop, 10: c.coalOre, 11: c.ironOre, 12: c.goldOre, 13: c.diamondOre, 14: c.sand, 15: c.brick,
    16: c.wool, 17: c.water, 18: c.lava, 19: c.furnaceTop, 20: c.wool, 21: c.torch, 22: c.planks
  };

  for (const [idStr, item] of Object.entries(ITEMS)) {
    const id = Number(idStr);
    if (icons[id]) continue;
    icons[id] = createPixelCanvas(ctx => {
      if (item.type === 'tool' || item.type === 'weapon') {
        let col = '#b8945f';
        if (item.name.includes('石')) col = '#888888';
        if (item.name.includes('鉄')) col = '#e6e6e6';
        if (item.name.includes('ダイヤ')) col = '#4aedd9';
        const shape = item.name.includes('剣') ? 'sword' : item.name.includes('斧') ? 'axe' : 'pickaxe';
        drawToolIcon(ctx, col, '#7a4e28', shape);
      } else if (item.name.includes('バケツ')) {
        ctx.fillStyle = '#cccccc'; ctx.fillRect(4, 4, 8, 8);
      } else if (item.type === 'food') {
        ctx.fillStyle = '#e02828'; ctx.beginPath(); ctx.arc(8, 8, 5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#b47ede'; ctx.fillRect(4, 4, 8, 8);
      }
    });
  }

  const mobTextures = {
    zombieHead: tex.zombieHead, zombieBody: tex.zombieBody, zombieArm: tex.zombieArm, zombieLeg: tex.zombieLeg,
    skeletonHead: tex.skeletonHead, skeletonBody: tex.skeletonBody, skeletonLeg: tex.skeletonLeg
  };

  return { blockMaterials, icons, crackTextures, mobTextures };
}
