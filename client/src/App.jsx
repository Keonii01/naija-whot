import { useState } from 'react';
import { useWhotSocket } from './hooks/useWhotSocket';
import Splash from './components/Splash';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import SpectatorTable from './components/SpectatorTable';
import { setMuted, isMuted, sounds } from './utils/sounds';

export default function App() {
  const socket = useWhotSocket();
  const inGame = socket.gameState !== null;
  const [muted, setMutedState] = useState(isMuted());
  const [splashDone, setSplashDone] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) sounds.tap();
  };

  return (
    <div className="min-h-screen bg-green-900 text-white font-sans relative">
      {!splashDone && <Splash ready={socket.connected} onDone={() => setSplashDone(true)} />}
      <button
        onClick={toggleMute}
        aria-pressed={muted}
        aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
        title={muted ? 'Sound is off' : 'Sound is on'}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-surface-container-high/85 text-on-surface shadow-lg backdrop-blur-md transition hover:bg-surface-container-highest active:scale-95 touch-manipulation"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" fillOpacity="0.18" />
          {muted ? (
            <>
              <path d="M16 9.5 21 14.5" />
              <path d="M21 9.5 16 14.5" />
            </>
          ) : (
            <>
              <path d="M15.5 9a4 4 0 0 1 0 6" />
              <path d="M18.5 6.5a8 8 0 0 1 0 11" />
            </>
          )}
        </svg>
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
