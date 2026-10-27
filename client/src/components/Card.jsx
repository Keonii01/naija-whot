import '../cards.css';

/* Suit tokens + exact shape geometry from the Stitch "Digital Playing Card Asset Suite" */
const SUITS = {
  Circle:   { color: '#2563EB' },
  Triangle: { color: '#16A34A' },
  Cross:    { color: '#DC2626' },
  Square:   { color: '#F59E0B' },
  Star:     { color: '#9333EA' },
};

function Mini({ suit }) {
  switch (suit) {
    case 'Circle':   return <span className="wc-mini wc-mini-circle" />;
    case 'Square':   return <span className="wc-mini wc-mini-square" />;
    case 'Triangle': return <svg className="wc-mini" viewBox="0 0 24 24"><polygon fill="currentColor" points="12,3 22,21 2,21" /></svg>;
    case 'Cross':    return <svg className="wc-mini" viewBox="0 0 24 24"><path fill="currentColor" d="M19 10.5h-5.5V5a1.5 1.5 0 0 0-3 0v5.5H5a1.5 1.5 0 0 0 0 3h5.5V19a1.5 1.5 0 0 0 3 0v-5.5H19a1.5 1.5 0 0 0 0-3z" /></svg>;
    default:         return <svg className="wc-mini" viewBox="0 0 24 24"><polygon fill="currentColor" points="12,2 15,8.5 22,9.2 17,14 18.5,21 12,17.3 5.5,21 7,14 2,9.2 9,8.5" /></svg>;
  }
}

function Big({ suit }) {
  switch (suit) {
    case 'Circle':   return <div className="wc-big wc-big-circle"><i /></div>;
    case 'Square':   return <div className="wc-big wc-big-square"><i /></div>;
    case 'Triangle': return <div className="wc-big"><svg viewBox="0 0 100 100"><path d="M 50 12 L 88 82 A 4 4 0 0 1 84 88 L 16 88 A 4 4 0 0 1 12 82 Z" /></svg></div>;
    case 'Cross':    return <div className="wc-big"><svg viewBox="0 0 100 100"><path d="M 64 8 C 64 4.5 61.5 2 58 2 L 42 2 C 38.5 2 36 4.5 36 8 L 36 36 L 8 36 C 4.5 36 2 38.5 2 42 L 2 58 C 2 61.5 4.5 64 8 64 L 36 64 L 36 92 C 36 95.5 38.5 98 42 98 L 58 98 C 61.5 98 64 95.5 64 92 L 64 64 L 92 64 C 95.5 64 98 61.5 98 58 L 98 42 C 98 38.5 95.5 36 92 36 L 64 36 Z" /></svg></div>;
    default:         return <div className="wc-big"><svg viewBox="0 0 100 100"><polygon points="50,4 64,34 98,38 72,62 79,96 50,78 21,96 28,62 2,38 36,34" /></svg></div>;
  }
}

function SuitFace({ suit, number }) {
  return (
    <div className="wc-face">
      <div className="wc-sheen" />
      <div className="wc-inset" />
      <div className="wc-index"><Mini suit={suit} /><span className="wc-idx-num">{number}</span></div>
      <div className="wc-center">
        <Big suit={suit} />
        <span className="wc-big-num">{number}</span>
      </div>
      <div className="wc-index wc-index-flip"><Mini suit={suit} /><span className="wc-idx-num">{number}</span></div>
    </div>
  );
}

function WhotFace() {
  return (
    <div className="wc-face wc-whot-face">
      <div className="wc-sheen" />
      <div className="wc-inset" />
      <div className="wc-index wc-whot-index">
        <span className="wc-whot-word-sm">WHOT</span>
        <span className="wc-whot-idx-num">20</span>
      </div>
      <div className="wc-center">
        <div className="wc-whot-glow" />
        <div className="wc-whot-badge">
          <svg viewBox="0 0 24 24"><polygon points="12,2 15,8.5 22,9.2 17,14 18.5,21 12,17.3 5.5,21 7,14 2,9.2 9,8.5" /></svg>
        </div>
        <div className="wc-whot-word">WHOT</div>
        <div className="wc-whot-20">20</div>
        <span className="wc-whot-pill">Universal Wild</span>
      </div>
      <div className="wc-index wc-whot-index wc-index-flip">
        <span className="wc-whot-word-sm">WHOT</span>
        <span className="wc-whot-idx-num">20</span>
      </div>
    </div>
  );
}

function BackFace() {
  return (
    <div className="wc-back-in">
      <div className="wc-adire" />
      <div className="wc-back-line" />
      <div className="wc-back-sheen" />
      <div className="wc-back-emblem">
        <div className="wc-back-halo" />
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="52" y="38" width="86" height="114" rx="14" fill="#043324" fillOpacity="0.5" transform="rotate(-6 95 95)" />
          <g transform="rotate(8 100 100)">
            <rect x="54" y="36" width="92" height="124" rx="16" fill="#FFC94D" stroke="#FFE799" strokeWidth="2" />
            <rect x="60" y="42" width="80" height="112" rx="11" fill="#0B6E4F" />
            <rect x="64" y="46" width="72" height="104" rx="8" fill="none" stroke="#FFC94D" strokeOpacity="0.6" strokeWidth="1.2" strokeDasharray="3 2" />
            <circle cx="100" cy="98" r="24" fill="#063E2C" stroke="#FFC94D" strokeWidth="1.2" />
            <polygon points="100,82 104,93 115,94 107,101 109,112 100,106 91,112 93,101 85,94 96,93" fill="#FFC94D" />
            <polygon points="100,94 102,98 100,102 98,98" fill="#FFFFFF" fillOpacity="0.9" />
            <text x="68" y="58" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="9" fill="#FFC94D" textAnchor="middle">W</text>
            <text x="132" y="142" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="900" fontSize="9" fill="#FFC94D" textAnchor="middle" transform="rotate(180 132 142)">W</text>
          </g>
        </svg>
        <span className="wc-back-label">NAIJA WHOT</span>
      </div>
      <i className="wc-back-dot tl" /><i className="wc-back-dot tr" /><i className="wc-back-dot bl" /><i className="wc-back-dot br" />
    </div>
  );
}

/**
 * <Card card={{shape, number}} />          face-up
 * <Card faceDown />                        card back
 * size: 'xs' | 'sm' | 'hand' | 'lg' | 'xl'  (width presets, see cards.css)
 * Pass onClick to make it a button; selected lifts + glows it.
 */
export default function Card({ card, faceDown = false, size = 'lg', onClick, selected = false, className = '' }) {
  const isWhot = !faceDown && card?.shape === 'Whot';
  const Tag = onClick ? 'button' : 'div';
  const label = faceDown ? 'Card back' : isWhot ? 'Whot 20' : `${card.shape} ${card.number}`;
  const cls = ['wc', `wc-${size}`, faceDown ? 'wc-back' : '', selected ? 'wc-selected' : '', className].filter(Boolean).join(' ');
  const style = !faceDown && !isWhot ? { '--suit': SUITS[card.shape]?.color } : undefined;

  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      className={cls}
      style={style}
      aria-label={label}
    >
      {faceDown ? (
        <BackFace />
      ) : (
        <div className="wc-gold">
          {isWhot ? <WhotFace /> : <SuitFace suit={card.shape} number={card.number} />}
        </div>
      )}
    </Tag>
  );
}
