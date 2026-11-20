import * as THREE from 'three';

export interface ShinchanRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  speechAnchor: THREE.Object3D;
  state: {
    walkCycle: number;
    walkWeight: number;
    waveAmount: number;
    cheekyPulse: number;
    danceWeight: number;
    spinAngle: number;
  };
  updatePose: (elapsed: number) => void;
  dispose: () => void;
}

function createCylLimb(length: number, topR: number, botR: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = t < 0.1 ? THREE.MathUtils.lerp(0.01, topR, t / 0.1) : t > 0.9 ? THREE.MathUtils.lerp(botR, 0.002, (t - 0.9) / 0.1) : THREE.MathUtils.lerp(topR, botR, t);
    pts.push(new THREE.Vector2(r, -t * length));
  }
  return new THREE.LatheGeometry(pts, 18);
}

export function createShinchanCharacter(): ShinchanRig {
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const skinMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffd5ba,
      roughness: 0.62,
      sheen: 0.25,
      sheenColor: new THREE.Color('#fff0e5'),
    })
  );

  const hairMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1a1718,
      roughness: 0.72,
      sheen: 0.35,
      sheenColor: new THREE.Color('#4a4448'),
    })
  );

  const redShirtMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe63935,
      roughness: 0.64,
      sheen: 0.5,
      sheenColor: new THREE.Color('#ff8f8c'),
    })
  );

  const yellowShortsMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xfad232,
      roughness: 0.62,
      sheen: 0.45,
      sheenColor: new THREE.Color('#fff2a6'),
    })
  );

  const whiteMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfbf8f6, roughness: 0.5 }));
  const eyeBlackMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x151212,
      roughness: 0.08,
      clearcoat: 0.9,
    })
  );
  const blushMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf58a9e,
      roughness: 0.88,
      transparent: true,
      opacity: 0.62,
    })
  );

  const root = new THREE.Group();

  // Body pivot elevated so sneakers touch y = 0.0 cleanly
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.56;
  root.add(bodyPivot);

  // 1. Iconic Red T-Shirt Torso
  const shirtPts: THREE.Vector2[] = [
    new THREE.Vector2(0.001, -0.05),
    new THREE.Vector2(0.24, -0.04),
    new THREE.Vector2(0.23, 0.14),
    new THREE.Vector2(0.19, 0.27),
    new THREE.Vector2(0.12, 0.33),
    new THREE.Vector2(0.001, 0.34),
  ];
  const shirtGeo = trackGeo(new THREE.LatheGeometry(shirtPts, 28));
  shirtGeo.scale(1.06, 1.0, 0.92);
  const shirtMesh = new THREE.Mesh(shirtGeo, redShirtMat);
  shirtMesh.castShadow = true;
  shirtMesh.receiveShadow = true;
  bodyPivot.add(shirtMesh);

  // Yellow Shorts Waistband & Legs Trunk
  const shortsGeo = trackGeo(new THREE.CylinderGeometry(0.245, 0.235, 0.18, 26));
  shortsGeo.scale(1.05, 1.0, 0.92);
  const shortsMesh = new THREE.Mesh(shortsGeo, yellowShortsMat);
  shortsMesh.position.y = -0.11;
  shortsMesh.castShadow = true;
  bodyPivot.add(shortsMesh);

  // 2. Sculpted Shinchan Head (iconic plump potato-cheek profile!)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.33, 0.02);
  bodyPivot.add(headPivot);

  const headCenterY = 0.29;
  const headGeo = trackGeo(new THREE.SphereGeometry(0.32, 34, 26));
  const hPos = headGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < hPos.count; i++) {
    let x = hPos.getX(i);
    let y = hPos.getY(i);
    let z = hPos.getZ(i);
    // Signature chubby lower-cheek bulge (slightly asymmetrical right-cheek charm!)
    if (y < 0.05) {
      const lowerWeight = Math.exp(-Math.pow((y + 0.09) / 0.14, 2));
      x *= 1 + 0.24 * lowerWeight;
      if (x > 0) x += 0.032 * lowerWeight;
      z *= 1 + 0.12 * lowerWeight;
    }
    hPos.setXYZ(i, x, y * 0.94, z * 0.96);
  }
  headGeo.computeVertexNormals();

  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.y = headCenterY;
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headPivot.add(headMesh);

  // Short Cropped Black Hair Cap
  const hairCapGeo = trackGeo(
    new THREE.SphereGeometry(0.328, 30, 20, 0, Math.PI * 2, 0, Math.PI * 0.56)
  );
  hairCapGeo.scale(1.02, 0.95, 0.98);
  const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
  hairCap.position.set(0, headCenterY + 0.015, -0.025);
  hairCap.rotation.x = -0.35;
  hairCap.castShadow = true;
  headPivot.add(hairCap);

  // Side Ears
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.068, 14, 12)), skinMat);
    ear.scale.set(0.65, 1.0, 0.55);
    ear.position.set(s * 0.31, headCenterY - 0.03, -0.02);
    headPivot.add(ear);
  }

  // Thick Signature Caterpillar Eyebrows + Big Round Eyes + Rosy Cheeks
  for (const s of [-1, 1]) {
    // Bold iconic caterpillar eyebrow!
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.05, headCenterY + 0.13, 0.275),
      new THREE.Vector3(s * 0.115, headCenterY + 0.175, 0.282),
      new THREE.Vector3(s * 0.195, headCenterY + 0.14, 0.255),
    ]);
    const browMesh = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(browCurve, 12, 0.027, 8, false)),
      hairMat
    );
    headPivot.add(browMesh);

    // Big Expressive Eyes
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(s * 0.11, headCenterY + 0.035, 0.285);
    eyeGroup.rotation.y = s * 0.22;

    const sclera = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.058, 18, 14)), whiteMat);
    sclera.scale.set(1.0, 1.04, 0.45);
    eyeGroup.add(sclera);

    const pupil = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.038, 16, 12)), eyeBlackMat);
    pupil.scale.set(1.0, 1.0, 0.45);
    pupil.position.set(0, 0, 0.015);
    eyeGroup.add(pupil);

    const catchlight = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.014, 8, 8)), whiteMat);
    catchlight.position.set(-0.012, 0.014, 0.032);
    eyeGroup.add(catchlight);

    headPivot.add(eyeGroup);

    // Rosy Chubby Cheeks
    const blush = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.068, 14, 12)), blushMat);
    blush.scale.set(1.18, 0.78, 0.28);
    blush.position.set(s * 0.21, headCenterY - 0.095, 0.265);
    blush.rotation.y = s * 0.48;
    headPivot.add(blush);
  }

  // Cheerful Grin Mouth
  const mouthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.06, headCenterY - 0.10, 0.31),
    new THREE.Vector3(0, headCenterY - 0.135, 0.325),
    new THREE.Vector3(0.065, headCenterY - 0.095, 0.31),
  ]);
  headPivot.add(
    new THREE.Mesh(trackGeo(new THREE.TubeGeometry(mouthCurve, 14, 0.009, 6, false)), hairMat)
  );

  // Invisible speech bubble anchor right above Shinchan's head
  const speechAnchor = new THREE.Object3D();
  speechAnchor.position.set(0, headCenterY + 0.56, 0);
  headPivot.add(speechAnchor);

  // 3. Articulated Arms (Red Short Sleeves + Skin Forearms & Rounded Hands)
  const sleeveGeo = trackGeo(new THREE.CylinderGeometry(0.064, 0.074, 0.14, 16));
  const forearmGeo = trackGeo(createCylLimb(0.24, 0.044, 0.038));
  const createArm = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.24, 0.23, 0.01);

    const sleeve = new THREE.Mesh(sleeveGeo, redShirtMat);
    sleeve.position.y = -0.06;
    sleeve.castShadow = true;
    pivot.add(sleeve);

    const arm = new THREE.Mesh(forearmGeo, skinMat);
    arm.position.y = -0.09;
    arm.castShadow = true;
    pivot.add(arm);

    const hand = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.056, 14, 12)), skinMat);
    hand.position.set(0, -0.33, 0.01);
    hand.castShadow = true;
    pivot.add(hand);

    bodyPivot.add(pivot);
    return pivot;
  };
  const leftArmPivot = createArm(-1);
  const rightArmPivot = createArm(1);

  // 4. Articulated Legs + Yellow Shorts Cuffs + White Socks + Yellow Sneakers (y = 0!)
  const legUpperGeo = trackGeo(createCylLimb(0.24, 0.056, 0.046));
  const createLeg = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.125, -0.18, 0.0);

    const shortCuff = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.088, 0.094, 0.10, 16)),
      yellowShortsMat
    );
    shortCuff.position.y = -0.04;
    shortCuff.castShadow = true;
    pivot.add(shortCuff);

    const leg = new THREE.Mesh(legUpperGeo, skinMat);
    leg.position.y = -0.08;
    leg.castShadow = true;
    pivot.add(leg);

    const sock = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.05, 0.052, 0.07, 14)),
      whiteMat
    );
    sock.position.y = -0.29;
    pivot.add(sock);

    const shoe = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.075, 16, 14)), yellowShortsMat);
    shoe.scale.set(0.88, 0.65, 1.48);
    shoe.position.set(0, -0.335, 0.045);
    shoe.castShadow = true;
    shoe.receiveShadow = true;
    pivot.add(shoe);

    bodyPivot.add(pivot);
    return pivot;
  };
  const leftLegPivot = createLeg(-1);
  const rightLegPivot = createLeg(1);

  const state = {
    walkCycle: 0,
    walkWeight: 0,
    waveAmount: 0,
    cheekyPulse: 0,
    danceWeight: 0,
    spinAngle: 0,
  };

  function updatePose(elapsed: number) {
    const walk = state.walkWeight;
    const wave = THREE.MathUtils.clamp(state.waveAmount, 0, 1);
    const cheeky = state.cheekyPulse;
    const dance = THREE.MathUtils.clamp(state.danceWeight, 0, 1);

    const danceWiggle = Math.sin(elapsed * 8.2);
    const danceBounce = Math.abs(Math.sin(elapsed * 4.1)) * 0.12 * dance;

    const stride = Math.sin(state.walkCycle);
    const bounceY = Math.abs(stride) * 0.09 * walk + cheeky * 0.16 + danceBounce;

    bodyPivot.position.y = 0.56 + bounceY;
    bodyPivot.rotation.y = state.spinAngle;
    // Playful happy hip-wiggle when cheekyPulse or danceWeight is active!
    bodyPivot.rotation.z = stride * 0.05 * walk + Math.sin(elapsed * 8) * 0.08 * cheeky + danceWiggle * 0.14 * dance;
    bodyPivot.rotation.x = walk * 0.05 + Math.sin(elapsed * 2.0) * 0.015;

    headPivot.rotation.z = Math.sin(elapsed * 1.4) * 0.05 - cheeky * 0.12 - danceWiggle * 0.1 * dance;
    headPivot.rotation.y = Math.sin(elapsed * 0.9) * 0.07;

    leftLegPivot.rotation.x = stride * 0.45 * walk + danceWiggle * 0.24 * dance;
    rightLegPivot.rotation.x = -stride * 0.45 * walk - danceWiggle * 0.24 * dance;

    const walkArm = stride * 0.35 * walk;
    leftArmPivot.rotation.x = -0.22 - walkArm - Math.abs(danceWiggle) * 0.42 * dance;
    leftArmPivot.rotation.z = 0.28 + cheeky * 0.35 + (0.65 + danceWiggle * 0.45) * dance;

    const waveRightZ = 2.05 + Math.sin(elapsed * 5.6) * 0.24;
    const baseRightZ = -0.28 - cheeky * 0.35 - (0.65 - danceWiggle * 0.45) * dance;
    rightArmPivot.rotation.x = THREE.MathUtils.lerp(-0.22 + walkArm - Math.abs(danceWiggle) * 0.42 * dance, -0.35, wave);
    rightArmPivot.rotation.z = THREE.MathUtils.lerp(baseRightZ, waveRightZ, wave);
  }

  updatePose(0);

  return {
    root,
    bodyPivot,
    headPivot,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    speechAnchor,
    state,
    updatePose,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
