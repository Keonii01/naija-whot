/* Naija Whot sound design. Everything is synthesised with the Web Audio API, so there are no sound files to
   load. A small kit of building blocks (tone, noise, chime, pluck) is combined into the game's sounds, with a
   light reverb and a compressor on the master so it all sits together. */

let ctx = null;
let master = null;
let revSend = null;
let noiseBuf = null;

let muted = false;
try { muted = typeof window !== 'undefined' && localStorage.getItem('whot_muted') === '1'; } catch { /* private mode */ }

export function setMuted(value) {
  muted = value;
  try { localStorage.setItem('whot_muted', value ? '1' : '0'); } catch { /* private mode */ }
}
export function isMuted() { return muted; }

function makeImpulse(c, seconds, decay) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function ensure() {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp);
      comp.connect(ctx.destination);
      const verb = ctx.createConvolver();
      verb.buffer = makeImpulse(ctx, 1.4, 2.6);
      revSend = ctx.createGain();
      revSend.gain.value = 0.3;
      revSend.connect(verb);
      verb.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

const jit = (r = 0.06) => 1 + (Math.random() * 2 - 1) * r;

/* a pitched note with a quick attack and an exponential fade */
function tone({ freq = 440, end = null, type = 'sine', dur = 0.15, vol = 0.15, delay = 0, attack = 0.004, lp = null, rev = false }) {
  const c = ensure();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end) osc.frequency.exponentialRampToValueAtTime(end, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    let out = g;
    if (lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      g.connect(f);
      out = f;
    }
    out.connect(master);
    if (rev) out.connect(revSend);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch { /* ignore (e.g. autoplay restrictions before the first tap) */ }
}

/* a burst of filtered noise: card slaps, whooshes, shuffles */
function noise({ dur = 0.08, vol = 0.2, delay = 0, type = 'bandpass', f0 = 1500, f1 = null, q = 1, attack = 0.003 }) {
  const c = ensure();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}

/* a bell-like note: the note plus two quieter overtones, with reverb */
function chime(freq, delay = 0, vol = 0.12, dur = 0.7) {
  tone({ freq, dur, vol, delay, rev: true });
  tone({ freq: freq * 2, dur: dur * 0.7, vol: vol * 0.35, delay, rev: true });
  tone({ freq: freq * 3.01, dur: dur * 0.4, vol: vol * 0.15, delay, rev: true });
}

/* a soft marimba-like pluck */
function pluck(freq, delay = 0, vol = 0.13, dur = 0.28, type = 'triangle') {
  tone({ freq, type, dur, vol, delay, lp: 3200, attack: 0.003, rev: true });
}

// ---- building blocks for the game sounds ----
const LAND = 0.34; // a played card lands on the pile about this long after it leaves the hand (matches the slide animation)

function swoosh(delay = 0) {
  noise({ dur: 0.16, vol: 0.09, delay, f0: 600, f1: 2400, q: 1.2, attack: 0.04 });
}
function slap(delay = 0) {
  noise({ dur: 0.07, vol: 0.3, delay, f0: 2200 * jit(), f1: 700, q: 0.9 });
  tone({ freq: 170 * jit(), end: 80, dur: 0.09, vol: 0.28, delay });
  noise({ dur: 0.02, vol: 0.12, delay, type: 'highpass', f0: 4000, q: 0.5 });
}
function fwip(delay = 0) {
  noise({ dur: 0.14, vol: 0.12, delay, f0: 800 * jit(), f1: 3000, q: 1.4, attack: 0.02 });
  tone({ freq: 900 * jit(), end: 1500, dur: 0.05, vol: 0.03, delay });
}

export const sounds = {
  cardPlay() { swoosh(0); slap(LAND); },
  cardDraw(n = 1) { for (let i = 0; i < Math.min(n, 6); i++) fwip(i * 0.11); },
  deal(n = 5) { for (let i = 0; i < n; i++) { fwip(i * 0.09); tone({ freq: 500 + i * 60, dur: 0.03, vol: 0.04, delay: i * 0.09 + 0.1 }); } },
  shuffle() {
    for (let i = 0; i < 14; i++) noise({ dur: 0.035, vol: 0.07 + Math.random() * 0.05, delay: i * 0.035 + Math.random() * 0.01, f0: 2500 + Math.random() * 1500, q: 0.7 });
    tone({ freq: 120, end: 70, dur: 0.18, vol: 0.12, delay: 0.5 });
  },

  select() { tone({ freq: 620 * jit(0.03), end: 760, dur: 0.06, vol: 0.1 }); },
  deselect() { tone({ freq: 520, end: 400, dur: 0.05, vol: 0.08 }); },
  tap() { tone({ freq: 700, end: 500, dur: 0.04, vol: 0.07 }); },

  yourTurn(delay = 0.55) { chime(784, delay, 0.13, 0.5); chime(1175, delay + 0.12, 0.13, 0.6); },
  tick(final = false) { tone({ freq: final ? 1250 : 900, dur: 0.05, vol: 0.07 }); },
  lastCardCall() { chime(1568, 0, 0.14, 0.4); chime(1568, 0.17, 0.14, 0.5); },

  holdOn() { [523, 659, 784, 1047].forEach((f, i) => pluck(f, LAND + 0.04 + i * 0.07, 0.12)); },
  pick(atMe = false) {
    tone({ freq: 240, end: 150, type: 'sawtooth', dur: 0.28, vol: atMe ? 0.12 : 0.07, lp: 900, delay: LAND });
    if (atMe) tone({ freq: 180, end: 110, type: 'sawtooth', dur: 0.32, vol: 0.12, lp: 800, delay: LAND + 0.18 });
  },
  shield() { chime(1047, LAND, 0.14); chime(1568, LAND + 0.1, 0.12); noise({ dur: 0.2, vol: 0.05, delay: LAND, type: 'highpass', f0: 5000, q: 0.5 }); },
  suspend(atMe = false) {
    tone({ freq: 700, end: 180, type: 'square', dur: 0.35, vol: atMe ? 0.08 : 0.05, lp: 1400, delay: LAND });
    noise({ dur: 0.08, vol: atMe ? 0.14 : 0.08, delay: LAND + 0.28, f0: 400, q: 0.8 });
  },
  market() {
    chime(1175, LAND, 0.1, 0.6); chime(1568, LAND + 0.09, 0.1, 0.7);
    [2093, 2637, 3136, 2349, 2794, 3520].forEach((f, i) => chime(f * jit(0.02), LAND + 0.15 + i * 0.06, 0.06, 0.4));
  },
  whot() {
    tone({ freq: 380, end: 1700, dur: 0.4, vol: 0.1, delay: LAND - 0.1, rev: true });
    [1568, 2093, 2637].forEach((f, i) => chime(f, LAND + 0.25 + i * 0.08, 0.09, 0.6));
  },
  penalty() {
    tone({ freq: 330, end: 220, type: 'triangle', dur: 0.4, vol: 0.12, delay: LAND, lp: 1200 });
    tone({ freq: 262, end: 165, type: 'triangle', dur: 0.45, vol: 0.12, delay: LAND + 0.22, lp: 1200 });
  },

  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => pluck(f, i * 0.11, 0.14, 0.5));
    [523, 659, 784, 1047].forEach((f) => chime(f, 0.62, 0.1, 1.2));
    for (let i = 0; i < 8; i++) chime((2000 + Math.random() * 2000), 0.7 + i * 0.1, 0.05, 0.5);
  },
  lose() { [392, 349, 311, 262].forEach((f, i) => tone({ freq: f, dur: 0.5, vol: 0.12, delay: i * 0.22, lp: 1500, rev: true })); },
  error() { tone({ freq: 210, end: 140, type: 'triangle', dur: 0.14, vol: 0.12, lp: 900 }); },

  /* the sound for one move, from the server's last_event. myId is null for a spectator. */
  forEvent(ev, myId = null) {
    if (!ev) return;
    const atMe = !!myId && !!ev.target_ids?.includes(myId);
    const n = ev.amount || 1;
    switch (ev.type) {
      case 'play': this.cardPlay(); break;
      case 'hold_on': this.cardPlay(); this.holdOn(); break;
      case 'pick': this.cardPlay(); this.pick(atMe); break;
      case 'cancelled': this.cardPlay(); this.shield(); break;
      case 'blocked': this.shield(); this.cardDraw(n); break;
      case 'suspended': this.cardPlay(); this.suspend(atMe); break;
      case 'general_market': this.cardPlay(); this.market(); break;
      case 'whot': this.cardPlay(); this.whot(); break;
      case 'last_card': this.cardPlay(); this.penalty(); this.cardDraw(n); break;
      case 'pick_taken': case 'draw': case 'timeout_draw': this.cardDraw(n); break;
      case 'win': this.cardPlay(); break;
      default: break;
    }
  },
};
