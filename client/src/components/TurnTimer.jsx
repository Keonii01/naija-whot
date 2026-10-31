import { useEffect, useRef, useState } from 'react';
import { sounds } from '../utils/sounds';

/** Seconds left until the server's turn deadline (null deadline = not ticking). */
export function useCountdown(deadline, totalSeconds = 30) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (!deadline) return;
    const update = () => setRemaining(Math.max(0, deadline - Date.now() / 1000));
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [deadline]);

  const pct = deadline ? Math.max(0, Math.min(100, (remaining / totalSeconds) * 100)) : 0;
  return { remaining, pct, active: !!deadline };
}

/** Three-colour turn timer bar (green, then gold, then red), as in the Stitch table HUD. */
export default function TurnTimer({ deadline, totalSeconds = 30, tick = false }) {
  const { remaining, pct, active } = useCountdown(deadline, totalSeconds);

  // a soft tick for the last three seconds of my own turn
  const lastTick = useRef(null);
  useEffect(() => {
    if (!tick || !deadline) return;
    const left = Math.ceil(deadline - Date.now() / 1000);
    const mark = `${deadline}-${left}`;
    if (left >= 1 && left <= 3 && lastTick.current !== mark) { lastTick.current = mark; sounds.tick(left === 1); }
  }, [remaining, tick, deadline]);
  const color = pct > 50 ? 'bg-primary' : pct > 20 ? 'bg-secondary' : 'bg-[#EF4444]';

  return (
    <div className="w-full h-1.5 rounded-full bg-surface-container-lowest/80 backdrop-blur-md overflow-hidden p-[1px]">
      {active && (
        <div
          className={`h-full rounded-full ${color} transition-[width] duration-200 ease-linear`}
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}
