/**
 * Gentle procedural Web Audio API romantic music-box synthesizer.
 * Zero external audio file dependencies.
 */
export class MusicBoxAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private timerId: number | null = null;
  private muted = false;
  private playing = false;
  private step = 0;

  // Gentle waltz-like romantic chord arpeggio in F major / D minor (frequencies in Hz)
  private readonly notes = [
    349.23, 440.0, 523.25, 659.25, 523.25, 440.0, // Fmaj7
    293.66, 349.23, 440.0, 587.33, 440.0, 349.23, // Dm7
    233.08, 349.23, 440.0, 523.25, 440.0, 349.23, // Bbmaj7
    261.63, 392.0, 493.88, 587.33, 523.25, 440.0, // C9sus -> resolve
  ];

  public start(): void {
    if (this.playing) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.08;
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.playing = true;
      this.scheduleNext();
    } catch {
      // AudioContext blocked or unavailable; silently skip
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.08, this.ctx.currentTime, 0.08);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playHugChime(): void {
    if (this.muted) return;
    this.start();
    if (!this.ctx || !this.masterGain) return;
    const chimeNotes = [523.25, 659.25, 783.99, 1046.5];
    const now = this.ctx.currentTime;
    chimeNotes.forEach((freq, i) => {
      this.triggerBell(freq, now + i * 0.085, 1.4, 0.25);
    });
  }

  private scheduleNext(): void {
    if (!this.playing) return;
    if (!this.muted && this.ctx && this.ctx.state === 'running') {
      const freq = this.notes[this.step % this.notes.length];
      this.triggerBell(freq, this.ctx.currentTime, 1.8, 0.2);
      this.step++;
    }
    this.timerId = window.setTimeout(() => this.scheduleNext(), 560);
  }

  private triggerBell(freq: number, startTime: number, duration: number, peak: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, startTime);

    const overGain = this.ctx.createGain();
    overGain.gain.setValueAtTime(0.14, startTime);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.exponentialRampToValueAtTime(peak, startTime + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(env);
    overtone.connect(overGain);
    overGain.connect(env);
    env.connect(this.masterGain);

    osc.start(startTime);
    overtone.start(startTime);
    osc.stop(startTime + duration + 0.05);
    overtone.stop(startTime + duration + 0.05);
  }

  public dispose(): void {
    this.playing = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
