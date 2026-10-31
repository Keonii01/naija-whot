/* Shown for a few seconds when the market runs out, before the final standings.
   It only announces the moment; the numbers and the winner come from the server in the result that follows. */
export default function MarketClosed() {
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="The market is finished. Time to count the cards."
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/80 backdrop-blur-sm font-body"
    >
      <div className="absolute w-[380px] h-[380px] rounded-full bg-secondary-container/20 blur-[100px] pointer-events-none" />
      <div className="relative w-full max-w-sm rounded-[24px] bg-surface-container-low/90 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,18,11,0.85)] border border-secondary/30 px-6 py-8 text-center">
        <div className="relative mx-auto flex items-center justify-center w-20 h-20">
          <div className="absolute w-24 h-24 rounded-full bg-secondary/30 blur-xl" />
          <div className="relative w-20 h-20 rounded-full bg-surface-container-high shadow-2xl flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-secondary-container via-secondary to-secondary-fixed flex items-center justify-center shadow-inner">
              <svg viewBox="0 0 24 24" className="w-9 h-9 text-surface-container-lowest" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                <rect x="3.5" y="7" width="11" height="14" rx="2" transform="rotate(-10 9 14)" />
                <rect x="9" y="3.5" width="11" height="14" rx="2" transform="rotate(8 14.5 10.5)" fill="currentColor" fillOpacity="0.25" />
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-4 inline-flex items-center gap-2 px-4 py-1 rounded-full bg-secondary-container/40">
          <span className="w-2 h-2 rounded-full bg-secondary" />
          <span className="text-[12px] font-bold text-secondary tracking-widest uppercase">Market closed</span>
        </div>

        <h1 className="mt-3 font-display text-[28px] leading-tight font-extrabold tracking-tight text-on-surface">
          The market is finished
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">Time to count the cards. The lowest total wins.</p>

        <div className="mt-5 flex items-center justify-center gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2.5 h-2.5 rounded-full bg-secondary animate-bounce motion-reduce:animate-none" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
