import { useLayoutEffect, useRef } from 'react';
import Card from './Card';

const DURATION = 420; // ms

/* One card back sliding from the deck to the player who drew it. Purely visual: the hand and the card
   counts have already been updated underneath, and this is removed when it lands. */
export default function DrawFlight({ flight, onDone }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.animate) { onDone(flight); return undefined; }
    const anim = el.animate(
      [
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
        { transform: `translate(${flight.dx}px, ${flight.dy}px) scale(${flight.scale})`, opacity: flight.endOpacity },
      ],
      { duration: DURATION, delay: flight.delay, easing: 'cubic-bezier(0.22, 0.8, 0.3, 1)', fill: 'both' },
    );
    anim.onfinish = () => onDone(flight);
    return () => anim.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { base } = flight;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', left: base.left, top: base.top, width: base.width, height: base.height, transformOrigin: 'top left', pointerEvents: 'none', zIndex: 60 }}
    >
      <Card faceDown size="lg" />
    </div>
  );
}
