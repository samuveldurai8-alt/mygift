import * as THREE from 'three';
import type { ThreeTextureBundle } from './types';

export interface TeddyRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftEarPivot: THREE.Group;
  rightEarPivot: THREE.Group;
  heartGroup: THREE.Group;
  state: {
    walkCycle: number; // phase for walking bounce
    walkWeight: number; // 0 = still, 1 = walking
    sitProgress: number; // 0 = standing, 1 = seated
    waveAmount: number; // 0 = holding heart, 1 = welcoming wave with right paw
    heartLift: number; // 0 = tucked, 1 = warmly presented
    hugPulse: number; // celebratory hug lean/bounce
    kissPulse: number; // extra double-tap joyful bounce & tilt
  };
  updatePose: (elapsed: number) => void;
  dispose: () => void;
}

function createHeartGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  // Classic balanced romantic heart curve
  shape.moveTo(0, -0.22);
  shape.bezierCurveTo(0.03, -0.21, 0.24, -0.06, 0.24, 0.1);
  shape.bezierCurveTo(0.24, 0.22, 0.11, 0.26, 0.0, 0.14);
  shape.bezierCurveTo(-0.11, 0.26, -0.24, 0.22, -0.24, 0.1);
  shape.bezierCurveTo(-0.24, -0.06, -0.03, -0.21, 0, -0.22);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSegments: 10,
    steps: 2,
    bevelSize: 0.055,
    bevelThickness: 0.055,
    curveSegments: 24,
  });
  geo.center();
  return geo;
}

function createPlushLimbGeometry(
  length: number,
  topR: number,
  midR: number,
  pawR: number
): THREE.LatheGeometry {
  // Profile from shoulder/hip (y=0) down to rounded paw tip (y=-length)
  const pts: THREE.Vector2[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 top -> 1 bottom tip
    let r: number;
    if (t < 0.15) {
      r = THREE.MathUtils.lerp(0.01, topR, Math.sin((t / 0.15) * (Math.PI / 2)));
    } else if (t < 0.72) {
      const k = (t - 0.15) / 0.57;
      r = THREE.MathUtils.lerp(topR, midR, k) + Math.sin(k * Math.PI) * 0.018;
    } else if (t < 0.9) {
      const k = (t - 0.72) / 0.18;
      r = THREE.MathUtils.lerp(midR, pawR, Math.sin(k * (Math.PI / 2)));
    } else {
      const k = (t - 0.9) / 0.1;
      r = THREE.MathUtils.lerp(pawR, 0.001, k * k);
    }
    pts.push(new THREE.Vector2(r, -t * length));
  }
  return new THREE.LatheGeometry(pts, 24);
}

export function createTeddyBear(textures: ThreeTextureBundle): TeddyRig {
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  // Plush Fur Materials (rich tactile sheen + curly pile bump)
  const furMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: textures.furMap,
      bumpMap: textures.furBump,
      bumpScale: 0.022,
      color: 0xf4dec9,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 1.0,
      sheenRoughness: 0.68,
      sheenColor: new THREE.Color('#fff5eb'),
    })
  );

  const creamMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: textures.creamPatchMap,
      bumpMap: textures.furBump,
      bumpScale: 0.015,
      color: 0xfff5ec,
      roughness: 0.85,
      metalness: 0.0,
      sheen: 0.9,
      sheenRoughness: 0.65,
      sheenColor: new THREE.Color('#ffffff'),
    })
  );

  const padMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf7cbd9,
      roughness: 0.78,
      sheen: 0.7,
      sheenColor: new THREE.Color('#ffe8f0'),
    })
  );

  const noseMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x5c3630,
      roughness: 0.22,
      clearcoat: 0.85,
      clearcoatRoughness: 0.18,
    })
  );

  const eyeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1c1210,
      roughness: 0.05,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    })
  );

  const catchlightMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );

  const stitchMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x5a3832, roughness: 0.75 })
  );

  const blushMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59bb4,
      roughness: 0.9,
      transparent: true,
      opacity: 0.55,
    })
  );

  const heartMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      bumpMap: textures.furBump,
      bumpScale: 0.012,
      color: 0xf06d97,
      roughness: 0.62,
      sheen: 1.0,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color('#ffd6e4'),
      emissive: new THREE.Color('#691a34'),
      emissiveIntensity: 0.14,
    })
  );

  const collarSatinMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: textures.satinMap,
      roughness: 0.28,
      metalness: 0.08,
      sheen: 0.9,
      sheenColor: new THREE.Color('#ffdce8'),
      clearcoat: 0.3,
    })
  );

  const root = new THREE.Group();

  // Body Pivot (bottom sits at y = 0.0 when seated!)
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.56;
  root.add(bodyPivot);

  // 1. Plump Pear-Shaped Torso (LatheGeometry from y=-0.36 bottom to y=+0.44 neck)
  const torsoPts: THREE.Vector2[] = [
    new THREE.Vector2(0.001, -0.36),
    new THREE.Vector2(0.24, -0.35),
    new THREE.Vector2(0.39, -0.24),
    new THREE.Vector2(0.45, -0.04),
    new THREE.Vector2(0.41, 0.18),
    new THREE.Vector2(0.32, 0.35),
    new THREE.Vector2(0.21, 0.44),
    new THREE.Vector2(0.001, 0.46),
  ];
  const torsoGeo = trackGeo(new THREE.LatheGeometry(torsoPts, 32));
  torsoGeo.scale(1.04, 1.0, 0.96);
  const torsoMesh = new THREE.Mesh(torsoGeo, furMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyPivot.add(torsoMesh);

  // Cute round plush tail on back
  const tailMesh = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.115, 16, 14)), creamMat);
  tailMesh.position.set(0, -0.22, -0.39);
  tailMesh.castShadow = true;
  bodyPivot.add(tailMesh);

  // Soft cream tummy patch
  const tummyGeo = trackGeo(new THREE.SphereGeometry(0.33, 24, 20));
  tummyGeo.scale(0.86, 1.05, 0.48);
  const tummyMesh = new THREE.Mesh(tummyGeo, creamMat);
  tummyMesh.position.set(0, -0.02, 0.28);
  tummyMesh.receiveShadow = true;
  bodyPivot.add(tummyMesh);

  // Dainty satin neck collar & mini bow
  const collarGeo = trackGeo(new THREE.TorusGeometry(0.23, 0.028, 12, 32));
  collarGeo.rotateX(Math.PI / 2);
  const collarMesh = new THREE.Mesh(collarGeo, collarSatinMat);
  collarMesh.position.set(0, 0.41, 0.01);
  collarMesh.castShadow = true;
  bodyPivot.add(collarMesh);

  const miniBowKnot = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.036, 14, 12)), collarSatinMat);
  miniBowKnot.position.set(0, 0.40, 0.245);
  bodyPivot.add(miniBowKnot);

  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.055, 14, 12)), collarSatinMat);
    loop.scale.set(1.35, 0.72, 0.45);
    loop.position.set(s * 0.068, 0.40, 0.24);
    loop.rotation.z = s * 0.22;
    bodyPivot.add(loop);
  }

  // 2. Sculpted Head Group
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.44, 0.02);
  bodyPivot.add(headPivot);

  const headCenterY = 0.38;
  const headGeo = trackGeo(new THREE.SphereGeometry(0.435, 36, 28));
  // Subtle organic cheek sculpting (plumper lower cheeks)
  const hPos = headGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < hPos.count; i++) {
    let x = hPos.getX(i);
    let y = hPos.getY(i);
    let z = hPos.getZ(i);
    if (y < 0.05) {
      const cheekWeight = Math.exp(-Math.pow((y + 0.1) / 0.2, 2));
      x *= 1 + 0.1 * cheekWeight;
      z *= 1 + 0.05 * cheekWeight;
    }
    hPos.setXYZ(i, x, y * 0.94, z * 0.97);
  }
  headGeo.computeVertexNormals();

  const headMesh = new THREE.Mesh(headGeo, furMat);
  headMesh.position.y = headCenterY;
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headPivot.add(headMesh);

  // Cream Muzzle
  const muzzleGeo = trackGeo(new THREE.SphereGeometry(0.195, 24, 20));
  muzzleGeo.scale(1.2, 0.88, 0.86);
  const muzzleMesh = new THREE.Mesh(muzzleGeo, creamMat);
  muzzleMesh.position.set(0, headCenterY - 0.095, 0.33);
  muzzleMesh.castShadow = true;
  muzzleMesh.receiveShadow = true;
  headPivot.add(muzzleMesh);

  // Glossy Cocoa-Rose Button Nose
  const noseGeo = trackGeo(new THREE.SphereGeometry(0.068, 20, 16));
  noseGeo.scale(1.24, 0.86, 0.78);
  const noseMesh = new THREE.Mesh(noseGeo, noseMat);
  noseMesh.position.set(0, headCenterY - 0.025, 0.485);
  noseMesh.castShadow = true;
  headPivot.add(noseMesh);

  // Stitched Philtrum & Warm Smile
  const philtrumCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, headCenterY - 0.05, 0.49),
    new THREE.Vector3(0, headCenterY - 0.12, 0.492),
  ]);
  headPivot.add(new THREE.Mesh(trackGeo(new THREE.TubeGeometry(philtrumCurve, 6, 0.007, 6, false)), stitchMat));

  const smileCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.092, headCenterY - 0.098, 0.45),
    new THREE.Vector3(-0.042, headCenterY - 0.136, 0.482),
    new THREE.Vector3(0, headCenterY - 0.12, 0.49),
    new THREE.Vector3(0.042, headCenterY - 0.136, 0.482),
    new THREE.Vector3(0.092, headCenterY - 0.098, 0.45),
  ]);
  headPivot.add(new THREE.Mesh(trackGeo(new THREE.TubeGeometry(smileCurve, 18, 0.007, 6, false)), stitchMat));

  // Expressive Eyes with Dual Specular Catchlights, Soft Eyebrows & Rosy Cheeks
  for (const s of [-1, 1]) {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(s * 0.165, headCenterY + 0.058, 0.378);
    eyeGroup.rotation.y = s * 0.24;

    const eyeBall = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.056, 20, 16)), eyeMat);
    eyeBall.scale.set(0.96, 1.08, 0.85);
    eyeGroup.add(eyeBall);

    const catch1 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.017, 10, 8)), catchlightMat);
    catch1.position.set(-0.015, 0.02, 0.045);
    eyeGroup.add(catch1);

    const catch2 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.008, 8, 8)), catchlightMat);
    catch2.position.set(0.015, -0.015, 0.045);
    eyeGroup.add(catch2);

    headPivot.add(eyeGroup);

    // Gentle stitched eyebrow arc
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.11, headCenterY + 0.14, 0.375),
      new THREE.Vector3(s * 0.165, headCenterY + 0.158, 0.37),
      new THREE.Vector3(s * 0.215, headCenterY + 0.14, 0.345),
    ]);
    headPivot.add(new THREE.Mesh(trackGeo(new THREE.TubeGeometry(browCurve, 10, 0.006, 6, false)), stitchMat));

    // Soft rosy cheek blush
    const blush = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.078, 16, 12)), blushMat);
    blush.scale.set(1.15, 0.78, 0.25);
    blush.position.set(s * 0.255, headCenterY - 0.075, 0.348);
    blush.rotation.y = s * 0.48;
    headPivot.add(blush);
  }

  // Detailed Round Ears (left & right pivots)
  const createEar = (side: -1 | 1): THREE.Group => {
    const earPivot = new THREE.Group();
    earPivot.position.set(side * 0.33, headCenterY + 0.325, 0.02);
    earPivot.rotation.z = -side * 0.38;

    const outerEar = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.155, 22, 18)), furMat);
    outerEar.scale.set(1.0, 1.0, 0.56);
    outerEar.castShadow = true;
    earPivot.add(outerEar);

    const innerEar = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.098, 18, 14)), padMat);
    innerEar.scale.set(0.95, 0.95, 0.42);
    innerEar.position.set(0, -0.01, 0.046);
    earPivot.add(innerEar);

    headPivot.add(earPivot);
    return earPivot;
  };
  const leftEarPivot = createEar(-1);
  const rightEarPivot = createEar(1);

  // 3. Articulated Arms + Paw Pads
  const armGeo = trackGeo(createPlushLimbGeometry(0.48, 0.115, 0.105, 0.125));
  const createArm = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.34, 0.28, 0.05);

    const mesh = new THREE.Mesh(armGeo, furMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);

    // Cute soft pink paw pad on inner palm
    const pawPad = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.072, 14, 12)), padMat);
    pawPad.scale.set(0.9, 1.05, 0.45);
    pawPad.position.set(-side * 0.04, -0.42, 0.065);
    pivot.add(pawPad);

    bodyPivot.add(pivot);
    return pivot;
  };
  const leftArmPivot = createArm(-1);
  const rightArmPivot = createArm(1);

  // 4. Sculpted Plush Pink Heart held in front of Teddy's chest
  const heartGroup = new THREE.Group();
  heartGroup.position.set(0, 0.04, 0.52);
  bodyPivot.add(heartGroup);

  const heartMesh = new THREE.Mesh(trackGeo(createHeartGeometry()), heartMat);
  heartMesh.castShadow = true;
  heartMesh.receiveShadow = true;
  heartGroup.add(heartMesh);

  // 5. Complete Articulated Legs & Feet with Stitched Paw Pads + Toe Beans
  const legGeo = trackGeo(createPlushLimbGeometry(0.42, 0.145, 0.135, 0.15));
  const createLeg = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.23, -0.25, 0.05);

    const legMesh = new THREE.Mesh(legGeo, furMat);
    legMesh.castShadow = true;
    legMesh.receiveShadow = true;
    pivot.add(legMesh);

    // Plump rounded foot extending forward
    const footGroup = new THREE.Group();
    footGroup.position.set(0, -0.37, 0.09);
    pivot.add(footGroup);

    const footMesh = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.165, 22, 18)), furMat);
    footMesh.scale.set(0.92, 0.78, 1.28);
    footMesh.castShadow = true;
    footMesh.receiveShadow = true;
    footGroup.add(footMesh);

    // Cream-pink main sole paw pad (facing forward when seated!)
    const solePad = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.095, 16, 14)), padMat);
    solePad.scale.set(0.88, 1.15, 0.35);
    solePad.position.set(0, -0.02, 0.185);
    footGroup.add(solePad);

    // 3 cute toe beans above main paw pad
    for (let t = -1; t <= 1; t++) {
      const toe = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.03, 12, 10)), padMat);
      toe.scale.set(0.9, 1.1, 0.45);
      toe.position.set(t * 0.055, 0.078 - Math.abs(t) * 0.015, 0.175);
      footGroup.add(toe);
    }

    bodyPivot.add(pivot);
    return pivot;
  };
  const leftLegPivot = createLeg(-1);
  const rightLegPivot = createLeg(1);

  const state = {
    walkCycle: 0,
    walkWeight: 0,
    sitProgress: 0,
    waveAmount: 0,
    heartLift: 1,
    hugPulse: 0,
    kissPulse: 0,
  };

  function updatePose(elapsed: number) {
    const walk = state.walkWeight;
    const sit = THREE.MathUtils.clamp(state.sitProgress, 0, 1);
    const wave = THREE.MathUtils.clamp(state.waveAmount, 0, 1);
    const hug = state.hugPulse;
    const kiss = state.kissPulse;

    // Gentle breathing
    const breath = Math.sin(elapsed * 2.1) * 0.012;

    // Body height:
    // Standing: feet bottom at y = -0.25 - 0.37 - 0.13 = -0.75 below bodyPivot -> bodyPivot.y = 0.75
    // Seated: torso bottom at y = -0.36 below bodyPivot -> bodyPivot.y = 0.365
    const standY = 0.75 + Math.abs(Math.sin(state.walkCycle)) * 0.08 * walk;
    const sitY = 0.365;
    bodyPivot.position.y = THREE.MathUtils.lerp(standY, sitY, sit) + hug * 0.12 + kiss * 0.18;
    bodyPivot.rotation.x =
      walk * 0.08 +
      sit * -0.05 +
      hug * 0.16 +
      kiss * 0.22 +
      Math.sin(elapsed * 1.4) * 0.02 * sit;
    bodyPivot.rotation.z = Math.sin(state.walkCycle) * 0.05 * walk;

    // Head tilt & affectionate nod
    headPivot.rotation.z =
      Math.sin(elapsed * 1.1) * 0.055 +
      Math.cos(state.walkCycle) * 0.04 * walk +
      kiss * 0.16;
    headPivot.rotation.y = Math.sin(elapsed * 0.85) * 0.07;
    headPivot.rotation.x = breath * 1.5 - hug * 0.12 - kiss * 0.18;

    // Subtle ear bounce
    leftEarPivot.rotation.z = 0.38 + Math.sin(state.walkCycle * 2) * 0.06 * walk + hug * 0.08 + kiss * 0.14;
    rightEarPivot.rotation.z = -0.38 - Math.sin(state.walkCycle * 2) * 0.06 * walk - hug * 0.08 - kiss * 0.14;

    // Legs:
    // Standing/walking swings around X; Seated swings forward (-1.28 rad) and splays softly (±0.32 rad)
    const walkLegSwing = Math.sin(state.walkCycle) * 0.42 * walk;
    leftLegPivot.rotation.x = THREE.MathUtils.lerp(walkLegSwing, -1.24, sit);
    rightLegPivot.rotation.x = THREE.MathUtils.lerp(-walkLegSwing, -1.24, sit);
    leftLegPivot.rotation.z = THREE.MathUtils.lerp(0.05, 0.24, sit);
    rightLegPivot.rotation.z = THREE.MathUtils.lerp(-0.05, -0.24, sit);
    leftLegPivot.rotation.y = THREE.MathUtils.lerp(0, 0.22, sit);
    rightLegPivot.rotation.y = THREE.MathUtils.lerp(0, -0.22, sit);

    // Arms cradling heart vs walking vs welcoming wave!
    const walkArmSwing = Math.sin(state.walkCycle) * 0.32 * walk;
    // Left arm cradles heart warmly
    leftArmPivot.rotation.x = THREE.MathUtils.lerp(-0.62 - walkArmSwing, -0.92 - hug * 0.25, Math.max(sit, state.heartLift * 0.8));
    leftArmPivot.rotation.z = THREE.MathUtils.lerp(0.18, 0.48, Math.max(sit, state.heartLift * 0.8));

    // Right arm cradles heart, or waves warmly when waveAmount > 0!
    const holdRightX = -0.92 - hug * 0.25;
    const holdRightZ = -0.48;
    const waveRightX = -0.35;
    const waveRightZ = 2.15 + Math.sin(elapsed * 5.2) * 0.24;

    const baseRightX = THREE.MathUtils.lerp(-0.62 + walkArmSwing, holdRightX, Math.max(sit, state.heartLift * 0.8));
    const baseRightZ = THREE.MathUtils.lerp(-0.18, holdRightZ, Math.max(sit, state.heartLift * 0.8));

    rightArmPivot.rotation.x = THREE.MathUtils.lerp(baseRightX, waveRightX, wave);
    rightArmPivot.rotation.z = THREE.MathUtils.lerp(baseRightZ, waveRightZ, wave);

    // Plush Pink Heart nestled cleanly between paws
    const hl = THREE.MathUtils.clamp(state.heartLift, 0, 1);
    heartGroup.visible = hl > 0.02;
    heartGroup.position.set(
      wave * -0.05,
      THREE.MathUtils.lerp(-0.05, 0.06, hl) + breath * 0.8 + hug * 0.09,
      THREE.MathUtils.lerp(0.38, 0.50, hl)
    );
    heartGroup.scale.setScalar(hl * (1 + Math.sin(elapsed * 2.8) * 0.03 + hug * 0.14));
    heartGroup.rotation.y = Math.sin(elapsed * 1.2) * 0.08;
    heartGroup.rotation.z = Math.cos(elapsed * 1.1) * 0.05;
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
    leftEarPivot,
    rightEarPivot,
    heartGroup,
    state,
    updatePose,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
