import { useEffect, useState } from 'react';

export default function TurnTimer({ deadline, totalSeconds = 30 }) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (!deadline) return;
    const update = () => setRemaining(Math.max(0, deadline - Date.now() / 1000));
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return <div className="w-full h-2 bg-green-950 rounded" />;

  const pct = Math.max(0, Math.min(100, (remaining / totalSeconds) * 100));
  const color = pct > 50 ? 'bg-green-400' : pct > 20 ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className="w-full h-2 bg-green-950 rounded overflow-hidden">
      <div
        className={`h-full ${color} transition-[width] duration-200 ease-linear`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}