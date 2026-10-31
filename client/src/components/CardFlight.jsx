import { useLayoutEffect, useRef } from 'react';
import Card from './Card';

const DURATION = 420; // ms

/* One card sliding from where it was played to the discard pile. Purely visual: it is drawn on top
   of the table and removed when it lands. The game state underneath has already moved on. */
export default function CardFlight({ flight, to, onDone }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.animate) { onDone(flight.key); return undefined; }
    const anim = el.animate(
      [
        { transform: `translate(${flight.fromLeft - to.left}px, ${flight.fromTop - to.top}px) scale(${flight.scale}) rotate(0deg)`, opacity: flight.startOpacity },
        { transform: 'translate(0px, 0px) scale(1) rotate(2deg)', opacity: 1 },
      ],
      { duration: DURATION, delay: flight.delay, easing: 'cubic-bezier(0.22, 0.8, 0.3, 1)', fill: 'both' },
    );
    anim.onfinish = () => onDone(flight.key);
    return () => anim.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', left: to.left, top: to.top, width: to.width, height: to.height, transformOrigin: 'top left', pointerEvents: 'none', zIndex: 60 }}
    >
      <Card card={flight.card} size="lg" />
    </div>
  );
}
