// The pure decisions of the account screens (plan 04-09; 04-UI-SPEC « Small tiles », « Sign-in
// sheet », « Invitation »): which small tiles the home shows and what they say, the line the sign-in
// sheet shows for each failure, the welcome toast after a sign-in, the row an invitation link opens
// on, the pseudo step's errors and its prefill. No DOM, no storage: the screens pass in what they
// know, so every case runs under Node.

import { normalizePseudo } from "@toc/protocol";
import { accueil } from "../i18n/fr/accueil.ts";
import { compte } from "../i18n/fr/compte.ts";
import type { IconName } from "../ui/icons.ts";
import type { AccountFailure, InvitationView, SignUpFailure } from "./api.ts";

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

// --- The invitation link (04-UI-SPEC « Opening the link », « Step 1 ») ---

/** The case an invitation page shows; "pseudo" is the sign-up's first step. */
export type InvitationRowKind =
  | "loading"
  | "unknown"
  | "used"
  | "expired"
  | "unsupported"
  | "offline"
  | "add-friend"
  | "already-friend"
  | "own"
  | "pseudo";

/** What a row's button does. */
export type RowAction = "home" | "sign-in" | "copy-link" | "retry" | "accept" | "friends";

export type RowButton = { action: RowAction; label: string };

export type InvitationRow = {
  kind: InvitationRowKind;
  heading: string;
  body: string | null;
  primary: RowButton | null;
  secondary: RowButton | null;
};

const HOME: RowButton = { action: "home", label: compte.invitation.home };
const FRIENDS: RowButton = { action: "friends", label: compte.invitation.friends };

/** « 25 octobre », with the year when it is not the current one (04-UI-SPEC « Typography »). */
export function dateText(at: number, now: number): string {
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat("fr", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(at);
}

/**
 * The row an invitation link opens on: loading; offline (no network, or the server failing); the
 * link's own state (unknown, used, expired); signed in, add the inviter, already a friend or one's
 * own link (a link with nobody behind it cannot add anyone); signed out, the pseudo step, or the
 * line about a browser that cannot make a passkey.
 */
export function invitationRow(input: {
  view: InvitationView | { state: "loading" };
  signedIn: boolean;
  webauthn: boolean;
  online: boolean;
  now: number;
}): InvitationRow {
  const { view, signedIn } = input;
  const copy = compte.invitation;
  const row = (
    kind: InvitationRowKind,
    heading: string,
    body: string | null,
    primary: RowButton | null,
    secondary: RowButton | null = null,
  ): InvitationRow => ({ kind, heading, body, primary, secondary });
  if (view.state === "loading") return row("loading", copy.loading, null, null);
  if (!input.online || view.state === "offline") {
    return row(
      "offline",
      copy.offline.heading,
      copy.offline.body,
      { action: "retry", label: copy.offline.retry },
      HOME,
    );
  }
  const inviter = "inviter" in view && view.inviter !== null ? view.inviter : null;
  const name = inviter ?? copy.someone;
  switch (view.state) {
    case "unknown":
      return row("unknown", copy.unknown.heading, copy.unknown.body, HOME);
    case "used":
      return signedIn
        ? row("used", copy.used.heading, copy.used.body(name), HOME)
        : row(
            "used",
            copy.used.heading,
            copy.used.body(name),
            { action: "sign-in", label: copy.signIn },
            HOME,
          );
    case "expired":
      return row("expired", copy.expired.heading, copy.expired.body(name), HOME);
    case "own":
      return row(
        "own",
        copy.own.heading,
        copy.own.body(dateText(view.expiresAt, input.now)),
        FRIENDS,
      );
    case "friend":
      return row(
        "already-friend",
        copy.friend.heading(name),
        copy.friend.body(dateText(view.expiresAt, input.now)),
        FRIENDS,
        HOME,
      );
    case "ok":
      if (signedIn) {
        if (inviter === null) return row("unknown", copy.unknown.heading, copy.unknown.body, HOME);
        return row(
          "add-friend",
          copy.addFriend.heading(inviter),
          copy.addFriend.body(inviter),
          { action: "accept", label: copy.addFriend.accept },
          HOME,
        );
      }
      if (!input.webauthn) {
        return row(
          "unsupported",
          copy.unsupported.heading,
          copy.unsupported.body,
          { action: "copy-link", label: copy.unsupported.copy },
          HOME,
        );
      }
      return row("pseudo", compte.pseudo.heading, null, null);
  }
}

/** What a refusal of the pseudo step shows: a line under the field, or another row of the page. */
export type PseudoError =
  | { line: string }
  | { row: "used" | "expired" | "unknown" | "unsupported" | "signed-in" };

/**
 * The pseudo step's refusals (04-UI-SPEC « Step 1 » errors): the shared rules' (empty, short, long,
 * chars) and the server's; a link used or expired meanwhile, a browser without passkeys, or a
 * session opened meanwhile (the server makes no second account, plan 04-09) change the row.
 */
export function pseudoError(
  reason: SignUpFailure | "empty" | "short" | "long" | "chars",
): PseudoError {
  const errors = compte.pseudo.errors;
  switch (reason) {
    case "empty":
    case "short":
    case "long":
    case "chars":
      return { line: errors[reason] };
    case "pseudo":
      return { line: errors.chars };
    case "taken":
      return { line: errors.taken };
    case "taken-meanwhile":
      return { line: errors.takenMeanwhile };
    case "cancelled":
      return { line: errors.cancelled };
    case "wrong-address":
      return { line: errors.wrongAddress };
    case "offline":
      return { line: errors.offline };
    case "used":
    case "expired":
    case "unknown":
    case "unsupported":
    case "signed-in":
      return { row: reason };
    default:
      return { line: errors.server };
  }
}

/** The pseudo field's first value: this device's first name when it passes the pseudo rules. */
export function prefill(firstName: string | null): string {
  if (firstName === null) return "";
  const checked = normalizePseudo(firstName);
  return checked.ok ? checked.pseudo : "";
}
