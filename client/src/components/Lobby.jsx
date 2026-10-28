import { useState } from 'react';
import WaitingRoom from './WaitingRoom';
import RoomForm from './RoomForm';

export default function Lobby({ socket }) {
  const [mode, setMode] = useState(null);

  const inRoom = socket.room !== null;

  if (inRoom) return <WaitingRoom socket={socket} />;
  if (mode) return <RoomForm mode={mode} socket={socket} onBack={() => setMode(null)} />;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 pb-6 pt-16">
      <h1 className="text-4xl font-extrabold mb-8">🎴 Naija Whot</h1>

      {!mode && (
        <div className="flex gap-4">
          <button onClick={() => setMode('create')} className="bg-yellow-500 px-6 py-3 rounded-lg font-bold text-green-900">
            Create Room
          </button>
          <button onClick={() => setMode('join')} className="bg-green-700 px-6 py-3 rounded-lg font-bold">
            Join Room
          </button>
        </div>
      )}
    </div>
  );
}
