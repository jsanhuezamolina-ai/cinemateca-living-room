/**
 * Web Audio ambient soundscape & HTML5 audio playback controller.
 * Provides real audio playback for uploaded local files and lush ambient chord pads
 * for catalog hi-res tracks, plus frequency spectrum samples for the live visualizer.
 */
class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private oscNodes: OscillatorNode[] = [];
  private htmlAudio: HTMLAudioElement | null = null;
  private htmlSource: MediaElementAudioSourceNode | null = null;
  private spectrumBuffer = new Uint8Array(64);
  private isPlayingSynth = false;
  private isMuted = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.82;
      this.spectrumBuffer = new Uint8Array(this.analyser.frequencyBinCount);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.14;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignore autoplay restrictions before explicit user gesture
      });
    }

    return this.ctx;
  }

  public startTrack(frequencies: number[], localObjectUrl?: string, startAtSec = 0): void {
    this.stop();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    if (localObjectUrl) {
      this.htmlAudio = new Audio(localObjectUrl);
      this.htmlAudio.currentTime = startAtSec;
      this.htmlAudio.crossOrigin = 'anonymous';
      try {
        this.htmlSource = ctx.createMediaElementSource(this.htmlAudio);
        this.htmlSource.connect(this.masterGain);
      } catch {
        // Fallback if element source already bound
      }
      this.htmlAudio.play().catch(() => {});
      return;
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(680, ctx.currentTime);
    filter.Q.setValueAtTime(1.4, ctx.currentTime);
    filter.connect(this.masterGain);

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const voiceGain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.detune.setValueAtTime((idx - 1.5) * 6, ctx.currentTime);
      voiceGain.gain.setValueAtTime(0.001, ctx.currentTime);
      voiceGain.gain.exponentialRampToValueAtTime(0.18 / frequencies.length, ctx.currentTime + 0.6);

      osc.connect(voiceGain);
      voiceGain.connect(filter);
      osc.start();
      this.oscNodes.push(osc);
    });

    this.isPlayingSynth = true;
  }

  public stop(): void {
    this.oscNodes.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore already stopped oscillators
      }
    });
    this.oscNodes = [];
    this.isPlayingSynth = false;

    if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio = null;
    }
    if (this.htmlSource) {
      try {
        this.htmlSource.disconnect();
      } catch {
        // Ignore disconnect error
      }
      this.htmlSource = null;
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.14, this.ctx.currentTime, 0.05);
    }
    if (this.htmlAudio) {
      this.htmlAudio.muted = muted;
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Returns 32 normalized [0..1] spectrum levels for canvas/DOM equalizers.
   * Blends real Web Audio Analyser data with smooth harmonic motion when synth/playing.
   */
  public sampleSpectrum(barsCount: number, isPlaying: boolean, phaseSec: number): number[] {
    const out: number[] = [];
    let hasLiveSignal = false;

    if (this.analyser && isPlaying) {
      this.analyser.getByteFrequencyData(this.spectrumBuffer);
      for (let i = 0; i < Math.min(barsCount, this.spectrumBuffer.length); i++) {
        if (this.spectrumBuffer[i] > 4) {
          hasLiveSignal = true;
          break;
        }
      }
    }

    for (let i = 0; i < barsCount; i++) {
      if (!isPlaying) {
        out.push(0.12 + 0.04 * Math.sin(i * 0.6));
        continue;
      }
      if (hasLiveSignal && !this.isPlayingSynth) {
        const idx = Math.min(this.spectrumBuffer.length - 1, Math.floor((i / barsCount) * 28));
        out.push(Math.max(0.15, this.spectrumBuffer[idx] / 255));
      } else {
        const waveA = Math.sin(phaseSec * 3.4 + i * 0.45);
        const waveB = Math.cos(phaseSec * 2.1 - i * 0.32);
        const envelope = 1 - Math.abs(i / barsCount - 0.38) * 0.55;
        const level = Math.min(0.96, Math.max(0.18, (0.52 + 0.24 * waveA + 0.16 * waveB) * envelope));
        out.push(level);
      }
    }

    return out;
  }
}

export const audioEngine = new AmbientAudioEngine();
