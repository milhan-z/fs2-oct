// Ink-drawn glyphs for the passport tabs and controls — drawn for this app (not a stock icon set).
// Strokes are slightly uneven to read as printed ink.

type P = { className?: string }
const ink = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const InkIcon = {
  /** folded map with a pin hole */
  Map: ({ className }: P) => (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <path {...ink} strokeWidth="1.7" d="M3.5 7.2 9.6 5l8.7 3.1 6.2-2.3v15.5l-6.3 2.2-8.6-3.1-6.1 2.2z" />
      <path {...ink} strokeWidth="1.2" d="M9.6 5.2v15.1M18.3 8.2v15" strokeDasharray="1.6 1.4" />
      <circle cx="14" cy="12.4" r="1.6" fill="currentColor" />
    </svg>
  ),
  /** passport booklet with an emblem */
  Passport: ({ className }: P) => (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <path {...ink} strokeWidth="1.7" d="M7 3.6h12.6a1.6 1.6 0 0 1 1.6 1.6v17.6a1.6 1.6 0 0 1-1.6 1.6H7z" />
      <path {...ink} strokeWidth="1.7" d="M7 3.6c-1 .2-1.4.8-1.4 1.8v17.2c0 1 .4 1.6 1.4 1.8" />
      <circle {...ink} strokeWidth="1.3" cx="14.2" cy="11.6" r="3.4" />
      <path {...ink} strokeWidth="1.2" d="M10.6 18.6h7.2" />
    </svg>
  ),
  /** permit ticket with a QR corner */
  Permit: ({ className }: P) => (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <path {...ink} strokeWidth="1.6" d="M5 6.5h18v4.2a2.3 2.3 0 0 0 0 4.6v6.2H5v-6.2a2.3 2.3 0 0 0 0-4.6z" />
      <path fill="currentColor" d="M8.6 9.8h3.6v3.6H8.6zM15.8 9.8h3.6v3.6h-3.6zM8.6 16.6h3.6v1.8H8.6zM14 16.6h1.8v1.8H14zM17.6 16.6h1.8v1.8h-1.8z" />
    </svg>
  ),
  Back: ({ className }: P) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...ink} strokeWidth="2" d="M14.6 5.2 7.9 12l6.8 6.8" />
    </svg>
  ),
  Close: ({ className }: P) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...ink} strokeWidth="2" d="M6.2 6.4 17.8 17.6M17.6 6.2 6.4 17.8" />
    </svg>
  ),
  Camera: ({ className }: P) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...ink} strokeWidth="1.6" d="M4 8h3l1.6-2.4h6.8L17 8h3v10.5H4z" />
      <path {...ink} strokeWidth="1.4" d="M9.2 13.2a2.9 2.9 0 0 1 5-2M14.8 13.2a2.9 2.9 0 0 1-5 2M14.4 9.6v1.7h-1.7M9.6 16.8v-1.7h1.7" />
    </svg>
  ),
  Sun: ({ className }: P) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle {...ink} strokeWidth="1.6" cx="12" cy="12" r="3.6" />
      <path {...ink} strokeWidth="1.5" d="M12 3.4v2.2M12 18.4v2.2M3.4 12h2.2M18.4 12h2.2M5.9 5.9l1.5 1.5M16.6 16.6l1.5 1.5M5.9 18.1l1.5-1.5M16.6 7.4l1.5-1.5" />
    </svg>
  ),
  Check: ({ className }: P) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...ink} strokeWidth="2.6" d="M5 12.6l4.4 4.4L19 7.4" />
    </svg>
  ),
  Cloud: ({ className }: P) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...ink} strokeWidth="1.7" d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z" />
    </svg>
  ),
}
