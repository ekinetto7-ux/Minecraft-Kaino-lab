import * as THREE from 'three';

export const BLOCK_TYPES = [
  { id: 1, name: '草ブロック', key: 'grass' },
  { id: 2, name: '土', key: 'dirt' },
  { id: 3, name: '石', key: 'stone' },
  { id: 4, name: '丸石', key: 'cobble' },
  { id: 5, name: '木材', key: 'planks' },
  { id: 6, name: '原木', key: 'log' },
  { id: 7, name: '葉っぱ', key: 'leaves', transparent: true },
  { id: 8, name: 'ガラス', key: 'glass', transparent: true }
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

function fillNoise(ctx, baseColors, seedOffset = 0) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const hash = Math.abs(Math.sin((x + seedOffset) * 12.9898 + (y + seedOffset) * 78.233) * 43758.5453);
      const idx = Math.floor((hash % 1) * baseColors.length);
      ctx.fillStyle = baseColors[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export function createBlockMaterials() {
  const canvases = {};

  canvases.dirt = createPixelCanvas((ctx) => {
    fillNoise(ctx, ['#6b4423', '#7a4e28', '#5c3a1d', '#865932'], 1);
  });

  canvases.grassTop = createPixelCanvas((ctx) => {
    fillNoise(ctx, ['#4ca638', '#56b840', '#41942f', '#62c44b'], 2);
  });

  canvases.grassSide = createPixelCanvas((ctx) => {
    fillNoise(ctx, ['#6b4423', '#7a4e28', '#5c3a1d'], 3);
    fillNoise(ctx, ['#4ca638', '#56b840', '#41942f'], 4);
    for (let x = 0; x < 16; x++) {
      const drop = 3 + ((x * 7) % 3);
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(x, drop, 1, 16 - drop);
    }
  });

  canvases.stone = createPixelCanvas((ctx) => {
    fillNoise(ctx, ['#7d7d7d', '#8a8a8a', '#6e6e6e', '#949494'], 5);
  });

  canvases.cobble = createPixelCanvas((ctx) => {
    fillNoise(ctx, ['#686868', '#858585', '#555555', '#999999'], 6);
    ctx.fillStyle = '#474747';
    for (let i = 0; i < 16; i += 4) {
      ctx.fillRect(0, i, 16, 1);
      ctx.fillRect(i, 0, 1, 16);
    }
  });

  canvases.planks = createPixelCanvas((ctx) => {
    fillNoise(ctx, ['#b8945f', '#a88450', '#c49f68'], 7);
    ctx.fillStyle = '#7d5f35';
    ctx.fillRect(0, 3, 16, 1);
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 11, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
  });

  canvases.logSide = createPixelCanvas((ctx) => {
    fillNoise(ctx, ['#594025', '#4a341d', '#664a2b'], 8);
    ctx.fillStyle = '#3b2815';
    for (let x = 2; x < 16; x += 4) {
      ctx.fillRect(x, 0, 1, 16);
    }
  });

  canvases.logTop = createPixelCanvas((ctx) => {
    ctx.fillStyle = '#594025';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#b8945f';
    ctx.fillRect(2, 2, 12, 12);
    ctx.fillStyle = '#8c6d40';
    ctx.fillRect(5, 5, 6, 6);
  });

  canvases.leaves = createPixelCanvas((ctx) => {
    fillNoise(ctx, ['#2d7a22', '#388e2b', '#236319', '#45a136'], 9);
  });

  canvases.glass = createPixelCanvas((ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = 'rgba(200, 240, 255, 0.25)';
    ctx.fillRect(1, 1, 14, 14);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 15, 15);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 3, 2, 1);
    ctx.fillRect(4, 4, 2, 1);
  });

  const tex = {};
  for (const [k, c] of Object.entries(canvases)) {
    tex[k] = canvasToTexture(c);
  }

  const materials = {
    1: [
      new THREE.MeshLambertMaterial({ map: tex.grassSide }),
      new THREE.MeshLambertMaterial({ map: tex.grassSide }),
      new THREE.MeshLambertMaterial({ map: tex.grassTop }),
      new THREE.MeshLambertMaterial({ map: tex.dirt }),
      new THREE.MeshLambertMaterial({ map: tex.grassSide }),
      new THREE.MeshLambertMaterial({ map: tex.grassSide })
    ],
    2: new THREE.MeshLambertMaterial({ map: tex.dirt }),
    3: new THREE.MeshLambertMaterial({ map: tex.stone }),
    4: new THREE.MeshLambertMaterial({ map: tex.cobble }),
    5: new THREE.MeshLambertMaterial({ map: tex.planks }),
    6: [
      new THREE.MeshLambertMaterial({ map: tex.logSide }),
      new THREE.MeshLambertMaterial({ map: tex.logSide }),
      new THREE.MeshLambertMaterial({ map: tex.logTop }),
      new THREE.MeshLambertMaterial({ map: tex.logTop }),
      new THREE.MeshLambertMaterial({ map: tex.logSide }),
      new THREE.MeshLambertMaterial({ map: tex.logSide })
    ],
    7: new THREE.MeshLambertMaterial({ map: tex.leaves }),
    8: new THREE.MeshLambertMaterial({
      map: tex.glass,
      transparent: true,
      opacity: 0.85
    })
  };

  const icons = {
    1: canvases.grassSide,
    2: canvases.dirt,
    3: canvases.stone,
    4: canvases.cobble,
    5: canvases.planks,
    6: canvases.logSide,
    7: canvases.leaves,
    8: canvases.glass
  };

  return { materials, icons };
}
