import { useState } from 'react';
import HowToPlay from './HowToPlay';

const MAX_SEATS = 8;
const AVATAR_COLORS = ['#2563EB', '#16A34A', '#DC2626', '#F59E0B', '#9333EA']; // the five suit colours

/* cosmetic only: same player id always gets the same colour */
function colorFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* House rules the host can switch. Only the server decides what they do. */
const STANDARD_RULES = { pick_three_action: true, cancel_penalties: false, hold_on_any_card: false };
const RULE_OPTIONS = [
  { key: 'pick_three_action', label: 'Pick Three is an action card', hint: 'Turn off if your table only plays Pick Two. A 5 then becomes an ordinary card.' },
  { key: 'cancel_penalties', label: 'Penalties cancel out', hint: 'With 3+ players, matching Pick cards cancel each other instead of passing round. Any leftover goes to the next player.' },
  { key: 'hold_on_any_card', label: 'Hold On lets you play any card', hint: 'After you play a 1, your extra play can be any card, whatever the shape or number.' },
];

function RuleSwitch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors touch-manipulation ${on ? 'bg-primary' : 'bg-white/20'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function Seat({ player, isHost, isYou, onRemove }) {
  const color = colorFor(player.id);
  return (
    <div className="relative flex flex-col items-center gap-1 sm:gap-1.5 rounded-2xl bg-surface-container-high/80 px-1 pt-5 pb-2.5 sm:px-2 sm:pb-3 shadow-lg min-w-0">
      {isHost && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-on-secondary">
          HOST
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${player.name}`}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white/70 transition hover:bg-black/50 hover:text-white touch-manipulation"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      )}
      <div
        className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full font-display text-xl font-extrabold text-white shadow-inner ring-2 ring-white/20"
        style={{ backgroundColor: color }}
      >
        {(player.name || '?').charAt(0).toUpperCase()}
      </div>
      <span className="w-full truncate text-center font-display text-xs sm:text-sm font-semibold text-white">{player.name}</span>
      {player.is_bot ? (
        <span className="rounded-full bg-tertiary-container/60 px-2 py-0.5 text-[10px] font-bold text-on-tertiary-container">Computer</span>
      ) : (
        <span className={`text-[10px] sm:text-[11px] font-semibold ${isYou ? 'text-secondary' : 'hidden sm:block text-on-surface-variant'}`}>
          {isYou ? 'You' : 'In the room'}
        </span>
      )}
    </div>
  );
}

function EmptySeat({ n }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/20 bg-surface-container-lowest/40 px-1 py-3 min-h-[104px] sm:px-2 sm:min-h-[128px]">
      <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-dashed border-white/20 font-display text-lg font-bold text-white/30">
        {n}
      </div>
      <span className="text-[10px] sm:text-[11px] font-semibold text-white/40">Empty seat</span>
    </div>
  );
}

export default function WaitingRoom({ socket }) {
  const { room, clientId, startGame, takeSeat, setRules, addBot, removeBot, leaveRoom } = socket;
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const { players, host_id, room_code, last_result } = room;
  const watchers = room.spectators ?? 0;
  const TURN_SECONDS = room.turn_seconds ?? 15;
  const isWatcher = !players.some((p) => p.id === clientId);
  const isHost = host_id === clientId;
  const hostName = players.find((p) => p.id === host_id)?.name ?? 'the host';
  const count = players.length;
  const canStart = count >= 2;
  const dealt = count <= 4 ? 5 : 3; // matches the server's deal rule
  const rules = room.rules ?? STANDARD_RULES;
  const customCount = RULE_OPTIONS.filter((r) => rules[r.key] !== STANDARD_RULES[r.key]).length;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this room code:', room_code);
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `Oya, come play Naija Whot with me! Room code: ${room_code}\n${window.location.origin}`
  )}`;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden font-body text-on-surface bg-gradient-to-b from-primary-container/90 via-surface-container-high to-surface-container-low">
      {/* felt: soft vignette + faint dotted watermark (same as the game table) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(131,215,177,0.10),transparent_55%,rgba(0,0,0,0.55))]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[radial-gradient(#83d7b1_1px,transparent_1px)] [background-size:16px_16px]" />

      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} rules={rules} turnSeconds={TURN_SECONDS} />}

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-3 pt-16 sm:p-6">
        <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-surface-container/85 p-4 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* specular glass edge */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-secondary/60 to-transparent" />
          <div aria-hidden="true" className="absolute inset-x-8 top-1 h-px bg-white/20" />

          {/* status row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-high px-3 py-1.5 shadow-inner">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Waiting Room</span>
              <span className="h-1.5 w-1.5 rounded-full bg-on-surface-variant" />
              <span className="text-xs font-bold text-on-surface-variant">{count}/{MAX_SEATS} players</span>
              {watchers > 0 && (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-on-surface-variant" />
                  <span className="text-xs font-bold text-on-surface-variant">{watchers} watching</span>
                </>
              )}
            </div>
            {last_result && (
              <span className="rounded-full bg-secondary/15 px-3 py-1.5 text-xs font-bold text-secondary">
                Last game: {last_result.winner ? `${last_result.winner} won` : 'it was a tie'}
              </span>
            )}
          </div>

          {/* room code */}
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Room code</p>
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-[0.12em] text-secondary">{room_code}</h1>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={copyCode}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-surface-container-high px-4 text-sm font-bold text-white transition hover:bg-surface-container-highest active:scale-95 touch-manipulation"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  {copied ? <path d="M5 12l5 5 9-10" /> : <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>}
                </svg>
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#25D366]/20 px-4 text-sm font-bold text-[#7CF0A8] transition hover:bg-[#25D366]/30 active:scale-95 touch-manipulation"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.8-4.6-4-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.3 2.5 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.800.9c.3.1.5.2.5.3.1.2.1.700-.1 1.300z" />
                </svg>
                WhatsApp
              </a>
            </div>
          </div>

          {/* real match facts + house rules */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {[`${TURN_SECONDS}s per turn`, `${dealt} cards each`].map((t) => (
              <span key={t} className="rounded-xl bg-surface-container-lowest/60 px-2.5 py-1 text-[11px] font-semibold text-on-surface sm:px-3 sm:py-1.5 sm:text-xs">
                {t}
              </span>
            ))}
            <button
              type="button"
              onClick={() => setShowRules((v) => !v)}
              aria-expanded={showRules}
              className="ml-auto inline-flex min-h-[32px] items-center gap-1.5 rounded-xl bg-surface-container-high px-2.5 text-[11px] font-bold text-white sm:px-3 sm:text-xs transition hover:bg-surface-container-highest touch-manipulation"
            >
              House rules
              {customCount > 0 && (
                <span className="rounded-full bg-secondary px-1.5 text-[10px] font-extrabold text-on-secondary">{customCount}</span>
              )}
              <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${showRules ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>

          {showRules && (
            <div className="mt-3 space-y-3 rounded-2xl bg-surface-container-lowest/50 p-3">
              {RULE_OPTIONS.map((r) => (
                <div key={r.key} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">{r.label}</p>
                    <p className="text-[11px] leading-snug text-on-surface-variant">{r.hint}</p>
                  </div>
                  {isHost ? (
                    <RuleSwitch on={!!rules[r.key]} label={r.label} onChange={() => setRules({ [r.key]: !rules[r.key] })} />
                  ) : (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${rules[r.key] ? 'bg-primary/20 text-primary' : 'bg-white/10 text-on-surface-variant'}`}>
                      {rules[r.key] ? 'ON' : 'OFF'}
                    </span>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-on-surface-variant">
                {isHost ? 'You choose the rules before the game starts.' : 'Only the host can change these.'}
              </p>
            </div>
          )}

          {/* seats */}
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Player seats</h2>
            {isHost && count < MAX_SEATS ? (
              <button
                type="button"
                onClick={addBot}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-xl bg-tertiary-container/50 px-3 text-[11px] font-bold text-on-tertiary-container transition hover:bg-tertiary-container/80 active:scale-95 touch-manipulation sm:text-xs"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                Add computer
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-on-surface-variant">Need at least 2 to start</span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-x-1.5 gap-y-3 sm:gap-x-3 sm:gap-y-4">
            {players.map((p) => (
              <Seat key={p.id} player={p} isHost={p.id === host_id} isYou={p.id === clientId} onRemove={isHost && p.is_bot ? () => removeBot(p.id) : undefined} />
            ))}
            {Array.from({ length: MAX_SEATS - count }, (_, i) => (
              <EmptySeat key={`empty-${i}`} n={count + i + 1} />
            ))}
          </div>

          {/* actions */}
          <div className="mt-6 flex flex-col gap-3">
            {isWatcher ? (
              <>
                <div className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-surface-container-lowest/60 px-4 py-2 text-center font-display text-sm sm:text-base font-bold text-on-surface">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-secondary" />
                  You are watching. The game shows up here when the host starts it.
                </div>
                <button
                  type="button"
                  onClick={takeSeat}
                  disabled={count >= MAX_SEATS}
                  className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-gold font-display text-base font-extrabold text-emerald-deep shadow-[0_4px_14px_rgba(255,201,77,0.35)] transition hover:bg-gold-hover active:scale-[0.99] disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none touch-manipulation"
                >
                  {count >= MAX_SEATS ? 'Room is full' : 'Take a seat and play'}
                </button>
              </>
            ) : isHost ? (
              <button
                type="button"
                onClick={startGame}
                disabled={!canStart}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-gold font-display text-lg font-extrabold text-emerald-deep shadow-[0_4px_14px_rgba(255,201,77,0.35)] transition hover:bg-gold-hover active:scale-[0.99] disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none touch-manipulation"
              >
                {canStart ? `Start Game (${count} players)` : 'Waiting for one more player…'}
              </button>
            ) : (
              <div className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-surface-container-lowest/60 px-4 text-center font-display font-bold text-on-surface">
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-secondary" />
                Waiting for {hostName} to start the game…
              </div>
            )}
            <button
              type="button"
              onClick={leaveRoom}
              className="min-h-[44px] w-full rounded-xl bg-surface-container-high text-sm font-bold text-white/90 transition hover:bg-surface-container-highest active:scale-[0.99] touch-manipulation"
            >
              Leave Room
            </button>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="min-h-[40px] text-sm font-semibold text-on-surface-variant underline underline-offset-4 hover:text-white touch-manipulation"
            >
              How to play
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
