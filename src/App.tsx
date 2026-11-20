import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Flame,
  Gift,
  Heart,
  ImagePlus,
  Mail,
  Moon,
  Music,
  PenLine,
  RotateCcw,
  SkipForward,
  Sparkles,
  Star,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { BloomingLoveScene } from './three/sceneController';
import { MusicBoxAudio } from './audio/musicBox';
import { DEFAULT_POLAROID_MEMORIES } from './three/polaroidBuilder';
import {
  DEFAULT_ACCESSORIES,
  HEART_MESSAGE_PRESETS,
  WRAPPER_PALETTES,
  type AccessorySelection,
  type DialogueSpeaker,
  type ExperienceStage,
  type LightingMood,
  type PolaroidMemorySpec,
  type TulipShadeSpec,
  type WrapperPaletteId,
} from './three/types';

const STAGE_CAPTIONS: Record<Exclude<ExperienceStage, 'intro' | 'final'>, string> = {
  growing: 'Seven tulips are blooming gently in the breeze',
  assembly: 'Gathering each bloom into a hand-tied bouquet',
  giftbox: 'A special surprise is inside — tap the 3D gift box to open!',
  teddy: 'Teddy popped out! Pikachu, Laddu & Shinchan are joining too',
};

const DEFAULT_RECIPIENT = 'Ammu';

const DEFAULT_NOTE =
  "I couldn't bring you a whole garden,\nso I created this little one just for you.\n\n" +
  "Every tulip carries a little piece of my love.\nAnd this teddy is here to remind you\nthat you're always special to me.\n\n" +
  'You deserve all the flowers in the world,\nmy princess. 🌷';

const DEFAULT_SECRET =
  'Open whenever you miss me:\nNo matter how busy or far apart a day feels,\nyou are always my favorite thought. ♡';

const DEFAULT_PIKA_LINE = 'I love you, Laddu! ⚡💗';
const DEFAULT_LADDU_LINE = 'I love you, Pikachu! 🍬💗';
const DEFAULT_SHIN_LINE = 'Hehe, you two are the cutest! 🕺💗';
const DEFAULT_HEART_TEXT = HEART_MESSAGE_PRESETS[0];

const MOOD_OPTIONS: { id: LightingMood; label: string; Icon: typeof Sun }[] = [
  { id: 'morning', label: 'Morning', Icon: Sun },
  { id: 'golden', label: 'Golden', Icon: Sunset },
  { id: 'starlight', label: 'Starlight', Icon: Moon },
];

function parseInitialParams() {
  if (typeof window === 'undefined') {
    return {
      to: DEFAULT_RECIPIENT,
      note: DEFAULT_NOTE,
      secret: DEFAULT_SECRET,
      palette: 'blush' as WrapperPaletteId,
      mood: 'morning' as LightingMood,
      pikaLine: DEFAULT_PIKA_LINE,
      ladduLine: DEFAULT_LADDU_LINE,
      shinLine: DEFAULT_SHIN_LINE,
      heartText: DEFAULT_HEART_TEXT as string,
      accessories: { ...DEFAULT_ACCESSORIES },
    };
  }
  const params = new URLSearchParams(window.location.search);
  const to = (params.get('to') || DEFAULT_RECIPIENT).slice(0, 24);
  const note = (params.get('note') || DEFAULT_NOTE).slice(0, 600);
  const secret = (params.get('secret') || DEFAULT_SECRET).slice(0, 400);
  const rawPalette = params.get('palette') as WrapperPaletteId | null;
  const palette: WrapperPaletteId = WRAPPER_PALETTES.some((p) => p.id === rawPalette)
    ? (rawPalette as WrapperPaletteId)
    : 'blush';
  const rawMood = params.get('mood') as LightingMood | null;
  const mood: LightingMood =
    rawMood === 'morning' || rawMood === 'golden' || rawMood === 'starlight' ? rawMood : 'morning';
  const pikaLine = (params.get('pika') || DEFAULT_PIKA_LINE).slice(0, 48);
  const ladduLine = (params.get('laddu') || DEFAULT_LADDU_LINE).slice(0, 48);
  const shinLine = (params.get('shin') || DEFAULT_SHIN_LINE).slice(0, 48);
  const heartText = (params.get('heart') || DEFAULT_HEART_TEXT).slice(0, 18);

  const rawAcc = params.get('acc');
  const accessories: AccessorySelection =
    rawAcc === null
      ? { ...DEFAULT_ACCESSORIES }
      : (() => {
          const tokens = new Set(rawAcc.split(',').map((t) => t.trim()));
          return {
            flowerCrown: tokens.has('crown'),
            partyHat: tokens.has('hat'),
            bowtie: tokens.has('bow'),
            heartShades: tokens.has('shades'),
          };
        })();

  return { to, note, secret, palette, mood, pikaLine, ladduLine, shinLine, heartText, accessories };
}

export default function App() {
  const initial = useMemo(() => parseInitialParams(), []);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<BloomingLoveScene | null>(null);
  const audioRef = useRef<MusicBoxAudio | null>(null);
  const tulipTimerRef = useRef<number | null>(null);
  const hugTimerRef = useRef<number | null>(null);
  const pikachuBubbleRef = useRef<HTMLDivElement | null>(null);
  const ladduBubbleRef = useRef<HTMLDivElement | null>(null);
  const shinchanBubbleRef = useRef<HTMLDivElement | null>(null);

  const [stage, setStage] = useState<ExperienceStage>('intro');
  const [muted, setMuted] = useState(false);
  const [noteOpen, setNoteOpen] = useState(true);
  const [danceMode, setDanceMode] = useState(false);
  const [hugCount, setHugCount] = useState(0);
  const [hugFeedback, setHugFeedback] = useState<
    | 'hug'
    | 'kiss'
    | 'pika'
    | 'pikaDouble'
    | 'laddu'
    | 'shinchan'
    | 'shinchanDouble'
    | 'celebrate'
    | 'lanterns'
    | 'wish'
    | 'balloon'
    | 'heartText'
    | null
  >(null);
  const [dialogueSpeaker, setDialogueSpeaker] = useState<DialogueSpeaker>(null);

  // Interactive 3D Surprises & Keepsake Customization state
  const [mood, setMood] = useState<LightingMood>(initial.mood);
  const [paletteId, setPaletteId] = useState<WrapperPaletteId>(initial.palette);
  const [recipientName, setRecipientName] = useState(initial.to);
  const [customNote, setCustomNote] = useState(initial.note);
  const [secretNote, setSecretNote] = useState(initial.secret);
  const [pikaLine, setPikaLine] = useState(initial.pikaLine);
  const [ladduLine, setLadduLine] = useState(initial.ladduLine);
  const [shinLine, setShinLine] = useState(initial.shinLine);
  const [heartText, setHeartText] = useState(initial.heartText);
  const [accessories, setAccessories] = useState<AccessorySelection>(initial.accessories);
  const [memories, setMemories] = useState<PolaroidMemorySpec[]>(() =>
    DEFAULT_POLAROID_MEMORIES.map((m) => ({ ...m }))
  );

  const [selectedTulip, setSelectedTulip] = useState<TulipShadeSpec | null>(null);
  const [selectedPolaroid, setSelectedPolaroid] = useState<PolaroidMemorySpec | null>(null);
  const [envelopeModalOpen, setEnvelopeModalOpen] = useState(false);
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);

  const displayName = recipientName.trim() || DEFAULT_RECIPIENT;
  const stanzas = useMemo(() => {
    const parts = customNote
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : [DEFAULT_NOTE];
  }, [customNote]);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const audio = new MusicBoxAudio();
    audioRef.current = audio;

    const controller = new BloomingLoveScene(mount, {
      onStageChange: (nextStage) => {
        setStage(nextStage);
        if (nextStage === 'final') {
          setNoteOpen(true);
          controller.setNoteVisible(true);
        }
      },
      onHugBurst: (isDoubleTap) => {
        audioRef.current?.playHugChime();
        setHugCount((c) => c + 1);
        setHugFeedback(isDoubleTap ? 'kiss' : 'hug');
        if (hugTimerRef.current) window.clearTimeout(hugTimerRef.current);
        hugTimerRef.current = window.setTimeout(() => {
          setHugFeedback(null);
        }, 3000);
      },
      onCelebrateBurst: () => {
        audioRef.current?.playCelebrateFanfare();
        setHugFeedback('celebrate');
        if (hugTimerRef.current) window.clearTimeout(hugTimerRef.current);
        hugTimerRef.current = window.setTimeout(() => {
          setHugFeedback(null);
        }, 3600);
      },
      onPikachuTap: () => {
        audioRef.current?.playHugChime();
        setHugCount((c) => c + 1);
        setHugFeedback('pika');
        if (hugTimerRef.current) window.clearTimeout(hugTimerRef.current);
        hugTimerRef.current = window.setTimeout(() => {
          setHugFeedback(null);
        }, 3000);
      },
      onPikachuDoubleSpark: () => {
        audioRef.current?.playSparkChime();
        setHugCount((c) => c + 1);
        setHugFeedback('pikaDouble');
        if (hugTimerRef.current) window.clearTimeout(hugTimerRef.current);
        hugTimerRef.current = window.setTimeout(() => {
          setHugFeedback(null);
        }, 3400);
      },
      onLadduTap: () => {
        audioRef.current?.playHugChime();
        setHugCount((c) => c + 1);
        setHugFeedback('laddu');
        if (hugTimerRef.current) window.clearTimeout(hugTimerRef.current);
        hugTimerRef.current = window.setTimeout(() => {
          setHugFeedback(null);
        }, 3000);
      },
      onShinchanTap: (isDoubleTap) => {
        if (isDoubleTap) {
          audioRef.current?.playSparkChime();
        } else {
          audioRef.current?.playHugChime();
        }
        setHugCount((c) => c + 1);
        setHugFeedback(isDoubleTap ? 'shinchanDouble' : 'shinchan');
        if (hugTimerRef.current) window.clearTimeout(hugTimerRef.current);
        hugTimerRef.current = window.setTimeout(() => {
          setHugFeedback(null);
        }, 3200);
      },
      onHeartTextCycle: (nextText) => {
        audioRef.current?.playHugChime();
        setHeartText(nextText);
        setHugFeedback('heartText');
        if (hugTimerRef.current) window.clearTimeout(hugTimerRef.current);
        hugTimerRef.current = window.setTimeout(() => {
          setHugFeedback(null);
        }, 3000);
      },
      onPolaroidSelect: (memory) => {
        audioRef.current?.playHugChime();
        setSelectedPolaroid(memory);
      },
      onLanternRelease: () => {
        audioRef.current?.playLanternChime();
        setHugFeedback('lanterns');
        if (hugTimerRef.current) window.clearTimeout(hugTimerRef.current);
        hugTimerRef.current = window.setTimeout(() => {
          setHugFeedback(null);
        }, 3400);
      },
      onWishCast: () => {
        audioRef.current?.playLanternChime();
        setHugFeedback('wish');
        if (hugTimerRef.current) window.clearTimeout(hugTimerRef.current);
        hugTimerRef.current = window.setTimeout(() => {
          setHugFeedback(null);
        }, 3800);
      },
      onBalloonPop: () => {
        audioRef.current?.playSparkChime();
        setHugCount((c) => c + 1);
        setHugFeedback('balloon');
        if (hugTimerRef.current) window.clearTimeout(hugTimerRef.current);
        hugTimerRef.current = window.setTimeout(() => {
          setHugFeedback(null);
        }, 2800);
      },
      onDialogueChange: (speaker) => {
        setDialogueSpeaker(speaker);
      },
      onBubbleProject: ({ pikachu, laddu, shinchan }) => {
        const pEl = pikachuBubbleRef.current;
        if (pEl) {
          pEl.style.transform = `translate3d(${pikachu.x.toFixed(1)}px, ${pikachu.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
          pEl.style.visibility = pikachu.visible ? 'visible' : 'hidden';
        }
        const lEl = ladduBubbleRef.current;
        if (lEl) {
          lEl.style.transform = `translate3d(${laddu.x.toFixed(1)}px, ${laddu.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
          lEl.style.visibility = laddu.visible ? 'visible' : 'hidden';
        }
        const sEl = shinchanBubbleRef.current;
        if (sEl) {
          sEl.style.transform = `translate3d(${shinchan.x.toFixed(1)}px, ${shinchan.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
          sEl.style.visibility = shinchan.visible ? 'visible' : 'hidden';
        }
      },
      onTulipSelect: (tulip) => {
        audioRef.current?.playHugChime();
        setSelectedTulip(tulip);
        if (tulipTimerRef.current) window.clearTimeout(tulipTimerRef.current);
        tulipTimerRef.current = window.setTimeout(() => {
          setSelectedTulip(null);
        }, 4600);
      },
      onEnvelopeOpen: () => {
        audioRef.current?.playHugChime();
        setEnvelopeModalOpen(true);
      },
      onGiftBoxOpen: () => {
        audioRef.current?.playSparkChime();
      },
    });
    sceneRef.current = controller;

    // Apply URL-initialized personalization right away
    controller.setLightingMood(initial.mood);
    controller.setWrapperPalette(initial.palette);
    controller.setRecipientName(initial.to);
    controller.setHeartText(initial.heartText);
    controller.setAccessories(initial.accessories);

    return () => {
      if (tulipTimerRef.current) window.clearTimeout(tulipTimerRef.current);
      if (hugTimerRef.current) window.clearTimeout(hugTimerRef.current);
      controller.dispose();
      sceneRef.current = null;
      audio.dispose();
      audioRef.current = null;
    };
  }, [initial]);

  const handleEnterGarden = () => {
    audioRef.current?.start();
    sceneRef.current?.startExperience();
  };

  const handleSkipToGift = () => {
    audioRef.current?.start();
    sceneRef.current?.skipToFinal();
  };

  const handleReplay = () => {
    setHugFeedback(null);
    setDialogueSpeaker(null);
    setDanceMode(false);
    audioRef.current?.setDanceMode(false);
    setSelectedTulip(null);
    setSelectedPolaroid(null);
    setEnvelopeModalOpen(false);
    sceneRef.current?.startExperience();
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    audioRef.current?.setMuted(next);
  };

  const handleSendHug = () => {
    sceneRef.current?.triggerHug(false);
  };

  const handleCelebrate = () => {
    sceneRef.current?.triggerCelebrate();
  };

  const handleToggleDance = () => {
    const next = !danceMode;
    setDanceMode(next);
    sceneRef.current?.setDanceMode(next);
    audioRef.current?.setDanceMode(next);
  };

  const handleReleaseLanterns = () => {
    sceneRef.current?.releaseLanterns();
  };

  const handleMakeWish = () => {
    sceneRef.current?.triggerMakeWish();
  };

  const handleToggleAccessory = (key: keyof AccessorySelection) => {
    setAccessories((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      sceneRef.current?.setAccessories(next);
      return next;
    });
  };

  const handleToggleNote = () => {
    const next = !noteOpen;
    setNoteOpen(next);
    sceneRef.current?.setNoteVisible(next);
  };

  const handleChangeMood = (nextMood: LightingMood) => {
    setMood(nextMood);
    sceneRef.current?.setLightingMood(nextMood);
  };

  const handleChangePalette = (nextPalette: WrapperPaletteId) => {
    setPaletteId(nextPalette);
    sceneRef.current?.setWrapperPalette(nextPalette);
  };

  const handleChangeRecipient = (value: string) => {
    const clamped = value.slice(0, 24);
    setRecipientName(clamped);
    sceneRef.current?.setRecipientName(clamped);
  };

  const handleChangeHeartText = (value: string) => {
    const clamped = value.slice(0, 18);
    setHeartText(clamped);
    sceneRef.current?.setHeartText(clamped);
  };

  const handleUploadMemoryPhoto = (index: number, file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rawUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const maxDim = 512;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const compressed = c.toDataURL('image/jpeg', 0.88);
        setMemories((prev) =>
          prev.map((m, idx) => {
            if (idx !== index) return m;
            sceneRef.current?.setPolaroidMemory(index, m.caption, compressed);
            return { ...m, imageDataUrl: compressed };
          })
        );
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleChangeMemoryCaption = (index: number, caption: string) => {
    const trimmed = caption.slice(0, 26);
    setMemories((prev) =>
      prev.map((m, idx) => {
        if (idx !== index) return m;
        sceneRef.current?.setPolaroidMemory(index, trimmed, m.imageDataUrl);
        return { ...m, caption: trimmed };
      })
    );
  };

  const handleOpenSecretEnvelope = () => {
    sceneRef.current?.setEnvelopeOpen(true);
    setEnvelopeModalOpen(true);
  };

  const handleCloseSecretEnvelope = () => {
    setEnvelopeModalOpen(false);
    sceneRef.current?.setEnvelopeOpen(false);
  };

  const handleSavePhoto = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    const rawDataUrl = scene.captureSnapshot();
    const img = new Image();
    img.onload = () => {
      const padding = 48;
      const footerH = 126;
      const outW = img.width + padding * 2;
      const outH = img.height + padding + footerH;

      const card = document.createElement('canvas');
      card.width = outW;
      card.height = outH;
      const ctx = card.getContext('2d');
      if (!ctx) return;

      // Soft ivory keepsake frame background
      ctx.fillStyle = '#fff9fb';
      ctx.fillRect(0, 0, outW, outH);

      // Subtle rose-gold border frame
      ctx.strokeStyle = '#e7c4d0';
      ctx.lineWidth = 3;
      ctx.strokeRect(18, 18, outW - 36, outH - 36);

      // Draw crisp WebGL render
      ctx.drawImage(img, padding, padding);

      // Keepsake dedication footer
      ctx.fillStyle = '#8b3256';
      ctx.textAlign = 'center';
      ctx.font = 'italic 600 34px Georgia, serif';
      ctx.fillText(`For ${displayName} ♡`, outW / 2, img.height + padding + 58);

      ctx.fillStyle = '#9c687c';
      ctx.font = '400 18px Georgia, serif';
      ctx.fillText('Blooming Love • Made just for you', outW / 2, img.height + padding + 94);

      const link = document.createElement('a');
      link.download = `blooming-love-${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'keepsake'}.png`;
      link.href = card.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setPhotoSaved(true);
      window.setTimeout(() => setPhotoSaved(false), 2400);
    };
    img.src = rawDataUrl;
  };

  const handleCopyShareLink = async () => {
    const params = new URLSearchParams();
    if (displayName !== DEFAULT_RECIPIENT) params.set('to', displayName);
    if (customNote.trim() !== DEFAULT_NOTE.trim()) params.set('note', customNote.trim());
    if (secretNote.trim() !== DEFAULT_SECRET.trim()) params.set('secret', secretNote.trim());
    if (paletteId !== 'blush') params.set('palette', paletteId);
    if (mood !== 'morning') params.set('mood', mood);
    if (pikaLine.trim() !== DEFAULT_PIKA_LINE) params.set('pika', pikaLine.trim());
    if (ladduLine.trim() !== DEFAULT_LADDU_LINE) params.set('laddu', ladduLine.trim());
    if (shinLine.trim() !== DEFAULT_SHIN_LINE) params.set('shin', shinLine.trim());
    if (heartText.trim() !== DEFAULT_HEART_TEXT) params.set('heart', heartText.trim());
    const accChanged =
      accessories.flowerCrown !== DEFAULT_ACCESSORIES.flowerCrown ||
      accessories.partyHat !== DEFAULT_ACCESSORIES.partyHat ||
      accessories.bowtie !== DEFAULT_ACCESSORIES.bowtie ||
      accessories.heartShades !== DEFAULT_ACCESSORIES.heartShades;
    if (accChanged) {
      const activeTokens: string[] = [];
      if (accessories.flowerCrown) activeTokens.push('crown');
      if (accessories.partyHat) activeTokens.push('hat');
      if (accessories.bowtie) activeTokens.push('bow');
      if (accessories.heartShades) activeTokens.push('shades');
      params.set('acc', activeTokens.length > 0 ? activeTokens.join(',') : 'none');
    }

    const query = params.toString();
    const url = `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const temp = document.createElement('textarea');
      temp.value = url;
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
    }
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2500);
  };

  const isStarlight = mood === 'starlight';

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#fdf2f6] text-[#4a2232]">
      {/* Dedicated Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-full h-full"
        aria-label="Interactive 3D tulip bouquet, Pikachu, Laddu, plush teddy bear, Shinchan, and secret envelope scene"
      />

      {/* 3D-Tracked Dialogue Speech Bubbles (Pikachu <-> Laddu <-> Shinchan) */}
      <div
        ref={pikachuBubbleRef}
        style={{
          transform: 'translate3d(-9999px, -9999px, 0) translate(-50%, -100%)',
        }}
        className="fixed left-0 top-0 z-15 pointer-events-none"
      >
        <button
          type="button"
          onClick={() => sceneRef.current?.triggerPikachuSpark(false)}
          className={`relative px-3.5 py-2 rounded-2xl bg-[#fffdf2]/96 border-2 border-[#f2c138] shadow-[0_10px_24px_-6px_rgba(166,112,18,0.28)] transition-all duration-300 ease-out cursor-pointer ${
            stage === 'final' && dialogueSpeaker === 'pikachu'
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 scale-90 translate-y-1.5 pointer-events-none'
          }`}
          aria-hidden={!(stage === 'final' && dialogueSpeaker === 'pikachu')}
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#b37408]">
            Pikachu
          </span>
          <span className="block font-handwritten text-base sm:text-lg leading-tight text-[#4f2e12] whitespace-nowrap">
            “{pikaLine || DEFAULT_PIKA_LINE}”
          </span>
          <span
            aria-hidden="true"
            className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 bg-[#fffdf2] border-r-2 border-b-2 border-[#f2c138]"
          />
        </button>
      </div>

      <div
        ref={ladduBubbleRef}
        style={{
          transform: 'translate3d(-9999px, -9999px, 0) translate(-50%, -100%)',
        }}
        className="fixed left-0 top-0 z-15 pointer-events-none"
      >
        <button
          type="button"
          onClick={() => sceneRef.current?.triggerLadduLove()}
          className={`relative px-3.5 py-2 rounded-2xl bg-[#fff8f0]/96 border-2 border-[#ef983a] shadow-[0_10px_24px_-6px_rgba(166,88,20,0.28)] transition-all duration-300 ease-out cursor-pointer ${
            stage === 'final' && dialogueSpeaker === 'laddu'
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 scale-90 translate-y-1.5 pointer-events-none'
          }`}
          aria-hidden={!(stage === 'final' && dialogueSpeaker === 'laddu')}
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#bd5d12]">
            Laddu
          </span>
          <span className="block font-handwritten text-base sm:text-lg leading-tight text-[#522414] whitespace-nowrap">
            “{ladduLine || DEFAULT_LADDU_LINE}”
          </span>
          <span
            aria-hidden="true"
            className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 bg-[#fff8f0] border-r-2 border-b-2 border-[#ef983a]"
          />
        </button>
      </div>

      <div
        ref={shinchanBubbleRef}
        style={{
          transform: 'translate3d(-9999px, -9999px, 0) translate(-50%, -100%)',
        }}
        className="fixed left-0 top-0 z-15 pointer-events-none"
      >
        <button
          type="button"
          onClick={() => sceneRef.current?.triggerShinchanCheeky(false)}
          className={`relative px-3.5 py-2 rounded-2xl bg-[#fff5f6]/96 border-2 border-[#e85b66] shadow-[0_10px_24px_-6px_rgba(166,42,58,0.28)] transition-all duration-300 ease-out cursor-pointer ${
            stage === 'final' && dialogueSpeaker === 'shinchan'
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 scale-90 translate-y-1.5 pointer-events-none'
          }`}
          aria-hidden={!(stage === 'final' && dialogueSpeaker === 'shinchan')}
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#b82e3b]">
            Shinchan
          </span>
          <span className="block font-handwritten text-base sm:text-lg leading-tight text-[#4f1820] whitespace-nowrap">
            “{shinLine || DEFAULT_SHIN_LINE}”
          </span>
          <span
            aria-hidden="true"
            className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 bg-[#fff5f6] border-r-2 border-b-2 border-[#e85b66]"
          />
        </button>
      </div>

      {/* Top Subtle Utility Bar */}
      <div className="fixed top-4 left-4 right-4 z-20 flex items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto shrink-0">
          {stage !== 'intro' && (
            <span
              className={`font-display text-lg sm:text-xl font-medium tracking-wide transition-colors ${
                isStarlight ? 'text-[#ffeaf2]/92' : 'text-[#5e2d40]/85'
              }`}
            >
              Blooming Love
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end pointer-events-auto">
          {/* Lighting Mood Switcher */}
          {stage !== 'intro' && (
            <div
              className="inline-flex items-center p-0.5 rounded-full bg-[#fff9fb]/94 border border-[#e7c4d0] shadow-sm"
              role="group"
              aria-label="Scene lighting mood"
            >
              {MOOD_OPTIONS.map(({ id, label, Icon }) => {
                const active = mood === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleChangeMood(id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#c85a82] ${
                      active
                        ? 'bg-[#d85c87] text-white shadow-xs'
                        : 'text-[#6a354a] hover:bg-[#fceaf0]'
                    }`}
                    aria-pressed={active}
                    title={`${label} atmosphere`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Customize & Share Drawer Trigger */}
          <button
            type="button"
            onClick={() => setCustomizeModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#fff9fb]/94 border border-[#e7c4d0] text-xs font-medium text-[#5e2d40] shadow-sm hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#c85a82]"
            aria-label="Customize recipient, ribbon palette, and message"
          >
            <PenLine className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Customize</span>
          </button>

          {/* Skip to Gift (during blooming / assembly / arrival) */}
          {stage !== 'intro' && stage !== 'final' && (
            <button
              type="button"
              onClick={handleSkipToGift}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#fff9fb]/94 border border-[#e7c4d0] text-xs font-medium text-[#5e2d40] shadow-sm hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#c85a82]"
              aria-label="Skip to final gift presentation"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Skip to Gift</span>
            </button>
          )}

          {/* Keepsake Photo Download (in Final Stage) */}
          {stage === 'final' && (
            <button
              type="button"
              onClick={handleSavePhoto}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#fff9fb]/94 border border-[#e7c4d0] text-xs font-medium text-[#5e2d40] shadow-sm hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#c85a82]"
              aria-label="Save keepsake photo"
            >
              {photoSaved ? <Check className="w-3.5 h-3.5 text-[#b33864]" /> : <Camera className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{photoSaved ? 'Saved' : 'Save Photo'}</span>
            </button>
          )}

          {stage === 'final' && (
            <button
              type="button"
              onClick={handleReplay}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#fff9fb]/94 border border-[#e7c4d0] text-xs font-medium text-[#5e2d40] shadow-sm hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#c85a82]"
              aria-label="Replay garden story"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Replay</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleMute}
            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#fff9fb]/94 border border-[#e7c4d0] text-[#5e2d40] shadow-sm hover:bg-white transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#c85a82]"
            aria-label={muted ? 'Unmute gentle music' : 'Mute gentle music'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Stage 0: Introduction Scene Overlay */}
      <AnimatePresence>
        {stage === 'intro' && (
          <motion.main
            key="intro-overlay"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-10 flex flex-col items-center justify-center px-6 text-center pointer-events-none"
          >
            <div className="max-w-2xl px-6 py-8 sm:px-10 sm:py-10 rounded-3xl bg-[#fff8fa]/94 border border-[#f0d3de] shadow-[0_24px_60px_-15px_rgba(148,72,102,0.18)] pointer-events-auto">
              <h1 className="font-display text-4xl sm:text-5xl md:text-[3.4rem] font-medium leading-[1.12] tracking-tight text-[#481f30] text-balance">
                Something Beautiful Is Growing For You
              </h1>

              <p className="mt-4 font-handwritten text-xl sm:text-2xl text-[#8d4c66]">
                Made with love, just for {displayName} ♡
              </p>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={handleEnterGarden}
                  className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-gradient-to-r from-[#d85c87] via-[#e26c95] to-[#cf517d] text-white text-sm sm:text-[15px] font-medium tracking-wide shadow-[0_12px_28px_-6px_rgba(207,81,125,0.52)] hover:shadow-[0_16px_34px_-6px_rgba(207,81,125,0.65)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c85a82]"
                >
                  ENTER MY LITTLE GARDEN 🌷
                </button>
              </div>
            </div>
          </motion.main>
        )}
      </AnimatePresence>

      {/* Active Story Stage Caption (Unobstructed 3D Center) */}
      <AnimatePresence mode="wait">
        {stage !== 'intro' && stage !== 'final' && (
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.55 }}
            className="fixed top-14 sm:top-5 left-1/2 -translate-x-1/2 z-10 w-[86vw] sm:w-[60vw] max-w-lg text-center pointer-events-none"
          >
            <p
              className={`font-display italic text-base sm:text-xl leading-snug ${
                isStarlight ? 'text-[#ffeaf2]/92' : 'text-[#5a293d]/90'
              }`}
            >
              {STAGE_CAPTIONS[stage]}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 3: Interactive 'Open Gift Box' Bottom CTA */}
      <AnimatePresence>
        {stage === 'giftbox' && (
          <motion.div
            key="giftbox-open-cta"
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.94 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
          >
            <button
              type="button"
              onClick={() => sceneRef.current?.openGiftBox()}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-[#d85c87] via-[#e26c95] to-[#cf517d] text-white text-sm sm:text-[15px] font-medium tracking-wide shadow-[0_12px_28px_-6px_rgba(207,81,125,0.58)] hover:shadow-[0_16px_34px_-6px_rgba(207,81,125,0.72)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c85a82]"
            >
              <Gift className="w-4 h-4" />
              <span>Tap Box or Click to Open Gift 🎁</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Individual Tulip Romantic Whisper Toast (When Any Tulip Is Tapped) */}
      <AnimatePresence>
        {stage === 'final' && selectedTulip && (
          <motion.div
            key={selectedTulip.id}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="fixed top-16 sm:top-16 left-1/2 -translate-x-1/2 z-20 w-[90vw] max-w-md pointer-events-auto"
          >
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#fff9fb]/96 border border-[#e7c4d0] shadow-[0_12px_30px_-8px_rgba(130,58,86,0.22)]">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                style={{ backgroundColor: selectedTulip.midColor }}
              />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#a64066]">
                  {selectedTulip.name} Tulip
                </p>
                <p className="font-handwritten text-base sm:text-lg leading-snug text-[#4a2232]">
                  “{selectedTulip.loveNote}”
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTulip(null)}
                className="p-1 rounded-full text-[#8d5a6e] hover:bg-[#fceaf0] cursor-pointer"
                aria-label="Dismiss tulip note"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 4: Final Gift Presentation & Romantic Message */}
      <AnimatePresence>
        {stage === 'final' && (
          <motion.section
            key="final-message-dock"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-20 w-[94vw] max-w-[540px] flex flex-col items-center pointer-events-none"
          >
            {/* Collapse / Expand Note & Secret Envelope Action Row */}
            <div className="mb-1.5 flex items-center gap-2 flex-wrap justify-center pointer-events-auto">
              <button
                type="button"
                onClick={handleToggleNote}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#fff9fb]/95 border border-[#e7c4d0] text-xs font-medium text-[#6e384d] shadow-sm hover:bg-white transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#c85a82]"
              >
                {noteOpen ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Hide Note</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Read Love Note</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenSecretEnvelope}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#fff9fb]/95 border border-[#e7c4d0] text-xs font-medium text-[#8b2f52] shadow-sm hover:bg-white transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#c85a82]"
              >
                <Mail className="w-3.5 h-3.5 text-[#c22f5b]" />
                <span>Secret Envelope</span>
              </button>

              <button
                type="button"
                onClick={handleCelebrate}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#f39c4b] via-[#e56b8f] to-[#d44d7e] text-white text-xs font-medium shadow-[0_6px_18px_-4px_rgba(218,86,132,0.52)] hover:-translate-y-0.5 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c85a82]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Celebrate</span>
              </button>

              <button
                type="button"
                onClick={handleToggleDance}
                aria-pressed={danceMode}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-medium shadow-sm transition-all whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#c85a82] ${
                  danceMode
                    ? 'bg-[#d85c87] border-[#d85c87] text-white'
                    : 'bg-[#fff9fb]/95 border-[#e7c4d0] text-[#6e384d] hover:bg-white'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>{danceMode ? 'Dancing ♪' : 'Dance'}</span>
              </button>

              <button
                type="button"
                onClick={handleReleaseLanterns}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#fff9fb]/95 border border-[#e7c4d0] text-xs font-medium text-[#8b451c] shadow-sm hover:bg-white transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#c85a82]"
              >
                <Flame className="w-3.5 h-3.5 text-[#ea8225]" />
                <span>Lanterns</span>
              </button>

              <button
                type="button"
                onClick={handleMakeWish}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#fff9fb]/95 border border-[#e7c4d0] text-xs font-medium text-[#703b82] shadow-sm hover:bg-white transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#c85a82]"
              >
                <Star className="w-3.5 h-3.5 text-[#d98c2b] fill-[#ffd97d]" />
                <span>Wish</span>
              </button>

              {!noteOpen && (
                <button
                  type="button"
                  onClick={handleSendHug}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#d85c87] to-[#e46e97] text-white text-xs font-medium shadow-[0_8px_20px_-4px_rgba(216,92,135,0.55)] hover:-translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
                >
                  <span>Send Me A Hug 💗</span>
                </button>
              )}
            </div>

            {/* Handwritten Romantic Keepsake Card */}
            <AnimatePresence>
              {noteOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full rounded-2xl bg-[#fff9fb]/95 border border-[#ebd0da] shadow-[0_18px_45px_-12px_rgba(130,58,86,0.22)] px-5 py-3.5 sm:px-7 sm:py-4 text-center pointer-events-auto max-h-[38vh] overflow-y-auto"
                >
                  <motion.h2
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.6 }}
                    className="font-handwritten text-2xl sm:text-[26px] font-semibold text-[#b33864]"
                  >
                    To My {displayName} 💗
                  </motion.h2>

                  <div className="mt-2.5 space-y-2.5">
                    {stanzas.map((stanza, idx) => (
                      <motion.p
                        key={idx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + idx * 0.3, duration: 0.65 }}
                        className="font-handwritten text-[15.5px] sm:text-[17.5px] leading-[1.38] text-[#4f2435] whitespace-pre-line"
                      >
                        {stanza}
                      </motion.p>
                    ))}
                  </div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.25, duration: 0.7 }}
                    className="mt-2.5 font-handwritten text-lg sm:text-xl font-medium text-[#9e365b]"
                  >
                    Forever yours. ♡
                  </motion.p>

                  {/* Glowing Heart Action Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.45, duration: 0.6 }}
                    className="mt-3.5 flex flex-col items-center gap-1.5"
                  >
                    <button
                      type="button"
                      onClick={handleSendHug}
                      className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#d85c87] via-[#e46e97] to-[#cf517d] text-white text-sm font-medium tracking-wide shadow-[0_0_24px_rgba(226,108,149,0.52)] hover:shadow-[0_0_32px_rgba(226,108,149,0.75)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c85a82]"
                    >
                      <Heart className="w-4 h-4 fill-white/90" />
                      <span>Send Me A Hug 💗</span>
                    </button>

                    <div className="min-h-4 flex items-center justify-center">
                      {hugFeedback === 'celebrate' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          Fireworks blooming in the sky for you, {displayName}! ✨🎆
                        </span>
                      ) : hugFeedback === 'lanterns' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          Warm wish lanterns rising into the sky for you, {displayName}! 🏮✨
                        </span>
                      ) : hugFeedback === 'wish' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          A shooting star lit up a heart for you, {displayName}! ✨🌠
                        </span>
                      ) : hugFeedback === 'balloon' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          Pop! Love confetti hearts for you! ({hugCount}) 🎈💗
                        </span>
                      ) : hugFeedback === 'heartText' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          Teddy’s heart now reads: “{heartText}” 💗
                        </span>
                      ) : hugFeedback === 'pikaDouble' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          Pikachu ⚡💛 Laddu! Golden love sparks made Laddu spin! ({hugCount})
                        </span>
                      ) : hugFeedback === 'shinchanDouble' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          Shinchan did a 360° celebratory spin for you, {displayName}! ({hugCount}) 🕺✨
                        </span>
                      ) : hugFeedback === 'pika' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          Pikachu says: {pikaLine || DEFAULT_PIKA_LINE} ({hugCount})
                        </span>
                      ) : hugFeedback === 'laddu' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          Laddu says: {ladduLine || DEFAULT_LADDU_LINE} ({hugCount})
                        </span>
                      ) : hugFeedback === 'shinchan' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          Shinchan says: {shinLine || DEFAULT_SHIN_LINE} ({hugCount})
                        </span>
                      ) : hugFeedback === 'kiss' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          Teddy sent you an extra big hug & kiss, {displayName}! ({hugCount}) ♡
                        </span>
                      ) : hugFeedback === 'hug' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          Warmest hug sent to you, {displayName} ({hugCount}) ♡
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#8d5a6e]/85">
                          Tap characters (try double-tap!), balloons, heart, Polaroids, butterflies, tulips, or envelope ♡
                        </span>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Polaroid Memory Lightbox Modal */}
      <AnimatePresence>
        {selectedPolaroid && (
          <motion.div
            key="polaroid-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 flex items-center justify-center px-4 bg-[#381422]/50"
            onClick={() => setSelectedPolaroid(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.92, rotate: 2 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xs rounded-2xl bg-[#fffcf9] border border-[#ebd7de] shadow-[0_28px_70px_-14px_rgba(92,26,52,0.5)] p-4 pb-6 text-center"
            >
              <button
                type="button"
                onClick={() => setSelectedPolaroid(null)}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-white/90 text-[#8d5a6e] hover:bg-[#fceaf0] cursor-pointer shadow-xs"
                aria-label="Close memory photo"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-[#ffd6e6] via-[#ffe6d6] to-[#e9d2fa] border border-[#edd8e0] flex items-center justify-center">
                {selectedPolaroid.imageDataUrl ? (
                  <img
                    src={selectedPolaroid.imageDataUrl}
                    alt={selectedPolaroid.caption}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="px-6 text-center">
                    <Heart className="w-10 h-10 mx-auto text-[#d85c87] fill-[#f8a5c2] mb-2" />
                    <p className="font-display italic text-lg text-[#6e324a]">
                      {selectedPolaroid.caption}
                    </p>
                    <p className="mt-1 text-xs text-[#9c687c]">
                      Upload your own photo anytime in Customize ♡
                    </p>
                  </div>
                )}
              </div>

              <p className="mt-4 font-handwritten text-2xl text-[#6e324a]">
                {selectedPolaroid.caption}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wax-Sealed Secret Note Modal */}
      <AnimatePresence>
        {envelopeModalOpen && (
          <motion.div
            key="secret-envelope-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 flex items-center justify-center px-4 bg-[#381422]/45"
            onClick={handleCloseSecretEnvelope}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-3xl bg-[#fffaf6] border border-[#e7c4d0] shadow-[0_28px_70px_-14px_rgba(92,26,52,0.45)] px-6 py-7 sm:px-8 text-center"
            >
              <button
                type="button"
                onClick={handleCloseSecretEnvelope}
                className="absolute top-4 right-4 p-1.5 rounded-full text-[#8d5a6e] hover:bg-[#fceaf0] cursor-pointer"
                aria-label="Close secret letter"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Crimson Wax Seal Crest */}
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-gradient-to-br from-[#d33a68] to-[#9b1b42] shadow-[0_6px_16px_rgba(162,36,74,0.38)] flex items-center justify-center border-2 border-[#e6b3a3]">
                <Heart className="w-5 h-5 text-[#fbe5dc] fill-[#fbe5dc]" />
              </div>

              <h3 className="font-display text-2xl font-medium text-[#5e233a]">
                A Secret Note For {displayName}
              </h3>

              <div className="mt-4 py-4 px-4 rounded-2xl bg-[#fff4f7] border border-[#f2d9e2]">
                <p className="font-handwritten text-lg sm:text-xl leading-relaxed text-[#4f2435] whitespace-pre-line">
                  {secretNote}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseSecretEnvelope}
                className="mt-5 inline-flex items-center justify-center px-6 py-2 rounded-full bg-[#d85c87] text-white text-xs font-medium tracking-wide hover:bg-[#c84d78] transition-colors cursor-pointer"
              >
                Seal Envelope ♡
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customize & Share Personalized Link Modal */}
      <AnimatePresence>
        {customizeModalOpen && (
          <motion.div
            key="customize-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 flex items-center justify-center px-4 py-6 bg-[#381422]/45"
            onClick={() => setCustomizeModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-3xl bg-[#fff9fb] border border-[#e7c4d0] shadow-[0_28px_70px_-14px_rgba(92,26,52,0.45)] p-6 sm:p-7 text-left"
            >
              <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#f1dce4]">
                <div>
                  <h3 className="font-display text-2xl font-medium text-[#4f2033]">
                    Personalize Your Gift
                  </h3>
                  <p className="text-xs text-[#8a556a]">
                    Updates the 3D gift tag, wrapping ribbon, letters, and shareable link live
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomizeModalOpen(false)}
                  className="p-1.5 rounded-full text-[#8d5a6e] hover:bg-[#fceaf0] cursor-pointer"
                  aria-label="Close personalization"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {/* Recipient Name */}
                <div>
                  <label htmlFor="recipient-input" className="block text-xs font-semibold text-[#6e384d] mb-1.5">
                    Recipient Name (Shown on 3D Bouquet Tag & Letter)
                  </label>
                  <input
                    id="recipient-input"
                    type="text"
                    value={recipientName}
                    maxLength={24}
                    onChange={(e) => handleChangeRecipient(e.target.value)}
                    placeholder="Ammu"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e7c4d0] text-sm text-[#4a2232] focus:outline-none focus:border-[#d85c87]"
                  />
                </div>

                {/* Wrapping Paper & Ribbon Palette */}
                <div>
                  <span className="block text-xs font-semibold text-[#6e384d] mb-2">
                    Bouquet Paper & Satin Ribbon Palette
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {WRAPPER_PALETTES.map((p) => {
                      const active = paletteId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleChangePalette(p.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'border-[#d85c87] bg-[#fff0f5] shadow-xs'
                              : 'border-[#ecd6de] bg-white hover:border-[#dfb5c4]'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full shrink-0 border border-black/10"
                            style={{ backgroundColor: p.swatchHex }}
                          />
                          <span className="text-xs font-medium text-[#542538] truncate">
                            {p.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lighting Mood */}
                <div>
                  <span className="block text-xs font-semibold text-[#6e384d] mb-2">
                    Garden Atmosphere
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {MOOD_OPTIONS.map(({ id, label, Icon }) => {
                      const active = mood === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleChangeMood(id)}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                            active
                              ? 'border-[#d85c87] bg-[#d85c87] text-white'
                              : 'border-[#ecd6de] bg-white text-[#542538] hover:border-[#dfb5c4]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Love Letter Text */}
                <div>
                  <label htmlFor="love-note-input" className="block text-xs font-semibold text-[#6e384d] mb-1.5">
                    Bouquet Dedication Message
                  </label>
                  <textarea
                    id="love-note-input"
                    rows={4}
                    maxLength={600}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e7c4d0] text-sm text-[#4a2232] leading-relaxed focus:outline-none focus:border-[#d85c87]"
                  />
                </div>

                {/* Secret Wax-Sealed Note */}
                <div>
                  <label htmlFor="secret-note-input" className="block text-xs font-semibold text-[#6e384d] mb-1.5">
                    Secret Wax-Sealed Envelope Note
                  </label>
                  <textarea
                    id="secret-note-input"
                    rows={3}
                    maxLength={400}
                    value={secretNote}
                    onChange={(e) => setSecretNote(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e7c4d0] text-sm text-[#4a2232] leading-relaxed focus:outline-none focus:border-[#d85c87]"
                  />
                </div>

                {/* Teddy's 3D Conversation Heart Text */}
                <div>
                  <label htmlFor="heart-text-input" className="block text-xs font-semibold text-[#6e384d] mb-1.5">
                    Teddy’s 3D Plush Heart Engraving
                  </label>
                  <input
                    id="heart-text-input"
                    type="text"
                    maxLength={18}
                    value={heartText}
                    onChange={(e) => handleChangeHeartText(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#e7c4d0] text-sm text-[#4a2232] focus:outline-none focus:border-[#d85c87]"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {HEART_MESSAGE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleChangeHeartText(preset)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer ${
                          heartText === preset
                            ? 'bg-[#d85c87] text-white border-[#d85c87]'
                            : 'bg-white text-[#6e384d] border-[#ecd6de] hover:bg-[#fff0f5]'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Character Speech Bubbles */}
                <div className="p-3.5 rounded-2xl bg-[#fff3f7] border border-[#f2d9e2] space-y-2.5">
                  <span className="block text-xs font-semibold text-[#6e384d]">
                    Character Dialogue Lines (Saved in Share Link)
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      maxLength={48}
                      value={pikaLine}
                      onChange={(e) => setPikaLine(e.target.value)}
                      placeholder={DEFAULT_PIKA_LINE}
                      aria-label="Pikachu's dialogue line"
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-[#f2c138]/70 text-xs text-[#4a2232] focus:outline-none focus:border-[#d85c87]"
                    />
                    <input
                      type="text"
                      maxLength={48}
                      value={ladduLine}
                      onChange={(e) => setLadduLine(e.target.value)}
                      placeholder={DEFAULT_LADDU_LINE}
                      aria-label="Laddu's dialogue line"
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-[#ef983a]/70 text-xs text-[#4a2232] focus:outline-none focus:border-[#d85c87]"
                    />
                    <input
                      type="text"
                      maxLength={48}
                      value={shinLine}
                      onChange={(e) => setShinLine(e.target.value)}
                      placeholder={DEFAULT_SHIN_LINE}
                      aria-label="Shinchan's dialogue line"
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-[#e85b66]/70 text-xs text-[#4a2232] focus:outline-none focus:border-[#d85c87]"
                    />
                  </div>
                </div>

                {/* 3D Character Accessories Dress-Up */}
                <div className="p-3.5 rounded-2xl bg-[#fff3f7] border border-[#f2d9e2] space-y-2.5">
                  <span className="block text-xs font-semibold text-[#6e384d]">
                    3D Character Accessories (Dress-Up)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { key: 'flowerCrown', label: '🌸 Flower Crown (Teddy)' },
                        { key: 'partyHat', label: '🥳 Party Hat (Shinchan)' },
                        { key: 'bowtie', label: '🎀 Silk Bowties' },
                        { key: 'heartShades', label: '🕶️ Heart Sunglasses' },
                      ] as const
                    ).map(({ key, label }) => {
                      const active = accessories[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleToggleAccessory(key)}
                          aria-pressed={active}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                            active
                              ? 'border-[#d85c87] bg-[#d85c87] text-white shadow-xs'
                              : 'border-[#ecd6de] bg-white text-[#542538] hover:border-[#dfb5c4]'
                          }`}
                        >
                          <span className="truncate">{label}</span>
                          <span className="text-[10px] opacity-90">{active ? 'ON' : 'OFF'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3D Floating Polaroid Photos */}
                <div className="p-3.5 rounded-2xl bg-[#fff3f7] border border-[#f2d9e2] space-y-2.5">
                  <span className="block text-xs font-semibold text-[#6e384d]">
                    3D Polaroid Memory Frames
                  </span>
                  <div className="space-y-2">
                    {memories.map((mem, idx) => (
                      <div key={mem.id} className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-[#e7c4d0] text-[11px] font-medium text-[#6e384d] hover:bg-[#fff0f5] cursor-pointer shrink-0">
                          <ImagePlus className="w-3.5 h-3.5 text-[#d85c87]" />
                          <span>{mem.imageDataUrl ? `Photo ${idx + 1} ✓` : `Photo ${idx + 1}`}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleUploadMemoryPhoto(idx, e.target.files?.[0])}
                          />
                        </label>
                        <input
                          type="text"
                          maxLength={26}
                          value={mem.caption}
                          onChange={(e) => handleChangeMemoryCaption(idx, e.target.value)}
                          placeholder={`Memory ${idx + 1} caption`}
                          className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-white border border-[#e7c4d0] text-xs text-[#4a2232] focus:outline-none focus:border-[#d85c87]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f1dce4] flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#fff0f5] border border-[#e7b4c6] text-xs font-semibold text-[#9e2f59] hover:bg-[#ffe4ee] transition-colors cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Shareable Link Copied ♡' : 'Copy Personalized Gift Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCustomizeModalOpen(false)}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-gradient-to-r from-[#d85c87] to-[#cf517d] text-white text-xs font-medium shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
