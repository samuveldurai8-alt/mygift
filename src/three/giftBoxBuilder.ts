import * as THREE from 'three';

export interface GiftBoxRig {
  root: THREE.Group;
  boxGroup: THREE.Group;
  lidGroup: THREE.Group;
  hitTarget: THREE.Mesh;
  state: {
    visibleScale: number;
    openProgress: number; // 0 = closed, 1 = popped open
    wobbleActive: number; // 0 = still, 1 = playful wiggle invitation
  };
  update: (elapsed: number) => void;
  dispose: () => void;
}

function createGiftBoxTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Soft blush-rose luxury cardstock base gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#ffdbe8');
  grad.addColorStop(0.5, '#f8bed4');
  grad.addColorStop(1, '#f2a5c2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Delicate diagonal linen weave grain
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.5;
  for (let i = -size; i < size * 2; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }

  // Subtle gold-foil mini heart monogram pattern
  const drawMiniHeart = (cx: number, cy: number, s: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(232, 178, 128, 0.34)';
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(10, -2, 11, -10, 4.5, -11);
    ctx.bezierCurveTo(1.5, -11.5, 0, -7, 0, -6);
    ctx.bezierCurveTo(0, -7, -1.5, -11.5, -4.5, -11);
    ctx.bezierCurveTo(-11, -10, -10, -2, 0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const offsetX = row % 2 === 0 ? 42 : 84;
      drawMiniHeart(col * 84 + offsetX, row * 84 + 42, 0.95);
    }
  }

  // Subtle vignette depth along edges
  const vig = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.72);
  vig.addColorStop(0, 'rgba(255, 255, 255, 0)');
  vig.addColorStop(1, 'rgba(150, 56, 92, 0.14)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createHeartCharmGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.055);
  shape.bezierCurveTo(0.01, -0.05, 0.06, -0.012, 0.06, 0.026);
  shape.bezierCurveTo(0.06, 0.056, 0.026, 0.066, 0, 0.036);
  shape.bezierCurveTo(-0.026, 0.066, -0.06, 0.056, -0.06, 0.026);
  shape.bezierCurveTo(-0.06, -0.012, -0.01, -0.05, 0, -0.055);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    curveSegments: 14,
  });
  geo.center();
  return geo;
}

export function createGiftBox(maxAniso = 4): GiftBoxRig {
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const root = new THREE.Group();
  const boxGroup = new THREE.Group();
  root.add(boxGroup);

  const boxTex = createGiftBoxTexture();
  boxTex.anisotropy = Math.min(maxAniso, 8);
  disposables.push(boxTex);

  // Varied PBR materials: matte woven cardstock vs lustrous satin ribbon vs metallic rose-gold trim
  const boxMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: boxTex,
      roughness: 0.72,
      metalness: 0.02,
      sheen: 0.35,
      sheenColor: new THREE.Color('#fff5f9'),
    })
  );

  const innerVelvetMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x6b203c,
      roughness: 0.9,
      sheen: 0.8,
      sheenColor: new THREE.Color('#c45b82'),
    })
  );

  const ribbonMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc92a5a,
      roughness: 0.25,
      metalness: 0.14,
      sheen: 1.0,
      sheenRoughness: 0.3,
      sheenColor: new THREE.Color('#ffbfd4'),
      clearcoat: 0.32,
    })
  );

  const goldTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf0c986,
      metalness: 0.85,
      roughness: 0.2,
    })
  );

  const tissueMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xfff6f9,
      roughness: 0.82,
      sheen: 0.65,
      sheenColor: new THREE.Color('#ffe0eb'),
      side: THREE.DoubleSide,
    })
  );

  // =========================================================================
  // 1. HOLLOW OPEN-TOP LUXURY BOX BASE (W=1.08, H=0.84, D=1.08)
  // =========================================================================
  const W = 1.08;
  const H = 0.84;
  const D = 1.08;
  const wallT = 0.055;

  // Floor slab (bottom at y = 0)
  const bottomFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(W, 0.06, D)), boxMat);
  bottomFloor.position.set(0, 0.03, 0);
  bottomFloor.castShadow = true;
  bottomFloor.receiveShadow = true;
  boxGroup.add(bottomFloor);

  // Velvet interior cushion
  const innerPad = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(W - wallT * 2.1, 0.04, D - wallT * 2.1)),
    innerVelvetMat
  );
  innerPad.position.set(0, 0.075, 0);
  innerPad.receiveShadow = true;
  boxGroup.add(innerPad);

  // 4 Hollow walls
  const fbWallGeo = trackGeo(new THREE.BoxGeometry(W, H, wallT));
  const lrWallGeo = trackGeo(new THREE.BoxGeometry(wallT, H, D - wallT * 2));

  const frontWall = new THREE.Mesh(fbWallGeo, boxMat);
  frontWall.position.set(0, H / 2, D / 2 - wallT / 2);
  frontWall.castShadow = true;
  frontWall.receiveShadow = true;

  const backWall = new THREE.Mesh(fbWallGeo, boxMat);
  backWall.position.set(0, H / 2, -D / 2 + wallT / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;

  const leftWall = new THREE.Mesh(lrWallGeo, boxMat);
  leftWall.position.set(-W / 2 + wallT / 2, H / 2, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;

  const rightWall = new THREE.Mesh(lrWallGeo, boxMat);
  rightWall.position.set(W / 2 - wallT / 2, H / 2, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;

  boxGroup.add(frontWall, backWall, leftWall, rightWall);

  // Rose-gold foil trim collar on upper inner lip
  const trimStripFBGeo = trackGeo(new THREE.BoxGeometry(W + 0.012, 0.025, 0.02));
  const trimStripLRGeo = trackGeo(new THREE.BoxGeometry(0.02, 0.025, D + 0.012));

  const trimFront = new THREE.Mesh(trimStripFBGeo, goldTrimMat);
  trimFront.position.set(0, H - 0.01, D / 2 - 0.004);
  const trimBack = new THREE.Mesh(trimStripFBGeo, goldTrimMat);
  trimBack.position.set(0, H - 0.01, -D / 2 + 0.004);
  const trimLeft = new THREE.Mesh(trimStripLRGeo, goldTrimMat);
  trimLeft.position.set(-W / 2 + 0.004, H - 0.01, 0);
  const trimRight = new THREE.Mesh(trimStripLRGeo, goldTrimMat);
  trimRight.position.set(W / 2 - 0.004, H - 0.01, 0);
  boxGroup.add(trimFront, trimBack, trimLeft, trimRight);

  // Crossed Satin Ribbon Straps on Base Outer Sides (keeps inner hollow cavity clear)
  const strapFront = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.15, H - 0.02, 0.012)), ribbonMat);
  strapFront.position.set(0, H / 2, D / 2 + 0.006);
  const strapBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.15, H - 0.02, 0.012)), ribbonMat);
  strapBack.position.set(0, H / 2, -D / 2 - 0.006);
  const strapLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, H - 0.02, 0.15)), ribbonMat);
  strapLeft.position.set(-W / 2 - 0.006, H / 2, 0);
  const strapRight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, H - 0.02, 0.15)), ribbonMat);
  strapRight.position.set(W / 2 + 0.006, H / 2, 0);
  boxGroup.add(strapFront, strapBack, strapLeft, strapRight);

  // Ruffled Cream Tissue Paper Lining Inside Box
  const tissueGeo = trackGeo(new THREE.ConeGeometry(0.24, 0.34, 7, 1, true));
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.3;
    const ruff = new THREE.Mesh(tissueGeo, tissueMat);
    ruff.position.set(Math.cos(ang) * 0.28, 0.54 + (i % 2) * 0.04, Math.sin(ang) * 0.28);
    ruff.rotation.set((Math.random() - 0.5) * 0.35, ang, Math.PI + (Math.random() - 0.5) * 0.3);
    ruff.scale.set(1.05, 0.85, 0.88);
    boxGroup.add(ruff);
  }

  // =========================================================================
  // 2. POP-OPEN GIFT BOX LID + SCULPTED SATIN BOW + GOLD HEART CHARM
  // =========================================================================
  const lidGroup = new THREE.Group();
  // Pivot starts closed at y = H - 0.14 (skirt overlaps top rim cleanly)
  lidGroup.position.set(0, H - 0.14, 0);
  boxGroup.add(lidGroup);

  const lidW = W + 0.09;
  const lidD = D + 0.09;
  const lidSkirtH = 0.2;

  const lidTopMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(lidW, 0.055, lidD)), boxMat);
  lidTopMesh.position.set(0, lidSkirtH, 0);
  lidTopMesh.castShadow = true;
  lidTopMesh.receiveShadow = true;
  lidGroup.add(lidTopMesh);

  // Lid overhanging skirts
  const lidSkirtFBGeo = trackGeo(new THREE.BoxGeometry(lidW, lidSkirtH, 0.036));
  const lidSkirtLRGeo = trackGeo(new THREE.BoxGeometry(0.036, lidSkirtH, lidD - 0.072));
  const lidFront = new THREE.Mesh(lidSkirtFBGeo, boxMat);
  lidFront.position.set(0, lidSkirtH / 2, lidD / 2 - 0.018);
  lidFront.castShadow = true;
  const lidBack = new THREE.Mesh(lidSkirtFBGeo, boxMat);
  lidBack.position.set(0, lidSkirtH / 2, -lidD / 2 + 0.018);
  lidBack.castShadow = true;
  const lidLeft = new THREE.Mesh(lidSkirtLRGeo, boxMat);
  lidLeft.position.set(-lidW / 2 + 0.018, lidSkirtH / 2, 0);
  lidLeft.castShadow = true;
  const lidRight = new THREE.Mesh(lidSkirtLRGeo, boxMat);
  lidRight.position.set(lidW / 2 - 0.018, lidSkirtH / 2, 0);
  lidRight.castShadow = true;
  lidGroup.add(lidFront, lidBack, lidLeft, lidRight);

  // Rose-gold foil edging around lid perimeter
  const lidTrimFBGeo = trackGeo(new THREE.BoxGeometry(lidW + 0.01, 0.022, 0.014));
  const lidTrimLRGeo = trackGeo(new THREE.BoxGeometry(0.014, 0.022, lidD + 0.01));
  const ltF = new THREE.Mesh(lidTrimFBGeo, goldTrimMat);
  ltF.position.set(0, 0.012, lidD / 2 + 0.004);
  const ltB = new THREE.Mesh(lidTrimFBGeo, goldTrimMat);
  ltB.position.set(0, 0.012, -lidD / 2 - 0.004);
  const ltL = new THREE.Mesh(lidTrimLRGeo, goldTrimMat);
  ltL.position.set(-lidW / 2 - 0.004, 0.012, 0);
  const ltR = new THREE.Mesh(lidTrimLRGeo, goldTrimMat);
  ltR.position.set(lidW / 2 + 0.004, 0.012, 0);
  lidGroup.add(ltF, ltB, ltL, ltR);

  // Crossed Satin Ribbon Bands across Lid Top & Skirt
  const lidBandZ = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.16, lidSkirtH + 0.04, lidD + 0.022)),
    ribbonMat
  );
  lidBandZ.position.set(0, lidSkirtH * 0.56, 0);
  const lidBandX = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(lidW + 0.022, lidSkirtH + 0.04, 0.16)),
    ribbonMat
  );
  lidBandX.position.set(0, lidSkirtH * 0.56, 0);
  lidGroup.add(lidBandZ, lidBandX);

  // Sculpted 4-Loop Satin Bow on Lid Top
  const bowGroup = new THREE.Group();
  bowGroup.position.set(0, lidSkirtH + 0.038, 0);
  lidGroup.add(bowGroup);

  const bowKnot = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.065, 16, 12)), ribbonMat);
  bowKnot.scale.set(1.15, 0.85, 1.1);
  bowKnot.castShadow = true;
  bowGroup.add(bowKnot);

  const bowLoopGeo = trackGeo(new THREE.TorusGeometry(0.135, 0.038, 12, 24));
  for (let i = 0; i < 4; i++) {
    const loop = new THREE.Mesh(bowLoopGeo, ribbonMat);
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    loop.position.set(Math.cos(angle) * 0.12, 0.045, Math.sin(angle) * 0.12);
    loop.rotation.y = -angle;
    loop.rotation.z = 0.42;
    loop.scale.set(1.2, 0.72, 0.88);
    loop.castShadow = true;
    bowGroup.add(loop);
  }

  // Two draped ribbon tails on front of bow
  const tailGeo = trackGeo(new THREE.BoxGeometry(0.085, 0.012, 0.28));
  for (const side of [-1, 1] as const) {
    const tail = new THREE.Mesh(tailGeo, ribbonMat);
    tail.position.set(side * 0.09, -0.015, 0.18);
    tail.rotation.y = side * 0.42;
    tail.rotation.x = 0.12;
    bowGroup.add(tail);
  }

  // Tiny metallic gold heart charm at center of bow
  const charm = new THREE.Mesh(trackGeo(createHeartCharmGeometry()), goldTrimMat);
  charm.position.set(0, 0.028, 0.065);
  charm.rotation.x = -0.25;
  bowGroup.add(charm);

  // Invisible hit proxy covering entire box & bow cleanly for easy tapping
  const hitTarget = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.36, 1.32, 1.36)),
    trackMat(new THREE.MeshBasicMaterial({ visible: false }))
  );
  hitTarget.position.set(0, 0.66, 0);
  root.add(hitTarget);

  root.scale.setScalar(0.001);
  root.visible = false;

  const state = {
    visibleScale: 0,
    openProgress: 0,
    wobbleActive: 0,
  };

  function update(elapsed: number) {
    const s = THREE.MathUtils.clamp(state.visibleScale, 0, 1.25);
    root.visible = s > 0.01;
    if (!root.visible) return;

    // Playful "something cute is waiting inside!" periodic wiggle while closed
    const wWeight = THREE.MathUtils.clamp(state.wobbleActive, 0, 1) * (1 - Math.min(1, state.openProgress * 4));
    const cycle = elapsed % 2.4;
    const burst = cycle < 0.75 ? Math.sin((cycle / 0.75) * Math.PI) : 0;
    const wiggleZ = Math.sin(elapsed * 22) * 0.055 * burst * wWeight;
    const wiggleY = Math.abs(Math.sin(elapsed * 11)) * 0.032 * burst * wWeight;
    const squashY = 1 + Math.sin(elapsed * 11) * 0.03 * burst * wWeight;

    boxGroup.rotation.z = wiggleZ;
    boxGroup.position.y = wiggleY;
    root.scale.set(s, s * squashY, s);

    // Pop-Open Lid Motion: rises upward & flips backward with snappy spring
    const op = THREE.MathUtils.clamp(state.openProgress, 0, 1.15);
    const popArc = Math.sin(Math.min(op, 1) * Math.PI) * 0.44;
    lidGroup.position.y = H - 0.14 + op * 0.54 + popArc;
    lidGroup.position.z = -op * 0.64;
    lidGroup.rotation.x = -op * 1.62;
  }

  return {
    root,
    boxGroup,
    lidGroup,
    hitTarget,
    state,
    update,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
