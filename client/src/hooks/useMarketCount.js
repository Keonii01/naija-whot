import { useEffect, useState } from 'react';
import { sounds } from '../utils/sounds';

/* When the game ends because the market ran out, the result must not appear at once. For a few seconds the
   table says the market is finished and the cards are being counted, and only then shows who won.
   Returns true while that "counting the cards" moment is on. (A game that ends any other way returns false.) */
export function useMarketCount(gameState, ms = 3600) {
  const over = !!gameState.game_over && gameState.end_reason === 'market';
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!over) { setFinished(false); return undefined; }
    sounds.marketClosed();
    const t = setTimeout(() => setFinished(true), ms);
    return () => clearTimeout(t);
  }, [over, ms]);

  return over && !finished;
}
