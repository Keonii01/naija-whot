let audioCtx;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

let muted = typeof window !== 'undefined' && localStorage.getItem('whot_muted') === '1';

export function setMuted(value) {
  muted = value;
  localStorage.setItem('whot_muted', value ? '1' : '0');
}

export function isMuted() {
  return muted;
}

function beep({ freq = 440, duration = 0.12, type = 'sine', volume = 0.15, delay = 0 }) {
  if (muted) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startTime = ctx.currentTime + delay;
    osc.start(startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.stop(startTime + duration + 0.02);
  } catch (e) {
    /* ignore (e.g. autoplay restrictions before first user gesture) */
  }
}

export const sounds = {
  cardPlay: () => beep({ freq: 523, duration: 0.1, type: 'triangle' }),
  cardDraw: () => beep({ freq: 300, duration: 0.08, type: 'sawtooth', volume: 0.1 }),
  yourTurn: () => {
    beep({ freq: 660, duration: 0.1 });
    beep({ freq: 880, duration: 0.15, delay: 0.12 });
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => beep({ freq: f, duration: 0.18, delay: i * 0.15 }));
  },
  lose: () => {
    [400, 300, 200].forEach((f, i) => beep({ freq: f, duration: 0.2, type: 'sawtooth', delay: i * 0.15 }));
  },
  error: () => beep({ freq: 150, duration: 0.15, type: 'square', volume: 0.12 }),
};