import { useState, useEffect, useRef } from 'react';
import Card from './Card';
import OpponentSeat from './OpponentSeat';
import ShapeModal from './ShapeModal';
import TurnTimer from './TurnTimer';
import { sounds } from '../utils/sounds';

const TURN_SECONDS = 30;

export default function GameTable({ socket }) {
  const { gameState, clientId, playCards, drawCard, leaveRoom, rematch } = socket;
  const [selected, setSelected] = useState([]);          // ordered ids for a multi-play
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

  const combos = gameState.combos ?? {};
  const comboMates = new Set(selected.length ? (combos[selected[0]] ?? []) : []);

  useEffect(() => { setSelected([]); }, [gameState.last_action, gameState.current_player_id]);

  const submitPlay = (ids) => {
    const first = me?.hand.find((c) => c.id === ids[0]);
    if (first?.shape === 'Whot') setPendingWhotIds(ids);
    else { playCards(ids); setSelected([]); }
  };

  const handleCardClick = (card) => {
    if (!isMyTurn) return;
    const idx = selected.indexOf(card.id);
    if (idx !== -1) { setSelected(selected.slice(0, idx)); return; }   // untap it and anything after
    if (selected.length && comboMates.has(card.id)) { setSelected([...selected, card.id]); return; }
    if (!playableIds.has(card.id)) return;
    if (combos[card.id]?.length) { setSelected([card.id]); return; }   // has same-number mates: let them choose
    submitPlay([card.id]);
  };

  const handleShapeSelect = (shape) => {
    playCards(pendingWhotIds, shape);
    setPendingWhotIds(null);
    setSelected([]);
  };

  const currentPlayerName = gameState.players.find((p) => p.id === gameState.current_player_id)?.name;
  const winner = gameState.players.find((p) => p.id === gameState.winner_id);
  const isHost = gameState.host_id === clientId;

  return (
    <div className="min-h-screen flex flex-col justify-between p-4">
      {gameState.game_over && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-green-900 rounded-xl p-6 w-full max-w-sm text-center">
            <h2 className="text-2xl font-bold mb-1">
              {winner
                ? (winner.id === clientId ? '🏆 You win!' : `🏆 ${winner.name} wins!`)
                : '🤝 It’s a tie!'}
            </h2>
            <p className="text-sm text-green-800 mb-4">
              {gameState.end_reason === 'market'
                ? 'The market is finished. Lowest card total wins.'
                : gameState.end_reason === 'forfeit'
                  ? 'Everyone else left the table.'
                  : 'First to empty their hand.'}
            </p>

            {gameState.end_reason !== 'forfeit' && (
              <ol className="text-left mb-4 space-y-1">
                {(gameState.ranking ?? []).map((r) => (
                  <li
                    key={r.id}
                    className={`flex justify-between rounded px-3 py-1 ${r.id === clientId ? 'bg-yellow-100 font-semibold' : 'bg-green-50'}`}
                  >
                    <span>{r.rank}. {r.name}</span>
                    <span>{r.points} pts · {r.cards} {r.cards === 1 ? 'card' : 'cards'}</span>
                  </li>
                ))}
              </ol>
            )}

            <div className="flex flex-col gap-2">
              {isHost && !isSpectator && (
                <button onClick={rematch} className="bg-yellow-500 text-green-900 font-bold px-4 py-2 rounded">
                  Play again
                </button>
              )}
              {!isHost && !isSpectator && (
                <p className="text-sm text-green-800">Waiting for the host to start a rematch…</p>
              )}
              <button onClick={leaveRoom} className="bg-green-700 text-white px-4 py-2 rounded">
                Leave table
              </button>
            </div>
          </div>
        </div>
      )}

      {!isSpectator && !gameState.game_over && (
        <button
          onClick={() => window.confirm('Leave this game?') && leaveRoom()}
          className="fixed top-16 right-4 z-40 text-red-300 underline text-sm"
        >
          Leave
        </button>
      )}

      {pendingWhotIds && <ShapeModal onSelect={handleShapeSelect} />}

      {isSpectator && (
        <div className="text-center mb-2 bg-blue-900/60 rounded-lg py-1 flex items-center justify-center gap-3">
          <span>👁️ You are spectating this game</span>
          <button onClick={leaveRoom} className="text-red-300 underline text-sm">Leave</button>
        </div>
      )}

      <div className="w-full max-w-md mx-auto mb-2">
        <TurnTimer deadline={gameState.turn_deadline} totalSeconds={TURN_SECONDS} />
      </div>

      <div className="flex flex-wrap justify-center gap-4 mb-4">
        {opponents.map((p) => (
          <OpponentSeat key={p.id} player={p} isCurrent={gameState.current_player_id === p.id} />
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center gap-8">
        <div className="flex flex-col items-center">
          <span className="text-sm mb-1 text-green-300">Deck ({gameState.deck_count})</span>
          <Card faceDown size="lg" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-sm mb-1 text-green-300">Top Card</span>
          <Card card={gameState.top_card} size="lg" disabled />
          {gameState.pending_shape && (
            <span className="mt-1 text-xs bg-yellow-500 text-green-900 px-2 py-0.5 rounded font-bold">
              Shape: {gameState.pending_shape}
            </span>
          )}
          {gameState.pending_pick > 0 && (
            <span className="mt-1 text-xs bg-red-500 px-2 py-0.5 rounded font-bold">
              Pending Pick: {gameState.pending_pick}
            </span>
          )}
        </div>
      </div>

      <div className="text-center mb-2">
        <p className="text-sm text-green-200 h-5">{gameState.last_action}</p>
        <p className={`font-bold ${isMyTurn ? 'text-yellow-300' : 'text-green-400'}`}>
          {isSpectator ? `${currentPlayerName}'s turn` : isMyTurn ? 'Your turn!' : `Waiting for ${currentPlayerName}...`}
        </p>
      </div>

      {!isSpectator && (
        <div className="bg-green-800/60 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Your Hand ({me?.hand.length ?? 0})</span>
            <button
              onClick={drawCard}
              disabled={!isMyTurn}
              className="bg-yellow-500 disabled:opacity-40 text-green-900 font-bold px-4 py-1.5 rounded"
            >
              Draw Card
            </button>
          </div>
          {selected.length > 0 && (
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="text-sm text-green-200">
                {selected.length} selected{comboMates.size > selected.length - 1 ? ' — tap more of the same number to add' : ''}
              </span>
              <button
                onClick={() => submitPlay(selected)}
                className="bg-yellow-500 text-green-900 font-bold px-4 py-1.5 rounded"
              >
                Play {selected.length > 1 ? `${selected.length} cards` : 'this card'}
              </button>
              <button onClick={() => setSelected([])} className="text-green-300 underline text-sm">Cancel</button>
            </div>
          )}
          <div className="flex flex-wrap gap-2 justify-center">
            {me?.hand.map((card) => (
              <div
                key={card.id}
                className={`relative transition-transform ${selected.includes(card.id) ? '-translate-y-3 ring-2 ring-yellow-400 rounded-lg' : ''}`}
              >
                {selected.includes(card.id) && (
                  <span className="absolute -top-2 -right-2 z-10 bg-yellow-400 text-green-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {selected.indexOf(card.id) + 1}
                  </span>
                )}
                <Card
                  card={card}
                  onClick={() => handleCardClick(card)}
                  disabled={!isMyTurn}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}