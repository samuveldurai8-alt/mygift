import * as THREE from 'three';
import { createTulip, createTulipLeafGeometry, createTulipPetalGeometry, type TulipInstance } from './tulipBuilder';
import { TULIP_SHADES, type ThreeTextureBundle, type WrapperPaletteSpec } from './types';

export interface BouquetRig {
  /** Root container for the entire bouquet (positioned on left in final scene) */
  bouquetGroup: THREE.Group;
  /** Container for the 7 tulips (starts in world origin during garden phase, transfers or aligns smoothly) */
  tulips: TulipInstance[];
  wrapGroup: THREE.Group;
  ribbonGroup: THREE.Group;
  paperPanels: {
    mesh: THREE.Mesh;
    geometry: THREE.BufferGeometry;
    basePositions: Float32Array;
    openPositions: Float32Array;
  }[];
  bowLoops: THREE.Mesh[];
  bowKnot: THREE.Mesh;
  bowTails: THREE.Mesh[];
  waistBand: THREE.Mesh;
  tissueRuffle: THREE.Mesh;
  fillerGroup: THREE.Group;
  giftTagGroup: THREE.Group;
  state: {
    wrapRise: number; // 0 -> 1
    wrapFold: number; // 0 -> 1 (0 = wide open, 1 = snugly wrapped)
    wrapOpacity: number; // 0 -> 1
    ribbonScale: number; // 0 -> 1
    bowTighten: number; // 0 -> 1
    fillerScale: number; // 0 -> 1
  };
  updateWrapping: () => void;
  setPalette: (palette: WrapperPaletteSpec) => void;
  dispose: () => void;
}

interface PaperPanelSpec {
  thetaCenter: number;
  thetaSpan: number;
  topY: number;
  bottomY: number;
  topRadiusClosed: number;
  topRadiusOpen: number;
  waistRadiusClosed: number;
  bottomRadiusClosed: number;
  pleatCount: number;
  pleatDepth: number;
  vDipCenter?: number;
}

function createCurvedPaperPanel(spec: PaperPanelSpec): {
  geometry: THREE.BufferGeometry;
  basePositions: Float32Array;
  openPositions: Float32Array;
} {
  const segU = 18;
  const segV = 18;
  const cols = segU + 1;
  const rows = segV + 1;
  const count = cols * rows;

  const positions = new Float32Array(count * 3);
  const openPositions = new Float32Array(count * 3);
  const basePositions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const indices: number[] = [];

  const waistV = 0.48; // normalized height where ribbon cinches

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV; // 0 = bottom skirt, 1 = upper collar
    for (let iu = 0; iu <= segU; iu++) {
      const uNorm = iu / segU;
      const u = uNorm * 2 - 1; // -1..1
      const theta = spec.thetaCenter + u * (spec.thetaSpan * 0.5);

      // Optional elegant front V-notch dip
      const centerDip = spec.vDipCenter ? (1 - u * u) * spec.vDipCenter : 0;
      const effectiveTopY = spec.topY - centerDip;
      const y = THREE.MathUtils.lerp(spec.bottomY, effectiveTopY, v);

      // Graceful hourglass florist cone profile (cinched at waistV)
      let rClosed: number;
      if (v < waistV) {
        const tv = v / waistV;
        rClosed = THREE.MathUtils.lerp(spec.bottomRadiusClosed, spec.waistRadiusClosed, Math.pow(tv, 0.85));
      } else {
        const tv = (v - waistV) / (1 - waistV);
        rClosed = THREE.MathUtils.lerp(spec.waistRadiusClosed, spec.topRadiusClosed, Math.pow(tv, 1.15));
      }

      // Organic fluted paper pleats near the top edge
      const pleatEnv = Math.pow(v, 1.4);
      const pleat = Math.sin(uNorm * Math.PI * spec.pleatCount) * spec.pleatDepth * pleatEnv;
      // Slight rounded corner taper at edges of sheet
      const cornerLift = (u * u) * 0.04 * (1 - v);

      const rc = rClosed + pleat;
      const ro = THREE.MathUtils.lerp(spec.bottomRadiusClosed + 0.35, spec.topRadiusOpen, v) + pleat * 0.5;

      const idx = iv * cols + iu;
      basePositions[idx * 3] = Math.sin(theta) * rc;
      basePositions[idx * 3 + 1] = y + cornerLift;
      basePositions[idx * 3 + 2] = Math.cos(theta) * rc;

      openPositions[idx * 3] = Math.sin(theta) * ro;
      openPositions[idx * 3 + 1] = y - 0.15 + cornerLift;
      openPositions[idx * 3 + 2] = Math.cos(theta) * ro;

      positions[idx * 3] = openPositions[idx * 3];
      positions[idx * 3 + 1] = openPositions[idx * 3 + 1];
      positions[idx * 3 + 2] = openPositions[idx * 3 + 2];

      uvs[idx * 2] = uNorm;
      uvs[idx * 2 + 1] = 1 - v; // top border trim at v=1
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * cols + iu;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { geometry, basePositions, openPositions };
}

function createBowLoopGeometry(side: 1 | -1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.13, 0.085, 0.045),
      new THREE.Vector3(side * 0.24, 0.045, 0.02),
      new THREE.Vector3(side * 0.21, -0.055, -0.01),
      new THREE.Vector3(side * 0.08, -0.035, 0.01),
      new THREE.Vector3(0, 0, 0),
    ],
    true
  );
  const geo = new THREE.TubeGeometry(curve, 36, 0.036, 12, true);
  // Flatten slightly along Z so it reads like wide pinched satin ribbon
  geo.scale(1.0, 1.15, 0.48);
  return geo;
}

function createRibbonTailGeometry(side: 1 | -1): THREE.BufferGeometry {
  const segU = 6;
  const segV = 18;
  const cols = segU + 1;
  const rows = segV + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const indices: number[] = [];

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV; // 0 = top knot, 1 = bottom notched tip
    const width = THREE.MathUtils.lerp(0.028, 0.052, Math.pow(v, 0.7));
    const cx = side * (0.04 + Math.pow(v, 1.15) * 0.22 + Math.sin(v * Math.PI) * 0.03);
    const cz = 0.03 + Math.sin(v * Math.PI * 1.3) * 0.045;

    for (let iu = 0; iu <= segU; iu++) {
      const uNorm = iu / segU;
      const u = uNorm * 2 - 1;
      // Classic swallowtail V-notch at bottom tip
      const notch = v > 0.85 ? (1 - Math.abs(u)) * 0.055 * ((v - 0.85) / 0.15) : 0;
      const y = -v * 0.62 + notch;
      const x = cx + u * width;
      const z = cz + Math.cos(u * 1.4) * 0.008;

      const idx = iv * cols + iu;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;
      uvs[idx * 2] = uNorm;
      uvs[idx * 2 + 1] = v;
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * cols + iu;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, d, a, d, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createBouquetRig(
  textures: ThreeTextureBundle,
  maxAniso: number
): BouquetRig {
  const bouquetGroup = new THREE.Group();

  // Shared botanical geometries across the 7 tulips
  const sharedPetalGeo = createTulipPetalGeometry();
  const sharedLeafGeo = createTulipLeafGeometry(0.95, 0.165);

  const tulips = TULIP_SHADES.map((spec, idx) => {
    const t = createTulip(spec, idx, sharedPetalGeo, sharedLeafGeo, textures, maxAniso);
    bouquetGroup.add(t.root);
    return t;
  });

  // Wrapping Paper Group
  const wrapGroup = new THREE.Group();
  bouquetGroup.add(wrapGroup);

  const paperMat = new THREE.MeshPhysicalMaterial({
    map: textures.paperMap,
    bumpMap: textures.paperBump,
    bumpScale: 0.009,
    roughness: 0.56,
    metalness: 0.02,
    sheen: 0.45,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#fff5f8'),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  });

  // Back, left-back, right-back, left-front, right-front layered wrapping sheets
  // Heights stay strictly below y=1.96 while blooms sit at y=2.15..2.85!
  const panelSpecs: PaperPanelSpec[] = [
    // Tall back collar framing behind blooms
    {
      thetaCenter: Math.PI,
      thetaSpan: Math.PI * 0.92,
      topY: 1.94,
      bottomY: 0.14,
      topRadiusClosed: 0.64,
      topRadiusOpen: 1.15,
      waistRadiusClosed: 0.255,
      bottomRadiusClosed: 0.34,
      pleatCount: 5,
      pleatDepth: 0.032,
    },
    // Left flank pleated sheet
    {
      thetaCenter: -Math.PI * 0.56,
      thetaSpan: Math.PI * 0.68,
      topY: 1.72,
      bottomY: 0.16,
      topRadiusClosed: 0.58,
      topRadiusOpen: 1.05,
      waistRadiusClosed: 0.245,
      bottomRadiusClosed: 0.33,
      pleatCount: 4,
      pleatDepth: 0.026,
    },
    // Right flank pleated sheet
    {
      thetaCenter: Math.PI * 0.56,
      thetaSpan: Math.PI * 0.68,
      topY: 1.72,
      bottomY: 0.16,
      topRadiusClosed: 0.58,
      topRadiusOpen: 1.05,
      waistRadiusClosed: 0.245,
      bottomRadiusClosed: 0.33,
      pleatCount: 4,
      pleatDepth: 0.026,
    },
    // Front sweetheart V-neck collar (lower at center front so stems & blooms shine)
    {
      thetaCenter: 0,
      thetaSpan: Math.PI * 0.88,
      topY: 1.48,
      bottomY: 0.18,
      topRadiusClosed: 0.49,
      topRadiusOpen: 0.98,
      waistRadiusClosed: 0.265,
      bottomRadiusClosed: 0.36,
      pleatCount: 3,
      pleatDepth: 0.02,
      vDipCenter: 0.28,
    },
  ];

  const paperPanels = panelSpecs.map((spec) => {
    const built = createCurvedPaperPanel(spec);
    const mesh = new THREE.Mesh(built.geometry, paperMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    wrapGroup.add(mesh);
    return {
      mesh,
      ...built,
    };
  });

  // Soft translucent inner blush tissue ruffle nestled around stems at y=1.35
  const tissueGeo = new THREE.CylinderGeometry(0.42, 0.21, 0.55, 28, 4, true);
  // Add gentle organic wave around top edge of inner tissue
  const tPos = tissueGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tPos.count; i++) {
    const y = tPos.getY(i);
    if (y > 0) {
      const x = tPos.getX(i);
      const z = tPos.getZ(i);
      const a = Math.atan2(z, x);
      const ruffle = Math.sin(a * 9) * 0.035;
      tPos.setX(i, x * (1 + ruffle));
      tPos.setZ(i, z * (1 + ruffle));
      tPos.setY(i, y + Math.cos(a * 7) * 0.04);
    }
  }
  tissueGeo.computeVertexNormals();
  const tissueMat = new THREE.MeshPhysicalMaterial({
    color: 0xffd9e6,
    roughness: 0.72,
    sheen: 0.6,
    sheenColor: new THREE.Color('#ffffff'),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  });
  const tissueRuffle = new THREE.Mesh(tissueGeo, tissueMat);
  tissueRuffle.position.y = 1.38;
  wrapGroup.add(tissueRuffle);

  // Satin Ribbon & Sculpted Bow Group at waist (y = 1.02)
  const ribbonGroup = new THREE.Group();
  ribbonGroup.position.set(0, 1.02, 0);
  bouquetGroup.add(ribbonGroup);

  const satinMat = new THREE.MeshPhysicalMaterial({
    map: textures.satinMap,
    color: 0xffffff,
    roughness: 0.26,
    metalness: 0.08,
    sheen: 0.9,
    sheenRoughness: 0.28,
    sheenColor: new THREE.Color('#ffd6e4'),
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
    side: THREE.DoubleSide,
  });

  const waistBandGeo = new THREE.CylinderGeometry(0.275, 0.278, 0.095, 36, 1, true);
  const waistBand = new THREE.Mesh(waistBandGeo, satinMat);
  waistBand.castShadow = true;
  ribbonGroup.add(waistBand);

  const bowCluster = new THREE.Group();
  bowCluster.position.set(0, 0, 0.27);
  ribbonGroup.add(bowCluster);

  const leftLoopGeo = createBowLoopGeometry(-1);
  const rightLoopGeo = createBowLoopGeometry(1);
  const leftLoop = new THREE.Mesh(leftLoopGeo, satinMat);
  const rightLoop = new THREE.Mesh(rightLoopGeo, satinMat);
  leftLoop.castShadow = true;
  rightLoop.castShadow = true;
  bowCluster.add(leftLoop, rightLoop);

  const knotGeo = new THREE.SphereGeometry(0.052, 20, 16);
  knotGeo.scale(1.15, 0.92, 0.85);
  const bowKnot = new THREE.Mesh(knotGeo, satinMat);
  bowKnot.position.set(0, 0, 0.022);
  bowKnot.castShadow = true;
  bowCluster.add(bowKnot);

  const leftTailGeo = createRibbonTailGeometry(-1);
  const rightTailGeo = createRibbonTailGeometry(1);
  const leftTail = new THREE.Mesh(leftTailGeo, satinMat);
  const rightTail = new THREE.Mesh(rightTailGeo, satinMat);
  leftTail.castShadow = true;
  rightTail.castShadow = true;
  bowCluster.add(leftTail, rightTail);

  // Hanging "For Ammu ♡" Keepsake Gift Tag attached to bow knot
  const giftTagGroup = new THREE.Group();
  giftTagGroup.position.set(0.06, -0.04, 0.045);
  giftTagGroup.rotation.z = -0.14;
  bowCluster.add(giftTagGroup);

  const cordMat = new THREE.MeshStandardMaterial({
    color: 0xe2b19a,
    roughness: 0.35,
    metalness: 0.45,
  });
  const cordGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.12, 8);
  const cordMesh = new THREE.Mesh(cordGeo, cordMat);
  cordMesh.position.y = -0.05;
  giftTagGroup.add(cordMesh);

  const tagCardGeo = new THREE.BoxGeometry(0.16, 0.24, 0.008);
  const tagCardMat = new THREE.MeshPhysicalMaterial({
    map: textures.tagMap,
    roughness: 0.42,
    metalness: 0.05,
    clearcoat: 0.2,
  });
  const tagCard = new THREE.Mesh(tagCardGeo, tagCardMat);
  tagCard.position.set(0, -0.21, 0);
  tagCard.castShadow = true;
  giftTagGroup.add(tagCard);

  // Delicate Baby's Breath (Gypsophila) & Sage Foliage Filler Sprigs between tulips
  const fillerGroup = new THREE.Group();
  bouquetGroup.add(fillerGroup);

  const fillerStemGeo = new THREE.CylinderGeometry(0.008, 0.011, 1.05, 6);
  const fillerStemMat = new THREE.MeshStandardMaterial({
    color: 0x6b9467,
    roughness: 0.6,
  });
  const gypsoBlossomGeo = new THREE.SphereGeometry(0.028, 10, 8);
  const gypsoBlossomMat = new THREE.MeshPhysicalMaterial({
    color: 0xfffaf8,
    roughness: 0.45,
    sheen: 0.8,
    sheenColor: new THREE.Color('#ffe8f0'),
    emissive: new THREE.Color('#3b2830'),
    emissiveIntensity: 0.12,
  });

  const sprigPositions: [number, number, number, number, number][] = [
    [-0.24, 1.55, 0.26, 0.28, 0.24],
    [0.24, 1.54, 0.26, 0.26, -0.24],
    [-0.38, 1.48, -0.14, -0.18, 0.36],
    [0.38, 1.48, -0.12, -0.16, -0.35],
    [0.0, 1.62, -0.34, -0.32, 0.02],
    [0.02, 1.42, 0.34, 0.35, -0.02],
  ];

  const sprigMeshes: THREE.Object3D[] = [];
  sprigPositions.forEach(([sx, sy, sz, rx, rz], idx) => {
    const sprig = new THREE.Group();
    sprig.position.set(sx, sy, sz);
    sprig.rotation.set(rx, idx * 0.8, rz);

    const stem = new THREE.Mesh(fillerStemGeo, fillerStemMat);
    stem.position.y = -0.1;
    sprig.add(stem);

    // 7 tiny pearl-white baby's breath clusters at branch tips
    for (let b = 0; b < 7; b++) {
      const a = (b / 7) * Math.PI * 2;
      const rad = b === 0 ? 0 : 0.075 + (b % 2) * 0.035;
      const by = 0.42 + (b % 3) * 0.075;
      const blossom = new THREE.Mesh(gypsoBlossomGeo, gypsoBlossomMat);
      blossom.position.set(Math.cos(a) * rad, by, Math.sin(a) * rad);
      blossom.scale.setScalar(0.8 + (b % 3) * 0.2);
      sprig.add(blossom);
    }

    fillerGroup.add(sprig);
    sprigMeshes.push(sprig);
  });

  const state = {
    wrapRise: 0,
    wrapFold: 0,
    wrapOpacity: 0,
    ribbonScale: 0,
    bowTighten: 0,
    fillerScale: 0,
  };

  function updateWrapping() {
    wrapGroup.visible = state.wrapOpacity > 0.01;
    wrapGroup.position.y = THREE.MathUtils.lerp(-0.55, 0, state.wrapRise);
    paperMat.opacity = state.wrapOpacity;
    tissueMat.opacity = state.wrapOpacity * 0.88;

    const fold = THREE.MathUtils.clamp(state.wrapFold, 0, 1);
    for (let p = 0; p < paperPanels.length; p++) {
      const panel = paperPanels[p];
      const posAttr = panel.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i++) {
        arr[i] = THREE.MathUtils.lerp(panel.openPositions[i], panel.basePositions[i], fold);
      }
      posAttr.needsUpdate = true;
      panel.geometry.computeVertexNormals();
    }

    const fs = THREE.MathUtils.clamp(state.fillerScale, 0, 1);
    fillerGroup.visible = fs > 0.01;
    fillerGroup.scale.setScalar(fs);

    const rs = THREE.MathUtils.clamp(state.ribbonScale, 0, 1);
    const bt = THREE.MathUtils.clamp(state.bowTighten, 0, 1);

    ribbonGroup.visible = rs > 0.01;
    // Waistband starts slightly wider and cinches tight
    const bandRadiusScale = THREE.MathUtils.lerp(1.38, 1.0, bt);
    waistBand.scale.set(bandRadiusScale, rs, bandRadiusScale);

    // Bow loops & tails bloom outward and cinch crisp
    bowCluster.position.z = 0.275 * bandRadiusScale;
    const loopSpread = THREE.MathUtils.lerp(0.1, 1.0, bt);
    leftLoop.scale.set(loopSpread, rs, rs);
    rightLoop.scale.set(loopSpread, rs, rs);
    bowKnot.scale.setScalar(rs * (0.7 + 0.3 * bt));
    leftTail.scale.set(rs, rs, rs);
    rightTail.scale.set(rs, rs, rs);
    giftTagGroup.scale.setScalar(bt);
    giftTagGroup.visible = bt > 0.05;
  }

  function setPalette(palette: WrapperPaletteSpec) {
    paperMat.color.set(palette.paperTint);
    tissueMat.color.set(palette.tissueTint);
    satinMat.color.set(palette.ribbonTint);
    satinMat.sheenColor.set(palette.swatchHex);
  }

  updateWrapping();

  return {
    bouquetGroup,
    tulips,
    wrapGroup,
    ribbonGroup,
    paperPanels,
    bowLoops: [leftLoop, rightLoop],
    bowKnot,
    bowTails: [leftTail, rightTail],
    waistBand,
    tissueRuffle,
    fillerGroup,
    giftTagGroup,
    state,
    updateWrapping,
    setPalette,
    dispose: () => {
      sharedPetalGeo.dispose();
      sharedLeafGeo.dispose();
      tulips.forEach((t) => t.dispose());
      paperMat.dispose();
      tissueGeo.dispose();
      tissueMat.dispose();
      satinMat.dispose();
      waistBandGeo.dispose();
      leftLoopGeo.dispose();
      rightLoopGeo.dispose();
      knotGeo.dispose();
      leftTailGeo.dispose();
      rightTailGeo.dispose();
      cordGeo.dispose();
      cordMat.dispose();
      tagCardGeo.dispose();
      tagCardMat.dispose();
      fillerStemGeo.dispose();
      fillerStemMat.dispose();
      gypsoBlossomGeo.dispose();
      gypsoBlossomMat.dispose();
      paperPanels.forEach((p) => p.geometry.dispose());
    },
  };
}
