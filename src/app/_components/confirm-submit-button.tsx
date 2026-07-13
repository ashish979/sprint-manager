"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that blocks the form's own submission with a native
 * `confirm()` prompt first — for destructive actions (delete standup/rotation)
 * where a misclick shouldn't be irreversible with no warning. Shows a spinner
 * and disables once confirmed and the action is running.
 */
export function ConfirmSubmitButton({
  confirmText,
  className,
  children,
}: {
  confirmText: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {pending && <span className="loading loading-spinner loading-xs" />}
      {children}
    </button>
  );
}
