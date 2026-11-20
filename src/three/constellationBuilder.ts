import * as THREE from 'three';
import type { LightingMood, ThreeTextureBundle } from './types';

export interface WishConstellationRig {
  group: THREE.Group;
  triggerWish: () => void;
  reset: () => void;
  setMood: (mood: LightingMood) => void;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

export function createWishConstellation(textures: ThreeTextureBundle): WishConstellationRig {
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

  // =========================================================================
  // 1. GLOWING 3D HEART CONSTELLATION ABOVE THE BOUQUET
  // =========================================================================
  const heartCenter = new THREE.Vector3(0, 4.18, -2.55);
  const starCount = 18;
  const heartPoints: THREE.Vector3[] = [];
  for (let i = 0; i < starCount; i++) {
    const t = (i / starCount) * Math.PI * 2;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    heartPoints.push(
      new THREE.Vector3(
        heartCenter.x + hx * 0.056,
        heartCenter.y + hy * 0.052,
        heartCenter.z + Math.sin(t * 2) * 0.06
      )
    );
  }

  // Soft twinkling star sprites on every vertex of the heart
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starAlphas = new Float32Array(starCount);

  const goldCol = new THREE.Color('#ffe89e');
  const roseCol = new THREE.Color('#ff9cc8');

  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3] = heartPoints[i].x;
    starPositions[i * 3 + 1] = heartPoints[i].y;
    starPositions[i * 3 + 2] = heartPoints[i].z;
    const c = i % 2 === 0 ? goldCol : roseCol;
    starColors[i * 3] = c.r;
    starColors[i * 3 + 1] = c.g;
    starColors[i * 3 + 2] = c.b;
    starSizes[i] = i % 3 === 0 ? 0.56 : 0.4;
    starAlphas[i] = 0;
  }

  const starGeo = trackGeo(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  const starAlphaAttr = new THREE.BufferAttribute(starAlphas, 1);
  starGeo.setAttribute('aAlpha', starAlphaAttr);

  const starMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uScale: { value: 240.0 },
        uGlowBoost: { value: 1.0 },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uScale;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (uScale / max(-mv.z, 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uGlowBoost;
        void main() {
          if (vAlpha <= 0.005) discard;
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          // 4-point star flare + soft radial aura
          float core = exp(-d * 10.5);
          float rayH = exp(-abs(uv.y) * 26.0) * exp(-abs(uv.x) * 5.0);
          float rayV = exp(-abs(uv.x) * 26.0) * exp(-abs(uv.y) * 5.0);
          float star = clamp(core + (rayH + rayV) * 0.72, 0.0, 1.0);
          gl_FragColor = vec4(vColor * (1.1 + core * 0.65) * uGlowBoost, star * vAlpha);
        }
      `,
    })
  );

  const starPoints = new THREE.Points(starGeo, starMat);
  starPoints.frustumCulled = false;
  group.add(starPoints);

  // Connecting glowing constellation threads
  const linePositions = new Float32Array(starCount * 2 * 3);
  for (let i = 0; i < starCount; i++) {
    const a = heartPoints[i];
    const b = heartPoints[(i + 1) % starCount];
    linePositions[i * 6] = a.x;
    linePositions[i * 6 + 1] = a.y;
    linePositions[i * 6 + 2] = a.z;
    linePositions[i * 6 + 3] = b.x;
    linePositions[i * 6 + 4] = b.y;
    linePositions[i * 6 + 5] = b.z;
  }
  const lineGeo = trackGeo(new THREE.BufferGeometry());
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMat = trackMat(
    new THREE.LineBasicMaterial({
      color: 0xffd5e6,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const constellationLines = new THREE.LineSegments(lineGeo, lineMat);
  constellationLines.frustumCulled = false;
  group.add(constellationLines);

  // =========================================================================
  // 2. SHOOTING STAR STREAK (FLIES ACROSS SKY TO IGNITE THE CONSTELLATION!)
  // =========================================================================
  const streakGroup = new THREE.Group();
  streakGroup.visible = false;
  group.add(streakGroup);

  const starHeadMat = trackMat(
    new THREE.SpriteMaterial({
      map: textures.sparkleSprite,
      color: 0xfff3b8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const starHead = new THREE.Sprite(starHeadMat);
  starHead.scale.set(0.68, 0.68, 0.68);
  streakGroup.add(starHead);

  const tailGeo = trackGeo(new THREE.ConeGeometry(0.065, 1.35, 10));
  tailGeo.rotateZ(Math.PI / 2);
  tailGeo.translate(-0.675, 0, 0);
  const tailMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffe49e,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const tailMesh = new THREE.Mesh(tailGeo, tailMat);
  streakGroup.add(tailMesh);

  let wishActive = false;
  let wishElapsed = 0;
  let litAmount = 0;
  let moodBoost = 0.88;

  function triggerWish() {
    wishActive = true;
    wishElapsed = 0;
    streakGroup.visible = true;
  }

  function reset() {
    wishActive = false;
    wishElapsed = 0;
    litAmount = 0;
    streakGroup.visible = false;
    lineMat.opacity = 0;
    for (let i = 0; i < starCount; i++) {
      starAlphas[i] = 0;
    }
    starAlphaAttr.needsUpdate = true;
  }

  function setMood(mood: LightingMood) {
    moodBoost = mood === 'starlight' ? 1.25 : mood === 'golden' ? 0.98 : 0.88;
    starMat.uniforms.uGlowBoost.value = moodBoost;
  }

  const _prevPos = new THREE.Vector3();
  const _curPos = new THREE.Vector3();
  const _dir = new THREE.Vector3();

  function evalMeteorPos(t: number, out: THREE.Vector3) {
    // Sweeping parabolic arc from upper-left sky down to heart apex, then off right
    const x = THREE.MathUtils.lerp(-4.6, 3.8, t);
    const y = 5.1 - t * 0.6 + Math.sin(t * Math.PI) * 0.55;
    const z = THREE.MathUtils.lerp(-3.4, -2.4, t);
    out.set(x, y, z);
  }

  function update(dt: number, elapsed: number) {
    const safeDt = Math.min(dt, 0.05);

    if (wishActive) {
      wishElapsed += safeDt;
      const dur = 1.45;
      const t = Math.min(1, wishElapsed / dur);
      evalMeteorPos(t, _curPos);
      evalMeteorPos(Math.max(0, t - 0.02), _prevPos);
      _dir.subVectors(_curPos, _prevPos).normalize();

      streakGroup.position.copy(_curPos);
      streakGroup.rotation.z = Math.atan2(_dir.y, _dir.x);

      const env = Math.sin(t * Math.PI);
      starHeadMat.opacity = env * 0.95;
      tailMat.opacity = env * 0.72;

      if (t > 0.35) {
        litAmount = Math.min(1, litAmount + safeDt * 1.4);
      }

      if (t >= 1) {
        wishActive = false;
        streakGroup.visible = false;
      }
    }

    if (litAmount > 0.005) {
      // Gentle heartbeat shimmer & twinkling across constellation stars
      const heartbeat = 0.86 + 0.14 * Math.sin(elapsed * 2.4);
      lineMat.opacity = litAmount * 0.52 * heartbeat * (moodBoost > 1 ? 1.15 : 0.9);

      for (let i = 0; i < starCount; i++) {
        const starDelay = (i / starCount) * 0.55;
        const localLit = THREE.MathUtils.clamp((litAmount - starDelay) / 0.45, 0, 1);
        const twinkle = 0.72 + 0.28 * Math.sin(elapsed * (3.2 + (i % 4) * 0.6) + i * 1.3);
        starAlphas[i] = localLit * twinkle * heartbeat;
      }
      starAlphaAttr.needsUpdate = true;
    }
  }

  return {
    group,
    triggerWish,
    reset,
    setMood,
    update,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
