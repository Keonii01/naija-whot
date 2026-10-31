import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import Card from './Card';
import OpponentPod from './OpponentPod';
import ShapeModal from './ShapeModal';
import TurnTimer from './TurnTimer';
import MatchResult from './MatchResult';
import CardFlight from './CardFlight';
import { useCue } from '../hooks/useCue';
import { sounds } from '../utils/sounds';

export default function GameTable({ socket }) {
  const { gameState, clientId, playCards, drawCard, leaveRoom, rematch, lastCard, returnToLobby, preview, previewPlay } = socket;
  const TURN_SECONDS = gameState.turn_seconds ?? 15;
  const [selected, setSelected] = useState([]);          // ordered ids for a multi-play
  // optional help, off by default: ring the cards that can be added to a move (a personal setting, stays on this device)
  const [hints, setHints] = useState(() => { try { return localStorage.getItem('whot_hints') === '1'; } catch { return false; } });
  const toggleHints = () => setHints((h) => { try { localStorage.setItem('whot_hints', h ? '0' : '1'); } catch { /* private mode */ } return !h; });
  const [pendingWhotIds, setPendingWhotIds] = useState(null);
  const prevStateRef = useRef(null);

  const isSpectator = gameState.is_spectator;
  const me = !isSpectator ? gameState.players.find((p) => p.id === clientId) : null;
  const opponents = isSpectator
    ? gameState.players
    : gameState.players.filter((p) => p.id !== clientId);
  const isMyTurn = !isSpectator && gameState.current_player_id === clientId;

  // 🔊 Sound effects on state transitions
  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev) {
      if (prev.last_action !== gameState.last_action) {
        if (gameState.last_action?.toLowerCase().includes('draw')) sounds.cardDraw();
        else sounds.cardPlay();
      }
      if (prev.current_player_id !== gameState.current_player_id && gameState.current_player_id === clientId) {
        sounds.yourTurn();
      }
    }
    prevStateRef.current = gameState;
  }, [gameState, clientId]);

  useEffect(() => {
    if (!gameState.game_over) return;
    if (gameState.winner_id === clientId) sounds.win();
    else if (!isSpectator) sounds.lose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.game_over]);

  const playableIds = new Set(gameState.playable_card_ids ?? []);

  // Cards that could be added to the current selection. The server decides: one selected card comes with the
  // game state (extend), a longer selection is asked for with preview_play. This is only a hint, the move is re-checked on play.
  const extend = gameState.extend ?? {};
  const addable = (() => {
    if (!selected.length) return new Set();
    if (selected.length === 1) return new Set(extend[selected[0]] ?? []);
    const fresh = preview && preview.ids.length === selected.length && preview.ids.every((id, i) => id === selected[i]);
    return new Set(fresh ? preview.next : []);
  })();
  const canAddMore = [...addable].some((id) => !selected.includes(id));
  useEffect(() => { if (selected.length >= 2) previewPlay(selected); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSelected([]); }, [gameState.last_action, gameState.current_player_id]);

  // the live action pill shows the special-move cue for 2.5s, then goes back to the plain log sentence
  const cue = useCue(gameState.last_event, clientId, gameState.players);
  const CUE_TONE = { danger: 'bg-[#EF4444] text-white', good: 'bg-gold text-emerald-deep', info: 'bg-surface-container-highest text-white' };

  // if the turn moves on (timer ran out, AFK) while the picker is open, close it
  useEffect(() => { if (!isMyTurn) setPendingWhotIds(null); }, [isMyTurn]);

  // ---- cards slide to the pile (visual only; the state underneath has already moved on) ----
  const pileRef = useRef(null);          // the top card of the discard pile: where a card lands
  const outgoing = useRef(null);         // where my own cards were when I played them
  const prevTop = useRef(gameState.top_card);
  const [flights, setFlights] = useState(null);   // { to, list } while cards are in the air
  const [heldTop, setHeldTop] = useState(null);   // the old top card, shown on the pile until the new one lands

  const recordOutgoing = (ids) => {
    const cards = ids.map((id) => {
      const card = me?.hand.find((c) => c.id === id);
      const el = document.querySelector(`[data-card-id="${id}"] .wc`);
      return card && el ? { card, rect: el.getBoundingClientRect() } : null;
    }).filter(Boolean);
    outgoing.current = cards.length === ids.length ? { cards } : null;
  };

  useLayoutEffect(() => {
    const now = gameState.top_card;
    const before = prevTop.current;
    prevTop.current = now;
    const mine = outgoing.current;
    outgoing.current = null;
    if (!now || !before || now.id === before.id) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const el = pileRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const to = { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };

    let list = [];
    if (mine && mine.cards.length && mine.cards[mine.cards.length - 1].card.id === now.id) {
      list = mine.cards.map((c, i) => ({
        key: `${now.id}-${i}`, card: c.card, fromLeft: c.rect.left, fromTop: c.rect.top,
        scale: c.rect.width / w, delay: i * 110, startOpacity: 1,
      }));
    } else {
      const actor = gameState.last_event?.actor_id;
      const pod = actor && actor !== clientId ? document.querySelector(`[data-pod="${actor}"]`) : null;
      if (pod) {
        const p = pod.getBoundingClientRect();
        const s = 0.45;
        list = [{
          key: `${now.id}-0`, card: now,
          fromLeft: p.left + p.width / 2 - (w * s) / 2, fromTop: p.top + p.height / 2 - (h * s) / 2,
          scale: s, delay: 0, startOpacity: 0.4,
        }];
      }
    }
    if (!list.length) return;
    setHeldTop(before);
    setFlights({ to, list });
  }, [gameState.top_card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const landed = (key) => {
    if (flights && key === flights.list[flights.list.length - 1].key) { setFlights(null); setHeldTop(null); }
  };
  useEffect(() => {          // safety net, e.g. a hidden tab can pause animations
    if (!flights) return undefined;
    const t = setTimeout(() => { setFlights(null); setHeldTop(null); }, 1500);
    return () => clearTimeout(t);
  }, [flights]);

  const submitPlay = (ids) => {
    const last = me?.hand.find((c) => c.id === ids[ids.length - 1]);   // a Whot can only be the final card
    if (last?.shape === 'Whot') setPendingWhotIds(ids);
    else { recordOutgoing(ids); playCards(ids); setSelected([]); }
  };

  const handleCardClick = (card) => {
    if (!isMyTurn) return;
    const idx = selected.indexOf(card.id);
    if (idx !== -1) { setSelected(selected.slice(0, idx)); return; }
    if (selected.length && addable.has(card.id)) { setSelected([...selected, card.id]); return; }
    if (!playableIds.has(card.id)) return;
    // hints off: every tap only selects and you press Play; hints on: a card with nothing to add plays straight away
    if (!hints || extend[card.id]?.length) { setSelected([card.id]); return; }
    submitPlay([card.id]);
  };

  const handleShapeSelect = (shape) => {
    recordOutgoing(pendingWhotIds);
    playCards(pendingWhotIds, shape);
    setPendingWhotIds(null);
    setSelected([]);
  };

  const handleShapeCancel = () => setPendingWhotIds(null);

  const currentPlayerName = gameState.players.find((p) => p.id === gameState.current_player_id)?.name;

  // the permanent "what you must do now" line; it comes straight from the server state, so it clears the moment the penalty is taken
  const mustDo = !isMyTurn || gameState.game_over ? null
    : gameState.pending_pick > 0 ? `Pick ${gameState.pending_pick}, or answer with a ${gameState.top_card?.number}`
    : gameState.free_play ? 'Free play: any card'
    : 'Your turn: play normally';

  const isHost = gameState.host_id === clientId;

  // chip colours for the "Active: ..." pill and the called shape
  const SUIT_CHIP = {
    Circle: 'bg-suit-circle text-white',
    Triangle: 'bg-suit-triangle text-white',
    Cross: 'bg-suit-cross text-white',
    Square: 'bg-suit-square text-black/80',
    Star: 'bg-suit-star text-white',
  };
  const top = gameState.top_card;
  const activeLabel = gameState.pending_shape
    ? gameState.pending_shape
    : top.shape === 'Whot' ? 'Whot' : `${top.shape} ${top.number}`;
  const activeChip = SUIT_CHIP[gameState.pending_shape || top.shape] ?? 'bg-tertiary-container text-white';
  const handCount = me?.hand.length ?? 0;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden font-body text-on-surface bg-gradient-to-b from-primary-container/90 via-surface-container-high to-surface-container-low">
      {/* felt: soft vignette + a faint dotted watermark */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(131,215,177,0.10),transparent_55%,rgba(0,0,0,0.55))]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[radial-gradient(#83d7b1_1px,transparent_1px)] [background-size:16px_16px]" />

      {gameState.game_over && (
        <MatchResult
          gameState={gameState}
          clientId={clientId}
          isHost={isHost}
          isSpectator={isSpectator}
          solo={socket.room?.solo}
          onPlayAgain={rematch}
          onBackToRoom={returnToLobby}
          onLeave={leaveRoom}
        />
      )}

      {flights && flights.list.map((f) => <CardFlight key={f.key} flight={f} to={flights.to} onDone={landed} />)}

      {pendingWhotIds && (
        <ShapeModal
          onSelect={handleShapeSelect}
          onCancel={handleShapeCancel}
          deadline={gameState.turn_deadline}
          totalSeconds={TURN_SECONDS}
        />
      )}

      <div className="relative z-10 min-h-[100dvh] flex flex-col gap-2 p-3 sm:p-5">
        {/* top HUD: timer bar + Leave (pl-12 leaves room for the mute button) */}
        <div className="flex items-center gap-3 pl-12 min-h-10">
          <div className="flex-1 max-w-xl mx-auto">
            <TurnTimer deadline={gameState.turn_deadline} totalSeconds={TURN_SECONDS} />
          </div>

          {!isSpectator && !gameState.game_over && (
            <button
              onClick={toggleHints}
              aria-pressed={hints}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-white/10 border border-white/25 text-on-surface hover:bg-white/20 touch-manipulation"
            >
              Hints: {hints ? 'on' : 'off'}
            </button>
          )}

          {!isSpectator && !gameState.game_over && (
            <button
              onClick={() => window.confirm('Leave this game?') && leaveRoom()}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-white/10 border border-white/25 text-on-surface hover:bg-white/20 touch-manipulation"
            >
              Leave
            </button>
          )}
        </div>

        {isSpectator && (
          <div className="mx-auto w-full max-w-md text-center text-sm rounded-full bg-tertiary-container/40 backdrop-blur-md py-1 flex items-center justify-center gap-3">
            <span>👁️ You are spectating this game</span>
            <button onClick={leaveRoom} className="underline text-on-surface">Leave</button>
          </div>
        )}

        {/* live action banner */}
        <div role="status" aria-live="polite" className={`mx-auto w-full max-w-md flex items-center gap-2 rounded-2xl backdrop-blur-xl px-3 py-1.5 shadow-lg transition-colors ${cue ? CUE_TONE[cue.tone] : 'bg-surface-container-high/85'}`}>
          <span className={`shrink-0 w-2 h-2 rounded-full ${cue ? 'bg-current' : 'bg-secondary'}`} />
          <p className={`text-sm leading-tight min-h-[2.25rem] flex items-center ${cue ? 'font-bold' : 'font-medium'}`}>{cue ? cue.text : gameState.last_action}</p>
        </div>

        {/* opponents */}
        <div className="flex flex-wrap items-start justify-center gap-x-2 sm:gap-x-3 gap-y-2 rounded-xl bg-surface-container-high/60 backdrop-blur-md p-1.5 sm:bg-transparent sm:backdrop-blur-none sm:p-0">
          {opponents.map((p) => (
            <OpponentPod
              key={p.id}
              player={p}
              isCurrent={gameState.current_player_id === p.id}
              isHost={p.id === gameState.host_id}
              deadline={gameState.turn_deadline}
              totalSeconds={TURN_SECONDS}
              compact={opponents.length > 3}
            />
          ))}
        </div>

        {/* centre arena: rule chips, deck, discard, turn callout */}
        <div className="flex-1 min-h-[11rem] flex flex-col items-center justify-center gap-3">
          <div className="flex items-center justify-center gap-1.5 flex-wrap min-h-[1.5rem]">
            {gameState.pending_pick > 0 && !gameState.game_over && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EF4444] text-white shadow-md">
                Pick {gameState.pending_pick}: aimed at {isMyTurn ? 'you' : currentPlayerName}
              </span>
            )}
            {gameState.pending_shape && (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-md ${activeChip}`}>
                Shape: {gameState.pending_shape}
              </span>
            )}
          </div>

          <div className="flex items-start justify-center gap-6 sm:gap-14">
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl translate-x-1 translate-y-2 bg-surface-container-highest opacity-70" />
                <div className="absolute inset-0 rounded-xl translate-x-0.5 translate-y-1 bg-primary-container opacity-85" />
                <Card faceDown size="lg" />
              </div>
              <span className="text-xs px-3 py-0.5 rounded-full bg-surface-container-high/90 backdrop-blur-md text-on-surface shadow">
                Deck: {gameState.deck_count} left
              </span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-white/70 -rotate-[7deg] translate-y-0.5 opacity-60" />
                <div ref={pileRef} className="relative rotate-2">
                  <Card card={heldTop ?? top} size="lg" />
                </div>
              </div>
              <span className={`text-xs font-semibold px-3 py-0.5 rounded-full shadow ${activeChip}`}>
                Active: {activeLabel}
              </span>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1 backdrop-blur-md ${
              isMyTurn
                ? 'bg-secondary/15 text-secondary shadow-[0_0_24px_rgba(244,191,68,0.25)]'
                : 'bg-surface-container-lowest/60 text-on-surface-variant'
            }`}
          >
            {isMyTurn && <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />}
            <span className="font-display font-bold text-sm sm:text-lg tracking-tight">
              {isSpectator ? `${currentPlayerName}'s turn` : isMyTurn ? 'Your turn!' : `Waiting for ${currentPlayerName}…`}
            </span>
          </div>

          {mustDo && (
            <p role="status" className={`text-center text-xs sm:text-sm font-semibold ${gameState.pending_pick > 0 ? 'text-[#FCA5A5]' : 'text-on-surface-variant'}`}>
              {mustDo}
            </p>
          )}
        </div>

        {/* hand dock */}
        {!isSpectator && (
          <div className="rounded-2xl bg-surface-container-lowest/85 backdrop-blur-2xl p-2.5 sm:p-4 shadow-[0_-8px_28px_rgba(0,0,0,0.5)] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            {/* who you are + hand size */}
            <div className="flex items-center justify-between sm:justify-start gap-3 sm:shrink-0 px-1">
              <div className="hidden sm:flex w-10 h-10 rounded-full bg-primary text-on-primary items-center justify-center font-display font-bold">
                {(me?.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="hidden sm:block font-display font-semibold">{me?.name} (You)</span>
                <span className="text-[11px] sm:text-xs text-primary font-semibold">
                  <span className="sm:hidden">Your Hand ({handCount} {handCount === 1 ? 'card' : 'cards'})</span>
                  <span className="hidden sm:inline">{handCount} {handCount === 1 ? 'Card' : 'Cards'} in Hand</span>
                </span>
              </div>
              {isMyTurn && <span className="sm:hidden text-[10px] font-bold text-secondary">Select card to play</span>}
            </div>

            {/* cards (and the combo bar) */}
            <div className="flex-1 min-w-0">
              {selected.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mb-1">
                  <span className="basis-full text-center text-sm text-on-surface-variant">
                    {selected.length} selected{hints && canAddMore ? ': tap another card to add it to this move' : ''}
                  </span>
                  <button
                    onClick={() => submitPlay(selected)}
                    className="bg-gold hover:bg-gold-hover text-emerald-deep font-display font-bold px-5 min-h-[44px] rounded-xl touch-manipulation"
                  >
                    Play {selected.length > 1 ? `${selected.length} cards` : 'this card'}
                  </button>
                  <button onClick={() => setSelected([])} className="text-on-surface-variant underline text-sm py-2 px-2 touch-manipulation">
                    Cancel
                  </button>
                </div>
              )}

              <div
                className="wc-hand-row"
                style={{
                  '--n': Math.max(handCount, 1),
                  gridTemplateColumns:
                    handCount > 1 ? `repeat(${handCount - 1}, var(--strip)) var(--cw)` : 'var(--cw)',
                }}
              >
                {me?.hand.map((card) => {
                  const pos = selected.indexOf(card.id);
                  return (
                    <div key={card.id} data-card-id={card.id} className={`wc-hand-slot ${pos !== -1 ? 'is-selected' : hints && addable.has(card.id) ? 'is-addable' : ''}`}>
                      {pos !== -1 && (
                        <span
                          className="absolute left-1 z-10 bg-gold text-emerald-deep text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                          style={{ top: 'calc(var(--cw) * -0.2 - 10px)' }}
                        >
                          {pos + 1}
                        </span>
                      )}
                      <Card
                        card={card}
                        size="hand"
                        selected={pos !== -1}
                        onClick={isMyTurn ? () => handleCardClick(card) : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* actions */}
            <div className="flex flex-col gap-2 sm:w-48 sm:shrink-0">
              {handCount === 1 && !gameState.game_over && (
                me.last_card_called ? (
                  <div className="rounded-xl bg-primary-container/60 text-secondary font-bold text-center py-3">
                    ✓ Last Card called
                  </div>
                ) : (
                  <button
                    onClick={lastCard}
                    className="lastcard-glow touch-manipulation w-full min-h-[52px] rounded-xl bg-[#EF4444] active:bg-red-700 text-white text-lg font-extrabold tracking-wide"
                  >
                    LAST CARD!
                  </button>
                )
              )}
              <button
                onClick={drawCard}
                disabled={!isMyTurn}
                className="w-full min-h-[48px] rounded-xl bg-gold hover:bg-gold-hover text-emerald-deep font-display font-bold shadow-[0_4px_14px_rgba(255,201,77,0.35)] disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2 touch-manipulation"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></svg>
                <span className="sm:hidden">Draw Card from Market</span>
                <span className="hidden sm:inline">Draw Card</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
