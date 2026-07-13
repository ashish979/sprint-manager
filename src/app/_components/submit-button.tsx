"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that reflects its form's in-flight state: a spinner + disabled
 * while the server action runs, so slow actions (Slack round-trips, DynamoDB
 * writes) give immediate feedback and can't be double-clicked. Drop-in for a
 * plain `<button type="submit">` inside a `<form action={…}>`.
 *
 * `formAction` supports a second submit target in the same form (e.g. the
 * standup form's "Create and start"); the whole form is busy either way.
 */
export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingText,
  formAction,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      {...(formAction ? { formAction } : {})}
    >
      {pending && <span className="loading loading-spinner loading-xs" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
