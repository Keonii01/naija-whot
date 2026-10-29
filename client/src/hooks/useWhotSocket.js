import { useEffect, useRef, useState, useCallback } from 'react';
import { sounds } from '../utils/sounds';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
const RECONNECT_DELAY = 2000;

export function useWhotSocket() {
  // Secret token: only this browser knows it. The public id comes from the server.
  const [token] = useState(() => {
    let t = localStorage.getItem('whot_token');
    if (!t) {
      t = crypto.randomUUID?.() ??
        Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('whot_token', t);
    }
    return t;
  });
  const [clientId, setClientId] = useState(null);   // public id, assigned by the server

  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);
  const [gameOver, setGameOver] = useState(null);

  const wsRef = useRef(null);
  const clientIdRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const manualCloseRef = useRef(false);

  const connect = useCallback(() => {
    const ws = new WebSocket(`${WS_URL}/${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      const storedRoom = localStorage.getItem('whot_room_code');
      const storedName = localStorage.getItem('whot_player_name');
      if (storedRoom) {
        const spectate = localStorage.getItem('whot_spectating') === '1';
        ws.send(JSON.stringify({ type: 'rejoin', room_code: storedRoom, player_name: storedName, spectate }));
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (!manualCloseRef.current) {
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
      }
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'welcome':
          clientIdRef.current = msg.player_id;
          setClientId(msg.player_id);
          break;
        case 'room_update':
          setRoom(msg);
          localStorage.setItem('whot_room_code', msg.room_code);
          // remember whether this browser is watching, so a refresh keeps the same role
          localStorage.setItem(
            'whot_spectating',
            msg.players.some((p) => p.id === clientIdRef.current) ? '0' : '1'
          );
          break;
        case 'game_state':
          setGameState(msg.state);
          break;
        case 'error':
          setError(msg.message);
          sounds.error();
          setTimeout(() => setError(null), 3000);
          break;
        case 'game_over':
          setGameOver(msg.winner);
          break;
        case 'back_to_lobby':
          setGameState(null);
          break;
        case 'notice':
          setError(msg.message);
          setTimeout(() => setError(null), 6000);
          break;
        case 'kicked':
          localStorage.removeItem('whot_room_code');
          localStorage.removeItem('whot_spectating');
          setRoom(null);
          setGameState(null);
          setError(msg.message);
          setTimeout(() => setError(null), 6000);
          break;
        case 'rejoin_failed':
          localStorage.removeItem('whot_room_code');
          localStorage.removeItem('whot_spectating');
          setRoom(null);
          setGameState(null);
          break;
        default:
          break;
      }
    };
  }, [clientId]);

  useEffect(() => {
    connect();
    return () => {
      manualCloseRef.current = true;
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const createRoom = (name) => {
    localStorage.setItem('whot_player_name', name);
    localStorage.setItem('whot_spectating', '0');
    send({ type: 'create_room', player_name: name });
  };

  const joinRoom = (code, name, spectate = false) => {
    localStorage.setItem('whot_player_name', name);
    localStorage.setItem('whot_spectating', spectate ? '1' : '0');
    send({ type: 'join_room', room_code: code, player_name: name, spectate });
  };

  const leaveRoom = () => {
    send({ type: 'leave_room' });
    localStorage.removeItem('whot_room_code');
    setRoom(null);
    setGameState(null);
  };

  return {
    clientId,
    connected,
    room,
    gameState,
    error,
    gameOver,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame: () => send({ type: 'start_game' }),
    takeSeat: () => send({ type: 'take_seat' }),
    setRules: (rules) => send({ type: 'set_rules', rules }),
    playCard: (cardId, chosenShape) => send({ type: 'play_card', card_id: cardId, chosen_shape: chosenShape }),
    playCards: (cardIds, chosenShape) => send({ type: 'play_cards', card_ids: cardIds, chosen_shape: chosenShape }),
    drawCard: () => send({ type: 'draw_card' }),
    rematch: () => send({ type: 'rematch' }),
    lastCard: () => send({ type: 'last_card' }),
    returnToLobby: () => send({ type: 'return_to_lobby' }),
  };
}