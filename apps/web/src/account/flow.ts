// The pure decisions of the account screens (plan 04-09; 04-UI-SPEC « Small tiles », « Sign-in
// sheet »): which small tiles the home shows and what they say, the line the sign-in sheet shows for
// each failure, and the welcome toast after a sign-in. No DOM, no storage: the screens pass in what
// they know, so every case runs under Node.

import { accueil } from "../i18n/fr/accueil.ts";
import { compte } from "../i18n/fr/compte.ts";
import type { IconName } from "../ui/icons.ts";
import type { AccountFailure } from "./api.ts";

export type TileKind = "prenom" | "connexion" | "amis" | "compte";

export type HomeTile = {
  kind: TileKind;
  icon: IconName;
  /** Line 1 (Label 700). */
  label: string;
  /** Line 2 (Label 400 muted, cut with an ellipsis); its full text is the tile's title. */
  sub: string;
  /** The accessible name. */
  name: string;
  /** A page (a link); absent: a sheet (a button with aria-haspopup="dialog"). */
  href?: string;
};

/**
 * The small tiles under the choice tiles (04-UI-SPEC « Small tiles »): a guest gets « Ton prénom »
 * (when this device has a first name) and « Se connecter »; a signed-in player « Mes amis » and
 * « Mon compte », and the first name is not shown (the pseudo is the name at every table).
 */
export function homeTiles(input: {
  account: { pseudo: string } | null;
  firstName: string | null;
}): HomeTile[] {
  if (input.account !== null) {
    const { pseudo } = input.account;
    return [
      {
        kind: "amis",
        icon: "handshake",
        label: compte.tile.friends,
        sub: compte.tile.friendsSub,
        name: compte.tile.friends,
        href: "#/amis",
      },
      {
        kind: "compte",
        icon: "user",
        label: compte.tile.account,
        sub: pseudo,
        name: compte.tile.accountLabel(pseudo),
        href: "#/compte",
      },
    ];
  }
  const signIn: HomeTile = {
    kind: "connexion",
    icon: "log-in",
    label: compte.tile.signIn,
    sub: compte.tile.signInSub,
    name: compte.tile.signInLabel,
  };
  if (input.firstName === null) return [signIn];
  return [
    {
      kind: "prenom",
      icon: "user",
      label: accueil.home.nameTile,
      sub: input.firstName,
      name: accueil.home.nameTileLabel(input.firstName),
    },
    signIn,
  ];
}

/**
 * The sign-in sheet's line for a failed « Utiliser ma clé d’accès » (04-UI-SPEC « Sign-in sheet »):
 * one sentence per failure; what the sheet has no sentence for reads as a server error.
 */
export function signInLine(reason: AccountFailure): string {
  const lines = compte.signIn.lines;
  switch (reason) {
    case "cancelled":
      return lines.cancelled;
    case "unknown":
      return lines.unknown;
    case "wrong-address":
      return lines.wrongAddress;
    case "offline":
      return lines.offline;
    case "unsupported":
      return lines.unsupported;
    default:
      return lines.server;
  }
}

/** The toast after a sign-in: « Bonjour {Pseudo} ! », and the line about this device's tables. */
export function signInToast(pseudo: string, linked: number): string {
  return linked > 0 ? compte.signIn.helloLinked(pseudo) : compte.signIn.hello(pseudo);
}
