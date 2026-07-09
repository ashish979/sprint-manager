"use client";

import { useEffect, useRef } from "react";

/**
 * Cursor-following spotlight for the homepage hero. Writes the pointer
 * position straight to a CSS variable via a ref on every mousemove — no
 * React state, so no re-renders — and lets a plain radial-gradient do the
 * actual rendering (paint-only, no layout cost).
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--x", `${e.clientX - rect.left}px`);
      el.style.setProperty("--y", `${e.clientY - rect.top}px`);
    }
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 blur-2xl"
      style={{
        background:
          "radial-gradient(circle 260px at var(--x, 50%) var(--y, 50%), rgba(74,21,75,0.35), transparent 70%)",
      }}
    />
  );
}
