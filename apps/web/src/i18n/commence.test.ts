import { COLORS, firstPlayer } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { game } from "./fr/game.ts";

// Who starts the deal, in words (Romain, 2026-10-17, plan 03-11): the banner's last line and the line
// « Commence : … » of the computer's bottom bar and of the sheet « Infos de la partie ».

describe("who starts the deal, in French", () => {
  it("the banner says « Tu commences. » to the player and « {Nom} commence. » for a computer seat", () => {
    expect(game.banner.starts("toi", true)).toBe("Tu commences.");
    expect(game.banner.starts("Marengo", false)).toBe("Marengo commence.");
    expect(game.banner.starts("Ourasi", false)).toBe("Ourasi commence.");
  });

  it("the bar and the sheet say « Commence : {Nom} », a no-break space before the colon", () => {
    expect(game.info.starter("Bucéphale")).toBe("Commence : Bucéphale");
    expect(game.info.starter("toi")).toBe("Commence : toi");
  });

  it("names the seat after the dealer, never the dealer", () => {
    for (const dealer of COLORS) {
      const starter = firstPlayer(dealer);
      expect(starter).not.toBe(dealer);
      expect(COLORS.indexOf(starter)).toBe((COLORS.indexOf(dealer) + 1) % 4);
    }
  });
});
