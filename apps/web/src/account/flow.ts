// The pure decisions of the account screens (plan 04-09; 04-UI-SPEC « Small tiles », « Sign-in
// sheet », « Invitation », « Recovery »): which small tiles the home shows and what they say, the line the sign-in
// sheet shows for each failure, the welcome toast after a sign-in, the row an invitation link opens
// on, the pseudo step's errors and its prefill, and the recovery's code field, errors and lock time.
// No DOM, no storage: the screens pass in what they
// know, so every case runs under Node.

import { normalizePseudo, type PasskeyInfo, type PendingInvitation } from "@toc/protocol";
import { accueil } from "../i18n/fr/accueil.ts";
import { amis } from "../i18n/fr/amis.ts";
import { compte } from "../i18n/fr/compte.ts";
import { type TableEntry, timeAgo } from "../net/tables.ts";
import type { IconName } from "../ui/icons.ts";
import type {
  AccountFailure,
  InvitationView,
  RecoverFailure,
  RecoverVerifyFailure,
  SignUpFailure,
} from "./api.ts";
import type { PushState } from "./push.ts";

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

// --- « Retrouver mon compte » (04-UI-SPEC « Recovery ») ---

const MINUTE = 60_000;

/** The lock ladder of the account's hub (PlayerHub): 15 minutes, doubled each time, at most 24 hours. */
const LOCK_STEPS_MIN = [15, 30, 60, 120, 240, 480, 960, 1440] as const;

/** « 15 minutes », « 30 minutes », « 1 heure », « 2 heures »… « 24 heures »: the lock left, rounded up. */
export function lockText(until: number, now: number): string {
  const left = Math.max(0, until - now);
  const step = LOCK_STEPS_MIN.find((minutes) => left <= minutes * MINUTE) ?? 1440;
  return step < 60 ? compte.recover.minutes(step) : compte.recover.hours(step / 60);
}

/** The code field as the player types: upper case, O read as 0, I and L as 1, dashes every four. */
export function formatCodeInput(typed: string): string {
  const symbols = typed
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 20);
  return (symbols.match(/.{1,4}/g) ?? []).join("-");
}

/** Step 1's line for a refusal: the same for a wrong pseudo and a wrong code (T-04-03). */
export function recoverError(
  input: { reason: "empty" | RecoverFailure } | { reason: "locked"; until: number; now: number },
): string {
  const errors = compte.recover.errors;
  switch (input.reason) {
    case "empty":
      return errors.empty;
    case "format":
      return errors.format;
    case "wrong":
      return errors.wrong;
    case "locked":
      return errors.locked(lockText(input.until, input.now));
    case "offline":
      return errors.offline;
    default:
      return errors.server;
  }
}

/** Step 2's line for a failed new passkey; `back`: the delay is over, step 1 again. */
export function recoverKeyError(reason: RecoverVerifyFailure): { line: string; back: boolean } {
  switch (reason) {
    case "cancelled":
      return { line: compte.recover.key.cancelled, back: false };
    case "expired":
      return { line: compte.recover.key.expired, back: true };
    case "wrong-address":
      return { line: compte.pseudo.errors.wrongAddress, back: false };
    case "offline":
      return { line: compte.recover.errors.offline, back: false };
    default:
      return { line: compte.recover.errors.server, back: false };
  }
}

// --- « Mon compte » (plan 04-10; 04-UI-SPEC « Mon compte », « Notifications », « Clés d’accès »,
// « Se déconnecter ») ---

/** Whose way to allow blocked notifications the page explains. */
export type NotificationPlatform = "ios" | "android" | "computer";

/** iPhone and iPad (platform.ts isAppleMobile), Android, else a computer. */
export function notificationPlatform(userAgent: string, apple: boolean): NotificationPlatform {
  if (apple) return "ios";
  return /\bAndroid\b/.test(userAgent) ? "android" : "computer";
}

/** What the section « Notifications » shows for one state of push.ts pushState. */
export type NotificationsView = {
  state: PushState;
  /** The state's line, null when the button or the switch says it all. */
  line: string | null;
  /** Blocked: the line comes after the bell-off icon. */
  blocked: boolean;
  /** Blocked: this platform's way to allow them, then « Reviens ici ensuite. ». */
  help: string | null;
  /** « Activer les notifications » (primary) or « Installer l’application » (secondary). */
  action: {
    kind: "enable" | "install";
    label: string;
    busy: string | null;
    primary: boolean;
  } | null;
  /** The switch « Sur cet appareil » and its helper. */
  toggle: { label: string; checked: boolean; helper: string } | null;
  /** The line under the primary after a failed activation. */
  error: string | null;
};

/** The UI-SPEC row of the section « Notifications » for `state` on `platform`. */
export function notificationsView(
  state: PushState,
  platform: NotificationPlatform,
): NotificationsView {
  const copy = compte.notifications;
  const view: NotificationsView = {
    state,
    line: null,
    blocked: false,
    help: null,
    action: null,
    toggle: null,
    error: null,
  };
  const enable = {
    kind: "enable" as const,
    label: copy.enable,
    busy: copy.enabling,
    primary: true,
  };
  switch (state) {
    case "unsupported":
      return { ...view, line: copy.unsupported };
    case "install-first":
      return {
        ...view,
        line: copy.installFirst,
        action: { kind: "install", label: copy.install, busy: null, primary: false },
      };
    case "ios-too-old":
      return { ...view, line: copy.iosTooOld };
    case "blocked":
      return {
        ...view,
        line: copy.blocked,
        blocked: true,
        help: `${copy.allow[platform]} ${copy.back}`,
      };
    case "failed":
      return { ...view, action: enable, error: copy.failed };
    case "on":
      return { ...view, toggle: { label: copy.toggle, checked: true, helper: copy.on } };
    case "off":
      return { ...view, toggle: { label: copy.toggle, checked: false, helper: copy.off } };
    default:
      return { ...view, action: enable };
  }
}

/** One row of « Clés d’accès »: its name, « cet appareil », line 2, and the row as one sentence. */
export function passkeyLine(
  passkey: PasskeyInfo,
  now: number,
): { name: string; current: boolean; line: string; sentence: string } {
  const copy = compte.keys;
  const added = dateText(passkey.createdAt, now);
  const used = passkey.lastUsedAt === null ? null : copy.used(timeAgo(passkey.lastUsedAt, now));
  const line = [copy.added(added), used, passkey.backedUp ? copy.synced : null]
    .filter((part): part is string => part !== null)
    .join(" · ");
  const sentence = [
    passkey.label,
    passkey.current ? copy.thisDevice : null,
    copy.addedLower(added),
    used,
    passkey.backedUp ? copy.synced : null,
  ]
    .filter((part): part is string => part !== null)
    .join(", ");
  return { name: passkey.label, current: passkey.current, line, sentence };
}

/** The confirmation « Se déconnecter de cet appareil ? »: the D-12 body, and the seats it concerns. */
export function signOutBody(seats: number): string {
  const copy = compte.signOut;
  return seats > 0 ? `${copy.body} ${copy.seats(seats)}` : copy.body;
}

/** This device's entries of the account that hold a seat (« Parties concernées : n. »). */
export function accountSeats(entries: readonly TableEntry[], accountId: string): number {
  return entries.filter((entry) => entry.account === accountId && entry.seat !== null).length;
}

// --- « Mes amis » (plan 04-10; 04-UI-SPEC « Mes amis ») ---

/** « octobre 2026 ». */
function monthYear(at: number): string {
  return new Intl.DateTimeFormat("fr", { month: "long", year: "numeric" }).format(at);
}

/** Line 2 of a friend row: « Dans tes amis depuis octobre 2026 ». */
export function friendSince(since: number): string {
  return amis.list.since(monthYear(since));
}

/** A friend row read as one sentence: « Marie, dans tes amis depuis octobre 2026 ». */
export function friendSentence(pseudo: string, since: number): string {
  return amis.list.sentence(pseudo, monthYear(since));
}

/** The initial in a friend's disc: the pseudo's first grapheme in upper case (« É » for « élodie »). */
export function initial(pseudo: string): string {
  let first = "";
  try {
    const segments = new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(pseudo);
    first = segments[Symbol.iterator]().next().value?.segment ?? "";
  } catch {
    first = [...pseudo][0] ?? "";
  }
  return first.toLocaleUpperCase("fr").normalize("NFC");
}

/** A row of « Invitations en attente »: « Lien du {date} », « Valable jusqu’au {date} · une seule fois ». */
export function pendingLine(link: PendingInvitation, now: number): { title: string; line: string } {
  return {
    title: amis.pending.title(dateText(link.createdAt, now)),
    line: amis.pending.line(dateText(link.expiresAt, now)),
  };
}
