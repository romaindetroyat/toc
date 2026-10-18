import { describe, expect, it } from "vitest";
import {
  dateText,
  homeTiles,
  invitationRow,
  prefill,
  pseudoError,
  signInLine,
  signInToast,
} from "./flow.ts";

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

// --- Task 2: the invitation's rows, the pseudo step's errors, the prefill ---

const NOW = Date.UTC(2026, 9, 18, 12);
const LATER = Date.UTC(2026, 9, 25, 12);
const base = { signedIn: false, webauthn: true, online: true, now: NOW };

describe("invitationRow", () => {
  it("loading, then the four states a link can be in for anyone", () => {
    expect(invitationRow({ ...base, view: { state: "loading" } })).toMatchObject({
      kind: "loading",
      heading: "Ouverture de l’invitation…",
      primary: null,
    });
    expect(invitationRow({ ...base, view: { state: "unknown" } })).toMatchObject({
      kind: "unknown",
      heading: "Cette invitation n’existe pas",
      primary: { action: "home", label: "Retour à l’accueil" },
      secondary: null,
    });
    const used = invitationRow({ ...base, view: { state: "used", inviter: "Zoé" } });
    expect(used).toMatchObject({
      kind: "used",
      heading: "Cette invitation a déjà servi",
      primary: { action: "sign-in", label: "Se connecter" },
      secondary: { action: "home", label: "Retour à l’accueil" },
    });
    expect(used.body).toContain("demande un nouveau lien à Zoé.");
    const expired = invitationRow({ ...base, view: { state: "expired", inviter: null } });
    expect(expired).toMatchObject({ kind: "expired", heading: "Cette invitation a expiré" });
    expect(expired.body).toContain("la personne qui te l’a envoyé");
  });

  it("offline whatever the link, no WebAuthn before the pseudo step only", () => {
    const offline = invitationRow({
      ...base,
      online: false,
      view: { state: "ok", inviter: "Zoé" },
    });
    expect(offline).toMatchObject({
      kind: "offline",
      heading: "Pas de connexion",
      primary: { action: "retry", label: "Réessayer" },
      secondary: { action: "home" },
    });
    expect(invitationRow({ ...base, view: { state: "offline" } }).kind).toBe("offline");
    expect(
      invitationRow({ ...base, webauthn: false, view: { state: "ok", inviter: "Zoé" } }),
    ).toMatchObject({
      kind: "unsupported",
      heading: "Ce navigateur ne sait pas créer de clé d’accès",
      primary: { action: "copy-link", label: "Copier le lien" },
      secondary: { action: "home" },
    });
    // An expired link says so even without WebAuthn.
    expect(
      invitationRow({ ...base, webauthn: false, view: { state: "expired", inviter: "Zoé" } }).kind,
    ).toBe("expired");
    expect(invitationRow({ ...base, view: { state: "ok", inviter: "Zoé" } }).kind).toBe("pseudo");
  });

  it("signed in: add the inviter, already a friend (with the date), one's own link", () => {
    const signedIn = { ...base, signedIn: true };
    const add = invitationRow({ ...signedIn, view: { state: "ok", inviter: "Zoé" } });
    expect(add.kind).toBe("add-friend");
    expect(add.heading).toBe("Ajouter Zoé à tes amis ?".replace(" ?", "\u202f?"));
    expect(add.body).toBe("Zoé t’a envoyé ce lien. Vous pourrez vous inviter à vos tables.");
    expect(add.primary).toEqual({ action: "accept", label: "Ajouter à mes amis" });
    expect(add.secondary).toEqual({ action: "home", label: "Retour à l’accueil" });
    // A signed-in player never sees the pseudo step, even without WebAuthn.
    expect(
      invitationRow({ ...signedIn, webauthn: false, view: { state: "ok", inviter: "Zoé" } }).kind,
    ).toBe("add-friend");
    // A link with nobody behind it (the bootstrap, a test link) cannot add anyone.
    expect(invitationRow({ ...signedIn, view: { state: "ok", inviter: null } }).kind).toBe(
      "unknown",
    );
    const friend = invitationRow({
      ...signedIn,
      view: { state: "friend", inviter: "Zoé", expiresAt: LATER },
    });
    expect(friend).toMatchObject({
      kind: "already-friend",
      heading: "Zoé est déjà dans tes amis",
      body: "Ce lien reste valable pour un autre proche jusqu’au 25 octobre.",
      primary: { action: "friends", label: "Mes amis" },
      secondary: { action: "home" },
    });
    expect(
      invitationRow({ ...signedIn, view: { state: "own", inviter: "Léa", expiresAt: LATER } }),
    ).toMatchObject({
      kind: "own",
      heading: "C’est ton invitation",
      body: "Envoie ce lien à un proche : il sert une fois, jusqu’au 25 octobre.".replace(
        " :",
        "\u00a0:",
      ),
      primary: { action: "friends", label: "Mes amis" },
      secondary: null,
    });
    // Used while signed in: nothing to sign in to.
    expect(invitationRow({ ...signedIn, view: { state: "used", inviter: "Zoé" } })).toMatchObject({
      kind: "used",
      primary: { action: "home" },
      secondary: null,
    });
  });
});

describe("dateText", () => {
  it("« 25 octobre », the year only when it is not this one", () => {
    expect(dateText(LATER, NOW)).toBe("25 octobre");
    expect(dateText(Date.UTC(2027, 0, 3, 12), NOW)).toBe("3 janvier 2027");
  });
});

describe("pseudoError", () => {
  it("one line per refusal of the pseudo step", () => {
    expect(pseudoError("empty")).toEqual({ line: "Écris un pseudo pour continuer." });
    expect(pseudoError("short")).toEqual({
      line: "Ton pseudo doit avoir au moins 2 caractères.",
    });
    expect(pseudoError("chars")).toEqual({
      line: "Utilise des lettres (accents compris), des chiffres, des espaces et ' . _ - seulement.",
    });
    expect(pseudoError("pseudo")).toEqual(pseudoError("chars"));
    expect(pseudoError("taken")).toEqual({
      line: "Ce pseudo est déjà pris. Essaie une variante, par exemple avec ton initiale.",
    });
    expect(pseudoError("taken-meanwhile")).toEqual({
      line: "Ce pseudo vient d’être pris. Choisis-en un autre.",
    });
    expect(pseudoError("cancelled").line).toMatch(/^Création annulée\. Touche /);
    expect(pseudoError("wrong-address")).toEqual({
      line: "Les clés d’accès ne marchent qu’à l’adresse toc.romaindetroyat.workers.dev.",
    });
    expect(pseudoError("offline")).toEqual({
      line: "Pas de connexion. Vérifie le réseau, puis réessaie.",
    });
    expect(pseudoError("server")).toEqual({
      line: "Le compte n’a pas pu être créé. Réessaie dans un instant.",
    });
    expect(pseudoError("already-here")).toEqual(pseudoError("server"));
  });

  it("the link used or expired meanwhile, no WebAuthn, or a session meanwhile: another row", () => {
    expect(pseudoError("used")).toEqual({ row: "used" });
    expect(pseudoError("expired")).toEqual({ row: "expired" });
    expect(pseudoError("unknown")).toEqual({ row: "unknown" });
    expect(pseudoError("unsupported")).toEqual({ row: "unsupported" });
    // Plan 04-09: the server refuses a second account to a signed-in browser (signed in meanwhile,
    // in another tab): the signed-in rows apply.
    expect(pseudoError("signed-in")).toEqual({ row: "signed-in" });
  });
});

describe("prefill", () => {
  it("the device's first name when it is a valid pseudo, else nothing", () => {
    expect(prefill("Marie-Charlotte")).toBe("Marie-Charlotte");
    expect(prefill("  Zoé  ")).toBe("Zoé");
    expect(prefill("A")).toBe("");
    expect(prefill("Zoé 🎲")).toBe("");
    expect(prefill(null)).toBe("");
  });
});
