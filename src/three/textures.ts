import * as THREE from 'three';
import type { ThreeTextureBundle, TulipShadeSpec } from './types';

function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureColorTex(tex: THREE.CanvasTexture, maxAniso: number, repeat = false): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

function configureDataTex(tex: THREE.CanvasTexture, maxAniso: number, repeat = false): THREE.CanvasTexture {
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = maxAniso;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates an organic botanical tulip petal albedo texture with:
 * - Throat color at the petal base
 * - Multi-stop vertical gradient to mid & rim tip
 * - Fine converging botanical veins from base to apex
 * - Subtle natural micro-mottling
 */
export function createPetalAlbedoTexture(spec: TulipShadeSpec, maxAniso: number): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const [canvas, ctx] = createCanvas(w, h);

  // Base vertical gradient (v=0 bottom in UV -> canvas y=h, v=1 top -> canvas y=0)
  const grad = ctx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0.0, spec.throatColor);
  grad.addColorStop(0.14, spec.baseColor);
  grad.addColorStop(0.58, spec.midColor);
  grad.addColorStop(0.92, spec.tipColor);
  grad.addColorStop(1.0, spec.tipColor);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Soft radial central keel sheen
  const keelGrad = ctx.createRadialGradient(w * 0.5, h * 0.65, 10, w * 0.5, h * 0.5, w * 0.45);
  keelGrad.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
  keelGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = keelGrad;
  ctx.fillRect(0, 0, w, h);

  // Delicate converging botanical veins
  ctx.save();
  ctx.strokeStyle = spec.veinColor;
  const veinCount = 26;
  for (let i = 0; i < veinCount; i++) {
    const t = (i / (veinCount - 1)) * 2 - 1; // -1 to 1
    const baseX = w * 0.5 + t * w * 0.14;
    const midX = w * 0.5 + t * w * 0.44;
    const tipX = w * 0.5 + t * w * 0.16;

    ctx.globalAlpha = 0.18 + (1 - Math.abs(t)) * 0.14;
    ctx.lineWidth = 1.2 + (1 - Math.abs(t)) * 1.1;

    ctx.beginPath();
    ctx.moveTo(baseX, h);
    ctx.bezierCurveTo(
      baseX + t * 28,
      h * 0.68,
      midX,
      h * 0.36,
      tipX,
      h * 0.02
    );
    ctx.stroke();

    // Secondary finer branching striation
    if (i % 2 === 0) {
      ctx.globalAlpha *= 0.6;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(baseX + 4, h * 0.9);
      ctx.quadraticCurveTo(midX + t * 14, h * 0.5, tipX + t * 8, h * 0.08);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Subtle translucent edge highlight along petal rim
  const edgeGrad = ctx.createLinearGradient(0, 0, w, 0);
  edgeGrad.addColorStop(0, 'rgba(255, 250, 252, 0.25)');
  edgeGrad.addColorStop(0.12, 'rgba(255, 250, 252, 0.0)');
  edgeGrad.addColorStop(0.88, 'rgba(255, 250, 252, 0.0)');
  edgeGrad.addColorStop(1, 'rgba(255, 250, 252, 0.25)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, w, h);

  return configureColorTex(new THREE.CanvasTexture(canvas), maxAniso);
}

function createPetalBumpTexture(maxAniso: number): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const [canvas, ctx] = createCanvas(w, h);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);

  // Longitudinal grooved petal ridges
  const ridges = 32;
  for (let i = 0; i < ridges; i++) {
    const t = (i / (ridges - 1)) * 2 - 1;
    const baseX = w * 0.5 + t * w * 0.14;
    const midX = w * 0.5 + t * w * 0.45;
    const tipX = w * 0.5 + t * w * 0.16;

    ctx.strokeStyle = i % 2 === 0 ? 'rgba(215,215,215,0.45)' : 'rgba(65,65,65,0.35)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(baseX, h);
    ctx.bezierCurveTo(baseX + t * 28, h * 0.68, midX, h * 0.36, tipX, h * 0.02);
    ctx.stroke();
  }

  return configureDataTex(new THREE.CanvasTexture(canvas), maxAniso);
}

function createLeafTextures(maxAniso: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const w = 512;
  const h = 512;
  const [cColor, ctxC] = createCanvas(w, h);
  const [cBump, ctxB] = createCanvas(w, h);

  const grad = ctxC.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, '#4a7a47');
  grad.addColorStop(0.35, '#5b9055');
  grad.addColorStop(0.8, '#6ca364');
  grad.addColorStop(1, '#7eb473');
  ctxC.fillStyle = grad;
  ctxC.fillRect(0, 0, w, h);

  ctxB.fillStyle = '#808080';
  ctxB.fillRect(0, 0, w, h);

  // Parallel botanical leaf veins
  for (let i = 0; i < 40; i++) {
    const x = (i / 39) * w;
    const distCenter = Math.abs(x - w * 0.5) / (w * 0.5);
    ctxC.strokeStyle = i === 20 ? 'rgba(185, 224, 168, 0.45)' : 'rgba(55, 95, 50, 0.25)';
    ctxC.lineWidth = i === 20 ? 4 : 1.4;
    ctxC.beginPath();
    ctxC.moveTo(w * 0.5 + (x - w * 0.5) * 0.35, h);
    ctxC.quadraticCurveTo(x, h * 0.5, w * 0.5 + (x - w * 0.5) * 0.15, 0);
    ctxC.stroke();

    ctxB.strokeStyle = i % 2 === 0 ? 'rgba(195,195,195,0.4)' : 'rgba(85,85,85,0.35)';
    ctxB.lineWidth = 2.0 - distCenter * 0.8;
    ctxB.beginPath();
    ctxB.moveTo(w * 0.5 + (x - w * 0.5) * 0.35, h);
    ctxB.quadraticCurveTo(x, h * 0.5, w * 0.5 + (x - w * 0.5) * 0.15, 0);
    ctxB.stroke();
  }

  // Soft glaucous wax bloom on tulip leaves
  const wax = ctxC.createRadialGradient(w * 0.5, h * 0.5, 20, w * 0.5, h * 0.5, w * 0.55);
  wax.addColorStop(0, 'rgba(210, 232, 208, 0.14)');
  wax.addColorStop(1, 'rgba(210, 232, 208, 0.0)');
  ctxC.fillStyle = wax;
  ctxC.fillRect(0, 0, w, h);

  return [
    configureColorTex(new THREE.CanvasTexture(cColor), maxAniso),
    configureDataTex(new THREE.CanvasTexture(cBump), maxAniso),
  ];
}

function createPlushFurTextures(
  baseHex: string,
  highlightHex: string,
  shadowHex: string,
  maxAniso: number
): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const size = 512;
  const [cColor, ctxC] = createCanvas(size, size);
  const [cBump, ctxB] = createCanvas(size, size);

  ctxC.fillStyle = baseHex;
  ctxC.fillRect(0, 0, size, size);

  ctxB.fillStyle = '#757575';
  ctxB.fillRect(0, 0, size, size);

  // Deterministic pseudo-random for consistent rich curly plush pile
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Draw thousands of soft curled plush tufts
  const tuftCount = 6500;
  for (let i = 0; i < tuftCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 2.5 + rand() * 5.0;
    const startA = rand() * Math.PI * 2;
    const sweep = 1.2 + rand() * 2.2;
    const isLight = rand() > 0.42;

    ctxC.strokeStyle = isLight ? highlightHex : shadowHex;
    ctxC.globalAlpha = 0.22 + rand() * 0.28;
    ctxC.lineWidth = 1.3 + rand() * 1.4;
    ctxC.lineCap = 'round';
    ctxC.beginPath();
    ctxC.arc(x, y, r, startA, startA + sweep);
    ctxC.stroke();

    // Wrap around seams for seamless tiling
    if (x < 10 || x > size - 10 || y < 10 || y > size - 10) {
      const ox = x < 10 ? x + size : x > size - 10 ? x - size : x;
      const oy = y < 10 ? y + size : y > size - 10 ? y - size : y;
      ctxC.beginPath();
      ctxC.arc(ox, oy, r, startA, startA + sweep);
      ctxC.stroke();
    }

    ctxB.strokeStyle = isLight ? 'rgba(235,235,235,0.55)' : 'rgba(55,55,55,0.45)';
    ctxB.lineWidth = 1.6 + rand() * 1.6;
    ctxB.lineCap = 'round';
    ctxB.beginPath();
    ctxB.arc(x, y, r, startA, startA + sweep);
    ctxB.stroke();
  }
  ctxC.globalAlpha = 1;

  const colTex = configureColorTex(new THREE.CanvasTexture(cColor), maxAniso, true);
  colTex.repeat.set(3, 3);
  const bumpTex = configureDataTex(new THREE.CanvasTexture(cBump), maxAniso, true);
  bumpTex.repeat.set(3, 3);
  return [colTex, bumpTex];
}

function createPaperTextures(maxAniso: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const size = 512;
  const [cColor, ctxC] = createCanvas(size, size);
  const [cBump, ctxB] = createCanvas(size, size);

  // Soft ivory-blush florist wrapping paper with subtle rose-gold border trim
  const grad = ctxC.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#fff7f9');
  grad.addColorStop(0.5, '#fde8ef');
  grad.addColorStop(1, '#f8d8e3');
  ctxC.fillStyle = grad;
  ctxC.fillRect(0, 0, size, size);

  // Delicate rose-gold top edge trim
  ctxC.fillStyle = '#e4b7a0';
  ctxC.fillRect(0, 0, size, 10);
  ctxC.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctxC.fillRect(0, 10, size, 4);

  ctxB.fillStyle = '#808080';
  ctxB.fillRect(0, 0, size, size);

  // Fine linen-paper crosshatch fibers
  ctxC.strokeStyle = 'rgba(220, 185, 195, 0.16)';
  ctxB.strokeStyle = 'rgba(165, 165, 165, 0.25)';
  ctxC.lineWidth = 1;
  ctxB.lineWidth = 1;
  for (let i = 0; i < size; i += 6) {
    ctxC.beginPath();
    ctxC.moveTo(i, 0);
    ctxC.lineTo(i, size);
    ctxC.stroke();
    ctxC.beginPath();
    ctxC.moveTo(0, i);
    ctxC.lineTo(size, i);
    ctxC.stroke();

    ctxB.beginPath();
    ctxB.moveTo(i, 0);
    ctxB.lineTo(i, size);
    ctxB.stroke();
    ctxB.beginPath();
    ctxB.moveTo(0, i);
    ctxB.lineTo(size, i);
    ctxB.stroke();
  }

  return [
    configureColorTex(new THREE.CanvasTexture(cColor), maxAniso),
    configureDataTex(new THREE.CanvasTexture(cBump), maxAniso),
  ];
}

function createSatinTexture(maxAniso: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = createCanvas(size, size);
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#cf6a8b');
  grad.addColorStop(0.25, '#e88aa9');
  grad.addColorStop(0.5, '#f4a7c1');
  grad.addColorStop(0.75, '#e88aa9');
  grad.addColorStop(1, '#c45b7d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Fine horizontal satin threads
  ctx.strokeStyle = 'rgba(255, 235, 242, 0.22)';
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Rose-gold stitched edge piping
  ctx.fillStyle = 'rgba(246, 214, 194, 0.65)';
  ctx.fillRect(0, 4, size, 3);
  ctx.fillRect(0, size - 7, size, 3);

  return configureColorTex(new THREE.CanvasTexture(canvas), maxAniso, true);
}

function createFloorTextures(maxAniso: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const size = 512;
  const [cColor, ctxC] = createCanvas(size, size);
  const [cRough, ctxR] = createCanvas(size, size);

  ctxC.fillStyle = '#faeef3';
  ctxC.fillRect(0, 0, size, size);

  ctxR.fillStyle = '#484848'; // Smooth reflective polish
  ctxR.fillRect(0, 0, size, size);

  // Soft rose-quartz marble clouds & veins
  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 24; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = 60 + rand() * 140;
    const g = ctxC.createRadialGradient(cx, cy, 4, cx, cy, r);
    g.addColorStop(0, 'rgba(245, 214, 226, 0.26)');
    g.addColorStop(1, 'rgba(250, 238, 243, 0)');
    ctxC.fillStyle = g;
    ctxC.fillRect(0, 0, size, size);

    const gr = ctxR.createRadialGradient(cx, cy, 4, cx, cy, r);
    gr.addColorStop(0, 'rgba(95, 95, 95, 0.22)');
    gr.addColorStop(1, 'rgba(72, 72, 72, 0)');
    ctxR.fillStyle = gr;
    ctxR.fillRect(0, 0, size, size);
  }

  for (let v = 0; v < 14; v++) {
    ctxC.strokeStyle = 'rgba(229, 193, 206, 0.28)';
    ctxC.lineWidth = 0.8 + rand() * 1.4;
    ctxC.beginPath();
    let x = rand() * size;
    let y = rand() * size;
    ctxC.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rand() - 0.3) * 90;
      y += (rand() - 0.5) * 60;
      ctxC.lineTo(x, y);
    }
    ctxC.stroke();
  }

  const colTex = configureColorTex(new THREE.CanvasTexture(cColor), maxAniso, true);
  colTex.repeat.set(4, 4);
  const roughTex = configureDataTex(new THREE.CanvasTexture(cRough), maxAniso, true);
  roughTex.repeat.set(4, 4);
  return [colTex, roughTex];
}

function createGiftTagTexture(maxAniso: number): {
  texture: THREE.CanvasTexture;
  updateTagName: (recipientName: string) => void;
} {
  const w = 256;
  const h = 384;
  const [canvas, ctx] = createCanvas(w, h);
  const texture = configureColorTex(new THREE.CanvasTexture(canvas), maxAniso);

  const updateTagName = (recipientName: string) => {
    const cleanName = (recipientName.trim() || 'Ammu').slice(0, 14);
    ctx.fillStyle = '#fff8fa';
    ctx.fillRect(0, 0, w, h);

    // Subtle rose-gold double frame border
    ctx.strokeStyle = '#d9a492';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    // Small brass eyelet hole at top
    ctx.fillStyle = '#d9a492';
    ctx.beginPath();
    ctx.arc(w / 2, 50, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8fa';
    ctx.beginPath();
    ctx.arc(w / 2, 50, 6, 0, Math.PI * 2);
    ctx.fill();

    // Handwritten-style inscription
    ctx.fillStyle = '#73314b';
    ctx.textAlign = 'center';
    ctx.font = 'italic 600 38px Georgia, serif';
    ctx.fillText('For', w / 2, 165);
    const fontSize = cleanName.length > 9 ? 36 : cleanName.length > 6 ? 42 : 48;
    ctx.font = `italic 600 ${fontSize}px Georgia, serif`;
    ctx.fillText(cleanName, w / 2, 225);

    // Little rose heart emblem
    ctx.fillStyle = '#d85c87';
    ctx.font = '42px Georgia, serif';
    ctx.fillText('♡', w / 2, 295);

    texture.needsUpdate = true;
  };

  updateTagName('Ammu');
  return { texture, updateTagName };
}

function createRadialSprite(inner: string, mid: string, outer: string): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = createCanvas(size, size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.45, mid);
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createTextureBundle(renderer: THREE.WebGLRenderer): ThreeTextureBundle {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const petalBump = createPetalBumpTexture(maxAniso);
  const [leafMap, leafBump] = createLeafTextures(maxAniso);
  const [furMap, furBump] = createPlushFurTextures('#e2c09f', '#f7e6d4', '#c59d7a', maxAniso);
  const [creamPatchMap] = createPlushFurTextures('#f8ece0', '#fff8f2', '#e4d0bc', maxAniso);
  const [paperMap, paperBump] = createPaperTextures(maxAniso);
  const satinMap = createSatinTexture(maxAniso);
  const { texture: tagMap, updateTagName } = createGiftTagTexture(maxAniso);
  const [floorMap, floorRoughness] = createFloorTextures(maxAniso);

  const shadowSprite = createRadialSprite(
    'rgba(105, 55, 75, 0.58)',
    'rgba(120, 70, 90, 0.22)',
    'rgba(120, 70, 90, 0.0)'
  );
  const sparkleSprite = createRadialSprite(
    'rgba(255, 250, 245, 1.0)',
    'rgba(255, 210, 228, 0.55)',
    'rgba(255, 200, 220, 0.0)'
  );

  return {
    petalBump,
    leafMap,
    leafBump,
    furMap,
    furBump,
    creamPatchMap,
    paperMap,
    paperBump,
    satinMap,
    tagMap,
    updateTagName,
    floorMap,
    floorRoughness,
    shadowSprite,
    sparkleSprite,
    dispose: () => {
      petalBump.dispose();
      leafMap.dispose();
      leafBump.dispose();
      furMap.dispose();
      furBump.dispose();
      creamPatchMap.dispose();
      paperMap.dispose();
      paperBump.dispose();
      satinMap.dispose();
      tagMap.dispose();
      floorMap.dispose();
      floorRoughness.dispose();
      shadowSprite.dispose();
      sparkleSprite.dispose();
    },
  };
}
