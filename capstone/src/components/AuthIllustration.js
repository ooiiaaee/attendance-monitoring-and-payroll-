export default function AuthIllustration() {
  return (
    <svg width="280" height="200" viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="140" cy="150" rx="120" ry="22" fill="#f3e4da" />

      {/* open book */}
      <path
        d="M100 118 L140 108 L180 118 L180 100 L140 90 L100 100 Z"
        stroke="#8a3f2f"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="#fffdf9"
      />
      <line x1="140" y1="90" x2="140" y2="108" stroke="#8a3f2f" strokeWidth="2" />
      <line x1="112" y1="103" x2="132" y2="97" stroke="#cfc0a0" strokeWidth="1.5" />
      <line x1="112" y1="109" x2="132" y2="103" stroke="#cfc0a0" strokeWidth="1.5" />
      <line x1="148" y1="97" x2="168" y2="103" stroke="#cfc0a0" strokeWidth="1.5" />
      <line x1="148" y1="103" x2="168" y2="109" stroke="#cfc0a0" strokeWidth="1.5" />

      {/* person 1 */}
      <circle cx="88" cy="70" r="14" stroke="#8a3f2f" strokeWidth="2.5" fill="#fffdf9" />
      <path
        d="M68 132 C68 100 78 88 88 88 C98 88 108 100 108 132"
        stroke="#8a3f2f"
        strokeWidth="2.5"
        fill="#f3e4da"
      />
      <path d="M74 118 C80 126 96 126 102 118" stroke="#8a3f2f" strokeWidth="2" fill="none" />

      {/* person 2 */}
      <circle cx="196" cy="66" r="14" stroke="#8a3f2f" strokeWidth="2.5" fill="#fffdf9" />
      <path
        d="M176 132 C176 96 186 84 196 84 C206 84 216 96 216 132"
        stroke="#8a3f2f"
        strokeWidth="2.5"
        fill="#f3e4da"
      />
      <path d="M182 116 C188 124 204 124 210 116" stroke="#8a3f2f" strokeWidth="2" fill="none" />

      {/* sparkle accents */}
      <path d="M46 60 l4 0 M48 58 l0 4" stroke="#8a3f2f" strokeWidth="2" strokeLinecap="round" />
      <path d="M232 96 l5 0 M234.5 93.5 l0 5" stroke="#8a3f2f" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
