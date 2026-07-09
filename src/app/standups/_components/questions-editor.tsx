"use client";

import { useState } from "react";

import type { QuestionConfig } from "@/lib/types";

const rowInputClass =
  "mt-1 w-full rounded border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const removeButtonClass =
  "mt-1 rounded border px-2 text-sm text-zinc-500 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800";
const addButtonClass =
  "rounded border px-3 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

/**
 * One input per question, with add/remove and a "Required" checkbox —
 * replaces a free-text "one per line" textarea. Deterministic from
 * `defaultQuestions` (no ids/randomness), so unlike the participant picker
 * this needs no mount-guard: server and client render the same initial rows.
 *
 * The text input and checkbox are unnamed (pure React state); a hidden
 * input per row carries the actual submitted value as JSON. This sidesteps
 * the native-checkbox quirk where an unchecked box is simply absent from
 * FormData, which would otherwise misalign `getAll(name)` against the text
 * inputs the moment one question is marked optional.
 */
export function QuestionsEditor({
  name,
  defaultQuestions,
}: {
  name: string;
  defaultQuestions: QuestionConfig[];
}) {
  const [questions, setQuestions] = useState<QuestionConfig[]>(
    defaultQuestions.length > 0 ? defaultQuestions : [{ text: "", required: true }],
  );

  function update(i: number, text: string) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, text } : q)));
  }
  function toggleRequired(i: number) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, required: !q.required } : q)));
  }
  function remove(i: number) {
    setQuestions((qs) => (qs.length > 1 ? qs.filter((_, idx) => idx !== i) : qs));
  }
  function add() {
    setQuestions((qs) => [...qs, { text: "", required: true }]);
  }

  return (
    <div className="mt-1 space-y-2">
      {questions.map((q, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{i + 1}.</span>
          <input
            value={q.text}
            onChange={(e) => update(i, e.target.value)}
            placeholder="Type a question…"
            className={rowInputClass}
          />
          <label className="mt-2.5 flex shrink-0 items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <input type="checkbox" checked={q.required} onChange={() => toggleRequired(i)} />
            Required
          </label>
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={questions.length === 1}
            className={removeButtonClass}
            aria-label="Remove question"
          >
            ✕
          </button>
          <input type="hidden" name={name} value={JSON.stringify(q)} />
        </div>
      ))}
      <button type="button" onClick={add} className={addButtonClass}>
        + Add question
      </button>
    </div>
  );
}
