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
  private danceMode = false;
  private step = 0;

  // Gentle waltz-like romantic chord arpeggio in F major / D minor (frequencies in Hz)
  private readonly notes = [
    349.23, 440.0, 523.25, 659.25, 523.25, 440.0, // Fmaj7
    293.66, 349.23, 440.0, 587.33, 440.0, 349.23, // Dm7
    233.08, 349.23, 440.0, 523.25, 440.0, 349.23, // Bbmaj7
    261.63, 392.0, 493.88, 587.33, 523.25, 440.0, // C9sus -> resolve
  ];

  // Upbeat cheerful dance-party melody
  private readonly danceNotes = [
    523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 523.25,
    587.33, 698.46, 880.0, 698.46, 987.77, 880.0, 783.99, 659.25,
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

  public playCelebrateFanfare(): void {
    if (this.muted) return;
    this.start();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Romantic ascending celesta shimmer
    const fanfareNotes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    fanfareNotes.forEach((freq, i) => {
      this.triggerBell(freq, now + i * 0.075, 1.6, 0.22);
    });

    // Soft distant firework crackle-pops matching the 5-shell salvo timing
    const burstOffsets = [0.48, 0.82, 1.18, 1.54, 1.9];
    burstOffsets.forEach((offset, idx) => {
      this.triggerSoftPop(now + offset);
      const chordFreq = [783.99, 880.0, 987.77, 1046.5, 1318.5][idx % 5];
      this.triggerBell(chordFreq, now + offset + 0.02, 1.35, 0.18);
    });
  }

  private triggerSoftPop(startTime: number): void {
    if (!this.ctx || !this.masterGain) return;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * 0.18);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.045));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, startTime);
    filter.Q.setValueAtTime(1.2, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.28, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.17);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(startTime);
    noise.stop(startTime + 0.18);
  }

  public setDanceMode(enabled: boolean): void {
    this.danceMode = enabled;
    if (enabled && !this.playing) {
      this.start();
    }
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
      this.scheduleNext();
    }
  }

  public playSparkChime(): void {
    if (this.muted) return;
    this.start();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [659.25, 880.0, 1174.66, 1318.51, 1567.98].forEach((freq, i) => {
      this.triggerBell(freq, now + i * 0.055, 0.9, 0.24);
    });
  }

  public playLanternChime(): void {
    if (this.muted) return;
    this.start();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [440.0, 554.37, 659.25, 880.0].forEach((freq, i) => {
      this.triggerBell(freq, now + i * 0.14, 2.1, 0.22);
    });
  }

  private scheduleNext(): void {
    if (!this.playing) return;
    if (!this.muted && this.ctx && this.ctx.state === 'running') {
      const seq = this.danceMode ? this.danceNotes : this.notes;
      const freq = seq[this.step % seq.length];
      this.triggerBell(freq, this.ctx.currentTime, this.danceMode ? 0.85 : 1.8, this.danceMode ? 0.24 : 0.2);
      this.step++;
    }
    this.timerId = window.setTimeout(() => this.scheduleNext(), this.danceMode ? 270 : 560);
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
