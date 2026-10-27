/**
 * End-of-match screen, following the Stitch "Win Screen Modal":
 * trophy medallion, status pill, headline, final standings, action buttons.
 * Left out on purpose (the game has no such features): coins/bounty, XP/prestige,
 * turn replay, round counter, nav bar, latency and server badges.
 */

const RANK_BG = [
  'bg-surface-container-highest/90 shadow-md',
  'bg-surface-container/60',
  'bg-surface-container/40',
  'bg-surface-container/30',
];
const AVATAR_TINT = ['text-tertiary', 'text-primary', 'text-secondary', 'text-on-surface-variant'];

function Trophy({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
    </svg>
  );
}

function Person({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

/* the five Whot suit symbols as quiet background decoration */
function Decor() {
  const cls = 'absolute pointer-events-none';
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <svg className={`${cls} top-[12%] left-[8%] w-8 h-8 text-secondary opacity-70`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><polygon points="12,2 15,8.5 22,9.2 17,14 18.5,21 12,17.3 5.5,21 7,14 2,9.2 9,8.5" /></svg>
      <svg className={`${cls} top-[26%] right-[9%] w-7 h-7 text-primary opacity-60`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><polygon points="12,3 22,21 2,21" /></svg>
      <svg className={`${cls} top-[48%] left-[6%] w-5 h-5 text-primary opacity-60`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l14 14M19 5L5 19" /></svg>
      <svg className={`${cls} bottom-[22%] left-[11%] w-6 h-6 text-tertiary opacity-70`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
      <svg className={`${cls} bottom-[14%] right-[10%] w-9 h-9 text-secondary opacity-70`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /></svg>
    </div>
  );
}

export default function MatchResult({ gameState, clientId, isHost, isSpectator, onPlayAgain, onBackToRoom, onLeave }) {
  const ranking = gameState.ranking ?? [];
  const winner = gameState.players.find((p) => p.id === gameState.winner_id);
  const youWon = gameState.winner_id === clientId;
  const tie = !winner;
  const reason =
    gameState.end_reason === 'market'
      ? 'The market is finished. The lowest penalty total wins.'
      : gameState.end_reason === 'forfeit'
        ? 'Everyone else left the table.'
        : 'First to empty their hand.';

  const pill = tie ? 'Match complete • Draw' : youWon ? 'Match complete • Victory' : 'Match complete';
  const headline = tie ? 'It’s a Draw!' : youWon ? 'You Win the Match!' : `${winner.name} Wins the Match!`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-surface/80 backdrop-blur-sm font-body">
      <Decor />
      <div className="absolute w-[420px] h-[420px] rounded-full bg-secondary-container/20 blur-[110px] pointer-events-none" />

      <div className="relative w-full max-w-xl max-h-[94dvh] overflow-y-auto rounded-[24px] bg-surface-container-low/90 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,18,11,0.85)] border border-secondary/30 p-4 sm:p-8">
        {/* medallion + headline */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-24 h-24 rounded-full bg-secondary/30 blur-xl" />
            <div className="relative w-20 h-20 rounded-full bg-surface-container-high shadow-2xl flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-secondary-container via-secondary to-secondary-fixed flex items-center justify-center shadow-inner">
                <Trophy className="w-9 h-9 text-surface-container-lowest" />
              </div>
            </div>
          </div>

          <div className="mt-3 inline-flex items-center gap-2 px-4 py-1 rounded-full bg-secondary-container/40">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="text-[12px] font-bold text-secondary tracking-widest uppercase">{pill}</span>
          </div>

          <h1 className="mt-3 font-display text-[28px] sm:text-[40px] leading-tight font-extrabold tracking-tight text-on-surface">
            {headline}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant max-w-md">{reason}</p>
        </div>

        {/* final standings */}
        {gameState.end_reason !== 'forfeit' && (
          <div className="flex flex-col gap-1 mb-5">
            <div className="flex items-center justify-between px-1 text-[12px] font-bold tracking-wider text-on-surface-variant">
              <span>FINAL STANDINGS</span>
              <span>REMAINING CARDS</span>
            </div>

            {ranking.map((r, i) => {
              const you = r.id === clientId;
              const champion = r.rank === 1 && !!winner && r.id === winner.id;
              return (
                <div
                  key={r.id}
                  className={`w-full rounded-xl p-2 flex items-center justify-between gap-3 ${RANK_BG[Math.min(i, 3)]}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-display text-[14px] font-extrabold ${
                        champion ? 'bg-secondary text-surface-container-lowest' : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {r.rank}
                    </div>
                    <div
                      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-display text-sm font-bold ${
                        you ? 'bg-primary-container' : `bg-surface-container-high ${AVATAR_TINT[i % 4]}`
                      }`}
                    >
                      {you ? <Person className="w-5 h-5 text-on-primary" /> : r.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`truncate text-sm text-on-surface ${champion ? 'font-bold' : 'font-semibold'}`}>{r.name}</span>
                        {you && (
                          <span className="shrink-0 text-[10px] uppercase px-1.5 bg-secondary text-surface-container-lowest rounded-full font-extrabold tracking-wider">
                            You
                          </span>
                        )}
                      </div>
                      {champion && <div className="text-[12px] font-semibold text-secondary">Match Champion</div>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold whitespace-nowrap ${champion ? 'text-secondary' : 'text-on-surface'}`}>
                      {r.cards === 0 ? '0 Cards (Out)' : `${r.cards} ${r.cards === 1 ? 'Card' : 'Cards'}`}
                    </div>
                    <div className="text-[12px] text-on-surface-variant whitespace-nowrap">
                      {r.cards === 0 ? 'Hand cleared' : `${r.points} Penalty Pts`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* actions */}
        <div className="flex flex-col gap-3">
          {!isSpectator && (
            <div className="flex gap-3">
              {isHost ? (
                <>
                  <button
                    onClick={onPlayAgain}
                    className="flex-1 min-h-[52px] rounded-xl bg-gold hover:bg-gold-hover active:scale-[0.98] text-emerald-deep font-display font-bold shadow-[0_4px_14px_rgba(255,201,77,0.35)] touch-manipulation"
                  >
                    Play Again
                  </button>
                  <button
                    onClick={onBackToRoom}
                    className="px-5 min-h-[52px] rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white font-semibold touch-manipulation"
                  >
                    Waiting Room
                  </button>
                </>
              ) : (
                <button
                  onClick={onBackToRoom}
                  className="flex-1 min-h-[52px] rounded-xl bg-gold hover:bg-gold-hover active:scale-[0.98] text-emerald-deep font-display font-bold shadow-[0_4px_14px_rgba(255,201,77,0.35)] touch-manipulation"
                >
                  Back to Waiting Room
                </button>
              )}
            </div>
          )}
          {!isHost && !isSpectator && (
            <p className="text-center text-[12px] text-on-surface-variant">The host can start a rematch from here.</p>
          )}
          <button onClick={onLeave} className="self-center py-2 px-3 text-sm text-error underline touch-manipulation">
            Leave room
          </button>
        </div>
      </div>
    </div>
  );
}
