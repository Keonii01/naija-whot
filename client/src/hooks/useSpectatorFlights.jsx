import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import CardFlight from '../components/CardFlight';
import DrawFlight from '../components/DrawFlight';

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* The spectator's version of the table animations: a played card slides from the player who played it to the
   pile, and drawn cards slide from the deck to whoever drew them. Purely visual; the game state underneath is
   already up to date. Attach pileRef and deckRef to the pile and deck, show heldTop on the pile while a card is
   in the air, and render `layer` once anywhere on the page. */
export function useSpectatorFlights(gameState) {
  const pileRef = useRef(null);
  const deckRef = useRef(null);
  const prevTop = useRef(gameState.top_card);
  const prevCounts = useRef(Object.fromEntries(gameState.players.map((p) => [p.id, p.card_count])));
  const [flights, setFlights] = useState(null);
  const [heldTop, setHeldTop] = useState(null);
  const [draws, setDraws] = useState(null);

  // a played card: from the player's avatar to the pile
  useLayoutEffect(() => {
    const now = gameState.top_card;
    const before = prevTop.current;
    prevTop.current = now;
    if (!now || !before || now.id === before.id || reducedMotion()) return;
    const el = pileRef.current;
    const actor = gameState.last_event?.actor_id;
    const pod = actor ? document.querySelector(`[data-pod="${actor}"]`) : null;
    if (!el || !pod) return;
    const r = el.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const to = { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
    const p = pod.getBoundingClientRect();
    const s = 0.45;
    setHeldTop(before);
    setFlights({
      to,
      list: [{ key: `${now.id}-0`, card: now, fromLeft: p.left + p.width / 2 - (w * s) / 2, fromTop: p.top + p.height / 2 - (h * s) / 2, scale: s, delay: 0, startOpacity: 0.4 }],
    });
  }, [gameState.top_card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const landed = (key) => {
    if (flights && key === flights.list[flights.list.length - 1].key) { setFlights(null); setHeldTop(null); }
  };

  // drawn cards: from the deck to the player's avatar
  useLayoutEffect(() => {
    const counts = Object.fromEntries(gameState.players.map((p) => [p.id, p.card_count]));
    const before = prevCounts.current;
    prevCounts.current = counts;
    const seq = gameState.last_event?.seq;
    if (!seq || reducedMotion()) return;
    const deckEl = deckRef.current?.querySelector('.wc');
    if (!deckEl) return;
    const d = deckEl.getBoundingClientRect();
    const base = { left: d.left, top: d.top, width: d.width, height: d.height };
    const list = [];
    gameState.players.forEach((p) => {
      const delta = p.card_count - (before[p.id] ?? p.card_count);
      const pod = delta > 0 ? document.querySelector(`[data-pod="${p.id}"]`) : null;
      if (!pod) return;
      const r = pod.getBoundingClientRect();
      const s = 0.4;
      for (let i = 0; i < Math.min(delta, 4); i++) {
        list.push({
          key: `draw-${seq}-${p.id}-${i}`, base,
          dx: r.left + r.width / 2 - (d.width * s) / 2 - d.left, dy: r.top + r.height / 2 - (d.height * s) / 2 - d.top,
          scale: s, delay: i * 110, endOpacity: 0,
        });
      }
    });
    if (list.length) setDraws(list);
  }, [gameState.last_event?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const drawLanded = (f) => setDraws((prev) => (prev ? prev.filter((x) => x.key !== f.key) : prev));

  useEffect(() => {          // safety net, e.g. a hidden tab can pause animations
    if (!flights && !(draws && draws.length)) return undefined;
    const t = setTimeout(() => { setFlights(null); setHeldTop(null); setDraws(null); }, 2000);
    return () => clearTimeout(t);
  }, [flights, draws]);

  const layer = (
    <>
      {flights && flights.list.map((f) => <CardFlight key={f.key} flight={f} to={flights.to} onDone={landed} />)}
      {draws && draws.map((f) => <DrawFlight key={f.key} flight={f} onDone={drawLanded} />)}
    </>
  );
  return { pileRef, deckRef, heldTop, layer };
}
