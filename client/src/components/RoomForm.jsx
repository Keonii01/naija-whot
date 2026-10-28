import { useState } from 'react';

const NAME_MAX = 16;
const CODE_LEN = 5;

const cleanCode = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-secondary">
        <span>{label}</span>
        {hint && <span className="font-semibold normal-case tracking-normal text-on-surface-variant">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl bg-surface-container-lowest/70 px-4 text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-secondary';

export default function RoomForm({ mode, socket, onBack }) {
  const isJoin = mode === 'join';
  const [name, setName] = useState(() => localStorage.getItem('whot_player_name') ?? '');
  const [code, setCode] = useState('');

  const nameOk = name.trim().length > 0;
  const canSubmit = nameOk && (!isJoin || code.length === CODE_LEN);

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (isJoin) socket.joinRoom(code, name.trim());
    else socket.createRoom(name.trim());
  };

  const watch = () => {
    if (canSubmit) socket.joinRoom(code, name.trim(), true);
  };

  const pasteCode = async () => {
    try {
      setCode(cleanCode(await navigator.clipboard.readText()));
    } catch {
      /* clipboard blocked: the person can type it */
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden font-body text-on-surface bg-gradient-to-b from-primary-container/90 via-surface-container-high to-surface-container-low">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(131,215,177,0.10),transparent_55%,rgba(0,0,0,0.55))]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[radial-gradient(#83d7b1_1px,transparent_1px)] [background-size:16px_16px]" />

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-3 pt-16 sm:p-6">
        <form
          onSubmit={submit}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface-container/85 p-5 sm:p-8 shadow-2xl backdrop-blur-xl"
        >
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-secondary/60 to-transparent" />
          <div aria-hidden="true" className="absolute inset-x-8 top-1 h-px bg-white/20" />

          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-surface-container-high px-3 text-sm font-semibold text-white/90 transition hover:bg-surface-container-highest touch-manipulation"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            Lobby
          </button>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-white">
            {isJoin ? 'Join a Room' : 'Create a Room'}
          </h1>
          <p className="mt-1 text-sm sm:text-base text-on-surface">
            {isJoin
              ? 'Enter your name and the room code your host sent you.'
              : 'Pick your name, get a room code, and send it to your people.'}
          </p>

          <div className="mt-6 space-y-5">
            <Field label="Your name" hint="Everyone at the table sees this">
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                maxLength={NAME_MAX}
                placeholder="e.g. Chidi"
                autoComplete="nickname"
                autoFocus={!isJoin}
                enterKeyHint={isJoin ? 'next' : 'go'}
                className={`${inputCls} min-h-[52px] text-lg font-semibold`}
              />
            </Field>

            {isJoin && (
              <Field label="Room code" hint={`${CODE_LEN} characters`}>
                <div className="relative">
                  <input
                    value={code}
                    onChange={(e) => setCode(cleanCode(e.target.value))}
                    placeholder="K7P3M"
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    className={`${inputCls} min-h-[60px] pr-24 text-center font-display text-3xl font-extrabold uppercase tracking-[0.3em] text-secondary placeholder:tracking-[0.3em]`}
                  />
                  <button
                    type="button"
                    onClick={pasteCode}
                    className="absolute right-2 top-1/2 flex min-h-[40px] -translate-y-1/2 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 text-xs font-bold text-white transition hover:bg-surface-container-highest touch-manipulation"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <rect x="6" y="5" width="12" height="16" rx="2" /><path d="M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
                    </svg>
                    Paste
                  </button>
                </div>
              </Field>
            )}
          </div>

          {/* real rules, not fake options */}
          <div className="mt-5 rounded-2xl bg-surface-container-lowest/50 px-4 py-3 text-xs sm:text-sm text-on-surface-variant">
            {isJoin ? (
              <p>Not in the mood to play? Tap Just Watch to follow the game without a seat. If the game has already started, you will watch.</p>
            ) : (
              <ul className="space-y-1">
                <li>• 2 to 8 players, 30 seconds per turn</li>
                <li>• 5 cards each (2–4 players) or 3 cards each (5–8)</li>
                <li>• You are the host and start the game when everyone is in</li>
              </ul>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-6 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-gold font-display text-lg font-extrabold text-emerald-deep shadow-[0_4px_14px_rgba(255,201,77,0.35)] transition hover:bg-gold-hover active:scale-[0.99] disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none touch-manipulation"
          >
            {isJoin ? 'Join as Player' : 'Create Room'}
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>

          {isJoin && (
            <button
              type="button"
              onClick={watch}
              disabled={!canSubmit}
              className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 font-display text-base font-bold text-white transition hover:bg-white/10 active:scale-[0.99] disabled:opacity-40 touch-manipulation"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
              </svg>
              Just Watch
            </button>
          )}

          <button
            type="button"
            onClick={onBack}
            className="mt-2 min-h-[44px] w-full text-sm font-semibold text-on-surface-variant underline underline-offset-4 hover:text-white touch-manipulation"
          >
            Cancel and return to Lobby
          </button>
        </form>
      </div>
    </div>
  );
}
