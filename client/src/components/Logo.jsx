/* Naija Whot icon mark: emerald card with a gold star (from the brand icon). Reused on Lobby and Splash. */
export default function Logo({ className = 'h-20 w-20' }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Naija Whot">
      <defs>
        <linearGradient id="nw-card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12906A" />
          <stop offset="1" stopColor="#0B5A42" />
        </linearGradient>
        <linearGradient id="nw-star" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE08A" />
          <stop offset="1" stopColor="#F4A81D" />
        </linearGradient>
      </defs>
      <rect x="40" y="30" width="108" height="140" rx="22" fill="#83D7B1" fillOpacity="0.28" transform="rotate(-10 100 100)" />
      <g transform="rotate(7 100 100)">
        <rect x="46" y="26" width="108" height="148" rx="22" fill="url(#nw-card)" stroke="#16A97C" strokeWidth="3" />
        <rect x="55" y="35" width="90" height="130" rx="15" fill="none" stroke="#FFC94D" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 3" />
        <circle cx="100" cy="100" r="31" fill="#063E2C" stroke="#FFC94D" strokeOpacity="0.45" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="25" fill="none" stroke="#FFC94D" strokeWidth="1" />
        <polygon points="100,77 106,94 124,95 110,106 115,124 100,113 85,124 90,106 76,95 94,94" fill="url(#nw-star)" />
        <polygon points="100,93 103,100 100,107 97,100" fill="#FFF3D6" />
      </g>
    </svg>
  );
}
