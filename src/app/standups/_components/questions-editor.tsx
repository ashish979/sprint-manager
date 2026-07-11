"use client";

import { useState } from "react";

import type { QuestionConfig } from "@/lib/types";

const rowInputClass = "input input-sm w-full";
const removeButtonClass = "btn btn-ghost btn-sm btn-square";
const addButtonClass = "btn btn-outline btn-sm";

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
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-base-content/40">{i + 1}.</span>
          <input
            value={q.text}
            onChange={(e) => update(i, e.target.value)}
            placeholder="Type a question…"
            className={rowInputClass}
          />
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-base-content/60">
            <input
              type="checkbox"
              checked={q.required}
              onChange={() => toggleRequired(i)}
              className="checkbox checkbox-xs checkbox-primary"
            />
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
