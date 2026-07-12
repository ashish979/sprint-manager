/**
 * App mark — a lightning bolt (sprint energy) in a rounded primary badge.
 * Inline SVG so there's no binary asset to ship and it inherits the theme.
 * Pass sizing/rounding via `className` (e.g. "h-6 w-6 rounded-lg").
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-grid place-items-center bg-primary text-primary-content ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[60%] w-[60%]">
        <path d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" />
      </svg>
    </span>
  );
}
