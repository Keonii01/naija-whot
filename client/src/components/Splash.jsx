import { useEffect, useRef, useState } from 'react';
import Logo from './Logo';

const STAY_AFTER_READY = 1000; // a short, deliberate brand moment once we are connected
const FADE_MS = 450;
const SLOW_HINT_MS = 6000;
const GIVE_UP_MS = 10000;      // never trap the player: the lobby shows its own connection status

/* adire-style diamond lattice, drawn in CSS so it needs no image file */
const adire = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><g fill='none' stroke='#83d7b1' stroke-opacity='0.13' stroke-width='1.2'><path d='M32 4 60 32 32 60 4 32Z'/><path d='M32 16 48 32 32 48 16 32Z'/></g><circle cx='32' cy='32' r='2' fill='#83d7b1' fill-opacity='0.2'/></svg>`;
const adireUrl = `url("data:image/svg+xml,${encodeURIComponent(adire)}")`;

const SUIT_DOTS = ['#2563EB', '#16A34A', '#DC2626', '#F59E0B', '#9333EA'];

export default function Splash({ ready, onDone }) {
  const [leaving, setLeaving] = useState(false);
  const [slow, setSlow] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const hint = setTimeout(() => setSlow(true), SLOW_HINT_MS);
    const giveUp = setTimeout(() => setLeaving(true), GIVE_UP_MS);
    return () => { clearTimeout(hint); clearTimeout(giveUp); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setLeaving(true), STAY_AFTER_READY);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => doneRef.current(), FADE_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  const status = ready ? "Oya, let's play!" : slow ? 'Still connecting… the server may be starting up' : 'Connecting to the server…';

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-primary-container via-surface-container-high to-surface-container-lowest font-body transition-opacity ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <style>{`
        @keyframes nw-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes nw-slide { 0% { transform: translateX(-110%) } 100% { transform: translateX(280%) } }
        @keyframes nw-glow { 0%,100% { opacity: .55 } 50% { opacity: .95 } }
        @media (prefers-reduced-motion: reduce) { .nw-anim { animation: none !important } }
      `}</style>

      <div aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: adireUrl, backgroundSize: '64px 64px' }} />
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(11,110,79,0.55),transparent_60%,rgba(0,0,0,0.6))]" />

      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="relative">
          <div
            aria-hidden="true"
            className="nw-anim absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/25 blur-3xl"
            style={{ animation: 'nw-glow 3s ease-in-out infinite' }}
          />
          <div className="nw-anim relative" style={{ animation: 'nw-float 4s ease-in-out infinite' }}>
            <Logo className="h-36 w-36 sm:h-44 sm:w-44 drop-shadow-[0_16px_30px_rgba(0,0,0,0.5)]" />
          </div>
        </div>

        <h1 className="mt-6 font-display text-5xl sm:text-6xl font-extrabold tracking-tight text-white">
          Naija <span className="text-primary">Whot</span>
          <span className="text-secondary">.</span>
        </h1>
        <p className="mt-2 text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-secondary">Play fast • Hold on</p>

        <div className="mt-8 h-1.5 w-64 max-w-[70vw] overflow-hidden rounded-full bg-black/40">
          {ready ? (
            <div className="h-full w-full rounded-full bg-gradient-to-r from-secondary to-gold transition-all duration-700" />
          ) : (
            <div
              className="nw-anim h-full w-2/5 rounded-full bg-gradient-to-r from-secondary to-gold"
              style={{ animation: 'nw-slide 1.4s ease-in-out infinite' }}
            />
          )}
        </div>
        <p className="mt-3 flex min-h-[1.25rem] items-center gap-2 text-xs sm:text-sm text-on-surface-variant">{status}</p>
      </div>

      <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-6 text-center">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {SUIT_DOTS.map((c) => (
              <span key={c} className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </div>
          <span className="h-3 w-px bg-white/20" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface">Classic 54-card deck</span>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-on-surface-variant/70">Online multiplayer • Made in Nigeria</p>
      </div>
    </div>
  );
}
