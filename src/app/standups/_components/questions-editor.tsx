"use client";

import { useState } from "react";

const rowInputClass =
  "mt-1 w-full rounded border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const removeButtonClass =
  "mt-1 rounded border px-2 text-sm text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800";
const addButtonClass =
  "rounded border px-3 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

/**
 * One input per question, with add/remove — replaces a free-text "one per
 * line" textarea. Deterministic from `defaultQuestions` (no ids/randomness),
 * so unlike the participant picker this needs no mount-guard: server and
 * client render the same initial rows.
 */
export function QuestionsEditor({
  name,
  defaultQuestions,
}: {
  name: string;
  defaultQuestions: string[];
}) {
  const [questions, setQuestions] = useState<string[]>(
    defaultQuestions.length > 0 ? defaultQuestions : [""],
  );

  function update(i: number, value: string) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? value : q)));
  }
  function remove(i: number) {
    setQuestions((qs) => (qs.length > 1 ? qs.filter((_, idx) => idx !== i) : qs));
  }
  function add() {
    setQuestions((qs) => [...qs, ""]);
  }

  return (
    <div className="mt-1 space-y-2">
      {questions.map((q, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{i + 1}.</span>
          <input
            name={name}
            value={q}
            onChange={(e) => update(i, e.target.value)}
            placeholder="Type a question…"
            className={rowInputClass}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={questions.length === 1}
            className={removeButtonClass}
            aria-label="Remove question"
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className={addButtonClass}>
        + Add question
      </button>
    </div>
  );
}
