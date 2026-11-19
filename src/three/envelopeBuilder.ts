import * as THREE from 'three';
import type { ThreeTextureBundle } from './types';

export interface EnvelopeRig {
  root: THREE.Group;
  cardPivot: THREE.Group;
  flapPivot: THREE.Group;
  waxSealGroup: THREE.Group;
  shadowMesh: THREE.Mesh;
  state: {
    visibleScale: number; // 0 = hidden, 1 = seated on floor
    openProgress: number; // 0 = sealed closed, 1 = flap open & inner note peeking
  };
  update: (elapsed: number) => void;
  dispose: () => void;
}

function createFlapGeometry(width: number, flapDepth: number): THREE.BufferGeometry {
  // Triangular flap lying in XZ plane, hinge edge along z = 0 from -w/2 to +w/2, apex at +flapDepth
  const halfW = width * 0.5;
  const positions = new Float32Array([
    -halfW, 0.004, 0,
    halfW, 0.004, 0,
    0, 0.004, flapDepth,
  ]);
  const uvs = new Float32Array([0, 0, 1, 0, 0.5, 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex([0, 2, 1]);
  geo.computeVertexNormals();
  return geo;
}

function createSealHeartGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.022);
  shape.bezierCurveTo(0.004, -0.02, 0.026, -0.005, 0.026, 0.011);
  shape.bezierCurveTo(0.026, 0.023, 0.011, 0.027, 0, 0.014);
  shape.bezierCurveTo(-0.011, 0.027, -0.026, 0.023, -0.026, 0.011);
  shape.bezierCurveTo(-0.026, -0.005, -0.004, -0.02, 0, -0.022);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    curveSegments: 12,
  });
  geo.center();
  return geo;
}

export function createEnvelope(textures: ThreeTextureBundle): EnvelopeRig {
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
  root.visible = false;

  const width = 0.62;
  const depth = 0.42;
  const thickness = 0.028;

  // Blush-ivory textured stationery paper
  const envPaperMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: textures.paperMap,
      bumpMap: textures.paperBump,
      bumpScale: 0.005,
      color: 0xfff3f7,
      roughness: 0.52,
      metalness: 0.02,
      sheen: 0.55,
      sheenColor: new THREE.Color('#ffe4ee'),
      side: THREE.DoubleSide,
    })
  );

  // Subtle rose-gold rim trim material
  const goldTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9a492,
      roughness: 0.34,
      metalness: 0.55,
    })
  );

  // Inner parchment letter card
  const innerCardMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xfffaf4,
      roughness: 0.58,
      sheen: 0.3,
    })
  );

  // Rich crimson-rose wax seal material
  const waxMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc22f5b,
      roughness: 0.28,
      metalness: 0.06,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
      emissive: new THREE.Color('#5a0d26'),
      emissiveIntensity: 0.16,
    })
  );

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = thickness * 0.5 + 0.004;
  root.add(bodyPivot);

  // Main envelope body
  const bodyGeo = trackGeo(new THREE.BoxGeometry(width, thickness, depth));
  const bodyMesh = new THREE.Mesh(bodyGeo, envPaperMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyPivot.add(bodyMesh);

  // Subtle rose-gold border frame on upper face
  const trimTopGeo = trackGeo(new THREE.BoxGeometry(width - 0.05, 0.003, 0.008));
  const trimFront = new THREE.Mesh(trimTopGeo, goldTrimMat);
  trimFront.position.set(0, thickness * 0.5 + 0.001, depth * 0.5 - 0.028);
  bodyPivot.add(trimFront);

  // Inner letter card that glides slightly forward when opened
  const cardPivot = new THREE.Group();
  bodyPivot.add(cardPivot);
  const innerCardGeo = trackGeo(new THREE.BoxGeometry(width - 0.06, 0.012, depth - 0.06));
  const innerCard = new THREE.Mesh(innerCardGeo, innerCardMat);
  innerCard.position.set(0, thickness * 0.32, 0);
  cardPivot.add(innerCard);

  // Triangular top flap pivoted at back edge (z = -depth / 2)
  const flapPivot = new THREE.Group();
  flapPivot.position.set(0, thickness * 0.5 + 0.002, -depth * 0.5);
  bodyPivot.add(flapPivot);

  const flapDepth = depth * 0.62;
  const flapGeo = trackGeo(createFlapGeometry(width, flapDepth));
  const flapMesh = new THREE.Mesh(flapGeo, envPaperMat);
  flapMesh.castShadow = true;
  flapMesh.receiveShadow = true;
  flapPivot.add(flapMesh);

  // Crimson Wax Seal Medallion attached near apex of flap
  const waxSealGroup = new THREE.Group();
  waxSealGroup.position.set(0, 0.012, flapDepth * 0.86);
  flapPivot.add(waxSealGroup);

  const sealRimGeo = trackGeo(new THREE.CylinderGeometry(0.066, 0.072, 0.016, 24));
  const sealRim = new THREE.Mesh(sealRimGeo, waxMat);
  sealRim.castShadow = true;
  waxSealGroup.add(sealRim);

  const sealInnerGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.052, 0.019, 20));
  const sealInner = new THREE.Mesh(sealInnerGeo, waxMat);
  sealInner.position.y = 0.001;
  waxSealGroup.add(sealInner);

  const sealHeartGeo = trackGeo(createSealHeartGeometry());
  sealHeartGeo.rotateX(-Math.PI / 2);
  const sealHeart = new THREE.Mesh(sealHeartGeo, goldTrimMat);
  sealHeart.position.y = 0.013;
  waxSealGroup.add(sealHeart);

  // Soft contact shadow right under envelope
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(0.95, 0.72));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.shadowSprite,
      transparent: true,
      depthWrite: false,
      opacity: 0.36,
    })
  );
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.004;
  root.add(shadowMesh);

  const state = {
    visibleScale: 0,
    openProgress: 0,
  };

  function update(elapsed: number) {
    const s = THREE.MathUtils.clamp(state.visibleScale, 0, 1.15);
    root.visible = s > 0.01;
    if (!root.visible) return;

    root.scale.setScalar(s);

    // Subtle inviting float/tilt & warm wax shimmer
    const open = THREE.MathUtils.clamp(state.openProgress, 0, 1);
    bodyPivot.position.y = thickness * 0.5 + 0.006 + Math.sin(elapsed * 1.9) * 0.004 * (1 - open * 0.5);
    flapPivot.rotation.x = THREE.MathUtils.lerp(0, -Math.PI * 0.72, open);

    // Inner letter card peeks gently out when opened
    cardPivot.position.z = -open * 0.14;
    cardPivot.position.y = open * 0.016;

    waxMat.emissiveIntensity = 0.16 + Math.sin(elapsed * 2.4) * 0.07;
  }

  update(0);

  return {
    root,
    cardPivot,
    flapPivot,
    waxSealGroup,
    shadowMesh,
    state,
    update,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
