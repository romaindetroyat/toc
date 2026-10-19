import type { PasskeyInfo } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import {
  accountSeats,
  cardAction,
  cardText,
  dateText,
  formatCodeInput,
  friendCodeInput,
  friendCodeResult,
  friendSentence,
  friendSince,
  homeTiles,
  INVITE_SENT_MS,
  initial,
  invitationFromInput,
  invitationRow,
  inviteHere,
  inviteRowState,
  inviteTabDefault,
  lockText,
  noticePlace,
  notificationPlatform,
  notificationsView,
  passkeyLine,
  pendingLine,
  prefill,
  pseudoError,
  recoverError,
  recoverKeyError,
  seatNeedsAccount,
  signInLine,
  signInToast,
  signOutBody,
} from "./flow.ts";

// The pure decisions of the account screens (plan 04-09; 04-UI-SPEC « Small tiles », « Sign-in
// sheet », « Invitation », « Recovery »): which small tiles the home shows and what they say, the line
// the sign-in sheet shows for each failure, the invitation's rows, the pseudo step's errors, and the
// recovery's code field, errors and lock time.

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
    expect(pseudoError("cancelled")).toEqual({
      line: "Création annulée. Touche « Créer mon compte » pour réessayer.".replace(
        /« (.*) »/,
        "«\u202f$1\u202f»",
      ),
    });
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

// --- Task 3: « Retrouver mon compte » (04-UI-SPEC « Recovery ») ---

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("lockText", () => {
  it("the remaining lock, rounded up to the ladder's step", () => {
    const at = Date.UTC(2026, 9, 18, 12);
    expect(lockText(at + 15 * MINUTE, at)).toBe("15 minutes");
    expect(lockText(at + 14 * MINUTE + 30_000, at)).toBe("15 minutes");
    expect(lockText(at + 1000, at)).toBe("15 minutes");
    expect(lockText(at + 16 * MINUTE, at)).toBe("30 minutes");
    expect(lockText(at + 30 * MINUTE, at)).toBe("30 minutes");
    expect(lockText(at + 59 * MINUTE, at)).toBe("1 heure");
    expect(lockText(at + 2 * HOUR, at)).toBe("2 heures");
    expect(lockText(at + 3 * HOUR, at)).toBe("4 heures");
    expect(lockText(at + 8 * HOUR, at)).toBe("8 heures");
    expect(lockText(at + 9 * HOUR, at)).toBe("16 heures");
    expect(lockText(at + 20 * HOUR, at)).toBe("24 heures");
    expect(lockText(at + 30 * HOUR, at)).toBe("24 heures");
    // Already over (a slow answer): the shortest step.
    expect(lockText(at - 1000, at)).toBe("15 minutes");
  });
});

describe("formatCodeInput", () => {
  it("upper case, dashes every four symbols, at most 24 characters", () => {
    expect(formatCodeInput("k7qm")).toBe("K7QM");
    expect(formatCodeInput("k7qm2")).toBe("K7QM-2");
    expect(formatCodeInput("k7qm 2xra p9dw")).toBe("K7QM-2XRA-P9DW");
    expect(formatCodeInput("K7QM-2XRA-P9DW-HT4E-NB6Z")).toBe("K7QM-2XRA-P9DW-HT4E-NB6Z");
    expect(formatCodeInput("k7qm2xrap9dwht4enb6zEXTRA")).toBe("K7QM-2XRA-P9DW-HT4E-NB6Z");
    expect(formatCodeInput("K7QM-")).toBe("K7QM");
    expect(formatCodeInput("")).toBe("");
  });

  it("O is read as 0, I and L as 1; other signs are dropped", () => {
    expect(formatCodeInput("oil0")).toBe("0110");
    expect(formatCodeInput("a.b,c/d")).toBe("ABCD");
  });
});

describe("recoverError", () => {
  it("one line per refusal; a wrong pseudo and a wrong code read the same", () => {
    const at = Date.UTC(2026, 9, 18, 12);
    expect(recoverError({ reason: "empty" })).toBe("Écris ton pseudo et ton code.");
    expect(recoverError({ reason: "format" })).toBe(
      "Un code de secours a 20 caractères, comme K7QM-2XRA-P9DW-HT4E-NB6Z.",
    );
    expect(recoverError({ reason: "wrong" })).toBe(
      "Pseudo ou code incorrect. Vérifie, puis réessaie.",
    );
    expect(recoverError({ reason: "locked", until: at + 15 * MINUTE, now: at })).toBe(
      "Trop d’essais. Réessaie dans 15 minutes.",
    );
    expect(recoverError({ reason: "locked", until: at + 50 * MINUTE, now: at })).toBe(
      "Trop d’essais. Réessaie dans 1 heure.",
    );
    expect(recoverError({ reason: "offline" })).toBe(
      "Pas de connexion. Vérifie le réseau, puis réessaie.",
    );
    expect(recoverError({ reason: "server" })).toBe(
      "Le compte n’a pas pu être retrouvé. Réessaie dans un instant.",
    );
  });
});

describe("recoverKeyError", () => {
  it("cancelled stays on step 2; the delay over goes back to step 1", () => {
    expect(recoverKeyError("cancelled")).toEqual({
      back: false,
      line: "Création annulée. Touche « Créer ma clé d’accès » pour réessayer.".replace(
        /« (.*) »/,
        "«\u202f$1\u202f»",
      ),
    });
    expect(recoverKeyError("expired")).toEqual({
      back: true,
      line: "Le délai de 5 minutes est passé. Entre de nouveau ton code.",
    });
    expect(recoverKeyError("wrong-address").line).toBe(
      "Les clés d’accès ne marchent qu’à l’adresse toc.romaindetroyat.workers.dev.",
    );
    expect(recoverKeyError("offline").line).toBe(
      "Pas de connexion. Vérifie le réseau, puis réessaie.",
    );
    expect(recoverKeyError("server")).toEqual({
      back: false,
      line: "Le compte n’a pas pu être retrouvé. Réessaie dans un instant.",
    });
  });
});

// --- Plan 04-10: « Mon compte » (04-UI-SPEC « Mon compte », « Notifications », « Clés d’accès »,
// « Se déconnecter ») ---

const IPHONE_17 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

describe("notificationPlatform", () => {
  it("iPhone and iPad, Android, else a computer", () => {
    expect(notificationPlatform(IPHONE_17, true)).toBe("ios");
    expect(notificationPlatform(ANDROID, false)).toBe("android");
    expect(notificationPlatform(WINDOWS, false)).toBe("computer");
  });
});

describe("notificationsView", () => {
  it("no Push API: one line, nothing to press", () => {
    const view = notificationsView("unsupported", "computer");
    expect(view.line).toBe("Ce navigateur ne peut pas recevoir les notifications de TOC.");
    expect(view.action).toBeNull();
    expect(view.toggle).toBeNull();
  });

  it("an iPhone in a Safari tab: install first, with « Installer l’application »", () => {
    const view = notificationsView("install-first", "ios");
    expect(view.line).toBe(
      "Sur iPhone et iPad, les notifications marchent seulement dans l’application installée (iOS 16.4 ou plus récent). Installe TOC sur l’écran d’accueil, ouvre-le, connecte-toi, puis reviens ici.",
    );
    expect(view.action).toEqual({
      kind: "install",
      label: "Installer l’application",
      busy: null,
      primary: false,
    });
  });

  it("an installed iPhone before iOS 16.4", () => {
    const view = notificationsView("ios-too-old", "ios");
    expect(view.line).toBe(
      "Cet iPhone ne reçoit pas les notifications des applications web. Il faut iOS 16.4 ou plus récent.",
    );
    expect(view.action).toBeNull();
  });

  it("not asked yet: the primary « Activer les notifications », busy « Activation… »", () => {
    const view = notificationsView("ask", "computer");
    expect(view.action).toEqual({
      kind: "enable",
      label: "Activer les notifications",
      busy: "Activation…",
      primary: true,
    });
    expect(view.error).toBeNull();
    expect(view.toggle).toBeNull();
  });

  it("the activation failed: the same primary and its line", () => {
    const view = notificationsView("failed", "computer");
    expect(view.action?.kind).toBe("enable");
    expect(view.error).toBe("L’activation n’a pas marché. Réessaie dans un instant.");
  });

  it("on and off: the switch « Sur cet appareil » with its helper", () => {
    expect(notificationsView("on", "android").toggle).toEqual({
      label: "Sur cet appareil",
      checked: true,
      helper: "Activées. Tu les reçois seulement quand TOC est fermé.",
    });
    expect(notificationsView("off", "android").toggle).toEqual({
      label: "Sur cet appareil",
      checked: false,
      helper: "Désactivées sur cet appareil.",
    });
    expect(notificationsView("on", "android").action).toBeNull();
  });

  it("blocked: bell-off, the line and each platform's way to allow them", () => {
    const ios = notificationsView("blocked", "ios");
    expect(ios.blocked).toBe(true);
    expect(ios.line).toBe("Les notifications sont bloquées pour TOC sur cet appareil.");
    expect(ios.help).toBe(
      "Pour les autoriser : Réglages › Notifications › TOC. Reviens ici ensuite.",
    );
    expect(notificationsView("blocked", "android").help).toBe(
      "Pour les autoriser : appui long sur l’icône de TOC › Infos sur l’appli › Notifications. Reviens ici ensuite.",
    );
    expect(notificationsView("blocked", "computer").help).toBe(
      "Pour les autoriser : le cadenas à côté de l’adresse › Notifications. Reviens ici ensuite.",
    );
    expect(ios.action).toBeNull();
    expect(notificationsView("ask", "ios").blocked).toBe(false);
  });
});

describe("passkeyLine", () => {
  const now = new Date(2026, 9, 18, 12).getTime();
  const key = (over: Partial<PasskeyInfo>): PasskeyInfo => ({
    id: "AAAAAAAAAAAAAAAAAAAAAA",
    label: "iPhone",
    createdAt: new Date(2026, 9, 3, 9).getTime(),
    lastUsedAt: null,
    backedUp: false,
    current: false,
    ...over,
  });

  it("added and used, this device: the line and the sentence", () => {
    const shown = passkeyLine(key({ current: true, lastUsedAt: now - 86_400_000 }), now);
    expect(shown.name).toBe("iPhone");
    expect(shown.current).toBe(true);
    expect(shown.line).toBe("Ajoutée le 3 octobre · utilisée hier");
    expect(shown.sentence).toBe("iPhone, cet appareil, ajoutée le 3 octobre, utilisée hier");
  });

  it("never used since: the date alone; synced: « · synchronisée »", () => {
    const shown = passkeyLine(key({ label: "Mac", backedUp: true }), now);
    expect(shown.line).toBe("Ajoutée le 3 octobre · synchronisée");
    expect(shown.sentence).toBe("Mac, ajoutée le 3 octobre, synchronisée");
    expect(shown.current).toBe(false);
  });

  it("an older year shows the year, a use three days ago reads « il y a 3 jours »", () => {
    const shown = passkeyLine(
      key({ createdAt: new Date(2025, 0, 2, 9).getTime(), lastUsedAt: now - 3 * 86_400_000 }),
      now,
    );
    expect(shown.line).toBe("Ajoutée le 2 janvier 2025 · utilisée il y a 3 jours");
  });
});

describe("signOutBody and accountSeats", () => {
  const body =
    "Tes places dans les parties en cours ne seront plus jouables sur cet appareil jusqu’à ta prochaine connexion. Cet appareil ne recevra plus tes notifications. Tes autres appareils ne changent pas.";

  it("the D-12 body, plus « Parties concernées : n. » when this device holds seats", () => {
    expect(signOutBody(0)).toBe(body);
    expect(signOutBody(1)).toBe(`${body} Parties concernées : 1.`);
    expect(signOutBody(3)).toBe(`${body} Parties concernées : 3.`);
  });

  it("counts this device's entries of the account that hold a seat", () => {
    const id = "BBBBBBBBBBBBBBBBBBBBBB";
    expect(
      accountSeats(
        [
          { id: "t1", seat: "bleu", joinedAt: 1, account: id },
          { id: "t2", seat: null, joinedAt: 2, account: id },
          { id: "t3", seat: "rouge", joinedAt: 3 },
          { id: "t4", seat: "vert", joinedAt: 4, account: "CCCCCCCCCCCCCCCCCCCCCC" },
          { id: "t5", seat: "jaune", joinedAt: 5, account: id },
        ],
        id,
      ),
    ).toBe(2);
  });
});

// --- Plan 04-10: « Mes amis » (04-UI-SPEC « Mes amis ») ---

describe("friendSince, friendSentence and initial", () => {
  const since = new Date(2026, 9, 12, 15).getTime();

  it("« Dans tes amis depuis octobre 2026 », and the row as one sentence", () => {
    expect(friendSince(since)).toBe("Dans tes amis depuis octobre 2026");
    expect(friendSince(new Date(2025, 0, 31, 9).getTime())).toBe(
      "Dans tes amis depuis janvier 2025",
    );
    expect(friendSentence("Marie", since)).toBe("Marie, dans tes amis depuis octobre 2026");
  });

  it("the first grapheme in upper case", () => {
    expect(initial("élodie")).toBe("É");
    expect(initial("Marie-Claire")).toBe("M");
    expect(initial("ñandú")).toBe("Ñ");
    expect(initial("e\u0301mile")).toBe("É");
    expect(initial("1er")).toBe("1");
    expect(initial("")).toBe("");
  });
});

describe("pendingLine", () => {
  it("« Lien du {date} » and « Valable jusqu’au {date} · une seule fois »", () => {
    const now = new Date(2026, 9, 18, 12).getTime();
    expect(
      pendingLine(
        {
          id: "AAAAAAAAAAAAAAAAAAAAAA",
          createdAt: new Date(2026, 9, 18, 10).getTime(),
          expiresAt: new Date(2026, 9, 25, 10).getTime(),
        },
        now,
      ),
    ).toEqual({
      title: "Lien du 18 octobre",
      line: "Valable jusqu’au 25 octobre · une seule fois",
    });
    expect(
      pendingLine(
        {
          id: "AAAAAAAAAAAAAAAAAAAAAA",
          createdAt: new Date(2026, 11, 29, 10).getTime(),
          expiresAt: new Date(2027, 0, 5, 10).getTime(),
        },
        new Date(2026, 11, 30, 12).getTime(),
      ).line,
    ).toBe("Valable jusqu’au 5 janvier 2027 · une seule fois");
  });
});

// --- Plan 04-10: « Ajouter avec un code » (04-UI-SPEC « Code-ami sheet ») ---

describe("friendCodeInput", () => {
  it("adds « TOC- » and the dash after four symbols, at most 13 characters", () => {
    expect(friendCodeInput("k7qm2xra")).toBe("TOC-K7QM-2XRA");
    expect(friendCodeInput("k")).toBe("TOC-K");
    expect(friendCodeInput("k7qm")).toBe("TOC-K7QM");
    expect(friendCodeInput("k7qm2")).toBe("TOC-K7QM-2");
    expect(friendCodeInput("TOC-K7QM-2XRAZZZ")).toBe("TOC-K7QM-2XRA");
    expect(friendCodeInput("TOC-K7QM-2XRAZZZ")).toHaveLength(13);
  });

  it("reads a pasted or typed prefix once, spaces and dashes, O for 0 and I or L for 1", () => {
    expect(friendCodeInput("toc-k7qm-2xra")).toBe("TOC-K7QM-2XRA");
    expect(friendCodeInput("TOC k7qm 2xra")).toBe("TOC-K7QM-2XRA");
    expect(friendCodeInput("TOC-T")).toBe("TOC-T");
    expect(friendCodeInput("TOC-TOC")).toBe("TOC-T0C");
    expect(friendCodeInput("o1l")).toBe("TOC-011");
  });

  it("lets the player type the prefix, and empty it again", () => {
    expect(friendCodeInput("")).toBe("");
    expect(friendCodeInput("t")).toBe("T");
    expect(friendCodeInput("to")).toBe("TO");
    expect(friendCodeInput("toc")).toBe("TOC");
    expect(friendCodeInput("TOC-")).toBe("TOC-");
    expect(friendCodeInput("tk")).toBe("TOC-TK");
  });
});

describe("friendCodeResult", () => {
  const friend = { id: "AAAAAAAAAAAAAAAAAAAAAA", pseudo: "Marie", since: 1 };

  it("added: the sheet closes with the toast", () => {
    expect(friendCodeResult({ ok: true, friend, already: false })).toEqual({
      kind: "added",
      toast: "Marie est maintenant dans tes amis.",
    });
  });

  it("one line per refusal, from the UI-SPEC table", () => {
    expect(friendCodeResult({ ok: true, friend, already: true })).toEqual({
      kind: "line",
      line: "Marie est déjà dans tes amis.",
    });
    expect(friendCodeResult({ ok: false, reason: "format" })).toEqual({
      kind: "line",
      line: "Un code ami ressemble à TOC-K7QM-2XRA.",
    });
    const unknown =
      "Ce code ne marche pas : il a peut-être expiré (24 heures). Demande un nouveau code.";
    expect(friendCodeResult({ ok: false, reason: "unknown" })).toEqual({
      kind: "line",
      line: unknown,
    });
    expect(friendCodeResult({ ok: false, reason: "expired" })).toEqual({
      kind: "line",
      line: unknown,
    });
    expect(friendCodeResult({ ok: false, reason: "own" })).toEqual({
      kind: "line",
      line: "C’est ton propre code : donne-le à ton proche.",
    });
    expect(friendCodeResult({ ok: false, reason: "rate" })).toEqual({
      kind: "line",
      line: "Trop d’essais. Réessaie dans une heure.",
    });
    expect(friendCodeResult({ ok: false, reason: "offline" })).toEqual({
      kind: "line",
      line: "Pas de connexion. Vérifie le réseau, puis réessaie.",
    });
    expect(friendCodeResult({ ok: false, reason: "server" })).toEqual({
      kind: "line",
      line: "L’ajout n’a pas marché. Réessaie dans un instant.",
    });
    expect(friendCodeResult({ ok: false, reason: "signed-out" })).toEqual({ kind: "signed-out" });
  });
});

// --- Plan 04-11: « Inviter à la table », the « Mes amis » tab (04-UI-SPEC « In the waiting room ») ---

describe("inviteTabDefault", () => {
  it("« Mes amis » with at least one friend, else « Lien et QR code »", () => {
    expect(inviteTabDefault(0)).toBe("lien");
    expect(inviteTabDefault(1)).toBe("amis");
    expect(inviteTabDefault(12)).toBe("amis");
  });
});

describe("inviteRowState", () => {
  const now = 1_000_000;

  it("invite before any tap, sending while the server answers", () => {
    expect(inviteRowState(null, null, now, "Marie")).toEqual({ state: "invite" });
    expect(inviteRowState("sending", null, now, "Marie")).toEqual({ state: "sending" });
  });

  it("sent for 10 minutes (the hub's dedupe window), then invite again", () => {
    expect(INVITE_SENT_MS).toBe(10 * 60_000);
    const sent = { ok: true, state: "sent" } as const;
    expect(inviteRowState(sent, now, now, "Marie")).toEqual({ state: "sent" });
    expect(inviteRowState(sent, now, now + INVITE_SENT_MS - 1, "Marie")).toEqual({
      state: "sent",
    });
    expect(inviteRowState(sent, now, now + INVITE_SENT_MS, "Marie")).toEqual({ state: "invite" });
    expect(inviteRowState(sent, null, now, "Marie")).toEqual({ state: "invite" });
  });

  it("here: « Déjà à la table », no button", () => {
    expect(inviteRowState({ ok: true, state: "here" }, now, now, "Marie")).toEqual({
      state: "here",
    });
  });

  it("not-friend: the row leaves with « {Pseudo} n’est plus dans tes amis. »", () => {
    expect(inviteRowState({ ok: false, reason: "not-friend" }, null, now, "Marie")).toEqual({
      state: "invite",
      leave: true,
      toast: "Marie n\u2019est plus dans tes amis.",
    });
  });

  it("rate: « Doucement : attends un peu avant d’inviter de nouveau. »", () => {
    expect(inviteRowState({ ok: false, reason: "rate" }, null, now, "Marie")).toEqual({
      state: "invite",
      toast: "Doucement\u00a0: attends un peu avant d\u2019inviter de nouveau.",
    });
  });

  it("offline, server and the rest: « L’invitation n’est pas partie… »", () => {
    const failed =
      "L\u2019invitation n\u2019est pas partie. V\u00e9rifie le r\u00e9seau, puis r\u00e9essaie.";
    for (const reason of ["offline", "server", "not-here", "started"] as const) {
      expect(inviteRowState({ ok: false, reason }, null, now, "Marie")).toEqual({
        state: "invite",
        toast: failed,
      });
    }
  });
});

describe("inviteHere", () => {
  it("a friend whose pseudo is a name at the table (seated or not) is already there", () => {
    expect(inviteHere("Marie", ["Romain", null, "Marie"])).toBe(true);
    expect(inviteHere("Marie", ["Romain", null])).toBe(false);
    expect(inviteHere("Marie", ["marie"])).toBe(false);
  });
});

// --- Plan 04-11: the in-app card and the seat of an account (04-UI-SPEC « In-app card », « Guests ») ---

describe("cardText", () => {
  const at = 1;
  const table = "AAAAAAAAAAAAAAAAAAAAAA";

  it("an invitation: « {Pseudo} t’invite à sa table. »", () => {
    expect(cardText({ t: "notice", kind: "invite", table, from: "Romain", at })).toBe(
      "Romain t\u2019invite \u00e0 sa table.",
    );
  });

  it("a turn: « La table de {Créateur} t’attend : c’est ton tour. », or « Ta table… » when own", () => {
    expect(cardText({ t: "notice", kind: "turn", table, from: "Romain", at })).toBe(
      "La table de Romain t\u2019attend\u00a0: c\u2019est ton tour.",
    );
    expect(cardText({ t: "notice", kind: "turn", table, from: "Romain", own: true, at })).toBe(
      "Ta table t\u2019attend\u00a0: c\u2019est ton tour.",
    );
  });
});

describe("cardAction", () => {
  const table = "AAAAAAAAAAAAAAAAAAAAAA";

  it("« Rejoindre » for an invitation, « Revenir à la table » for a turn, both to #/table/<id>", () => {
    expect(cardAction({ kind: "invite", table })).toEqual({
      label: "Rejoindre",
      href: `#/table/${table}`,
    });
    expect(cardAction({ kind: "turn", table })).toEqual({
      label: "Revenir \u00e0 la table",
      href: `#/table/${table}`,
    });
  });

  it("never anything but a table id (T-04-71)", () => {
    expect(cardAction({ kind: "invite", table: "../evil" }).href).toBeNull();
    expect(cardAction({ kind: "turn", table: "https://example.com" }).href).toBeNull();
  });
});

describe("seatNeedsAccount", () => {
  const id = "AAAAAAAAAAAAAAAAAAAAAA";
  const accountId = "BBBBBBBBBBBBBBBBBBBBBB";

  it("true when this device's entry is tagged with an account and nobody is signed in", () => {
    expect(seatNeedsAccount({ id, seat: "jaune", joinedAt: 1, account: accountId }, null)).toBe(
      true,
    );
  });

  it("false for a guest's entry, no entry, or a signed-in device", () => {
    expect(seatNeedsAccount({ id, seat: "jaune", joinedAt: 1 }, null)).toBe(false);
    expect(seatNeedsAccount(undefined, null)).toBe(false);
    expect(
      seatNeedsAccount(
        { id, seat: "jaune", joinedAt: 1, account: accountId },
        { id: accountId, pseudo: "Marie" },
      ),
    ).toBe(false);
  });
});

describe("noticePlace", () => {
  it("the route without its query, and the table's status only at a table", () => {
    expect(noticePlace({ hash: "#/", tableStatus: "playing", backupCode: false })).toEqual({
      route: "#/",
      tableStatus: null,
      flow: null,
    });
    expect(
      noticePlace({ hash: "#/table/AAAAAAAAAAAAAAAAAAAAAA?vitesse=test", tableStatus: "paused" }),
    ).toEqual({ route: "#/table/AAAAAAAAAAAAAAAAAAAAAA", tableStatus: "paused", flow: null });
    expect(noticePlace({ hash: "#/partie?graine=3" }).route).toBe("#/partie");
  });

  it("sign-up, recovery and the backup code on screen are flows that hold a card", () => {
    expect(noticePlace({ hash: "#/invitation/AAAAAAAAAAAAAAAAAAAAAA" }).flow).toBe("signup");
    expect(noticePlace({ hash: "#/secours" }).flow).toBe("recover");
    expect(noticePlace({ hash: "#/compte", backupCode: true }).flow).toBe("backup");
    expect(noticePlace({ hash: "#/secours", backupCode: true }).flow).toBe("backup");
  });
});

describe("invitationFromInput", () => {
  // Plan 04-13: « J’ai une invitation » in the sign-in sheet. On iOS a tapped link opens Safari, never
  // the installed app, so the person pastes the link (or its code) into the app.
  const code = "Ab3_-defGHIJklmnOPq9xZ";

  it("a bare code, with spaces or line breaks around it", () => {
    expect(invitationFromInput(code)).toBe(code);
    expect(invitationFromInput(`  ${code}\n`)).toBe(code);
    expect(invitationFromInput(`\t${code} `)).toBe(code);
  });

  it("the whole link, from any origin, with or without its scheme", () => {
    expect(invitationFromInput(`https://toc.romaindetroyat.workers.dev/#/invitation/${code}`)).toBe(
      code,
    );
    expect(invitationFromInput(`http://localhost:8787/#/invitation/${code}`)).toBe(code);
    expect(invitationFromInput(`https://exemple.fr/#/invitation/${code}`)).toBe(code);
    expect(invitationFromInput(`toc.romaindetroyat.workers.dev/#/invitation/${code}`)).toBe(code);
    expect(
      invitationFromInput(` https://toc.romaindetroyat.workers.dev/#/invitation/${code} `),
    ).toBe(code);
  });

  it("the shared message around the link, and what may follow the code", () => {
    expect(
      invitationFromInput(
        `Marie t’invite sur TOC, le jeu de petits chevaux à cartes. Ce lien marche une fois, pendant 7 jours. https://toc.romaindetroyat.workers.dev/#/invitation/${code}`,
      ),
    ).toBe(code);
    expect(
      invitationFromInput(`https://toc.romaindetroyat.workers.dev/#/invitation/${code}/`),
    ).toBe(code);
    expect(
      invitationFromInput(`https://toc.romaindetroyat.workers.dev/#/invitation/${code}?x=1`),
    ).toBe(code);
    expect(invitationFromInput(`#/invitation/${code}. À bientôt !`)).toBe(code);
  });

  it("nothing else: empty, the wrong length, a foreign character, another route", () => {
    expect(invitationFromInput("")).toBeNull();
    expect(invitationFromInput("   \n ")).toBeNull();
    expect(invitationFromInput(code.slice(1))).toBeNull();
    expect(invitationFromInput(`${code}A`)).toBeNull();
    expect(invitationFromInput(`${code.slice(1)}=`)).toBeNull();
    expect(invitationFromInput(`${code.slice(1)}+`)).toBeNull();
    expect(invitationFromInput(`${code.slice(1)}/`)).toBeNull();
    expect(
      invitationFromInput(`https://toc.romaindetroyat.workers.dev/#/invitation/${code}A`),
    ).toBeNull();
    expect(
      invitationFromInput(`https://toc.romaindetroyat.workers.dev/#/invitation/${code.slice(2)}`),
    ).toBeNull();
    expect(
      invitationFromInput(`https://toc.romaindetroyat.workers.dev/#/table/${code}`),
    ).toBeNull();
    expect(invitationFromInput("https://toc.romaindetroyat.workers.dev/")).toBeNull();
    expect(invitationFromInput("bonjour")).toBeNull();
  });

  it("never throws: not a string, or far too long", () => {
    expect(invitationFromInput(null)).toBeNull();
    expect(invitationFromInput(undefined)).toBeNull();
    expect(invitationFromInput(42)).toBeNull();
    expect(invitationFromInput({ code })).toBeNull();
    expect(invitationFromInput(`${"x".repeat(2000)} #/invitation/${code}`)).toBeNull();
  });
});
