/** Blocker detection for dashboard highlighting (PLAN.md §2.3 step 4). */

/** Index of the blocker question, or -1 if the standup doesn't ask one. */
export function blockerQuestionIndex(questions: string[]): number {
  return questions.findIndex((q) => /blocker|blocked|stuck/i.test(q));
}

const NO_BLOCKER = /^\s*(-+|no|none|nothing|nope|nah|n\/?a|all good|no blockers?\.?)?\s*$/i;

/** Is this answer to the blocker question an actual blocker? */
export function isBlockerAnswer(answer: string): boolean {
  return !NO_BLOCKER.test(answer);
}
