import gsap from 'gsap';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createCharacterAccessories, type CharacterAccessoriesRig } from './accessoriesBuilder';
import { createHeartBalloonCluster, type HeartBalloonRig } from './balloonBuilder';
import { createBouquetRig, type BouquetRig } from './bouquetBuilder';
import { createButterflySwarm, type ButterflyRig } from './butterflyBuilder';
import { createWishConstellation, type WishConstellationRig } from './constellationBuilder';
import { createEnvelope, type EnvelopeRig } from './envelopeBuilder';
import { createGiftBox, type GiftBoxRig } from './giftBoxBuilder';
import { createLadduCharacter, type LadduRig } from './ladduBuilder';
import { createSkyLanternSystem, type SkyLanternSystem } from './lanternBuilder';
import { createParticleSystem, type ParticleSystem } from './particles';
import { createPikachu, type PikachuRig } from './pikachuBuilder';
import { createPolaroidGallery, type PolaroidGalleryRig } from './polaroidBuilder';
import { createShinchanCharacter, type ShinchanRig } from './shinchanBuilder';
import { createTeddyBear, type TeddyRig } from './teddyBuilder';
import { createTextureBundle } from './textures';
import {
  HEART_MESSAGE_PRESETS,
  WRAPPER_PALETTES,
  type AccessorySelection,
  type BubbleScreenCoords,
  type DialogueSpeaker,
  type ExperienceStage,
  type LightingMood,
  type SceneCallbacks,
  type WrapperPaletteId,
} from './types';

const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _currentLook = new THREE.Vector3(0, 0.8, 0);
const _projVec = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class BloomingLoveScene {
  private container: HTMLElement;
  private callbacks: SceneCallbacks;
  private isSoftwareGl: boolean;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  private bouquet!: BouquetRig;
  private teddy!: TeddyRig;
  private pikachu!: PikachuRig;
  private laddu!: LadduRig;
  private shinchan!: ShinchanRig;
  private envelope!: EnvelopeRig;
  private giftBox!: GiftBoxRig;
  private butterflies!: ButterflyRig;
  private lanterns!: SkyLanternSystem;
  private polaroids!: PolaroidGalleryRig;
  private constellation!: WishConstellationRig;
  private balloons!: HeartBalloonRig;
  private accessories!: CharacterAccessoriesRig;
  private particles!: ParticleSystem;
  private bouquetShadow!: THREE.Mesh;
  private giftBoxShadow!: THREE.Mesh;
  private teddyShadow!: THREE.Mesh;
  private pikachuShadow!: THREE.Mesh;
  private ladduShadow!: THREE.Mesh;
  private shinchanShadow!: THREE.Mesh;

  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private fillLight!: THREE.PointLight;
  private softboxLight: THREE.RectAreaLight | null = null;

  private textures!: ReturnType<typeof createTextureBundle>;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private skyMat!: THREE.ShaderMaterial;
  private floorMat!: THREE.MeshPhysicalMaterial;
  private shadowMat!: THREE.MeshBasicMaterial;
  private disposables: { dispose: () => void }[] = [];

  private stage: ExperienceStage = 'intro';
  private noteVisible = true;
  private danceMode = false;
  private heartPresetIdx = 0;
  private giftBoxOpening = false;
  private masterTl: gsap.core.Timeline | null = null;
  private giftBoxTl: gsap.core.Timeline | null = null;
  private hugTween: gsap.core.Tween | null = null;
  private kissTween: gsap.core.Tween | null = null;
  private sparkTween: gsap.core.Tween | null = null;
  private ladduTween: gsap.core.Tween | null = null;
  private shinchanTween: gsap.core.Tween | null = null;
  private dialogueTimerId = 0;
  private lastTeddyTapAt = 0;
  private lastPikachuTapAt = 0;
  private lastShinchanTapAt = 0;

  private raycaster = new THREE.Raycaster();
  private pointerDownPos = new THREE.Vector2();
  private pointerNdc = new THREE.Vector2();

  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private userControlling = false;
  private cameraFollowActive = true;

  private camRig = {
    x: 0,
    y: 2.1,
    z: 6.4,
    tx: 0,
    ty: 0.75,
    tz: 0,
  };

  constructor(container: HTMLElement, callbacks: SceneCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.init();
  }

  private init(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    this.container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xfbe8ef, 0.024);

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(this.camRig.x, this.camRig.y, this.camRig.z);
    this.camera.lookAt(this.camRig.tx, this.camRig.ty, this.camRig.tz);

    // Studio Environment Map (PMREM RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    // Procedural Textures
    this.textures = createTextureBundle(this.renderer);

    // Pastel Gradient Sky Dome
    this.setupSkyAndFloor();

    // Three-Point + Softbox Lighting Rig
    this.setupLighting();

    // 3D Subjects
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.bouquet = createBouquetRig(this.textures, maxAniso);
    this.scene.add(this.bouquet.bouquetGroup);

    this.teddy = createTeddyBear(this.textures);
    this.teddy.root.position.set(6.5, 0, 0.12);
    this.teddy.root.visible = false;
    this.scene.add(this.teddy.root);

    this.pikachu = createPikachu(this.textures);
    this.pikachu.root.position.set(-6.5, 0, 0.26);
    this.pikachu.root.visible = false;
    this.scene.add(this.pikachu.root);

    this.laddu = createLadduCharacter();
    this.laddu.root.position.set(-5.8, 0, 0.30);
    this.laddu.root.visible = false;
    this.scene.add(this.laddu.root);

    this.shinchan = createShinchanCharacter();
    this.shinchan.root.position.set(7.2, 0, 0.24);
    this.shinchan.root.visible = false;
    this.scene.add(this.shinchan.root);

    this.envelope = createEnvelope(this.textures);
    this.envelope.root.position.set(0.48, 0.008, 0.92);
    this.envelope.root.rotation.y = 0.08;
    this.scene.add(this.envelope.root);

    this.giftBox = createGiftBox(maxAniso);
    this.giftBox.root.position.set(0.78, 0, 0.24);
    this.scene.add(this.giftBox.root);

    // Soft Ground Contact Shadows
    const shadowGeo = new THREE.PlaneGeometry(1.9, 1.9);
    shadowGeo.rotateX(-Math.PI / 2);
    this.disposables.push(shadowGeo);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.shadowSprite,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    this.bouquetShadow = new THREE.Mesh(shadowGeo, this.shadowMat.clone());
    this.bouquetShadow.position.set(0, 0.008, 0);
    this.scene.add(this.bouquetShadow);

    this.giftBoxShadow = new THREE.Mesh(shadowGeo, this.shadowMat.clone());
    this.giftBoxShadow.position.set(0.78, 0.008, 0.24);
    this.giftBoxShadow.scale.setScalar(0.95);
    this.scene.add(this.giftBoxShadow);

    this.teddyShadow = new THREE.Mesh(shadowGeo, this.shadowMat.clone());
    this.teddyShadow.position.set(6.5, 0.008, 0.12);
    this.teddyShadow.scale.setScalar(0.85);
    this.scene.add(this.teddyShadow);

    this.pikachuShadow = new THREE.Mesh(shadowGeo, this.shadowMat.clone());
    this.pikachuShadow.position.set(-6.5, 0.008, 0.26);
    this.pikachuShadow.scale.setScalar(0.72);
    this.scene.add(this.pikachuShadow);

    this.ladduShadow = new THREE.Mesh(shadowGeo, this.shadowMat.clone());
    this.ladduShadow.position.set(-5.8, 0.008, 0.30);
    this.ladduShadow.scale.setScalar(0.68);
    this.scene.add(this.ladduShadow);

    this.shinchanShadow = new THREE.Mesh(shadowGeo, this.shadowMat.clone());
    this.shinchanShadow.position.set(7.2, 0.008, 0.24);
    this.shinchanShadow.scale.setScalar(0.72);
    this.scene.add(this.shinchanShadow);

    // Floating Petals, Sparkles, Fireworks & Hug Hearts
    this.particles = createParticleSystem(this.textures);
    this.scene.add(this.particles.group);

    // Animated 3D Butterflies, Sky Lanterns & Polaroid Keepsake Frames
    this.butterflies = createButterflySwarm();
    this.scene.add(this.butterflies.group);

    this.lanterns = createSkyLanternSystem();
    this.scene.add(this.lanterns.group);

    this.polaroids = createPolaroidGallery(maxAniso);
    this.scene.add(this.polaroids.group);

    this.constellation = createWishConstellation(this.textures);
    this.scene.add(this.constellation.group);

    this.balloons = createHeartBalloonCluster();
    this.scene.add(this.balloons.group);

    this.accessories = createCharacterAccessories({
      teddyHead: this.teddy.headPivot,
      teddyBody: this.teddy.bodyPivot,
      pikachuHead: this.pikachu.headPivot,
      pikachuBody: this.pikachu.bodyPivot,
      shinchanHead: this.shinchan.headPivot,
    });

    // OrbitControls (enabled smoothly in Final stage)
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.minDistance = 4.2;
    this.controls.maxDistance = 20.0;
    this.controls.minPolarAngle = 0.42;
    this.controls.maxPolarAngle = Math.PI * 0.475;
    this.controls.enabled = false;
    this.controls.addEventListener('start', () => {
      this.userControlling = true;
      this.cameraFollowActive = false;
    });

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);

    // Apply initial responsive framing for intro
    this.applyResponsiveStageFraming(true);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    this.tick();
  }

  private setupSkyAndFloor(): void {
    const skyGeo = new THREE.SphereGeometry(42, 32, 20);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color('#f3c4d7') },
        uMidColor: { value: new THREE.Color('#fce2ec') },
        uBottomColor: { value: new THREE.Color('#fff6f9') },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uBottomColor;
        void main() {
          float h = clamp(normalize(vWorldPos).y * 1.4 + 0.1, 0.0, 1.0);
          vec3 col = mix(uBottomColor, uMidColor, smoothstep(0.0, 0.35, h));
          col = mix(col, uTopColor, smoothstep(0.35, 1.0, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(skyDome);
    this.disposables.push(skyGeo, this.skyMat);

    // Subtle Reflective Blush-Ivory Floor
    const floorGeo = new THREE.CircleGeometry(30, 64);
    floorGeo.rotateX(-Math.PI / 2);
    this.floorMat = new THREE.MeshPhysicalMaterial({
      map: this.textures.floorMap,
      roughnessMap: this.textures.floorRoughness,
      color: 0xfff7fa,
      roughness: 0.28,
      metalness: 0.04,
      clearcoat: 0.55,
      clearcoatRoughness: 0.24,
      envMapIntensity: 0.78,
    });
    const floorMesh = new THREE.Mesh(floorGeo, this.floorMat);
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);
    this.disposables.push(floorGeo, this.floorMat);
  }

  private setupLighting(): void {
    // Warm/cool hemisphere ambient bounce
    this.hemiLight = new THREE.HemisphereLight(0xfff1f6, 0xdfb7c6, 1.15);
    this.scene.add(this.hemiLight);

    // Warm Golden-Rose Directional Key Light
    this.keyLight = new THREE.DirectionalLight(0xfff1e4, 2.0);
    this.keyLight.position.set(4.5, 7.5, 5.5);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 22;
    const d = 6.2;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.02;
    this.keyLight.shadow.radius = 3;
    this.scene.add(this.keyLight);

    // Soft Rose Rim Backlight (illuminates translucent tulip petal edges & fur halo)
    this.rimLight = new THREE.DirectionalLight(0xffd6e8, 0.95);
    this.rimLight.position.set(-3.5, 5.0, -5.5);
    this.scene.add(this.rimLight);

    // Gentle Front-Left Fill Light
    this.fillLight = new THREE.PointLight(0xffeaf2, 1.15, 22, 1.4);
    this.fillLight.position.set(-4.5, 3.2, 4.8);
    this.scene.add(this.fillLight);

    // Studio Softbox Highlights (skipped on software WebGL)
    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      this.softboxLight = new THREE.RectAreaLight(0xfff5f8, 2.2, 5.5, 3.0);
      this.softboxLight.position.set(0, 5.2, 4.5);
      this.softboxLight.lookAt(0, 1.2, 0);
      this.scene.add(this.softboxLight);
    }
  }

  private getResponsiveLayout() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / Math.max(h, 1);
    const isMobile = aspect < 0.92;
    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const tanHalfV = Math.tan(vFovRad / 2);
    const tanHalfH = tanHalfV * aspect;

    // Final presentation positions:
    // LEFT PAIR (standing close & talking): Pikachu + Laddu
    // CENTER: Tulip Bouquet + Front Wax Envelope
    // RIGHT PAIR: Teddy Bear + Shinchan
    const pikachuX = isMobile ? -1.48 : -2.22;
    const ladduX = isMobile ? -0.84 : -1.40;
    const bouquetX = isMobile ? -0.02 : -0.15;
    const teddyX = isMobile ? 0.90 : 1.18;
    const shinchanX = isMobile ? 1.56 : 2.06;
    const envelopeX = isMobile ? 0.42 : 0.48;
    const giftBoxX = isMobile ? 0.56 : 0.78;
    const giftBoxBouquetX = isMobile ? -0.44 : -0.62;

    const pikachuScale = isMobile ? 0.78 : 0.88;
    const ladduScale = isMobile ? 0.78 : 0.88;
    const bouquetScale = isMobile ? 0.86 : 1.0;
    const teddyScale = isMobile ? 0.82 : 0.94;
    const shinchanScale = isMobile ? 0.78 : 0.88;
    const giftBoxScale = isMobile ? 0.86 : 1.0;

    const polaroidPositions: [number, number, number][] = isMobile
      ? [
          [-0.68, 0.96, 0.2],
          [-0.14, 1.08, 0.04],
          [0.68, 0.96, -0.2],
        ]
      : [
          [-1.04, 1.04, 0.24],
          [-0.34, 1.15, 0.06],
          [0.98, 1.04, -0.24],
        ];
    const polaroidScale = isMobile ? 0.78 : 1.0;
    const balloonEdgeX = isMobile ? 1.92 : 2.92;
    const heartSpreadMin = isMobile ? 1.68 : 2.55;
    const heartSpreadMax = isMobile ? 2.28 : 3.65;

    return {
      aspect,
      isMobile,
      tanHalfV,
      tanHalfH,
      pikachuX,
      ladduX,
      bouquetX,
      teddyX,
      shinchanX,
      envelopeX,
      giftBoxX,
      giftBoxBouquetX,
      pikachuScale,
      ladduScale,
      bouquetScale,
      teddyScale,
      shinchanScale,
      giftBoxScale,
      polaroidPositions,
      polaroidScale,
      balloonEdgeX,
      heartSpreadMin,
      heartSpreadMax,
    };
  }

  private frameVerticalBand(
    minY: number,
    maxY: number,
    ndcBot: number,
    ndcTop: number,
    halfW: number,
    camYOffset: number
  ): { pos: [number, number, number]; target: [number, number, number] } {
    const { tanHalfV, tanHalfH } = this.getResponsiveLayout();
    const spanNdc = Math.max(ndcTop - ndcBot, 0.3);
    const worldSpan = maxY - minY;
    const halfWorldH = worldSpan / spanNdc;
    const distV = halfWorldH / tanHalfV;
    const distH = halfW / tanHalfH;
    const dist = Math.max(distV, distH, 5.4);

    const actualHalfH = dist * tanHalfV;
    const midObjY = (minY + maxY) * 0.5;
    const midNdc = (ndcBot + ndcTop) * 0.5;
    // Also ensure maxY strictly stays <= ndcTop even if distH > distV
    const targetYFromMid = midObjY - midNdc * actualHalfH;
    const maxAllowedTargetY = targetYFromMid;
    const minTargetForTop = maxY - ndcTop * actualHalfH;
    const targetY = Math.max(maxAllowedTargetY, minTargetForTop);

    return {
      pos: [0, targetY + camYOffset, dist],
      target: [0, targetY, 0],
    };
  }

  private getStageFraming(stage: ExperienceStage): {
    pos: [number, number, number];
    target: [number, number, number];
  } {
    const { isMobile } = this.getResponsiveLayout();

    if (stage === 'intro') {
      return this.frameVerticalBand(0.0, 2.2, -0.55, 0.65, isMobile ? 2.2 : 2.6, 1.15);
    }

    if (stage === 'growing') {
      return this.frameVerticalBand(0.0, 3.3, -0.68, 0.68, isMobile ? 2.35 : 2.65, 0.95);
    }

    if (stage === 'assembly') {
      return this.frameVerticalBand(0.05, 3.6, -0.66, 0.72, isMobile ? 1.55 : 1.9, 0.75);
    }

    if (stage === 'giftbox') {
      return this.frameVerticalBand(0.0, 3.55, -0.58, 0.72, isMobile ? 1.75 : 2.25, 0.95);
    }

    // 'teddy' & 'final' — Frame Pikachu & Laddu (LEFT), Bouquet (CENTER), Teddy & Shinchan (RIGHT)
    const showingNote = stage === 'final' ? this.noteVisible : true;
    const ndcBot = showingNote ? (isMobile ? -0.06 : -0.14) : -0.68;
    const ndcTop = showingNote ? 0.76 : 0.78;
    const halfW = isMobile ? 2.38 : 3.28;
    const camYOffset = showingNote ? 1.35 : 0.95;

    return this.frameVerticalBand(0.0, 3.62, ndcBot, ndcTop, halfW, camYOffset);
  }

  private applyResponsiveStageFraming(immediate = false): void {
    const layout = this.getResponsiveLayout();
    const framing = this.getStageFraming(this.stage);

    this.balloons.setEdgeX(layout.balloonEdgeX);
    this.particles.setEdgeSpread(layout.heartSpreadMin, layout.heartSpreadMax);

    if (this.stage === 'giftbox') {
      if (!this.giftBoxOpening) {
        gsap.to(this.bouquet.bouquetGroup.position, {
          x: layout.giftBoxBouquetX,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(this.giftBox.root.position, {
          x: layout.giftBoxX,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(this.giftBox.state, {
          visibleScale: layout.giftBoxScale,
          duration: 0.6,
          ease: 'power2.out',
        });
      }
    }

    if (this.stage === 'teddy' || this.stage === 'final') {
      if (immediate) {
        this.bouquet.bouquetGroup.position.x = layout.bouquetX;
        this.bouquet.bouquetGroup.scale.setScalar(layout.bouquetScale);
        this.teddy.root.position.x = layout.teddyX;
        this.teddy.root.scale.setScalar(layout.teddyScale);
        this.pikachu.root.position.x = layout.pikachuX;
        this.pikachu.root.scale.setScalar(layout.pikachuScale);
        this.laddu.root.position.x = layout.ladduX;
        this.laddu.root.scale.setScalar(layout.ladduScale);
        this.shinchan.root.position.x = layout.shinchanX;
        this.shinchan.root.scale.setScalar(layout.shinchanScale);
        this.envelope.root.position.x = layout.envelopeX;
      } else if (this.stage === 'final') {
        gsap.to(this.bouquet.bouquetGroup.position, {
          x: layout.bouquetX,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(this.bouquet.bouquetGroup.scale, {
          x: layout.bouquetScale,
          y: layout.bouquetScale,
          z: layout.bouquetScale,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(this.teddy.root.position, {
          x: layout.teddyX,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(this.teddy.root.scale, {
          x: layout.teddyScale,
          y: layout.teddyScale,
          z: layout.teddyScale,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(this.pikachu.root.position, {
          x: layout.pikachuX,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(this.pikachu.root.scale, {
          x: layout.pikachuScale,
          y: layout.pikachuScale,
          z: layout.pikachuScale,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(this.laddu.root.position, {
          x: layout.ladduX,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(this.laddu.root.scale, {
          x: layout.ladduScale,
          y: layout.ladduScale,
          z: layout.ladduScale,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(this.shinchan.root.position, {
          x: layout.shinchanX,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(this.shinchan.root.scale, {
          x: layout.shinchanScale,
          y: layout.shinchanScale,
          z: layout.shinchanScale,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(this.envelope.root.position, {
          x: layout.envelopeX,
          duration: 0.6,
          ease: 'power2.out',
        });
        this.polaroids.frames.forEach((frame, idx) => {
          const [px, pz, rotY] = layout.polaroidPositions[idx];
          gsap.to(frame.root.position, { x: px, z: pz, duration: 0.6, ease: 'power2.out' });
          gsap.to(frame.root.rotation, { y: rotY, duration: 0.6, ease: 'power2.out' });
        });
        gsap.to(this.polaroids.group.scale, {
          x: layout.polaroidScale,
          y: layout.polaroidScale,
          z: layout.polaroidScale,
          duration: 0.6,
          ease: 'power2.out',
        });
      }
    }

    if (immediate) {
      this.camRig.x = framing.pos[0];
      this.camRig.y = framing.pos[1];
      this.camRig.z = framing.pos[2];
      this.camRig.tx = framing.target[0];
      this.camRig.ty = framing.target[1];
      this.camRig.tz = framing.target[2];
      this.camera.position.set(this.camRig.x, this.camRig.y, this.camRig.z);
      _currentLook.set(this.camRig.tx, this.camRig.ty, this.camRig.tz);
      this.camera.lookAt(_currentLook);
      this.controls.target.copy(_currentLook);
    } else if (!this.userControlling) {
      this.cameraFollowActive = true;
      gsap.to(this.camRig, {
        x: framing.pos[0],
        y: framing.pos[1],
        z: framing.pos[2],
        tx: framing.target[0],
        ty: framing.target[1],
        tz: framing.target[2],
        duration: 1.4,
        ease: 'power2.inOut',
      });
    }
  }

  private setStage(stage: ExperienceStage): void {
    this.stage = stage;
    this.callbacks.onStageChange?.(stage);
  }

  public startExperience(): void {
    if (this.masterTl) {
      this.masterTl.kill();
      this.masterTl = null;
    }

    this.userControlling = false;
    this.cameraFollowActive = true;
    this.controls.enabled = false;

    // Reset entire scene cleanly to start state
    this.resetObjects();

    const tl = gsap.timeline();
    this.masterTl = tl;

    // =========================================================================
    // PHASE 1: REALISTIC TULIP GROWING ANIMATION
    // =========================================================================
    tl.call(() => {
      this.setStage('growing');
      const f = this.getStageFraming('growing');
      gsap.to(this.camRig, {
        x: f.pos[0],
        y: f.pos[1],
        z: f.pos[2],
        tx: f.target[0],
        ty: f.target[1],
        tz: f.target[2],
        duration: 1.8,
        ease: 'power2.inOut',
      });
    });

    // 1. Shoots emerge & stems grow upward
    this.bouquet.tulips.forEach((tulip, idx) => {
      const delay = 0.55 + idx * 0.16;
      tl.to(
        tulip.state,
        {
          stemProgress: 0.16,
          duration: 0.65,
          ease: 'power2.out',
        },
        delay
      );
      tl.to(
        tulip.state,
        {
          stemProgress: 1.0,
          duration: 2.3,
          ease: 'power2.out',
        },
        delay + 0.55
      );
      // 2. Leaves unfold naturally from stems
      tl.to(
        tulip.state,
        {
          leafUnfold: 1.0,
          duration: 1.75,
          ease: 'power2.inOut',
        },
        delay + 1.15
      );
      // 3. Flower buds appear & swell at stem tops
      tl.to(
        tulip.state,
        {
          budScale: 1.0,
          duration: 1.1,
          ease: 'back.out(1.25)',
        },
        delay + 2.2
      );
      // 4. Outer petals unfold first, then inner petals unfold
      tl.to(
        tulip.state,
        {
          outerOpen: 1.0,
          duration: 2.1,
          ease: 'power2.out',
        },
        delay + 3.25
      );
      tl.to(
        tulip.state,
        {
          innerOpen: 1.0,
          duration: 1.95,
          ease: 'power2.out',
        },
        delay + 3.65
      );
      // 5. Gentle breeze sway once bloomed
      tl.to(
        tulip.state,
        {
          swayAmp: 1.0,
          duration: 1.1,
          ease: 'sine.inOut',
        },
        delay + 4.4
      );
    });

    // Butterflies flutter gently in as tulips open!
    tl.to(
      this.butterflies.state,
      {
        opacity: 1,
        duration: 1.9,
        ease: 'power2.out',
      },
      4.5
    );

    const gardenEnd = 7.4;

    // =========================================================================
    // PHASE 2: BOUQUET ASSEMBLY, WRAPPING PAPER & SATIN BOW
    // =========================================================================
    tl.call(
      () => {
        this.setStage('assembly');
        const f = this.getStageFraming('assembly');
        gsap.to(this.camRig, {
          x: f.pos[0],
          y: f.pos[1],
          z: f.pos[2],
          tx: f.target[0],
          ty: f.target[1],
          tz: f.target[2],
          duration: 1.8,
          ease: 'power2.inOut',
        });
      },
      undefined,
      gardenEnd
    );

    // Fade in bouquet floor contact shadow
    tl.to(
      this.bouquetShadow.material,
      {
        opacity: 0.42,
        duration: 1.4,
        ease: 'power2.out',
      },
      gardenEnd + 0.8
    );

    // Lift and spiral-gather each tulip into a balanced florist dome
    this.bouquet.tulips.forEach((tulip, idx) => {
      const s = tulip.spec;
      const d = gardenEnd + 0.25 + idx * 0.1;

      // Compute spiral stem base so every stem passes cleanly inside waist (0, 1.02, 0)
      const waistDist = 0.86;
      const baseX = Math.sin(s.bouquetTilt[2]) * waistDist * 0.72 + s.bouquetOffset[0] * 0.12;
      const baseZ = -Math.sin(s.bouquetTilt[0]) * waistDist * 0.72 + s.bouquetOffset[2] * 0.12;
      const baseY = 0.12 + s.bouquetOffset[1];

      tl.to(
        tulip.state,
        {
          moundOpacity: 0,
          leafTuck: 1,
          swayAmp: 0.45,
          duration: 1.2,
          ease: 'power2.inOut',
        },
        d
      );

      tl.to(
        tulip.root.position,
        {
          x: baseX,
          y: baseY,
          z: baseZ,
          duration: 2.1,
          ease: 'power2.inOut',
        },
        d
      );

      tl.to(
        tulip.root.rotation,
        {
          x: s.bouquetTilt[0],
          y: s.bouquetTilt[1],
          z: s.bouquetTilt[2],
          duration: 2.1,
          ease: 'power2.inOut',
        },
        d
      );
    });

    // Baby's breath botanical filler blooms nestled between tulips
    tl.to(
      this.bouquet.state,
      {
        fillerScale: 1,
        duration: 1.2,
        ease: 'back.out(1.2)',
      },
      gardenEnd + 1.45
    );

    // Wrapping paper rises up around the stems & folds inward (below flower heads)
    const wrapStart = gardenEnd + 2.15;
    tl.to(
      this.bouquet.state,
      {
        wrapOpacity: 1,
        wrapRise: 1,
        duration: 1.35,
        ease: 'power2.out',
      },
      wrapStart
    );
    tl.to(
      this.bouquet.state,
      {
        wrapFold: 1,
        duration: 1.35,
        ease: 'power2.inOut',
      },
      wrapStart + 0.9
    );

    // Satin ribbon wraps & bow tightens at the front
    const ribbonStart = wrapStart + 2.05;
    tl.to(
      this.bouquet.state,
      {
        ribbonScale: 1,
        duration: 0.75,
        ease: 'back.out(1.4)',
      },
      ribbonStart
    );
    tl.to(
      this.bouquet.state,
      {
        bowTighten: 1,
        duration: 1.0,
        ease: 'power2.inOut',
      },
      ribbonStart + 0.35
    );

    const assemblyEnd = ribbonStart + 1.55;

    // =========================================================================
    // PHASE 3: INTERACTIVE 'OPEN GIFT BOX' STAGE (WAITS FOR USER TAP)
    // =========================================================================
    tl.call(
      () => {
        this.setStage('giftbox');
        const layout = this.getResponsiveLayout();
        const f = this.getStageFraming('giftbox');

        this.giftBoxOpening = false;
        this.giftBox.root.visible = true;
        this.giftBox.root.position.set(layout.giftBoxX, 1.65, 0.24);
        this.giftBox.root.rotation.y = -0.22;
        this.giftBox.state.openProgress = 0;
        this.giftBox.state.wobbleActive = 0;
        this.giftBox.state.visibleScale = 0.001;

        gsap.to(this.camRig, {
          x: f.pos[0],
          y: f.pos[1],
          z: f.pos[2],
          tx: f.target[0],
          ty: f.target[1],
          tz: f.target[2],
          duration: 1.5,
          ease: 'power2.inOut',
        });

        // Bouquet glides gently left to share center stage with the Mystery Gift Box
        gsap.to(this.bouquet.bouquetGroup.position, {
          x: layout.giftBoxBouquetX,
          duration: 1.4,
          ease: 'power2.inOut',
        });
        gsap.to(this.bouquet.bouquetGroup.scale, {
          x: layout.bouquetScale,
          y: layout.bouquetScale,
          z: layout.bouquetScale,
          duration: 1.4,
          ease: 'power2.inOut',
        });

        // Gift Box drops & bounces gracefully onto the marble floor
        gsap.to(this.giftBox.root.position, {
          y: 0,
          duration: 0.85,
          delay: 0.25,
          ease: 'bounce.out',
        });
        gsap.to(this.giftBox.state, {
          visibleScale: layout.giftBoxScale,
          duration: 0.55,
          delay: 0.2,
          ease: 'back.out(1.4)',
        });
        gsap.to(this.giftBoxShadow.material, {
          opacity: 0.42,
          duration: 0.75,
          delay: 0.35,
          ease: 'power2.out',
        });
        gsap.to(this.giftBox.state, {
          wobbleActive: 1,
          duration: 0.4,
          delay: 1.1,
        });
      },
      undefined,
      assemblyEnd
    );
  }

  public openGiftBox(): void {
    if (this.stage !== 'giftbox' || this.giftBoxOpening) return;
    this.giftBoxOpening = true;
    this.callbacks.onGiftBoxOpen?.();

    if (this.giftBoxTl) {
      this.giftBoxTl.kill();
    }

    const layout = this.getResponsiveLayout();
    const boxX = this.giftBox.root.position.x;
    const boxZ = this.giftBox.root.position.z;

    const tl = gsap.timeline();
    this.giftBoxTl = tl;

    // 1. Playful anticipation squash before pop!
    tl.to(this.giftBox.state, {
      wobbleActive: 0,
      visibleScale: layout.giftBoxScale * 0.92,
      duration: 0.14,
      ease: 'power2.in',
    });

    // 2. Lid pops open upward & backward with a fountain of sparkles and hearts!
    tl.call(() => {
      this.particles.triggerGiftBoxPop(boxX, 0.88, boxZ);

      // Reveal Teddy Bear nestled inside the open gift box ready to spring out
      this.teddy.root.visible = true;
      this.teddy.root.position.set(boxX, 0.2, boxZ);
      this.teddy.root.scale.setScalar(layout.teddyScale * 0.46);
      this.teddy.root.rotation.y = -0.2;
      this.teddy.state.sitProgress = 1;
      this.teddy.state.walkWeight = 0;
      this.teddy.state.heartLift = 1;
      this.teddy.state.waveAmount = 0.9;
      this.teddy.state.hugPulse = 0.85;
    });

    tl.to(this.giftBox.state, {
      visibleScale: layout.giftBoxScale * 1.04,
      openProgress: 1,
      duration: 0.62,
      ease: 'back.out(1.45)',
    });
    tl.to(
      this.giftBox.state,
      {
        visibleScale: layout.giftBoxScale,
        duration: 0.28,
        ease: 'power2.out',
      },
      '>-0.1'
    );

    // 3. Teddy springs joyfully upward out of the box and lands beside the bouquet
    tl.to(
      this.teddy.root.position,
      {
        y: 1.32,
        duration: 0.4,
        ease: 'power2.out',
      },
      0.24
    );
    tl.to(
      this.teddy.root.position,
      {
        x: () => this.getResponsiveLayout().teddyX,
        z: 0.14,
        duration: 0.88,
        ease: 'power2.inOut',
      },
      0.28
    );
    tl.to(
      this.teddy.root.scale,
      {
        x: () => this.getResponsiveLayout().teddyScale,
        y: () => this.getResponsiveLayout().teddyScale,
        z: () => this.getResponsiveLayout().teddyScale,
        duration: 0.72,
        ease: 'back.out(1.3)',
      },
      0.28
    );
    tl.to(
      this.teddy.root.position,
      {
        y: 0,
        duration: 0.52,
        ease: 'bounce.out',
      },
      0.64
    );
    tl.to(this.teddyShadow.material, { opacity: 0.4, duration: 0.65, ease: 'power2.out' }, 0.65);

    // 4. Transition to 'teddy' stage: Pikachu, Laddu & Shinchan rush in to join Teddy!
    const joinStart = 0.72;
    tl.call(
      () => {
        this.setStage('teddy');
        const curLayout = this.getResponsiveLayout();
        const f = this.getStageFraming('teddy');

        this.pikachu.root.visible = true;
        this.pikachu.root.position.set(curLayout.pikachuX - 4.0, 0, 0.26);
        this.pikachu.root.scale.setScalar(curLayout.pikachuScale);
        this.pikachu.root.rotation.y = 0.65;
        this.pikachu.state.hopWeight = 0;
        this.pikachu.state.hopCycle = 0;
        this.pikachu.state.sitProgress = 0;
        this.pikachu.state.waveAmount = 0;
        this.pikachu.state.sparkPulse = 0;

        this.laddu.root.visible = true;
        this.laddu.root.position.set(curLayout.ladduX - 3.7, 0, 0.30);
        this.laddu.root.scale.setScalar(curLayout.ladduScale);
        this.laddu.root.rotation.y = 0.5;
        this.laddu.state.hopWeight = 0;
        this.laddu.state.hopCycle = 0;
        this.laddu.state.waveAmount = 0;
        this.laddu.state.lovePulse = 0;

        this.shinchan.root.visible = true;
        this.shinchan.root.position.set(curLayout.shinchanX + 4.2, 0, 0.24);
        this.shinchan.root.scale.setScalar(curLayout.shinchanScale);
        this.shinchan.root.rotation.y = -0.6;
        this.shinchan.state.walkWeight = 0;
        this.shinchan.state.walkCycle = 0;
        this.shinchan.state.waveAmount = 0;
        this.shinchan.state.cheekyPulse = 0;

        this.envelope.root.position.x = curLayout.envelopeX;

        gsap.to(this.camRig, {
          x: f.pos[0],
          y: f.pos[1],
          z: f.pos[2],
          tx: f.target[0],
          ty: f.target[1],
          tz: f.target[2],
          duration: 1.65,
          ease: 'power2.inOut',
        });

        gsap.to(this.bouquet.bouquetGroup.position, {
          x: curLayout.bouquetX,
          duration: 1.45,
          ease: 'power2.inOut',
        });
        gsap.to(this.bouquet.bouquetGroup.scale, {
          x: curLayout.bouquetScale,
          y: curLayout.bouquetScale,
          z: curLayout.bouquetScale,
          duration: 1.45,
          ease: 'power2.inOut',
        });
      },
      undefined,
      joinStart
    );

    // Tuck away opened gift box smoothly after Teddy hops free
    tl.to(this.giftBox.state, { visibleScale: 0, duration: 0.55, ease: 'power2.in' }, 1.45);
    tl.to(this.giftBoxShadow.material, { opacity: 0, duration: 0.45, ease: 'power2.out' }, 1.45);
    tl.call(() => {
      this.giftBox.root.visible = false;
    }, undefined, 2.02);

    // Pikachu, Laddu & Shinchan run/hop in
    tl.to(this.shinchan.state, { walkWeight: 1, duration: 0.3, ease: 'power1.out' }, joinStart + 0.15);
    tl.to(this.shinchan.state, { walkCycle: Math.PI * 5, duration: 1.95, ease: 'none' }, joinStart + 0.15);
    tl.to(
      this.shinchan.root.position,
      { x: () => this.getResponsiveLayout().shinchanX, duration: 1.95, ease: 'power1.inOut' },
      joinStart + 0.15
    );
    tl.to(this.shinchanShadow.material, { opacity: 0.36, duration: 1.0, ease: 'power2.out' }, joinStart + 0.6);

    tl.to(this.pikachu.state, { hopWeight: 1, duration: 0.28, ease: 'power1.out' }, joinStart + 0.12);
    tl.to(this.pikachu.state, { hopCycle: Math.PI * 4, duration: 1.95, ease: 'none' }, joinStart + 0.12);
    tl.to(
      this.pikachu.root.position,
      { x: () => this.getResponsiveLayout().pikachuX, duration: 1.95, ease: 'power1.inOut' },
      joinStart + 0.12
    );
    tl.to(this.pikachuShadow.material, { opacity: 0.36, duration: 1.0, ease: 'power2.out' }, joinStart + 0.6);

    tl.to(this.laddu.state, { hopWeight: 1, duration: 0.28, ease: 'power1.out' }, joinStart + 0.18);
    tl.to(this.laddu.state, { hopCycle: Math.PI * 4, duration: 1.9, ease: 'none' }, joinStart + 0.18);
    tl.to(
      this.laddu.root.position,
      { x: () => this.getResponsiveLayout().ladduX, duration: 1.9, ease: 'power1.inOut' },
      joinStart + 0.18
    );
    tl.to(this.ladduShadow.material, { opacity: 0.34, duration: 1.0, ease: 'power2.out' }, joinStart + 0.6);

    // Companions settle & wave warmly
    const settleAt = joinStart + 2.1;
    tl.to(this.teddy.state, { hugPulse: 0, waveAmount: 0, duration: 0.55, ease: 'power2.inOut' }, settleAt);
    tl.to(this.teddy.root.rotation, { y: -0.16, duration: 0.65, ease: 'power2.out' }, settleAt);

    tl.to(this.shinchan.state, { walkWeight: 0, duration: 0.3, ease: 'power2.out' }, settleAt);
    tl.to(this.shinchan.root.rotation, { y: -0.24, duration: 0.65, ease: 'power2.out' }, settleAt);

    tl.to(this.pikachu.state, { hopWeight: 0, duration: 0.3, ease: 'power2.out' }, settleAt);
    tl.to(this.pikachu.root.rotation, { y: 0.36, duration: 0.65, ease: 'power2.out' }, settleAt);
    tl.to(this.pikachu.state, { sitProgress: 1, duration: 0.65, ease: 'power2.inOut' }, settleAt + 0.1);

    tl.to(this.laddu.state, { hopWeight: 0, duration: 0.3, ease: 'power2.out' }, settleAt);
    tl.to(this.laddu.root.rotation, { y: -0.32, duration: 0.65, ease: 'power2.out' }, settleAt);

    tl.to(this.pikachu.state, { waveAmount: 1, duration: 0.45, ease: 'power2.out' }, settleAt + 0.45);
    tl.to(this.pikachu.state, { waveAmount: 0, duration: 0.55, ease: 'power2.inOut' }, settleAt + 1.4);
    tl.to(this.laddu.state, { waveAmount: 1, duration: 0.45, ease: 'power2.out' }, settleAt + 0.5);
    tl.to(this.laddu.state, { waveAmount: 0, duration: 0.55, ease: 'power2.inOut' }, settleAt + 1.45);
    tl.to(this.shinchan.state, { waveAmount: 1, duration: 0.45, ease: 'power2.out' }, settleAt + 0.5);
    tl.to(this.shinchan.state, { waveAmount: 0, duration: 0.55, ease: 'power2.inOut' }, settleAt + 1.45);

    // 5. Final Gift Presentation + Love Note + Polaroids + Envelope + Dialogue
    tl.call(
      () => {
        const curLayout = this.getResponsiveLayout();
        this.polaroids.frames.forEach((frame, idx) => {
          const [px, pz, rotY] = curLayout.polaroidPositions[idx];
          frame.root.position.set(px, 0, pz);
          frame.root.rotation.y = rotY;
        });
        this.polaroids.group.scale.setScalar(curLayout.polaroidScale);

        this.setStage('final');
        this.controls.enabled = true;
        this.controls.target.set(this.camRig.tx, this.camRig.ty, this.camRig.tz);
        gsap.to(this.envelope.state, {
          visibleScale: 1,
          duration: 0.75,
          delay: 0.3,
          ease: 'back.out(1.45)',
        });
        gsap.to(this.polaroids.state, {
          visibleScale: 1,
          duration: 0.8,
          delay: 0.5,
          ease: 'back.out(1.4)',
        });
        gsap.to(this.balloons.state, {
          visibleScale: 1,
          duration: 0.9,
          delay: 0.45,
          ease: 'back.out(1.45)',
        });
        this.scheduleNextDialogue('pikachu', 450);
      },
      undefined,
      settleAt + 1.2
    );
  }

  public skipToFinal(): void {
    if (this.stage === 'final') return;
    if (this.masterTl) {
      this.masterTl.kill();
      this.masterTl = null;
    }
    if (this.giftBoxTl) {
      this.giftBoxTl.kill();
      this.giftBoxTl = null;
    }
    this.giftBoxOpening = false;
    gsap.killTweensOf(this.giftBox.state);
    gsap.killTweensOf(this.giftBox.root.position);
    this.giftBox.state.visibleScale = 0;
    this.giftBox.state.openProgress = 0;
    this.giftBox.state.wobbleActive = 0;
    this.giftBox.root.visible = false;
    (this.giftBoxShadow.material as THREE.MeshBasicMaterial).opacity = 0;

    // Snap all tulips cleanly into the finished wrapped bouquet
    this.bouquet.tulips.forEach((tulip) => {
      const s = tulip.spec;
      gsap.killTweensOf(tulip.state);
      gsap.killTweensOf(tulip.root.position);
      gsap.killTweensOf(tulip.root.rotation);

      const waistDist = 0.86;
      const baseX = Math.sin(s.bouquetTilt[2]) * waistDist * 0.72 + s.bouquetOffset[0] * 0.12;
      const baseZ = -Math.sin(s.bouquetTilt[0]) * waistDist * 0.72 + s.bouquetOffset[2] * 0.12;
      const baseY = 0.12 + s.bouquetOffset[1];

      tulip.root.position.set(baseX, baseY, baseZ);
      tulip.root.rotation.set(s.bouquetTilt[0], s.bouquetTilt[1], s.bouquetTilt[2]);

      tulip.state.stemProgress = 1;
      tulip.state.leafUnfold = 1;
      tulip.state.budScale = 1;
      tulip.state.outerOpen = 1;
      tulip.state.innerOpen = 1;
      tulip.state.moundOpacity = 0;
      tulip.state.leafTuck = 1;
      tulip.state.swayAmp = 0.45;
    });

    gsap.killTweensOf(this.bouquet.state);
    this.bouquet.state.fillerScale = 1;
    this.bouquet.state.wrapOpacity = 1;
    this.bouquet.state.wrapRise = 1;
    this.bouquet.state.wrapFold = 1;
    this.bouquet.state.ribbonScale = 1;
    this.bouquet.state.bowTighten = 1;

    const layout = this.getResponsiveLayout();
    this.bouquet.bouquetGroup.position.set(layout.bouquetX, 0, 0);
    this.bouquet.bouquetGroup.scale.setScalar(layout.bouquetScale);

    this.teddy.root.visible = true;
    this.teddy.root.position.set(layout.teddyX, 0, 0.14);
    this.teddy.root.scale.setScalar(layout.teddyScale);
    this.teddy.root.rotation.y = -0.16;
    this.teddy.state.walkWeight = 0;
    this.teddy.state.sitProgress = 1;
    this.teddy.state.heartLift = 1;
    this.teddy.state.waveAmount = 0;

    this.pikachu.root.visible = true;
    this.pikachu.root.position.set(layout.pikachuX, 0, 0.26);
    this.pikachu.root.scale.setScalar(layout.pikachuScale);
    this.pikachu.root.rotation.y = 0.36;
    this.pikachu.state.hopWeight = 0;
    this.pikachu.state.sitProgress = 1;
    this.pikachu.state.waveAmount = 0;

    this.laddu.root.visible = true;
    this.laddu.root.position.set(layout.ladduX, 0, 0.30);
    this.laddu.root.scale.setScalar(layout.ladduScale);
    this.laddu.root.rotation.y = -0.32;
    this.laddu.state.hopWeight = 0;
    this.laddu.state.waveAmount = 0;

    this.shinchan.root.visible = true;
    this.shinchan.root.position.set(layout.shinchanX, 0, 0.24);
    this.shinchan.root.scale.setScalar(layout.shinchanScale);
    this.shinchan.root.rotation.y = -0.24;
    this.shinchan.state.walkWeight = 0;
    this.shinchan.state.waveAmount = 0;

    this.envelope.root.position.x = layout.envelopeX;
    this.envelope.state.visibleScale = 1;

    this.polaroids.frames.forEach((frame, idx) => {
      const [px, pz, rotY] = layout.polaroidPositions[idx];
      frame.root.position.set(px, 0, pz);
      frame.root.rotation.y = rotY;
    });
    this.polaroids.group.scale.setScalar(layout.polaroidScale);
    this.polaroids.state.visibleScale = 1;
    this.balloons.state.visibleScale = 1;

    this.butterflies.state.opacity = 1;

    (this.bouquetShadow.material as THREE.MeshBasicMaterial).opacity = 0.42;
    (this.teddyShadow.material as THREE.MeshBasicMaterial).opacity = 0.4;
    (this.pikachuShadow.material as THREE.MeshBasicMaterial).opacity = 0.36;
    (this.ladduShadow.material as THREE.MeshBasicMaterial).opacity = 0.34;
    (this.shinchanShadow.material as THREE.MeshBasicMaterial).opacity = 0.36;

    this.setStage('final');
    this.controls.enabled = true;
    this.userControlling = false;
    this.cameraFollowActive = true;
    this.applyResponsiveStageFraming(false);
    this.scheduleNextDialogue('pikachu', 350);
  }

  public setNoteVisible(visible: boolean): void {
    this.noteVisible = visible;
    if (this.stage === 'final') {
      this.userControlling = false;
      this.cameraFollowActive = true;
      this.applyResponsiveStageFraming(false);
    }
  }

  public setWrapperPalette(paletteId: WrapperPaletteId): void {
    const spec = WRAPPER_PALETTES.find((p) => p.id === paletteId) ?? WRAPPER_PALETTES[0];
    this.bouquet.setPalette(spec);
  }

  public setRecipientName(name: string): void {
    this.textures.updateTagName(name);
  }

  public setEnvelopeOpen(open: boolean): void {
    gsap.to(this.envelope.state, {
      openProgress: open ? 1 : 0,
      duration: 0.65,
      ease: 'power2.inOut',
    });
  }

  public setLightingMood(mood: LightingMood): void {
    this.particles.setMood(mood);
    this.lanterns.setActive(mood === 'starlight');
    this.constellation.setMood(mood);

    const presets: Record<
      LightingMood,
      {
        skyTop: string;
        skyMid: string;
        skyBot: string;
        fog: string;
        floor: string;
        exposure: number;
        hemiSky: string;
        hemiGround: string;
        hemiInt: number;
        keyCol: string;
        keyInt: number;
        rimCol: string;
        rimInt: number;
        fillCol: string;
        fillInt: number;
        softboxCol: string;
        softboxInt: number;
      }
    > = {
      morning: {
        skyTop: '#f3c4d7',
        skyMid: '#fce2ec',
        skyBot: '#fff6f9',
        fog: '#fbe8ef',
        floor: '#fff7fa',
        exposure: 1.06,
        hemiSky: '#fff1f6',
        hemiGround: '#dfb7c6',
        hemiInt: 1.15,
        keyCol: '#fff1e4',
        keyInt: 2.0,
        rimCol: '#ffd6e8',
        rimInt: 0.95,
        fillCol: '#ffeaf2',
        fillInt: 1.15,
        softboxCol: '#fff5f8',
        softboxInt: 2.2,
      },
      golden: {
        skyTop: '#e39cb0',
        skyMid: '#fad0bc',
        skyBot: '#fff0dc',
        fog: '#f7dac8',
        floor: '#fff2e6',
        exposure: 1.12,
        hemiSky: '#ffebd2',
        hemiGround: '#d89d8b',
        hemiInt: 1.1,
        keyCol: '#ffd49c',
        keyInt: 2.35,
        rimCol: '#ffc0b4',
        rimInt: 1.18,
        fillCol: '#ffe0c4',
        fillInt: 1.2,
        softboxCol: '#ffecd6',
        softboxInt: 2.05,
      },
      starlight: {
        skyTop: '#241835',
        skyMid: '#4c2d59',
        skyBot: '#824f72',
        fog: '#3e2549',
        floor: '#7a5676',
        exposure: 1.18,
        hemiSky: '#d7baf2',
        hemiGround: '#4a2f52',
        hemiInt: 0.88,
        keyCol: '#ffdfb8',
        keyInt: 1.55,
        rimCol: '#dca8ff',
        rimInt: 1.38,
        fillCol: '#ffb8d9',
        fillInt: 1.48,
        softboxCol: '#e6ccff',
        softboxInt: 1.45,
      },
    };

    const p = presets[mood];
    const tweenColor = (target: THREE.Color, hex: string) => {
      const c = new THREE.Color(hex);
      gsap.to(target, { r: c.r, g: c.g, b: c.b, duration: 1.05, ease: 'power2.inOut' });
    };

    tweenColor(this.skyMat.uniforms.uTopColor.value as THREE.Color, p.skyTop);
    tweenColor(this.skyMat.uniforms.uMidColor.value as THREE.Color, p.skyMid);
    tweenColor(this.skyMat.uniforms.uBottomColor.value as THREE.Color, p.skyBot);
    if (this.scene.fog instanceof THREE.FogExp2) {
      tweenColor(this.scene.fog.color, p.fog);
    }
    tweenColor(this.floorMat.color, p.floor);
    tweenColor(this.hemiLight.color, p.hemiSky);
    tweenColor(this.hemiLight.groundColor, p.hemiGround);
    tweenColor(this.keyLight.color, p.keyCol);
    tweenColor(this.rimLight.color, p.rimCol);
    tweenColor(this.fillLight.color, p.fillCol);

    gsap.to(this.renderer, { toneMappingExposure: p.exposure, duration: 1.05, ease: 'power2.inOut' });
    gsap.to(this.hemiLight, { intensity: p.hemiInt, duration: 1.05, ease: 'power2.inOut' });
    gsap.to(this.keyLight, { intensity: p.keyInt, duration: 1.05, ease: 'power2.inOut' });
    gsap.to(this.rimLight, { intensity: p.rimInt, duration: 1.05, ease: 'power2.inOut' });
    gsap.to(this.fillLight, { intensity: p.fillInt, duration: 1.05, ease: 'power2.inOut' });

    if (this.softboxLight) {
      tweenColor(this.softboxLight.color, p.softboxCol);
      gsap.to(this.softboxLight, { intensity: p.softboxInt, duration: 1.05, ease: 'power2.inOut' });
    }
  }

  public captureSnapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  public triggerHug(isDoubleTap = false): void {
    this.particles.triggerHugBurst(isDoubleTap);
    this.callbacks.onHugBurst?.(isDoubleTap);

    if (this.hugTween) this.hugTween.kill();
    this.teddy.state.hugPulse = 0;
    this.hugTween = gsap.to(this.teddy.state, {
      hugPulse: 1,
      duration: 0.38,
      yoyo: true,
      repeat: 1,
      ease: 'power2.inOut',
    });

    if (isDoubleTap) {
      if (this.kissTween) this.kissTween.kill();
      this.teddy.state.kissPulse = 0;
      this.kissTween = gsap.to(this.teddy.state, {
        kissPulse: 1,
        duration: 0.34,
        yoyo: true,
        repeat: 3,
        ease: 'sine.inOut',
      });
    }

    // Briefly wave warmly on hug too
    gsap.to(this.teddy.state, {
      waveAmount: 0.85,
      duration: 0.35,
      yoyo: true,
      repeat: 1,
      repeatDelay: 0.8,
      ease: 'power2.inOut',
    });
  }

  private clearDialogueLoop(): void {
    if (this.dialogueTimerId) {
      window.clearTimeout(this.dialogueTimerId);
      this.dialogueTimerId = 0;
    }
    this.callbacks.onDialogueChange?.(null);
  }

  private scheduleNextDialogue(nextSpeaker: Exclude<DialogueSpeaker, null>, delayMs: number): void {
    if (this.dialogueTimerId) window.clearTimeout(this.dialogueTimerId);
    this.dialogueTimerId = window.setTimeout(() => {
      if (this.disposed || this.stage !== 'final') return;
      this.playDialogueTurn(nextSpeaker);
    }, delayMs);
  }

  private playDialogueTurn(speaker: Exclude<DialogueSpeaker, null>): void {
    if (this.disposed || this.stage !== 'final') return;
    this.callbacks.onDialogueChange?.(speaker);

    if (speaker === 'pikachu') {
      this.animatePikachuTalk();
      this.scheduleNextDialogue('laddu', 3300);
    } else if (speaker === 'laddu') {
      this.animateLadduTalk();
      this.scheduleNextDialogue('shinchan', 3300);
    } else {
      this.animateShinchanTalk();
      this.scheduleNextDialogue('pikachu', 3300);
    }
  }

  private animatePikachuTalk(): void {
    if (this.sparkTween) this.sparkTween.kill();
    this.pikachu.state.sparkPulse = 0;
    this.sparkTween = gsap.to(this.pikachu.state, {
      sparkPulse: 1,
      duration: 0.28,
      yoyo: true,
      repeat: 3,
      ease: 'sine.inOut',
    });
    gsap.to(this.pikachu.state, {
      waveAmount: 0.9,
      duration: 0.32,
      yoyo: true,
      repeat: 1,
      repeatDelay: 0.9,
      ease: 'power2.inOut',
    });
  }

  private animateLadduTalk(): void {
    if (this.ladduTween) this.ladduTween.kill();
    this.laddu.state.lovePulse = 0;
    this.ladduTween = gsap.to(this.laddu.state, {
      lovePulse: 1,
      duration: 0.28,
      yoyo: true,
      repeat: 3,
      ease: 'sine.inOut',
    });
    gsap.to(this.laddu.state, {
      waveAmount: 0.9,
      duration: 0.32,
      yoyo: true,
      repeat: 1,
      repeatDelay: 0.9,
      ease: 'power2.inOut',
    });
  }

  private animateShinchanTalk(): void {
    if (this.shinchanTween) this.shinchanTween.kill();
    this.shinchan.state.cheekyPulse = 0;
    this.shinchanTween = gsap.to(this.shinchan.state, {
      cheekyPulse: 1,
      duration: 0.28,
      yoyo: true,
      repeat: 3,
      ease: 'sine.inOut',
    });
    gsap.to(this.shinchan.state, {
      waveAmount: 0.92,
      duration: 0.32,
      yoyo: true,
      repeat: 1,
      repeatDelay: 0.85,
      ease: 'power2.inOut',
    });
  }

  public triggerPikachuSpark(isDoubleTap = false): void {
    this.particles.triggerHugBurst(false);
    if (isDoubleTap) {
      this.particles.triggerSparkArc(
        this.pikachu.root.position.x,
        1.05,
        this.laddu.root.position.x,
        1.05
      );
      this.laddu.state.spinAngle = 0;
      gsap.to(this.laddu.state, {
        spinAngle: Math.PI * 2,
        duration: 0.72,
        ease: 'power2.out',
        onComplete: () => {
          this.laddu.state.spinAngle = 0;
        },
      });
      this.animateLadduTalk();
      this.callbacks.onPikachuDoubleSpark?.();
    } else {
      this.callbacks.onPikachuTap?.();
    }

    if (this.stage === 'final') {
      this.playDialogueTurn('pikachu');
    } else {
      this.animatePikachuTalk();
    }
  }

  public triggerLadduLove(): void {
    this.particles.triggerHugBurst(false);
    this.callbacks.onLadduTap?.();
    if (this.stage === 'final') {
      this.playDialogueTurn('laddu');
    } else {
      this.animateLadduTalk();
    }
  }

  public triggerShinchanCheeky(isDoubleTap = false): void {
    this.particles.triggerHugBurst(isDoubleTap);
    this.callbacks.onShinchanTap?.(isDoubleTap);

    if (isDoubleTap) {
      this.shinchan.state.spinAngle = 0;
      gsap.to(this.shinchan.state, {
        spinAngle: Math.PI * 2,
        duration: 0.68,
        ease: 'power2.out',
        onComplete: () => {
          this.shinchan.state.spinAngle = 0;
        },
      });
    }

    if (this.stage === 'final') {
      this.playDialogueTurn('shinchan');
    } else {
      this.animateShinchanTalk();
    }
  }

  public setHeartText(text: string): void {
    this.teddy.setHeartText(text);
  }

  public cycleHeartText(): void {
    this.heartPresetIdx = (this.heartPresetIdx + 1) % HEART_MESSAGE_PRESETS.length;
    const nextText = HEART_MESSAGE_PRESETS[this.heartPresetIdx];
    this.teddy.setHeartText(nextText);
    gsap.to(this.teddy.state, {
      hugPulse: 0.75,
      duration: 0.28,
      yoyo: true,
      repeat: 1,
      ease: 'power2.out',
    });
    this.particles.triggerHugBurst(false);
    this.callbacks.onHeartTextCycle?.(nextText);
  }

  public setDanceMode(enabled: boolean): void {
    this.danceMode = enabled;
    const target = enabled ? 1 : 0;
    gsap.to(this.teddy.state, { danceWeight: target, duration: 0.45, ease: 'power2.out' });
    gsap.to(this.pikachu.state, { danceWeight: target, duration: 0.45, ease: 'power2.out' });
    gsap.to(this.laddu.state, { danceWeight: target, duration: 0.45, ease: 'power2.out' });
    gsap.to(this.shinchan.state, { danceWeight: target, duration: 0.45, ease: 'power2.out' });
    if (enabled) {
      this.butterflies.scatter();
      this.particles.triggerHugBurst(false);
    }
  }

  public releaseLanterns(): void {
    this.lanterns.releaseBurst();
    this.callbacks.onLanternRelease?.();
  }

  public triggerMakeWish(): void {
    this.constellation.triggerWish();
    this.butterflies.scatter();
    this.callbacks.onWishCast?.();
  }

  public setAccessories(selection: AccessorySelection): void {
    this.accessories.setSelection(selection);
  }

  public setPolaroidMemory(index: number, caption: string, imageDataUrl?: string): void {
    this.polaroids.setMemory(index, caption, imageDataUrl);
  }

  public triggerCelebrate(): void {
    this.particles.triggerFireworks();
    this.particles.triggerHugBurst(false);
    this.butterflies.scatter();
    this.callbacks.onCelebrateBurst?.();

    // Festive companion wave & joyful bouquet sway
    gsap.to(this.teddy.state, {
      waveAmount: 0.95,
      hugPulse: 0.8,
      duration: 0.38,
      yoyo: true,
      repeat: 1,
      repeatDelay: 0.9,
      ease: 'power2.inOut',
    });
    this.animatePikachuTalk();
    this.animateLadduTalk();
    this.animateShinchanTalk();

    this.bouquet.tulips.forEach((t) => {
      gsap.to(t.state, {
        swayAmp: 1.45,
        duration: 0.55,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      });
    });
  }

  private resetObjects(): void {
    this.clearDialogueLoop();
    if (this.giftBoxTl) {
      this.giftBoxTl.kill();
      this.giftBoxTl = null;
    }
    this.giftBoxOpening = false;
    gsap.killTweensOf(this.giftBox.state);
    gsap.killTweensOf(this.giftBox.root.position);
    this.giftBox.state.visibleScale = 0;
    this.giftBox.state.openProgress = 0;
    this.giftBox.state.wobbleActive = 0;
    this.giftBox.root.visible = false;

    this.bouquet.bouquetGroup.position.set(0, 0, 0);
    this.bouquet.bouquetGroup.rotation.set(0, 0, 0);
    this.bouquet.bouquetGroup.scale.setScalar(1);

    this.bouquet.state.wrapRise = 0;
    this.bouquet.state.wrapFold = 0;
    this.bouquet.state.wrapOpacity = 0;
    this.bouquet.state.ribbonScale = 0;
    this.bouquet.state.bowTighten = 0;
    this.bouquet.state.fillerScale = 0;

    this.bouquet.tulips.forEach((tulip) => {
      tulip.root.position.set(...tulip.spec.gardenPos);
      tulip.root.rotation.set(0, 0, 0);
      tulip.state.stemProgress = 0.001;
      tulip.state.leafUnfold = 0;
      tulip.state.budScale = 0.001;
      tulip.state.outerOpen = 0;
      tulip.state.innerOpen = 0;
      tulip.state.moundOpacity = 1;
      tulip.state.leafTuck = 0;
      tulip.state.swayAmp = 0;
      tulip.state.highlightGlow = 0;
    });

    (this.bouquetShadow.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.giftBoxShadow.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.teddyShadow.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.pikachuShadow.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.ladduShadow.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.shinchanShadow.material as THREE.MeshBasicMaterial).opacity = 0;

    this.teddy.root.visible = false;
    this.teddy.state.walkCycle = 0;
    this.teddy.state.walkWeight = 0;
    this.teddy.state.sitProgress = 0;
    this.teddy.state.waveAmount = 0;
    this.teddy.state.heartLift = 1;
    this.teddy.state.hugPulse = 0;
    this.teddy.state.kissPulse = 0;
    this.teddy.state.danceWeight = 0;

    this.pikachu.root.visible = false;
    this.pikachu.state.hopCycle = 0;
    this.pikachu.state.hopWeight = 0;
    this.pikachu.state.sitProgress = 0;
    this.pikachu.state.waveAmount = 0;
    this.pikachu.state.sparkPulse = 0;
    this.pikachu.state.danceWeight = 0;
    this.pikachu.state.spinAngle = 0;

    this.laddu.root.visible = false;
    this.laddu.state.hopCycle = 0;
    this.laddu.state.hopWeight = 0;
    this.laddu.state.waveAmount = 0;
    this.laddu.state.lovePulse = 0;
    this.laddu.state.danceWeight = 0;
    this.laddu.state.spinAngle = 0;

    this.shinchan.root.visible = false;
    this.shinchan.state.walkCycle = 0;
    this.shinchan.state.walkWeight = 0;
    this.shinchan.state.waveAmount = 0;
    this.shinchan.state.cheekyPulse = 0;
    this.shinchan.state.danceWeight = 0;
    this.shinchan.state.spinAngle = 0;

    this.danceMode = false;
    this.butterflies.state.opacity = 0;
    this.butterflies.state.scatterBoost = 0;
    this.polaroids.state.visibleScale = 0;
    this.balloons.state.visibleScale = 0;
    this.constellation.reset();
    this.envelope.state.visibleScale = 0;
    this.envelope.state.openProgress = 0;
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const dt = this.clock.getDelta();
    this.elapsed += dt;

    // Update tulip geometry & breeze sway
    for (let i = 0; i < this.bouquet.tulips.length; i++) {
      this.bouquet.tulips[i].updateGeometry(this.elapsed, i);
    }

    // Update wrapping paper & ribbon
    this.bouquet.updateWrapping();

    // Gentle celebratory float/tilt on assembled bouquet in final scene
    if (this.stage === 'final' || this.stage === 'teddy') {
      this.bouquet.bouquetGroup.rotation.z = Math.sin(this.elapsed * 0.9) * 0.02 + 0.04;
      this.bouquet.bouquetGroup.rotation.y = Math.sin(this.elapsed * 0.55) * 0.06 + 0.14;
    }

    // Update Teddy, Pikachu, Laddu & Shinchan poses + contact shadow tracking
    if (this.teddy.root.visible) {
      this.teddy.updatePose(this.elapsed);
      this.teddyShadow.position.x = this.teddy.root.position.x;
    }
    if (this.pikachu.root.visible) {
      this.pikachu.updatePose(this.elapsed);
      this.pikachuShadow.position.x = this.pikachu.root.position.x;
    }
    if (this.laddu.root.visible) {
      this.laddu.updatePose(this.elapsed);
      this.ladduShadow.position.x = this.laddu.root.position.x;
    }
    if (this.shinchan.root.visible) {
      this.shinchan.updatePose(this.elapsed);
      this.shinchanShadow.position.x = this.shinchan.root.position.x;
    }
    this.bouquetShadow.position.x = this.bouquet.bouquetGroup.position.x;

    // Update 3D wax-sealed envelope, gift box, Polaroids, butterflies, sky lanterns & particles
    this.envelope.update(this.elapsed);
    this.giftBox.update(this.elapsed);
    this.giftBoxShadow.position.x = this.giftBox.root.position.x;
    this.polaroids.update(this.elapsed);
    this.constellation.update(dt, this.elapsed);
    this.balloons.update(dt, this.elapsed);
    this.butterflies.update(dt, this.elapsed);
    this.lanterns.update(dt, this.elapsed);
    this.particles.update(dt, this.elapsed);

    // Camera choreography & OrbitControls
    if (this.stage === 'intro') {
      const f = this.getStageFraming('intro');
      this.camera.position.set(
        f.pos[0] + Math.sin(this.elapsed * 0.28) * 1.15,
        f.pos[1] + Math.cos(this.elapsed * 0.22) * 0.18,
        f.pos[2] + Math.cos(this.elapsed * 0.28) * 0.45
      );
      this.camera.lookAt(f.target[0], f.target[1], f.target[2]);
    } else if (this.cameraFollowActive && !this.userControlling) {
      _camTargetPos.set(this.camRig.x, this.camRig.y, this.camRig.z);
      _camTargetLook.set(this.camRig.tx, this.camRig.ty, this.camRig.tz);
      this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-5.5 * dt));
      _currentLook.lerp(_camTargetLook, 1 - Math.exp(-5.5 * dt));
      this.camera.lookAt(_currentLook);
      this.controls.target.copy(_currentLook);
    } else if (this.controls.enabled) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);

    // Project 3D speech anchors above Pikachu, Laddu & Shinchan to screen pixels
    if (this.stage === 'final' && this.callbacks.onBubbleProject) {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      const projectAnchor = (obj: THREE.Object3D): BubbleScreenCoords => {
        obj.getWorldPosition(_projVec);
        _projVec.project(this.camera);
        const visible = _projVec.z >= -1 && _projVec.z <= 1;
        const rawX = (_projVec.x * 0.5 + 0.5) * w;
        const rawY = (-_projVec.y * 0.5 + 0.5) * h;
        return {
          x: THREE.MathUtils.clamp(rawX, 92, Math.max(92, w - 92)),
          y: THREE.MathUtils.clamp(rawY, 72, Math.max(72, h - 180)),
          visible,
        };
      };
      this.callbacks.onBubbleProject({
        pikachu: projectAnchor(this.pikachu.speechAnchor),
        laddu: projectAnchor(this.laddu.speechAnchor),
        shinchan: projectAnchor(this.shinchan.speechAnchor),
      });
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private handlePointerDown = (e: PointerEvent): void => {
    this.pointerDownPos.set(e.clientX, e.clientY);
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (this.stage !== 'final' && this.stage !== 'giftbox') return;
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 36) return; // drag/orbit, not click

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    // Gift Box Pop-Open Stage: tap anywhere on the 3D Gift Box to reveal Teddy inside!
    if (this.stage === 'giftbox') {
      if (this.giftBox.root.visible) {
        const boxHits = this.raycaster.intersectObject(this.giftBox.root, true);
        if (boxHits.length > 0) {
          this.openGiftBox();
        }
      }
      return;
    }

    // 1. Check 3D Wax-Sealed Envelope
    if (this.envelope.root.visible) {
      const envHits = this.raycaster.intersectObject(this.envelope.root, true);
      if (envHits.length > 0) {
        this.setEnvelopeOpen(true);
        this.particles.triggerHugBurst(false);
        this.callbacks.onEnvelopeOpen?.();
        return;
      }
    }

    // 2. Check 3D Memory Polaroid Frames
    if (this.polaroids.state.visibleScale > 0.2) {
      for (const frame of this.polaroids.frames) {
        const pHits = this.raycaster.intersectObject(frame.root, true);
        if (pHits.length > 0) {
          this.particles.triggerHugBurst(false);
          this.callbacks.onPolaroidSelect?.({ ...frame.spec });
          return;
        }
      }
    }

    // 3. Check Teddy's Plush Heart specifically (cycle conversation heart text!)
    const heartHits = this.raycaster.intersectObject(this.teddy.heartGroup, true);
    if (heartHits.length > 0) {
      this.cycleHeartText();
      return;
    }

    // 4. Check Plush Teddy Bear (single-tap hug & double-tap kiss)
    const teddyHits = this.raycaster.intersectObject(this.teddy.root, true);
    if (teddyHits.length > 0) {
      const now = performance.now();
      const isDoubleTap = now - this.lastTeddyTapAt < 400;
      this.lastTeddyTapAt = now;
      this.triggerHug(isDoubleTap);
      return;
    }

    // 5. Check Shinchan (cheerful wiggle/bubble & double-tap 360 spin)
    if (this.shinchan.root.visible) {
      const shinHits = this.raycaster.intersectObject(this.shinchan.root, true);
      if (shinHits.length > 0) {
        const now = performance.now();
        const isDoubleTap = now - this.lastShinchanTapAt < 400;
        this.lastShinchanTapAt = now;
        this.triggerShinchanCheeky(isDoubleTap);
        return;
      }
    }

    // 6. Check Pikachu (single-tap bubble, double-tap golden spark arc to Laddu!)
    if (this.pikachu.root.visible) {
      const pikaHits = this.raycaster.intersectObject(this.pikachu.root, true);
      if (pikaHits.length > 0) {
        const now = performance.now();
        const isDoubleTap = now - this.lastPikachuTapAt < 400;
        this.lastPikachuTapAt = now;
        this.triggerPikachuSpark(isDoubleTap);
        return;
      }
    }

    // 7. Check Laddu
    if (this.laddu.root.visible) {
      const ladduHits = this.raycaster.intersectObject(this.laddu.root, true);
      if (ladduHits.length > 0) {
        this.triggerLadduLove();
        return;
      }
    }

    // 8. Check Butterflies (playful flutter scatter!)
    if (this.butterflies.state.opacity > 0.2) {
      const bHits = this.raycaster.intersectObject(this.butterflies.group, true);
      if (bHits.length > 0) {
        this.butterflies.scatter();
        this.particles.triggerHugBurst(false);
        return;
      }
    }

    // 9. Check Tappable 3D Heart Balloons (pop with heart/sparkle burst & re-inflate!)
    if (this.balloons.state.visibleScale > 0.2) {
      for (const b of this.balloons.balloons) {
        if (!b.balloonPivot.visible) continue;
        const balloonHits = this.raycaster.intersectObject(b.balloonPivot, true);
        if (balloonHits.length > 0) {
          const popPos = this.balloons.tapBalloon(b.index);
          if (popPos) {
            this.particles.triggerGiftBoxPop(popPos.x, popPos.y, popPos.z);
            this.callbacks.onBalloonPop?.();
            return;
          }
        }
      }
    }

    // 6. Check Individual Tulips for shade-specific romantic whispers
    let closestTulip = null;
    let closestDist = Infinity;
    for (const tulip of this.bouquet.tulips) {
      const hits = this.raycaster.intersectObject(tulip.headGroup, true);
      if (hits.length > 0 && hits[0].distance < closestDist) {
        closestDist = hits[0].distance;
        closestTulip = tulip;
      }
    }

    if (closestTulip) {
      this.bouquet.tulips.forEach((t) => {
        gsap.to(t.state, {
          highlightGlow: t === closestTulip ? 1 : 0,
          duration: 0.35,
          ease: 'power2.out',
        });
      });
      gsap.to(closestTulip.state, {
        highlightGlow: 0,
        delay: 2.8,
        duration: 0.8,
        ease: 'power2.inOut',
      });
      gsap.to(closestTulip.state, {
        swayAmp: 1.55,
        duration: 0.42,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      });
      this.callbacks.onTulipSelect?.(closestTulip.spec);
      return;
    }

    // 7. Fallback: clicking wrapping/stems gently sways the bouquet & swirls petals
    const bouquetHits = this.raycaster.intersectObject(this.bouquet.bouquetGroup, true);
    if (bouquetHits.length > 0) {
      this.particles.triggerHugBurst(false);
      this.bouquet.tulips.forEach((t) => {
        gsap.to(t.state, {
          swayAmp: 1.4,
          duration: 0.45,
          yoyo: true,
          repeat: 1,
          ease: 'sine.inOut',
        });
      });
    }
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.applyResponsiveStageFraming(false);
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
  };

  private handleContextRestored = (): void => {
    this.tick();
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.clearDialogueLoop();

    if (this.masterTl) this.masterTl.kill();
    if (this.giftBoxTl) this.giftBoxTl.kill();
    if (this.hugTween) this.hugTween.kill();
    if (this.kissTween) this.kissTween.kill();
    if (this.sparkTween) this.sparkTween.kill();
    if (this.ladduTween) this.ladduTween.kill();
    if (this.shinchanTween) this.shinchanTween.kill();

    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.controls.dispose();
    this.bouquet.dispose();
    this.teddy.dispose();
    this.pikachu.dispose();
    this.laddu.dispose();
    this.shinchan.dispose();
    this.envelope.dispose();
    this.giftBox.dispose();
    this.butterflies.dispose();
    this.lanterns.dispose();
    this.polaroids.dispose();
    this.constellation.dispose();
    this.balloons.dispose();
    this.accessories.dispose();
    this.particles.dispose();
    this.textures.dispose();
    this.envRT?.dispose();
    (this.bouquetShadow.material as THREE.Material).dispose();
    (this.giftBoxShadow.material as THREE.Material).dispose();
    (this.teddyShadow.material as THREE.Material).dispose();
    (this.pikachuShadow.material as THREE.Material).dispose();
    (this.ladduShadow.material as THREE.Material).dispose();
    (this.shinchanShadow.material as THREE.Material).dispose();
    this.shadowMat.dispose();
    this.disposables.forEach((d) => d.dispose());

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
