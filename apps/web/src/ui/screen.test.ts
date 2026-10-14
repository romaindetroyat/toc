import { describe, expect, it } from "vitest";
import game from "../routes/Game.svelte?raw";
import store from "./screen.svelte.ts?raw";

// The screen store and the game screen's CSS must name the same media queries (plan 01-36): the store
// gives `data-chrome` and the props of the bar, the CSS lays the bar out. The store is a runes module,
// so its source is read as text here (Vitest runs without the Svelte compiler).

/** The value of an exported string constant of the store, joined back if it spans lines. */
function constant(name: string): string {
  const match = new RegExp(`export const ${name} =\\s*"([^"]+)"`).exec(store);
  if (!match?.[1]) throw new Error(`no ${name} in screen.svelte.ts`);
  return match[1];
}

const style = game.slice(game.indexOf("<style>"));

describe("screen modes", () => {
  it("the bar's query is landscape from 960 x 600, the same string in the CSS of the game screen", () => {
    const bar = constant("BAR_QUERY");
    expect(bar).toBe("(orientation: landscape) and (min-width: 960px) and (min-height: 600px)");
    expect(style).toContain(`@media ${bar} {`);
  });

  it("the compact bar's query is every other landscape screen, the same string in the CSS", () => {
    const compact = constant("COMPACT_BAR_QUERY");
    expect(compact).toBe(
      "(orientation: landscape) and (max-width: 959.98px), (orientation: landscape) and (max-height: 599.98px)",
    );
    expect(style).toContain(`@media ${compact} {`);
  });

  it("the game screen carries the store's mode", () => {
    expect(game).toContain("data-chrome={screen.chrome}");
    expect(constant("ROTATE_QUERY")).toBe("(orientation: portrait)");
  });
});
