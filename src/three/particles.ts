import * as THREE from 'three';
import type { LightingMood, ThreeTextureBundle } from './types';

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();

interface AmbientPetal {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  scale: number;
  phase: number;
}

interface BurstHeart {
  active: boolean;
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotY: number;
  vRotY: number;
  scale: number;
}

type FireworkPattern = 'peony' | 'heart' | 'willow';

interface FireworkParticle {
  active: boolean;
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  drag: number;
  gravity: number;
  size: number;
  twinkleSpeed: number;
  twinklePhase: number;
  r: number;
  g: number;
  b: number;
}

interface FireworkRocket {
  active: boolean;
  delay: number;
  elapsed: number;
  duration: number;
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  x: number;
  y: number;
  z: number;
  trailAccum: number;
  pattern: FireworkPattern;
  primary: THREE.Color;
  secondary: THREE.Color;
}

export interface ParticleSystem {
  group: THREE.Group;
  triggerHugBurst: (extraBig?: boolean) => void;
  triggerGiftBoxPop: (x: number, y: number, z: number) => void;
  triggerFireworks: () => void;
  triggerSparkArc: (fromX: number, fromY: number, toX: number, toY: number) => void;
  setEdgeSpread: (minX: number, maxX: number) => void;
  setMood: (mood: LightingMood) => void;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

function createSmallPetalGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.11, 0.15, 4, 5);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Taper base & tip into a teardrop petal and cup slightly
    const v = THREE.MathUtils.clamp((y + 0.075) / 0.15, 0, 1);
    const widthScale = Math.sin(Math.pow(v, 0.7) * Math.PI) * 1.1;
    const cup = x * x * 1.8 - Math.sin(v * Math.PI) * 0.018;
    pos.setXYZ(i, x * (0.25 + widthScale), y, cup);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function createMiniHeartGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.09);
  shape.bezierCurveTo(0.015, -0.085, 0.1, -0.02, 0.1, 0.045);
  shape.bezierCurveTo(0.1, 0.095, 0.045, 0.11, 0, 0.06);
  shape.bezierCurveTo(-0.045, 0.11, -0.1, 0.095, -0.1, 0.045);
  shape.bezierCurveTo(-0.1, -0.02, -0.015, -0.085, 0, -0.09);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.025,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    curveSegments: 14,
  });
  geo.center();
  return geo;
}

export function createParticleSystem(textures: ThreeTextureBundle): ParticleSystem {
  const group = new THREE.Group();

  // 1. Ambient Floating Flower Petals (48 instances)
  const petalCount = 48;
  const petalGeo = createSmallPetalGeometry();
  const petalMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.42,
    sheen: 0.6,
    sheenColor: new THREE.Color('#ffe8f0'),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const petalInst = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
  petalInst.frustumCulled = false;

  const petalPalette = [
    new THREE.Color('#f9b4c9'),
    new THREE.Color('#f48fb1'),
    new THREE.Color('#ffd6e4'),
    new THREE.Color('#fff1e6'),
    new THREE.Color('#d8b4f8'),
    new THREE.Color('#ffbeaa'),
  ];

  const petals: AmbientPetal[] = [];
  for (let i = 0; i < petalCount; i++) {
    petalInst.setColorAt(i, petalPalette[i % petalPalette.length]);
    petals.push({
      x: (Math.random() - 0.5) * 9.5,
      y: 0.2 + Math.random() * 5.2,
      z: (Math.random() - 0.5) * 6.5 - 0.5,
      vx: (Math.random() - 0.5) * 0.14,
      vy: -(0.14 + Math.random() * 0.18),
      vz: (Math.random() - 0.5) * 0.1,
      rx: Math.random() * Math.PI * 2,
      ry: Math.random() * Math.PI * 2,
      rz: Math.random() * Math.PI * 2,
      vrx: (Math.random() - 0.5) * 1.1,
      vry: (Math.random() - 0.5) * 1.2,
      vrz: (Math.random() - 0.5) * 0.9,
      scale: 0.75 + Math.random() * 0.65,
      phase: Math.random() * Math.PI * 2,
    });
  }
  if (petalInst.instanceColor) petalInst.instanceColor.needsUpdate = true;
  group.add(petalInst);

  // 2. Gentle Floating Sparkle Motes (110 points)
  const sparkCount = 110;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkPhases = new Float32Array(sparkCount);
  for (let i = 0; i < sparkCount; i++) {
    sparkPos[i * 3] = (Math.random() - 0.5) * 9.0;
    sparkPos[i * 3 + 1] = 0.15 + Math.random() * 4.8;
    sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 6.5 - 0.5;
    sparkPhases[i] = Math.random() * Math.PI * 2;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    map: textures.sparkleSprite,
    color: 0xffe6f0,
    size: 0.14,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const sparkles = new THREE.Points(sparkGeo, sparkMat);
  group.add(sparkles);

  // 3. Hug Celebration Burst Hearts (36 instances)
  const heartCount = 36;
  const heartGeo = createMiniHeartGeometry();
  const heartMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.32,
    sheen: 0.9,
    sheenColor: new THREE.Color('#fff0f5'),
    emissive: new THREE.Color('#8f1d45'),
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.95,
  });
  const heartInst = new THREE.InstancedMesh(heartGeo, heartMat, heartCount);
  heartInst.frustumCulled = false;

  const heartPalette = [
    new THREE.Color('#f05d8e'),
    new THREE.Color('#ff85ae'),
    new THREE.Color('#e03e73'),
    new THREE.Color('#ffb3cc'),
  ];
  const hearts: BurstHeart[] = [];
  for (let i = 0; i < heartCount; i++) {
    heartInst.setColorAt(i, heartPalette[i % heartPalette.length]);
    hearts.push({
      active: false,
      life: 0,
      maxLife: 3.4,
      x: 0,
      y: -10,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rotY: 0,
      vRotY: 0,
      scale: 0,
    });
    _mat4.makeScale(0, 0, 0);
    heartInst.setMatrixAt(i, _mat4);
  }
  if (heartInst.instanceColor) heartInst.instanceColor.needsUpdate = true;
  heartInst.instanceMatrix.needsUpdate = true;
  group.add(heartInst);

  // 3b. Continuous Ambient Floating Hearts on Both Left & Right Edges (18 instances)
  const edgeHeartCount = 18;
  const edgeHeartInst = new THREE.InstancedMesh(heartGeo, heartMat, edgeHeartCount);
  edgeHeartInst.frustumCulled = false;

  interface EdgeHeart {
    side: -1 | 1;
    tOffset: number;
    y: number;
    vy: number;
    z: number;
    scale: number;
    phase: number;
    rotSpeed: number;
  }
  let edgeMinX = 2.55;
  let edgeMaxX = 3.55;
  const edgeHearts: EdgeHeart[] = [];
  for (let i = 0; i < edgeHeartCount; i++) {
    edgeHeartInst.setColorAt(i, heartPalette[i % heartPalette.length]);
    const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
    edgeHearts.push({
      side,
      tOffset: Math.random(),
      y: 0.25 + (i / edgeHeartCount) * 3.8,
      vy: 0.28 + Math.random() * 0.22,
      z: (Math.random() - 0.5) * 0.8 - 0.15,
      scale: 0.72 + Math.random() * 0.48,
      phase: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.65 + Math.random() * 0.65),
    });
  }
  if (edgeHeartInst.instanceColor) edgeHeartInst.instanceColor.needsUpdate = true;
  group.add(edgeHeartInst);

  function setEdgeSpread(minX: number, maxX: number) {
    edgeMinX = Math.max(0.8, minX);
    edgeMaxX = Math.max(edgeMinX + 0.2, maxX);
  }

  // 4. Romantic 3D Particle Fireworks Display (560 pooled sparks + staggered salvo rockets)
  const MAX_FW_PARTICLES = 560;
  const fwPositions = new Float32Array(MAX_FW_PARTICLES * 3);
  const fwColors = new Float32Array(MAX_FW_PARTICLES * 3);
  const fwSizes = new Float32Array(MAX_FW_PARTICLES);
  const fwAlphas = new Float32Array(MAX_FW_PARTICLES);

  const fwParticles: FireworkParticle[] = [];
  for (let i = 0; i < MAX_FW_PARTICLES; i++) {
    fwPositions[i * 3 + 1] = -20;
    fwParticles.push({
      active: false,
      life: 0,
      maxLife: 1,
      x: 0,
      y: -20,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      drag: 0.97,
      gravity: 1.5,
      size: 0.25,
      twinkleSpeed: 10,
      twinklePhase: 0,
      r: 1,
      g: 1,
      b: 1,
    });
  }

  const fwGeo = new THREE.BufferGeometry();
  const fwPosAttr = new THREE.BufferAttribute(fwPositions, 3);
  const fwColAttr = new THREE.BufferAttribute(fwColors, 3);
  const fwSizeAttr = new THREE.BufferAttribute(fwSizes, 1);
  const fwAlphaAttr = new THREE.BufferAttribute(fwAlphas, 1);
  fwPosAttr.setUsage(THREE.DynamicDrawUsage);
  fwColAttr.setUsage(THREE.DynamicDrawUsage);
  fwSizeAttr.setUsage(THREE.DynamicDrawUsage);
  fwAlphaAttr.setUsage(THREE.DynamicDrawUsage);

  fwGeo.setAttribute('position', fwPosAttr);
  fwGeo.setAttribute('aColor', fwColAttr);
  fwGeo.setAttribute('aSize', fwSizeAttr);
  fwGeo.setAttribute('aAlpha', fwAlphaAttr);

  const fwMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPos;
        float dist = max(-mvPos.z, 0.6);
        gl_PointSize = clamp(aSize * uPixelRatio * (340.0 / dist), 1.5, 58.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        if (vAlpha <= 0.005) discard;
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;

        // Soft glowing core + subtle 4-point star sparkle rays
        float core = exp(-d * d * 24.0);
        float halo = smoothstep(0.5, 0.08, d) * 0.72;
        float rayX = exp(-abs(uv.y) * 18.0) * smoothstep(0.5, 0.0, abs(uv.x));
        float rayY = exp(-abs(uv.x) * 18.0) * smoothstep(0.5, 0.0, abs(uv.y));
        float sparkle = (rayX + rayY) * 0.42;

        float mask = clamp(core + halo + sparkle, 0.0, 1.0);
        vec3 col = mix(vColor, vec3(1.0, 0.98, 0.94), core * 0.72);
        gl_FragColor = vec4(col, mask * vAlpha);
      }
    `,
  });

  const fireworkPoints = new THREE.Points(fwGeo, fwMat);
  fireworkPoints.frustumCulled = false;
  fireworkPoints.renderOrder = 10;
  group.add(fireworkPoints);

  // Warm burst flash light (no shadow casting to stay within <= 3 shadow casters)
  const fireworkLight = new THREE.PointLight(0xffb4cc, 0, 16, 1.6);
  fireworkLight.position.set(0, 3.6, -2.0);
  fireworkLight.castShadow = false;
  group.add(fireworkLight);

  let fwCursor = 0;
  const fwRockets: FireworkRocket[] = [];

  const fwPalettes: { primary: THREE.Color; secondary: THREE.Color }[] = [
    { primary: new THREE.Color('#ff3377'), secondary: new THREE.Color('#ffd166') }, // Rose & Gold
    { primary: new THREE.Color('#ff6b9d'), secondary: new THREE.Color('#fff0f5') }, // Blush Pink & Pearl
    { primary: new THREE.Color('#f79d2d'), secondary: new THREE.Color('#ffe082') }, // Saffron Gold
    { primary: new THREE.Color('#a855f7'), secondary: new THREE.Color('#f5b8ff') }, // Lavender Spark
    { primary: new THREE.Color('#ff4d6d'), secondary: new THREE.Color('#ff9ebb') }, // Crimson Heart
  ];

  function spawnFireworkParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: THREE.Color,
    size: number,
    maxLife: number,
    drag: number,
    gravity: number
  ) {
    const p = fwParticles[fwCursor];
    fwCursor = (fwCursor + 1) % MAX_FW_PARTICLES;

    p.active = true;
    p.life = 0;
    p.maxLife = maxLife;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.drag = drag;
    p.gravity = gravity;
    p.size = size;
    p.twinkleSpeed = 9 + Math.random() * 10;
    p.twinklePhase = Math.random() * Math.PI * 2;
    p.r = color.r;
    p.g = color.g;
    p.b = color.b;
  }

  function burstRocket(rocket: FireworkRocket) {
    const { targetX: cx, targetY: cy, targetZ: cz, pattern, primary, secondary } = rocket;

    // Gentle point light flash at burst center
    fireworkLight.position.set(cx, cy, cz + 0.5);
    fireworkLight.color.copy(primary).lerp(secondary, 0.35);
    fireworkLight.intensity = 2.1;

    if (pattern === 'heart') {
      const count = 64;
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        const speedScale = 0.145 + (Math.random() - 0.5) * 0.02;
        const col = i % 3 === 0 ? secondary : primary;
        spawnFireworkParticle(
          cx,
          cy,
          cz,
          hx * speedScale,
          hy * speedScale + 0.35,
          (Math.random() - 0.5) * 0.45,
          col,
          0.34 + Math.random() * 0.16,
          1.75 + Math.random() * 0.45,
          0.955,
          0.85
        );
      }
    } else if (pattern === 'willow') {
      const count = 76;
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 1.6 + Math.random() * 1.45;
        const col = i % 2 === 0 ? primary : secondary;
        spawnFireworkParticle(
          cx,
          cy,
          cz,
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.cos(phi) * speed * 0.92 + 0.45,
          Math.sin(phi) * Math.sin(theta) * speed * 0.65,
          col,
          0.3 + Math.random() * 0.2,
          2.05 + Math.random() * 0.55,
          0.945,
          1.38
        );
      }
    } else {
      // Peony spherical bouquet burst with inner & outer rings
      const count = 74;
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const isInner = i < 24;
        const speed = isInner ? 1.05 + Math.random() * 0.5 : 1.9 + Math.random() * 0.9;
        const col = isInner ? secondary : primary;
        spawnFireworkParticle(
          cx,
          cy,
          cz,
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.cos(phi) * speed + 0.3,
          Math.sin(phi) * Math.sin(theta) * speed * 0.72,
          col,
          (isInner ? 0.28 : 0.36) + Math.random() * 0.16,
          1.6 + Math.random() * 0.55,
          0.95,
          1.25
        );
      }
    }

    // Center flash cluster
    for (let i = 0; i < 10; i++) {
      spawnFireworkParticle(
        cx + (Math.random() - 0.5) * 0.12,
        cy + (Math.random() - 0.5) * 0.12,
        cz,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.3,
        secondary,
        0.48,
        0.42 + Math.random() * 0.18,
        0.92,
        0.4
      );
    }
  }

  function triggerFireworks() {
    const salvoSpecs: {
      delay: number;
      startX: number;
      targetX: number;
      targetY: number;
      targetZ: number;
      pattern: FireworkPattern;
      paletteIdx: number;
    }[] = [
      { delay: 0.0, startX: -0.1, targetX: 0.0, targetY: 3.45, targetZ: -1.85, pattern: 'heart', paletteIdx: 0 },
      { delay: 0.34, startX: -1.6, targetX: -1.85, targetY: 3.15, targetZ: -2.1, pattern: 'peony', paletteIdx: 1 },
      { delay: 0.68, startX: 1.5, targetX: 1.75, targetY: 3.2, targetZ: -2.05, pattern: 'peony', paletteIdx: 3 },
      { delay: 1.05, startX: -0.9, targetX: -0.92, targetY: 3.72, targetZ: -2.3, pattern: 'willow', paletteIdx: 2 },
      { delay: 1.4, startX: 0.85, targetX: 0.95, targetY: 3.68, targetZ: -2.25, pattern: 'heart', paletteIdx: 4 },
    ];

    salvoSpecs.forEach((s) => {
      const pal = fwPalettes[(s.paletteIdx + Math.floor(Math.random() * fwPalettes.length)) % fwPalettes.length];
      fwRockets.push({
        active: true,
        delay: s.delay,
        elapsed: 0,
        duration: 0.44 + Math.random() * 0.12,
        startX: s.startX,
        startY: 0.25,
        startZ: s.targetZ + 0.25,
        targetX: s.targetX + (Math.random() - 0.5) * 0.24,
        targetY: s.targetY + (Math.random() - 0.5) * 0.18,
        targetZ: s.targetZ,
        x: s.startX,
        y: 0.25,
        z: s.targetZ + 0.25,
        trailAccum: 0,
        pattern: s.pattern,
        primary: pal.primary,
        secondary: pal.secondary,
      });
    });

    // Gentle celebratory swirl on floating petals too
    for (let i = 0; i < petals.length; i++) {
      petals[i].vy = 0.38 + Math.random() * 0.45;
      petals[i].vx += (Math.random() - 0.5) * 0.55;
    }
  }

  const _sparkGold = new THREE.Color('#ffd63b');
  const _sparkPink = new THREE.Color('#ff6fa5');

  function triggerSparkArc(fromX: number, fromY: number, toX: number, toY: number) {
    // Arc of 32 golden-pink electric love sparks flying from Pikachu to Laddu
    for (let i = 0; i < 32; i++) {
      const t = i / 31;
      const sx = THREE.MathUtils.lerp(fromX, toX, t * 0.35);
      const sy = THREE.MathUtils.lerp(fromY, toY, t * 0.35) + Math.sin(t * Math.PI) * 0.25;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const col = i % 3 === 0 ? _sparkPink : _sparkGold;
      spawnFireworkParticle(
        sx + (Math.random() - 0.5) * 0.08,
        sy + (Math.random() - 0.5) * 0.08,
        0.35 + (Math.random() - 0.5) * 0.16,
        dx * (1.2 + Math.random() * 0.5),
        dy + 0.9 + Math.random() * 0.65,
        (Math.random() - 0.5) * 0.4,
        col,
        0.26 + Math.random() * 0.12,
        0.75 + Math.random() * 0.35,
        0.96,
        1.1
      );
    }
  }

  let sparkleBaseOpacity = 0.55;
  let sparklePulseAmp = 0.18;

  function setMood(mood: LightingMood) {
    if (mood === 'starlight') {
      sparkMat.color.set('#ffd98a');
      sparkMat.size = 0.21;
      sparkleBaseOpacity = 0.78;
      sparklePulseAmp = 0.22;
    } else if (mood === 'golden') {
      sparkMat.color.set('#ffe4b5');
      sparkMat.size = 0.17;
      sparkleBaseOpacity = 0.66;
      sparklePulseAmp = 0.2;
    } else {
      sparkMat.color.set('#ffe6f0');
      sparkMat.size = 0.14;
      sparkleBaseOpacity = 0.55;
      sparklePulseAmp = 0.18;
    }
  }

  function triggerGiftBoxPop(x: number, y: number, z: number) {
    // Upward fountain of golden stars & rose-pink sparkles erupting from the gift box
    for (let i = 0; i < 64; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spread = 0.6 + Math.random() * 1.45;
      const col = i % 2 === 0 ? _sparkGold : _sparkPink;
      spawnFireworkParticle(
        x + (Math.random() - 0.5) * 0.35,
        y + Math.random() * 0.15,
        z + (Math.random() - 0.5) * 0.35,
        Math.cos(ang) * spread,
        1.8 + Math.random() * 2.1,
        Math.sin(ang) * spread * 0.75,
        col,
        0.3 + Math.random() * 0.18,
        1.05 + Math.random() * 0.55,
        0.95,
        1.65
      );
    }

    // Burst mini floating hearts right from inside the box
    for (let i = 0; i < heartCount; i++) {
      const h = hearts[i];
      h.active = true;
      h.life = 0;
      h.maxLife = 2.6 + Math.random() * 1.1;
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.28;
      h.x = x + Math.cos(ang) * r;
      h.y = y + Math.random() * 0.25;
      h.z = z + Math.sin(ang) * r;
      h.vx = Math.cos(ang) * (0.45 + Math.random() * 0.65);
      h.vy = 1.4 + Math.random() * 1.35;
      h.vz = Math.sin(ang) * (0.35 + Math.random() * 0.5);
      h.rotY = Math.random() * Math.PI * 2;
      h.vRotY = (Math.random() - 0.5) * 3.0;
      h.scale = 0.75 + Math.random() * 0.65;
    }
  }

  function triggerHugBurst(extraBig = false) {
    const countToSpawn = extraBig ? heartCount : 24;
    for (let i = 0; i < countToSpawn; i++) {
      const h = hearts[i];
      h.active = true;
      h.life = 0;
      h.maxLife = (extraBig ? 3.2 : 2.8) + Math.random() * 1.4;
      const originX = (Math.random() - 0.45) * 3.6;
      h.x = originX + (Math.random() - 0.5) * 0.7;
      h.y = 0.5 + Math.random() * 1.3;
      h.z = (Math.random() - 0.5) * 1.2 + 0.25;
      h.vx = (Math.random() - 0.5) * (extraBig ? 0.9 : 0.65);
      h.vy = (extraBig ? 1.15 : 0.9) + Math.random() * 1.15;
      h.vz = (Math.random() - 0.5) * 0.55;
      h.rotY = Math.random() * Math.PI * 2;
      h.vRotY = (Math.random() - 0.5) * 2.6;
      h.scale = (extraBig ? 0.9 : 0.75) + Math.random() * 0.75;
    }
    for (let i = 0; i < petals.length; i++) {
      petals[i].vy = 0.35 + Math.random() * 0.45;
      petals[i].vx += (Math.random() - 0.5) * 0.5;
    }
  }

  function update(dt: number, elapsed: number) {
    const safeDt = Math.min(dt, 0.05);

    // Update ambient petals
    for (let i = 0; i < petalCount; i++) {
      const p = petals[i];
      p.vy = THREE.MathUtils.lerp(p.vy, -(0.16 + (i % 5) * 0.03), safeDt * 0.8);
      p.vx = THREE.MathUtils.lerp(p.vx, Math.sin(elapsed * 0.6 + p.phase) * 0.18, safeDt * 1.2);

      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.z += p.vz * safeDt + Math.cos(elapsed * 0.5 + p.phase) * 0.08 * safeDt;

      p.rx += p.vrx * safeDt;
      p.ry += p.vry * safeDt;
      p.rz += p.vrz * safeDt;

      if (p.y < 0.04) {
        p.y = 4.9 + Math.random() * 0.8;
        p.x = (Math.random() - 0.5) * 9.0;
        p.z = (Math.random() - 0.5) * 6.0 - 0.4;
      }

      _pos.set(p.x, p.y, p.z);
      _euler.set(p.rx, p.ry, p.rz);
      _quat.setFromEuler(_euler);
      _scale.setScalar(p.scale);
      _mat4.compose(_pos, _quat, _scale);
      petalInst.setMatrixAt(i, _mat4);
    }
    petalInst.instanceMatrix.needsUpdate = true;

    // Update sparkles gently rising
    const sAttr = sparkGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sparkCount; i++) {
      let y = sAttr.getY(i) + 0.08 * safeDt;
      const x = sAttr.getX(i) + Math.sin(elapsed * 0.7 + sparkPhases[i]) * 0.04 * safeDt;
      if (y > 5.0) y = 0.15;
      sAttr.setXY(i, x, y);
    }
    sAttr.needsUpdate = true;
    sparkMat.opacity = sparkleBaseOpacity + Math.sin(elapsed * 1.8) * sparklePulseAmp;

    // Update hug celebration hearts
    for (let i = 0; i < heartCount; i++) {
      const h = hearts[i];
      if (!h.active) continue;

      h.life += safeDt;
      if (h.life >= h.maxLife) {
        h.active = false;
        _mat4.makeScale(0, 0, 0);
        heartInst.setMatrixAt(i, _mat4);
        continue;
      }

      const progress = h.life / h.maxLife;
      const fadeIn = Math.min(1, progress * 5);
      const fadeOut = 1 - Math.pow(Math.max(0, (progress - 0.6) / 0.4), 1.6);
      const currentScale = h.scale * fadeIn * fadeOut;

      h.x += (h.vx + Math.sin(elapsed * 2.5 + i) * 0.25) * safeDt;
      h.y += h.vy * safeDt;
      h.z += h.vz * safeDt;
      h.vy *= 1 - 0.18 * safeDt;
      h.rotY += h.vRotY * safeDt;

      _pos.set(h.x, h.y, h.z);
      _euler.set(0.1 * Math.sin(elapsed * 3 + i), h.rotY, 0.15 * Math.cos(elapsed * 2 + i));
      _quat.setFromEuler(_euler);
      _scale.setScalar(currentScale);
      _mat4.compose(_pos, _quat, _scale);
      heartInst.setMatrixAt(i, _mat4);
    }
    heartInst.instanceMatrix.needsUpdate = true;

    // Update continuous floating hearts along both left & right edges
    for (let i = 0; i < edgeHeartCount; i++) {
      const eh = edgeHearts[i];
      eh.y += eh.vy * safeDt;
      if (eh.y > 4.25) {
        eh.y = 0.22;
        eh.tOffset = Math.random();
      }
      const heightNorm = THREE.MathUtils.clamp((eh.y - 0.22) / 4.03, 0, 1);
      const fadeIn = Math.min(1, heightNorm * 5.0);
      const fadeOut = 1 - Math.pow(Math.max(0, (heightNorm - 0.72) / 0.28), 1.5);
      const baseX = eh.side * THREE.MathUtils.lerp(edgeMinX, edgeMaxX, eh.tOffset);
      const swayX = Math.sin(elapsed * 1.35 + eh.phase) * 0.14;

      _pos.set(baseX + swayX, eh.y, eh.z);
      _euler.set(
        0.12 * Math.sin(elapsed * 1.8 + eh.phase),
        elapsed * eh.rotSpeed + eh.phase,
        0.14 * Math.cos(elapsed * 1.5 + eh.phase)
      );
      _quat.setFromEuler(_euler);
      _scale.setScalar(eh.scale * fadeIn * fadeOut);
      _mat4.compose(_pos, _quat, _scale);
      edgeHeartInst.setMatrixAt(i, _mat4);
    }
    edgeHeartInst.instanceMatrix.needsUpdate = true;

    // Update ascending firework rockets & prune finished rockets
    for (let i = fwRockets.length - 1; i >= 0; i--) {
      const r = fwRockets[i];
      if (!r.active) {
        fwRockets.splice(i, 1);
        continue;
      }
      if (r.delay > 0) {
        r.delay -= safeDt;
        continue;
      }

      r.elapsed += safeDt;
      const t = Math.min(1, r.elapsed / r.duration);
      const easeOut = 1 - Math.pow(1 - t, 2.2);

      r.x = THREE.MathUtils.lerp(r.startX, r.targetX, t);
      r.y = THREE.MathUtils.lerp(r.startY, r.targetY, easeOut);
      r.z = THREE.MathUtils.lerp(r.startZ, r.targetZ, t);

      r.trailAccum += safeDt;
      if (r.trailAccum >= 0.024) {
        r.trailAccum = 0;
        spawnFireworkParticle(
          r.x + (Math.random() - 0.5) * 0.04,
          r.y,
          r.z,
          (Math.random() - 0.5) * 0.18,
          -0.25 - Math.random() * 0.25,
          (Math.random() - 0.5) * 0.15,
          r.secondary,
          0.22,
          0.32 + Math.random() * 0.15,
          0.92,
          0.45
        );
      }

      if (t >= 1) {
        r.active = false;
        burstRocket(r);
        fwRockets.splice(i, 1);
      }
    }

    // Decay firework burst point light smoothly
    if (fireworkLight.intensity > 0.005) {
      fireworkLight.intensity *= Math.exp(-4.2 * safeDt);
    } else {
      fireworkLight.intensity = 0;
    }

    // Update pooled firework particles
    let anyFireworkAlive = false;
    const dragStep = safeDt * 60;
    for (let i = 0; i < MAX_FW_PARTICLES; i++) {
      const p = fwParticles[i];
      if (!p.active) {
        if (fwAlphas[i] !== 0) {
          fwAlphas[i] = 0;
          anyFireworkAlive = true;
        }
        continue;
      }

      p.life += safeDt;
      if (p.life >= p.maxLife) {
        p.active = false;
        fwAlphas[i] = 0;
        anyFireworkAlive = true;
        continue;
      }

      anyFireworkAlive = true;
      const dragFactor = Math.pow(p.drag, dragStep);
      p.vx *= dragFactor;
      p.vy = p.vy * dragFactor - p.gravity * safeDt;
      p.vz *= dragFactor;

      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.z += p.vz * safeDt;

      // Floor bounce / soft fade if sparks drop near marble
      if (p.y < 0.08) {
        p.y = 0.08;
        p.vy = Math.abs(p.vy) * 0.22;
        p.vx *= 0.7;
        p.vz *= 0.7;
      }

      const progress = p.life / p.maxLife;
      const fadeIn = Math.min(1, progress * 10);
      const fadeOut = 1 - Math.pow(progress, 1.85);
      const twinkle = 0.72 + 0.28 * Math.sin(elapsed * p.twinkleSpeed + p.twinklePhase);

      fwPositions[i * 3] = p.x;
      fwPositions[i * 3 + 1] = p.y;
      fwPositions[i * 3 + 2] = p.z;

      fwColors[i * 3] = p.r;
      fwColors[i * 3 + 1] = p.g;
      fwColors[i * 3 + 2] = p.b;

      fwSizes[i] = p.size * (0.65 + 0.35 * fadeOut);
      fwAlphas[i] = fadeIn * fadeOut * twinkle;
    }

    if (anyFireworkAlive || fwRockets.length > 0) {
      fwPosAttr.needsUpdate = true;
      fwColAttr.needsUpdate = true;
      fwSizeAttr.needsUpdate = true;
      fwAlphaAttr.needsUpdate = true;
    }
  }

  return {
    group,
    triggerHugBurst,
    triggerGiftBoxPop,
    triggerFireworks,
    triggerSparkArc,
    setEdgeSpread,
    setMood,
    update,
    dispose: () => {
      petalGeo.dispose();
      petalMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      heartGeo.dispose();
      heartMat.dispose();
      edgeHeartInst.dispose();
      fwGeo.dispose();
      fwMat.dispose();
    },
  };
}
