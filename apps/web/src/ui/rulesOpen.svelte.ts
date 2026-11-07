// How many « Règles du TOC » sheets are open right now (plan 05-04, 05-RESEARCH Pitfall 8). Every
// RulesSheet counts itself while it is mounted, wherever it was opened from (the book button and
// « R » in a game, the « Règles du jeu » link of « Réglages » from plan 05-08), so a solo game's
// computers wait for every one of them: the game screen's hold reads `rulesOpen.count`.

let count = $state(0);

export const rulesOpen = {
  /** The rules sheets mounted now. */
  get count(): number {
    return count;
  },
};

/** Counts one open sheet; the returned release is idempotent (a second call does nothing). */
export function holdForRules(): () => void {
  count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count -= 1;
  };
}
