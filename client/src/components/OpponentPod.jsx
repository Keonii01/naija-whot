import Card from './Card';
import { useCountdown } from './TurnTimer';

const RING_R = 24;
const RING_LEN = 2 * Math.PI * RING_R;

/**
 * Opponent seat, after the Stitch "Player Seat Pod": avatar (initial), host tag,
 * name + card-count pill, a small fan of card backs, countdown ring on the active player,
 * and a "Last Card!" pill once they've called it. Counts only; never card contents.
 */
export default function OpponentPod({ player, isCurrent, isHost, deadline, totalSeconds = 30, compact = false }) {
  const { remaining, pct } = useCountdown(isCurrent ? deadline : null, totalSeconds);
  const n = player.card_count;
  const shown = Math.min(n, 4);

  return (
    <div className={`flex flex-col items-center gap-1 sm:w-28 ${compact ? 'w-[4.4rem]' : 'w-24'}`}>
      <div className="relative w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center">
        {isCurrent && (
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r={RING_R} fill="transparent" stroke="currentColor" strokeWidth="3" className="text-surface-container-highest" />
            <circle
              cx="28" cy="28" r={RING_R} fill="transparent" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
              className="text-secondary drop-shadow-[0_0_8px_rgba(244,191,68,0.8)] transition-[stroke-dashoffset] duration-200 ease-linear"
              strokeDasharray={RING_LEN}
              strokeDashoffset={RING_LEN * (1 - pct / 100)}
            />
          </svg>
        )}
        <div
          className={`w-8 h-8 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-display font-bold text-sm sm:text-base shadow-md ${
            isCurrent ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface'
          }`}
        >
          {player.name.charAt(0).toUpperCase()}
        </div>
        {isCurrent && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-secondary text-on-secondary text-[10px] font-bold flex items-center justify-center shadow-md">
            {Math.ceil(remaining)}s
          </span>
        )}
        {isHost && (
          <span className="absolute -bottom-1 -right-1 text-[10px] bg-surface-container text-on-surface px-1.5 rounded-full shadow">
            Host
          </span>
        )}
      </div>

      <div
        className={`max-w-full rounded-full px-2.5 py-0.5 flex items-center gap-1 backdrop-blur-md ${
          isCurrent ? 'bg-secondary/20 shadow-[0_0_12px_rgba(244,191,68,0.3)]' : 'bg-surface-container-low/80'
        }`}
      >
        <span className={`truncate text-[11px] ${isCurrent ? 'text-secondary font-bold' : 'text-on-surface'}`}>{player.name}</span>
        <span className={`shrink-0 text-[10px] ${isCurrent ? 'text-on-surface font-semibold' : 'text-primary'}`}>
          <span className="sm:hidden">({n})</span>
          <span className="hidden sm:inline">• {n} {n === 1 ? 'card' : 'cards'}</span>
        </span>
      </div>

      {n > 0 && (
        <div className="pod-fan -space-x-4 mt-0.5">
          {Array.from({ length: shown }).map((_, i) => (
            <div key={i} style={{ transform: `rotate(${(i - (shown - 1) / 2) * 8}deg)` }}>
              <Card faceDown size="sm" />
            </div>
          ))}
        </div>
      )}

      {player.last_card_called && (
        <span className="text-[9px] uppercase tracking-wider bg-[#EF4444] text-white px-2 py-0.5 rounded-full font-bold animate-bounce">
          Last Card!
        </span>
      )}
      {!player.connected && <span className="text-[10px] text-error">offline</span>}
    </div>
  );
}
