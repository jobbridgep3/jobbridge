// Job Bot's avatar — the source design lives at src/assets/icons/jobbot-icon.svg
// (saved verbatim there for reference). This is an INLINED reproduction rather than an
// <img src="...svg"> reference: an externally-referenced SVG's internal fills can't be
// reached by the page's dark-mode class at all, so "adapts via CSS" requires inlining.
//
// Unlike this codebase's one other hand-written icon (PublicFooter's FacebookIcon, which
// uses a single `fill="currentColor"`), Job Bot is a multi-color character — a single
// inherited color can't express "the shell darkens while the teal accents stay teal" —
// so each shape gets its own Tailwind arbitrary-value fill/stroke with a dark: pair.
// Not a plain color-inversion: the dark palette below reuses this app's own dark
// surface tokens (--surface #1e293b, --surface-secondary #0f172a from index.css) where
// they line up, and only the head/body's navy stroke and the tie are independently
// lightened for visibility/contrast against a dark background — everything else
// (the teal/mint accents) stays identical in both themes since they already read
// clearly on both light and dark surroundings.
export function JobBotIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 128 128" fill="none" className={className} aria-hidden="true" {...props}>
      {/* Antenna */}
      <line x1="64" y1="18" x2="64" y2="30" strokeWidth="4" strokeLinecap="round" className="stroke-[#1E3A8A] dark:stroke-[#60A5FA]" />
      <circle cx="64" cy="14" r="5" className="fill-[#4FD1C5]" />

      {/* Head */}
      <rect x="24" y="26" width="80" height="68" rx="26" strokeWidth="4" className="fill-[#FFFFFF] stroke-[#1E3A8A] dark:fill-[#1E293B] dark:stroke-[#60A5FA]" />

      {/* Face */}
      <rect x="34" y="38" width="60" height="42" rx="18" className="fill-[#1E293B] dark:fill-[#0F172A]" />

      {/* Eyes */}
      <circle cx="50" cy="58" r="5" className="fill-[#7FFFD4]" />
      <circle cx="78" cy="58" r="5" className="fill-[#7FFFD4]" />

      {/* Smile */}
      <path d="M52 69C56 73 72 73 76 69" strokeWidth="4" strokeLinecap="round" className="stroke-[#7FFFD4]" />

      {/* Side */}
      <rect x="18" y="50" width="8" height="18" rx="4" className="fill-[#4FD1C5]" />
      <rect x="102" y="50" width="8" height="18" rx="4" className="fill-[#4FD1C5]" />

      {/* Body */}
      <path d="M42 94h44c0 10-10 18-22 18s-22-8-22-18z" strokeWidth="4" className="fill-[#FFFFFF] stroke-[#1E3A8A] dark:fill-[#1E293B] dark:stroke-[#60A5FA]" />

      {/* Tie */}
      <path d="M64 94l6 8-6 12-6-12 6-8z" className="fill-[#2563EB] dark:fill-[#3B82F6]" />

      {/* Chat Bubble */}
      <g transform="translate(8 82)">
        <path d="M0 12C0 5 6 0 14 0h12c8 0 14 5 14 12s-6 12-14 12H14l-8 6 2-6C3 22 0 18 0 12z" className="fill-[#4FD1C5]" />
        <circle cx="12" cy="12" r="2" className="fill-[#1E293B] dark:fill-[#0F172A]" />
        <circle cx="20" cy="12" r="2" className="fill-[#1E293B] dark:fill-[#0F172A]" />
        <circle cx="28" cy="12" r="2" className="fill-[#1E293B] dark:fill-[#0F172A]" />
      </g>

      {/* Briefcase */}
      <g transform="translate(82 80)">
        <rect x="0" y="8" width="34" height="26" rx="6" className="fill-[#1E293B] dark:fill-[#0F172A]" />
        <rect x="11" y="0" width="12" height="8" rx="2" className="fill-[#1E293B] dark:fill-[#0F172A]" />
        <rect x="13" y="18" width="8" height="8" rx="2" className="fill-[#4FD1C5]" />
      </g>
    </svg>
  )
}
