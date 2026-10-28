import { useState } from 'react';
import WaitingRoom from './WaitingRoom';

export default function Lobby({ socket }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState(null);

  const inRoom = socket.room !== null;

  if (inRoom) return <WaitingRoom socket={socket} />;

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

      {mode && (
        <div className="bg-green-800 p-6 rounded-xl w-full max-w-sm space-y-4">
          <input
            className="w-full px-3 py-2 rounded text-black"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {mode === 'join' && (
            <input
              className="w-full px-3 py-2 rounded text-black uppercase"
              placeholder="Room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            />
          )}
          <button
            onClick={() => {
              if (!name.trim()) return;
              if (mode === 'create') socket.createRoom(name);
              else socket.joinRoom(roomCode, name);
            }}
            className="w-full bg-yellow-500 text-green-900 font-bold py-2 rounded"
          >
            {mode === 'create' ? 'Create' : 'Join'}
          </button>
          <button onClick={() => setMode(null)} className="w-full text-green-300 text-sm">
            Back
          </button>
        </div>
      )}
    </div>
  );
}
