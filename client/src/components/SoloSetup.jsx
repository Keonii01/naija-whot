import { useState } from 'react';
import HowToPlay from './HowToPlay';

const MAX_COMPUTERS = 3; // the server enforces the same limit
const STANDARD_RULES = { pick_three_action: true, cancel_penalties: false, hold_on_any_card: false };
const RULE_OPTIONS = [
  { key: 'pick_three_action', label: 'Pick Three is an action card', hint: 'Turn off if you only play Pick Two. A 5 then becomes an ordinary card.' },
  { key: 'cancel_penalties', label: 'Penalties cancel out', hint: 'With 3+ players, matching Pick cards cancel each other instead of passing round.' },
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

/* Private game against the computer. Everything here is real room state:
   the number of computers, the house rules and Start all go to the server. */
export default function SoloSetup({ socket }) {
  const { room, startGame, setRules, addBot, removeBot, leaveRoom } = socket;
  const [showHelp, setShowHelp] = useState(false);

  const players = room.players ?? [];
  const bots = players.filter((p) => p.is_bot);
  const rules = room.rules ?? STANDARD_RULES;
  const turnSeconds = room.turn_seconds ?? 15;
  const dealt = players.length <= 4 ? 5 : 3; // matches the server's deal rule
  const last = room.last_result;

  const chooseComputers = (n) => {
    if (n > bots.length) for (let i = bots.length; i < n; i++) addBot();
    else if (n < bots.length) bots.slice(0, bots.length - n).forEach((b) => removeBot(b.id));
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden font-body text-on-surface bg-gradient-to-b from-primary-container/90 via-surface-container-high to-surface-container-low">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(131,215,177,0.10),transparent_55%,rgba(0,0,0,0.55))]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[radial-gradient(#83d7b1_1px,transparent_1px)] [background-size:16px_16px]" />

      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} rules={rules} turnSeconds={turnSeconds} />}

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-3 pt-16 sm:p-6">
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface-container/85 p-5 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-secondary/60 to-transparent" />
          <div aria-hidden="true" className="absolute inset-x-8 top-1 h-px bg-white/20" />

          <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-high px-3 py-1.5 shadow-inner">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Private game</span>
          </div>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-white">Play vs Computer</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Just you and the computer. Nobody else can join or watch.</p>
          {last && (
            <p className="mt-3 inline-block rounded-full bg-secondary/15 px-3 py-1.5 text-xs font-bold text-secondary">
              Last game: {last.winner ? `${last.winner} won` : 'it was a tie'}
            </p>
          )}

          {/* number of computers */}
          <h2 className="mt-6 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Computers</h2>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Number of computers">
            {Array.from({ length: MAX_COMPUTERS }, (_, i) => i + 1).map((n) => {
              const on = bots.length === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => chooseComputers(n)}
                  className={`min-h-[56px] rounded-2xl font-display text-2xl font-extrabold transition touch-manipulation active:scale-95 ${
                    on ? 'bg-gold text-emerald-deep shadow-[0_4px_14px_rgba(255,201,77,0.35)]' : 'bg-surface-container-high text-white hover:bg-surface-container-highest'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            {bots.map((b) => b.name).join(', ')} {bots.length === 1 ? 'is' : 'are'} playing. {dealt} cards each, {turnSeconds}s per turn.
          </p>

          {/* house rules */}
          <h2 className="mt-6 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">House rules</h2>
          <div className="mt-2 space-y-3 rounded-2xl bg-surface-container-lowest/50 p-3">
            {RULE_OPTIONS.map((r) => (
              <div key={r.key} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{r.label}</p>
                  <p className="text-[11px] leading-snug text-on-surface-variant">{r.hint}</p>
                </div>
                <RuleSwitch on={!!rules[r.key]} label={r.label} onChange={() => setRules({ [r.key]: !rules[r.key] })} />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={startGame}
            disabled={bots.length < 1}
            className="mt-6 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-gold font-display text-lg font-extrabold text-emerald-deep shadow-[0_4px_14px_rgba(255,201,77,0.35)] transition hover:bg-gold-hover active:scale-[0.99] disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none touch-manipulation"
          >
            Start Game
          </button>
          <button
            type="button"
            onClick={leaveRoom}
            className="mt-3 min-h-[44px] w-full rounded-xl bg-surface-container-high text-sm font-bold text-white/90 transition hover:bg-surface-container-highest active:scale-[0.99] touch-manipulation"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="mt-1 min-h-[40px] w-full text-sm font-semibold text-on-surface-variant underline underline-offset-4 hover:text-white touch-manipulation"
          >
            How to play
          </button>
        </div>
      </div>
    </div>
  );
}
