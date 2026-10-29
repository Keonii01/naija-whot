import { useEffect, useState } from 'react';
import WaitingRoom from './WaitingRoom';
import RoomForm from './RoomForm';
import Logo from './Logo';
import HowToPlay from './HowToPlay';

const NAME_MAX = 16;
const NAME_KEY = 'whot_player_name';

const FIRST = ['Oga', 'Chief', 'Baba', 'Mama', 'Eko', 'Naija', 'Sharp', 'Lagos', 'Jollof', 'Zaza'];
const SECOND = ['Whot', 'Ace', 'King', 'Boss', 'Lion', 'Star', 'Shark', 'Tiger', 'Queen', 'Champ'];

/* just a fun suggestion for the name box, never sent anywhere */
const randomHandle = () => {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return `${pick(FIRST)}${pick(SECOND)}${10 + Math.floor(Math.random() * 90)}`.slice(0, NAME_MAX);
};

function Glyphs() {
  const base = { fill: 'none', strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' };
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block">
      <div className="absolute left-[6%] top-[8%] h-40 w-40 rounded-full bg-[#9333EA]/15 blur-3xl" />
      <div className="absolute bottom-[10%] left-[8%] h-44 w-44 rounded-full bg-secondary/10 blur-3xl" />
      <div className="absolute bottom-[12%] right-[8%] h-48 w-48 rounded-full bg-[#2563EB]/15 blur-3xl" />
      <svg viewBox="0 0 100 100" className="absolute left-[9%] top-[11%] h-14 w-14 rotate-12 opacity-50" {...base} stroke="#9333EA">
        <polygon points="50,6 63,36 96,40 71,62 78,94 50,77 22,94 29,62 4,40 37,36" />
      </svg>
      <svg viewBox="0 0 100 100" className="absolute right-[10%] top-[28%] h-20 w-20 -rotate-6 opacity-40" {...base} stroke="#16A34A">
        <path d="M50 12 L88 82 L12 82 Z" />
      </svg>
      <svg viewBox="0 0 100 100" className="absolute left-[7%] top-[52%] h-16 w-16 rotate-12 opacity-40" {...base} stroke="#F59E0B">
        <rect x="14" y="14" width="72" height="72" rx="8" />
      </svg>
      <svg viewBox="0 0 100 100" className="absolute bottom-[22%] left-[14%] h-14 w-14 opacity-40" {...base} stroke="#DC2626">
        <path d="M20 20 L80 80 M80 20 L20 80" />
      </svg>
      <svg viewBox="0 0 100 100" className="absolute bottom-[14%] right-[10%] h-28 w-28 opacity-40" {...base} stroke="#2563EB">
        <circle cx="50" cy="50" r="40" />
      </svg>
    </div>
  );
}

export default function Lobby({ socket }) {
  const [mode, setMode] = useState(null);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [showHelp, setShowHelp] = useState(false);

  // the room forms can change the saved name; pick it up again when we come back
  useEffect(() => {
    if (!mode) setName(localStorage.getItem(NAME_KEY) ?? '');
  }, [mode]);

  if (socket.room !== null) return <WaitingRoom socket={socket} />;
  if (mode) return <RoomForm mode={mode} socket={socket} onBack={() => setMode(null)} />;

  const { connected } = socket;
  const hasName = name.trim().length > 0;
  const ready = connected && hasName;

  const updateName = (v) => {
    const next = v.slice(0, NAME_MAX);
    setName(next);
    localStorage.setItem(NAME_KEY, next);
  };

  const create = (e) => {
    e.preventDefault();
    if (ready) setMode('create');
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden font-body text-on-surface bg-gradient-to-b from-primary-container/90 via-surface-container-high to-surface-container-low">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(131,215,177,0.10),transparent_55%,rgba(0,0,0,0.55))]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[radial-gradient(#83d7b1_1px,transparent_1px)] [background-size:16px_16px]" />
      <Glyphs />

      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-3 pt-16 sm:p-6">
        <form
          onSubmit={create}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface-container/85 p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl"
        >
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-secondary/60 to-transparent" />
          <div aria-hidden="true" className="absolute inset-x-8 top-1 h-px bg-white/20" />

          <Logo className="mx-auto h-24 w-24 drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)]" />
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white [text-wrap:balance]">Welcome to Naija Whot</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm sm:text-base text-on-surface">
            Oya, gather your people. Make a room, share the code, and play Whot together, live.
          </p>

          {/* real connection state (the free server can take a minute to wake up) */}
          <div
            className={`mx-auto mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              connected ? 'bg-primary/15 text-primary' : 'bg-secondary/15 text-secondary'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-primary' : 'animate-pulse bg-secondary'}`} />
            {connected ? 'Connected' : 'Connecting to the server…'}
          </div>

          <label className="mt-6 block text-left">
            <span className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-secondary">
              <span>Your name</span>
              <span className="font-semibold normal-case tracking-normal text-on-surface-variant">Saved on this device</span>
            </span>
            <div className="relative">
              <input
                value={name}
                onChange={(e) => updateName(e.target.value)}
                maxLength={NAME_MAX}
                placeholder="e.g. Chidi"
                autoComplete="nickname"
                className="min-h-[56px] w-full rounded-xl bg-surface-container-lowest/70 pl-4 pr-14 text-lg font-semibold text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-secondary"
              />
              <button
                type="button"
                onClick={() => updateName(randomHandle())}
                aria-label="Suggest a name"
                title="Suggest a name"
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-white/10 hover:text-white touch-manipulation"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="4" width="16" height="16" rx="3" />
                  <circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" />
                </svg>
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={!ready}
            className="mt-5 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-gold font-display text-lg font-extrabold text-emerald-deep shadow-[0_4px_14px_rgba(255,201,77,0.35)] transition hover:bg-gold-hover active:scale-[0.99] disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none touch-manipulation"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" />
            </svg>
            Create Game Room
          </button>

          <button
            type="button"
            onClick={() => ready && socket.createRoom(name.trim(), 1)}
            disabled={!ready}
            className="mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-tertiary-container/60 font-display text-base font-bold text-on-tertiary-container transition hover:bg-tertiary-container/80 active:scale-[0.99] disabled:opacity-40 touch-manipulation"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="8" width="14" height="10" rx="2" /><path d="M12 8V5M9.5 13h.01M14.5 13h.01" />
            </svg>
            Play vs Computer
          </button>

          <button
            type="button"
            onClick={() => ready && setMode('join')}
            disabled={!ready}
            className="mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary-container/80 font-display text-base font-bold text-white transition hover:bg-primary-container active:scale-[0.99] disabled:opacity-40 touch-manipulation"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-secondary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v4M15 12v3" />
            </svg>
            Join With Room Code
          </button>

          <p className="mt-3 min-h-[1.25rem] text-xs text-on-surface-variant">
            {!hasName ? 'Add your name to get started.' : 'Got a code? You can join to play, or just watch.'}
          </p>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-[11px] font-semibold text-on-surface-variant">
            <span>Classic 54-card deck • 2 to 8 players</span>
            <button type="button" onClick={() => setShowHelp(true)} className="min-h-[36px] shrink-0 text-xs font-bold text-secondary underline underline-offset-4 touch-manipulation">
              How to play
            </button>
          </div>
        </form>
      </div>
 </div>
  );
}
