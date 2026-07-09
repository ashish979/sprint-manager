"use client";

/**
 * A submit button that blocks the form's own submission with a native
 * `confirm()` prompt first — for destructive actions (delete standup/rotation)
 * where a misclick shouldn't be irreversible with no warning.
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
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
