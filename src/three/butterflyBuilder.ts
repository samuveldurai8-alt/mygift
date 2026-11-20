import * as THREE from 'three';

export interface ButterflyRig {
  group: THREE.Group;
  butterflies: THREE.Group[];
  state: {
    opacity: number;
    scatterBoost: number;
  };
  scatter: () => void;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

interface ButterflyInstance {
  root: THREE.Group;
  bodyTilt: THREE.Group;
  leftWingPivot: THREE.Group;
  rightWingPivot: THREE.Group;
  centerX: number;
  centerY: number;
  centerZ: number;
  radiusX: number;
  radiusY: number;
  radiusZ: number;
  speed: number;
  phase: number;
  flapFreq: number;
  scale: number;
  scatterVx: number;
  scatterVy: number;
  scatterVz: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

interface WingPalette {
  name: string;
  inner: string;
  mid: string;
  outer: string;
  rim: string;
  vein: string;
  pearl: string;
  shimmer: string;
  bodyColor: number;
}

const WING_PALETTES: WingPalette[] = [
  {
    name: 'Sakura Rose',
    inner: '#fff6fa',
    mid: '#ffa8cc',
    outer: '#e84d8a',
    rim: '#4f1230',
    vein: 'rgba(92, 22, 54, 0.45)',
    pearl: '#fff8e8',
    shimmer: '#ffd6eb',
    bodyColor: 0x5c2b42,
  },
  {
    name: 'Morpho Sky',
    inner: '#f2fcff',
    mid: '#87e0ff',
    outer: '#4389e8',
    rim: '#17234d',
    vein: 'rgba(26, 44, 96, 0.45)',
    pearl: '#ffffff',
    shimmer: '#c8f4ff',
    bodyColor: 0x2c365c,
  },
  {
    name: 'Peach Monarch',
    inner: '#fff9ec',
    mid: '#ffb48a',
    outer: '#eb5e55',
    rim: '#4a1820',
    vein: 'rgba(84, 24, 30, 0.48)',
    pearl: '#fff9e6',
    shimmer: '#ffe2b8',
    bodyColor: 0x572a2e,
  },
  {
    name: 'Amethyst Fairy',
    inner: '#fcf5ff',
    mid: '#d7a8ff',
    outer: '#9b59e8',
    rim: '#2d144d',
    vein: 'rgba(54, 24, 92, 0.46)',
    pearl: '#fff2fa',
    shimmer: '#f0d6ff',
    bodyColor: 0x45285e,
  },
];

// Bounds for UV normalization so our 512x512 painted wings align pixel-for-pixel with 3D shapes
const FORE_BOUNDS = { minX: 0, maxX: 0.22, minY: -0.02, maxY: 0.165 };
const HIND_BOUNDS = { minX: 0, maxX: 0.155, minY: -0.175, maxY: 0.02 };

function createForewingShape(): THREE.Shape {
  const s = new THREE.Shape();
  // Hinge at body (0, 0.025) sweeping forward & outward to graceful rounded apex
  s.moveTo(0, 0.028);
  s.bezierCurveTo(0.055, 0.105, 0.145, 0.165, 0.206, 0.148);
  s.bezierCurveTo(0.222, 0.142, 0.218, 0.095, 0.194, 0.048);
  s.bezierCurveTo(0.174, 0.012, 0.132, -0.014, 0.072, -0.018);
  s.bezierCurveTo(0.032, -0.02, 0.01, -0.008, 0, 0.0);
  s.closePath();
  return s;
}

function createHindwingShape(): THREE.Shape {
  const s = new THREE.Shape();
  // Overlapping beneath forewing, scalloped swallowtail lower lobe
  s.moveTo(0, 0.012);
  s.bezierCurveTo(0.052, 0.02, 0.125, 0.005, 0.148, -0.032);
  s.bezierCurveTo(0.162, -0.058, 0.146, -0.095, 0.118, -0.116);
  // Delicate swallowtail tip
  s.bezierCurveTo(0.105, -0.142, 0.098, -0.17, 0.082, -0.172);
  s.bezierCurveTo(0.068, -0.173, 0.062, -0.146, 0.054, -0.128);
  // Inner scalloped margin curving smoothly back to abdomen
  s.bezierCurveTo(0.034, -0.122, 0.012, -0.088, 0.002, -0.036);
  s.closePath();
  return s;
}

function buildWingGeometry(
  shape: THREE.Shape,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  mirrorLeft: boolean,
  camberSign: number
): THREE.BufferGeometry {
  const geo = new THREE.ShapeGeometry(shape, 20);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Map shape (x, y) cleanly to [0..1] UV matching canvas orientation
    const u = THREE.MathUtils.clamp((x - bounds.minX) / spanX, 0, 1);
    const v = THREE.MathUtils.clamp((y - bounds.minY) / spanY, 0, 1);
    uv.setXY(i, u, v);

    // Subtle organic silk camber so light catches the wing surface gracefully
    const normX = u;
    const arch = Math.sin(normX * Math.PI) * 0.012 * camberSign;
    pos.setZ(i, -arch);
  }

  // Rotate +90° around X: +Y (leading edge) -> +Z (forward), -Y (trailing edge) -> -Z (backward), +Z camber -> -Y/arch
  geo.rotateX(Math.PI / 2);

  if (mirrorLeft) {
    geo.scale(-1, 1, 1);
  }

  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function createForewingTexture(palette: WingPalette): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Rich radial jewel gradient from wing base toward outer margin
  const grad = ctx.createRadialGradient(36, size * 0.65, 24, size * 0.55, size * 0.42, size * 0.92);
  grad.addColorStop(0, palette.inner);
  grad.addColorStop(0.32, palette.mid);
  grad.addColorStop(0.76, palette.outer);
  grad.addColorStop(0.95, palette.rim);
  grad.addColorStop(1, palette.rim);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Soft pearlescent iridescence glow in center cell
  const glow = ctx.createRadialGradient(size * 0.45, size * 0.48, 10, size * 0.45, size * 0.48, 175);
  glow.addColorStop(0, `${palette.shimmer}cc`);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // Dark velvety outer wing border along outer & leading edge
  const edgeGrad = ctx.createLinearGradient(0, size * 0.5, size, size * 0.2);
  edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
  edgeGrad.addColorStop(0.72, 'rgba(0,0,0,0)');
  edgeGrad.addColorStop(0.92, `${palette.rim}cc`);
  edgeGrad.addColorStop(1, palette.rim);
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, size, size);

  // Branching butterfly wing veins
  ctx.strokeStyle = palette.vein;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  const veins: [number, number, number, number, number, number][] = [
    [16, size * 0.72, 160, size * 0.35, 430, size * 0.12],
    [18, size * 0.75, 190, size * 0.46, 465, size * 0.25],
    [18, size * 0.78, 210, size * 0.58, 455, size * 0.48],
    [20, size * 0.82, 195, size * 0.72, 410, size * 0.72],
    [20, size * 0.86, 150, size * 0.84, 310, size * 0.88],
    [185, size * 0.42, 310, size * 0.32, 468, size * 0.36],
    [205, size * 0.58, 320, size * 0.54, 435, size * 0.61],
  ];
  veins.forEach(([x0, y0, cx, cy, x1, y1]) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  });

  // Luminous marginal pearl spots along outer edge
  const spots: [number, number, number][] = [
    [422, 95, 13],
    [445, 145, 11],
    [438, 200, 10],
    [412, 255, 9],
    [378, 310, 8.5],
    [336, 360, 8],
    [458, 118, 6],
    [468, 172, 5.5],
    [455, 228, 5.5],
  ];
  ctx.fillStyle = palette.pearl;
  spots.forEach(([sx, sy, sr]) => {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  });

  // Delicate golden/cream shimmer dust flecks
  ctx.fillStyle = 'rgba(255, 250, 235, 0.55)';
  for (let i = 0; i < 18; i++) {
    const fx = 90 + ((i * 73) % 260);
    const fy = 120 + ((i * 97) % 240);
    ctx.beginPath();
    ctx.arc(fx, fy, 2.2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createHindwingTexture(palette: WingPalette): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(28, 70, 20, size * 0.42, size * 0.42, size * 0.85);
  grad.addColorStop(0, palette.inner);
  grad.addColorStop(0.38, palette.mid);
  grad.addColorStop(0.78, palette.outer);
  grad.addColorStop(0.94, palette.rim);
  grad.addColorStop(1, palette.rim);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Radiating hindwing veins
  ctx.strokeStyle = palette.vein;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const veins: [number, number, number, number, number, number][] = [
    [22, 62, 185, 110, 440, 175],
    [20, 74, 175, 185, 390, 315],
    [18, 86, 150, 250, 290, 455],
    [16, 98, 96, 260, 155, 395],
  ];
  veins.forEach(([x0, y0, cx, cy, x1, y1]) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  });

  // Pearlescent eyespot & margin pearls
  const eyespotGrad = ctx.createRadialGradient(265, 290, 6, 265, 290, 34);
  eyespotGrad.addColorStop(0, palette.rim);
  eyespotGrad.addColorStop(0.45, palette.shimmer);
  eyespotGrad.addColorStop(0.75, palette.outer);
  eyespotGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = eyespotGrad;
  ctx.beginPath();
  ctx.arc(265, 290, 34, 0, Math.PI * 2);
  ctx.fill();

  const dots: [number, number, number][] = [
    [432, 165, 11],
    [418, 225, 10],
    [382, 285, 10],
    [332, 342, 9],
    [275, 425, 8],
  ];
  ctx.fillStyle = palette.pearl;
  dots.forEach(([dx, dy, dr]) => {
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createButterflySwarm(): ButterflyRig {
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

  const foreShape = createForewingShape();
  const hindShape = createHindwingShape();

  const foreRightGeo = trackGeo(buildWingGeometry(foreShape, FORE_BOUNDS, false, 1));
  const foreLeftGeo = trackGeo(buildWingGeometry(foreShape, FORE_BOUNDS, true, 1));
  const hindRightGeo = trackGeo(buildWingGeometry(hindShape, HIND_BOUNDS, false, 0.7));
  const hindLeftGeo = trackGeo(buildWingGeometry(hindShape, HIND_BOUNDS, true, 0.7));

  // Slender, graceful butterfly body parts
  const thoraxGeo = trackGeo(new THREE.SphereGeometry(0.0085, 12, 10));
  thoraxGeo.scale(0.85, 0.9, 1.75);

  const abdomenGeo = trackGeo(new THREE.SphereGeometry(0.0062, 12, 10));
  abdomenGeo.scale(0.78, 0.82, 4.4);

  const headGeo = trackGeo(new THREE.SphereGeometry(0.0072, 12, 10));
  const eyeGeo = trackGeo(new THREE.SphereGeometry(0.0026, 8, 8));
  const antTipGeo = trackGeo(new THREE.SphereGeometry(0.0022, 8, 8));

  const antCurveL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.0025, 0.003, 0.025),
    new THREE.Vector3(-0.012, 0.018, 0.046),
    new THREE.Vector3(-0.022, 0.028, 0.058),
  ]);
  const antCurveR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0025, 0.003, 0.025),
    new THREE.Vector3(0.012, 0.018, 0.046),
    new THREE.Vector3(0.022, 0.028, 0.058),
  ]);
  const antGeoL = trackGeo(new THREE.TubeGeometry(antCurveL, 8, 0.001, 5, false));
  const antGeoR = trackGeo(new THREE.TubeGeometry(antCurveR, 8, 0.001, 5, false));

  const paletteMaterials = WING_PALETTES.map((pal) => {
    const foreTex = createForewingTexture(pal);
    const hindTex = createHindwingTexture(pal);
    disposables.push(foreTex, hindTex);

    const foreMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        map: foreTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        roughness: 0.28,
        metalness: 0.08,
        iridescence: 0.82,
        iridescenceIOR: 1.45,
        sheen: 0.9,
        sheenColor: new THREE.Color(pal.shimmer),
        emissive: new THREE.Color(pal.mid),
        emissiveIntensity: 0.22,
      })
    );

    const hindMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        map: hindTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.94,
        roughness: 0.3,
        metalness: 0.08,
        iridescence: 0.78,
        iridescenceIOR: 1.45,
        sheen: 0.85,
        sheenColor: new THREE.Color(pal.shimmer),
        emissive: new THREE.Color(pal.mid),
        emissiveIntensity: 0.2,
      })
    );

    const bodyMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: pal.bodyColor,
        roughness: 0.45,
        sheen: 0.7,
        sheenColor: new THREE.Color(pal.shimmer),
      })
    );

    const goldTipMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf7d89c,
        metalness: 0.75,
        roughness: 0.25,
        emissive: new THREE.Color(0xffe0a8),
        emissiveIntensity: 0.25,
      })
    );

    return { foreMat, hindMat, bodyMat, goldTipMat };
  });

  // Gentle, graceful flight paths hovering clearly over & around the blooms and bouquet
  const butterflyConfigs = [
    { cx: -0.22, cy: 2.38, cz: 0.25, rx: 1.05, ry: 0.32, rz: 0.62, speed: 0.64, phase: 0.2, flap: 8.2, scale: 1.24 },
    { cx: -1.35, cy: 1.88, cz: 0.35, rx: 0.82, ry: 0.28, rz: 0.52, speed: 0.74, phase: 1.7, flap: 9.0, scale: 1.08 },
    { cx: 1.08, cy: 2.05, cz: 0.24, rx: 0.92, ry: 0.3, rz: 0.56, speed: 0.68, phase: 3.1, flap: 8.6, scale: 1.15 },
    { cx: 0.18, cy: 2.66, cz: -0.22, rx: 1.24, ry: 0.34, rz: 0.65, speed: 0.58, phase: 4.4, flap: 7.8, scale: 1.2 },
    { cx: -0.68, cy: 2.12, cz: 0.52, rx: 0.72, ry: 0.25, rz: 0.46, speed: 0.78, phase: 5.3, flap: 9.3, scale: 1.04 },
    { cx: 1.62, cy: 1.82, cz: 0.28, rx: 0.78, ry: 0.26, rz: 0.48, speed: 0.72, phase: 2.4, flap: 8.8, scale: 1.1 },
  ];

  const instances: ButterflyInstance[] = [];
  const butterflies: THREE.Group[] = [];

  butterflyConfigs.forEach((cfg, idx) => {
    const root = new THREE.Group();
    const bodyTilt = new THREE.Group();
    root.add(bodyTilt);

    const mats = paletteMaterials[idx % paletteMaterials.length];

    const thorax = new THREE.Mesh(thoraxGeo, mats.bodyMat);
    bodyTilt.add(thorax);

    const abdomen = new THREE.Mesh(abdomenGeo, mats.bodyMat);
    abdomen.position.set(0, -0.002, -0.036);
    abdomen.rotation.x = 0.08;
    bodyTilt.add(abdomen);

    const head = new THREE.Mesh(headGeo, mats.bodyMat);
    head.position.set(0, 0.003, 0.02);
    bodyTilt.add(head);

    const eyeL = new THREE.Mesh(eyeGeo, mats.goldTipMat);
    eyeL.position.set(-0.0055, 0.0045, 0.023);
    bodyTilt.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, mats.goldTipMat);
    eyeR.position.set(0.0055, 0.0045, 0.023);
    bodyTilt.add(eyeR);

    bodyTilt.add(new THREE.Mesh(antGeoL, mats.bodyMat));
    bodyTilt.add(new THREE.Mesh(antGeoR, mats.bodyMat));

    const tipL = new THREE.Mesh(antTipGeo, mats.goldTipMat);
    tipL.position.set(-0.022, 0.028, 0.058);
    bodyTilt.add(tipL);

    const tipR = new THREE.Mesh(antTipGeo, mats.goldTipMat);
    tipR.position.set(0.022, 0.028, 0.058);
    bodyTilt.add(tipR);

    // Left wings (forewing slightly above hindwing for natural overlap)
    const leftWingPivot = new THREE.Group();
    leftWingPivot.position.set(-0.004, 0.004, 0.003);
    const leftFore = new THREE.Mesh(foreLeftGeo, mats.foreMat);
    leftFore.position.y = 0.0015;
    leftFore.rotation.x = -0.04;
    const leftHind = new THREE.Mesh(hindLeftGeo, mats.hindMat);
    leftHind.position.y = -0.001;
    leftHind.rotation.x = 0.04;
    leftWingPivot.add(leftHind, leftFore);
    bodyTilt.add(leftWingPivot);

    // Right wings
    const rightWingPivot = new THREE.Group();
    rightWingPivot.position.set(0.004, 0.004, 0.003);
    const rightFore = new THREE.Mesh(foreRightGeo, mats.foreMat);
    rightFore.position.y = 0.0015;
    rightFore.rotation.x = -0.04;
    const rightHind = new THREE.Mesh(hindRightGeo, mats.hindMat);
    rightHind.position.y = -0.001;
    rightHind.rotation.x = 0.04;
    rightWingPivot.add(rightHind, rightFore);
    bodyTilt.add(rightWingPivot);

    // Graceful slight upward butterfly posture in flight
    bodyTilt.rotation.x = -0.22;

    root.scale.setScalar(0.001);
    root.visible = false;
    group.add(root);
    butterflies.push(root);

    instances.push({
      root,
      bodyTilt,
      leftWingPivot,
      rightWingPivot,
      centerX: cfg.cx,
      centerY: cfg.cy,
      centerZ: cfg.cz,
      radiusX: cfg.rx,
      radiusY: cfg.ry,
      radiusZ: cfg.rz,
      speed: cfg.speed,
      phase: cfg.phase,
      flapFreq: cfg.flap,
      scale: cfg.scale,
      scatterVx: 0,
      scatterVy: 0,
      scatterVz: 0,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
    });
  });

  const state = {
    opacity: 0,
    scatterBoost: 0,
  };

  function scatter() {
    state.scatterBoost = 1;
    instances.forEach((b, i) => {
      const ang = (i / instances.length) * Math.PI * 2 + Math.random() * 0.6;
      b.scatterVx = Math.cos(ang) * (1.1 + Math.random() * 0.55);
      b.scatterVy = 0.65 + Math.random() * 0.55;
      b.scatterVz = Math.sin(ang) * 0.7;
    });
  }

  function update(dt: number, elapsed: number) {
    const safeDt = Math.min(dt, 0.05);
    const vis = THREE.MathUtils.clamp(state.opacity, 0, 1);

    if (vis <= 0.01) {
      instances.forEach((b) => {
        b.root.visible = false;
      });
      return;
    }

    state.scatterBoost = Math.max(0, state.scatterBoost - safeDt * 0.85);
    const extraFlap = 1 + state.scatterBoost * 0.55;

    for (let i = 0; i < instances.length; i++) {
      const b = instances[i];
      b.root.visible = true;

      b.offsetX = (b.offsetX + b.scatterVx * safeDt) * Math.exp(-1.5 * safeDt);
      b.offsetY = (b.offsetY + b.scatterVy * safeDt) * Math.exp(-1.5 * safeDt);
      b.offsetZ = (b.offsetZ + b.scatterVz * safeDt) * Math.exp(-1.5 * safeDt);
      b.scatterVx *= Math.exp(-2.6 * safeDt);
      b.scatterVy *= Math.exp(-2.6 * safeDt);
      b.scatterVz *= Math.exp(-2.6 * safeDt);

      const t = elapsed * b.speed + b.phase;
      const prevT = t - 0.04;

      const flapPhase = elapsed * b.flapFreq * extraFlap + b.phase * 3.0;
      // Graceful asymmetric butterfly wingstroke (crisp downbeat, buoyant upstroke)
      const flap = Math.sin(flapPhase) * 0.82 + Math.sin(flapPhase * 2) * 0.12 + 0.22;
      const liftBob = -Math.sin(flapPhase) * 0.014;

      const x = b.centerX + Math.sin(t) * b.radiusX + b.offsetX;
      const y = b.centerY + Math.sin(t * 1.6 + 0.5) * b.radiusY + b.offsetY + liftBob;
      const z = b.centerZ + Math.sin(t * 2.0) * b.radiusZ + b.offsetZ;

      const px = b.centerX + Math.sin(prevT) * b.radiusX + b.offsetX;
      const py = b.centerY + Math.sin(prevT * 1.6 + 0.5) * b.radiusY + b.offsetY;
      const pz = b.centerZ + Math.sin(prevT * 2.0) * b.radiusZ + b.offsetZ;

      const vx = x - px;
      const vy = y - py;
      const vz = z - pz;

      b.root.position.set(x, y, z);
      b.root.rotation.y = Math.atan2(vx, vz);
      b.root.rotation.x = -THREE.MathUtils.clamp(vy * 3.8, -0.32, 0.32);
      b.root.rotation.z = THREE.MathUtils.clamp(-vx * 1.4, -0.22, 0.22);
      b.root.scale.setScalar(b.scale * vis);

      b.rightWingPivot.rotation.z = flap;
      b.leftWingPivot.rotation.z = -flap;
    }
  }

  return {
    group,
    butterflies,
    state,
    scatter,
    update,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
