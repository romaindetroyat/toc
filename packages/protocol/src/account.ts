// Accounts (plan 04-01, D-01 to D-04, D-11; 04-RESEARCH Patterns 1, 3 and 5): the rules the Worker
// and the page share. The pseudo (as shown, and its uniqueness key), the backup code (Crockford
// base32, 100 bits), the invitation code, the device label of a passkey, and the zod/mini bodies and
// answers of the account API. Pure, no I/O; no e-mail anywhere (D-01).

import { COLORS } from "@toc/engine";
import * as z from "zod/mini";
import { TABLE_ID_RE } from "./names.ts";

// --- Pseudo (D-04) ---

export const PSEUDO_MIN = 2;
export const PSEUDO_MAX = 20;

export type PseudoProblem = "empty" | "short" | "long" | "chars";
export type PseudoResult = { ok: true; pseudo: string } | { ok: false; reason: PseudoProblem };

// Control characters and the bidirectional overrides (the same set as names.ts's normalizeName).
const HIDDEN = /[\p{Cc}‎‏‪-‮⁦-⁩]/gu;

/**
 * Latin letters with their accents, digits, space and ' ’ . _ - (T-04-12): no other script, so no
 * Cyrillic or Greek look-alike of a friend's pseudo.
 */
const PSEUDO_CHARS = /^[\p{Script=Latin}\p{M}0-9 '’._-]+$/u;

/**
 * A pseudo as the others will read it: NFC, control and bidi characters removed, every run of white
 * space made one space, trimmed; then 2 to 20 code points of the allowed characters.
 */
export function normalizePseudo(raw: unknown): PseudoResult {
  if (typeof raw !== "string") return { ok: false, reason: "empty" };
  if (raw.length > 200) return { ok: false, reason: "long" };
  const pseudo = raw
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(HIDDEN, "")
    .replace(/\s+/g, " ")
    .trim();
  const length = [...pseudo].length;
  if (length === 0) return { ok: false, reason: "empty" };
  if (length < PSEUDO_MIN) return { ok: false, reason: "short" };
  if (length > PSEUDO_MAX) return { ok: false, reason: "long" };
  if (!PSEUDO_CHARS.test(pseudo)) return { ok: false, reason: "chars" };
  return { ok: true, pseudo };
}

/**
 * The uniqueness key of a pseudo: lower case, accents and other marks removed, ’ read as ', spaces
 * collapsed. « Élodie », « elodie » and « ELODIE » are one pseudo. Idempotent.
 */
export function pseudoKey(pseudo: string): string {
  return pseudo
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Backup code (D-02, 04-RESEARCH Pattern 3) ---

/** Crockford base32: no I, L, O or U, so the code reads back without ambiguity. */
export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** 20 symbols of 5 bits: 100 bits. */
export const BACKUP_CODE_LENGTH = 20;

const BACKUP_CODE_RE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{20}$/;

/** Fills the bytes from a random source (crypto.getRandomValues by default). */
export type RandomFill = (bytes: Uint8Array<ArrayBuffer>) => void;

// The package's lib is plain ES (no DOM, no Workers types); every runtime it runs on (workerd, the
// browsers, Node 22) has Web Crypto's getRandomValues.
declare const crypto: { getRandomValues<T extends ArrayBufferView>(array: T): T };

const secureFill: RandomFill = (bytes) => {
  crypto.getRandomValues(bytes);
};

/** A new backup code: 20 symbols, each from one random byte (256 is a multiple of 32: no bias). */
export function newBackupCode(random: RandomFill = secureFill): string {
  const bytes = new Uint8Array(BACKUP_CODE_LENGTH);
  random(bytes);
  let code = "";
  for (const byte of bytes) code += CROCKFORD[byte & 31];
  return code;
}

/** « K7QM-2XRA-P9DW-HT4E-NB6Z »: five groups of four. */
export function formatBackupCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? []).join("-");
}

/**
 * The code a person typed, or null: upper case, spaces and dashes dropped, O read as 0, I and L as 1;
 * exactly 20 symbols of the alphabet.
 */
export function normalizeBackupCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 100) return null;
  const code = raw
    .toUpperCase()
    .replace(/[\s\-‐‑–—]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return BACKUP_CODE_RE.test(code) ? code : null;
}

// --- Invitations (D-03, D-11) and devices ---

/** An invitation link lives 7 days and serves once (D-11). */
export const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

/** An invitation code: 16 random bytes in base64url, 22 characters (the shape of a table id). */
export const INVITATION_RE = /^[A-Za-z0-9_-]{22}$/;

export function isInvitationCode(value: unknown): value is string {
  return typeof value === "string" && INVITATION_RE.test(value);
}

/** The name of a passkey's device in « Mon compte », from the User-Agent of its creation. */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux|X11|CrOS/.test(ua)) return "Linux";
  return "Appareil";
}

// --- API bodies (every one a strict object; the Worker reads at most MAX_API_BODY bytes) ---

/** The longest body of an account call, in bytes (413 above). */
export const MAX_API_BODY = 8192;

const base64url = (max: number) => z.string().check(z.maxLength(max), z.regex(/^[A-Za-z0-9_-]*$/));

/** What @simplewebauthn/browser's startRegistration sends back: shape and lengths only. */
const registrationResponse = z.strictObject({
  id: base64url(1024),
  rawId: base64url(1024),
  type: z.literal("public-key"),
  response: z.strictObject({
    clientDataJSON: base64url(2048),
    attestationObject: base64url(6144),
    transports: z.optional(z.array(z.string().check(z.maxLength(32))).check(z.maxLength(8))),
    authenticatorData: z.optional(base64url(4096)),
    publicKey: z.optional(base64url(2048)),
    publicKeyAlgorithm: z.optional(z.int()),
  }),
  clientExtensionResults: z.record(z.string().check(z.maxLength(64)), z.unknown()),
  authenticatorAttachment: z.optional(z.enum(["platform", "cross-platform"])),
});

export type RegistrationResponse = z.infer<typeof registrationResponse>;

/**
 * What @simplewebauthn/browser's startAuthentication sends back (plan 04-02): shape and lengths only.
 * userHandle is the account's WebAuthn handle (32 bytes, 43 characters; the spec allows 64 bytes).
 */
const authenticationResponse = z.strictObject({
  id: base64url(1024),
  rawId: base64url(1024),
  type: z.literal("public-key"),
  response: z.strictObject({
    clientDataJSON: base64url(2048),
    authenticatorData: base64url(4096),
    signature: base64url(2048),
    userHandle: z.optional(base64url(128)),
  }),
  clientExtensionResults: z.record(z.string().check(z.maxLength(64)), z.unknown()),
  authenticatorAttachment: z.optional(z.enum(["platform", "cross-platform"])),
});

export type AuthenticationResponse = z.infer<typeof authenticationResponse>;

/** POST /api/auth/signup/options: the invitation (or bootstrap) code and the pseudo typed. */
export const SignupOptionsBody = z.strictObject({
  invitation: z.string().check(z.maxLength(64)),
  pseudo: z.string().check(z.maxLength(200)),
});

/** POST /api/auth/signup/verify: the passkey's registration response. */
export const SignupVerifyBody = z.strictObject({ response: registrationResponse });

/** POST /api/auth/login/options and /api/auth/logout (plan 04-02): an empty JSON object. */
export const EmptyBody = z.strictObject({});

/** POST /api/auth/login/verify (plan 04-02): the passkey's authentication response. */
export const LoginVerifyBody = z.strictObject({ response: authenticationResponse });

/** POST /api/auth/passkeys/verify (plan 04-02): the registration of a passkey for this device. */
export const AddPasskeyVerifyBody = z.strictObject({ response: registrationResponse });

/** POST /api/auth/backup-code/verify (plan 04-02): the step-up assertion of one of the account's keys. */
export const BackupCodeVerifyBody = z.strictObject({ response: authenticationResponse });

/**
 * POST /api/auth/recover (plan 04-03, D-02): the pseudo and the backup code as typed (the Worker
 * normalises both; a code is at most 100 characters before that).
 */
export const RecoverBody = z.strictObject({
  pseudo: z.string().check(z.maxLength(200)),
  code: z.string().check(z.maxLength(100)),
});

/** POST /api/auth/recover/verify (plan 04-03): the new passkey's registration on this device. */
export const RecoverVerifyBody = z.strictObject({ response: registrationResponse });

/** POST /api/test/invitation (TOC_TEST_MODE only): a fresh invitation, or a used or expired one. */
export const TestInvitationBody = z.strictObject({
  used: z.optional(z.boolean()),
  expired: z.optional(z.boolean()),
});

// --- API answers ---

const passkeyInfo = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.number(),
  lastUsedAt: z.nullable(z.number()),
  backedUp: z.boolean(),
  /** The passkey this session was opened with. */
  current: z.boolean(),
});

export type PasskeyInfo = z.infer<typeof passkeyInfo>;

const meAccount = z.object({
  id: z.string(),
  pseudo: z.string(),
  createdAt: z.number(),
  passkeys: z.array(passkeyInfo),
  hasBackupCode: z.boolean(),
  backupAt: z.nullable(z.number()),
});

/** GET /api/me: the signed-in account (never a token, a code or a MAC). */
export type MeAccount = z.infer<typeof meAccount>;

const invitationState = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("ok"),
    /** null for the bootstrap code and the test-only invitations. */
    inviter: z.nullable(z.string()),
    expiresAt: z.optional(z.number()),
    bootstrap: z.optional(z.literal(true)),
  }),
  z.object({ state: z.literal("used"), inviter: z.nullable(z.string()) }),
  z.object({ state: z.literal("expired"), inviter: z.nullable(z.string()) }),
  z.object({ state: z.literal("unknown") }),
  // Plan 04-05, for a signed-in caller only: the link is their own (never spent by opening it), or
  // its inviter is already in their friends (not spent either).
  z.object({ state: z.literal("own"), inviter: z.nullable(z.string()), expiresAt: z.number() }),
  z.object({ state: z.literal("friend"), inviter: z.nullable(z.string()), expiresAt: z.number() }),
]);

/** GET /api/invitations/:code. */
export type InvitationState = z.infer<typeof invitationState>;

const signupAnswer = z.object({
  me: meAccount,
  backupCode: z.string().check(z.regex(BACKUP_CODE_RE)),
});

/** POST /api/auth/signup/verify: the account and the backup code, shown once (D-02). */
export type SignupAnswer = z.infer<typeof signupAnswer>;

/** The creation options of a passkey, as the page hands them to startRegistration (shape only). */
const creationOptions = z.looseObject({
  challenge: z.string(),
  rp: z.looseObject({ name: z.string(), id: z.optional(z.string()) }),
  user: z.looseObject({ id: z.string(), name: z.string(), displayName: z.string() }),
  pubKeyCredParams: z.array(z.looseObject({ type: z.literal("public-key"), alg: z.number() })),
});

export type CreationOptions = z.infer<typeof creationOptions>;

/** The request options of a passkey assertion, as the page hands them to startAuthentication. */
const requestOptions = z.looseObject({
  challenge: z.string(),
  rpId: z.optional(z.string()),
  allowCredentials: z.optional(
    z.array(z.looseObject({ id: z.string(), type: z.literal("public-key") })),
  ),
});

export type RequestOptions = z.infer<typeof requestOptions>;

const loginAnswer = z.object({ me: meAccount });

/** POST /api/auth/login/verify (plan 04-02): the account now signed in on this device. */
export type LoginAnswer = z.infer<typeof loginAnswer>;

const addPasskeyAnswer = z.object({ passkey: passkeyInfo });

/** POST /api/auth/passkeys/verify (plan 04-02): the key just added, now this device's. */
export type AddPasskeyAnswer = z.infer<typeof addPasskeyAnswer>;

const backupCodeAnswer = z.object({ backupCode: z.string().check(z.regex(BACKUP_CODE_RE)) });

/** POST /api/auth/backup-code/verify (plan 04-02): the new backup code, shown once (D-02). */
export type BackupCodeAnswer = z.infer<typeof backupCodeAnswer>;

const read =
  <T>(schema: { safeParse(data: unknown): { success: true; data: T } | { success: false } }) =>
  (data: unknown): T | null => {
    const parsed = schema.safeParse(data);
    return parsed.success ? parsed.data : null;
  };

export const parseMeAccount = read<MeAccount>(meAccount);
export const parseInvitationState = read<InvitationState>(invitationState);
export const parseSignupAnswer = read<SignupAnswer>(signupAnswer);
export const parseCreationOptions = read<CreationOptions>(creationOptions);
export const parseRequestOptions = read<RequestOptions>(requestOptions);
export const parseAddPasskeyAnswer = read<AddPasskeyAnswer>(addPasskeyAnswer);
export const parseBackupCodeAnswer = read<BackupCodeAnswer>(backupCodeAnswer);
export const parseLoginAnswer = read<LoginAnswer>(loginAnswer);

/** POST /api/auth/recover/verify (plan 04-03): the account recovered and its new code, shown once. */
export type RecoverAnswer = SignupAnswer;

export const parseRecoverAnswer = read<RecoverAnswer>(signupAnswer);

const recoverRefusal = z.discriminatedUnion("error", [
  /** The code is not 20 symbols of the alphabet once read back (400). */
  z.object({ error: z.literal("format") }),
  /** No such pseudo, or not its code: the same answer for both (400, T-04-03). */
  z.object({ error: z.literal("wrong") }),
  /** Too many wrong codes: the account opens again at `until`, ms since the epoch (429). */
  z.object({ error: z.literal("locked"), until: z.number() }),
]);

/** Why POST /api/auth/recover refused (plan 04-03). */
export type RecoverRefusal = z.infer<typeof recoverRefusal>;

export const parseRecoverRefusal = read<RecoverRefusal>(recoverRefusal);

// --- The account's tables (plan 04-04, ACCT-02) ---

/** The most tables GET /api/me/tables lists, newest first (the device list keeps as many). */
export const MAX_ACCOUNT_TABLES = 20;

const accountTable = z.object({
  tableId: z.string().check(z.regex(TABLE_ID_RE)),
  /** The account's seat there; null when it is at the table without a seat. */
  seat: z.nullable(z.enum(COLORS)),
  joinedAt: z.number(),
});

/** One row of GET /api/me/tables: a table the account sits at (« Mes parties en cours »). */
export type AccountTable = z.infer<typeof accountTable>;

/** GET /api/me/tables: the account's tables, newest first, at most MAX_ACCOUNT_TABLES. */
export const parseAccountTables = read<AccountTable[]>(
  z.array(accountTable).check(z.maxLength(MAX_ACCOUNT_TABLES)),
);

// --- Invitation links and friends (plan 04-05, ACCT-03, D-03, D-06, D-11) ---

/** The most pending links an account can have (the 11th is refused: « limit »). */
export const MAX_PENDING_INVITATIONS = 10;

/** An account id or an invitation's opaque id: 16 random bytes in base64url. */
const opaqueId = z.string().check(z.regex(INVITATION_RE));

const createdInvitation = z.object({
  /** The opaque id of the link (to list and disable it); never its code. */
  id: opaqueId,
  /** The code of the link, shown to its author once: the server keeps only its SHA-256. */
  code: z.string().check(z.regex(INVITATION_RE)),
  expiresAt: z.number(),
});

/** POST /api/invitations: the new link (the code is only in this answer). */
export type CreatedInvitation = z.infer<typeof createdInvitation>;

const pendingInvitation = z.object({ id: opaqueId, createdAt: z.number(), expiresAt: z.number() });

/** One row of GET /api/invitations: a pending link of the caller (no code: only its hash exists). */
export type PendingInvitation = z.infer<typeof pendingInvitation>;

const friendEntry = z.object({
  id: opaqueId,
  pseudo: z.string(),
  /** When the friendship began (ms since the epoch). */
  since: z.number(),
});

/** One friend of GET /api/friends, and the friend an invitation or a code just added. */
export type FriendEntry = z.infer<typeof friendEntry>;

const friendAnswer = z.object({
  friend: friendEntry,
  /** Present (true) when that person was already a friend: nothing was spent or written. */
  already: z.optional(z.literal(true)),
});

/** POST /api/invitations/:code/accept and POST /api/friends/code/redeem: the friend. */
export type FriendAnswer = z.infer<typeof friendAnswer>;

export const parseCreatedInvitation = read<CreatedInvitation>(createdInvitation);
export const parsePendingInvitations = read<PendingInvitation[]>(
  z.array(pendingInvitation).check(z.maxLength(MAX_PENDING_INVITATIONS)),
);
export const parseFriends = read<FriendEntry[]>(z.array(friendEntry));
export const parseFriendAnswer = read<FriendAnswer>(friendAnswer);

// --- Friend codes (plan 04-05, ACCT-03; 04-RESEARCH Pattern 5, T-04-04) ---

/** 8 symbols of Crockford base32: 40 bits, for signed-in players only (never a sign-up). */
export const FRIEND_CODE_LENGTH = 8;
/** A friend code lives 24 hours; the newest of an account replaces the older one. */
export const FRIEND_CODE_TTL_MS = 24 * 3600 * 1000;

const FRIEND_CODE_RE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;

/** A new friend code: 8 symbols, each from one random byte (no bias, as the backup code). */
export function newFriendCode(random: RandomFill = secureFill): string {
  const bytes = new Uint8Array(FRIEND_CODE_LENGTH);
  random(bytes);
  let code = "";
  for (const byte of bytes) code += CROCKFORD[byte & 31];
  return code;
}

/** « TOC-K7QM-2XRA »: the prefix and two groups of four. */
export function formatFriendCode(code: string): string {
  return `TOC-${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * The friend code a person typed, or null: upper case, spaces and dashes dropped, the « TOC » prefix
 * dropped when 8 symbols follow it, O read as 0, I and L as 1; exactly 8 symbols of the alphabet.
 */
export function normalizeFriendCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 64) return null;
  let code = raw.toUpperCase().replace(/[\s\-‐‑–—]/g, "");
  if (code.length === FRIEND_CODE_LENGTH + 3 && /^T[O0]C/.test(code)) code = code.slice(3);
  code = code.replace(/O/g, "0").replace(/[IL]/g, "1");
  return FRIEND_CODE_RE.test(code) ? code : null;
}

/** POST /api/friends/code/redeem: the code as typed (the Worker reads it back). */
export const FriendCodeRedeemBody = z.strictObject({ code: z.string().check(z.maxLength(64)) });

const friendCodeAnswer = z.object({
  code: z.string().check(z.regex(FRIEND_CODE_RE)),
  expiresAt: z.number(),
});

/** POST /api/friends/code: the account's new code (8 symbols, shown as TOC-XXXX-XXXX). */
export type FriendCodeAnswer = z.infer<typeof friendCodeAnswer>;

export const parseFriendCodeAnswer = read<FriendCodeAnswer>(friendCodeAnswer);
