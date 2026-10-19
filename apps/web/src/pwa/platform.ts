// The platform facts of the notifications and the install guidance (plan 04-07, reused by the install
// flow of 04-08; 04-RESEARCH Pattern 7 « iOS 16.4+ requirements », 04-UI-SPEC « Install guidance »).
// Pure: the user agent, the touch points and the display mode are passed in (browserPlatform reads
// them from the page).
//
// On iPhone and iPad, Web Push works only in the installed app (iOS 16.4 or later). iPadOS reports
// itself as a Mac: a « Macintosh » user agent with a touch screen is an iPad.

export type IosVersion = { major: number; minor: number };

/** An iPhone, an iPod, an iPad, or iPadOS reporting as a Mac with a touch screen. */
export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
  if (/\b(iPhone|iPad|iPod)\b/.test(userAgent)) return true;
  return /\bMacintosh\b/.test(userAgent) && maxTouchPoints > 1;
}

/**
 * The iOS (or iPadOS) version: « OS 17_4 » of an iPhone or iPad user agent, else the Safari
 * « Version/17.2 » of iPadOS reporting as a Mac; null elsewhere.
 */
export function iosVersion(userAgent: string): IosVersion | null {
  if (/\b(iPhone|iPad|iPod)\b/.test(userAgent)) {
    const os = /\bOS (\d+)_(\d+)/.exec(userAgent);
    if (os !== null) return { major: Number(os[1]), minor: Number(os[2]) };
  }
  if (/\bMacintosh\b/.test(userAgent)) {
    const safari = /\bVersion\/(\d+)\.(\d+)/.exec(userAgent);
    if (safari !== null) return { major: Number(safari[1]), minor: Number(safari[2]) };
  }
  return null;
}

/** Whether `version` is at least major.minor (false for an unknown version). */
export function atLeast(version: IosVersion | null, major: number, minor: number): boolean {
  if (version === null) return false;
  return version.major > major || (version.major === major && version.minor >= minor);
}

/**
 * The app runs installed: the display mode is standalone (every browser), or Safari's own
 * navigator.standalone on iOS.
 */
export function isStandalone(
  displayModeStandalone: boolean,
  navigatorStandalone: boolean | undefined,
): boolean {
  return displayModeStandalone || navigatorStandalone === true;
}

export type Platform = { apple: boolean; iosVersion: IosVersion | null; standalone: boolean };

/** The facts of this page (a browser only). */
export function browserPlatform(): Platform {
  const nav = navigator as Navigator & { standalone?: boolean };
  const userAgent = nav.userAgent ?? "";
  let displayMode = false;
  try {
    displayMode = window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    displayMode = false;
  }
  return {
    apple: isAppleMobile(userAgent, nav.maxTouchPoints ?? 0),
    iosVersion: iosVersion(userAgent),
    standalone: isStandalone(displayMode, nav.standalone),
  };
}
