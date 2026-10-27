import { useEffect } from 'react';
import { useCountdown } from './TurnTimer';

/* Chip shapes and hover glows are the exact ones from the Stitch Shape Picker. */
const SHAPES = [
  {
    name: 'Circle',
    chip: 'bg-[#2563EB]',
    hover: 'group-hover:bg-[#2563EB] group-hover:shadow-[0_0_28px_rgba(37,99,235,0.6)]',
    glyph: <circle cx="12" cy="12" r="9" />,
  },
  {
    name: 'Triangle',
    chip: 'bg-[#16A34A]',
    hover: 'group-hover:bg-[#16A34A] group-hover:shadow-[0_0_28px_rgba(22,163,74,0.6)]',
    glyph: <polygon points="12,4 21,20 3,20" />,
  },
  {
    name: 'Cross',
    chip: 'bg-[#DC2626]',
    hover: 'group-hover:bg-[#DC2626] group-hover:shadow-[0_0_28px_rgba(220,38,38,0.6)]',
    glyph: <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z" />,
  },
  {
    name: 'Square',
    chip: 'bg-[#F59E0B]',
    hover: 'group-hover:bg-[#F59E0B] group-hover:shadow-[0_0_28px_rgba(245,158,11,0.6)]',
    glyph: <rect x="4" y="4" width="16" height="16" rx="2" />,
  },
  {
    name: 'Star',
    chip: 'bg-[#9333EA]',
    hover: 'group-hover:bg-[#9333EA] group-hover:shadow-[0_0_28px_rgba(147,51,234,0.6)]',
    glyph: <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />,
  },
];

export default function ShapeModal({ onSelect, onCancel, deadline, totalSeconds = 30 }) {
  const { remaining, pct, active } = useCountdown(deadline, totalSeconds);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 backdrop-blur-2xl p-3 sm:p-6 overflow-y-auto">
      {/* soft gold spotlight under the panel */}
      <div aria-hidden="true" className="pointer-events-none absolute h-[500px] w-[500px] rounded-full bg-secondary/10 blur-[100px]" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a shape"
        className="relative my-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-surface-container/85 p-4 sm:p-8 shadow-2xl flex flex-col items-center text-center"
      >
        {/* specular glass edge */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-secondary/60 to-transparent" />
        <div aria-hidden="true" className="absolute inset-x-8 top-1 h-px bg-white/20" />

        {/* wild pill */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-1.5 shadow-inner">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-secondary" fill="currentColor" aria-hidden="true">
            <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2zM19 14l.9 2.6L22.5 17.5l-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z" />
          </svg>
          <span className="font-body text-xs font-bold uppercase tracking-wider text-secondary">WHOT 20 Played</span>
          <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
          <span className="font-body text-xs font-bold text-on-surface-variant">Wildcard Call</span>
        </div>

        <h2 className="font-display text-2xl leading-8 sm:text-[40px] sm:leading-[48px] font-extrabold tracking-tight text-white mb-1">
          Choose a Shape
        </h2>
        <p className="font-body text-sm sm:text-base text-on-surface max-w-md leading-relaxed mb-4">
          Tap a shape to call it. Everybody must follow it.
        </p>

        {/* live turn countdown (server deadline) */}
        {active && (
          <div className="mb-5 sm:mb-7 flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-1.5 shadow-inner">
            <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="#003123" strokeWidth="2.5" />
              <circle
                cx="12" cy="12" r="9" fill="none" stroke="#f4bf44" strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray="56.5" strokeDashoffset={56.5 * (1 - pct / 100)}
              />
            </svg>
            <span className="font-body text-xs font-bold text-secondary">{Math.ceil(remaining)}s remaining</span>
            <span className="font-body text-[11px] text-on-surface-variant">• Your turn</span>
          </div>
        )}

        {/* five round suit chips: one row at every size, scaled to the panel width */}
          <div className="mb-5 sm:mb-7 grid w-full grid-cols-5 gap-1.5 sm:gap-4 lg:gap-6">
            {SHAPES.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => onSelect(s.name)}
                aria-label={s.name}
                className="group flex min-w-0 flex-col items-center gap-1.5 sm:gap-2 transition-transform duration-300 hover:scale-105 active:scale-95 focus:outline-none focus-visible:scale-105 touch-manipulation"
              >
                <div className={`flex aspect-square w-full max-w-[96px] items-center justify-center rounded-full bg-surface-container-high shadow-lg transition-all duration-300 group-focus-visible:ring-4 group-focus-visible:ring-secondary/80 ${s.hover}`}>
                  <div className={`flex aspect-square w-[68%] items-center justify-center rounded-full shadow-inner transition-colors group-hover:bg-white/20 ${s.chip}`}>
                    <svg viewBox="0 0 24 24" className="h-[55%] w-[55%] text-white" fill="currentColor" aria-hidden="true">
                      {s.glyph}
                    </svg>
                  </div>
                </div>
                <span className="font-body text-[10px] min-[360px]:text-[11px] sm:text-base font-semibold sm:tracking-wide text-white transition-colors group-hover:text-primary">
                  {s.name}
                </span>
              </button>
            ))}
          </div>

        {/* footer strip */}
        <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-2 rounded-2xl bg-surface-container-lowest/70 px-4 py-3">
          <div className="flex items-center gap-2 text-on-surface">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-secondary" fill="currentColor" aria-hidden="true">
              <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
            </svg>
            <span className="font-body text-sm font-semibold">One tap and your call goes through</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 font-body text-xs font-bold text-on-surface-variant">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Everyone is waiting for your call
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 min-h-[44px] px-4 text-sm font-semibold text-on-surface-variant underline underline-offset-4 hover:text-white touch-manipulation"
        >
          Back to my cards
        </button>
      </div>
    </div>
  );
}