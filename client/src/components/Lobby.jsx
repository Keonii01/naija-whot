import { useState } from 'react';

export default function Lobby({ socket }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState(null);

  const inRoom = socket.room !== null;

  if (inRoom) {
    const { players, host_id } = socket.room;
    const isHost = host_id === socket.clientId;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <h1 className="text-3xl font-bold mb-2">Room: {socket.room.room_code}</h1>
        <p className="mb-6 text-green-200">Share this code with friends (max 8 players)</p>
        {socket.room.last_result && (
          <p className="mb-4 text-yellow-300 text-sm">
            Last game: {socket.room.last_result.winner ? `${socket.room.last_result.winner} won` : 'it was a tie'}
          </p>
        )}
        <div className="bg-green-800 rounded-xl p-6 w-full max-w-md">
          <h2 className="font-semibold mb-3">Players ({players.length}/8)</h2>
          <ul className="space-y-2">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between bg-green-700 px-3 py-2 rounded">
                <span>{p.name}</span>
                {p.id === host_id && <span className="text-yellow-300 text-sm">HOST</span>}
              </li>
            ))}
          </ul>
        </div>
        {isHost ? (
          <button
            onClick={socket.startGame}
            disabled={players.length < 2}
            className="mt-6 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-green-900 font-bold px-6 py-3 rounded-lg"
          >
            Start Game
          </button>
        ) : (
          <p className="mt-6 text-green-200">Waiting for host to start...</p>
        )}

        <button
          onClick={socket.leaveRoom}
          className="mt-4 text-red-300 hover:text-red-200 text-sm underline"
        >
          Leave Room
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
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
