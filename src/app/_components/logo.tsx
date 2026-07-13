import Image from "next/image";

/**
 * App mark — the Josys Sprint Manager icon (public/logo.png). Pass sizing via
 * `className` (e.g. "h-6 w-6").
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={64}
      height={64}
      unoptimized
      className={`object-contain ${className}`}
    />
  );
}
