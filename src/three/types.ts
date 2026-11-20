import * as THREE from 'three';

export type ExperienceStage = 'intro' | 'growing' | 'assembly' | 'giftbox' | 'teddy' | 'final';

export type LightingMood = 'morning' | 'golden' | 'starlight';

export type WrapperPaletteId = 'blush' | 'ivory' | 'lavender' | 'crimson';

export interface WrapperPaletteSpec {
  id: WrapperPaletteId;
  label: string;
  paperTint: string;
  tissueTint: string;
  ribbonTint: string;
  swatchHex: string;
}

export const WRAPPER_PALETTES: WrapperPaletteSpec[] = [
  {
    id: 'blush',
    label: 'Blush Silk',
    paperTint: '#ffffff',
    tissueTint: '#ffd9e6',
    ribbonTint: '#ffffff',
    swatchHex: '#eb8eab',
  },
  {
    id: 'ivory',
    label: 'Champagne Ivory',
    paperTint: '#fffaf0',
    tissueTint: '#f9ebd2',
    ribbonTint: '#f2d3b3',
    swatchHex: '#e6c79c',
  },
  {
    id: 'lavender',
    label: 'Lavender Mist',
    paperTint: '#f7f0ff',
    tissueTint: '#e7d6fa',
    ribbonTint: '#c9a6ed',
    swatchHex: '#b48ee0',
  },
  {
    id: 'crimson',
    label: 'Velvet Crimson',
    paperTint: '#fdf2f4',
    tissueTint: '#fad2dc',
    ribbonTint: '#bf345c',
    swatchHex: '#a8224a',
  },
];

export interface TulipShadeSpec {
  id: string;
  name: string;
  loveNote: string;
  baseColor: string;
  midColor: string;
  tipColor: string;
  throatColor: string;
  veinColor: string;
  emissiveTint: string;
  gardenPos: [number, number, number];
  bouquetOffset: [number, number, number];
  bouquetTilt: [number, number, number];
  scale: number;
  stemHeight: number;
}

export const TULIP_SHADES: TulipShadeSpec[] = [
  {
    id: 'rose-pink',
    name: 'Rose Pink',
    loveNote: 'For the warmth of your smile that brightens every day',
    baseColor: '#d9487b',
    midColor: '#eb6c99',
    tipColor: '#f8a5c2',
    throatColor: '#ffe3ec',
    veinColor: '#c22f65',
    emissiveTint: '#6e1d3a',
    gardenPos: [0.0, 0, -0.35],
    bouquetOffset: [0.0, 0.24, 0.02],
    bouquetTilt: [0.04, 0.1, 0.0],
    scale: 1.04,
    stemHeight: 2.35,
  },
  {
    id: 'soft-pink',
    name: 'Soft Pink',
    loveNote: 'For every gentle, quiet moment we share together',
    baseColor: '#f293b2',
    midColor: '#f8b4cb',
    tipColor: '#ffdce8',
    throatColor: '#fff5f8',
    veinColor: '#df7297',
    emissiveTint: '#6a2d43',
    gardenPos: [-1.15, 0, 0.15],
    bouquetOffset: [-0.36, 0.14, 0.22],
    bouquetTilt: [0.22, 0.4, 0.34],
    scale: 0.98,
    stemHeight: 2.18,
  },
  {
    id: 'deep-red',
    name: 'Deep Red',
    loveNote: 'For a love that only grows deeper with time',
    baseColor: '#8e1330',
    midColor: '#b81d41',
    tipColor: '#d8385c',
    throatColor: '#3e0714',
    veinColor: '#690920',
    emissiveTint: '#4f0818',
    gardenPos: [1.12, 0, 0.18],
    bouquetOffset: [0.35, 0.15, 0.2],
    bouquetTilt: [0.2, -0.4, -0.34],
    scale: 1.0,
    stemHeight: 2.22,
  },
  {
    id: 'cream-white',
    name: 'Cream White',
    loveNote: 'For how safe, pure, and peaceful you make me feel',
    baseColor: '#f6ebd8',
    midColor: '#fdf8f0',
    tipColor: '#fffdf9',
    throatColor: '#f3d999',
    veinColor: '#e8d8c0',
    emissiveTint: '#5e5040',
    gardenPos: [-0.62, 0, 0.65],
    bouquetOffset: [-0.22, 0.19, -0.25],
    bouquetTilt: [-0.24, 0.2, 0.22],
    scale: 0.96,
    stemHeight: 2.26,
  },
  {
    id: 'blush-pink',
    name: 'Blush Pink',
    loveNote: 'For the way you still make my heart skip a beat',
    baseColor: '#f5b8b0',
    midColor: '#fad2cc',
    tipColor: '#ffece8',
    throatColor: '#fff7e8',
    veinColor: '#e3968c',
    emissiveTint: '#663c37',
    gardenPos: [0.65, 0, 0.62],
    bouquetOffset: [0.23, 0.18, -0.24],
    bouquetTilt: [-0.24, -0.25, -0.22],
    scale: 0.97,
    stemHeight: 2.2,
  },
  {
    id: 'lavender',
    name: 'Lavender',
    loveNote: 'For the quiet magic you bring into my world',
    baseColor: '#a67cd4',
    midColor: '#c3a2e6',
    tipColor: '#e3cff7',
    throatColor: '#f6eeff',
    veinColor: '#8a5ec0',
    emissiveTint: '#452b63',
    gardenPos: [-1.72, 0, -0.45],
    bouquetOffset: [-0.46, 0.06, -0.02],
    bouquetTilt: [0.02, 0.6, 0.44],
    scale: 0.94,
    stemHeight: 2.08,
  },
  {
    id: 'peach-pink',
    name: 'Peach Pink',
    loveNote: 'For all the bright, sweet tomorrows waiting for us',
    baseColor: '#f58b76',
    midColor: '#ffae99',
    tipColor: '#ffd9cc',
    throatColor: '#fff1de',
    veinColor: '#de6d58',
    emissiveTint: '#6b3126',
    gardenPos: [1.68, 0, -0.42],
    bouquetOffset: [0.45, 0.07, -0.02],
    bouquetTilt: [0.02, -0.55, -0.43],
    scale: 0.95,
    stemHeight: 2.1,
  },
];

export interface DisposableResource {
  dispose: () => void;
}

export interface BubbleScreenCoords {
  x: number;
  y: number;
  visible: boolean;
}

export type DialogueSpeaker = 'pikachu' | 'laddu' | 'shinchan' | null;

export const HEART_MESSAGE_PRESETS = [
  'Always Yours',
  'Forever ♡',
  'My Princess',
  'Hug Me ♡',
  'Love You',
] as const;

export interface PolaroidMemorySpec {
  id: string;
  caption: string;
  imageDataUrl?: string;
}

export interface AccessorySelection {
  flowerCrown: boolean;
  partyHat: boolean;
  bowtie: boolean;
  heartShades: boolean;
}

export const DEFAULT_ACCESSORIES: AccessorySelection = {
  flowerCrown: true,
  partyHat: false,
  bowtie: false,
  heartShades: false,
};

export interface SceneCallbacks {
  onStageChange?: (stage: ExperienceStage) => void;
  onHugBurst?: (isDoubleTap?: boolean) => void;
  onCelebrateBurst?: () => void;
  onPikachuTap?: () => void;
  onPikachuDoubleSpark?: () => void;
  onLadduTap?: () => void;
  onShinchanTap?: (isDoubleTap?: boolean) => void;
  onHeartTextCycle?: (text: string) => void;
  onPolaroidSelect?: (memory: PolaroidMemorySpec) => void;
  onLanternRelease?: () => void;
  onWishCast?: () => void;
  onBalloonPop?: () => void;
  onDialogueChange?: (speaker: DialogueSpeaker) => void;
  onBubbleProject?: (coords: {
    pikachu: BubbleScreenCoords;
    laddu: BubbleScreenCoords;
    shinchan: BubbleScreenCoords;
  }) => void;
  onTulipSelect?: (tulip: TulipShadeSpec) => void;
  onEnvelopeOpen?: () => void;
  onGiftBoxOpen?: () => void;
}

export interface ThreeTextureBundle {
  petalBump: THREE.CanvasTexture;
  leafMap: THREE.CanvasTexture;
  leafBump: THREE.CanvasTexture;
  furMap: THREE.CanvasTexture;
  furBump: THREE.CanvasTexture;
  creamPatchMap: THREE.CanvasTexture;
  paperMap: THREE.CanvasTexture;
  paperBump: THREE.CanvasTexture;
  satinMap: THREE.CanvasTexture;
  tagMap: THREE.CanvasTexture;
  updateTagName: (recipientName: string) => void;
  floorMap: THREE.CanvasTexture;
  floorRoughness: THREE.CanvasTexture;
  shadowSprite: THREE.CanvasTexture;
  sparkleSprite: THREE.CanvasTexture;
  dispose: () => void;
}
