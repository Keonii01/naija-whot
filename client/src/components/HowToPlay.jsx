import { useEffect } from 'react';
import Card from './Card';

const STANDARD = { pick_three_action: true, cancel_penalties: false, hold_on_any_card: false };

function Section({ title, children }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-secondary">{title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-on-surface">{children}</div>
    </section>
  );
}

function CardRow({ shape = 'Circle', number, title, children }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-container-lowest/50 p-2.5">
      <div className="pointer-events-none shrink-0">
        <Card card={{ shape, number }} size="sm" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-sm font-bold text-white">{title}</p>
        <p className="text-xs leading-snug text-on-surface-variant sm:text-sm">{children}</p>
      </div>
    </div>
  );
}

export default function HowToPlay({ onClose, rules = STANDARD, turnSeconds = 15 }) {
  const r = { ...STANDARD, ...rules };
  const custom = [
    !r.pick_three_action && 'Pick Three is switched off: a 5 is an ordinary card.',
    r.cancel_penalties && 'Penalties cancel out with 3+ players.',
    r.hold_on_any_card && 'After a Hold On, your extra play can be any card.',
  ].filter(Boolean);
  const actionList = `1, 2, ${r.pick_three_action ? '5, ' : ''}8, 14, 20`;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-dim/80 backdrop-blur-2xl sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface-container/95 p-5 pt-4 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-8"
      >
        <div className="sticky -top-5 z-10 -mx-5 -mt-4 mb-1 flex items-center justify-between bg-surface-container/95 px-5 py-3 backdrop-blur sm:-top-8 sm:-mx-8 sm:-mt-8 sm:px-8 sm:py-5">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">How to play</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-full bg-surface-container-high px-4 text-sm font-semibold text-white transition hover:bg-surface-container-highest touch-manipulation"
          >
            Close
          </button>
        </div>

        {custom.length > 0 && (
          <div className="mt-3 rounded-2xl border border-secondary/40 bg-secondary/10 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-secondary">House rules in this room</p>
            <ul className="mt-1 space-y-0.5 text-sm text-on-surface">
              {custom.map((c) => <li key={c}>• {c}</li>)}
            </ul>
          </div>
        )}

        <Section title="The goal">
          <p>Be the first player to get rid of every card in your hand.</p>
        </Section>

        <Section title="Your turn">
          <p>Play a card that matches the top card by <b>shape</b> or by <b>number</b>. Nothing to play, or you just want to? Draw one card from the market. You may draw even when you could play.</p>
          <p>The deck has 54 cards in five shapes. You are dealt 5 cards in a 2 to 4 player game, and 3 cards with 5 to 8 players.</p>
        </Section>

        <Section title="Action cards">
          <CardRow shape="Circle" number={1} title="1 · Hold On">
            {r.hold_on_any_card ? 'Play again, and this extra play can be any card.' : 'Play again.'}
          </CardRow>
          <CardRow shape="Triangle" number={2} title="2 · Pick Two">The next player picks 2 cards, unless they answer with another 2.</CardRow>
          {r.pick_three_action ? (
            <CardRow shape="Cross" number={5} title="5 · Pick Three">The next player picks 3 cards, unless they answer with another 5.</CardRow>
          ) : (
            <CardRow shape="Cross" number={5} title="5 · Ordinary card">Not an action card in this room. It plays like any other number.</CardRow>
          )}
          <CardRow shape="Square" number={8} title="8 · Suspension">The next player misses their turn.</CardRow>
          <CardRow shape="Star" number={14} title="14 · General Market">Everyone else picks 1 card. You play again.</CardRow>
          <CardRow shape="Whot" number={20} title="20 · Whot">A wild card. Name any shape for the next player to follow. It can't be combined with other cards.</CardRow>
        </Section>

        <Section title="Pick penalties">
          <p>Only the same number can answer a penalty: a 2 answers a 2{r.pick_three_action ? ', a 5 answers a 5' : ''}. {r.pick_three_action ? 'They never mix.' : ''}</p>
          <p>
            <b>2 players:</b> matching cards cancel out and nobody picks. If you play two 5s and your opponent answers with one, they pick the leftover 3. If they answer with three, the leftover 3 comes back to you, and you can answer it again or pick.
          </p>
          <p>
            <b>3 or more players:</b>{' '}
            {r.cancel_penalties
              ? 'matching Pick cards cancel each other. Any leftover goes to the next player, who can answer it or pick.'
              : 'penalties pass to the next player and add up. Whoever can\u2019t answer picks the whole pile. A 5 then a 5 means the third player picks 6.'}
          </p>
        </Section>

        <Section title="Playing several cards">
          <p>You can play several cards of the same number in one turn, and every effect happens. In a 3-player game, two 8s skip both opponents and the turn comes back to you.</p>
        </Section>

        <Section title="Last Card">
          <p>When you are down to one card, press <b>LAST CARD</b> before you play it. Win from one card without pressing it and you don&rsquo;t win: you pick 5 cards instead.</p>
          <p>If your last card is an action card ({actionList}), you can play it but it doesn&rsquo;t win. Finish on a normal number card.</p>
        </Section>

        <Section title="When the market runs out">
          <p>With 2 players, the discard pile is reshuffled. With 3 to 8 players, the game ends when someone has nothing playable, and the lowest total of card numbers wins. A tie goes to the player with fewer cards.</p>
        </Section>

        <Section title="Time, leaving and watching">
          <p>You have {turnSeconds} seconds per turn. If time runs out you draw a card automatically, and if you keep missing turns you are removed from the game.</p>
          <p>If you leave mid-game your cards go back to the market, and if only one player is left they win. You can also join a room just to watch.</p>
        </Section>

        <button
          type="button"
          onClick={onClose}
          className="mt-8 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-gold font-display text-base font-extrabold text-emerald-deep shadow-[0_4px_14px_rgba(255,201,77,0.35)] transition hover:bg-gold-hover active:scale-[0.99] touch-manipulation"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
