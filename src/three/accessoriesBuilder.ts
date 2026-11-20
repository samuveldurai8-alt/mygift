import * as THREE from 'three';
import type { AccessorySelection } from './types';

export interface CharacterAccessoriesRig {
  setSelection: (sel: AccessorySelection) => void;
  dispose: () => void;
}

function createHeartLensGeometry(scale = 1): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -0.042 * scale);
  s.bezierCurveTo(0.01 * scale, -0.04 * scale, 0.056 * scale, -0.008 * scale, 0.056 * scale, 0.02 * scale);
  s.bezierCurveTo(0.056 * scale, 0.046 * scale, 0.025 * scale, 0.055 * scale, 0, 0.028 * scale);
  s.bezierCurveTo(-0.025 * scale, 0.055 * scale, -0.056 * scale, 0.046 * scale, -0.056 * scale, 0.02 * scale);
  s.bezierCurveTo(-0.056 * scale, -0.008 * scale, -0.01 * scale, -0.04 * scale, 0, -0.042 * scale);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.008 * scale,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.004 * scale,
    bevelThickness: 0.004 * scale,
    curveSegments: 14,
  });
  geo.center();
  return geo;
}

function createPartyHatTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#ff77a9');
  grad.addColorStop(1, '#e8437f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const dotColors = ['#fff5b8', '#ffffff', '#ffd3e8', '#a8f0ff'];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      ctx.fillStyle = dotColors[(row + col) % dotColors.length];
      ctx.beginPath();
      ctx.arc(col * 44 + (row % 2) * 22 + 12, row * 44 + 14, 7.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createCharacterAccessories(targets: {
  teddyHead: THREE.Group;
  teddyBody: THREE.Group;
  pikachuHead: THREE.Group;
  pikachuBody: THREE.Group;
  shinchanHead: THREE.Group;
}): CharacterAccessoriesRig {
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  // Shared accessory materials
  const vineMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x5c9159, roughness: 0.72 }));
  const rosePetalMat = trackMat(
    new THREE.MeshPhysicalMaterial({ color: 0xff8ab4, roughness: 0.45, sheen: 0.7, sheenColor: new THREE.Color('#fff0f5') })
  );
  const creamFlowerMat = trackMat(
    new THREE.MeshPhysicalMaterial({ color: 0xfff3d6, roughness: 0.48, sheen: 0.65 })
  );
  const goldMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf0c97e, metalness: 0.85, roughness: 0.22 }));
  const bowtieMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd12858,
      roughness: 0.26,
      sheen: 1.0,
      sheenColor: new THREE.Color('#ffb5cb'),
    })
  );
  const hatTex = createPartyHatTexture();
  disposables.push(hatTex);
  const hatMat = trackMat(new THREE.MeshPhysicalMaterial({ map: hatTex, roughness: 0.48, clearcoat: 0.25 }));
  const pomMat = trackMat(new THREE.MeshPhysicalMaterial({ color: 0xfff8e8, roughness: 0.88, sheen: 0.8 }));

  const frameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf2b5c8,
      metalness: 0.65,
      roughness: 0.2,
    })
  );
  const lensMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x2a1020,
      roughness: 0.06,
      metalness: 0.12,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.84,
    })
  );

  // =========================================================================
  // 1. FLOWER CROWN FOR TEDDY (attached to teddyHead)
  // =========================================================================
  const flowerCrown = new THREE.Group();
  flowerCrown.position.set(0, 0.38 + 0.345, 0.075);
  flowerCrown.rotation.x = 0.24;

  const vineBand = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.285, 0.018, 10, 28)), vineMat);
  vineBand.rotation.x = Math.PI / 2;
  flowerCrown.add(vineBand);

  const blossomGeo = trackGeo(new THREE.SphereGeometry(0.036, 10, 8));
  const petalGeo = trackGeo(new THREE.SphereGeometry(0.028, 10, 8));
  for (let i = 0; i < 7; i++) {
    const ang = -Math.PI * 0.68 + (i / 6) * Math.PI * 1.36;
    const fx = Math.sin(ang) * 0.295;
    const fz = Math.cos(ang) * 0.295;
    const flowerGrp = new THREE.Group();
    flowerGrp.position.set(fx, 0.015, fz);
    flowerGrp.lookAt(fx * 2, 0.14, fz * 2);

    const pMat = i % 2 === 0 ? rosePetalMat : creamFlowerMat;
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * Math.PI * 2;
      const pet = new THREE.Mesh(petalGeo, pMat);
      pet.position.set(Math.cos(pa) * 0.028, Math.sin(pa) * 0.028, 0);
      pet.scale.set(1.0, 1.0, 0.55);
      flowerGrp.add(pet);
    }
    const center = new THREE.Mesh(blossomGeo, goldMat);
    center.scale.setScalar(0.55);
    center.position.z = 0.012;
    flowerGrp.add(center);
    flowerCrown.add(flowerGrp);
  }
  flowerCrown.visible = false;
  targets.teddyHead.add(flowerCrown);

  // =========================================================================
  // 2. PARTY HAT FOR SHINCHAN (attached to shinchanHead)
  // =========================================================================
  const partyHat = new THREE.Group();
  partyHat.position.set(0.04, 0.29 + 0.26, 0.0);
  partyHat.rotation.z = -0.18;

  const cone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.145, 0.35, 24)), hatMat);
  cone.position.y = 0.16;
  cone.castShadow = true;
  partyHat.add(cone);

  const rim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.145, 0.022, 10, 24)), goldMat);
  rim.rotation.x = Math.PI / 2;
  partyHat.add(rim);

  const pom = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.045, 14, 12)), pomMat);
  pom.position.y = 0.345;
  partyHat.add(pom);

  partyHat.visible = false;
  targets.shinchanHead.add(partyHat);

  // =========================================================================
  // 3. SATIN BOWTIES FOR TEDDY & PIKACHU
  // =========================================================================
  const buildBowtie = (scale = 1): THREE.Group => {
    const g = new THREE.Group();
    const knot = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032 * scale, 12, 10)), bowtieMat);
    knot.scale.set(0.9, 1.0, 0.75);
    g.add(knot);

    const wingGeo = trackGeo(new THREE.ConeGeometry(0.056 * scale, 0.115 * scale, 12));
    for (const side of [-1, 1] as const) {
      const wing = new THREE.Mesh(wingGeo, bowtieMat);
      wing.position.set(side * 0.068 * scale, 0, 0);
      wing.rotation.z = side * (Math.PI / 2);
      wing.scale.set(1.0, 1.0, 0.42);
      g.add(wing);
    }
    return g;
  };

  const teddyBowtie = buildBowtie(1.15);
  teddyBowtie.position.set(0, 0.385, 0.325);
  teddyBowtie.visible = false;
  targets.teddyBody.add(teddyBowtie);

  const pikaBowtie = buildBowtie(0.88);
  pikaBowtie.position.set(0, 0.275, 0.245);
  pikaBowtie.visible = false;
  targets.pikachuBody.add(pikaBowtie);

  // =========================================================================
  // 4. HEART-SHAPED SUNGLASSES FOR PIKACHU & SHINCHAN
  // =========================================================================
  const buildHeartShades = (halfSpan: number, scale: number): THREE.Group => {
    const g = new THREE.Group();
    const rimGeo = trackGeo(createHeartLensGeometry(scale * 1.18));
    const glassGeo = trackGeo(createHeartLensGeometry(scale * 0.94));
    const bridgeGeo = trackGeo(new THREE.CylinderGeometry(0.008 * scale, 0.008 * scale, halfSpan * 0.9, 8));
    bridgeGeo.rotateZ(Math.PI / 2);
    const armGeo = trackGeo(new THREE.BoxGeometry(0.012 * scale, 0.014 * scale, 0.22 * scale));

    for (const side of [-1, 1] as const) {
      const lensPivot = new THREE.Group();
      lensPivot.position.set(side * halfSpan, 0, 0);
      lensPivot.rotation.y = side * 0.18;

      const frame = new THREE.Mesh(rimGeo, frameMat);
      const glass = new THREE.Mesh(glassGeo, lensMat);
      glass.position.z = 0.006 * scale;
      lensPivot.add(frame, glass);

      const arm = new THREE.Mesh(armGeo, frameMat);
      arm.position.set(side * 0.056 * scale, 0.018 * scale, -0.11 * scale);
      lensPivot.add(arm);

      g.add(lensPivot);
    }

    const bridge = new THREE.Mesh(bridgeGeo, goldMat);
    bridge.position.set(0, 0.018 * scale, 0.004 * scale);
    g.add(bridge);
    return g;
  };

  const pikaShades = buildHeartShades(0.142, 1.32);
  pikaShades.position.set(0, 0.27 + 0.036, 0.338);
  pikaShades.visible = false;
  targets.pikachuHead.add(pikaShades);

  const shinShades = buildHeartShades(0.112, 1.16);
  shinShades.position.set(0, 0.29 + 0.038, 0.332);
  shinShades.visible = false;
  targets.shinchanHead.add(shinShades);

  function setSelection(sel: AccessorySelection) {
    flowerCrown.visible = sel.flowerCrown;
    partyHat.visible = sel.partyHat;
    teddyBowtie.visible = sel.bowtie;
    pikaBowtie.visible = sel.bowtie;
    pikaShades.visible = sel.heartShades;
    shinShades.visible = sel.heartShades;
  }

  return {
    setSelection,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
