import { useState } from 'react';
import { useWhotSocket } from './hooks/useWhotSocket';
import Splash from './components/Splash';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import SpectatorTable from './components/SpectatorTable';
import { setMuted, isMuted } from './utils/sounds';

export default function App() {
  const socket = useWhotSocket();
  const inGame = socket.gameState !== null;
  const [muted, setMutedState] = useState(isMuted());
  const [splashDone, setSplashDone] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <div className="min-h-screen bg-green-900 text-white font-sans relative">
      {!splashDone && <Splash ready={socket.connected} onDone={() => setSplashDone(true)} />}
      <button
        onClick={toggleMute}
        className="fixed top-4 left-4 z-50 bg-green-800 w-10 h-10 rounded-full flex items-center justify-center"
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {!socket.connected && (
        <div className="fixed top-0 left-0 w-full bg-red-700 text-center py-1 z-50 text-sm">
          Reconnecting to server...
        </div>
      )}

      {socket.error && (
        <div className="fixed top-14 left-3 right-3 sm:top-4 sm:left-auto sm:right-4 sm:max-w-sm bg-red-600 px-4 py-2 rounded shadow-lg z-50 text-center sm:text-left pointer-events-none">
          {socket.error}
        </div>
      )}

      {!inGame ? (
        <Lobby socket={socket} />
      ) : socket.gameState.is_spectator ? (
        <SpectatorTable socket={socket} />
      ) : (
        <GameTable socket={socket} />
      )}
    </div>
  );
}
