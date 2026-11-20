import * as THREE from 'three';

export interface LadduRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  faceGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  speechAnchor: THREE.Object3D;
  cheekMats: THREE.MeshPhysicalMaterial[];
  state: {
    hopCycle: number;
    hopWeight: number;
    waveAmount: number;
    lovePulse: number;
    danceWeight: number;
    spinAngle: number;
  };
  updatePose: (elapsed: number) => void;
  dispose: () => void;
}

function createLadduTextures(): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const cColor = document.createElement('canvas');
  cColor.width = size;
  cColor.height = size;
  const ctxC = cColor.getContext('2d')!;

  const cBump = document.createElement('canvas');
  cBump.width = size;
  cBump.height = size;
  const ctxB = cBump.getContext('2d')!;

  // Rich saffron-amber Motichoor base
  ctxC.fillStyle = '#f29b1d';
  ctxC.fillRect(0, 0, size, size);

  ctxB.fillStyle = '#707070';
  ctxB.fillRect(0, 0, size, size);

  let seed = 9182;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Paint hundreds of sweet golden boondi pearls
  const palette = ['#ffb732', '#f79817', '#ffd25a', '#e87f0e', '#ffc442'];
  for (let i = 0; i < 1400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 5 + rand() * 8;
    const col = palette[Math.floor(rand() * palette.length)];

    const grad = ctxC.createRadialGradient(x - r * 0.25, y - r * 0.25, 1, x, y, r);
    grad.addColorStop(0, '#ffe48c');
    grad.addColorStop(0.45, col);
    grad.addColorStop(1, '#c96508');
    ctxC.fillStyle = grad;
    ctxC.beginPath();
    ctxC.arc(x, y, r, 0, Math.PI * 2);
    ctxC.fill();

    const bGrad = ctxB.createRadialGradient(x - r * 0.2, y - r * 0.2, 1, x, y, r);
    bGrad.addColorStop(0, '#f0f0f0');
    bGrad.addColorStop(0.7, '#a5a5a5');
    bGrad.addColorStop(1, '#454545');
    ctxB.fillStyle = bGrad;
    ctxB.beginPath();
    ctxB.arc(x, y, r, 0, Math.PI * 2);
    ctxB.fill();
  }

  // Tiny roasted cardamom / pistachio flecks
  for (let k = 0; k < 45; k++) {
    const x = rand() * size;
    const y = rand() * size;
    ctxC.fillStyle = k % 3 === 0 ? '#74a84d' : '#82461a';
    ctxC.beginPath();
    ctxC.ellipse(x, y, 3.5, 2.0, rand() * Math.PI, 0, Math.PI * 2);
    ctxC.fill();
  }

  const colorMap = new THREE.CanvasTexture(cColor);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.needsUpdate = true;

  return { colorMap, bumpMap };
}

function createCuteLimbGeometry(length: number, topR: number, endR: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r: number;
    if (t < 0.16) {
      r = THREE.MathUtils.lerp(0.006, topR, Math.sin((t / 0.16) * (Math.PI / 2)));
    } else if (t < 0.82) {
      r = THREE.MathUtils.lerp(topR, endR, (t - 0.16) / 0.66);
    } else {
      const k = (t - 0.82) / 0.18;
      r = THREE.MathUtils.lerp(endR, 0.001, k * k);
    }
    pts.push(new THREE.Vector2(r, -t * length));
  }
  return new THREE.LatheGeometry(pts, 18);
}

export function createLadduCharacter(): LadduRig {
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const { colorMap, bumpMap } = createLadduTextures();
  disposables.push(colorMap, bumpMap);

  const ladduMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: colorMap,
      bumpMap,
      bumpScale: 0.032,
      color: 0xffffff,
      roughness: 0.56,
      metalness: 0.0,
      clearcoat: 0.25, // Subtle sugary syrup sheen
      clearcoatRoughness: 0.35,
      sheen: 0.4,
      sheenColor: new THREE.Color('#ffe59c'),
    })
  );

  const limbMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffd07a,
      roughness: 0.68,
      sheen: 0.5,
      sheenColor: new THREE.Color('#fff1c2'),
    })
  );

  const shoeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe6683c,
      roughness: 0.42,
      clearcoat: 0.35,
    })
  );

  const pistachioMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7db354,
      roughness: 0.65,
    })
  );

  const eyeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1e120d,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    })
  );
  const catchlightMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const smileMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x5c2612, roughness: 0.65 }));

  const createCheekMat = () =>
    trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xff6b82,
        roughness: 0.72,
        emissive: new THREE.Color('#ff4d6d'),
        emissiveIntensity: 0.14,
      })
    );
  const cheekMats = [createCheekMat(), createCheekMat()];

  const root = new THREE.Group();

  // Body Pivot elevated cleanly so legs + shoes rest at y = 0.0
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.66;
  root.add(bodyPivot);

  // 1. Plump Golden Motichoor Laddu Body
  const bodyGeo = trackGeo(new THREE.SphereGeometry(0.36, 36, 28));
  bodyGeo.scale(1.04, 0.96, 0.98);
  const bodyMesh = new THREE.Mesh(bodyGeo, ladduMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyPivot.add(bodyMesh);

  // Sculpted 3D boondi pearl bumps around silhouette + pistachio slivers on top!
  const pearlGeo = trackGeo(new THREE.SphereGeometry(0.044, 10, 8));
  for (let i = 0; i < 22; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / 22);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const x = Math.sin(phi) * Math.cos(theta) * 0.35;
    const y = Math.cos(phi) * 0.33;
    const z = Math.sin(phi) * Math.sin(theta) * 0.33;
    // Leave front face area clean for clear eyes & smile
    if (z > 0.14 && Math.abs(x) < 0.24 && y > -0.18 && y < 0.22) continue;
    const pearl = new THREE.Mesh(pearlGeo, ladduMat);
    pearl.position.set(x, y, z);
    pearl.scale.setScalar(0.85 + (i % 3) * 0.18);
    bodyPivot.add(pearl);
  }

  // Cute pistachio crown garnishing on top of Laddu
  const pistaGeo = trackGeo(new THREE.SphereGeometry(0.055, 12, 10));
  pistaGeo.scale(1.3, 0.45, 0.72);
  const pista1 = new THREE.Mesh(pistaGeo, pistachioMat);
  pista1.position.set(-0.04, 0.34, 0.03);
  pista1.rotation.set(0.2, 0.4, 0.25);
  bodyPivot.add(pista1);

  const pista2 = new THREE.Mesh(pistaGeo, pistachioMat);
  pista2.position.set(0.05, 0.335, -0.02);
  pista2.rotation.set(-0.15, -0.5, -0.2);
  bodyPivot.add(pista2);

  // 2. Cute Expressive Face on Front of Laddu
  const faceGroup = new THREE.Group();
  bodyPivot.add(faceGroup);

  for (let idx = 0; idx < 2; idx++) {
    const s = idx === 0 ? -1 : 1;

    // Glossy eyes with dual catchlights
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(s * 0.13, 0.06, 0.325);
    eyeGroup.rotation.y = s * 0.26;

    const eyeBall = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.048, 18, 14)), eyeMat);
    eyeBall.scale.set(0.92, 1.12, 0.68);
    eyeGroup.add(eyeBall);

    const catch1 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.015, 10, 8)), catchlightMat);
    catch1.position.set(-0.012, 0.018, 0.03);
    eyeGroup.add(catch1);

    const catch2 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.007, 8, 8)), catchlightMat);
    catch2.position.set(0.01, -0.012, 0.03);
    eyeGroup.add(catch2);

    faceGroup.add(eyeGroup);

    // Friendly eyebrow arc
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.08, 0.145, 0.31),
      new THREE.Vector3(s * 0.135, 0.165, 0.312),
      new THREE.Vector3(s * 0.185, 0.145, 0.29),
    ]);
    faceGroup.add(
      new THREE.Mesh(trackGeo(new THREE.TubeGeometry(browCurve, 10, 0.007, 6, false)), smileMat)
    );

    // Blushing cheeks
    const blush = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.062, 16, 12)), cheekMats[idx]);
    blush.scale.set(1.15, 0.82, 0.32);
    blush.position.set(s * 0.215, -0.045, 0.295);
    blush.rotation.y = s * 0.52;
    faceGroup.add(blush);
  }

  // Happy open smile
  const smileCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.085, -0.038, 0.34),
    new THREE.Vector3(-0.04, -0.075, 0.354),
    new THREE.Vector3(0, -0.082, 0.358),
    new THREE.Vector3(0.04, -0.075, 0.354),
    new THREE.Vector3(0.085, -0.038, 0.34),
  ]);
  faceGroup.add(
    new THREE.Mesh(trackGeo(new THREE.TubeGeometry(smileCurve, 16, 0.0085, 6, false)), smileMat)
  );

  // Invisible speech bubble anchor right above Laddu's head
  const speechAnchor = new THREE.Object3D();
  speechAnchor.position.set(0, 0.54, 0);
  bodyPivot.add(speechAnchor);

  // 3. Articulated Arms + Cute Rounded Hands
  const armGeo = trackGeo(createCuteLimbGeometry(0.28, 0.056, 0.046));
  const createArm = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.35, 0.02, 0.04);

    const armMesh = new THREE.Mesh(armGeo, limbMat);
    armMesh.castShadow = true;
    pivot.add(armMesh);

    const handMesh = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.072, 16, 14)), limbMat);
    handMesh.scale.set(1.0, 1.05, 0.95);
    handMesh.position.set(0, -0.28, 0.01);
    handMesh.castShadow = true;
    pivot.add(handMesh);

    bodyPivot.add(pivot);
    return pivot;
  };
  const leftArmPivot = createArm(-1);
  const rightArmPivot = createArm(1);

  // 4. Articulated Legs + Cute Warm-Terracotta Shoes (bottom at y = 0!)
  const legGeo = trackGeo(createCuteLimbGeometry(0.28, 0.062, 0.054));
  const createLeg = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.145, -0.31, 0.02);

    const legMesh = new THREE.Mesh(legGeo, limbMat);
    legMesh.castShadow = true;
    pivot.add(legMesh);

    const shoeMesh = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.085, 18, 14)), shoeMat);
    shoeMesh.scale.set(0.88, 0.66, 1.48);
    shoeMesh.position.set(0, -0.295, 0.055);
    shoeMesh.castShadow = true;
    shoeMesh.receiveShadow = true;
    pivot.add(shoeMesh);

    bodyPivot.add(pivot);
    return pivot;
  };
  const leftLegPivot = createLeg(-1);
  const rightLegPivot = createLeg(1);

  const state = {
    hopCycle: 0,
    hopWeight: 0,
    waveAmount: 0,
    lovePulse: 0,
    danceWeight: 0,
    spinAngle: 0,
  };

  function updatePose(elapsed: number) {
    const hop = state.hopWeight;
    const wave = THREE.MathUtils.clamp(state.waveAmount, 0, 1);
    const love = state.lovePulse;
    const dance = THREE.MathUtils.clamp(state.danceWeight, 0, 1);

    const danceBeat = Math.sin(elapsed * 7.2 + 0.5);
    const danceBounce = Math.abs(Math.sin(elapsed * 3.6 + 0.5)) * 0.13 * dance;

    const stride = Math.sin(state.hopCycle);
    const bounceY = Math.abs(stride) * 0.14 * hop + love * 0.16 + danceBounce;

    bodyPivot.position.y = 0.66 + bounceY;
    bodyPivot.rotation.y = state.spinAngle;
    bodyPivot.rotation.z = stride * 0.06 * hop + Math.sin(elapsed * 1.8) * 0.03 + love * -0.12 + danceBeat * 0.11 * dance;
    bodyPivot.rotation.x = Math.sin(elapsed * 2.1) * 0.02 - love * 0.08;

    // Legs walk cleanly when entering, kick happily in dance mode
    leftLegPivot.rotation.x = stride * 0.45 * hop + danceBeat * 0.25 * dance;
    rightLegPivot.rotation.x = -stride * 0.45 * hop - danceBeat * 0.25 * dance;

    // Arms: left arm waves affectionately toward Pikachu, both pump in dance mode
    const walkArm = stride * 0.34 * hop;
    const waveLeftZ = -1.95 - Math.sin(elapsed * 5.8) * 0.24;
    const baseLeftZ = 0.28 + love * 0.3 + (0.45 + danceBeat * 0.35) * dance;
    leftArmPivot.rotation.x = THREE.MathUtils.lerp(-0.42 - walkArm - love * 0.35 - Math.abs(danceBeat) * 0.35 * dance, -0.45, wave);
    leftArmPivot.rotation.z = THREE.MathUtils.lerp(baseLeftZ, waveLeftZ, wave);

    rightArmPivot.rotation.x = -0.42 + walkArm - love * 0.3 - Math.abs(danceBeat) * 0.35 * dance;
    rightArmPivot.rotation.z = -0.28 - love * 0.32 - (0.45 - danceBeat * 0.35) * dance;

    // Rosy cheek glow when telling Pikachu "I love you!" or dancing
    const glow = 0.14 + Math.sin(elapsed * 2.4) * 0.04 + love * 0.72 + dance * 0.24;
    cheekMats[0].emissiveIntensity = glow;
    cheekMats[1].emissiveIntensity = glow;
  }

  updatePose(0);

  return {
    root,
    bodyPivot,
    faceGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    speechAnchor,
    cheekMats,
    state,
    updatePose,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
