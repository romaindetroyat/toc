// The layouts of the « Page » family (plan 04-10; 04-UI-SPEC « Mon compte », « Mes amis »), with the
// home's media queries and its 640 px threshold: computer (BAR_QUERY), two columns and one column
// (a phone held sideways, compact), portrait. Never behind « Tourne ton téléphone ». Call it while a
// component initialises: it follows the window's width until the component goes.

import { screen } from "./screen.svelte.ts";

export type PageLayout = "computer" | "two" | "one" | "portrait";

/** From this width a phone held sideways gets two columns (the home's rule). */
export const TWO_COLUMNS_FROM = 640;

export function pageLayout(): { readonly value: PageLayout } {
  let width = $state(typeof window === "undefined" ? 1280 : window.innerWidth);
  $effect(() => {
    const resized = () => {
      width = window.innerWidth;
    };
    window.addEventListener("resize", resized);
    return () => window.removeEventListener("resize", resized);
  });
  const value = $derived<PageLayout>(
    screen.chrome === "bar"
      ? "computer"
      : screen.chrome === "rotate"
        ? "portrait"
        : width >= TWO_COLUMNS_FROM
          ? "two"
          : "one",
  );
  return {
    get value() {
      return value;
    },
  };
}
