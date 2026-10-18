// Accounts (plan 04-01, D-01 to D-04, D-11; 04-RESEARCH Patterns 1, 3 and 5): the rules the Worker
// and the page share. The pseudo (as shown, and its uniqueness key), the backup code (Crockford
// base32, 100 bits), the invitation code, the device label of a passkey, and the zod/mini bodies and
// answers of the account API. Pure, no I/O; no e-mail anywhere (D-01).

import * as z from "zod/mini";

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

/** POST /api/auth/signup/options: the invitation (or bootstrap) code and the pseudo typed. */
export const SignupOptionsBody = z.strictObject({
  invitation: z.string().check(z.maxLength(64)),
  pseudo: z.string().check(z.maxLength(200)),
});

/** POST /api/auth/signup/verify: the passkey's registration response. */
export const SignupVerifyBody = z.strictObject({ response: registrationResponse });

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
