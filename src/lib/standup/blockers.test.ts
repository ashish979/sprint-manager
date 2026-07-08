import { describe, expect, it } from "vitest";

import { blockerQuestionIndex, isBlockerAnswer } from "./blockers";

describe("blockerQuestionIndex", () => {
  it("finds the blocker question", () => {
    expect(
      blockerQuestionIndex([
        "What did you do since last report?",
        "What will you do today?",
        "Any blockers?",
        "How do you feel?",
      ]),
    ).toBe(2);
  });

  it("returns -1 when absent", () => {
    expect(blockerQuestionIndex(["What's up?"])).toBe(-1);
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
