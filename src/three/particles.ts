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

export interface ParticleSystem {
  group: THREE.Group;
  triggerHugBurst: (extraBig?: boolean) => void;
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
    const cup = (x * x) * 1.8 - Math.sin(v * Math.PI) * 0.018;
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

  function triggerHugBurst(extraBig = false) {
    const countToSpawn = extraBig ? heartCount : 24;
    for (let i = 0; i < countToSpawn; i++) {
      const h = hearts[i];
      h.active = true;
      h.life = 0;
      h.maxLife = (extraBig ? 3.2 : 2.8) + Math.random() * 1.4;
      // Spawn around both the bouquet (left) and teddy (right) and center
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
    // Also give ambient petals an uplifting swirl
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
      // Relax vertical velocity smoothly back to gentle drift
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
  }

  return {
    group,
    triggerHugBurst,
    setMood,
    update,
    dispose: () => {
      petalGeo.dispose();
      petalMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      heartGeo.dispose();
      heartMat.dispose();
    },
  };
}
