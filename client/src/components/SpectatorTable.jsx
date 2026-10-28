import { useEffect, useRef } from 'react';
import Card from './Card';
import OpponentPod from './OpponentPod';
import MatchResult from './MatchResult';
import { sounds } from '../utils/sounds';

const TURN_SECONDS = 30;

const SUIT_CHIP = {
  Circle: 'bg-suit-circle text-white',
  Triangle: 'bg-suit-triangle text-white',
  Cross: 'bg-suit-cross text-white',
  Square: 'bg-suit-square text-black/80',
  Star: 'bg-suit-star text-white',
};

/* Seat i of n on an ellipse. i = 0 sits at the bottom, then clockwise: 2 players face each
   other, 3 form a triangle, 8 spread all round. --rx / --ry (set on the table) scale per screen. */
function seatStyle(i, n) {
  const a = ((90 + (i * 360) / n) * Math.PI) / 180;
  return {
    left: `calc(50% + var(--rx) * ${Math.cos(a).toFixed(4)})`,
    top: `calc(50% + var(--ry) * ${Math.sin(a).toFixed(4)})`,
  };
}

function Chip({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-xl ${className}`}>
      {children}
    </span>
  );
}

const Eye = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default function SpectatorTable({ socket }) {
  const { gameState, room, clientId, rematch, returnToLobby, leaveRoom } = socket;
  const prevAction = useRef(null);

  // same card sounds the players hear
  useEffect(() => {
    if (prevAction.current !== null && prevAction.current !== gameState.last_action) {
      if (gameState.last_action?.toLowerCase().includes('draw')) sounds.cardDraw();
      else sounds.cardPlay();
    }
    prevAction.current = gameState.last_action;
  }, [gameState.last_action]);

  const players = gameState.players;
  const n = players.length;
  const top = gameState.top_card;
  const currentName = players.find((p) => p.id === gameState.current_player_id)?.name;
  const watchers = room?.spectators ?? 0;

  const calledShape = gameState.pending_shape;
  const activeLabel = calledShape ? calledShape : top.shape === 'Whot' ? 'Whot' : `${top.shape} ${top.number}`;
  const activeChip = SUIT_CHIP[calledShape || top.shape] ?? 'bg-tertiary-container text-white';

  return (
    <div className="relative min-h-[100dvh] overflow-hidden font-body text-on-surface bg-gradient-to-b from-primary-container/90 via-surface-container-high to-surface-container-low">
      {/* felt vignette + dotted texture, plus faint suit glyphs in the corners (from the Stitch design) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(131,215,177,0.10),transparent_55%,rgba(0,0,0,0.55))]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[radial-gradient(#83d7b1_1px,transparent_1px)] [background-size:16px_16px]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden sm:block font-display font-black">
        <span className="absolute left-16 top-28 rotate-12 text-8xl text-primary/10">▲</span>
        <span className="absolute right-12 top-1/3 -rotate-12 text-9xl text-secondary/10">★</span>
        <span className="absolute bottom-36 left-24 text-8xl text-primary/10">●</span>
        <span className="absolute bottom-28 right-32 rotate-45 text-9xl text-primary/10">✚</span>
      </div>

      {gameState.game_over && (
        <MatchResult
          gameState={gameState}
          clientId={clientId}
          isHost={false}
          isSpectator
          onPlayAgain={rematch}
          onBackToRoom={returnToLobby}
          onLeave={leaveRoom}
        />
      )}

      <div className="relative z-10 flex min-h-[100dvh] flex-col gap-2 p-3 sm:p-5">
        {/* HUD (pl-12 leaves room for the mute button) */}
        <div className="flex flex-wrap items-center gap-2 pl-12 min-h-10">
          <Chip className="bg-tertiary-container/40 text-on-tertiary-container shadow-[0_0_20px_rgba(136,35,223,0.35)] uppercase tracking-wider font-bold">
            <Eye className="h-4 w-4 animate-pulse" /> Spectating
          </Chip>
          {room?.room_code && (
            <Chip className="bg-surface-container-low/90 text-on-surface">
              <span className="text-secondary">#</span> {room.room_code}
            </Chip>
          )}
          <Chip className="bg-surface-container-low/90 text-on-surface-variant">
            Market: <span className="font-bold text-on-surface">{gameState.deck_count}</span>
          </Chip>
          {watchers > 0 && <Chip className="bg-surface-container-low/90 text-on-surface-variant">{watchers} watching</Chip>}
          <button
            type="button"
            onClick={leaveRoom}
            className="ml-auto min-h-[40px] shrink-0 rounded-full border border-white/25 bg-white/10 px-4 text-xs font-semibold text-on-surface transition hover:bg-white/20 touch-manipulation"
          >
            Leave
          </button>
        </div>

        {/* the table */}
        <div className="flex flex-1 items-center justify-center">
          <div className="relative mx-auto w-full max-w-5xl">
            <div
              className="relative mx-auto aspect-[4/5] w-full [--rx:36%] [--ry:40%] sm:aspect-[16/10] sm:w-[min(100%,calc((100dvh-15rem)*1.6))] sm:[--rx:42%] sm:[--ry:40%]"
            >
              {/* felt oval */}
              <div
                aria-hidden="true"
                className="absolute rounded-[50%] bg-gradient-to-b from-primary-container via-surface-container-high to-surface-container-lowest shadow-[inset_0_0_80px_rgba(0,18,11,0.9),0_20px_60px_rgba(0,0,0,0.6)]"
                style={{ left: 'calc(50% - var(--rx))', right: 'calc(50% - var(--rx))', top: 'calc(50% - var(--ry))', bottom: 'calc(50% - var(--ry))' }}
              >
                <div className="absolute inset-3 rounded-[50%] shadow-[inset_0_0_0_1px_rgba(244,191,68,0.22),0_0_30px_rgba(11,110,79,0.35)]" />
                <div className="absolute inset-6 rounded-[50%] opacity-30 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]" />
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <div className="flex h-1/2 aspect-square items-center justify-center rounded-full border border-primary/40">
                    <span className="font-display text-3xl sm:text-5xl font-black tracking-widest text-primary">WHOT</span>
                  </div>
                </div>
              </div>

              {/* players around the rim */}
              {players.map((p, i) => (
                <div key={p.id} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={seatStyle(i, n)}>
                  <OpponentPod
                    player={p}
                    isCurrent={gameState.current_player_id === p.id}
                    isHost={p.id === gameState.host_id}
                    deadline={gameState.turn_deadline}
                    totalSeconds={TURN_SECONDS}
                    compact={n > 3}
                  />
                </div>
              ))}

              {/* centre: rule chips, market, discard, whose turn */}
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
                <div className="flex min-h-[1.5rem] flex-wrap items-center justify-center gap-1.5">
                  {gameState.pending_pick > 0 && (
                    <span className="rounded-full bg-[#EF4444] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md">
                      Pick {gameState.pending_pick} Active
                    </span>
                  )}
                  {calledShape && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-md ${activeChip}`}>
                      Called shape: {calledShape}
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-center gap-3 sm:gap-10">
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                      <div className="absolute inset-0 translate-x-1 translate-y-2 rounded-xl bg-surface-container-highest opacity-70" />
                      <div className="absolute inset-0 translate-x-0.5 translate-y-1 rounded-xl bg-primary-container opacity-85" />
                      <Card faceDown size="lg" />
                    </div>
                    <span className="rounded-full bg-surface-container-high/90 px-3 py-0.5 text-xs text-on-surface shadow backdrop-blur-md">
                      {gameState.deck_count} left
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="relative">
                      <div className="absolute inset-0 -rotate-[7deg] translate-y-0.5 rounded-xl bg-white/70 opacity-60" />
                      <div className="relative rotate-2">
                        <Card card={top} size="lg" />
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-0.5 text-xs font-semibold shadow ${activeChip}`}>Active: {activeLabel}</span>
                  </div>
                </div>

                <div className="inline-flex max-w-[90%] items-center gap-2 rounded-full bg-surface-container-lowest/60 px-4 py-1 backdrop-blur-md">
                  <span className="truncate font-display text-sm font-bold tracking-tight text-on-surface-variant sm:text-base">
                    {currentName ? `${currentName}'s turn` : '…'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* bottom dock: no hand, just the live commentary */}
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl bg-surface-container-high/85 px-3 py-2 shadow-lg backdrop-blur-xl">
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-tertiary">
            <Eye className="h-4 w-4" /> <span className="hidden sm:inline">Watching</span>
          </span>
          <span className="h-5 w-px shrink-0 bg-white/15" />
          <p className="flex min-h-[2.25rem] min-w-0 flex-1 items-center text-sm font-medium leading-tight">{gameState.last_action}</p>
        </div>
      </div>
    </div>
  );
}
