import { describe, expect, it } from "vitest";
import { homeTiles, signInLine, signInToast } from "./flow.ts";

// The pure decisions of the account screens (plan 04-09; 04-UI-SPEC « Small tiles », « Sign-in
// sheet »): which small tiles the home shows and what they say, and the line the sign-in sheet shows
// for each failure.

describe("homeTiles", () => {
  it("a guest with a first name: « Ton prénom » then « Se connecter »", () => {
    const tiles = homeTiles({ account: null, firstName: "Marie" });
    expect(tiles.map((tile) => tile.kind)).toEqual(["prenom", "connexion"]);
    expect(tiles[0]).toMatchObject({
      icon: "user",
      label: "Ton prénom",
      sub: "Marie",
      name: "Changer de prénom (Marie)",
    });
    expect(tiles[0]?.href).toBeUndefined();
    expect(tiles[1]).toMatchObject({
      icon: "log-in",
      label: "Se connecter",
      sub: "Créer un compte",
      name: "Se connecter ou créer un compte",
    });
    expect(tiles[1]?.href).toBeUndefined();
  });

  it("a guest without a first name: « Se connecter » alone", () => {
    expect(homeTiles({ account: null, firstName: null }).map((tile) => tile.kind)).toEqual([
      "connexion",
    ]);
  });

  it("signed in: « Mes amis » then « Mon compte », the first name is not shown", () => {
    const tiles = homeTiles({ account: { pseudo: "Élodie" }, firstName: "Marie" });
    expect(tiles.map((tile) => tile.kind)).toEqual(["amis", "compte"]);
    expect(tiles[0]).toMatchObject({
      icon: "handshake",
      label: "Mes amis",
      sub: "Inviter un proche",
      name: "Mes amis",
      href: "#/amis",
    });
    expect(tiles[1]).toMatchObject({
      icon: "user",
      label: "Mon compte",
      sub: "Élodie",
      name: "Mon compte (Élodie)",
      href: "#/compte",
    });
    expect(JSON.stringify(tiles)).not.toContain("Marie");
  });
});

describe("signInLine", () => {
  it("one line per failure, from the UI-SPEC table", () => {
    expect(signInLine("cancelled")).toBe(
      "Connexion annulée. Pas de clé sur cet appareil ? Choisis ton téléphone, ou utilise ton code de secours.".replace(
        " ?",
        " ?",
      ),
    );
    expect(signInLine("unknown")).toBe(
      "Cette clé d’accès n’ouvre aucun compte TOC. Elle a peut-être été retirée. Essaie une autre clé ou ton code de secours.",
    );
    expect(signInLine("wrong-address")).toBe(
      "Les clés d’accès ne marchent qu’à l’adresse toc.romaindetroyat.workers.dev.",
    );
    expect(signInLine("offline")).toBe("Pas de connexion. Vérifie le réseau, puis réessaie.");
    expect(signInLine("server")).toBe("La connexion n’a pas marché. Réessaie dans un instant.");
  });

  it("anything else the server says reads as a server error; unsupported has its own line", () => {
    for (const reason of ["expired", "already-here", "last", "signed-out"] as const) {
      expect(signInLine(reason), reason).toBe(signInLine("server"));
    }
    expect(signInLine("unsupported")).toBe(
      "Ce navigateur ne gère pas les clés d’accès. Ouvre TOC dans Safari, Chrome ou Edge à jour.",
    );
  });
});

describe("signInToast", () => {
  it("« Bonjour {Pseudo} ! », or the line about this device's tables", () => {
    expect(signInToast("Zoé", 0)).toBe("Bonjour Zoé !");
    expect(signInToast("Zoé", 2)).toBe(
      "Bonjour Zoé ! Tes parties sur cet appareil sont maintenant liées à ton compte.",
    );
  });
});
