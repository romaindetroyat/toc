// The French texts of the push notifications (plan 04-07, 04-UI-SPEC « Push notifications (APP-03) »).
// The Worker builds them (PlayerHub, apps/worker/src/push.ts) and the service worker of plan 04-08
// shows them as they are, always (Apple revokes the permission for a push that shows nothing). Phase-1
// typography (apps/web/src/i18n/typography.test.ts covers this file); no emoji. A name is cut to
// NOTICE_FROM_MAX code points, so every body stays under PUSH_BODY_MAX characters. A payload holds the
// kind, the texts, the table's link and the tag: never a hand, a card or a score (T-04-54).

import { NOTICE_FROM_MAX, type NoticeKind } from "./hub.ts";

/** The longest body with a 20-character name stays under this (UI-SPEC rule). */
export const PUSH_BODY_MAX = 110;

/** What a push says: a turn (the table waits for you) or an invitation to a table. */
export type PushNotice =
  | { kind: "turn"; from: string; own?: boolean; resumed?: boolean }
  | { kind: "invite"; from: string };

/** The JSON the service worker receives (plan 04-08): t, title, body, url, tag. */
export type PushPayload = {
  t: NoticeKind;
  title: string;
  body: string;
  /** The table's link inside the app. */
  url: string;
  /** One per table and kind: a newer notification replaces the older one. */
  tag: string;
};

const TURN_TITLE = "C’est ton tour !";
const INVITE_TITLE = "Invitation à une table";

/** The first NOTICE_FROM_MAX code points of a name. */
const nameOf = (from: string) => [...from].slice(0, NOTICE_FROM_MAX).join("");

/** The title and body of a notice, in French. */
export function pushText(notice: PushNotice): { title: string; body: string } {
  const from = nameOf(notice.from);
  if (notice.kind === "invite") {
    return { title: INVITE_TITLE, body: `${from} t’invite à sa table de TOC.` };
  }
  if (notice.resumed === true) {
    return { title: TURN_TITLE, body: `${from} a repris la partie : on t’attend pour continuer.` };
  }
  if (notice.own === true) {
    return {
      title: TURN_TITLE,
      body: "Ta table t’attend : la partie est en pause jusqu’à ton retour.",
    };
  }
  return {
    title: TURN_TITLE,
    body: `La table de ${from} t’attend : la partie est en pause jusqu’à ton retour.`,
  };
}

/** tour-{table} for a turn, inv-{table} for an invitation. */
export function pushTag(kind: NoticeKind, table: string): string {
  return `${kind === "turn" ? "tour" : "inv"}-${table}`;
}

/** The whole payload of one push for `table`. */
export function pushPayload(notice: PushNotice & { table: string }): PushPayload {
  const { title, body } = pushText(notice);
  return {
    t: notice.kind,
    title,
    body,
    url: `/#/table/${notice.table}`,
    tag: pushTag(notice.kind, notice.table),
  };
}
