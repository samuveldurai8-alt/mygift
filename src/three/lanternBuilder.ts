import * as THREE from 'three';

export interface SkyLanternSystem {
  group: THREE.Group;
  setActive: (active: boolean) => void;
  releaseBurst: () => void;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

interface LanternInstance {
  root: THREE.Group;
  flameMat: THREE.MeshBasicMaterial;
  x: number;
  y: number;
  z: number;
  baseX: number;
  speedY: number;
  swayPhase: number;
  swayAmp: number;
  rotSpeed: number;
  scale: number;
  active: boolean;
}

function createLanternPaperTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Warm illuminated rice-paper gradient (brightest near flame bottom)
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#f38c5e');
  grad.addColorStop(0.45, '#ffbe6b');
  grad.addColorStop(0.85, '#ffe79e');
  grad.addColorStop(1, '#fff5cc');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal & vertical bamboo rib lines
  ctx.strokeStyle = 'rgba(156, 72, 34, 0.22)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    const x = (i / 6) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let j = 1; j < 4; j++) {
    const y = (j / 4) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Soft romantic rose heart emblem printed on front face
  const drawHeart = (cx: number, cy: number, s: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(205, 58, 92, 0.48)';
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.bezierCurveTo(22, -4, 24, -20, 10, -22);
    ctx.bezierCurveTo(3, -23, 0, -14, 0, -12);
    ctx.bezierCurveTo(0, -14, -3, -23, -10, -22);
    ctx.bezierCurveTo(-24, -20, -22, -4, 0, 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  drawHeart(w * 0.5, h * 0.48, 0.95);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createSkyLanternSystem(): SkyLanternSystem {
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const group = new THREE.Group();
  const paperTex = createLanternPaperTexture();
  disposables.push(paperTex);

  // Tapered cylindrical paper lantern body (LatheGeometry)
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.085, 0.0),
    new THREE.Vector2(0.115, 0.08),
    new THREE.Vector2(0.155, 0.24),
    new THREE.Vector2(0.145, 0.36),
    new THREE.Vector2(0.06, 0.40),
    new THREE.Vector2(0.001, 0.405),
  ];
  const shellGeo = trackGeo(new THREE.LatheGeometry(pts, 12));
  const ringGeo = trackGeo(new THREE.TorusGeometry(0.085, 0.006, 6, 16));
  ringGeo.rotateX(Math.PI / 2);
  const wireGeo = trackGeo(new THREE.CylinderGeometry(0.0025, 0.0025, 0.168, 6));
  const flameGeo = trackGeo(new THREE.SphereGeometry(0.024, 10, 8));

  const paperMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: paperTex,
      color: 0xffe4ad,
      roughness: 0.72,
      emissive: new THREE.Color('#ff8c3a'),
      emissiveMap: paperTex,
      emissiveIntensity: 1.05,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    })
  );

  const bambooMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4b2a17,
      roughness: 0.85,
      transparent: true,
      opacity: 0,
    })
  );

  const count = 12;
  const lanterns: LanternInstance[] = [];

  for (let i = 0; i < count; i++) {
    const root = new THREE.Group();

    const shell = new THREE.Mesh(shellGeo, paperMat);
    root.add(shell);

    const ring = new THREE.Mesh(ringGeo, bambooMat);
    root.add(ring);

    const wire1 = new THREE.Mesh(wireGeo, bambooMat);
    wire1.rotation.z = Math.PI / 2;
    root.add(wire1);

    const wire2 = new THREE.Mesh(wireGeo, bambooMat);
    wire2.rotation.x = Math.PI / 2;
    root.add(wire2);

    const flameMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfff5c0,
        transparent: true,
        opacity: 0,
      })
    );
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = 0.045;
    flame.scale.set(0.85, 1.35, 0.85);
    root.add(flame);

    const baseX = (i / (count - 1) - 0.5) * 8.2 + (Math.random() - 0.5) * 0.8;
    const y = 0.5 + (i % 6) * 1.25 + Math.random() * 0.6;
    const z = -2.8 - Math.random() * 4.4;
    const scale = 0.75 + Math.random() * 0.48;

    root.position.set(baseX, y, z);
    root.scale.setScalar(scale);
    root.visible = false;
    group.add(root);

    lanterns.push({
      root,
      flameMat,
      x: baseX,
      y,
      z,
      baseX,
      speedY: 0.24 + Math.random() * 0.18,
      swayPhase: Math.random() * Math.PI * 2,
      swayAmp: 0.18 + Math.random() * 0.16,
      rotSpeed: (Math.random() - 0.5) * 0.22,
      scale,
      active: true,
    });
  }

  let targetBlend = 0;
  let currentBlend = 0;
  let burstBoost = 0;

  function setActive(active: boolean) {
    targetBlend = active ? 1 : 0;
  }

  function releaseBurst() {
    targetBlend = 1;
    burstBoost = Math.max(burstBoost, 1.0);
    // Bring lower half of lanterns down smoothly so user immediately sees fresh ones rising!
    for (let i = 0; i < 6; i++) {
      const l = lanterns[i];
      l.y = 0.25 + Math.random() * 1.35;
      l.baseX = (i / 5 - 0.5) * 5.2 + (Math.random() - 0.5) * 0.6;
      l.z = -2.4 - Math.random() * 2.6;
      l.speedY = 0.36 + Math.random() * 0.16;
    }
  }

  function update(dt: number, elapsed: number) {
    const safeDt = Math.min(dt, 0.05);
    currentBlend = THREE.MathUtils.lerp(currentBlend, targetBlend, 1 - Math.exp(-2.2 * safeDt));
    burstBoost = Math.max(0, burstBoost - safeDt * 0.22);

    const vis = Math.max(currentBlend, burstBoost > 0.05 ? Math.min(1, burstBoost * 1.5) : 0);
    if (vis <= 0.01) {
      lanterns.forEach((l) => {
        l.root.visible = false;
      });
      return;
    }

    paperMat.opacity = 0.92 * vis;
    bambooMat.opacity = 0.85 * vis;

    for (let i = 0; i < lanterns.length; i++) {
      const l = lanterns[i];
      l.root.visible = true;

      l.y += l.speedY * safeDt;
      if (l.y > 8.2) {
        l.y = 0.15;
        l.baseX = (Math.random() - 0.5) * 7.8;
        l.z = -2.6 - Math.random() * 4.5;
        l.speedY = 0.24 + Math.random() * 0.18;
      }

      const heightFade = Math.min(1, (l.y - 0.15) * 1.4) * Math.min(1, (8.2 - l.y) * 0.6);
      const sway = Math.sin(elapsed * 0.65 + l.swayPhase) * l.swayAmp;

      l.x = l.baseX + sway;
      l.root.position.set(l.x, l.y, l.z);
      l.root.rotation.y += l.rotSpeed * safeDt;
      l.root.rotation.z = Math.cos(elapsed * 0.75 + l.swayPhase) * 0.045;
      l.root.scale.setScalar(l.scale * (0.7 + 0.3 * heightFade));

      l.flameMat.opacity = (0.78 + 0.22 * Math.sin(elapsed * 11 + i * 2.1)) * vis;
    }
  }

  return {
    group,
    setActive,
    releaseBurst,
    update,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
