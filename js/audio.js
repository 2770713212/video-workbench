import { seek } from "./detector.js";

export const effects = new Map([
  ["none", "无"], ["whoosh", "气流声 Whoosh"], ["pop", "弹窗音 Pop"], ["bass-drop", "重击音 Bass Drop"],
]);

export class AudioEngine {
  constructor() {
    this.voices = new Set();
    this.volume = 0.5;
    this.loop = true;
    this.keepOriginal = true;
  }

  async ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createDynamicsCompressor();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.originalGain = this.ctx.createGain();
      this.originalGain.connect(this.master);
      this.updateLevels();
    }
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  updateLevels() {
    if (!this.ctx) return;
    this.musicGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.008);
    this.originalGain.gain.setTargetAtTime(Number(this.keepOriginal), this.ctx.currentTime, 0.008);
  }

  setOriginal(url) {
    this.originalNode?.disconnect();
    if (this.original) {
      this.original.pause();
      this.original.removeAttribute("src");
      this.original.load();
    }
    this.originalNode = null;
    this.original = new Audio(url);
    this.original.preload = "auto";
  }

  async loadBGM(file) {
    await this.ensureContext();
    this.music = await this.ctx.decodeAudioData(await file.arrayBuffer());
  }

  // Schedule against the audio clock, including cuts between two animation frames.
  effect(kind, at = this.ctx.currentTime) {
    if (!effects.has(kind) || kind === "none") return;
    const ctx = this.ctx;
    const envelope = ctx.createGain();
    let voice, filter, length, attack, peak;
    if (kind === "whoosh") {
      length = 0.35; attack = 0.12; peak = 0.75;
      if (!this.noise) {
        this.noise = ctx.createBuffer(1, Math.ceil(length * ctx.sampleRate), ctx.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      voice = ctx.createBufferSource();
      voice.buffer = this.noise;
      filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(200, at);
      filter.frequency.exponentialRampToValueAtTime(2400, at + 0.18);
      filter.frequency.exponentialRampToValueAtTime(240, at + length);
    } else {
      voice = ctx.createOscillator();
      voice.type = "sine";
      if (kind === "pop") {
        length = 0.12; attack = 0.005; peak = 0.48;
        voice.frequency.setValueAtTime(320, at);
        voice.frequency.exponentialRampToValueAtTime(880, at + 0.065);
      } else {
        length = 0.45; attack = 0.009; peak = 0.7;
        voice.frequency.setValueAtTime(130, at);
        voice.frequency.exponentialRampToValueAtTime(38, at + length);
        filter = ctx.createWaveShaper();
        filter.curve = Float32Array.from({length: 257}, (_, i) => Math.tanh(1.35 * (i / 128 - 1)));
      }
    }
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(peak, at + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
    if (filter) voice.connect(filter).connect(envelope);
    else voice.connect(envelope);
    envelope.connect(this.master);
    this.voices.add(voice);
    voice.onended = () => {
      this.voices.delete(voice);
      voice.disconnect(); filter?.disconnect(); envelope.disconnect();
    };
    voice.start(at);
    voice.stop(at + length);
  }

  async prepare(from) {
    if (!this.original) return;
    if (!this.originalNode) {
      this.originalNode = this.ctx.createMediaElementSource(this.original);
      this.originalNode.connect(this.originalGain);
    }
    await seek(this.original, from);
  }

  start(from, shots) {
    this.anchor = this.ctx.currentTime;
    if (this.original) this.original.play().catch(() => {});
    if (this.music && (this.loop || from < this.music.duration)) {
      this.bgm = this.ctx.createBufferSource();
      this.bgm.buffer = this.music;
      this.bgm.loop = this.loop;
      this.bgm.connect(this.musicGain);
      this.bgm.start(this.anchor, from % this.music.duration);
    }
    for (const shot of shots) {
      if (shot.startTime >= from) this.effect(shot.effect, this.anchor + shot.startTime - from);
    }
  }

  stop() {
    this.original?.pause();
    if (this.bgm) { this.bgm.stop(); this.bgm.disconnect(); this.bgm = null; }
    for (const voice of this.voices) { voice.stop(); voice.disconnect(); }
    this.voices.clear();
  }
}
