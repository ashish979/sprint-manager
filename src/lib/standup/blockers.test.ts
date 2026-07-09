import { describe, expect, it } from "vitest";

import type { QuestionConfig } from "@/lib/types";

import { blockerQuestionIndex, isBlockerAnswer } from "./blockers";

function q(text: string): QuestionConfig {
  return { text, required: true };
}

describe("blockerQuestionIndex", () => {
  it("finds the blocker question", () => {
    expect(
      blockerQuestionIndex([
        q("What did you do since last report?"),
        q("What will you do today?"),
        q("Any blockers?"),
        q("How do you feel?"),
      ]),
    ).toBe(2);
  });

  it("returns -1 when absent", () => {
    expect(blockerQuestionIndex([q("What's up?")])).toBe(-1);
  });
});

describe("isBlockerAnswer", () => {
  it("treats empty/dismissive answers as no blocker", () => {
    for (const answer of ["", "  ", "-", "no", "None", "nothing", "n/a", "NA", "no blockers"]) {
      expect(isBlockerAnswer(answer), JSON.stringify(answer)).toBe(false);
    }
  });

  it("treats substantive answers as blockers", () => {
    expect(isBlockerAnswer("waiting on the API keys from infra")).toBe(true);
    expect(isBlockerAnswer("PR #42 review")).toBe(true);
  });
});
