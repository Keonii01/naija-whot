/* Shown on the result screen when the game is part of a tournament: who is out, who plays next, and the
   Ready buttons. It only shows what the server says (game_state.t) and sends Ready / Remove; the server
   decides everything. */
export default function TournamentPanel({ gameState, clientId, onReady, onRemove, onBackToRoom, onLeave }) {
  const t = gameState.t;
  const isHost = gameState.host_id === clientId;
  const nameOf = (id) => t.names?.[id] ?? 'Player';
  const inNext = t.players.includes(clientId);       // I am playing the next game
  const out = !t.alive.includes(clientId);           // I am knocked out
  const ready = t.ready.includes(clientId);
  const knocked = [...t.out].reverse().find((o) => o.reason === 'highest total' || o.reason === 'play-off');
  const waiting = t.alive.filter((id) => !t.players.includes(id)); // still in, but watching a play-off

  let title;
  let sub;
  if (t.stage === 'done') {
    title = t.champion ? `${nameOf(t.champion)} wins the tournament` : 'The tournament is over';
    sub = t.champion === clientId ? 'You are the champion.' : '';
  } else if (t.kind === 'playoff') {
    title = 'Tie for the highest total';
    sub = `${t.players.map(nameOf).join(' and ')} play off. Everyone else watches. The loser is out.`;
  } else {
    title = knocked ? `${nameOf(knocked.id)} is out` : `Round ${t.round}`;
    sub = knocked ? `${knocked.reason === 'play-off' ? 'Lost the play-off' : 'Highest card total'}. Round ${t.round} is next.` : '';
  }

  return (
    <div className="mb-4 rounded-2xl bg-surface-container-lowest/50 p-3 sm:p-4">
      <div className="text-center">
        <div className="text-[11px] font-bold uppercase tracking-widest text-secondary">Tournament</div>
        <h2 className="mt-1 font-display text-xl font-extrabold text-on-surface">{title}</h2>
        {sub && <p className="mt-1 text-xs text-on-surface-variant">{sub}</p>}
      </div>

      {t.stage !== 'done' && (
        <>
          <div className="mt-3 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            <span>{t.kind === 'playoff' ? 'Play-off' : `Round ${t.round}`}</span>
            <span>Ready</span>
          </div>
          <ul className="mt-1 flex flex-col gap-1">
            {t.players.map((id) => {
              const isReady = t.ready.includes(id);
              return (
                <li key={id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-container/60 px-3 py-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-on-surface">
                    {nameOf(id)}{id === clientId && <span className="ml-1.5 text-[10px] font-extrabold uppercase text-secondary">You</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {isHost && id !== clientId && !isReady && (
                      <button
                        type="button"
                        onClick={() => onRemove(id)}
                        className="rounded-full border border-error/50 px-2.5 py-1 text-[11px] font-semibold text-error hover:bg-error/10 touch-manipulation"
                      >
                        Remove
                      </button>
                    )}
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isReady ? 'bg-primary/20 text-primary' : 'bg-white/10 text-on-surface-variant'}`}>
                      {isReady ? 'Ready' : 'Not ready'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {waiting.length > 0 && (
            <p className="mt-2 px-1 text-xs text-on-surface-variant">Watching: {waiting.map(nameOf).join(', ')}</p>
          )}
        </>
      )}

      {t.out.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Out</span>
          {t.out.map((o) => (
            <span key={o.id} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-on-surface-variant">
              {o.name}{o.reason === 'highest total' || o.reason === 'play-off' ? '' : ` (${o.reason})`}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {t.stage === 'done' ? (
          <button
            type="button"
            onClick={onBackToRoom}
            className="min-h-[52px] w-full rounded-xl bg-gold font-display font-bold text-emerald-deep shadow-[0_4px_14px_rgba(255,201,77,0.35)] hover:bg-gold-hover active:scale-[0.98] touch-manipulation"
          >
            Back to Waiting Room
          </button>
        ) : inNext ? (
          <button
            type="button"
            disabled={ready}
            onClick={onReady}
            className="min-h-[52px] w-full rounded-xl bg-gold font-display font-bold text-emerald-deep shadow-[0_4px_14px_rgba(255,201,77,0.35)] hover:bg-gold-hover active:scale-[0.98] disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none touch-manipulation"
          >
            {ready ? 'Ready. Waiting for the others…' : "I'm Ready"}
          </button>
        ) : out ? (
          <p className="text-center text-sm text-on-surface-variant">You are out. You can keep watching the rest of the tournament.</p>
        ) : (
          <p className="text-center text-sm text-on-surface-variant">You are still in. Wait for the play-off to finish.</p>
        )}
      </div>
    </div>
  );
}
