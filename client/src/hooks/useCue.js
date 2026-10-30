import { useEffect, useRef, useState } from 'react';
import { describeEvent } from '../cues';

const SHOW_MS = 2500;

/* Returns { text, tone } for the move that just happened, for 2.5 seconds, otherwise null.
   Each server event is shown once (by seq). A plain play or draw leaves a showing cue alone,
   and a page reload or rejoin does not replay an old move. It never decides anything. */
export function useCue(event, clientId, players) {
  const lastSeq = useRef(null); // null until the first state arrives
  const timer = useRef(null);
  const [shown, setShown] = useState(null);
  const seq = event?.seq ?? 0;

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (lastSeq.current === null) { lastSeq.current = seq; return; }
    if (seq === lastSeq.current) return;
    lastSeq.current = seq;
    if (!event) { clearTimeout(timer.current); setShown(null); return; } // a fresh game
    if (!describeEvent(event, clientId, players)) return;                // plain play or draw
    clearTimeout(timer.current);
    setShown(event);
    timer.current = setTimeout(() => setShown(null), SHOW_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  return shown ? describeEvent(shown, clientId, players) : null;
}
