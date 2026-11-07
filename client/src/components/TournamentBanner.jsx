/* A line above the table while a tournament game is being played: the round (or the play-off), how many players
   are left, and what that means for you if you are not one of the players. Between games the result window
   explains things, so this only shows while a game is running. Information only. */
function Trophy({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
    </svg>
  );
}

export default function TournamentBanner({ t, clientId }) {
  if (!t || t.stage !== 'match') return null;
  const nameOf = (id) => t.names?.[id] ?? 'Player';
  const out = !t.alive.includes(clientId);
  const waiting = !out && !t.players.includes(clientId);
  const playoff = t.kind === 'playoff';
  const sub = playoff
    ? `${t.players.map(nameOf).join(' vs ')}. The loser is out.`
    : '';
  const note = out ? 'You are out and watching.' : waiting ? 'You are waiting for the play-off to finish.' : '';

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-secondary/30 bg-surface-container-high/85 px-3 py-2 shadow-lg backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5">
          <Trophy className="h-4 w-4 shrink-0 text-secondary" />
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-secondary">Tournament</span>
        </span>
        <span className="font-display text-sm font-extrabold uppercase tracking-wide text-on-surface">
          {playoff ? 'Play-off' : `Round ${t.round}`}
        </span>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">
          {t.alive.length} players left
        </span>
      </div>
      {(sub || note) && (
        <p className="mt-1 text-center text-[11px] leading-snug text-on-surface-variant">
          {sub}{sub && note ? ' ' : ''}{note}
        </p>
      )}
    </div>
  );
}
