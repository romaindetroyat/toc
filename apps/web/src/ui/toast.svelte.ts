// The single transient message of the app (UI-SPEC « Toast »): one at a time, a new message
// replaces the current one (never stacked), each lasts 4 s.

export const TOAST_MS = 4000;

export type ToastAction = { label: string; run: () => void };

export type ToastMessage = {
  /** Distinguishes a replacement from a repeat of the same text. */
  id: number;
  message: string;
  action?: ToastAction;
};

export const toast: { current: ToastMessage | undefined } = $state({ current: undefined });

let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Shows `message` for 4 s, replacing whatever toast is on screen; `action` adds one button. */
export function showToast(message: string, action?: ToastAction): void {
  if (timer !== undefined) clearTimeout(timer);
  toast.current = { id: nextId++, message, action };
  timer = setTimeout(dismissToast, TOAST_MS);
}

/** Hides the toast now (its action ran, or its lifetime is over). */
export function dismissToast(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  toast.current = undefined;
}
