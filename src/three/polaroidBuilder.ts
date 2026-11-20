import * as THREE from 'three';
import type { PolaroidMemorySpec } from './types';

export interface PolaroidFrameItem {
  index: number;
  root: THREE.Group;
  hitMesh: THREE.Mesh;
  spec: PolaroidMemorySpec;
}

export interface PolaroidGalleryRig {
  group: THREE.Group;
  frames: PolaroidFrameItem[];
  state: {
    visibleScale: number;
  };
  setMemory: (index: number, caption: string, imageDataUrl?: string) => void;
  update: (elapsed: number) => void;
  dispose: () => void;
}

export const DEFAULT_POLAROID_MEMORIES: PolaroidMemorySpec[] = [
  { id: 'mem-1', caption: 'Our Little Garden ♡' },
  { id: 'mem-2', caption: 'Two Hearts, One Story' },
  { id: 'mem-3', caption: 'Always & Forever ✨' },
];

function paintDefaultIllustration(
  ctx: CanvasRenderingContext2D,
  index: number,
  w: number,
  h: number
) {
  if (index === 0) {
    // Pastel floral sunrise illustration
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#ffd1e3');
    bg.addColorStop(0.65, '#ffe8d6');
    bg.addColorStop(1, '#f8c8dc');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Soft glowing sun
    const sun = ctx.createRadialGradient(w * 0.5, h * 0.42, 12, w * 0.5, h * 0.42, 130);
    sun.addColorStop(0, 'rgba(255, 250, 224, 0.95)');
    sun.addColorStop(1, 'rgba(255, 220, 200, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    // Three tulip silhouettes
    const tulips = [
      { x: w * 0.32, y: h * 0.44, col: '#e85d8a' },
      { x: w * 0.5, y: h * 0.34, col: '#d43368' },
      { x: w * 0.68, y: h * 0.46, col: '#f58ea8' },
    ];
    tulips.forEach((t) => {
      ctx.strokeStyle = '#5e8c61';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(t.x, h);
      ctx.quadraticCurveTo(t.x + 6, (t.y + h) * 0.5, t.x, t.y + 30);
      ctx.stroke();

      ctx.fillStyle = t.col;
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, 26, 36, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (index === 1) {
    // Romantic twin hearts under twilight sky
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#784b7a');
    bg.addColorStop(0.55, '#c96f8f');
    bg.addColorStop(1, '#f7b2be');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Tiny stars
    ctx.fillStyle = 'rgba(255, 248, 220, 0.85)';
    for (let i = 0; i < 24; i++) {
      const sx = ((i * 89) % (w - 40)) + 20;
      const sy = ((i * 53) % (h * 0.55)) + 16;
      ctx.beginPath();
      ctx.arc(sx, sy, (i % 3) + 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const drawHeart = (cx: number, cy: number, s: number, col: string) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.bezierCurveTo(30, -4, 32, -26, 14, -28);
      ctx.bezierCurveTo(4, -30, 0, -18, 0, -14);
      ctx.bezierCurveTo(0, -18, -4, -30, -14, -28);
      ctx.bezierCurveTo(-32, -26, -30, -4, 0, 22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    drawHeart(w * 0.42, h * 0.54, 2.2, '#ffd4e2');
    drawHeart(w * 0.58, h * 0.46, 2.2, '#ff6b98');
  } else {
    // Warm golden wish lanterns illustration
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#36234d');
    bg.addColorStop(0.6, '#7b436e');
    bg.addColorStop(1, '#e8909c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const lanterns = [
      [w * 0.28, h * 0.46, 22],
      [w * 0.52, h * 0.32, 28],
      [w * 0.72, h * 0.55, 19],
    ];
    lanterns.forEach(([lx, ly, lr]) => {
      const glow = ctx.createRadialGradient(lx, ly, 4, lx, ly, lr * 2.4);
      glow.addColorStop(0, 'rgba(255, 224, 140, 0.9)');
      glow.addColorStop(1, 'rgba(255, 160, 100, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lx, ly, lr * 2.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffcf70';
      ctx.beginPath();
      ctx.roundRect(lx - lr * 0.65, ly - lr * 0.85, lr * 1.3, lr * 1.65, 8);
      ctx.fill();
    });
  }
}

function drawPolaroidCanvas(
  canvas: HTMLCanvasElement,
  index: number,
  caption: string,
  img?: HTMLImageElement
) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;

  // Warm cream Polaroid cardstock
  ctx.fillStyle = '#fffcf9';
  ctx.fillRect(0, 0, w, h);

  // Subtle paper frame border
  ctx.strokeStyle = '#ecdbe1';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);

  const padX = 28;
  const padTop = 28;
  const photoW = w - padX * 2;
  const photoH = h - padTop - 98;

  ctx.save();
  ctx.beginPath();
  ctx.rect(padX, padTop, photoW, photoH);
  ctx.clip();

  if (img) {
    // Cover-fit user image into square/portrait photo window
    const imgRatio = img.width / Math.max(img.height, 1);
    const boxRatio = photoW / photoH;
    let drawW = photoW;
    let drawH = photoH;
    let dx = padX;
    let dy = padTop;
    if (imgRatio > boxRatio) {
      drawH = photoH;
      drawW = photoH * imgRatio;
      dx = padX - (drawW - photoW) * 0.5;
    } else {
      drawW = photoW;
      drawH = photoW / imgRatio;
      dy = padTop - (drawH - photoH) * 0.5;
    }
    ctx.drawImage(img, dx, dy, drawW, drawH);
  } else {
    ctx.translate(padX, padTop);
    paintDefaultIllustration(ctx, index, photoW, photoH);
  }
  ctx.restore();

  // Inner photo border shadow
  ctx.strokeStyle = 'rgba(110, 56, 77, 0.14)';
  ctx.lineWidth = 3;
  ctx.strokeRect(padX, padTop, photoW, photoH);

  // Handwritten caption along bottom Polaroid margin
  ctx.fillStyle = '#6e324a';
  ctx.font = 'italic 600 32px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const trimmed = (caption || DEFAULT_POLAROID_MEMORIES[index].caption).slice(0, 26);
  ctx.fillText(trimmed, w / 2, h - 49);
}

export function createPolaroidGallery(maxAniso = 4): PolaroidGalleryRig {
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const group = new THREE.Group();

  const cardGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.39, 0.014));
  const faceGeo = trackGeo(new THREE.PlaneGeometry(0.308, 0.378));
  const standGeo = trackGeo(new THREE.CylinderGeometry(0.006, 0.006, 0.24, 8));

  const cardBackMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xfff8f5,
      roughness: 0.72,
    })
  );
  const roseGoldMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdca08e,
      metalness: 0.82,
      roughness: 0.24,
    })
  );

  const frames: PolaroidFrameItem[] = [];
  const canvases: HTMLCanvasElement[] = [];
  const textures: THREE.CanvasTexture[] = [];

  const initialLayouts = [
    { x: -0.96, z: 1.05, rotY: 0.24 },
    { x: -0.34, z: 1.15, rotY: 0.06 },
    { x: 0.98, z: 1.04, rotY: -0.24 },
  ];

  DEFAULT_POLAROID_MEMORIES.forEach((mem, idx) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 614;
    drawPolaroidCanvas(canvas, idx, mem.caption);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(maxAniso, 8);
    tex.needsUpdate = true;
    disposables.push(tex);

    canvases.push(canvas);
    textures.push(tex);

    const faceMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.42,
        metalness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );

    const root = new THREE.Group();
    const layout = initialLayouts[idx];
    root.position.set(layout.x, 0, layout.z);
    root.rotation.y = layout.rotY;

    // Tilted photo frame standing on marble floor
    const framePivot = new THREE.Group();
    framePivot.position.set(0, 0.19, 0);
    framePivot.rotation.x = -0.22;
    root.add(framePivot);

    const cardMesh = new THREE.Mesh(cardGeo, cardBackMat);
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = true;
    framePivot.add(cardMesh);

    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.z = 0.008;
    framePivot.add(faceMesh);

    // Rose-gold rear easel leg resting cleanly at y = 0
    const leg = new THREE.Mesh(standGeo, roseGoldMat);
    leg.position.set(0, 0.105, -0.055);
    leg.rotation.x = 0.42;
    leg.castShadow = true;
    root.add(leg);

    root.scale.setScalar(0.001);
    root.visible = false;
    group.add(root);

    frames.push({
      index: idx,
      root,
      hitMesh: cardMesh,
      spec: { ...mem },
    });
  });

  const state = {
    visibleScale: 0,
  };

  function setMemory(index: number, caption: string, imageDataUrl?: string) {
    const item = frames[index];
    if (!item) return;
    item.spec.caption = caption;
    item.spec.imageDataUrl = imageDataUrl;

    const canvas = canvases[index];
    const tex = textures[index];

    if (imageDataUrl) {
      const img = new Image();
      img.onload = () => {
        drawPolaroidCanvas(canvas, index, caption, img);
        tex.needsUpdate = true;
      };
      img.src = imageDataUrl;
    } else {
      drawPolaroidCanvas(canvas, index, caption);
      tex.needsUpdate = true;
    }
  }

  function update(elapsed: number) {
    const s = THREE.MathUtils.clamp(state.visibleScale, 0, 1);
    frames.forEach((f, idx) => {
      f.root.visible = s > 0.01;
      if (f.root.visible) {
        const microFloat = Math.sin(elapsed * 1.4 + idx * 1.7) * 0.012;
        f.root.position.y = microFloat > 0 ? microFloat : 0;
        f.root.scale.setScalar(s);
      }
    });
  }

  return {
    group,
    frames,
    state,
    setMemory,
    update,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
