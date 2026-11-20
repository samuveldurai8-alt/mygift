import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Heart,
  Mail,
  Moon,
  PenLine,
  RotateCcw,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { BloomingLoveScene } from './three/sceneController';
import { MusicBoxAudio } from './audio/musicBox';
import {
  WRAPPER_PALETTES,
  type ExperienceStage,
  type LightingMood,
  type TulipShadeSpec,
  type WrapperPaletteId,
} from './three/types';

const STAGE_CAPTIONS: Record<Exclude<ExperienceStage, 'intro' | 'final'>, string> = {
  growing: 'Seven tulips are blooming gently in the breeze',
  assembly: 'Gathering each bloom into a hand-tied bouquet',
  teddy: 'Someone soft and sweet has arrived for you',
};

const DEFAULT_RECIPIENT = 'Ammu';

const DEFAULT_NOTE =
  "I couldn't bring you a whole garden,\nso I created this little one just for you.\n\n" +
  "Every tulip carries a little piece of my love.\nAnd this teddy is here to remind you\nthat you're always special to me.\n\n" +
  'You deserve all the flowers in the world,\nmy princess. 🌷';

const DEFAULT_SECRET =
  'Open whenever you miss me:\nNo matter how busy or far apart a day feels,\nyou are always my favorite thought. ♡';

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

  return { to, note, secret, palette, mood };
}

export default function App() {
  const initial = useMemo(() => parseInitialParams(), []);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<BloomingLoveScene | null>(null);
  const audioRef = useRef<MusicBoxAudio | null>(null);
  const tulipTimerRef = useRef<number | null>(null);
  const hugTimerRef = useRef<number | null>(null);

  const [stage, setStage] = useState<ExperienceStage>('intro');
  const [muted, setMuted] = useState(false);
  const [noteOpen, setNoteOpen] = useState(true);
  const [hugCount, setHugCount] = useState(0);
  const [hugFeedback, setHugFeedback] = useState<'hug' | 'kiss' | 'pika' | null>(null);

  // Interactive 3D Surprises & Keepsake Customization state
  const [mood, setMood] = useState<LightingMood>(initial.mood);
  const [paletteId, setPaletteId] = useState<WrapperPaletteId>(initial.palette);
  const [recipientName, setRecipientName] = useState(initial.to);
  const [customNote, setCustomNote] = useState(initial.note);
  const [secretNote, setSecretNote] = useState(initial.secret);

  const [selectedTulip, setSelectedTulip] = useState<TulipShadeSpec | null>(null);
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
      onPikachuTap: () => {
        audioRef.current?.playHugChime();
        setHugCount((c) => c + 1);
        setHugFeedback('pika');
        if (hugTimerRef.current) window.clearTimeout(hugTimerRef.current);
        hugTimerRef.current = window.setTimeout(() => {
          setHugFeedback(null);
        }, 3000);
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
    });
    sceneRef.current = controller;

    // Apply URL-initialized personalization right away
    controller.setLightingMood(initial.mood);
    controller.setWrapperPalette(initial.palette);
    controller.setRecipientName(initial.to);

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

  const handleReplay = () => {
    setHugFeedback(null);
    setSelectedTulip(null);
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
        aria-label="Interactive 3D tulip bouquet, plush teddy bear, and secret envelope scene"
      />

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
                      {hugFeedback === 'pika' ? (
                        <span className="font-handwritten text-sm text-[#b33864]">
                          Pikachu sent you a bright spark of joy, {displayName}! ({hugCount}) ⚡♡
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
                          Tap Pikachu, teddy, any tulip, or the wax-sealed envelope ♡
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
