import * as THREE from 'three';
import { createPetalAlbedoTexture } from './textures';
import type { ThreeTextureBundle, TulipShadeSpec } from './types';

const _tangent = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _normal = new THREE.Vector3();
const _binormal = new THREE.Vector3();
const _center = new THREE.Vector3();

/**
 * Creates a realistic double-walled cupped tulip petal BufferGeometry
 * with natural thickness, tapered edges, and a central keel ridge.
 * Pivot is at the petal base (0, 0, 0), growing upward along +Y,
 * with +Z facing inward toward the flower center.
 */
export function createTulipPetalGeometry(): THREE.BufferGeometry {
  const segU = 14;
  const segV = 22;
  const cols = segU + 1;
  const rows = segV + 1;
  const sideVertCount = cols * rows;
  const totalVerts = sideVertCount * 2;

  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices: number[] = [];

  const petalHeight = 0.66;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV; // 0 (base) -> 1 (tip)

    // Botanical obovate tulip petal width envelope
    const baseWidth = 0.048;
    const belly = Math.sin(Math.pow(v, 0.72) * Math.PI);
    const tipTaper = Math.pow(Math.max(0, 1 - Math.pow(v, 3.4)), 0.45);
    const halfWidth = (baseWidth * (1 - v) + 0.255 * belly) * (0.18 + 0.82 * tipTaper);

    // Longitudinal S-cup profile (swells outward toward +Z at belly, cups gently inward toward -Z at tip)
    const outwardBelly = Math.sin(v * Math.PI * 0.92) * 0.135;
    const tipInwardCup = Math.pow(v, 2.2) * 0.095;
    const zSpine = outwardBelly - tipInwardCup;

    // Height progression along curve
    const y = v * petalHeight - Math.pow(v, 2.4) * 0.025;

    for (let iu = 0; iu <= segU; iu++) {
      const uNorm = iu / segU; // 0..1
      const u = uNorm * 2 - 1; // -1..1

      const x = u * halfWidth;

      // Cross-sectional cup curvature (lateral edges curl inward toward -Z flower center)
      const cupAmount = (0.036 + 0.078 * Math.sin(v * Math.PI)) * (u * u);
      // Subtle central keel ridge on outer (+Z) face
      const keel = Math.exp(-u * u * 10) * 0.009 * Math.sin(v * Math.PI);
      // Delicate organic edge micro-undulation
      const edgeWave = (u * u) * Math.sin(v * Math.PI * 3.0) * 0.0045;

      const zMid = zSpine - cupAmount + edgeWave;

      // Thickness tapers cleanly to 0 at lateral edges (|u| = 1) and tip (v = 1)
      const edgeFade = Math.sqrt(Math.max(0, 1 - u * u));
      const lengthFade = 1 - 0.72 * Math.pow(v, 1.5);
      const halfThick = (0.002 + 0.0085 * lengthFade) * edgeFade * (1 - Math.pow(v, 6));

      // Front/inner surface (facing -Z, toward flower center)
      const idxInner = iv * cols + iu;
      positions[idxInner * 3] = x;
      positions[idxInner * 3 + 1] = y;
      positions[idxInner * 3 + 2] = zMid - halfThick;
      uvs[idxInner * 2] = uNorm;
      uvs[idxInner * 2 + 1] = v;

      // Back/outer surface (facing +Z, outward)
      const idxOuter = sideVertCount + idxInner;
      positions[idxOuter * 3] = x;
      positions[idxOuter * 3 + 1] = y;
      positions[idxOuter * 3 + 2] = zMid + halfThick + keel;
      uvs[idxOuter * 2] = uNorm;
      uvs[idxOuter * 2 + 1] = v;
    }
  }

  // Triangulate inner (-Z) and outer (+Z) surfaces with outward-facing normals
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * cols + iu;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;

      // Inner face (normals point -Z)
      indices.push(a, d, b);
      indices.push(a, c, d);

      // Outer face (normals point +Z)
      const ao = sideVertCount + a;
      const bo = sideVertCount + b;
      const co = sideVertCount + c;
      const do_ = sideVertCount + d;
      indices.push(ao, bo, do_);
      indices.push(ao, do_, co);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a realistic elongated channeled tulip leaf BufferGeometry.
 * Pivot at clasping stem base (0, 0, 0).
 */
export function createTulipLeafGeometry(length = 0.95, maxWidth = 0.165): THREE.BufferGeometry {
  const segU = 10;
  const segV = 20;
  const cols = segU + 1;
  const rows = segV + 1;
  const sideVertCount = cols * rows;
  const totalVerts = sideVertCount * 2;

  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices: number[] = [];

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    // Lanceolate leaf width: narrows at clasping base, widest at 32%, tapers to sharp graceful tip
    const widthFactor = Math.sin(Math.pow(v, 0.58) * Math.PI) * (1 - 0.15 * v);
    const halfW = maxWidth * (0.28 * (1 - v) + widthFactor);

    // Graceful outward arch
    const archOut = Math.pow(v, 1.55) * 0.28;
    const archY = v * length - Math.pow(v, 2.3) * (length * 0.18);

    for (let iu = 0; iu <= segU; iu++) {
      const uNorm = iu / segU;
      const u = uNorm * 2 - 1;
      const x = u * halfW;

      // V-shaped midrib channel
      const trough = Math.abs(u) * 0.028 * (1 - 0.45 * v) + (u * u) * 0.015;
      // Subtle natural leaf margin ripple
      const ripple = (u * u) * Math.sin(v * Math.PI * 3.5) * 0.008;

      const zMid = -archOut - trough + ripple;
      const edgeFade = Math.sqrt(Math.max(0, 1 - u * u));
      const halfThick = 0.004 * (1 - 0.7 * v) * edgeFade;

      const iTop = iv * cols + iu;
      positions[iTop * 3] = x;
      positions[iTop * 3 + 1] = archY;
      positions[iTop * 3 + 2] = zMid + halfThick;
      uvs[iTop * 2] = uNorm;
      uvs[iTop * 2 + 1] = v;

      const iBot = sideVertCount + iTop;
      positions[iBot * 3] = x;
      positions[iBot * 3 + 1] = archY;
      positions[iBot * 3 + 2] = zMid - halfThick;
      uvs[iBot * 2] = uNorm;
      uvs[iBot * 2 + 1] = v;
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * cols + iu;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);

      const ao = sideVertCount + a;
      const bo = sideVertCount + b;
      const co = sideVertCount + c;
      const do_ = sideVertCount + d;
      indices.push(ao, do_, bo, ao, co, do_);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export interface TulipInstance {
  spec: TulipShadeSpec;
  root: THREE.Group;
  swayPivot: THREE.Group;
  headGroup: THREE.Group;
  outerPetals: THREE.Group[];
  innerPetals: THREE.Group[];
  leafPivots: { group: THREE.Group; baseYFrac: number; baseRotY: number; unfoldAngle: number }[];
  moundMesh: THREE.Mesh;
  stemMesh: THREE.Mesh;
  stemCurve: THREE.CatmullRomCurve3;
  // Animation state driven by GSAP
  state: {
    stemProgress: number; // 0 -> 1
    leafUnfold: number; // 0 -> 1
    budScale: number; // 0 -> 1
    outerOpen: number; // 0 -> 1
    innerOpen: number; // 0 -> 1
    moundOpacity: number; // 1 -> 0 when lifting into bouquet
    leafTuck: number; // 0 -> 1 in bouquet
    swayAmp: number; // 0 -> 1 breeze
    highlightGlow: number; // 0 -> 1 soft petal highlight on tap
  };
  updateGeometry: (elapsed: number, index: number) => void;
  dispose: () => void;
}

export function createTulip(
  spec: TulipShadeSpec,
  index: number,
  sharedPetalGeo: THREE.BufferGeometry,
  sharedLeafGeo: THREE.BufferGeometry,
  textures: ThreeTextureBundle,
  maxAniso: number
): TulipInstance {
  const root = new THREE.Group();
  root.position.set(...spec.gardenPos);

  const swayPivot = new THREE.Group();
  root.add(swayPivot);

  // Small moss/earth garden mound at base during Garden Phase
  const moundGeo = new THREE.SphereGeometry(0.16, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
  moundGeo.scale(1.2, 0.42, 1.2);
  const moundMat = new THREE.MeshStandardMaterial({
    color: 0x79936d,
    roughness: 0.92,
    metalness: 0.0,
    transparent: true,
    opacity: 1,
  });
  const moundMesh = new THREE.Mesh(moundGeo, moundMat);
  moundMesh.receiveShadow = true;
  root.add(moundMesh);

  // Natural organic S-curved stem path
  const h = spec.stemHeight;
  const curveJitterX = ((index % 2 === 0 ? 1 : -1) * 0.055) + Math.sin(index * 2.1) * 0.03;
  const curveJitterZ = Math.cos(index * 1.7) * 0.045;
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(curveJitterX * 0.4, h * 0.34, curveJitterZ * 0.4),
    new THREE.Vector3(-curveJitterX * 0.35, h * 0.7, curveJitterZ * 0.8),
    new THREE.Vector3(0, h, 0),
  ]);

  // Dynamic curved stem BufferGeometry (24 rings x 10 radial segments)
  const stemRings = 24;
  const radialSegs = 10;
  const stemVertCount = (stemRings + 1) * (radialSegs + 1);
  const stemPos = new Float32Array(stemVertCount * 3);
  const stemUvs = new Float32Array(stemVertCount * 2);
  const stemIndices: number[] = [];

  for (let r = 0; r <= stemRings; r++) {
    for (let s = 0; s <= radialSegs; s++) {
      const idx = r * (radialSegs + 1) + s;
      stemUvs[idx * 2] = s / radialSegs;
      stemUvs[idx * 2 + 1] = r / stemRings;
    }
  }
  for (let r = 0; r < stemRings; r++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = r * (radialSegs + 1) + s;
      const b = a + 1;
      const c = a + (radialSegs + 1);
      const d = c + 1;
      stemIndices.push(a, c, b, b, c, d);
    }
  }

  const stemGeo = new THREE.BufferGeometry();
  stemGeo.setAttribute('position', new THREE.BufferAttribute(stemPos, 3));
  stemGeo.setAttribute('uv', new THREE.BufferAttribute(stemUvs, 2));
  stemGeo.setIndex(stemIndices);

  const stemMat = new THREE.MeshPhysicalMaterial({
    map: textures.leafMap,
    bumpMap: textures.leafBump,
    bumpScale: 0.008,
    color: 0xffffff,
    roughness: 0.52,
    metalness: 0.0,
    sheen: 0.25,
    sheenColor: new THREE.Color('#b6d7a8'),
  });

  const stemMesh = new THREE.Mesh(stemGeo, stemMat);
  stemMesh.castShadow = true;
  stemMesh.receiveShadow = true;
  swayPivot.add(stemMesh);

  // Elongated leaves along lower stem
  const leafMat = new THREE.MeshPhysicalMaterial({
    map: textures.leafMap,
    bumpMap: textures.leafBump,
    bumpScale: 0.012,
    roughness: 0.46,
    metalness: 0.0,
    sheen: 0.35,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#c5e0b8'),
  });

  const leafConfigs = [
    { baseYFrac: 0.08, baseRotY: index * 1.1 + 0.2, unfoldAngle: 0.52, scale: 1.0 },
    { baseYFrac: 0.19, baseRotY: index * 1.1 + 2.5, unfoldAngle: 0.44, scale: 0.88 },
    { baseYFrac: 0.31, baseRotY: index * 1.1 + 4.4, unfoldAngle: 0.36, scale: 0.72 },
  ];

  const leafPivots = leafConfigs.map((cfg) => {
    const group = new THREE.Group();
    const leafMesh = new THREE.Mesh(sharedLeafGeo, leafMat);
    leafMesh.scale.setScalar(cfg.scale);
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    group.add(leafMesh);
    swayPivot.add(group);
    return {
      group,
      baseYFrac: cfg.baseYFrac,
      baseRotY: cfg.baseRotY,
      unfoldAngle: cfg.unfoldAngle,
    };
  });

  // Flower head anchored at stem tip
  const headGroup = new THREE.Group();
  swayPivot.add(headGroup);

  // Small green receptacle cup at base of flower head
  const receptGeo = new THREE.ConeGeometry(0.055, 0.09, 14);
  receptGeo.rotateX(Math.PI);
  const receptMesh = new THREE.Mesh(receptGeo, stemMat);
  receptMesh.position.y = 0.025;
  headGroup.add(receptMesh);

  // Botanical pistil & stamens inside the flower cup
  const interiorGroup = new THREE.Group();
  interiorGroup.position.y = 0.04;
  headGroup.add(interiorGroup);

  const pistilMat = new THREE.MeshStandardMaterial({
    color: 0xd9e89c,
    roughness: 0.45,
  });
  const pistilStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.024, 0.24, 10), pistilMat);
  pistilStem.position.y = 0.12;
  interiorGroup.add(pistilStem);

  for (let l = 0; l < 3; l++) {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), pistilMat);
    const a = (l / 3) * Math.PI * 2;
    lobe.position.set(Math.cos(a) * 0.018, 0.25, Math.sin(a) * 0.018);
    lobe.scale.set(1.2, 0.7, 0.9);
    interiorGroup.add(lobe);
  }

  const filamentMat = new THREE.MeshStandardMaterial({ color: 0xf6eed8, roughness: 0.5 });
  const antherMat = new THREE.MeshStandardMaterial({
    color: spec.id === 'deep-red' ? 0x3b1b24 : 0xe3b448,
    roughness: 0.65,
  });
  for (let s = 0; s < 6; s++) {
    const a = (s / 6) * Math.PI * 2 + 0.2;
    const fil = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.18, 6), filamentMat);
    fil.position.set(Math.cos(a) * 0.045, 0.09, Math.sin(a) * 0.045);
    fil.rotation.z = -Math.cos(a) * 0.16;
    fil.rotation.x = Math.sin(a) * 0.16;
    interiorGroup.add(fil);

    const ant = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.036, 4, 8), antherMat);
    ant.position.set(Math.cos(a) * 0.056, 0.19, Math.sin(a) * 0.056);
    interiorGroup.add(ant);
  }

  // Petal PBR material with realistic veins, soft sheen & subsurface glow tint
  const petalAlbedo = createPetalAlbedoTexture(spec, maxAniso);
  const petalMat = new THREE.MeshPhysicalMaterial({
    map: petalAlbedo,
    bumpMap: textures.petalBump,
    bumpScale: 0.008,
    roughness: 0.34,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.38,
    sheenColor: new THREE.Color(spec.tipColor),
    clearcoat: 0.22,
    clearcoatRoughness: 0.32,
    emissive: new THREE.Color(spec.emissiveTint),
    emissiveIntensity: 0.22,
  });

  // 3 Inner Petals + 3 Outer Petals (staggered by 60 deg)
  const innerPetals: THREE.Group[] = [];
  const outerPetals: THREE.Group[] = [];

  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const ringPivot = new THREE.Group();
    ringPivot.rotation.y = angle;

    const tiltPivot = new THREE.Group();
    tiltPivot.position.set(0, 0.035, 0.022);
    const petalMesh = new THREE.Mesh(sharedPetalGeo, petalMat);
    petalMesh.scale.set(0.92, 0.96, 0.92);
    petalMesh.castShadow = true;
    petalMesh.receiveShadow = true;
    tiltPivot.add(petalMesh);
    ringPivot.add(tiltPivot);
    headGroup.add(ringPivot);
    innerPetals.push(tiltPivot);
  }

  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 3;
    const ringPivot = new THREE.Group();
    ringPivot.rotation.y = angle;

    const tiltPivot = new THREE.Group();
    tiltPivot.position.set(0, 0.025, 0.034);
    const petalMesh = new THREE.Mesh(sharedPetalGeo, petalMat);
    petalMesh.scale.set(1.0, 1.0, 1.0);
    petalMesh.castShadow = true;
    petalMesh.receiveShadow = true;
    tiltPivot.add(petalMesh);
    ringPivot.add(tiltPivot);
    headGroup.add(ringPivot);
    outerPetals.push(tiltPivot);
  }

  const state = {
    stemProgress: 0.001,
    leafUnfold: 0,
    budScale: 0.001,
    outerOpen: 0,
    innerOpen: 0,
    moundOpacity: 1,
    leafTuck: 0,
    swayAmp: 0,
    highlightGlow: 0,
  };

  function updateGeometry(elapsed: number, idx: number) {
    const p = THREE.MathUtils.clamp(state.stemProgress, 0.002, 1);

    // Update dynamic stem rings along curve up to parameter p
    const posAttr = stemGeo.attributes.position as THREE.BufferAttribute;
    const baseRadius = 0.036;
    const tipRadius = 0.023;

    for (let r = 0; r <= stemRings; r++) {
      const t = (r / stemRings) * p;
      stemCurve.getPoint(t, _center);
      stemCurve.getTangent(t, _tangent).normalize();

      // Construct stable perpendicular frame along stem tangent
      _normal.crossVectors(_tangent, _up);
      if (_normal.lengthSq() < 0.0001) {
        _normal.set(1, 0, 0);
      } else {
        _normal.normalize();
      }
      _binormal.crossVectors(_tangent, _normal).normalize();

      const radius = THREE.MathUtils.lerp(baseRadius, tipRadius, r / stemRings) * Math.min(1, p * 4);

      for (let s = 0; s <= radialSegs; s++) {
        const theta = (s / radialSegs) * Math.PI * 2;
        const cosT = Math.cos(theta) * radius;
        const sinT = Math.sin(theta) * radius;

        const vIdx = r * (radialSegs + 1) + s;
        posAttr.setXYZ(
          vIdx,
          _center.x + _normal.x * cosT + _binormal.x * sinT,
          _center.y + _normal.y * cosT + _binormal.y * sinT,
          _center.z + _normal.z * cosT + _binormal.z * sinT
        );
      }
    }
    posAttr.needsUpdate = true;
    stemGeo.computeVertexNormals();
    stemGeo.computeBoundingSphere();

    // Anchor head at exact tip of grown stem
    stemCurve.getPoint(p, _center);
    stemCurve.getTangent(p, _tangent).normalize();
    _quat.setFromUnitVectors(_up, _tangent);

    headGroup.position.copy(_center);
    headGroup.quaternion.copy(_quat);
    headGroup.scale.setScalar(spec.scale * 1.08 * THREE.MathUtils.clamp(state.budScale, 0.001, 1.25));
    headGroup.visible = state.budScale > 0.01;

    // Update leaves along grown stem (only appear once stem passes leaf attachment point)
    for (let i = 0; i < leafPivots.length; i++) {
      const lp = leafPivots[i];
      if (p <= lp.baseYFrac + 0.03) {
        lp.group.visible = false;
        continue;
      }
      const localGrow = THREE.MathUtils.clamp((p - lp.baseYFrac) / 0.35, 0, 1);
      lp.group.visible = localGrow > 0.02;
      stemCurve.getPoint(lp.baseYFrac, _center);
      lp.group.position.copy(_center);

      const tuckFactor = 1 - state.leafTuck * 0.42;
      const openTilt =
        0.08 + state.leafUnfold * lp.unfoldAngle * tuckFactor;

      lp.group.rotation.set(0, lp.baseRotY, 0);
      lp.group.children[0].rotation.x = -openTilt;
      lp.group.scale.setScalar(localGrow * (0.4 + 0.6 * state.leafUnfold) * (1 - state.leafTuck * 0.14));
    }

    // Update individual petals opening (positive X rotation tilts top outward toward +Z)
    // Inner petals start tightly cupped (-0.14 rad inward) and unfold to (+0.26 rad outward)
    for (let i = 0; i < 3; i++) {
      const petalDelay = THREE.MathUtils.clamp((state.innerOpen - i * 0.1) / 0.8, 0, 1);
      const eased = 1 - Math.pow(1 - petalDelay, 2.2);
      innerPetals[i].rotation.x = THREE.MathUtils.lerp(-0.14, 0.26, eased);
    }

    // Outer petals start tightly hugging (-0.08 rad inward) and unfold to (+0.48 rad outward)
    for (let i = 0; i < 3; i++) {
      const petalDelay = THREE.MathUtils.clamp((state.outerOpen - i * 0.1) / 0.8, 0, 1);
      const eased = 1 - Math.pow(1 - petalDelay, 2.2);
      outerPetals[i].rotation.x = THREE.MathUtils.lerp(-0.08, 0.48, eased);
    }

    // Gentle breeze swaying
    const sway = state.swayAmp;
    if (sway > 0.001) {
      swayPivot.rotation.z = Math.sin(elapsed * 1.35 + idx * 0.9) * 0.042 * sway;
      swayPivot.rotation.x = Math.cos(elapsed * 1.05 + idx * 1.3) * 0.032 * sway;
    } else {
      swayPivot.rotation.set(0, 0, 0);
    }

    // Ground mound visibility
    moundMat.opacity = state.moundOpacity;
    moundMesh.visible = state.moundOpacity > 0.01;

    // Soft petal glow pulse when tapped
    petalMat.emissiveIntensity = 0.22 + THREE.MathUtils.clamp(state.highlightGlow, 0, 1) * 0.52;
  }

  // Initial sync
  updateGeometry(0, index);

  return {
    spec,
    root,
    swayPivot,
    headGroup,
    outerPetals,
    innerPetals,
    leafPivots,
    moundMesh,
    stemMesh,
    stemCurve,
    state,
    updateGeometry,
    dispose: () => {
      moundGeo.dispose();
      moundMat.dispose();
      stemGeo.dispose();
      stemMat.dispose();
      leafMat.dispose();
      petalAlbedo.dispose();
      petalMat.dispose();
      receptGeo.dispose();
      pistilMat.dispose();
      filamentMat.dispose();
      antherMat.dispose();
    },
  };
}
