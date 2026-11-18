export type SpinSoundId =
  | 'classic-tick'
  | 'wood-clack'
  | 'casino-click'
  | 'chime-bell'
  | 'breeze-whoosh'
  | 'cosmic-glide';

export interface SpinSoundOption {
  id: SpinSoundId;
  nameKm: string;
  nameEn: string;
}

export const SPIN_SOUND_OPTIONS: SpinSoundOption[] = [
  { id: 'classic-tick', nameKm: 'ទង្គិចស្តង់ដារ', nameEn: 'Classic Tick' },
  { id: 'wood-clack', nameKm: 'ឈើគោះ', nameEn: 'Wood Clack' },
  { id: 'casino-click', nameKm: 'មេកានិចច្បាស់', nameEn: 'Crisp Click' },
  { id: 'chime-bell', nameKm: 'កណ្តឹងតន្ត្រី', nameEn: 'Sparkle Chime' },
  { id: 'breeze-whoosh', nameKm: 'ខ្យល់បក់វិល', nameEn: 'Breeze Spin' },
  { id: 'cosmic-glide', nameKm: 'រលកអវកាស', nameEn: 'Cosmic Glide' },
];

export const VALID_SPIN_SOUNDS = new Set<SpinSoundId>(
  SPIN_SOUND_OPTIONS.map((opt) => opt.id)
);

let audioCtx: AudioContext | null = null;
let cachedNoiseBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoiseBuffer && cachedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return cachedNoiseBuffer;
  }
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    // Soft pink-ish smoothing for pleasant classroom acoustics
    lastOut = (lastOut + 0.08 * white) / 1.08;
    data[i] = lastOut * 3.2;
  }
  cachedNoiseBuffer = buffer;
  return buffer;
}

const CHIME_SCALE_HZ = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export function playSpinStepSound(
  soundId: SpinSoundId = 'classic-tick',
  volume = 0.25,
  stepIndex = 0
): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (soundId === 'wood-clack') {
      // Warm hollow wood-block clack
      const osc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.036);

      bodyGain.gain.setValueAtTime(volume * 0.95, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);

      osc.connect(bodyGain);
      bodyGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);

      // Subtle woody transient tap
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(3.2, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(volume * 0.45, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.02);
      return;
    }

    if (soundId === 'casino-click') {
      // Snappy mechanical prize-wheel flapper click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1750, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.016);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.Q.setValueAtTime(1.8, now);

      gain.gain.setValueAtTime(volume * 0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.025);
      return;
    }

    if (soundId === 'chime-bell') {
      // Gentle pentatonic music-box sparkle per slice
      const noteFreq = CHIME_SCALE_HZ[Math.abs(stepIndex) % CHIME_SCALE_HZ.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(noteFreq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume * 0.52, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
      return;
    }

    if (soundId === 'breeze-whoosh') {
      // Soft felt-peg brush (gentle low-pass tap beneath the continuous wind layer)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(135, now + 0.024);

      gain.gain.setValueAtTime(volume * 0.34, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.032);
      return;
    }

    if (soundId === 'cosmic-glide') {
      // Soft harmonic pulse synchronized with slice crossings over the synth pad
      const padNotes = [392.0, 440.0, 493.88, 587.33, 659.25, 783.99];
      const freq = padNotes[Math.abs(stepIndex) % padNotes.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume * 0.32, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
      return;
    }

    // Default: 'classic-tick'
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.028);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch {
    // Ignore audio errors
  }
}

export function playTickSound(volume = 0.25): void {
  playSpinStepSound('classic-tick', volume, 0);
}

export function previewSpinSound(soundId: SpinSoundId): void {
  const ambient = startSpinAmbient(soundId);
  ambient.update(0.85);
  playSpinStepSound(soundId, 0.24, 0);
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      ambient.update(0.6);
      playSpinStepSound(soundId, 0.2, 2);
    }, 110);
    window.setTimeout(() => {
      ambient.update(0.35);
      playSpinStepSound(soundId, 0.16, 4);
    }, 240);
    window.setTimeout(() => {
      ambient.stop();
    }, 420);
  } else {
    ambient.stop();
  }
}

export interface SpinAmbientController {
  update: (speedRatio: number) => void;
  stop: () => void;
}

export function startSpinAmbient(soundId: SpinSoundId): SpinAmbientController {
  try {
    const ctx = getAudioContext();
    if (!ctx) return { update: () => {}, stop: () => {} };

    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = soundId === 'breeze-whoosh' ? 'bandpass' : 'lowpass';
    filter.Q.setValueAtTime(soundId === 'breeze-whoosh' ? 1.5 : 0.9, now);
    filter.frequency.setValueAtTime(
      soundId === 'breeze-whoosh' ? 780 : 420,
      now
    );

    const gain = ctx.createGain();
    const baseGain =
      soundId === 'breeze-whoosh'
        ? 0.15
        : soundId === 'chime-bell'
        ? 0.03
        : soundId === 'cosmic-glide'
        ? 0.04
        : 0.045;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(baseGain, now + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // Optional warm harmonic drone layer for Chime & Cosmic Glide profiles
    let droneOscA: OscillatorNode | null = null;
    let droneOscB: OscillatorNode | null = null;
    let droneFilter: BiquadFilterNode | null = null;
    let droneGain: GainNode | null = null;

    if (soundId === 'cosmic-glide' || soundId === 'chime-bell') {
      droneOscA = ctx.createOscillator();
      droneOscB = ctx.createOscillator();
      droneFilter = ctx.createBiquadFilter();
      droneGain = ctx.createGain();

      droneOscA.type = soundId === 'cosmic-glide' ? 'sawtooth' : 'sine';
      droneOscB.type = 'sine';

      droneOscA.frequency.setValueAtTime(soundId === 'cosmic-glide' ? 196 : 261.63, now);
      droneOscB.frequency.setValueAtTime(soundId === 'cosmic-glide' ? 293.66 : 392.0, now);

      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(soundId === 'cosmic-glide' ? 520 : 700, now);
      droneFilter.Q.setValueAtTime(2.2, now);

      droneGain.gain.setValueAtTime(0.001, now);
      droneGain.gain.linearRampToValueAtTime(soundId === 'cosmic-glide' ? 0.065 : 0.032, now + 0.1);

      droneOscA.connect(droneFilter);
      droneOscB.connect(droneFilter);
      droneFilter.connect(droneGain);
      droneGain.connect(ctx.destination);

      droneOscA.start(now);
      droneOscB.start(now);
    }

    let stopped = false;

    return {
      update: (speedRatio: number) => {
        if (stopped) return;
        const clamped = Math.max(0, Math.min(1, speedRatio));
        const t = ctx.currentTime;
        const targetFreq =
          soundId === 'breeze-whoosh'
            ? 240 + clamped * 960
            : 180 + clamped * 440;
        filter.frequency.setTargetAtTime(targetFreq, t, 0.04);
        gain.gain.setTargetAtTime(Math.max(0.001, baseGain * clamped), t, 0.05);

        if (droneFilter && droneGain && droneOscA && droneOscB) {
          const baseDroneGain = soundId === 'cosmic-glide' ? 0.065 : 0.032;
          droneFilter.frequency.setTargetAtTime(260 + clamped * 880, t, 0.05);
          droneGain.gain.setTargetAtTime(Math.max(0.001, baseDroneGain * clamped), t, 0.06);
          if (soundId === 'cosmic-glide') {
            droneOscA.frequency.setTargetAtTime(165 + clamped * 66, t, 0.06);
            droneOscB.frequency.setTargetAtTime(247 + clamped * 99, t, 0.06);
          }
        }
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        try {
          const t = ctx.currentTime;
          gain.gain.setTargetAtTime(0.0001, t, 0.03);
          noise.stop(t + 0.09);
          if (droneGain && droneOscA && droneOscB) {
            droneGain.gain.setTargetAtTime(0.0001, t, 0.04);
            droneOscA.stop(t + 0.1);
            droneOscB.stop(t + 0.1);
          }
        } catch {
          // Ignore cleanup errors
        }
      },
    };
  } catch {
    return { update: () => {}, stop: () => {} };
  }
}

export function playWinSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.075;
      const duration = idx === notes.length - 1 ? 0.55 : 0.24;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration + 0.02);
    });
  } catch {
    // Ignore audio errors
  }
}

export function playSplashSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [320, 480, 660];
    freqs.forEach((f, idx) => {
      const start = now + idx * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);
      osc.frequency.exponentialRampToValueAtTime(f * 1.4, start + 0.09);
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.12);
    });
  } catch {
    // Ignore
  }
}

export function playCardFlipSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.06);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // Ignore
  }
}

export function playCorrectSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [587.33, 880].forEach((freq, idx) => {
      const start = now + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  } catch {
    // Ignore
  }
}

export function playWrongSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.linearRampToValueAtTime(145, now + 0.22);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  } catch {
    // Ignore
  }
}

export function playScanBeepSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1174.66, now); // D6 crisp scanner beep
    osc.frequency.setValueAtTime(1567.98, now + 0.055); // G6 confirmation step
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  } catch {
    // Ignore audio context errors
  }
}

export function playDuckQuackSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Playful double "quack-quack" nasal formant pulse
    [0, 0.12].forEach((offset, idx) => {
      const start = now + offset;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      const baseFreq = idx === 0 ? 310 : 340;
      osc.frequency.setValueAtTime(baseFreq, start);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, start + 0.085);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1150, start);
      filter.frequency.exponentialRampToValueAtTime(780, start + 0.085);
      filter.Q.setValueAtTime(3.6, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.13, start + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.095);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.1);
    });
  } catch {
    // Ignore audio context errors
  }
}

export function playWaterStrokeSound(boosted = false): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(boosted ? 980 : 620, now);
    filter.frequency.exponentialRampToValueAtTime(boosted ? 360 : 250, now + 0.09);
    filter.Q.setValueAtTime(1.4, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(boosted ? 0.17 : 0.11, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.11);
  } catch {
    // Ignore audio context errors
  }
}

export function triggerHaptic(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors on unsupported browsers
    }
  }
}
