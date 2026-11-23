import * as THREE from 'three';

export class Player {
  constructor(camera, world, domElement) {
    this.camera = camera;
    this.world = world;
    this.domElement = domElement;

    this.position = new THREE.Vector3(16, 12, 16);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;

    this.height = 1.65;
    this.eyeHeight = 1.5;
    this.radius = 0.28;
    this.onGround = false;

    this.keys = {};
    this.joyInput = { x: 0, z: 0 };
    this.selectedBlockId = 1;
    this.isLocked = false;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 6;

    const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
    const boxMat = new THREE.LineBasicMaterial({ color: 0x000000 });
    this.highlightBox = new THREE.LineSegments(boxGeo, boxMat);
    this.highlightBox.visible = false;
    this.world.scene.add(this.highlightBox);

    this.initControls();
  }

  spawn() {
    this.position.copy(this.world.getSpawnPoint());
    this.velocity.set(0, 0, 0);
  }

  initControls() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      const sensitivity = 0.0022;
      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });

    this.domElement.addEventListener('mousedown', (e) => {
      if (!this.isLocked) return;
      if (e.button === 0) this.breakBlock();
      if (e.button === 2) this.placeBlock();
    });

    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    let lookTouchId = null;
    let lastTouchX = 0;
    let lastTouchY = 0;

    this.domElement.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth * 0.35 && lookTouchId === null) {
          lookTouchId = t.identifier;
          lastTouchX = t.clientX;
          lastTouchY = t.clientY;
        }
      }
    }, { passive: true });

    this.domElement.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) {
          const dx = t.clientX - lastTouchX;
          const dy = t.clientY - lastTouchY;
          lastTouchX = t.clientX;
          lastTouchY = t.clientY;

          this.yaw -= dx * 0.005;
          this.pitch -= dy * 0.005;
          this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
        }
      }
    }, { passive: true });

    const endLookTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) lookTouchId = null;
      }
    };
    this.domElement.addEventListener('touchend', endLookTouch);
    this.domElement.addEventListener('touchcancel', endLookTouch);
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

  breakBlock() {
    const hit = this.getTargetHit();
    if (!hit) return;
    const { x, y, z } = hit.object.userData;
    this.world.setBlock(x, y, z, 0);
  }

  placeBlock() {
    const hit = this.getTargetHit();
    if (!hit || !hit.face) return;
    const { x, y, z } = hit.object.userData;
    const nx = x + Math.round(hit.face.normal.x);
    const ny = y + Math.round(hit.face.normal.y);
    const nz = z + Math.round(hit.face.normal.z);

    if (this.intersectsPlayer(nx, ny, nz)) return;

    this.world.setBlock(nx, ny, nz, this.selectedBlockId);
  }

  intersectsPlayer(bx, by, bz) {
    const pMinX = this.position.x - this.radius;
    const pMaxX = this.position.x + this.radius;
    const pMinY = this.position.y;
    const pMaxY = this.position.y + this.height;
    const pMinZ = this.position.z - this.radius;
    const pMaxZ = this.position.z + this.radius;

    return (
      pMaxX > bx && pMinX < bx + 1 &&
      pMaxY > by && pMinY < by + 1 &&
      pMaxZ > bz && pMinZ < bz + 1
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
          if (this.world.getBlock(x, y, z) !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  update(dt) {
    let forward = 0;
    let strafe = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) strafe += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) strafe -= 1;

    forward -= this.joyInput.z;
    strafe += this.joyInput.x;

    if (this.keys['Space']) {
      this.jump();
    }

    const speed = 5.2;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    let moveX = (-sin * forward + cos * strafe);
    let moveZ = (-cos * forward - sin * strafe);
    const len = Math.hypot(moveX, moveZ);
    if (len > 1) {
      moveX /= len;
      moveZ /= len;
    }

    const nextX = this.position.clone();
    nextX.x += moveX * speed * dt;
    if (!this.collidesAt(nextX)) {
      this.position.x = nextX.x;
    }

    const nextZ = this.position.clone();
    nextZ.z += moveZ * speed * dt;
    if (!this.collidesAt(nextZ)) {
      this.position.z = nextZ.z;
    }

    this.velocity.y -= 20 * dt;
    const nextY = this.position.clone();
    nextY.y += this.velocity.y * dt;

    if (this.collidesAt(nextY)) {
      if (this.velocity.y < 0) {
        this.onGround = true;
      }
      this.velocity.y = 0;
    } else {
      this.position.y = nextY.y;
      this.onGround = false;
    }

    if (this.position.y < -15) {
      this.spawn();
    }

    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z
    );
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

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
