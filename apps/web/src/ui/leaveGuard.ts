// A screen that must not be left by a stray hash change (plan 04-09; 04-UI-SPEC « Backup-code
// screen », « Leaving the screen »): while the backup code is up, the router asks it first about each
// hash change (the back button, a notification click). The guard undoes the change and says so; the
// router then keeps the screen. One guard at a time: the last screen that set it.

type Guard = () => boolean;

let current: Guard | null = null;

/** Sets the guard; the returned function removes it (only if it is still this one). */
export function setLeaveGuard(guard: Guard): () => void {
  current = guard;
  return () => {
    if (current === guard) current = null;
  };
}

/** The router's question on a hash change: true when a guard undid it (keep the current screen). */
export function leaveBlocked(): boolean {
  return current?.() === true;
}
