const SHAPE_STYLES = {
  Circle: { icon: '●', color: 'text-blue-600' },
  Triangle: { icon: '▲', color: 'text-green-600' },
  Cross: { icon: '✚', color: 'text-red-600' },
  Square: { icon: '■', color: 'text-yellow-600' },
  Star: { icon: '★', color: 'text-purple-600' },
  Whot: { icon: '✪', color: 'text-gray-900' },
};

function sizeClasses(size) {
  switch (size) {
    case 'sm': return 'w-10 h-14 text-xs';
    case 'lg': return 'w-20 h-28 text-base';
    default: return 'w-14 h-20 text-sm';
  }
}

export default function Card({ card, onClick, disabled, size = 'md', faceDown = false }) {
  if (faceDown) {
    return (
      <div className={`${sizeClasses(size)} rounded-lg bg-gradient-to-br from-green-700 to-green-950 border-2 border-green-950 shadow-md flex items-center justify-center`}>
        <span className="text-yellow-400 font-bold">W</span>
      </div>
    );
  }

  const style = SHAPE_STYLES[card.shape] || {};
  const isWhot = card.shape === 'Whot';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${sizeClasses(size)} relative rounded-lg bg-white text-gray-900 border-2 shadow-md flex flex-col items-center justify-center
        transition-transform
        ${disabled ? 'cursor-default border-gray-300' : 'cursor-pointer hover:-translate-y-2 hover:border-yellow-400 border-gray-300'}
        ${isWhot ? 'bg-gradient-to-br from-pink-200 via-yellow-200 to-blue-200' : ''}
      `}
    >
      <span className={`text-xl ${style.color}`}>{style.icon}</span>
      <span className="font-bold mt-1">{isWhot ? '20' : card.number}</span>
      {card.special && !isWhot && (
        <span className="text-[8px] text-gray-500 absolute bottom-1 px-1 text-center leading-tight">
          {card.special}
        </span>
      )}
    </button>
  );
}
