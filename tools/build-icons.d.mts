// Types of tools/build-icons.mjs for the web package's tests (apps/web/src/pwa/splash.test.ts).

/** An iPhone or iPad screen: its CSS size held upright and its pixel ratio. */
export type SplashDevice = { name: string; width: number; height: number; ratio: number };

export const DEVICES: readonly SplashDevice[];
export function splashName(device: SplashDevice): string;
export function splashMedia(device: SplashDevice): string;
export function buildIcons(): Promise<void>;
