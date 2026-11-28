let scene, camera, renderer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let isDragging = false;
let prevMouseX = 0, prevMouseY = 0;
let lon = 0, lat = 0;
let playerPos = { x: 0, y: 8, z: 10 };

function startTheGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    initGame();
}

function initGame() {
    // シーン設定
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // 青空
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);

    // カメラ設定
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(playerPos.x, playerPos.y, playerPos.z);

    // レンダラー設定
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // ライト
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(30, 50, 30);
    scene.add(dirLight);

    // ボクセル地形（ランダム起伏）
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x5d9b37 });
    const dirtMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x777777 });

    for (let x = -15; x <= 15; x++) {
        for (let z = -15; z <= 15; z++) {
            const h = Math.floor(Math.sin(x * 0.4) * Math.cos(z * 0.4) * 3) + 2;
            for (let y = 0; y <= h; y++) {
                let mat = (y === h) ? grassMat : (y > h - 2 ? dirtMat : stoneMat);
                const mesh = new THREE.Mesh(boxGeo, mat);
                mesh.position.set(x, y, z);
                scene.add(mesh);
            }
        }
    }

    // 動く動物モブ
    const mobs = [];
    for (let i = 0; i < 5; i++) {
        const mobGeo = new THREE.BoxGeometry(0.8, 1, 0.8);
        const mobMat = new THREE.MeshLambertMaterial({ color: 0xd2b48c });
        const mob = new THREE.Mesh(mobGeo, mobMat);
        mob.position.set((Math.random() - 0.5) * 20, 3, (Math.random() - 0.5) * 20);
        scene.add(mob);
        mobs.push({ mesh: mob, speed: 0.02 + Math.random() * 0.02 });
    }

    // マウス・タッチによる視点操作
    window.addEventListener('pointerdown', (e) => {
        isDragging = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        lon -= dx * 0.3;
        lat = Math.max(-85, Math.min(85, lat + dy * 0.3));

        const phi = THREE.MathUtils.degToRad(90 - lat);
        const theta = THREE.MathUtils.degToRad(lon);

        const target = new THREE.Vector3();
        target.x = camera.position.x + 100 * Math.sin(phi) * Math.cos(theta);
        target.y = camera.position.y + 100 * Math.cos(phi);
        target.z = camera.position.z + 100 * Math.sin(phi) * Math.sin(theta);
        camera.lookAt(target);
    });

    window.addEventListener('pointerup', () => { isDragging = false; });

    // 十字キーのイベント設定
    const bindMove = (id, fwd, right) => {
        const el = document.getElementById(id);
        if (!el) return;
        let active = false;
        const start = (e) => { e.preventDefault(); active = true; };
        const end = (e) => { e.preventDefault(); active = false; };
        
        el.addEventListener('pointerdown', start);
        el.addEventListener('pointerup', end);
        el.addEventListener('pointerleave', end);

        // ループ内で位置更新に使うためのフラグや値を返す代わりに直接更新
        setInterval(() => {
            if (!active) return;
            const speed = 0.1;
            camera.position.x += right * speed;
            camera.position.z += fwd * speed;
        }, 20);
    };

    bindMove('move-forward', 1, 0);
    bindMove('move-back', -1, 0);
    bindMove('move-left', 0, -1);
    bindMove('move-right', 0, 1);

    document.getElementById('btn-jump').onclick = () => {
        camera.position.y += 0.8;
    };

    // レンダリングループ
    function animate() {
        requestAnimationFrame(animate);

        // モブの簡単な動き
        mobs.forEach(m => {
            m.mesh.position.x += m.speed;
            if (Math.abs(m.mesh.position.x) > 15) m.speed *= -1;
        });

        renderer.render(scene, camera);
    }
    animate();
}

window.addEventListener('resize', () => {
    if (!renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
