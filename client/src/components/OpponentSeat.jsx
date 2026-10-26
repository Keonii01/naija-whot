import Card from './Card';

export default function OpponentSeat({ player, isCurrent }) {
  return (
    <div className={`flex flex-col items-center px-1 py-1 rounded-lg transition-all w-[4.75rem] sm:w-28 ${isCurrent ? 'ring-2 ring-yellow-400 bg-green-800/50' : ''}`}>
      <div className="flex -space-x-4 sm:-space-x-6 mb-1">
        {Array.from({ length: Math.min(player.card_count, 5) }).map((_, i) => (
          <Card key={i} faceDown size="sm" />
        ))}
      </div>
      <span className="text-xs sm:text-sm font-semibold max-w-full truncate">{player.name}</span>
      <span className="text-[11px] sm:text-xs text-green-300">
        {player.card_count} {player.card_count === 1 ? 'card' : 'cards'}
      </span>
      {player.last_card_called && <span className="text-[11px] sm:text-xs font-bold text-yellow-300">Last Card!</span>}
      {!player.connected && <span className="text-[11px] sm:text-xs text-red-400">offline</span>}
    </div>
  );
}