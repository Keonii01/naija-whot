/* The end of a tournament: who won, and the order everyone finished in. It only shows what the server says
   (game_state.t) and offers the two ways out. */
// why a player went out, in plain words
const REASON = {
  'highest total': 'highest card total',
  'play-off': 'lost the play-off',
  'removed by host': 'removed by the host',
  left: 'left the tournament',
  inactive: 'removed for inactivity',
};

function Trophy({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
    </svg>
  );
}

/* the five Whot suits as quiet decoration, like the match result */
function Decor() {
  const cls = 'absolute pointer-events-none';
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <svg className={`${cls} top-[10%] left-[8%] w-8 h-8 text-secondary opacity-70`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><polygon points="12,2 15,8.5 22,9.2 17,14 18.5,21 12,17.3 5.5,21 7,14 2,9.2 9,8.5" /></svg>
      <svg className={`${cls} top-[24%] right-[9%] w-7 h-7 text-primary opacity-60`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><polygon points="12,3 22,21 2,21" /></svg>
      <svg className={`${cls} bottom-[24%] left-[11%] w-6 h-6 text-tertiary opacity-70`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
      <svg className={`${cls} bottom-[12%] right-[10%] w-9 h-9 text-secondary opacity-70`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /></svg>
    </div>
  );
}

export default function ChampionScreen({ gameState, clientId, onBackToRoom, onLeave }) {
  const t = gameState.t;
  const nameOf = (id) => t.names?.[id] ?? 'Player';
  const youWon = !!t.champion && t.champion === clientId;

  // best first: the champion, then the players in the reverse of the order they went out.
  // Each row has a title ("Out in round 2", "Lost the final") and the reason in smaller words underneath.
  const order = [];
  if (t.champion) order.push({ id: t.champion, title: 'Champion', why: '' });
  [...t.out].reverse().forEach((o, i) => {
    const knockedOut = o.reason === 'highest total' || o.reason === 'play-off';
    const title = knockedOut && i === 0 && t.champion ? 'Lost the final' : o.round ? `Out in round ${o.round}` : 'Out';
    order.push({ id: o.id, title, why: REASON[o.reason] ?? o.reason });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-surface/85 backdrop-blur-sm font-body">
      <Decor />
      <div className="absolute w-[460px] h-[460px] rounded-full bg-secondary-container/25 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md max-h-[94dvh] overflow-y-auto slim-scroll rounded-[24px] bg-surface-container-low/90 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,18,11,0.85)] border border-secondary/40 p-5 sm:p-7">
        <div className="flex flex-col items-center text-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-28 h-28 rounded-full bg-secondary/40 blur-xl" />
            <div className="relative w-24 h-24 rounded-full bg-surface-container-high shadow-2xl flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-secondary-container via-secondary to-secondary-fixed flex items-center justify-center shadow-inner">
                <Trophy className="w-11 h-11 text-surface-container-lowest" />
              </div>
            </div>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 px-4 py-1 rounded-full bg-secondary-container/40">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="text-[12px] font-bold text-secondary tracking-widest uppercase">Tournament complete</span>
          </div>

          <h1 className="mt-3 font-display text-[28px] sm:text-[34px] leading-tight font-extrabold tracking-tight text-on-surface">
            {t.champion ? (youWon ? 'You are the champion!' : `${nameOf(t.champion)} is the champion!`) : 'No champion this time'}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {t.champion ? 'The last player standing.' : 'Everyone left before the tournament finished.'}
          </p>
        </div>

        {order.length > 0 && (
          <ol className="mt-5 flex flex-col gap-1">
            {order.map((row, i) => {
              const first = i === 0 && !!t.champion;
              return (
                <li key={row.id} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${first ? 'bg-surface-container-highest/90 shadow-md' : 'bg-surface-container/60'}`}>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold ${first ? 'bg-secondary text-surface-container-lowest' : 'bg-surface-container-high text-on-surface-variant'}`}>{i + 1}</span>
                    <span className="min-w-0 truncate text-sm font-semibold text-on-surface">
                      {nameOf(row.id)}{row.id === clientId && <span className="ml-1.5 text-[10px] font-extrabold uppercase text-secondary">You</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right leading-tight">
                    <span className={`block text-xs ${first ? 'font-bold text-secondary' : 'font-semibold text-on-surface'}`}>{row.title}</span>
                    {row.why && <span className="block text-[11px] text-on-surface-variant">{row.why}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onBackToRoom}
            className="min-h-[52px] w-full rounded-xl bg-gold font-display font-bold text-emerald-deep shadow-[0_4px_14px_rgba(255,201,77,0.35)] hover:bg-gold-hover active:scale-[0.98] touch-manipulation"
          >
            Back to Waiting Room
          </button>
          <button type="button" onClick={onLeave} className="mx-auto py-2 px-3 text-sm text-error underline touch-manipulation">
            Leave room
          </button>
        </div>
      </div>
    </div>
  );
}
