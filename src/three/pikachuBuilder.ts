import * as THREE from 'three';
import type { ThreeTextureBundle } from './types';

export interface PikachuRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  leftEarPivot: THREE.Group;
  rightEarPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  tailPivot: THREE.Group;
  cheekMats: THREE.MeshPhysicalMaterial[];
  state: {
    hopCycle: number;
    hopWeight: number; // 0 = still, 1 = hopping entrance
    sitProgress: number; // 0 -> 1 settled pose
    waveAmount: number; // 0 -> 1 friendly paw wave
    sparkPulse: number; // 0 -> 1 joyful tap bounce & glowing cheeks
  };
  updatePose: (elapsed: number) => void;
  dispose: () => void;
}

function createEarPartGeometry(
  yStart: number,
  yEnd: number,
  length: number,
  steps = 12
): THREE.LatheGeometry {
  // Ear radius profile along normalized t in [0, 1] from base (0) to rounded tip (1)
  const earRadius = (t: number): number => {
    if (t < 0.25) {
      return THREE.MathUtils.lerp(0.058, 0.088, Math.sin((t / 0.25) * (Math.PI / 2)));
    }
    const k = (t - 0.25) / 0.75;
    return Math.max(0.001, 0.088 * Math.pow(1 - Math.pow(k, 1.55), 0.72));
  };

  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = THREE.MathUtils.lerp(yStart, yEnd, i / steps);
    pts.push(new THREE.Vector2(earRadius(t), t * length));
  }
  return new THREE.LatheGeometry(pts, 20);
}

function createPlushArmGeometry(length: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r: number;
    if (t < 0.18) {
      r = THREE.MathUtils.lerp(0.005, 0.085, Math.sin((t / 0.18) * (Math.PI / 2)));
    } else if (t < 0.8) {
      r = THREE.MathUtils.lerp(0.085, 0.072, (t - 0.18) / 0.62);
    } else {
      const k = (t - 0.8) / 0.2;
      r = THREE.MathUtils.lerp(0.072, 0.001, k * k);
    }
    pts.push(new THREE.Vector2(r, -t * length));
  }
  return new THREE.LatheGeometry(pts, 18);
}

function createLightningTailGeometries(): {
  baseGeo: THREE.ExtrudeGeometry;
  bladeGeo: THREE.ExtrudeGeometry;
} {
  // Lower brown notched base of lightning tail
  const baseShape = new THREE.Shape();
  baseShape.moveTo(0, 0);
  baseShape.lineTo(0.07, 0.03);
  baseShape.lineTo(0.11, 0.16);
  baseShape.lineTo(0.03, 0.19);
  baseShape.lineTo(-0.02, 0.06);
  baseShape.closePath();

  const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
    depth: 0.034,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.01,
    bevelThickness: 0.01,
  });
  baseGeo.translate(0, 0, -0.017);

  // Classic zigzag yellow lightning tail paddle
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0.02, 0.15);
  bladeShape.lineTo(0.12, 0.13);
  bladeShape.lineTo(0.19, 0.27);
  bladeShape.lineTo(0.10, 0.30);
  bladeShape.lineTo(0.24, 0.56);
  bladeShape.lineTo(0.45, 0.50);
  bladeShape.lineTo(0.36, 0.28);
  bladeShape.lineTo(0.24, 0.31);
  bladeShape.lineTo(0.16, 0.16);
  bladeShape.lineTo(0.22, 0.14);
  bladeShape.lineTo(0.11, 0.12);
  bladeShape.closePath();

  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  });
  bladeGeo.translate(0, 0, -0.018);

  return { baseGeo, bladeGeo };
}

export function createPikachu(textures: ThreeTextureBundle): PikachuRig {
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  // Plush Golden-Yellow Pikachu Fur
  const yellowFurMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: textures.creamPatchMap,
      bumpMap: textures.furBump,
      bumpScale: 0.018,
      color: 0xffd53b,
      roughness: 0.84,
      metalness: 0.0,
      sheen: 0.95,
      sheenRoughness: 0.62,
      sheenColor: new THREE.Color('#fff5ad'),
    })
  );

  // Soft Cream-Yellow Belly Highlight
  const bellyMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: textures.creamPatchMap,
      bumpMap: textures.furBump,
      bumpScale: 0.012,
      color: 0xffe46b,
      roughness: 0.84,
      sheen: 0.85,
      sheenColor: new THREE.Color('#fffbe0'),
    })
  );

  // Charcoal-Black Ear Tips
  const earTipMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      bumpMap: textures.furBump,
      bumpScale: 0.014,
      color: 0x1d1817,
      roughness: 0.82,
      sheen: 0.35,
      sheenColor: new THREE.Color('#4a403e'),
    })
  );

  // Chestnut-Brown Back Stripes & Tail Base
  const brownMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      bumpMap: textures.furBump,
      bumpScale: 0.014,
      color: 0x7c4524,
      roughness: 0.84,
      sheen: 0.4,
      sheenColor: new THREE.Color('#a86c46'),
    })
  );

  // Glossy Dark Button Eyes
  const eyeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x141010,
      roughness: 0.04,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    })
  );

  const catchlightMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));

  const mouthMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x45221a, roughness: 0.7 })
  );

  // Electric Rosy Cheeks (separate materials so intensity pulses warmly on tap)
  const createCheekMat = () =>
    trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xf44353,
        roughness: 0.72,
        sheen: 0.7,
        sheenColor: new THREE.Color('#ff9aa4'),
        emissive: new THREE.Color('#ff3d52'),
        emissiveIntensity: 0.08,
      })
    );
  const cheekMats = [createCheekMat(), createCheekMat()];

  const root = new THREE.Group();

  // Body Pivot (bottom rests cleanly on floor at y = 0)
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.32;
  root.add(bodyPivot);

  // 1. Plump Pear-Shaped Body (y = -0.30 bottom -> y = +0.34 neck)
  const bodyPts: THREE.Vector2[] = [
    new THREE.Vector2(0.001, -0.30),
    new THREE.Vector2(0.22, -0.29),
    new THREE.Vector2(0.34, -0.19),
    new THREE.Vector2(0.37, -0.02),
    new THREE.Vector2(0.33, 0.16),
    new THREE.Vector2(0.26, 0.30),
    new THREE.Vector2(0.18, 0.36),
    new THREE.Vector2(0.001, 0.37),
  ];
  const bodyGeo = trackGeo(new THREE.LatheGeometry(bodyPts, 30));
  bodyGeo.scale(1.02, 1.0, 0.94);
  const bodyMesh = new THREE.Mesh(bodyGeo, yellowFurMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyPivot.add(bodyMesh);

  // Soft lighter belly patch
  const bellyGeo = trackGeo(new THREE.SphereGeometry(0.25, 22, 18));
  bellyGeo.scale(0.86, 1.06, 0.45);
  const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
  bellyMesh.position.set(0, -0.03, 0.24);
  bellyMesh.receiveShadow = true;
  bodyPivot.add(bellyMesh);

  // Classic two brown dorsal stripes on back
  for (let s = 0; s < 2; s++) {
    const stripeGeo = trackGeo(new THREE.TorusGeometry(0.28, 0.026, 8, 20, Math.PI * 0.55));
    const stripe = new THREE.Mesh(stripeGeo, brownMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.rotation.z = Math.PI * 0.225;
    stripe.position.set(0, 0.14 - s * 0.13, -0.06);
    stripe.scale.set(1.0, 0.95, 0.78);
    bodyPivot.add(stripe);
  }

  // 2. Lightning Bolt Tail peeking cleanly out to Pikachu's left side
  const tailPivot = new THREE.Group();
  tailPivot.position.set(-0.04, -0.17, -0.29);
  tailPivot.rotation.set(0.18, -Math.PI + 0.45, -0.12);
  bodyPivot.add(tailPivot);

  const { baseGeo, bladeGeo } = createLightningTailGeometries();
  trackGeo(baseGeo);
  trackGeo(bladeGeo);

  const tailBase = new THREE.Mesh(baseGeo, brownMat);
  tailBase.castShadow = true;
  tailPivot.add(tailBase);

  const tailBlade = new THREE.Mesh(bladeGeo, yellowFurMat);
  tailBlade.castShadow = true;
  tailPivot.add(tailBlade);

  // 3. Chubby Sculpted Head
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.34, 0.02);
  bodyPivot.add(headPivot);

  const headCenterY = 0.28;
  const headGeo = trackGeo(new THREE.SphereGeometry(0.355, 34, 26));
  const hPos = headGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < hPos.count; i++) {
    let x = hPos.getX(i);
    let y = hPos.getY(i);
    let z = hPos.getZ(i);
    // Cute wide lower cheeks
    if (y < 0.04) {
      const cheekW = Math.exp(-Math.pow((y + 0.08) / 0.16, 2));
      x *= 1 + 0.14 * cheekW;
      z *= 1 + 0.06 * cheekW;
    }
    hPos.setXYZ(i, x, y * 0.91, z * 0.95);
  }
  headGeo.computeVertexNormals();

  const headMesh = new THREE.Mesh(headGeo, yellowFurMat);
  headMesh.position.y = headCenterY;
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headPivot.add(headMesh);

  // Long Pointed Plush Ears with Black Tips
  const earLength = 0.44;
  const earLowerGeo = trackGeo(createEarPartGeometry(0, 0.68, earLength, 10));
  const earTipGeo = trackGeo(createEarPartGeometry(0.68, 1.0, earLength, 8));

  const createEar = (side: -1 | 1): THREE.Group => {
    const earPivot = new THREE.Group();
    earPivot.position.set(side * 0.22, headCenterY + 0.24, -0.02);
    // Playful asymmetry: left ear perked higher, right ear slightly angled
    earPivot.rotation.z = side === -1 ? 0.38 : -0.48;
    earPivot.rotation.x = 0.08;

    const lowerMesh = new THREE.Mesh(earLowerGeo, yellowFurMat);
    lowerMesh.scale.set(1.0, 1.0, 0.72);
    lowerMesh.castShadow = true;
    earPivot.add(lowerMesh);

    const tipMesh = new THREE.Mesh(earTipGeo, earTipMat);
    tipMesh.scale.set(1.0, 1.0, 0.72);
    tipMesh.castShadow = true;
    earPivot.add(tipMesh);

    headPivot.add(earPivot);
    return earPivot;
  };
  const leftEarPivot = createEar(-1);
  const rightEarPivot = createEar(1);

  // Expressive Eyes, Catchlights & Glowing Rosy Cheeks
  for (let idx = 0; idx < 2; idx++) {
    const s = idx === 0 ? -1 : 1;
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(s * 0.145, headCenterY + 0.032, 0.305);
    eyeGroup.rotation.y = s * 0.26;

    const eyeBall = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.052, 20, 16)), eyeMat);
    eyeBall.scale.set(0.95, 1.08, 0.72);
    eyeGroup.add(eyeBall);

    const catch1 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.017, 10, 8)), catchlightMat);
    catch1.position.set(-0.014, 0.018, 0.036);
    eyeGroup.add(catch1);

    const catch2 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.008, 8, 8)), catchlightMat);
    catch2.position.set(0.012, -0.014, 0.036);
    eyeGroup.add(catch2);

    headPivot.add(eyeGroup);

    // Rosy Electric Cheek Pouch
    const cheek = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.072, 18, 14)), cheekMats[idx]);
    cheek.scale.set(1.0, 0.92, 0.36);
    cheek.position.set(s * 0.255, headCenterY - 0.088, 0.26);
    cheek.rotation.y = s * 0.56;
    headPivot.add(cheek);
  }

  // Tiny Cute Button Nose
  const noseGeo = trackGeo(new THREE.SphereGeometry(0.022, 12, 10));
  noseGeo.scale(1.25, 0.75, 0.7);
  const noseMesh = new THREE.Mesh(noseGeo, mouthMat);
  noseMesh.position.set(0, headCenterY - 0.025, 0.352);
  headPivot.add(noseMesh);

  // Classic Happy ':3' / 'w' Cat Smile
  const smileCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.068, headCenterY - 0.075, 0.325),
    new THREE.Vector3(-0.032, headCenterY - 0.098, 0.346),
    new THREE.Vector3(0, headCenterY - 0.072, 0.352),
    new THREE.Vector3(0.032, headCenterY - 0.098, 0.346),
    new THREE.Vector3(0.068, headCenterY - 0.075, 0.325),
  ]);
  headPivot.add(
    new THREE.Mesh(trackGeo(new THREE.TubeGeometry(smileCurve, 18, 0.006, 6, false)), mouthMat)
  );

  // 4. Short Chubby Plush Arms
  const armGeo = trackGeo(createPlushArmGeometry(0.32));
  const createArm = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.31, 0.20, 0.08);
    const armMesh = new THREE.Mesh(armGeo, yellowFurMat);
    armMesh.castShadow = true;
    armMesh.receiveShadow = true;
    pivot.add(armMesh);
    bodyPivot.add(pivot);
    return pivot;
  };
  const leftArmPivot = createArm(-1);
  const rightArmPivot = createArm(1);

  // 5. Seated Oval Plush Feet
  for (const s of [-1, 1]) {
    const footMesh = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.115, 20, 16)), yellowFurMat);
    footMesh.scale.set(0.84, 0.62, 1.55);
    footMesh.position.set(s * 0.21, -0.24, 0.21);
    footMesh.rotation.y = s * 0.25;
    footMesh.castShadow = true;
    footMesh.receiveShadow = true;
    bodyPivot.add(footMesh);
  }

  const state = {
    hopCycle: 0,
    hopWeight: 0,
    sitProgress: 0,
    waveAmount: 0,
    sparkPulse: 0,
  };

  function updatePose(elapsed: number) {
    const hop = state.hopWeight;
    const sit = THREE.MathUtils.clamp(state.sitProgress, 0, 1);
    const wave = THREE.MathUtils.clamp(state.waveAmount, 0, 1);
    const spark = state.sparkPulse;

    const bounceY = Math.abs(Math.sin(state.hopCycle)) * 0.24 * hop + spark * 0.22;
    bodyPivot.position.y = 0.315 + bounceY;
    bodyPivot.rotation.x = hop * 0.08 + sit * -0.04 + Math.sin(elapsed * 2.0) * 0.015;
    bodyPivot.rotation.z = Math.sin(state.hopCycle) * 0.06 * hop;

    // Head affectionate bob & ear wiggle
    headPivot.rotation.z = Math.sin(elapsed * 1.45 + 0.6) * 0.06 + spark * 0.14;
    headPivot.rotation.y = Math.sin(elapsed * 0.95) * 0.08;
    headPivot.rotation.x = Math.sin(elapsed * 2.2) * 0.025 - spark * 0.1;

    leftEarPivot.rotation.z = 0.38 + Math.sin(elapsed * 2.4) * 0.05 + spark * 0.18;
    rightEarPivot.rotation.z = -0.48 - Math.cos(elapsed * 2.1) * 0.06 - spark * 0.22;

    // Tail playful wag
    tailPivot.rotation.y = -Math.PI + 0.45 + Math.sin(elapsed * 3.8) * 0.16 + Math.sin(elapsed * 11) * 0.2 * spark;
    tailPivot.rotation.z = -0.12 + Math.cos(elapsed * 2.6) * 0.06;

    // Paws: resting cheerfully at sides/front or waving warmly
    const waveLeftZ = -2.05 - Math.sin(elapsed * 6.0) * 0.26;
    leftArmPivot.rotation.x = THREE.MathUtils.lerp(-0.62, -0.35, wave);
    leftArmPivot.rotation.z = THREE.MathUtils.lerp(0.28 + spark * 0.45, waveLeftZ, wave);

    rightArmPivot.rotation.x = -0.64 - spark * 0.35;
    rightArmPivot.rotation.z = -0.28 - spark * 0.45;

    // Electric rosy cheek glow pulse
    const glow = 0.08 + Math.sin(elapsed * 2.5) * 0.04 + spark * 0.72;
    cheekMats[0].emissiveIntensity = glow;
    cheekMats[1].emissiveIntensity = glow;
  }

  updatePose(0);

  return {
    root,
    bodyPivot,
    headPivot,
    leftEarPivot,
    rightEarPivot,
    leftArmPivot,
    rightArmPivot,
    tailPivot,
    cheekMats,
    state,
    updatePose,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
