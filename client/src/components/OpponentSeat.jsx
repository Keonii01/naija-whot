import Card from './Card';

export default function OpponentSeat({ player, isCurrent }) {
  return (
    <div className={`flex flex-col items-center p-2 rounded-lg transition-all ${isCurrent ? 'ring-2 ring-yellow-400 bg-green-800/50' : ''}`}>
      <div className="flex -space-x-6 mb-1">
        {Array.from({ length: Math.min(player.card_count, 7) }).map((_, i) => (
          <Card key={i} faceDown size="sm" />
        ))}
      </div>
      <span className="text-sm font-semibold">{player.name}</span>
      <span className="text-xs text-green-300">{player.card_count} cards</span>
      {!player.connected && <span className="text-xs text-red-400">disconnected</span>}
    </div>
  );
}